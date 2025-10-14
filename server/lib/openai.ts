import OpenAI from "openai";
import { assistantCache, redisConnection } from "./redis-config";
import { agentLogger } from "./agent-logger";

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
      const content = lastMessage.content[0];
      if (content.type === "text") {
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

    switch (functionName) {
      case "verificar_conexao":
        return JSON.stringify({
          status: "online",
          sinal: "excelente",
          velocidade_download: "500 Mbps",
          velocidade_upload: "250 Mbps",
          latencia: "12ms",
          pacotes_perdidos: "0%",
        });

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

      case "consultar_planos":
        console.warn("⚠️ [AI Tool] consultar_planos chamada - função não implementada");
        return JSON.stringify({
          error: "Consulta de planos deve ser feita através do site ou com atendimento humano. Por favor, solicite transferência para o comercial."
        });

      case "consulta_boleto_cliente":
        console.log(`🚨 [DEBUG] ENTRANDO NO CASE consulta_boleto_cliente - conversationId: ${conversationId || 'UNDEFINED'}`);
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
          
          // Chamar diretamente a API real
          const boletos = await consultaBoletoCliente(
            conversation.clientDocument,
            { conversationId },
            storage
          );
          
          console.log(`✅ [AI Tool Handler] Boletos consultados com sucesso: ${boletos?.length || 0} boleto(s)`);
          return JSON.stringify(boletos);
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
