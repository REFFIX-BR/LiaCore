import { db } from "../server/db";
import { eq } from "drizzle-orm";
import { promptTemplates } from "../shared/schema";
import { readFileSync } from "fs";
import { updateAssistantPrompt } from "../server/lib/openai";

/**
 * Script para atualizar prompt da IA Comercial com seção sobre câmeras
 * e sincronizar com OpenAI Assistants API
 */
async function updateComercialPrompt() {
  console.log("🔄 Iniciando atualização do prompt Comercial...");

  try {
    // 1. Ler o novo conteúdo do arquivo
    const newContent = readFileSync("server/prompts/comercial-assistant-prompt.md", "utf-8");
    console.log(`📄 Arquivo lido: ${newContent.length} caracteres`);

    // 2. Atualizar no banco de dados (prompt_templates)
    console.log("💾 Atualizando no banco de dados...");
    const result = await db
      .update(promptTemplates)
      .set({
        content: newContent,
        version: "1.0.21", // Incrementando versão
        updatedAt: new Date(),
      })
      .where(eq(promptTemplates.assistantType, "comercial"))
      .returning();

    if (result.length === 0) {
      throw new Error("Nenhum template encontrado para assistant_type='comercial'");
    }

    console.log(`✅ Prompt atualizado no banco de dados!`);
    console.log(`   ID: ${result[0].id}`);
    console.log(`   Versão: ${result[0].version}`);
    console.log(`   Tamanho: ${result[0].content.length} caracteres`);

    // 3. Sincronizar com OpenAI Assistants API
    console.log("\n🤖 Sincronizando com OpenAI Assistants API...");
    await updateAssistantPrompt("comercial", newContent);
    console.log("✅ Prompt sincronizado com OpenAI!");

    console.log("\n🎉 Atualização concluída com sucesso!");
    console.log("\n📋 Mudanças implementadas:");
    console.log("   ✅ Adicionada seção '🎥 SERVIÇO TR TELECOM CÂMERAS'");
    console.log("   ✅ Regra obrigatória: consultar base de conhecimento sobre câmeras");
    console.log("   ✅ Preços: R$50 instalação + R$30/mês por câmera");
    console.log("   ✅ Características: 72h gravação, app iOS/Android");
    console.log("   ✅ Fluxo de atendimento para câmeras documentado");
    console.log("\n⚠️  IMPORTANTE: IA agora SEMPRE consultará base antes de responder sobre câmeras!");

  } catch (error) {
    console.error("❌ Erro ao atualizar prompt:", error);
    throw error;
  }
}

// Executar o script
updateComercialPrompt()
  .then(() => {
    console.log("\n✅ Script concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro fatal:", error);
    process.exit(1);
  });
