import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function syncFinanceiroPrompt() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const assistantId = process.env.OPENAI_FINANCEIRO_ASSISTANT_ID;
  
  if (!assistantId) {
    throw new Error("OPENAI_FINANCEIRO_ASSISTANT_ID not found");
  }
  
  const promptPath = path.join(__dirname, "prompts", "financeiro-assistant-prompt-v1.1-melhorado.md");
  const newInstructions = fs.readFileSync(promptPath, "utf-8");
  
  console.log(`📝 Syncing financeiro prompt (${newInstructions.length} chars)...`);
  console.log(`🔑 Assistant ID: ${assistantId}`);
  
  await openai.beta.assistants.update(assistantId, {
    instructions: newInstructions,
  });
  
  console.log("✅ Financeiro prompt synced successfully!");
}

syncFinanceiroPrompt().catch(console.error);
