import { db } from "./server/db";
import { promptTemplates } from "./shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function syncFinanceiroPrompt() {
  console.log("🔄 Buscando prompt do financeiro no banco de dados...");
  
  const template = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.assistantType, "financeiro"))
    .limit(1);
    
  if (!template.length) {
    console.error("❌ Prompt do financeiro não encontrado!");
    process.exit(1);
  }
  
  const prompt = template[0];
  console.log(`✅ Prompt encontrado! Tamanho: ${prompt.content.length} caracteres`);
  
  // Verificar se tem as novas regras
  const temRegraBoleto = prompt.content.includes("ENVIAR APENAS UM BOLETO POR VEZ");
  const temRegraEndereco = prompt.content.includes("NELSON VIANA, 513 = SEDE DA TR TELECOM");
  
  console.log(`📋 Regra de boleto único: ${temRegraBoleto ? "✅ SIM" : "❌ NÃO"}`);
  console.log(`📋 Regra de endereço: ${temRegraEndereco ? "✅ SIM" : "❌ NÃO"}`);
  
  const assistantId = process.env.OPENAI_FINANCEIRO_ASSISTANT_ID;
  if (!assistantId) {
    console.error("❌ OPENAI_FINANCEIRO_ASSISTANT_ID não configurado!");
    process.exit(1);
  }
  
  console.log(`🔄 Sincronizando com OpenAI (Assistant ID: ${assistantId})...`);
  
  try {
    await openai.beta.assistants.update(assistantId, {
      instructions: prompt.content,
    });
    console.log("✅ Prompt sincronizado com OpenAI com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao sincronizar:", error);
    process.exit(1);
  }
}

syncFinanceiroPrompt().then(() => process.exit(0));
