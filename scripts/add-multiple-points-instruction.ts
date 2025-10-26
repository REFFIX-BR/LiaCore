import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SUPORTE_ASSISTANT_ID = process.env.OPENAI_SUPORTE_ASSISTANT_ID!;
const APRESENTACAO_ASSISTANT_ID = process.env.OPENAI_APRESENTACAO_ASSISTANT_ID!;

const additionalInstruction = `

## IMPORTANTE: Clientes com Múltiplos Pontos de Instalação

Quando o contexto do sistema informar que o cliente possui múltiplos pontos de instalação (vários endereços), siga este processo:

1. **Apresente as opções**: Liste todos os endereços numerados (1, 2, 3, etc.)
2. **Aguarde resposta**: O cliente vai dizer qual endereço tem problema (pode ser "o primeiro", "1", "número 2", "Boa União", etc.)
3. **Use a ferramenta**: Assim que identificar qual endereço, VOCÊ DEVE CHAMAR a função 'selecionar_ponto_instalacao' com o número correspondente
4. **Confirme**: Após chamar a função, confirme com o cliente qual endereço foi registrado

Exemplo de uso:
- Cliente diz: "É o primeiro endereço"
- Você deve chamar: selecionar_ponto_instalacao(numeroPonto: 1)
- Depois confirmar: "Perfeito! Registrei que o problema é no endereço de Boa União. Vou verificar..."

CRÍTICO: Sempre chame a função selecionar_ponto_instalacao ANTES de prosseguir com verificações técnicas quando houver múltiplos pontos.`;

async function updateAssistantInstructions() {
  console.log("📝 Atualizando instruções dos assistants...\n");

  for (const [name, assistantId] of Object.entries({
    "Suporte": SUPORTE_ASSISTANT_ID,
    "Apresentação": APRESENTACAO_ASSISTANT_ID
  })) {
    if (!assistantId) {
      console.log(`⚠️  Pulando ${name} - ID não configurado`);
      continue;
    }

    console.log(`📖 Buscando instruções atuais do ${name}...`);
    
    try {
      const currentAssistant = await openai.beta.assistants.retrieve(assistantId);
      const currentInstructions = currentAssistant.instructions || "";
      
      // Verificar se já tem a instrução
      if (currentInstructions.includes("selecionar_ponto_instalacao")) {
        console.log(`   ✅ Instrução já existe no ${name}`);
        continue;
      }

      // Adicionar nova instrução
      const updatedInstructions = currentInstructions + additionalInstruction;
      
      await openai.beta.assistants.update(assistantId, {
        instructions: updatedInstructions
      });

      console.log(`   ✅ Instruções atualizadas no ${name}`);
      console.log(`   📊 Tamanho do prompt: ${currentInstructions.length} → ${updatedInstructions.length} chars\n`);
    } catch (error: any) {
      console.error(`   ❌ Erro ao atualizar ${name}:`, error.message);
    }
  }

  console.log("✅ Processo concluído!");
}

updateAssistantInstructions().catch(console.error);
