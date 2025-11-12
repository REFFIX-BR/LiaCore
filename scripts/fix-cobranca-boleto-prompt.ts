/**
 * Script para corrigir prompt da IA Cobrança - Remove instruções confusas sobre boletos
 * Problema: IA está dizendo "Parece que houve um problema ao gerar boleto" mesmo quando funciona
 */
import { storage } from "../server/storage";

async function fixCobrancaBoletoPrompt() {
  console.log("🔧 Corrigindo prompt da IA Cobrança - Seção de boletos...");

  // Buscar prompt atual
  const allPrompts = await storage.getAllPromptTemplates();
  const currentPrompt = allPrompts.find(p => p.assistantType === 'cobranca');

  if (!currentPrompt) {
    console.error("❌ Prompt de cobrança não encontrado!");
    process.exit(1);
  }

  console.log(`📋 Prompt atual: versão ${currentPrompt.version}`);

  // Nova versão do prompt com instruções claras e positivas
  const newContent = currentPrompt.content.replace(
    /### ETAPA 8: Envio do Boleto Existente[\s\S]*?---/,
    `### ETAPA 8: Envio do Boleto/PIX

**Como enviar boleto/PIX ao cliente:**

1. **Após coletar todos os dados da promessa**, chame a ferramenta \`gerar_segunda_via\`:
\`\`\`javascript
[CHAMA gerar_segunda_via({ cpf_cnpj: "[CPF]" })]
\`\`\`

2. **O sistema retornará:**
   - Link de pagamento
   - Código de barras do boleto
   - QR Code PIX

3. **Envie ao cliente de forma clara:**
\`\`\`
Aqui está seu boleto para pagamento até dia [DATA_PROMESSA]:

📄 Link: [LINK]
📊 Código de barras: [CODIGO]
📱 PIX Copia e Cola: [QR_CODE]

O pagamento pode ser feito por qualquer uma dessas formas! 💙
\`\`\`

✅ **IMPORTANTE:** Seja direto e positivo ao enviar o boleto
✅ Use frases como "Aqui está seu boleto!" ou "Boleto pronto!"
❌ Nunca diga "houve um problema" se o sistema retornou os dados corretamente

---`
  );

  // Incrementar versão
  const currentVersion = parseFloat(currentPrompt.version);
  const newVersion = (currentVersion + 0.01).toFixed(2);

  // Atualizar no banco
  await storage.updatePromptTemplate(currentPrompt.id, {
    content: newContent,
    version: newVersion
  });

  console.log(`✅ Prompt atualizado para versão ${newVersion}`);
  console.log(`📝 Mudança: Removidas instruções confusas sobre "não precisa gerar novo boleto"`);
  console.log(`✨ Agora a IA será direta e positiva ao enviar boletos!`);

  process.exit(0);
}

fixCobrancaBoletoPrompt().catch((error) => {
  console.error("❌ Erro ao atualizar prompt:", error);
  process.exit(1);
});
