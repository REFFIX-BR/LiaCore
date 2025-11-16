import { db } from "./db";
import { promptTemplates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function applyPromptFix() {
  try {
    console.log("🚀 Iniciando aplicação do prompt v1.0.20...");

    const promptContent = fs.readFileSync(
      path.join(process.cwd(), "prompt_apresentacao_v1.0.20_FIXED.md"),
      "utf-8"
    );

    console.log(`📄 Conteúdo do prompt lido (${promptContent.length} caracteres)`);

    const existingTemplate = await db.query.promptTemplates.findFirst({
      where: and(
        eq(promptTemplates.assistantType, "apresentacao"),
        eq(promptTemplates.status, "active")
      ),
    });

    if (!existingTemplate) {
      console.error("❌ Template de prompt APRESENTAÇÃO não encontrado!");
      process.exit(1);
    }

    console.log(`✅ Template encontrado: ${existingTemplate.id}, assistant_id: ${existingTemplate.assistantId}`);

    const tokenCount = Math.ceil(promptContent.length / 4);
    
    const [updatedTemplate] = await db
      .update(promptTemplates)
      .set({
        content: promptContent,
        version: "1.0.20",
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

    console.log("\n✨ PROMPT v1.0.20 APLICADO COM SUCESSO!");
    console.log("\n📋 PRÓXIMOS PASSOS:");
    console.log("   1. Teste com casos similares aos de Ricardo Valente e Bete Peres");
    console.log("   2. Monitore métricas de roteamento nas próximas 24h");
    console.log("   3. Valide que não há mais roteamentos incorretos para CANCELAMENTO");

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao aplicar prompt:", error);
    process.exit(1);
  }
}

applyPromptFix();
