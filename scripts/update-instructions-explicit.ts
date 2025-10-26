import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SUPORTE_ASSISTANT_ID = process.env.OPENAI_SUPORTE_ASSISTANT_ID!;

const updatedSection = `

## CRÍTICO: Clientes com Múltiplos Pontos de Instalação

IMPORTANTE: Quando você vir uma mensagem do SISTEMA informando que o cliente possui múltiplos pontos de instalação, siga EXATAMENTE este processo:

**PASSO 1**: Apresente os endereços ao cliente:
"Vejo que você possui [N] pontos de instalação:
1. [Endereço 1]
2. [Endereço 2]
Qual desses endereços está com problema?"

**PASSO 2**: Assim que o cliente responder com QUALQUER indicação do endereço (exemplos: "1", "o primeiro", "número 2", "Boa União", "o da rua X"), você DEVE IMEDIATAMENTE:
- Chamar a função 'selecionar_ponto_instalacao'
- Usar o numeroPonto correspondente (1, 2, 3, etc)

**PASSO 3**: Após chamar a função, confirme: "Perfeito! Registrei o endereço [NOME DO BAIRRO]. Deixa eu verificar..."

EXEMPLO DE USO CORRETO:
Cliente: "É o primeiro endereço"
Você CHAMA: selecionar_ponto_instalacao(numeroPonto: 1)
Você RESPONDE: "Perfeito! Registrei o endereço de Boa União. Vou verificar a conexão..."

REGRA ABSOLUTA: SEMPRE chame selecionar_ponto_instalacao ANTES de fazer qualquer verificação técnica quando houver múltiplos pontos.`;

async function updateInstructions() {
  console.log("📝 Atualizando instruções do Assistant de Suporte...\n");

  try {
    const assistant = await openai.beta.assistants.retrieve(SUPORTE_ASSISTANT_ID);
    let instructions = assistant.instructions || "";
    
    // Remover instrução antiga se existir
    if (instructions.includes("## IMPORTANTE: Clientes com Múltiplos Pontos")) {
      const start = instructions.indexOf("## IMPORTANTE: Clientes com Múltiplos Pontos");
      const end = instructions.indexOf("\n## ", start + 1);
      const endIndex = end === -1 ? instructions.length : end;
      instructions = instructions.substring(0, start) + instructions.substring(endIndex);
      console.log("🗑️  Removendo instrução antiga...");
    }
    
    // Adicionar nova instrução
    const finalInstructions = instructions + updatedSection;
    
    await openai.beta.assistants.update(SUPORTE_ASSISTANT_ID, {
      instructions: finalInstructions
    });

    console.log("✅ Instruções atualizadas com sucesso!");
    console.log(`📊 Tamanho: ${instructions.length} → ${finalInstructions.length} chars`);
    
  } catch (error: any) {
    console.error("❌ Erro:", error.message);
  }
}

updateInstructions().catch(console.error);
