import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './storage';
import { updateAssistantPrompt } from './lib/openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function syncFinanceiroPrompt() {
  try {
    console.log('🔄 [Sync] Reading updated financeiro prompt from file...');
    
    const promptPath = path.join(__dirname, 'prompts', 'financeiro-assistant-prompt-v1.1-melhorado.md');
    const newContent = fs.readFileSync(promptPath, 'utf-8');
    
    console.log(`📝 [Sync] Prompt size: ${newContent.length} characters`);
    
    // Get existing template
    const templates = await storage.getAllPromptTemplates();
    const financeiroTemplate = templates.find(t => t.assistantType === 'financeiro');
    
    if (!financeiroTemplate) {
      console.error('❌ [Sync] Financeiro template not found in database');
      return;
    }
    
    console.log(`📝 [Sync] Found template ID: ${financeiroTemplate.id}`);
    console.log(`📝 [Sync] Current version: ${financeiroTemplate.version}`);
    
    // Update database
    await storage.updatePromptTemplate(financeiroTemplate.id, {
      content: newContent,
      tokenCount: Math.ceil(newContent.length / 4), // Approximate token count
    });
    
    console.log('✅ [Sync] Database updated');
    
    // Sync to OpenAI
    console.log('🔄 [Sync] Syncing to OpenAI Assistant...');
    await updateAssistantPrompt('financeiro', newContent);
    
    console.log('✅ [Sync] OpenAI Assistant updated successfully!');
    console.log('🎉 [Sync] Financeiro prompt synced - comprovante priority rule now active!');
    
  } catch (error) {
    console.error('❌ [Sync] Error:', error);
    throw error;
  }
}

// Run if called directly
syncFinanceiroPrompt().then(() => {
  console.log('✅ [Sync] Complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ [Sync] Failed:', error);
  process.exit(1);
});
