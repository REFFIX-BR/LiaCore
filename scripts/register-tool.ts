import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_IDS = {
  suporte: process.env.OPENAI_SUPORTE_ASSISTANT_ID!,
  apresentacao: process.env.OPENAI_APRESENTACAO_ASSISTANT_ID!,
};

const toolDefinition = {
  type: "function" as const,
  function: {
    name: "selecionar_ponto_instalacao",
    description: "Registra qual ponto de instalação (endereço) o cliente está reportando problema técnico. Use quando o cliente tiver múltiplos pontos de instalação e confirmar qual deles tem o problema.",
    parameters: {
      type: "object",
      properties: {
        numeroPonto: {
          type: "number",
          description: "Número do ponto de instalação escolhido pelo cliente (1, 2, 3, etc). Corresponde ao número mostrado na lista de endereços apresentada ao cliente."
        }
      },
      required: ["numeroPonto"]
    }
  }
};

async function registerTool() {
  console.log("🔧 Registrando ferramenta selecionar_ponto_instalacao...\n");

  for (const [name, assistantId] of Object.entries(ASSISTANT_IDS)) {
    if (!assistantId) {
      console.log(`⚠️  Pulando ${name} - ID não configurado`);
      continue;
    }

    console.log(`📝 Atualizando assistant: ${name} (${assistantId})`);

    try {
      // Buscar assistant atual
      const currentAssistant = await openai.beta.assistants.retrieve(assistantId);
      
      // Verificar se a ferramenta já existe
      const toolExists = currentAssistant.tools?.some(
        (tool: any) => tool.type === 'function' && tool.function?.name === 'selecionar_ponto_instalacao'
      );

      if (toolExists) {
        console.log(`   ✅ Ferramenta já existe no ${name}`);
        continue;
      }

      // Adicionar nova ferramenta
      const updatedAssistant = await openai.beta.assistants.update(assistantId, {
        tools: [
          ...(currentAssistant.tools || []),
          toolDefinition
        ]
      });

      console.log(`   ✅ Ferramenta adicionada ao ${name}`);
      console.log(`   📊 Total de ferramentas: ${updatedAssistant.tools?.length || 0}\n`);
    } catch (error: any) {
      console.error(`   ❌ Erro ao atualizar ${name}:`, error.message);
    }
  }

  console.log("✅ Processo concluído!");
}

registerTool().catch(console.error);
