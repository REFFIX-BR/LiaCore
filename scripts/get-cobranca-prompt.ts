import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const assistantId = process.env.OPENAI_COBRANCA_ASSISTANT_ID;

async function getPrompt() {
  if (!assistantId) {
    console.error('❌ OPENAI_COBRANCA_ASSISTANT_ID não configurado!');
    process.exit(1);
  }
  
  const assistant = await openai.beta.assistants.retrieve(assistantId);
  
  console.log('='.repeat(80));
  console.log('PROMPT ATUAL DA IA COBRANÇA:');
  console.log('='.repeat(80));
  console.log(assistant.instructions);
  console.log('='.repeat(80));
}

getPrompt().catch(console.error);
