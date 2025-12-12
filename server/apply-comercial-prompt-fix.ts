import { db } from "./db";
import { promptTemplates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function applyComercialPromptFix() {
  try {
    console.log("🚀 Iniciando aplicação do fix comercial (finalizar_conversa)...");

    const promptContent = fs.readFileSync(
      path.join(process.cwd(), "server/prompts/comercial-assistant-prompt-v2-optimized.md"),
      "utf-8"
    );

    console.log(`📄 Conteúdo do prompt lido (${promptContent.length} caracteres)`);

    const existingTemplate = await db.query.promptTemplates.findFirst({
      where: and(
        eq(promptTemplates.assistantType, "comercial"),
        eq(promptTemplates.status, "active")
      ),
    });

    if (!existingTemplate) {
      console.error("❌ Template de prompt COMERCIAL não encontrado!");
      process.exit(1);
    }

    console.log(`✅ Template encontrado: ${existingTemplate.id}, assistant_id: ${existingTemplate.assistantId}`);

    const tokenCount = Math.ceil(promptContent.length / 4);
    const newVersion = "2.0.3";
    
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

    console.log("\n✨ PROMPT COMERCIAL v2.0.3 APLICADO COM SUCESSO!");
    console.log("\n📋 CORREÇÃO APLICADA:");
    console.log("   - Adicionada seção 'ENCERRAMENTO DE CONVERSA'");
    console.log("   - IA agora DEVE chamar finalizar_conversa() após despedidas");
    console.log("   - Evita follow-ups automáticos desnecessários");

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao aplicar prompt:", error);
    process.exit(1);
  }
}

applyComercialPromptFix();
