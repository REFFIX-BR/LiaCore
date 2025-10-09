import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: "org-AaGGTB8W7UF7Cyzrxi12lVL8",
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

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
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: routingPrompt }],
    });

    const assistantType = response.choices[0].message.content?.trim().toLowerCase() || "suporte";
    const validTypes = ["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento"];
    const finalType = validTypes.includes(assistantType) ? assistantType : "suporte";
    
    const assistantId = ASSISTANT_IDS[finalType as keyof typeof ASSISTANT_IDS] || ASSISTANT_IDS.suporte;
    
    console.log(`🎯 [Routing] Message routed to ${finalType} (${assistantId})`);
    
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
  const thread = await openai.beta.threads.create();
  return thread.id;
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
}> {
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

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage,
    });

    let run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: effectiveAssistantId,
    });

    console.log("🔵 [OpenAI] Run created:", { runId: run.id, threadId });

    // Manual polling loop
    let attempts = 0;
    const maxAttempts = 60;
    const runId = run.id;
    let transferData: { transferred?: boolean; transferredTo?: string } = {};
    let resolveData: { resolved?: boolean; resolveReason?: string } = {};

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
            const result = await handleToolCall(toolCall.function.name, toolCall.function.arguments, chatId, conversationId);
            
            // Check if this was a transfer call
            if (toolCall.function.name === "transferir_para_humano") {
              const transferResult = JSON.parse(result);
              if (transferResult.success) {
                transferData = {
                  transferred: true,
                  transferredTo: transferResult.departamento
                };
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
              }
            }
            
            return {
              tool_call_id: toolCall.id,
              output: result,
            };
          })
        );

        run = await openai.beta.threads.runs.submitToolOutputs(runId, {
          thread_id: threadId,
          tool_outputs: toolOutputs,
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        run = await openai.beta.threads.runs.retrieve(runId, {
          thread_id: threadId,
        });
      }

      attempts++;
    }

    console.log("🔵 [OpenAI] Run completed:", { runId: run.id, status: run.status, threadId });

    if (run.status === "failed" || run.status === "cancelled" || run.status === "expired") {
      throw new Error(`Run failed with status: ${run.status}`);
    }

    const messages = await openai.beta.threads.messages.list(threadId, {
      order: "desc",
      limit: 1,
    });

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
          ...resolveData
        };
      }
    }

    // If transfer was requested but no assistant message, return transfer confirmation
    if (transferData.transferred) {
      console.log("✅ [OpenAI] Transfer requested but no response - using fallback message");
      return {
        response: `Entendido! Vou transferir você para ${transferData.transferredTo || 'um atendente humano'}. Em instantes você será atendido por nossa equipe.`,
        ...transferData,
        ...resolveData
      };
    }

    // If resolve was requested but no assistant message, return resolve confirmation
    if (resolveData.resolved) {
      console.log("✅ [OpenAI] Resolve requested but no response - using fallback message");
      return {
        response: "Atendimento finalizado com sucesso! Em breve você receberá uma pesquisa de satisfação.",
        ...resolveData
      };
    }

    console.error("⚠️ [OpenAI] No valid response from assistant");
    return { response: "Desculpe, não consegui processar sua mensagem." };
  } catch (error) {
    console.error("Assistant run error:", error);
    return { response: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente." };
  }
}

async function handleToolCall(functionName: string, argsString: string, chatId?: string, conversationId?: string): Promise<string> {
  try {
    const args = JSON.parse(argsString);

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
        return JSON.stringify({
          valor: "R$ 129,90",
          vencimento: "15/11/2024",
          status: "em aberto",
          codigo_barras: "34191.79001 01043.510047 91020.150008 1 96610000012990",
          protocolo: `#${Math.floor(Math.random() * 1000000)}`,
        });

      case "consultar_base_de_conhecimento":
        const query = args.query || "";
        const { searchKnowledge } = await import("./upstash");
        const results = await searchKnowledge(query, 3);
        
        if (results.length === 0) {
          return JSON.stringify({
            contexto: "Não foram encontradas informações específicas sobre este tópico na base de conhecimento.",
            relevancia: 0,
            fonte: "Base de Conhecimento TR Telecom",
          });
        }
        
        const contexto = results.map(r => r.chunk.content).join('\n\n');
        const relevancia = results[0]?.score || 0;
        const fonte = results[0]?.chunk.source || "Base de Conhecimento TR Telecom";
        
        return JSON.stringify({
          contexto,
          relevancia,
          fonte,
        });

      case "transferir_para_humano":
        const departamento = args.departamento || args.department || "Suporte Geral";
        const motivo = args.motivo || args.reason || "Solicitação do cliente";
        
        console.log("🔀 [Transfer] IA solicitou transferência:", { chatId, departamento, motivo });
        
        // Mark conversation for transfer (will be processed in routes.ts)
        return JSON.stringify({
          success: true,
          departamento,
          motivo,
          mensagem: "Transferência iniciada com sucesso",
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

      case "agendar_visita":
        return JSON.stringify({
          protocolo: `#VST-${Math.floor(Math.random() * 1000000)}`,
          data_agendada: args.data || "Próxima terça-feira",
          horario: args.horario || "14:00-18:00",
          tecnico: "João Silva",
          status: "confirmado",
        });

      case "consultar_planos":
        return JSON.stringify({
          planos: [
            { nome: "Fibra 300", velocidade: "300 Mbps", valor: "R$ 99,90" },
            { nome: "Fibra 500", velocidade: "500 Mbps", valor: "R$ 129,90" },
            { nome: "Fibra Gamer", velocidade: "1 Gbps", valor: "R$ 199,90" },
          ],
        });

      case "consulta_boleto_cliente":
        if (!conversationId) {
          console.error("❌ [AI Tool] consulta_boleto_cliente chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível para consulta de boletos"
          });
        }
        
        const { executeAssistantTool } = await import("../ai-tools");
        const { storage } = await import("../storage");
        
        try {
          // Buscar documento do cliente automaticamente da conversa
          const conversation = await storage.getConversation(conversationId);
          
          if (!conversation) {
            console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
            return JSON.stringify({
              error: "Conversa não encontrada"
            });
          }
          
          if (!conversation.clientDocument) {
            console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
            return JSON.stringify({
              error: "Para consultar seus boletos, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
            });
          }
          
          // Injetar documento automaticamente nos args
          const argsWithDocument = {
            ...args,
            documento: conversation.clientDocument
          };
          
          const boletos = await executeAssistantTool(
            "consulta_boleto_cliente",
            argsWithDocument,
            { conversationId },
            storage
          );
          
          console.log(`✅ [AI Tool] Boletos consultados com sucesso`);
          return JSON.stringify(boletos);
        } catch (error) {
          console.error("❌ [AI Tool] Erro ao consultar boletos:", error);
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao consultar boletos"
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

    await openai.beta.assistants.update(assistantId, {
      instructions: newInstructions,
    });

    console.log(`✅ [OpenAI] Updated instructions for ${assistantType} (${assistantId})`);
  } catch (error) {
    console.error(`❌ [OpenAI] Error updating ${assistantType}:`, error);
    throw error;
  }
}

// Get current assistant instructions
export async function getAssistantInstructions(assistantType: string): Promise<string> {
  try {
    const assistantId = ASSISTANT_IDS[assistantType as keyof typeof ASSISTANT_IDS];
    
    if (!assistantId) {
      throw new Error(`Assistant type ${assistantType} not found`);
    }

    const assistant = await openai.beta.assistants.retrieve(assistantId);
    return assistant.instructions || "";
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

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

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: routingPrompt }],
      response_format: { type: "json_object" },
    });

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
