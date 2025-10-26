import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function checkAssistant() {
  try {
    const assistantId = process.env.OPENAI_APRESENTACAO_ASSISTANT_ID!;
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    
    console.log('========== ASSISTENTE APRESENTAÇÃO ==========');
    console.log('ID:', assistant.id);
    console.log('Nome:', assistant.name);
    console.log('\n========== INSTRUÇÕES ATUAIS ==========');
    console.log(assistant.instructions);
    console.log('\n========== FERRAMENTAS ==========');
    assistant.tools.forEach((tool, index) => {
      console.log(`\nTool ${index + 1}:`, JSON.stringify(tool, null, 2));
    });
  } catch (error: any) {
    console.error('Erro:', error.message);
  }
}

checkAssistant();
