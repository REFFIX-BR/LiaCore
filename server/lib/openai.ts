import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORGANIZATION_ID,
});

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

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: routingPrompt }],
    temperature: 0.3,
  });

  const assistantType = response.choices[0].message.content?.trim().toLowerCase() || "suporte";
  const validTypes = ["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento"];
  const finalType = validTypes.includes(assistantType) ? assistantType : "suporte";
  
  return {
    assistantType: finalType,
    assistantId: ASSISTANT_IDS[finalType as keyof typeof ASSISTANT_IDS],
    confidence: 0.85,
  };
}

export async function createThread(): Promise<string> {
  const thread = await openai.beta.threads.create();
  return thread.id;
}

export async function addMessageToThread(threadId: string, message: string): Promise<void> {
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: message,
  });
}

export async function runAssistant(threadId: string, assistantId: string): Promise<string> {
  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
  });

  let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

  while (runStatus.status !== "completed") {
    if (runStatus.status === "failed" || runStatus.status === "cancelled" || runStatus.status === "expired") {
      throw new Error(`Run failed with status: ${runStatus.status}`);
    }

    if (runStatus.status === "requires_action") {
      const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls || [];
      const toolOutputs = await handleToolCalls(toolCalls);
      
      await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
        tool_outputs: toolOutputs,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
  }

  const messages = await openai.beta.threads.messages.list(threadId);
  const lastMessage = messages.data[0];
  
  if (lastMessage.role === "assistant" && lastMessage.content[0].type === "text") {
    return lastMessage.content[0].text.value;
  }

  return "Desculpe, não consegui processar sua mensagem.";
}

async function handleToolCalls(toolCalls: any[]): Promise<any[]> {
  const outputs = [];

  for (const toolCall of toolCalls) {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    let result = "";

    switch (functionName) {
      case "verificar_conexao":
        result = JSON.stringify({
          status: "online",
          sinal: "excelente",
          velocidade: "500 Mbps",
          latencia: "12ms",
        });
        break;

      case "consultar_fatura":
        result = JSON.stringify({
          valor: "R$ 129,90",
          vencimento: "15/11/2024",
          status: "em aberto",
        });
        break;

      case "consultar_base_de_conhecimento":
        result = await searchKnowledgeBase(args.query);
        break;

      default:
        result = JSON.stringify({ error: "Função não implementada" });
    }

    outputs.push({
      tool_call_id: toolCall.id,
      output: result,
    });
  }

  return outputs;
}

async function searchKnowledgeBase(query: string): Promise<string> {
  return JSON.stringify({
    context: `Informações sobre: ${query}. Baseado na documentação técnica, encontramos as especificações relevantes para sua consulta.`,
    relevance: 0.92,
  });
}

export { openai };
