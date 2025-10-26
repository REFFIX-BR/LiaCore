import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function checkFinanceiroAssistant() {
  try {
    const assistantId = process.env.OPENAI_FINANCEIRO_ASSISTANT_ID!;
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    
    console.log('========== ASSISTENTE FINANCEIRO ==========');
    console.log('ID:', assistant.id);
    console.log('Nome:', assistant.name);
    console.log('📏 Tamanho do prompt:', assistant.instructions?.length, 'caracteres');
    console.log('\n========== INSTRUÇÕES ATUAIS ==========');
    console.log(assistant.instructions);
    console.log('\n========== FERRAMENTAS ==========');
    assistant.tools.forEach((tool: any, index: number) => {
      if (tool.type === 'function') {
        console.log(`\nTool ${index + 1}: ${tool.function.name}`);
        console.log('Descrição:', tool.function.description);
      }
    });
  } catch (error: any) {
    console.error('Erro:', error.message);
  }
}

checkFinanceiroAssistant();
