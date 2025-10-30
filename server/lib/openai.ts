import OpenAI from "openai";
import { z } from "zod";
import { assistantCache, redisConnection } from "./redis-config";
import { agentLogger } from "./agent-logger";
import { trackTokenUsage } from "./openai-usage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: "org-AaGGTB8W7UF7Cyzrxi12lVL8",
});

// Circuit Breaker para proteger contra falhas em cascata
class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly failureThreshold = 5,
    private readonly successThreshold = 2,
    private readonly timeout = 90000, // 90s timeout for GPT-5 training processing
    private readonly resetTimeout = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.resetTimeout) {
        console.log('🔄 [CircuitBreaker] Tentando half-open...');
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - too many failures');
      }
    }

    try {
      const result = await this.withTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`OpenAI request timeout (${this.timeout/1000}s)`)), this.timeout)
      ),
    ]);
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        console.log('✅ [CircuitBreaker] Circuito FECHADO - recuperado');
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      console.error(`🔴 [CircuitBreaker] Circuito ABERTO - ${this.failureCount} falhas consecutivas`);
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }
}

const openaiCircuitBreaker = new CircuitBreaker();

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openaiCircuitBreaker.execute(() =>
    openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    })
  );
  
  // Track token usage for embeddings
  if (response.usage) {
    await trackTokenUsage(
      "text-embedding-3-small",
      response.usage.prompt_tokens || 0,
      0 // embeddings não têm completion tokens
    );
  }
  
  return response.data[0].embedding;
}

// Validação de variáveis de ambiente dos assistants
function validateAssistantEnvVars() {
  const envVars = {
    cortex: process.env.CORTEX_ASSISTANT_ID,
    apresentacao: process.env.OPENAI_APRESENTACAO_ASSISTANT_ID,
    comercial: process.env.OPENAI_COMMRCIAL_ASSISTANT_ID,
    financeiro: process.env.OPENAI_FINANCEIRO_ASSISTANT_ID,
    suporte: process.env.OPENAI_SUPORTE_ASSISTANT_ID,
    ouvidoria: process.env.OPENAI_OUVIDOIRA_ASSISTANT_ID,
    cancelamento: process.env.OPENAI_CANCELAMENTO_ASSISTANT_ID,
  };

  const missing: string[] = [];
  const configured: string[] = [];

  for (const [key, value] of Object.entries(envVars)) {
    if (!value) {
      missing.push(key);
      console.error(`❌ [OpenAI] Variável de ambiente faltando: ${key.toUpperCase()}_ASSISTANT_ID`);
    } else {
      configured.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(`🔴 [OpenAI] ${missing.length} assistants sem configuração: ${missing.join(', ')}`);
    console.error(`⚠️  [OpenAI] Configure as variáveis de ambiente em produção!`);
  } else {
    console.log(`✅ [OpenAI] Todos os ${configured.length} assistants configurados: ${configured.join(', ')}`);
  }

  return { configured, missing, isValid: missing.length === 0 };
}

// Validar na inicialização
export const ASSISTANT_ENV_STATUS = validateAssistantEnvVars();

export const ASSISTANT_IDS = {
  cortex: process.env.CORTEX_ASSISTANT_ID!,
  apresentacao: process.env.OPENAI_APRESENTACAO_ASSISTANT_ID!,
  comercial: process.env.OPENAI_COMMRCIAL_ASSISTANT_ID!,
  financeiro: process.env.OPENAI_FINANCEIRO_ASSISTANT_ID!,
  suporte: process.env.OPENAI_SUPORTE_ASSISTANT_ID!,
  ouvidoria: process.env.OPENAI_OUVIDOIRA_ASSISTANT_ID!,
  cancelamento: process.env.OPENAI_CANCELAMENTO_ASSISTANT_ID!,
};

// Mapeamento de assistente para departamento
export const ASSISTANT_TO_DEPARTMENT: Record<string, string> = {
  cortex: "general",
  apresentacao: "general",
  comercial: "commercial",
  financeiro: "financial",
  suporte: "support",
  ouvidoria: "cancellation",
  cancelamento: "cancellation",
};

export interface RouterResult {
  assistantType: string;
  assistantId: string;
  confidence: number;
}

export async function routeMessage(message: string): Promise<RouterResult> {
  const routingPrompt = `Analise a mensagem do cliente e determine qual assistente especializado deve atendê-lo:

Assistentes disponíveis:
- suporte: Problemas técnicos, conexão, velocidade, equipamentos
- comercial: Vendas, planos, upgrade, contratação
- financeiro: Faturas, pagamentos, cobranças, dúvidas financeiras
- apresentacao: Apresentação da empresa, novos clientes
- ouvidoria: Reclamações formais, SAC
- cancelamento: Cancelamento de serviço

Mensagem do cliente: "${message}"

Responda apenas com o nome do assistente (suporte, comercial, financeiro, apresentacao, ouvidoria, ou cancelamento).`;

  try {
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: routingPrompt }],
      })
    );

    // Track token usage for routing
    if (response.usage) {
      await trackTokenUsage(
        "gpt-5",
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0
      );
    }

    const assistantType = response.choices[0].message.content?.trim().toLowerCase() || "suporte";
    const validTypes = ["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento"];
    const finalType = validTypes.includes(assistantType) ? assistantType : "suporte";
    
    const assistantId = ASSISTANT_IDS[finalType as keyof typeof ASSISTANT_IDS] || ASSISTANT_IDS.suporte;
    
    console.log(`🎯 [Routing] Message routed to ${finalType} (${assistantId})`);
    
    // Log AI routing decision
    agentLogger.routing('cortex', `Mensagem roteada para ${finalType.toUpperCase()}`, {
      reasoning: `Analisou a mensagem "${message.substring(0, 100)}..." e determinou que o assistente ${finalType.toUpperCase()} é o mais adequado`,
      toAssistant: finalType,
      confidence: 0.85,
    });
    
    return {
      assistantType: finalType,
      assistantId: assistantId,
      confidence: 0.85,
    };
  } catch (error) {
    console.error("Routing error:", error);
    return {
      assistantType: "suporte",
      assistantId: ASSISTANT_IDS.suporte,
      confidence: 0.5,
    };
  }
}

export async function createThread(): Promise<string> {
  const thread = await openaiCircuitBreaker.execute(() =>
    openai.beta.threads.create()
  );
  return thread.id;
}

// Thread lock helper usando Redis para evitar concorrência
async function acquireThreadLock(threadId: string, timeoutMs: number = 60000): Promise<{ acquired: boolean; lockValue?: string }> {
  const lockKey = `thread-lock:${threadId}`;
  const lockValue = `lock-${Date.now()}-${Math.random()}`;
  const maxWaitTime = Date.now() + timeoutMs;
  let attempts = 0;
  
  while (Date.now() < maxWaitTime) {
    try {
      // TTL de 120s (maior que circuit breaker timeout de 90s)
      const acquired = await redisConnection.set(lockKey, lockValue, 'EX', 120, 'NX');
      
      if (acquired === 'OK') {
        console.log(`🔒 [OpenAI] Lock acquired for thread ${threadId} with value ${lockValue} (attempt ${attempts + 1})`);
        return { acquired: true, lockValue };
      }
      
      // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, max 2000ms
      attempts++;
      const backoffTime = Math.min(100 * Math.pow(2, attempts - 1), 2000);
      
      if (attempts % 10 === 0) {
        console.log(`⏳ [OpenAI] Aguardando lock para thread ${threadId} (tentativa ${attempts})...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    } catch (error) {
      console.error(`❌ [OpenAI] Error acquiring lock for thread ${threadId}:`, error);
      return { acquired: false };
    }
  }
  
  console.warn(`⏰ [OpenAI] Lock timeout para thread ${threadId} após ${timeoutMs}ms (${attempts} tentativas)`);
  return { acquired: false };
}

async function releaseThreadLock(threadId: string, lockValue: string): Promise<void> {
  const lockKey = `thread-lock:${threadId}`;
  
  try {
    // Usa Lua script para verificar e deletar atomicamente (só deleta se for meu lock)
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redisConnection.eval(luaScript, 1, lockKey, lockValue);
    
    if (result === 1) {
      console.log(`🔓 [OpenAI] Lock released for thread ${threadId}`);
    } else {
      console.warn(`⚠️  [OpenAI] Lock for thread ${threadId} was already released or taken by another worker`);
    }
  } catch (error) {
    console.error(`❌ [OpenAI] Error releasing lock for thread ${threadId}:`, error);
  }
}

export async function sendMessageAndGetResponse(
  threadId: string,
  assistantId: string,
  userMessage: string,
  chatId?: string,
  conversationId?: string
): Promise<{ 
  response: string; 
  transferred?: boolean; 
  transferredTo?: string;
  resolved?: boolean;
  resolveReason?: string;
  routed?: boolean;
  assistantTarget?: string;
  routingReason?: string;
  functionCalls?: Array<{name: string; arguments: string}>;
}> {
  // Adquire lock para evitar concorrência na mesma thread
  const lock = await acquireThreadLock(threadId);
  
  if (!lock.acquired) {
    console.error(`❌ [OpenAI] Could not acquire lock for thread ${threadId} - concurrent access detected`);
    return { 
      response: "Desculpe, estou processando sua mensagem anterior. Por favor, aguarde um momento." 
    };
  }
  
  try {
    if (!threadId) {
      throw new Error("Thread ID is required");
    }

    // Use suporte as default (not cortex) to avoid routing assistant
    const effectiveAssistantId = assistantId || ASSISTANT_IDS.suporte;
    
    if (!effectiveAssistantId) {
      throw new Error("No valid assistant ID available");
    }

    console.log("🔵 [OpenAI] Sending message:", { 
      threadId, 
      assistantId: effectiveAssistantId,
      providedAssistantId: assistantId,
      usedFallback: !assistantId 
    });

    // Check for active runs and cancel them if found
    try {
      const activeRuns = await openaiCircuitBreaker.execute(() =>
        openai.beta.threads.runs.list(threadId, { limit: 5 })
      );
      
      for (const activeRun of activeRuns.data) {
        if (activeRun.status === 'queued' || activeRun.status === 'in_progress' || activeRun.status === 'requires_action') {
          console.warn(`⚠️  [OpenAI] Cancelling active run ${activeRun.id} (status: ${activeRun.status})`);
          
          try {
            await openaiCircuitBreaker.execute(() =>
              openai.beta.threads.runs.cancel(activeRun.id, { thread_id: threadId })
            );
            
            // Wait and verify cancellation (up to 5 seconds)
            let cancelled = false;
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 500));
              const runStatus = await openaiCircuitBreaker.execute(() =>
                openai.beta.threads.runs.retrieve(activeRun.id, { thread_id: threadId })
              );
              
              if (runStatus.status === 'cancelled' || runStatus.status === 'failed' || runStatus.status === 'completed') {
                console.log(`✅ [OpenAI] Run ${activeRun.id} successfully cancelled (final status: ${runStatus.status})`);
                cancelled = true;
                break;
              }
              
              console.log(`⏳ [OpenAI] Waiting for cancellation... (attempt ${i + 1}/10, status: ${runStatus.status})`);
            }
            
            if (!cancelled) {
              console.error(`❌ [OpenAI] Failed to cancel run ${activeRun.id} after 5 seconds`);
              throw new Error(`Could not cancel active run ${activeRun.id}`);
            }
          } catch (cancelError) {
            console.error(`❌ [OpenAI] Error cancelling run ${activeRun.id}:`, cancelError);
            throw cancelError;
          }
        }
      }
    } catch (error) {
      console.error(`❌ [OpenAI] Error checking/cancelling active runs:`, error);
      throw new Error("Não foi possível processar sua mensagem no momento. Por favor, aguarde alguns segundos e tente novamente.");
    }

    await openaiCircuitBreaker.execute(() =>
      openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: userMessage,
      })
    );

    let run = await openaiCircuitBreaker.execute(() =>
      openai.beta.threads.runs.create(threadId, {
        assistant_id: effectiveAssistantId,
      })
    );

    console.log("🔵 [OpenAI] Run created:", { runId: run.id, threadId });

    // Manual polling loop
    let attempts = 0;
    const maxAttempts = 60;
    const runId = run.id;
    let transferData: { transferred?: boolean; transferredTo?: string } = {};
    let resolveData: { resolved?: boolean; resolveReason?: string } = {};
    let routingData: { routed?: boolean; assistantTarget?: string; routingReason?: string } = {};
    let functionCalls: Array<{name: string; arguments: string}> = [];

    while (run.status === "queued" || run.status === "in_progress" || run.status === "requires_action") {
      if (attempts >= maxAttempts) {
        throw new Error("Run timed out after 60 seconds");
      }

      console.log("🔄 [OpenAI] Polling run:", { status: run.status, runId, threadId, attempt: attempts });

      if (run.status === "requires_action" && run.required_action?.type === "submit_tool_outputs") {
        console.log("🔧 [OpenAI] Handling tool calls...");
        const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = await Promise.all(
          toolCalls.map(async (toolCall) => {
            // Capture function call for persistence
            functionCalls.push({
              name: toolCall.function.name,
              arguments: toolCall.function.arguments
            });
            
            const result = await handleToolCall(toolCall.function.name, toolCall.function.arguments, chatId, conversationId);
            
            // Check if this was a transfer call (para HUMANO - bloqueia IA)
            if (toolCall.function.name === "transferir_para_humano") {
              const transferResult = JSON.parse(result);
              if (transferResult.success) {
                transferData = {
                  transferred: true,
                  transferredTo: transferResult.departamento
                };
                
                // Log AI decision to transfer to human
                const assistantType = Object.keys(ASSISTANT_IDS).find(key => ASSISTANT_IDS[key as keyof typeof ASSISTANT_IDS] === assistantId) || 'unknown';
                const args = JSON.parse(toolCall.function.arguments);
                agentLogger.functionCall(
                  assistantType, 
                  'transferir_para_humano',
                  `Transferindo para humano - Departamento: ${transferResult.departamento}`,
                  {
                    conversationId,
                    department: transferResult.departamento,
                    reason: args.motivo || 'Não especificado',
                    decision: 'Cliente precisa de atendimento humano especializado'
                  }
                );
              }
            }
            
            // Check if this was a routing call (para ASSISTENTE - continua com IA)
            if (toolCall.function.name === "rotear_para_assistente") {
              const routingResult = JSON.parse(result);
              if (routingResult.roteado) {
                routingData = {
                  routed: true,
                  assistantTarget: routingResult.assistente,
                  routingReason: routingResult.motivo
                };
                
                // Log AI routing decision
                const fromAssistant = Object.keys(ASSISTANT_IDS).find(key => ASSISTANT_IDS[key as keyof typeof ASSISTANT_IDS] === assistantId) || 'unknown';
                agentLogger.routing(
                  fromAssistant,
                  `Roteando para assistente ${routingResult.assistente.toUpperCase()}`,
                  {
                    conversationId,
                    fromAssistant,
                    toAssistant: routingResult.assistente,
                    routingReason: routingResult.motivo,
                    decision: 'Conversa requer especialização de outro assistente'
                  }
                );
              }
            }
            
            // Check if this was a resolve call
            if (toolCall.function.name === "finalizar_conversa") {
              const resolveResult = JSON.parse(result);
              if (resolveResult.success) {
                resolveData = {
                  resolved: true,
                  resolveReason: resolveResult.motivo
                };
                
                // Log AI decision to finalize conversation
                const assistantType = Object.keys(ASSISTANT_IDS).find(key => ASSISTANT_IDS[key as keyof typeof ASSISTANT_IDS] === assistantId) || 'unknown';
                agentLogger.decision(
                  assistantType,
                  'Finalizando conversa - Problema resolvido',
                  {
                    conversationId,
                    resolveReason: resolveResult.motivo,
                    decision: 'Conversa pode ser finalizada autonomamente'
                  }
                );
              }
            }
            
            return {
              tool_call_id: toolCall.id,
              output: result,
            };
          })
        );

        run = await openaiCircuitBreaker.execute(() =>
          openai.beta.threads.runs.submitToolOutputs(runId, {
            thread_id: threadId,
            tool_outputs: toolOutputs,
          })
        );
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        run = await openaiCircuitBreaker.execute(() =>
          openai.beta.threads.runs.retrieve(runId, {
            thread_id: threadId,
          })
        );
      }

      attempts++;
    }

    console.log("🔵 [OpenAI] Run completed:", { runId: run.id, status: run.status, threadId });

    // Track token usage if available
    if (run.usage) {
      await trackTokenUsage(
        "gpt-5", // Assistant model
        run.usage.prompt_tokens || 0,
        run.usage.completion_tokens || 0
      );
    }

    if (run.status === "failed" || run.status === "cancelled" || run.status === "expired") {
      // Log detailed error information from OpenAI
      const errorDetails = {
        status: run.status,
        runId: run.id,
        threadId: threadId,
        lastError: (run as any).last_error || null,
        incompleteDetails: (run as any).incomplete_details || null,
      };
      
      console.error("❌ [OpenAI] Run failed with details:", JSON.stringify(errorDetails, null, 2));
      
      // Create detailed error message
      let errorMessage = `Run failed with status: ${run.status}`;
      if ((run as any).last_error) {
        const lastError = (run as any).last_error;
        errorMessage += ` | Error: ${lastError.code || 'unknown'} - ${lastError.message || 'No message provided'}`;
      }
      
      throw new Error(errorMessage);
    }

    const messages = await openaiCircuitBreaker.execute(() =>
      openai.beta.threads.messages.list(threadId, {
        order: "desc",
        limit: 1,
      })
    );

    const lastMessage = messages.data[0];
    
    // DEBUG: Log complete response structure
    console.log("🔍 [OpenAI DEBUG] Last message:", JSON.stringify(lastMessage, null, 2));
    
    if (lastMessage && lastMessage.role === "assistant") {
      // Check if content array exists and is not empty before accessing
      if (!Array.isArray(lastMessage.content) || lastMessage.content.length === 0) {
        console.log("⚠️ [OpenAI] Assistant returned empty content array");
        
        // If routing was requested, return routing confirmation
        if (routingData.routed) {
          console.log("✅ [OpenAI] Empty content with routing - using fallback message");
          return {
            response: `Perfeito! Vou conectar você com nosso time de ${routingData.assistantTarget}. Um momento!`,
            ...routingData,
            functionCalls: functionCalls.length > 0 ? functionCalls : undefined
          };
        }
        
        // If transfer was requested, return transfer confirmation
        if (transferData.transferred) {
          console.log("✅ [OpenAI] Empty content with transfer - using fallback message");
          return {
            response: `Entendido! Vou transferir você para ${transferData.transferredTo || 'um atendente humano'}. Em instantes você será atendido por nossa equipe.`,
            ...transferData,
            ...resolveData,
            functionCalls: functionCalls.length > 0 ? functionCalls : undefined
          };
        }
        
        // If resolve was requested, return resolve confirmation
        if (resolveData.resolved) {
          console.log("✅ [OpenAI] Empty content with resolve - using fallback message");
          return {
            response: "Conversa finalizada. Foi um prazer ajudar você! 😊",
            ...resolveData,
            functionCalls: functionCalls.length > 0 ? functionCalls : undefined
          };
        }
        
        // No action taken, return generic message
        console.log("⚠️ [OpenAI] Empty content without action - returning fallback");
        return {
          response: "Entendi. Como posso ajudar você?",
          ...transferData,
          ...resolveData,
          ...routingData,
          functionCalls: functionCalls.length > 0 ? functionCalls : undefined
        };
      }
      
      const content = lastMessage.content[0];
      if (content && content.type === "text") {
        const responseText = content.text.value;
        
        // Detect if assistant is returning JSON instead of conversational response
        if (responseText.trim().startsWith('{') && responseText.includes('recommendedAssistantType')) {
          console.error("⚠️ [CONFIGURATION ERROR] Assistant returned routing JSON instead of conversational response!");
          console.error("⚠️ Assistant ID:", effectiveAssistantId);
          console.error("⚠️ This assistant needs to be reconfigured in OpenAI platform");
          console.error("⚠️ See INSTRUCOES_ASSISTENTES_OPENAI.md for correct configuration");
          
          // Return a helpful error to the user
          return {
            response: "Desculpe, há um problema de configuração no sistema. Por favor, contate o suporte técnico. (Erro: Assistente configurado incorretamente)",
            ...transferData,
            ...resolveData
          };
        }
        
        return {
          response: responseText,
          ...transferData,
          ...resolveData,
          ...routingData,
          functionCalls: functionCalls.length > 0 ? functionCalls : undefined
        };
      }
    }

    // If transfer was requested but no assistant message, return transfer confirmation
    if (transferData.transferred) {
      console.log("✅ [OpenAI] Transfer requested but no response - using fallback message");
      return {
        response: `Entendido! Vou transferir você para ${transferData.transferredTo || 'um atendente humano'}. Em instantes você será atendido por nossa equipe.`,
        ...transferData,
        ...resolveData,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
      };
    }

    // If routing was requested but no assistant message, return routing confirmation
    if (routingData.routed) {
      console.log("✅ [OpenAI] Routing requested but no response - using fallback message");
      return {
        response: `Perfeito! Vou conectar você com nosso time de ${routingData.assistantTarget}. Um momento!`,
        ...routingData,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
      };
    }

    // If resolve was requested but no assistant message, return resolve confirmation
    if (resolveData.resolved) {
      console.log("✅ [OpenAI] Resolve requested but no response - using fallback message");
      return {
        response: "Atendimento finalizado com sucesso! Em breve você receberá uma pesquisa de satisfação.",
        ...resolveData,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
      };
    }

    console.error("⚠️ [OpenAI] No valid response from assistant");
    return { response: "Desculpe, não consegui processar sua mensagem." };
  } catch (error) {
    console.error("Assistant run error:", error);
    return { response: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente." };
  } finally {
    // Sempre libera o lock, mesmo em caso de erro (só se foi adquirido)
    if (lock.lockValue) {
      await releaseThreadLock(threadId, lock.lockValue);
    }
  }
}

async function handleToolCall(functionName: string, argsString: string, chatId?: string, conversationId?: string): Promise<string> {
  try {
    console.log(`🔧 [AI Tool] Handling function call: ${functionName}`);
    const args = JSON.parse(argsString);
    console.log(`🔧 [AI Tool] Function arguments:`, JSON.stringify(args));
    console.log(`🔧 [AI Tool] Context - chatId: ${chatId || 'undefined'}, conversationId: ${conversationId || 'undefined'}`);
    console.log(`🔧 [AI Tool] Entering switch for function: "${functionName}" (length: ${functionName.length})`);

    switch (functionName) {
      case "verificar_conexao":
        if (!conversationId) {
          console.error("❌ [AI Tool] verificar_conexao chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { consultaStatusConexao } = await import("../ai-tools");
        const { storage: storageConexao } = await import("../storage");
        
        try {
          console.log(`🔍 [AI Tool Handler] Iniciando consulta de status de conexão para conversação ${conversationId}`);
          
          // ESTRATÉGIA 1: Tentar usar documento fornecido como parâmetro (se houver)
          let documentoParaUsar = args.documento;
          
          // ESTRATÉGIA 2: Se não houver documento fornecido, buscar do banco
          if (!documentoParaUsar) {
            console.log(`🔍 [AI Tool Handler] Documento não fornecido como parâmetro, buscando no banco...`);
            
            const conversationConexao = await storageConexao.getConversation(conversationId);
            
            if (!conversationConexao) {
              console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
              return JSON.stringify({
                error: "Conversa não encontrada"
              });
            }
            
            console.log(`🔍 [AI Tool Handler] Conversa encontrada. clientDocument: ${conversationConexao.clientDocument ? 'SIM' : 'NÃO'}`);
            
            if (!conversationConexao.clientDocument) {
              console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
              return JSON.stringify({
                error: "Para verificar sua conexão, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
              });
            }
            
            documentoParaUsar = conversationConexao.clientDocument;
            console.log(`✅ [AI Tool Handler] CPF encontrado no banco! Usando CPF persistido.`);
          } else {
            console.log(`✅ [AI Tool Handler] Usando documento fornecido como parâmetro: ***.***.***-${documentoParaUsar.slice(-2)}`);
          }
          
          console.log(`🔍 [AI Tool Handler] Chamando consultaStatusConexao com documento...`);
          
          // Chamar diretamente a API real
          const conexoes = await consultaStatusConexao(
            documentoParaUsar,
            { conversationId },
            storageConexao
          );
          
          console.log(`✅ [AI Tool Handler] Status de conexão consultado com sucesso: ${conexoes?.length || 0} conexão(ões)`);
          
          // Formatar resposta
          if (!conexoes || conexoes.length === 0) {
            return JSON.stringify({
              mensagem: "Não encontrei conexões ativas para este CPF/CNPJ."
            });
          }
          
          // Mapear conexões para formato simplificado
          const conexoesFormatadas = conexoes.map(conexao => ({
            nome_cliente: conexao.nomeCliente,
            plano: conexao.plano,
            velocidade: conexao.velocidadeContratada,
            login: conexao.LOGIN,
            status_ip: conexao.statusIP,
            status_pppoe: conexao.statusPPPoE,
            conectado_desde: conexao.conectadoDesde,
            minutos_conectado: conexao.minutosConectado
          }));
          
          return JSON.stringify(conexoesFormatadas);
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao consultar status de conexão:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
          }
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao consultar status de conexão"
          });
        }

      case "consultar_pppoe_status":
        // REDIRECIONAR para verificar_conexao (mesmo handler)
        console.log("🔄 [AI Tool] consultar_pppoe_status → Redirecionando para verificar_conexao");
        
        if (!conversationId) {
          console.error("❌ [AI Tool] consultar_pppoe_status chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { consultaStatusConexao: consultaPPPoE } = await import("../ai-tools");
        const { storage: storagePPPoE } = await import("../storage");
        
        try {
          console.log(`🔍 [AI Tool Handler] Iniciando consulta PPPoE para conversação ${conversationId}`);
          
          // ESTRATÉGIA 1: Tentar usar documento fornecido como parâmetro (cpf ou documento)
          let documentoPPPoE = args.cpf || args.documento;
          
          // ESTRATÉGIA 2: Se não houver documento fornecido, buscar do banco
          if (!documentoPPPoE) {
            console.log(`🔍 [AI Tool Handler] Documento não fornecido como parâmetro, buscando no banco...`);
            
            const conversationPPPoE = await storagePPPoE.getConversation(conversationId);
            
            if (!conversationPPPoE) {
              console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
              return JSON.stringify({
                error: "Conversa não encontrada"
              });
            }
            
            console.log(`🔍 [AI Tool Handler] Conversa encontrada. clientDocument: ${conversationPPPoE.clientDocument ? 'SIM' : 'NÃO'}`);
            
            if (!conversationPPPoE.clientDocument) {
              console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
              return JSON.stringify({
                error: "Para verificar sua conexão, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
              });
            }
            
            documentoPPPoE = conversationPPPoE.clientDocument;
            console.log(`✅ [AI Tool Handler] CPF encontrado no banco! Usando CPF persistido.`);
          } else {
            console.log(`✅ [AI Tool Handler] Usando documento fornecido como parâmetro: ***.***.***-${documentoPPPoE.slice(-2)}`);
          }
          
          console.log(`🔍 [AI Tool Handler] Chamando consultaStatusConexao com documento...`);
          
          // Chamar diretamente a API real
          const conexoesPPPoE = await consultaPPPoE(
            documentoPPPoE,
            { conversationId },
            storagePPPoE
          );
          
          console.log(`✅ [AI Tool Handler] Status de conexão consultado com sucesso: ${conexoesPPPoE?.length || 0} conexão(ões)`);
          
          // Formatar resposta
          if (!conexoesPPPoE || conexoesPPPoE.length === 0) {
            return JSON.stringify({
              mensagem: "Não encontrei conexões ativas para este CPF/CNPJ."
            });
          }
          
          // Mapear conexões para formato simplificado
          const conexoesFormatadasPPPoE = conexoesPPPoE.map(conexao => ({
            nome_cliente: conexao.nomeCliente,
            plano: conexao.plano,
            velocidade: conexao.velocidadeContratada,
            login: conexao.LOGIN,
            status_ip: conexao.statusIP,
            status_pppoe: conexao.statusPPPoE,
            conectado_desde: conexao.conectadoDesde,
            minutos_conectado: conexao.minutosConectado
          }));
          
          return JSON.stringify(conexoesFormatadasPPPoE);
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao consultar status PPPoE:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
          }
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao consultar status de conexão"
          });
        }

      case "consultar_fatura":
        // REDIRECIONAR para consulta_boleto_cliente (API real)
        if (!conversationId) {
          console.error("❌ [AI Tool] consultar_fatura chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível para consulta de boletos"
          });
        }
        
        const { consultaBoletoCliente: consultaBoletoFatura } = await import("../ai-tools");
        const { storage: storageFatura } = await import("../storage");
        
        try {
          // Buscar documento do cliente automaticamente da conversa
          const conversationFatura = await storageFatura.getConversation(conversationId);
          
          if (!conversationFatura) {
            console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
            return JSON.stringify({
              error: "Conversa não encontrada"
            });
          }
          
          if (!conversationFatura.clientDocument) {
            console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
            return JSON.stringify({
              error: "Para consultar seus boletos, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
            });
          }
          
          // Chamar diretamente a API real
          const boletosFatura = await consultaBoletoFatura(
            conversationFatura.clientDocument,
            { conversationId },
            storageFatura
          );
          
          console.log(`✅ [AI Tool] Boletos consultados com sucesso via consultar_fatura`);
          return JSON.stringify(boletosFatura);
        } catch (error) {
          console.error("❌ [AI Tool] Erro ao consultar boletos via consultar_fatura:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool] Stack trace:", error.stack);
            console.error("❌ [AI Tool] Tipo de erro:", error.constructor.name);
          }
          
          // IMPORTANTE: Retornar erro ESTRUTURADO para que a IA NUNCA use dados mockados
          return JSON.stringify({
            status: "ERRO_API",
            error: error instanceof Error ? error.message : "Erro ao consultar boletos",
            instrucao_ia: "ATENÇÃO: A consulta de boletos FALHOU. NÃO invente dados. NÃO use exemplos. Informe ao cliente que houve um problema técnico temporário e peça para tentar novamente em alguns minutos ou ofereça transferir para atendimento humano."
          });
        }

      case "consultar_base_de_conhecimento":
        const query = args.query || "";
        const startTime = Date.now();
        const { searchKnowledge } = await import("./upstash");
        const results = await searchKnowledge(query, 3);
        const executionTime = Date.now() - startTime;
        
        // Track RAG usage for analytics
        if (conversationId) {
          try {
            const { storage } = await import("../storage");
            const conversation = await storage.getConversation(conversationId);
            
            if (conversation) {
              await storage.createRagAnalytics({
                conversationId,
                assistantType: conversation.assistantType,
                query,
                resultsCount: results.length,
                resultsFound: results.length > 0,
                sources: results.map(r => r.chunk.source),
                executionTime
              });
            }
          } catch (error) {
            console.error('❌ [RAG Analytics] Failed to track:', error);
            // Continue even if tracking fails
          }
        }
        
        if (results.length === 0) {
          return `--- CONTEXTO DA BASE DE CONHECIMENTO ---
Não foram encontradas informações específicas sobre este tópico na base de conhecimento.

--- SUA TAREFA ---
1. Informe ao cliente de forma natural e honesta que não encontrou a informação específica.
2. Ofereça transferir para um atendente humano que possa ajudar.
3. NUNCA mencione "base de conhecimento" ou "contexto" - aja naturalmente.
4. Responda seguindo todas as regras absolutas e de persona definidas para você.`;
        }
        
        const contextoRecuperado = results.map(r => r.chunk.content).join('\n\n');
        const fonte = results[0]?.chunk.source || "Base de Conhecimento TR Telecom";
        
        // Retorna PROMPT RAG ESTRUTURADO conforme recomendação do especialista
        return `--- CONTEXTO DA BASE DE CONHECIMENTO ---
${contextoRecuperado}

--- SUA TAREFA ---
1. **Analise a pergunta do cliente** usando o histórico da conversa para entender o contexto completo.
2. **Formule uma resposta precisa e concisa usando APENAS as informações contidas no CONTEXTO DA BASE DE CONHECIMENTO acima.**
3. **Se a resposta não estiver no CONTEXTO fornecido, seja honesto:** Informe que não encontrou a informação específica e ofereça ajuda de outra forma.
4. **NUNCA mencione** a existência da "base de conhecimento" ou do "contexto" na sua resposta. Aja como se você soubesse a informação naturalmente.
5. **Responda seguindo todas as regras absolutas e de persona definidas para você.**

Fonte: ${fonte}`;

      case "transferir_para_humano":
        const departamento = args.departamento || args.department || "Suporte Geral";
        const motivo = args.motivo || args.reason || "Solicitação do cliente";
        
        console.log("🔀 [Transfer] IA solicitou transferência para HUMANO:", { chatId, departamento, motivo });
        
        // Mark conversation for transfer (will be processed in routes.ts)
        return JSON.stringify({
          success: true,
          departamento,
          motivo,
          mensagem: "Transferência para atendimento humano iniciada com sucesso",
        });

      case "rotear_para_assistente":
        // 🆕 BLOQUEIO: Verificar se está aguardando seleção de ponto
        if (conversationId) {
          const { installationPointManager } = await import('./redis-config');
          const isAwaitingSelection = await installationPointManager.isAwaitingSelection(conversationId);
          
          if (isAwaitingSelection) {
            console.warn(`⛔ [Routing] BLOQUEADO - Conversa ${conversationId} está aguardando seleção de ponto de instalação`);
            return JSON.stringify({
              roteado: false,
              bloqueado: true,
              mensagem: "Aguardando seleção do cliente. Não é possível rotear neste momento.",
            });
          }
        }
        
        const assistente = args.assistantType || args.assistente || args.departamento || args.department || "Suporte";
        const motivo_roteamento = args.motivo || args.reason || "Roteamento interno";
        
        console.log("🎭 [Routing] IA solicitou roteamento para ASSISTENTE:", { chatId, assistente, motivo: motivo_roteamento });
        
        // Mark conversation for internal routing (will be processed in routes.ts)
        return JSON.stringify({
          roteado: true,
          assistente,
          motivo: motivo_roteamento,
          mensagem: `Roteando para assistente ${assistente}`,
        });

      case "finalizar_conversa":
        const motivo_finalizacao = args.motivo || "Problema resolvido";
        
        console.log("✅ [Resolve] IA solicitou finalização:", { chatId, motivo: motivo_finalizacao });
        
        // Mark conversation for resolution (will be processed in routes.ts)
        return JSON.stringify({
          success: true,
          motivo: motivo_finalizacao,
          mensagem: "Conversa finalizada com sucesso. Pesquisa de satisfação será enviada ao cliente.",
        });

      case "registrar_reclamacao_ouvidoria":
        if (!conversationId) {
          console.error("❌ [AI Tool] registrar_reclamacao_ouvidoria chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível para registrar reclamação"
          });
        }
        
        const { storage: storageComplaint } = await import("../storage");
        
        const complaintType = args.tipo || args.type || "outro";
        const complaintSeverity = args.gravidade || args.severity || "media";
        const complaintDescription = args.descricao || args.description || "Sem descrição fornecida";
        
        try {
          const complaint = await storageComplaint.createComplaint({
            conversationId,
            complaintType,
            severity: complaintSeverity,
            description: complaintDescription,
            status: "novo",
          });
          
          console.log(`📋 [Ouvidoria] Reclamação registrada:`, { 
            complaintId: complaint.id,
            conversationId,
            type: complaintType,
            severity: complaintSeverity
          });
          
          return JSON.stringify({
            success: true,
            protocolo: complaint.id,
            tipo: complaintType,
            gravidade: complaintSeverity,
            mensagem: `Reclamação registrada com sucesso. Protocolo: ${complaint.id}. Sua reclamação será analisada por nossa equipe.`,
          });
        } catch (error) {
          console.error("❌ [Ouvidoria] Erro ao registrar reclamação:", error);
          return JSON.stringify({
            error: "Não foi possível registrar a reclamação. Tente novamente.",
          });
        }

      case "agendar_visita":
        console.warn("⚠️ [AI Tool] agendar_visita chamada - função não implementada");
        return JSON.stringify({
          error: "Função de agendamento de visita não está disponível no momento. Por favor, solicite transferência para atendimento humano."
        });

      case "buscar_cep":
        console.log("📍 [AI Tool] buscar_cep chamada -", args.cep);
        try {
          const cep = args.cep?.replace(/\D/g, ''); // Remove caracteres não numéricos
          
          if (!cep || cep.length !== 8) {
            return JSON.stringify({
              error: "CEP inválido. Por favor, informe um CEP válido com 8 dígitos (ex: 12345-678)."
            });
          }

          // Buscar endereço na API ViaCEP
          const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await response.json();
          
          if (data.erro) {
            return JSON.stringify({
              error: "CEP não encontrado. Por favor, verifique o CEP informado."
            });
          }

          console.log("✅ [CEP] Endereço encontrado:", data.logradouro, data.bairro, data.localidade);

          // ============================================================================
          // VERIFICAÇÃO DE VIABILIDADE - CIDADES COM COBERTURA TR TELECOM
          // ============================================================================
          // Cidades atendidas: Três Rios RJ, Comendador Levy Gasparian RJ, 
          // Santana do Deserto MG, Simão Pereira MG, Paraíba do Sul RJ, Chiador MG, Areal RJ
          const cidadesComCobertura = [
            "três rios",
            "tres rios",
            "comendador levy gasparian",
            "levy gasparian",
            "santana do deserto",
            "simão pereira",
            "simao pereira",
            "paraíba do sul",
            "paraiba do sul",
            "chiador",
            "areal"
          ];
          
          const cidadeNormalizada = data.localidade?.toLowerCase().trim() || "";
          const temCobertura = cidadesComCobertura.some(cidade => 
            cidadeNormalizada.includes(cidade) || cidade.includes(cidadeNormalizada)
          );

          // Preparar resultado para retorno e persistência
          const coverageResult = {
            success: true,
            cep: data.cep,
            logradouro: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || "",
            complemento: data.complemento || "",
            tem_cobertura: temCobertura,
            mensagem: temCobertura 
              ? `Endereço encontrado: ${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}. Temos cobertura nessa região! 🎉`
              : `Endereço encontrado: ${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}. Infelizmente, ainda não temos cobertura nessa região. 😔`,
            timestamp: new Date().toISOString()
          };

          // ============================================================================
          // PERSISTIR RESULTADO DA VERIFICAÇÃO DE COBERTURA NO BANCO
          // ============================================================================
          if (conversationId) {
            try {
              const { db } = await import("../db");
              const { conversations } = await import("../../shared/schema");
              const { eq } = await import("drizzle-orm");
              
              await db.update(conversations)
                .set({ 
                  lastCoverageCheck: coverageResult 
                })
                .where(eq(conversations.id, conversationId));
              
              console.log(`✅ [CEP] Resultado da verificação de cobertura salvo no banco (tem_cobertura: ${temCobertura})`);
            } catch (dbError) {
              console.error("❌ [CEP] Erro ao salvar resultado da verificação de cobertura:", dbError);
            }
          } else {
            console.warn("⚠️ [CEP] conversationId não disponível - resultado não será persistido");
          }

          if (!temCobertura) {
            console.log("⚠️ [CEP] Sem cobertura na cidade:", data.localidade);
          }

          return JSON.stringify(coverageResult);
        } catch (error) {
          console.error("❌ [AI Tool] Erro ao buscar CEP:", error);
          return JSON.stringify({
            error: "Erro ao buscar CEP. Por favor, tente novamente ou informe o endereço manualmente."
          });
        }

      case "consultar_planos":
        console.log("📋 [AI Tool] consultar_planos chamada - buscando planos ativos");
        try {
          const { storage: storagePlans } = await import("../storage");
          const plans = await storagePlans.getActivePlans();
          
          // Formatar planos para resposta humanizada
          const plansFormatted = plans.map((plan: any) => ({
            id: plan.id,
            nome: plan.name,
            tipo: plan.type,
            velocidade_download: plan.downloadSpeed > 0 ? `${plan.downloadSpeed} Mbps` : null,
            velocidade_upload: plan.uploadSpeed > 0 ? `${plan.uploadSpeed} Mbps` : null,
            preco: `R$ ${(plan.price / 100).toFixed(2).replace('.', ',')}`,
            descricao: plan.description,
            beneficios: plan.features
          }));
          
          return JSON.stringify({
            success: true,
            quantidade: plans.length,
            planos: plansFormatted,
            mensagem: `Encontrei ${plans.length} planos disponíveis.`
          });
        } catch (error) {
          console.error("❌ [AI Tool] Erro ao consultar planos:", error);
          return JSON.stringify({
            error: "Erro ao buscar planos disponíveis. Tente novamente."
          });
        }

      case "enviar_cadastro_venda":
        console.log("💰 [AI Tool] enviar_cadastro_venda chamada - processando lead");
        try {
          // ============================================================================
          // VALIDAÇÃO CRÍTICA: VERIFICAR COBERTURA ANTES DE PROCESSAR VENDA
          // ============================================================================
          if (conversationId) {
            try {
              const { db: dbSales } = await import("../db");
              const { conversations: conversationsSales } = await import("../../shared/schema");
              const { eq: eqSales } = await import("drizzle-orm");
              
              const conversationData = await dbSales.query.conversations.findFirst({
                where: eqSales(conversationsSales.id, conversationId)
              });
              
              const lastCoverage = conversationData?.lastCoverageCheck as any;
              
              // Validação 1: Verificar se existe lastCoverageCheck
              if (!lastCoverage) {
                console.error("🚫 [Sales Validation] BLOQUEADO - Nenhuma verificação de CEP encontrada");
                return JSON.stringify({
                  error: "É necessário verificar o CEP antes de finalizar o cadastro. Por favor, informe o CEP do cliente.",
                  instrucao: "Use a função buscar_cep() antes de enviar_cadastro_venda()."
                });
              }

              // Validação 2: Verificar se tem cobertura
              if (lastCoverage.tem_cobertura === false) {
                console.error("🚫 [Sales Validation] BLOQUEADO - Tentativa de venda em região SEM cobertura");
                console.error(`🚫 [Sales Validation] Cidade: ${lastCoverage.cidade}, Estado: ${lastCoverage.estado}`);
                
                return JSON.stringify({
                  error: "Não é possível finalizar o cadastro de venda porque não temos cobertura nesta região.",
                  tem_cobertura: false,
                  cidade: lastCoverage.cidade,
                  estado: lastCoverage.estado,
                  instrucao: "Use a função registrar_lead_sem_cobertura() para registrar apenas o interesse do cliente (nome, telefone, cidade, email opcional)."
                });
              }

              // Validação 3: Verificar se CEP da venda COINCIDE com lastCoverageCheck
              const saleCep = args.endereco?.cep?.replace(/\D/g, '');
              const checkedCep = lastCoverage.cep?.replace(/\D/g, '');
              
              if (saleCep && checkedCep && saleCep !== checkedCep) {
                console.error("🚫 [Sales Validation] BLOQUEADO - CEP da venda não coincide com CEP verificado");
                console.error(`🚫 [Sales Validation] CEP verificado: ${checkedCep}, CEP da venda: ${saleCep}`);
                
                return JSON.stringify({
                  error: "O CEP fornecido no endereço não coincide com o CEP verificado anteriormente. Por favor, verifique o CEP novamente com buscar_cep().",
                  cep_verificado: lastCoverage.cep,
                  cep_fornecido: args.endereco?.cep,
                  instrucao: "Chame buscar_cep() com o CEP correto antes de enviar_cadastro_venda()."
                });
              }

              // Validação 4: Verificar freshness (5 minutos)
              const coverageTimestamp = lastCoverage.timestamp ? new Date(lastCoverage.timestamp).getTime() : 0;
              const now = Date.now();
              const fiveMinutesMs = 5 * 60 * 1000;
              
              if (now - coverageTimestamp > fiveMinutesMs) {
                console.warn("⚠️ [Sales Validation] lastCoverageCheck está DESATUALIZADO (>5 min)");
                return JSON.stringify({
                  error: "A verificação de cobertura está desatualizada. Por favor, verifique o CEP novamente.",
                  instrucao: "Chame buscar_cep() novamente antes de enviar_cadastro_venda()."
                });
              }
              
              console.log(`✅ [Sales Validation] Todas validações OK - ${lastCoverage.cidade}, ${lastCoverage.estado}, CEP: ${lastCoverage.cep}`);
            } catch (validationError) {
              console.error("❌ [Sales Validation] Erro ao validar cobertura:", validationError);
              return JSON.stringify({
                error: "Erro ao validar cobertura. Por favor, tente novamente."
              });
            }
          }

          // ============================================================================
          // VALIDAÇÃO COMPLETA DE CAMPOS OBRIGATÓRIOS PARA VENDA
          // ============================================================================
          const requiredFields = ['tipo_pessoa', 'nome_cliente', 'telefone_cliente', 'plano_id'];
          const missingFields = requiredFields.filter(field => !args[field]);
          
          if (missingFields.length > 0) {
            console.error("❌ [Sales] Campos básicos obrigatórios faltando:", missingFields);
            return JSON.stringify({
              error: `Dados básicos incompletos. Faltam: ${missingFields.join(', ')}`,
              campos_faltantes: missingFields
            });
          }

          // Validar CPF/CNPJ
          const cpfCnpj = args.cpf_cnpj || args.cpf_cliente || args.cnpj;
          if (!cpfCnpj) {
            console.error("❌ [Sales] CPF/CNPJ não fornecido");
            return JSON.stringify({
              error: "CPF ou CNPJ é obrigatório para finalizar o cadastro."
            });
          }

          // Validar email
          if (!args.email_cliente && !args.email) {
            console.error("❌ [Sales] Email não fornecido");
            return JSON.stringify({
              error: "Email é obrigatório para finalizar o cadastro."
            });
          }

          // Validar endereço completo
          if (!args.endereco) {
            console.error("❌ [Sales] Endereço não fornecido");
            return JSON.stringify({
              error: "Endereço completo é obrigatório (CEP, logradouro, número, bairro, cidade, estado)."
            });
          }

          const enderecoFields = ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'estado'];
          const missingAddressFields = enderecoFields.filter(field => !args.endereco[field]);
          
          if (missingAddressFields.length > 0) {
            console.error("❌ [Sales] Campos de endereço faltando:", missingAddressFields);
            return JSON.stringify({
              error: `Endereço incompleto. Faltam: ${missingAddressFields.join(', ')}`,
              campos_faltantes: missingAddressFields
            });
          }

          // Validar campos complementares para Pessoa Física (apenas obrigatórios)
          if (args.tipo_pessoa === 'PF') {
            const pfFields = ['data_nascimento', 'rg'];
            const missingPfFields = pfFields.filter(field => !args[field]);
            
            if (missingPfFields.length > 0) {
              console.error("❌ [Sales] Campos complementares PF faltando:", missingPfFields);
              return JSON.stringify({
                error: `Para Pessoa Física, são necessários: ${missingPfFields.join(', ')}`,
                campos_faltantes: missingPfFields
              });
            }
          }

          // Validar dia de vencimento
          if (!args.dia_vencimento) {
            console.error("❌ [Sales] Dia de vencimento não fornecido");
            return JSON.stringify({
              error: "Dia de vencimento é obrigatório (05, 10 ou 15)."
            });
          }

          // Preparar dados do cadastro (já validados)
          const saleData = {
            type: args.tipo_pessoa, // "PF" ou "PJ"
            customerName: args.nome_cliente,
            cpfCnpj: args.cpf_cnpj || args.cpf_cliente || args.cnpj,
            email: args.email_cliente || args.email,
            phone: args.telefone_cliente || args.telefone,
            phone2: args.telefone_secundario || args.telefone2,
            motherName: args.nome_mae,
            birthDate: args.data_nascimento,
            rg: args.rg,
            sex: args.sexo,
            civilStatus: args.estado_civil,
            // Address - Extract individual fields from endereco object
            cep: args.endereco?.cep || null,
            address: args.endereco?.logradouro || null,
            number: args.endereco?.numero || null,
            complement: args.endereco?.complemento || null,
            neighborhood: args.endereco?.bairro || null,
            city: args.endereco?.cidade || null,
            state: args.endereco?.estado || null,
            reference: args.endereco?.referencia || null,
            // Service
            planId: args.plano_id,
            billingDay: args.dia_vencimento ? parseInt(args.dia_vencimento) : null,
            preferredInstallDate: args.data_instalacao_preferida,
            availability: args.disponibilidade,
            // Lead Management
            source: "chat",
            status: "Aguardando Análise",
            conversationId,
            observations: args.observacoes,
            howDidYouKnow: args.como_conheceu || null, // Como conheceu a TR Telecom
          };

          // Salvar no banco via storage
          const { storage: storageSales } = await import("../storage");
          const sale = await storageSales.addSale(saleData);

          console.log(`✅ [Sales] Cadastro registrado com sucesso - ID: ${sale.id}`);

          return JSON.stringify({
            success: true,
            lead_id: sale.id,
            protocolo: sale.id,
            mensagem: `Cadastro registrado com sucesso! Protocolo: ${sale.id}. Nossa equipe entrará em contato em breve no telefone ${saleData.phone} para confirmar os dados e agendar a instalação.`
          });
        } catch (error) {
          console.error("❌ [Sales] Erro ao processar cadastro de venda:", error);
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao processar cadastro. Tente novamente ou solicite transferência para atendimento humano."
          });
        }

      case "registrar_lead_sem_cobertura":
        console.log("📋 [AI Tool] registrar_lead_sem_cobertura chamada - registrando interesse de cliente sem cobertura");
        try {
          // ============================================================================
          // VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
          // ============================================================================
          const requiredLeadFields = ['nome', 'telefone', 'cidade'];
          const missingLeadFields = requiredLeadFields.filter(field => !args[field]);
          
          if (missingLeadFields.length > 0) {
            console.error("❌ [Lead] Campos obrigatórios faltando:", missingLeadFields);
            return JSON.stringify({
              error: `Dados incompletos. Para registrar seu interesse, preciso de: ${missingLeadFields.join(', ')}`,
              campos_faltantes: missingLeadFields
            });
          }

          // Validar e normalizar nome (mínimo 3 caracteres)
          const leadName = args.nome.trim();
          if (leadName.length < 3) {
            console.error("❌ [Lead] Nome muito curto:", leadName);
            return JSON.stringify({
              error: "Nome inválido. Por favor, informe o nome completo (mínimo 3 caracteres)."
            });
          }

          // Validar e normalizar telefone (apenas números, mínimo 10 dígitos)
          const leadPhone = args.telefone.replace(/\D/g, '');
          if (leadPhone.length < 10 || leadPhone.length > 11) {
            console.error("❌ [Lead] Telefone inválido:", args.telefone);
            return JSON.stringify({
              error: "Telefone inválido. Por favor, informe um telefone válido com DDD (ex: (24) 99999-9999)."
            });
          }

          // Validar e normalizar cidade (mínimo 3 caracteres)
          const leadCity = args.cidade.trim();
          if (leadCity.length < 3) {
            console.error("❌ [Lead] Cidade inválida:", leadCity);
            return JSON.stringify({
              error: "Cidade inválida. Por favor, informe o nome completo da cidade."
            });
          }

          // Validar email se fornecido
          if (args.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(args.email)) {
              console.error("❌ [Lead] Email inválido:", args.email);
              return JSON.stringify({
                error: "Email inválido. Por favor, informe um email válido (ex: nome@exemplo.com)."
              });
            }
          }

          // Preparar dados mínimos do lead sem cobertura (já validados e normalizados)
          const leadData = {
            type: "PF", // Default PF para leads sem cobertura
            customerName: leadName,
            email: args.email || null,
            phone: leadPhone,
            city: leadCity,
            cep: args.cep || null,
            // Lead Management
            source: "chat",
            status: "Lead Sem Cobertura",
            conversationId,
            observations: `Lead interessado em ${leadCity}. Região sem cobertura TR Telecom. ${args.observacoes || ''}`
          };

          // Salvar no banco via storage
          const { storage: storageLead } = await import("../storage");
          const lead = await storageLead.addSale(leadData);

          console.log(`✅ [Lead] Lead sem cobertura registrado com sucesso - ID: ${lead.id}, Cidade: ${args.cidade}`);

          return JSON.stringify({
            success: true,
            lead_id: lead.id,
            mensagem: `Perfeito! Registrei seu interesse. Assim que a TR Telecom chegar em ${args.cidade}, entraremos em contato no telefone ${args.telefone}. Obrigado! 🎉`
          });
        } catch (error) {
          console.error("❌ [Lead] Erro ao registrar lead sem cobertura:", error);
          return JSON.stringify({
            error: "Erro ao registrar seu interesse. Tente novamente."
          });
        }

      case "registrar_lead_prospeccao":
        console.log("📊 [AI Tool] registrar_lead_prospeccao chamada - salvando lead com interesse inicial");
        try {
          // ============================================================================
          // VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS PARA PROSPECÇÃO
          // ============================================================================
          const requiredProspectFields = ['nome', 'telefone'];
          const missingProspectFields = requiredProspectFields.filter(field => !args[field]);
          
          if (missingProspectFields.length > 0) {
            console.error("❌ [Prospect] Campos obrigatórios faltando:", missingProspectFields);
            return JSON.stringify({
              error: `Dados incompletos. Para registrar o lead, preciso de: ${missingProspectFields.join(', ')}`,
              campos_faltantes: missingProspectFields
            });
          }

          // Validar e normalizar nome (mínimo 3 caracteres)
          const prospectName = args.nome.trim();
          if (prospectName.length < 3) {
            console.error("❌ [Prospect] Nome muito curto:", prospectName);
            return JSON.stringify({
              error: "Nome inválido. Por favor, informe o nome completo (mínimo 3 caracteres)."
            });
          }

          // Validar e normalizar telefone (apenas números, mínimo 10 dígitos)
          const prospectPhone = args.telefone.replace(/\D/g, '');
          if (prospectPhone.length < 10 || prospectPhone.length > 11) {
            console.error("❌ [Prospect] Telefone inválido:", args.telefone);
            return JSON.stringify({
              error: "Telefone inválido. Por favor, informe um telefone válido com DDD (ex: (24) 99999-9999)."
            });
          }

          // Validar email se fornecido
          if (args.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(args.email)) {
              console.error("❌ [Prospect] Email inválido:", args.email);
              return JSON.stringify({
                error: "Email inválido. Por favor, informe um email válido (ex: nome@exemplo.com)."
              });
            }
          }

          // Preparar dados do lead em prospecção
          const prospectData = {
            type: args.tipo_pessoa || "PF", // PF ou PJ
            customerName: prospectName,
            email: args.email || null,
            phone: prospectPhone,
            city: args.cidade || null,
            state: args.estado || null,
            planId: args.plano_id || null, // ID do plano de interesse
            // Lead Management
            source: "chat",
            status: "Prospecção", // Status específico para leads em prospecção
            conversationId,
            observations: args.observacoes || `Lead com interesse inicial. ${args.plano_interesse ? `Plano de interesse: ${args.plano_interesse}` : ''}`
          };

          // Salvar no banco via storage
          const { storage: storageProspect } = await import("../storage");
          const prospect = await storageProspect.addSale(prospectData);

          console.log(`✅ [Prospect] Lead em prospecção registrado com sucesso - ID: ${prospect.id}, Nome: ${args.nome}`);

          return JSON.stringify({
            success: true,
            lead_id: prospect.id,
            mensagem: `Lead registrado com sucesso! Vou anotar seu interesse. Nossa equipe pode entrar em contato para mais informações se necessário.`
          });
        } catch (error) {
          console.error("❌ [Prospect] Erro ao registrar lead em prospecção:", error);
          return JSON.stringify({
            error: "Erro ao registrar lead. Tente novamente."
          });
        }

      case "consultar_boleto_cliente":
        console.log(`🚨 [DEBUG] ENTRANDO NO CASE consultar_boleto_cliente - conversationId: ${conversationId || 'UNDEFINED'}`);
        if (!conversationId) {
          console.error("❌ [AI Tool] consulta_boleto_cliente chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível para consulta de boletos"
          });
        }
        
        const { consultaBoletoCliente } = await import("../ai-tools");
        const { storage } = await import("../storage");
        const { installationPointManager } = await import("./redis-config");
        
        try {
          console.log(`🔍 [AI Tool Handler] Iniciando consulta de boletos para conversação ${conversationId}`);
          
          // Buscar documento do cliente automaticamente da conversa
          const conversation = await storage.getConversation(conversationId);
          
          if (!conversation) {
            console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
            return JSON.stringify({
              error: "Conversa não encontrada"
            });
          }
          
          console.log(`🔍 [AI Tool Handler] Conversa encontrada. clientDocument: ${conversation.clientDocument ? 'SIM' : 'NÃO'}`);
          
          if (!conversation.clientDocument) {
            console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
            return JSON.stringify({
              error: "Para consultar seus boletos, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
            });
          }
          
          console.log(`🔍 [AI Tool Handler] Chamando consultaBoletoCliente com documento do banco...`);
          
          // Chamar diretamente a API real - pode retornar { boletos, hasMultiplePoints } OU { pontos, hasMultiplePoints }
          const resultadoBoletos = await consultaBoletoCliente(
            conversation.clientDocument,
            { conversationId },
            storage
          );
          
          // ====================================
          // TRATAMENTO DE MÚLTIPLOS PONTOS (NOVA ARQUITETURA EFÊMERA)
          // ====================================
          if (resultadoBoletos.hasMultiplePoints && resultadoBoletos.pontos) {
            const { pontos, totalBoletos } = resultadoBoletos;
            
            console.log(`🏠 [Boletos] Cliente possui ${pontos.length} pontos de instalação - apresentando menu`);
            
            // Formatar pontos para apresentação à IA
            const pontosFormatados = pontos.map(p => ({
              numero: p.numero,
              endereco: `${p.endereco}, ${p.bairro} - ${p.cidade}`,
              totalBoletos: p.totalBoletos,
              totalVencidos: p.totalVencidos,
              valorTotal: `R$ ${p.valorTotal.toFixed(2)}`
            }));
            
            // 🆕 NOVA ARQUITETURA: Salvar menu no Redis (efêmero - 5 minutos)
            // Gerar keywords para cada ponto (para matching textual)
            const menuItems = pontos.map(p => ({
              numero: parseInt(p.numero),
              endereco: p.endereco,
              bairro: p.bairro,
              cidade: p.cidade,
              totalBoletos: p.totalBoletos,
              totalVencidos: p.totalVencidos,
              valorTotal: p.valorTotal,
              valorMensalidade: p.valorMensalidade,
              keywords: [
                p.endereco.toLowerCase(),
                p.bairro.toLowerCase(),
                p.cidade.toLowerCase(),
                p.numero
              ]
            }));
            
            await installationPointManager.saveMenu({
              conversationId,
              cpf: conversation.clientDocument,
              pontos: menuItems,
              createdAt: Date.now()
            });
            
            console.log(`💾 [Boletos] Menu salvo no Redis - aguardando seleção do cliente (TTL: 5min)`);
            
            // Construir menu formatado para a IA apresentar ao cliente
            let menuFormatado = `📍 *Encontrei ${pontos.length} endereços cadastrados no seu CPF:*\n\n`;
            
            pontos.forEach((ponto, index) => {
              const numero = index + 1;
              menuFormatado += `${numero}️⃣ *${ponto.endereco}*\n`;
              menuFormatado += `   📌 ${ponto.bairro} - ${ponto.cidade}\n`;
              menuFormatado += `   📦 Mensalidade: R$ ${ponto.valorMensalidade.toFixed(2)}\n`;
              if (ponto.totalVencidos > 0) {
                menuFormatado += `   ⚠️ ${ponto.totalVencidos} boleto(s) vencido(s)\n`;
                menuFormatado += `   💰 Total vencido: R$ ${ponto.valorVencido.toFixed(2)}\n`;
              } else {
                menuFormatado += `   ✅ Em dia\n`;
              }
              menuFormatado += `\n`;
            });
            
            menuFormatado += `*Qual endereço você deseja consultar?*\nResponda com o *número* (1, 2, 3...) ou o *nome do bairro/rua*.`;
            
            return JSON.stringify({
              status: "MULTIPLOS_PONTOS_DETECTADOS",
              mensagem: menuFormatado,
              totalBoletos,
              pontos: pontosFormatados,
              instrucao_ia: "IMPORTANTE: Copie EXATAMENTE a mensagem acima e envie ao cliente. NÃO altere a formatação. Aguarde a resposta do cliente (número ou nome). O sistema processará automaticamente a escolha dele."
            });
          }
          
          // ====================================
          // PONTO ÚNICO (FLUXO NORMAL)
          // ====================================
          const { boletos } = resultadoBoletos;
          
          console.log(`✅ [AI Tool Handler] Boletos consultados com sucesso: ${boletos?.length || 0} boleto(s) EM ABERTO`);
          
          // Formatar resposta com mensagem clara para a IA
          if (!boletos || boletos.length === 0) {
            return JSON.stringify({
              status: "EM_DIA",
              mensagem: "Cliente está EM DIA - sem boletos pendentes, vencidos ou em aberto.",
              boletos: []
            });
          }
          
          // Mapear boletos para incluir link na descrição formatada
          const boletosFormatados = boletos.map(boleto => ({
            vencimento: boleto.DATA_VENCIMENTO,
            valor: boleto.VALOR_TOTAL,
            codigo_barras: boleto.CODIGO_BARRA_TRANSACAO,
            codigo_barras_sem_espacos: boleto.CODIGO_BARRA_TRANSACAO.replace(/\D/g, ''),
            link_pagamento: boleto.link_carne_completo,
            pix: boleto.PIX_TXT,
            status: boleto.STATUS
          }));
          
          return JSON.stringify({
            status: "success",
            boletos: boletosFormatados
          });
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao consultar boletos:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
            console.error("❌ [AI Tool Handler] Tipo de erro:", error.constructor.name);
          }
          
          // IMPORTANTE: Retornar erro ESTRUTURADO para que a IA NUNCA use dados mockados
          return JSON.stringify({
            status: "ERRO_API",
            error: error instanceof Error ? error.message : "Erro ao consultar boletos",
            instrucao_ia: "ATENÇÃO: A consulta de boletos FALHOU. NÃO invente dados. NÃO use exemplos. Informe ao cliente que houve um problema técnico temporário e peça para tentar novamente em alguns minutos ou ofereça transferir para atendimento humano."
          });
        }

      case "solicitarDesbloqueio":
        if (!conversationId) {
          console.error("❌ [AI Tool] solicitarDesbloqueio chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { solicitarDesbloqueio } = await import("../ai-tools");
        const { storage: storageDesbloqueio } = await import("../storage");
        
        try {
          console.log(`🔓 [AI Tool Handler] Iniciando solicitação de desbloqueio para conversação ${conversationId}`);
          
          // Buscar documento do cliente automaticamente da conversa
          const conversationDesbloqueio = await storageDesbloqueio.getConversation(conversationId);
          
          if (!conversationDesbloqueio) {
            console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
            return JSON.stringify({
              error: "Conversa não encontrada"
            });
          }
          
          console.log(`🔓 [AI Tool Handler] Conversa encontrada. clientDocument: ${conversationDesbloqueio.clientDocument ? 'SIM' : 'NÃO'}`);
          
          if (!conversationDesbloqueio.clientDocument) {
            console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
            return JSON.stringify({
              error: "Para solicitar desbloqueio, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
            });
          }
          
          console.log(`🔓 [AI Tool Handler] Chamando solicitarDesbloqueio com documento do banco...`);
          
          // Chamar diretamente a API real de desbloqueio
          const resultado = await solicitarDesbloqueio(
            conversationDesbloqueio.clientDocument,
            { conversationId },
            storageDesbloqueio
          );
          
          console.log(`✅ [AI Tool Handler] Desbloqueio solicitado com sucesso:`, resultado);
          
          // Extrair mensagem de resposta da API
          const obs = resultado.data?.[0]?.resposta?.[0]?.obs || "";
          const status = resultado.data?.[0]?.status?.[0]?.status || "";
          
          return JSON.stringify({
            success: true,
            mensagem: obs || "Desbloqueio solicitado com sucesso",
            status: status,
            detalhes: resultado
          });
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao solicitar desbloqueio:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
          }
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao solicitar desbloqueio"
          });
        }

      case "abrir_ticket_crm":
        if (!conversationId) {
          console.error("❌ [AI Tool] abrir_ticket_crm chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { abrirTicketCRM } = await import("../ai-tools");
        const { storage: storageTicket } = await import("../storage");
        
        try {
          console.log(`🎫 [AI Tool Handler] Iniciando abertura de ticket para conversação ${conversationId}`);
          
          // Validação de argumentos obrigatórios
          const resumoTicket = args.resumo || args.summary;
          const setorTicket = args.setor || args.department;
          const motivoTicket = args.motivo || args.reason;
          
          if (!resumoTicket || !setorTicket || !motivoTicket) {
            console.error("❌ [AI Tool] Argumentos obrigatórios faltando:", { resumo: !!resumoTicket, setor: !!setorTicket, motivo: !!motivoTicket });
            return JSON.stringify({
              error: "Parâmetros obrigatórios faltando. É necessário: resumo, setor e motivo."
            });
          }
          
          // Buscar conversa no banco
          const conversationTicket = await storageTicket.getConversation(conversationId);
          
          if (!conversationTicket) {
            console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
            return JSON.stringify({
              error: "Conversa não encontrada"
            });
          }
          
          console.log(`🎫 [AI Tool Handler] Conversa encontrada. clientDocument: ${conversationTicket.clientDocument ? 'SIM' : 'NÃO'}`);
          
          if (!conversationTicket.clientDocument) {
            console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
            return JSON.stringify({
              error: "Para abrir um ticket, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
            });
          }
          
          // Recuperar imageUrl do metadata (se disponível E recente)
          const metadata = conversationTicket?.metadata as any;
          let imageUrl = metadata?.lastImageUrl;
          
          // VALIDAÇÃO DE FRESHNESS: só usar link se foi processado recentemente (últimos 5 minutos)
          if (imageUrl) {
            // CRÍTICO: Ignorar metadata legado sem timestamp (conversas antigas)
            if (!metadata?.lastImageProcessedAt) {
              console.log(`⚠️ [AI Tool Security] imageUrl ignorado - metadata legado sem timestamp`);
              imageUrl = null; // Ignorar e limpar metadata legado
              
              // Limpar metadata legado
              await storageTicket.updateConversation(conversationId, {
                metadata: {
                  ...metadata,
                  lastImageUrl: null,
                  lastImageProcessedAt: null
                }
              });
            } else {
              // Verificar se foi processado recentemente
              const processedAt = new Date(metadata.lastImageProcessedAt);
              const now = new Date();
              const minutesAgo = (now.getTime() - processedAt.getTime()) / (1000 * 60);
              
              if (minutesAgo > 5) {
                console.log(`⚠️ [AI Tool Security] imageUrl ignorado - processado há ${minutesAgo.toFixed(1)} minutos (limite: 5 min)`);
                imageUrl = null; // Ignorar link antigo
              } else {
                console.log(`✅ [AI Tool Security] imageUrl validado - processado há ${minutesAgo.toFixed(1)} minutos`);
              }
            }
          }
          
          console.log(`🎫 [AI Tool Handler] Chamando abrirTicketCRM...`, { setor: setorTicket, motivo: motivoTicket, comprovanteUrl: imageUrl ? 'SIM' : 'NÃO' });
          
          // Chamar função de abertura de ticket COM link do comprovante
          const resultado = await abrirTicketCRM(
            resumoTicket,
            setorTicket,
            motivoTicket,
            { conversationId },
            storageTicket,
            imageUrl  // ← AGORA PASSA O LINK DO COMPROVANTE!
          );
          
          // Extrair protocolo da resposta
          const protocolo = resultado?.data?.[0]?.resposta?.[0]?.protocolo || 'ERRO_SEM_PROTOCOLO';
          
          console.log(`✅ [AI Tool Handler] Ticket aberto com sucesso - Protocolo: ${protocolo}`);
          
          return JSON.stringify({
            success: true,
            protocolo: protocolo,
            setor: setorTicket.toUpperCase(),
            motivo: motivoTicket.toUpperCase(),
            mensagem: `Ticket aberto com sucesso! Protocolo: ${protocolo}. O setor ${setorTicket.toUpperCase()} irá processar seu atendimento.`,
            detalhes: resultado
          });
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao abrir ticket:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
          }
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao abrir ticket no CRM",
            instrucao_ia: "Não foi possível abrir o ticket automaticamente. Por favor, informe ao cliente que houve um problema técnico e transfira para atendimento humano."
          });
        }

      case "priorizar_atendimento_tecnico":
        if (!conversationId) {
          console.error("❌ [AI Tool] priorizar_atendimento_tecnico chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { storage: storagePrioridade } = await import("../storage");
        const { checkRecurrence } = await import("./conversation-intelligence");
        
        try {
          const conversationPrioridade = await storagePrioridade.getConversation(conversationId);
          
          if (!conversationPrioridade) {
            return JSON.stringify({ error: "Conversa não encontrada" });
          }
          
          const motivoPrioridade = args.motivo || "Problema recorrente detectado";
          const tipoProblema = args.tipo_problema || "tecnico";
          
          // Verificar recorrência se houver CPF
          let recorrencia = null;
          if (conversationPrioridade.clientDocument) {
            recorrencia = await checkRecurrence(
              conversationPrioridade.clientDocument,
              tipoProblema,
              30
            );
          }
          
          // Criar protocolo de atendimento prioritário
          const protocolo = `PRIOR-${Date.now().toString().slice(-6)}`;
          
          // Atualizar metadata da conversa
          const metadata = (conversationPrioridade.metadata as any) || {};
          await storagePrioridade.updateConversation(conversationId, {
            urgency: "critical",
            metadata: {
              ...metadata,
              atendimentoPrioritario: {
                ativado: true,
                protocolo,
                motivo: motivoPrioridade,
                tipoProblema,
                recorrencia: recorrencia?.isRecurrent ? {
                  ocorrencias: recorrencia.previousOccurrences,
                  ultimaOcorrencia: recorrencia.lastOccurrence
                } : null,
                criadoEm: new Date().toISOString()
              }
            }
          });
          
          console.log(`🚨 [Prioridade] Atendimento técnico priorizado:`, {
            conversationId,
            protocolo,
            motivo: motivoPrioridade,
            recorrente: recorrencia?.isRecurrent
          });
          
          return JSON.stringify({
            success: true,
            protocolo,
            prazo: "URGENTE - Atendimento em até 4 horas",
            motivo: motivoPrioridade,
            recorrencia: recorrencia?.isRecurrent ? {
              ocorrencias: recorrencia.previousOccurrences,
              mensagem: `Detectamos ${recorrencia.previousOccurrences} ocorrência(s) similar(es) nos últimos 30 dias`
            } : null,
            mensagem: recorrencia?.isRecurrent 
              ? `Seu atendimento foi PRIORIZADO devido à recorrência do problema (${recorrencia.previousOccurrences}x nos últimos 30 dias). Protocolo: ${protocolo}. Nossa equipe técnica entrará em contato em até 4 horas para resolver definitivamente.`
              : `Seu atendimento foi PRIORIZADO. Protocolo: ${protocolo}. Nossa equipe técnica entrará em contato em até 4 horas.`
          });
        } catch (error) {
          console.error("❌ [Prioridade] Erro ao priorizar atendimento:", error);
          return JSON.stringify({
            error: "Não foi possível priorizar o atendimento. Tente novamente."
          });
        }

      case "selecionar_ponto_instalacao":
        if (!conversationId) {
          console.error("❌ [AI Tool] selecionar_ponto_instalacao chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { selecionarPontoInstalacao } = await import("../ai-tools");
        const { storage: storageSelecao } = await import("../storage");
        
        try {
          console.log(`🔀 [AI Tool Handler] Selecionando ponto de instalação para conversação ${conversationId}`);
          
          const result = await selecionarPontoInstalacao(
            args.numeroPonto,
            { conversationId },
            storageSelecao
          );
          
          return JSON.stringify(result);
        } catch (error) {
          console.error("❌ [Seleção] Erro ao selecionar ponto de instalação:", error);
          return JSON.stringify({
            error: "Não foi possível selecionar o ponto de instalação. Tente novamente."
          });
        }

      default:
        console.error(`❌ [AI Tool] CAIU NO DEFAULT - Função não implementada: "${functionName}"`);
        console.error(`❌ [AI Tool] Funções disponíveis: verificar_conexao, consultar_fatura, consultar_base_de_conhecimento, consultar_boleto_cliente, etc.`);
        return JSON.stringify({
          error: `Função ${functionName} não implementada`,
        });
    }
  } catch (error) {
    console.error(`Tool call error for ${functionName}:`, error);
    return JSON.stringify({
      error: `Erro ao executar ${functionName}`,
    });
  }
}

// Update assistant prompt/instructions
export async function updateAssistantPrompt(assistantType: string, newInstructions: string): Promise<void> {
  try {
    const assistantId = ASSISTANT_IDS[assistantType as keyof typeof ASSISTANT_IDS];
    
    if (!assistantId) {
      throw new Error(`Assistant type ${assistantType} not found`);
    }

    await openaiCircuitBreaker.execute(() =>
      openai.beta.assistants.update(assistantId, {
        instructions: newInstructions,
      })
    );

    // Invalidate cache immediately after update to ensure fresh instructions
    await assistantCache.invalidateByTag(`assistant:${assistantType}`);
    console.log(`✅ [OpenAI] Updated instructions for ${assistantType} (${assistantId}) and invalidated cache`);
  } catch (error) {
    console.error(`❌ [OpenAI] Error updating ${assistantType}:`, error);
    throw error;
  }
}

// Process training content and generate improved prompts using GPT-4
export async function processTrainingContent(
  assistantType: string, 
  trainingContent: string
): Promise<string> {
  try {
    console.log(`🎓 [Training] Processing training for ${assistantType}...`);
    
    // Get current assistant instructions
    const currentInstructions = await getAssistantInstructions(assistantType);
    
    const trainingPrompt = `Você é um especialista em otimização de prompts para assistentes de IA.

TAREFA:
Analise o conteúdo de treinamento fornecido e as instruções atuais do assistente, e gere uma versão melhorada das instruções que incorpore os aprendizados do treinamento.

ASSISTENTE ATUAL: ${assistantType}

INSTRUÇÕES ATUAIS:
${currentInstructions}

CONTEÚDO DO TREINAMENTO (exemplos de conversas, correções, procedimentos):
${trainingContent}

INSTRUÇÕES PARA MELHORIA:
1. Identifique padrões e procedimentos corretos demonstrados no treinamento
2. Identifique erros ou problemas que foram corrigidos
3. Mantenha a estrutura e tom das instruções originais
4. Adicione ou modifique seções específicas para incorporar os aprendizados
5. Seja específico e prático nas melhorias
6. NÃO remova funcionalidades ou ferramentas existentes
7. Mantenha o formato markdown e a organização das instruções

RESPONDA APENAS COM O TEXTO COMPLETO DAS INSTRUÇÕES MELHORADAS (sem explicações adicionais).`;

    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: trainingPrompt }],
        // GPT-5 only supports default temperature (1), custom values not allowed
      })
    );

    const improvedInstructions = response.choices[0].message.content?.trim() || currentInstructions;
    
    console.log(`✅ [Training] Generated improved instructions for ${assistantType} (${improvedInstructions.length} chars)`);
    
    return improvedInstructions;
  } catch (error) {
    console.error(`❌ [Training] Error processing training for ${assistantType}:`, error);
    throw error;
  }
}

// Get current assistant instructions
export async function getAssistantInstructions(assistantType: string): Promise<string> {
  try {
    // Check cache first (assistants don't change frequently)
    const cacheKey = `instructions:${assistantType}`;
    const cached = await assistantCache.get<string>(cacheKey);
    if (cached) {
      console.log(`💾 [Cache] Assistant instructions HIT for ${assistantType}`);
      return cached;
    }
    
    const assistantId = ASSISTANT_IDS[assistantType as keyof typeof ASSISTANT_IDS];
    
    if (!assistantId) {
      throw new Error(`Assistant type ${assistantType} not found`);
    }

    const assistant = await openaiCircuitBreaker.execute(() =>
      openai.beta.assistants.retrieve(assistantId)
    );
    
    const instructions = assistant.instructions || "";
    
    // Cache instructions for 24 hours (they rarely change)
    await assistantCache.set(cacheKey, instructions, { 
      ttl: 86400, // 24 hours
      tags: ['assistant-config', `assistant:${assistantType}`] 
    });
    
    console.log(`💾 [Cache] Assistant instructions MISS for ${assistantType} - cached for 24h`);
    return instructions;
  } catch (error) {
    console.error(`❌ [OpenAI] Error getting instructions for ${assistantType}:`, error);
    throw error;
  }
}

// Configurações de contexto e resumo
export const CONTEXT_CONFIG = {
  SUMMARIZE_EVERY: parseInt(process.env.SUMMARIZE_EVERY || "12"), // Resumir a cada X mensagens
  KEEP_RECENT: parseInt(process.env.KEEP_RECENT_MESSAGES || "5"), // Manter últimas X mensagens intactas
  CONTEXT_WINDOW: parseInt(process.env.CONTEXT_WINDOW || "7"), // Janela de contexto para roteamento
};

// Estrutura do resumo
interface ConversationSummary {
  summary: string;
  keyFacts: {
    currentPlan?: string;
    requestedPlan?: string;
    technicalIssue?: string;
    cpf?: string;
    [key: string]: any;
  };
  sentiment: string;
  assistantHistory: string[];
  actionsTaken: string[];
  pendingActions: string[];
  importantDates?: string[];
}

// Gerar resumo estruturado da conversa
export async function summarizeConversation(messages: Array<{ role: string; content: string }>): Promise<string> {
  try {
    const prompt = `Você é um assistente especializado em resumir conversas de atendimento ao cliente.

Analise as mensagens abaixo e crie um resumo estruturado em JSON com:
- summary: Resumo conciso da conversa (2-3 frases)
- keyFacts: Informações importantes extraídas (plano atual, CPF, problema técnico, etc)
- sentiment: Sentimento do cliente (satisfeito/neutro/frustrado/irritado)
- assistantHistory: Lista de assistentes que atenderam (ex: ["comercial", "suporte"])
- actionsTaken: Ações já realizadas
- pendingActions: Ações pendentes/próximos passos
- importantDates: Datas mencionadas (se houver)

IMPORTANTE:
- Seja objetivo e preserve TODAS as informações críticas (CPF, números de protocolo, valores, etc)
- Ignore saudações e confirmações genéricas
- Foque no contexto necessário para continuidade do atendimento

Mensagens:
${messages.map((m, i) => `${i + 1}. [${m.role}]: ${m.content}`).join('\n')}

Responda APENAS com o JSON estruturado, sem explicações adicionais.`;

    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      })
    );

    const summary = response.choices[0].message.content?.trim() || "{}";
    
    // Validar que é JSON válido
    JSON.parse(summary);
    
    console.log("📝 [Summarization] Summary generated successfully");
    return summary;
  } catch (error) {
    console.error("❌ [Summarization] Error:", error);
    // Retornar resumo básico em caso de erro
    return JSON.stringify({
      summary: "Erro ao gerar resumo. Contexto parcialmente preservado.",
      keyFacts: {},
      sentiment: "unknown",
      assistantHistory: [],
      actionsTaken: [],
      pendingActions: []
    });
  }
}

// Roteamento com contexto (nova versão)
export async function routeMessageWithContext(
  currentMessage: string, 
  conversationHistory: Array<{ role: string; content: string }> = [],
  conversationSummary?: string
): Promise<RouterResult> {
  try {
    // Pegar últimas N mensagens para contexto
    const recentMessages = conversationHistory.slice(-CONTEXT_CONFIG.CONTEXT_WINDOW);
    
    // Construir contexto
    let contextText = "";
    if (conversationSummary) {
      const summary = JSON.parse(conversationSummary) as ConversationSummary;
      contextText = `RESUMO DA CONVERSA ANTERIOR:\n${summary.summary}\n`;
      if (summary.assistantHistory.length > 0) {
        contextText += `Assistentes anteriores: ${summary.assistantHistory.join(" → ")}\n`;
      }
      if (summary.pendingActions.length > 0) {
        contextText += `Ações pendentes: ${summary.pendingActions.join(", ")}\n`;
      }
      contextText += "\n";
    }
    
    if (recentMessages.length > 0) {
      contextText += `ÚLTIMAS ${recentMessages.length} MENSAGENS:\n`;
      contextText += recentMessages.map(m => `[${m.role}]: ${m.content}`).join('\n');
      contextText += "\n\n";
    }

    const routingPrompt = `Você é o supervisor de roteamento da TR Telecom. Analise a mensagem atual do cliente considerando o contexto da conversa.

${contextText}MENSAGEM ATUAL DO CLIENTE: "${currentMessage}"

Assistentes disponíveis:
- suporte: Problemas técnicos, conexão, velocidade, equipamentos, desbloqueio
- comercial: Vendas, planos, upgrade, contratação
- financeiro: Faturas, pagamentos, cobranças, dúvidas financeiras
- apresentacao: Apresentação da empresa, novos clientes
- ouvidoria: Reclamações formais, SAC
- cancelamento: Cancelamento de serviço

REGRAS IMPORTANTES:
1. PRIORIZE a mensagem atual - ela tem precedência sobre o histórico
2. Se a mensagem atual contiver palavras de suporte técnico/desbloqueio (desbloqueio, desbloquear, liberar conexão, reduzir conexão), retorne SUPORTE imediatamente
3. Se a mensagem for apenas um número, use o contexto para determinar:
   - Se contexto indica CPF solicitado → tipo apropriado baseado no fluxo
   - Se for número isolado sem contexto → suporte (fallback seguro)
4. Detecte mudanças de assunto - cliente pode mudar de demanda durante conversa
5. Considere o sentimento - frustração recorrente pode indicar necessidade de escalação

Responda APENAS com JSON válido:
{
  "recommendedAssistantType": "<tipo>",
  "confidence": <0.0-1.0>,
  "reason": "<1-2 frases explicando a decisão>"
}`;

    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: routingPrompt }],
        response_format: { type: "json_object" },
      })
    );

    const result = JSON.parse(response.choices[0].message.content?.trim() || "{}");
    const assistantType = result.recommendedAssistantType?.toLowerCase() || "suporte";
    const validTypes = ["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento"];
    const finalType = validTypes.includes(assistantType) ? assistantType : "suporte";
    
    const assistantId = ASSISTANT_IDS[finalType as keyof typeof ASSISTANT_IDS] || ASSISTANT_IDS.suporte;
    
    console.log(`🎯 [Routing with Context] ${currentMessage.substring(0, 50)}... → ${finalType} (confidence: ${result.confidence}, reason: ${result.reason})`);
    
    return {
      assistantType: finalType,
      assistantId: assistantId,
      confidence: result.confidence || 0.85,
    };
  } catch (error) {
    console.error("❌ [Routing with Context] Error:", error);
    // Fallback para roteamento simples
    return routeMessage(currentMessage);
  }
}

/**
 * AI Prompt Analysis Service
 * Uses GPT-4 to analyze assistant prompts and provide improvement suggestions
 */

// Zod schema for AI analysis validation
const promptAnalysisRecommendationSchema = z.object({
  category: z.enum(['clarity', 'structure', 'tone', 'instructions', 'edge_cases', 'extreme_cases', 'compliance']),
  priority: z.enum(['high', 'medium', 'low']),
  suggestion: z.string(),
  example: z.string().optional(),
});

const promptAnalysisOptimizationSchema = z.object({
  title: z.string(),
  before: z.string(),
  after: z.string(),
  rationale: z.string(),
});

const promptAnalysisResultSchema = z.object({
  analysis: z.string(),
  score: z.number().min(0).max(100),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recommendations: z.array(promptAnalysisRecommendationSchema).default([]),
  optimizations: z.array(promptAnalysisOptimizationSchema).default([]),
  estimatedTokenCount: z.number().default(0),
});

export interface PromptAnalysisResult {
  analysis: string;
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendations: Array<{
    category: 'clarity' | 'structure' | 'tone' | 'instructions' | 'edge_cases' | 'extreme_cases' | 'compliance';
    priority: 'high' | 'medium' | 'low';
    suggestion: string;
    example?: string;
  }>;
  optimizations: Array<{
    title: string;
    before: string;
    after: string;
    rationale: string;
  }>;
  estimatedTokenCount: number;
}

export async function analyzePrompt(
  currentPrompt: string,
  draftPrompt: string,
  assistantType: string,
  userContext?: string
): Promise<PromptAnalysisResult> {
  try {
    const analysisPrompt = `Você é um especialista em engenharia de prompts para assistentes de IA em atendimento ao cliente de telecomunicações.

**CONTEXTO:**
- Tipo de assistente: ${assistantType.toUpperCase()}
- Setor: Telecomunicações (TR Telecom)
- Cliente: Atendimento via WhatsApp com IA
${userContext ? `- Contexto adicional do usuário: ${userContext}` : ''}

**PROMPT ATUAL (PRODUÇÃO):**
${currentPrompt}

**NOVO PROMPT (RASCUNHO):**
${draftPrompt}

**SUA TAREFA:**
Analise o novo prompt (rascunho) comparando com o atual e forneça uma análise detalhada considerando:

1. **CLAREZA**: O prompt é claro e específico sobre o papel do assistente?
2. **ESTRUTURA**: O prompt está bem organizado e fácil de seguir?
3. **TOM**: O tom é apropriado para atendimento ao cliente brasileiro?
4. **INSTRUÇÕES**: As instruções são completas e acionáveis?
5. **CASOS EXTREMOS**: O prompt lida com situações difíceis (clientes irritados, perguntas fora do escopo)?
6. **COMPLIANCE**: O prompt respeita LGPD e boas práticas de atendimento?

**IMPORTANTE - CAMPO "optimizations" (OBRIGATÓRIO: 3-5 OTIMIZAÇÕES):**
O campo "optimizations" contém substituições LITERAIS de texto. Este campo será usado para aplicar as otimizações automaticamente ao prompt.

**VOCÊ DEVE GERAR ENTRE 3 A 5 OTIMIZAÇÕES.** Mesmo que o prompt esteja bom, encontre oportunidades de melhoria em:
- Clareza e concisão (reduzir redundâncias)
- Exemplos mais específicos
- Instruções mais acionáveis
- Casos extremos não cobertos
- Tom e empatia
- Estrutura e organização

Para cada otimização:
- "before": COPIE LITERALMENTE um trecho do PROMPT RASCUNHO que precisa ser melhorado (entre 10-200 palavras)
- "after": ESCREVA LITERALMENTE o texto COMPLETO que vai SUBSTITUIR o "before" (não escreva uma descrição, escreva o texto final)
- NÃO use descrições genéricas como "Consolidar as instruções..." - use o TEXTO REAL
- O "before" deve existir EXATAMENTE no prompt rascunho (incluindo pontuação e formatação)

**EXEMPLO CORRETO:**
{
  "title": "Melhorar instruções de saudação",
  "before": "Você deve cumprimentar o cliente de forma educada.",
  "after": "Inicie sempre com uma saudação calorosa e personalizada. Exemplos: 'Olá! Como posso ajudar você hoje?' ou 'Bom dia! É um prazer atendê-lo(a).'",
  "rationale": "Saudações específicas e exemplos tornam o atendimento mais humano e consistente."
}

**EXEMPLO INCORRETO (NÃO FAÇA ASSIM):**
{
  "title": "Melhorar instruções de saudação",
  "before": "O texto atual é muito vago sobre saudações",
  "after": "Adicionar exemplos de saudações personalizadas",
  "rationale": "..."
}

**FORMATO DE RESPOSTA (JSON):**
{
  "analysis": "Análise geral do prompt em 2-3 parágrafos",
  "score": 85,
  "strengths": ["Ponto forte 1", "Ponto forte 2", "Ponto forte 3"],
  "weaknesses": ["Ponto fraco 1", "Ponto fraco 2"],
  "recommendations": [
    {
      "category": "clarity",
      "priority": "high",
      "suggestion": "Descrição da sugestão",
      "example": "Exemplo opcional de implementação"
    }
  ],
  "optimizations": [
    {
      "title": "Título da otimização 1",
      "before": "COPIE AQUI O TEXTO LITERAL EXATO DO PROMPT RASCUNHO QUE DEVE SER SUBSTITUÍDO (mínimo 10 palavras, máximo 200 palavras)",
      "after": "ESCREVA AQUI O TEXTO LITERAL COMPLETO QUE VAI SUBSTITUIR O 'before' (deve ser o texto final, não uma descrição)",
      "rationale": "Por que essa mudança melhora o prompt"
    },
    {
      "title": "Título da otimização 2",
      "before": "OUTRO TRECHO LITERAL DO PROMPT RASCUNHO",
      "after": "TEXTO COMPLETO DE SUBSTITUIÇÃO",
      "rationale": "Justificativa"
    },
    {
      "title": "Título da otimização 3",
      "before": "MAIS UM TRECHO LITERAL DO PROMPT RASCUNHO",
      "after": "TEXTO COMPLETO DE SUBSTITUIÇÃO",
      "rationale": "Justificativa"
    }
  ],
  "estimatedTokenCount": 1500
}

Forneça uma análise honesta, construtiva e acionável. Se o prompt já está excelente, diga isso!

**LEMBRE-SE: VOCÊ DEVE GERAR NO MÍNIMO 3 OTIMIZAÇÕES, IDEALMENTE 5. Não gere apenas 1 ou 2.**`;

    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: analysisPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      })
    );

    const rawResult = JSON.parse(response.choices[0].message.content?.trim() || "{}");
    
    // Track token usage
    if (response.usage) {
      await trackTokenUsage(
        "gpt-4o",
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0
      );
    }

    // Validate and sanitize result with Zod
    const validatedResult = promptAnalysisResultSchema.parse(rawResult);

    console.log(`✅ [Prompt Analysis] Completed for ${assistantType} (score: ${validatedResult.score}/100)`);
    
    return validatedResult;
  } catch (error) {
    console.error("❌ [Prompt Analysis] Error:", error);
    throw new Error("Erro ao analisar prompt com IA");
  }
}

/**
 * Evolution Suggestions Consolidation Service
 * Consolidates multiple evolution suggestions into a single updated prompt
 */

// Zod schema for applied suggestion
const appliedSuggestionSchema = z.object({
  suggestionId: z.string(),
  category: z.enum(['tone', 'instructions', 'edge_cases', 'scripts', 'compliance', 'structure']),
  applied: z.boolean(),
  howApplied: z.string(),
});

// Zod schema for consolidation result
const consolidationResultSchema = z.object({
  updatedPrompt: z.string(),
  summary: z.object({
    totalSuggestions: z.number(),
    appliedCount: z.number(),
    duplicatesCount: z.number(),
    conflictsCount: z.number(),
  }),
  appliedSuggestions: z.array(appliedSuggestionSchema),
  duplicateGroups: z.array(z.object({
    mainSuggestionId: z.string(),
    duplicateIds: z.array(z.string()),
    reason: z.string(),
  })).default([]),
  notApplied: z.array(z.object({
    suggestionId: z.string(),
    reason: z.string(),
  })).default([]),
  changes: z.array(z.object({
    category: z.string(),
    count: z.number(),
    description: z.string(),
  })).default([]),
});

export interface ConsolidationResult {
  updatedPrompt: string;
  summary: {
    totalSuggestions: number;
    appliedCount: number;
    duplicatesCount: number;
    conflictsCount: number;
  };
  appliedSuggestions: Array<{
    suggestionId: string;
    category: 'tone' | 'instructions' | 'edge_cases' | 'scripts' | 'compliance' | 'structure';
    applied: boolean;
    howApplied: string;
  }>;
  duplicateGroups: Array<{
    mainSuggestionId: string;
    duplicateIds: string[];
    reason: string;
  }>;
  notApplied: Array<{
    suggestionId: string;
    reason: string;
  }>;
  changes: Array<{
    category: string;
    count: number;
    description: string;
  }>;
}

export interface EvolutionSuggestion {
  id: string;
  problemIdentified: string;
  rootCauseAnalysis: string;
  currentPrompt: string;
  suggestedPrompt: string;
  confidenceScore: number;
}

export async function consolidateEvolutionSuggestions(
  currentPrompt: string,
  suggestions: EvolutionSuggestion[],
  assistantType: string
): Promise<ConsolidationResult> {
  try {
    console.log(`🔄 [Consolidation] Starting for ${assistantType} with ${suggestions.length} suggestions`);

    const suggestionsContext = suggestions.map((s, i) => `
SUGESTÃO ${i + 1} (ID: ${s.id}):
- Problema: ${s.problemIdentified}
- Análise: ${s.rootCauseAnalysis}
- Confiança: ${s.confidenceScore}%
- Mudança sugerida:
  ANTES: ${s.currentPrompt}
  DEPOIS: ${s.suggestedPrompt}
`).join('\n---\n');

    const consolidationPrompt = `Você é um especialista em consolidar feedback e melhorar prompts de assistentes de IA.

**CONTEXTO:**
- Assistente: ${assistantType.toUpperCase()}
- Setor: Telecomunicações (TR Telecom)
- Prompt atual em produção: VER ABAIXO

**PROMPT ATUAL (PRODUÇÃO):**
${currentPrompt}

**SUGESTÕES DE EVOLUÇÃO (${suggestions.length} no total):**
${suggestionsContext}

**SUA TAREFA:**
1. Analise TODAS as ${suggestions.length} sugestões
2. Identifique sugestões **DUPLICADAS** ou muito similares (agrupe-as)
3. Identifique sugestões **CONFLITANTES** (que não podem ser aplicadas juntas)
4. Categorize cada sugestão por tema:
   - tone: Mudanças no tom de voz
   - instructions: Novas instruções ou procedimentos
   - edge_cases: Tratamento de casos extremos
   - scripts: Novos scripts de resposta
   - compliance: Adequação a LGPD ou políticas
   - structure: Organização do prompt

5. Gere um **PROMPT ATUALIZADO** que incorpore as sugestões válidas e não-duplicadas
   - Mantenha a estrutura original sempre que possível
   - Aplique as mudanças de forma coesa e harmoniosa
   - Se uma sugestão conflita com políticas da empresa ou outras sugestões, NÃO aplique

6. Para cada sugestão, indique:
   - Se foi aplicada (true/false)
   - Como foi aplicada (descreva a mudança feita)
   - Se é duplicada de outra
   - Se não foi aplicada, por qual motivo

**FORMATO DE RESPOSTA (JSON ESTRITO):**
{
  "updatedPrompt": "Prompt completo atualizado aqui...",
  "summary": {
    "totalSuggestions": ${suggestions.length},
    "appliedCount": 10,
    "duplicatesCount": 3,
    "conflictsCount": 2
  },
  "appliedSuggestions": [
    {
      "suggestionId": "abc-123",
      "category": "tone",
      "applied": true,
      "howApplied": "Adicionada instrução para tom mais empático em casos de reclamação na seção de Ouvidoria"
    }
  ],
  "duplicateGroups": [
    {
      "mainSuggestionId": "abc-123",
      "duplicateIds": ["def-456", "ghi-789"],
      "reason": "Todas sugerem adicionar tratamento de tom empático - consolidadas na sugestão principal"
    }
  ],
  "notApplied": [
    {
      "suggestionId": "xyz-999",
      "reason": "Conflita com política da empresa de não prometer prazos específicos"
    }
  ],
  "changes": [
    {
      "category": "Tone",
      "count": 4,
      "description": "Tom mais empático em situações de frustração do cliente"
    },
    {
      "category": "Scripts",
      "count": 3,
      "description": "Novos scripts para tratamento de inadimplência"
    }
  ]
}

**IMPORTANTE:**
- Seja conservador: não faça mudanças drásticas sem justificativa clara
- Se uma sugestão é vaga ou de baixa confiança (<70%), considere não aplicar
- Mantenha o tom profissional e alinhado com a marca TR Telecom
- Sempre retorne JSON válido e completo`;

    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: consolidationPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3, // Lower temperature for more conservative/consistent consolidation
      })
    );

    const rawResult = JSON.parse(response.choices[0].message.content?.trim() || "{}");

    // Track token usage
    if (response.usage) {
      await trackTokenUsage(
        "gpt-4o",
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0
      );
    }

    // Validate and sanitize result with Zod
    const validatedResult = consolidationResultSchema.parse(rawResult);

    console.log(`✅ [Consolidation] Completed for ${assistantType}`);
    console.log(`   - Applied: ${validatedResult.summary.appliedCount}/${validatedResult.summary.totalSuggestions}`);
    console.log(`   - Duplicates: ${validatedResult.summary.duplicatesCount}`);
    console.log(`   - Conflicts: ${validatedResult.summary.conflictsCount}`);

    return validatedResult;
  } catch (error) {
    console.error("❌ [Consolidation] Error:", error);
    throw new Error("Erro ao consolidar sugestões de evolução");
  }
}

export { openai };
