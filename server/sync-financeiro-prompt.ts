import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Redis } from "@upstash/redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function syncFinanceiroPrompt() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const assistantId = process.env.OPENAI_FINANCEIRO_ASSISTANT_ID;
  
  if (!assistantId) {
    throw new Error("OPENAI_FINANCEIRO_ASSISTANT_ID not found");
  }
  
  const promptPath = path.join(__dirname, "prompts", "financeiro-assistant-prompt-v2.md");
  const newInstructions = fs.readFileSync(promptPath, "utf-8");
  
  console.log(`📝 Syncing financeiro prompt (${newInstructions.length} chars)...`);
  console.log(`🔑 Assistant ID: ${assistantId}`);
  
  await openai.beta.assistants.update(assistantId, {
    instructions: newInstructions,
  });
  
  console.log("✅ Financeiro prompt synced to OpenAI!");
  
  // Limpar cache de instruções no Redis (Upstash)
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (redisUrl && redisToken) {
    console.log("🗑️ Clearing assistant instructions cache...");
    const redis = new Redis({ url: redisUrl, token: redisToken });
    
    // Limpar cache de instruções do financeiro
    await redis.del("assistant:instructions:financeiro");
    await redis.del("instructions:financeiro");
    
    console.log("✅ Cache cleared successfully!");
  } else {
    console.log("⚠️ Redis credentials not found - cache not cleared");
  }
}

syncFinanceiroPrompt().catch(console.error);
