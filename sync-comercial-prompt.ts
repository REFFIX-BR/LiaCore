import { db } from "./server/db";
import { promptTemplates } from "./shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function syncComercialPrompt() {
  console.log("🔄 Buscando prompt do comercial no banco de dados...");
  
  const [template] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.assistantType, "comercial"));
    
  if (!template || !template.content) {
    console.error("❌ Prompt comercial não encontrado!");
    process.exit(1);
  }
  
  console.log(`✅ Prompt encontrado! Tamanho: ${template.content.length} caracteres`);
  console.log(`📋 Regra de não repetir: ${template.content.includes('NUNCA REPETIR PERGUNTAS') ? '✅ SIM' : '❌ NÃO'}`);
  
  const assistantId = "asst_KY7AbcYc3VeVk9QPlk8xPYAA";
  console.log(`🔄 Sincronizando com OpenAI (Assistant ID: ${assistantId})...`);
  
  await openai.beta.assistants.update(assistantId, {
    instructions: template.content
  });
  
  console.log("✅ Prompt sincronizado com OpenAI com sucesso!");
}

syncComercialPrompt().catch(console.error);
