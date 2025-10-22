import OpenAI from "openai";
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
async function acquireThreadLock(threadId: string, timeoutMs: number = 30000): Promise<{ acquired: boolean; lockValue?: string }> {
  const lockKey = `thread-lock:${threadId}`;
  const lockValue = `lock-${Date.now()}-${Math.random()}`;
  const maxWaitTime = Date.now() + timeoutMs;
  
  while (Date.now() < maxWaitTime) {
    try {
      // TTL de 120s (maior que circuit breaker timeout de 90s)
      const acquired = await redisConnection.set(lockKey, lockValue, 'EX', 120, 'NX');
      
      if (acquired === 'OK') {
        console.log(`🔒 [OpenAI] Lock acquired for thread ${threadId} with value ${lockValue}`);
        return { acquired: true, lockValue };
      }
      
      // Se não conseguiu, aguarda 100ms e tenta novamente
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ [OpenAI] Error acquiring lock for thread ${threadId}:`, error);
      return { acquired: false };
    }
  }
  
  console.warn(`⏰ [OpenAI] Lock timeout for thread ${threadId} after ${timeoutMs}ms`);
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
          await openaiCircuitBreaker.execute(() =>
            openai.beta.threads.runs.cancel(activeRun.id, { thread_id: threadId })
          );
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait for cancellation
        }
      }
    } catch (error) {
      console.warn(`⚠️  [OpenAI] Error checking/cancelling active runs:`, error);
      // Continue anyway
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
      throw new Error(`Run failed with status: ${run.status}`);
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
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao consultar boletos"
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
          
          // Chamar diretamente a API real - retorna { boletos, temMultiplosPontos }
          const { boletos, temMultiplosPontos } = await consultaBoletoCliente(
            conversation.clientDocument,
            { conversationId },
            storage
          );
          
          console.log(`✅ [AI Tool Handler] Boletos consultados com sucesso: ${boletos?.length || 0} boleto(s) EM ABERTO, múltiplos pontos: ${temMultiplosPontos}`);
          
          // Formatar resposta com mensagem clara para a IA
          if (!boletos || boletos.length === 0) {
            return JSON.stringify({
              status: "EM_DIA",
              mensagem: "Cliente está EM DIA - sem boletos pendentes, vencidos ou em aberto.",
              boletos: [],
              temMultiplosPontos
            });
          }
          
          // Mapear boletos para incluir link na descrição formatada
          const boletosFormatados = boletos.map(boleto => ({
            vencimento: boleto.DATA_VENCIMENTO,
            valor: boleto.VALOR_TOTAL,
            codigo_barras: boleto.CODIGO_BARRA_TRANSACAO,
            link_pagamento: boleto.link_carne_completo,
            pix: boleto.PIX_TXT,
            status: boleto.STATUS
          }));
          
          return JSON.stringify({
            status: "COM_DEBITOS",
            mensagem: `ATENÇÃO: Cliente possui ${boletos.length} boleto(s) EM ABERTO ou VENCIDOS.`,
            quantidade_boletos: boletos.length,
            boletos: boletosFormatados,
            temMultiplosPontos
          });
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao consultar boletos:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
          }
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao consultar boletos"
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

export { openai };
