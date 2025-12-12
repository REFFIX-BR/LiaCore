import { db } from "./db";
import { promptTemplates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function applySuportePromptFix() {
  try {
    console.log("🚀 Iniciando aplicação do fix de suporte (transferir_para_humano)...");

    const promptContent = fs.readFileSync(
      path.join(process.cwd(), "server/prompts/suporte-assistant-prompt-v1.1-melhorado.md"),
      "utf-8"
    );

    console.log(`📄 Conteúdo do prompt lido (${promptContent.length} caracteres)`);

    const existingTemplate = await db.query.promptTemplates.findFirst({
      where: and(
        eq(promptTemplates.assistantType, "suporte"),
        eq(promptTemplates.status, "active")
      ),
    });

    if (!existingTemplate) {
      console.error("❌ Template de prompt SUPORTE não encontrado!");
      process.exit(1);
    }

    console.log(`✅ Template encontrado: ${existingTemplate.id}, assistant_id: ${existingTemplate.assistantId}`);

    const tokenCount = Math.ceil(promptContent.length / 4);
    const newVersion = "1.1.5"; // Increment version for the fix
    
    const [updatedTemplate] = await db
      .update(promptTemplates)
      .set({
        content: promptContent,
        version: newVersion,
        tokenCount: tokenCount,
        updatedAt: new Date(),
      })
      .where(eq(promptTemplates.id, existingTemplate.id))
      .returning();

    console.log(`✅ Banco de dados atualizado: v${updatedTemplate.version}`);

    if (existingTemplate.assistantId) {
      console.log(`🔄 Sincronizando com OpenAI Assistant ID: ${existingTemplate.assistantId}...`);

      const assistant = await openai.beta.assistants.update(
        existingTemplate.assistantId,
        {
          instructions: promptContent,
        }
      );

      console.log(`✅ OpenAI Assistant atualizado: ${assistant.id}`);
      console.log(`   - Model: ${assistant.model}`);
      console.log(`   - Instructions length: ${assistant.instructions?.length || 0} caracteres`);
    } else {
      console.warn("⚠️ Nenhum assistant_id configurado - sincronização com OpenAI ignorada");
    }

    console.log("\n✨ PROMPT DE SUPORTE v1.1.5 APLICADO COM SUCESSO!");
    console.log("\n📋 CORREÇÃO APLICADA:");
    console.log("   - Trocado rotear_para_assistente('suporte') → transferir_para_humano('Suporte')");
    console.log("   - Agora a IA transfere para HUMANO REAL, não para outro assistente IA");
    console.log("\n📋 PRÓXIMOS PASSOS:");
    console.log("   1. Teste com casos de transferência técnica");
    console.log("   2. Monitore conversas de suporte nas próximas 24h");
    console.log("   3. Verifique que transferências aparecem no dashboard de supervisor");

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao aplicar prompt:", error);
    process.exit(1);
  }
}

applySuportePromptFix();
