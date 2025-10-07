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
  chatId?: string
): Promise<{ response: string; transferred?: boolean; transferredTo?: string }> {
  try {
    if (!threadId) {
      throw new Error("Thread ID is required");
    }

    const effectiveAssistantId = assistantId || ASSISTANT_IDS.cortex || ASSISTANT_IDS.suporte;
    
    if (!effectiveAssistantId) {
      throw new Error("No valid assistant ID available");
    }

    console.log("🔵 [OpenAI] Sending message:", { threadId, assistantId: effectiveAssistantId });

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
            const result = await handleToolCall(toolCall.function.name, toolCall.function.arguments, chatId);
            
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
    
    if (lastMessage && lastMessage.role === "assistant") {
      const content = lastMessage.content[0];
      if (content.type === "text") {
        return {
          response: content.text.value,
          ...transferData
        };
      }
    }

    return { response: "Desculpe, não consegui processar sua mensagem." };
  } catch (error) {
    console.error("Assistant run error:", error);
    return { response: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente." };
  }
}

async function handleToolCall(functionName: string, argsString: string, chatId?: string): Promise<string> {
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

export { openai };
