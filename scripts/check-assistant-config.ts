import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = 'asst_VF8ESARC2t5leW2Q13FngKrE';

async function checkConfig() {
  console.log('\n🔍 Verificando configuração da IA Cobrança...\n');
  
  try {
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    
    console.log('📋 Informações do Assistant:');
    console.log(`   ID: ${assistant.id}`);
    console.log(`   Nome: ${assistant.name}`);
    console.log(`   Modelo: ${assistant.model}`);
    console.log(`   Ferramentas: ${assistant.tools?.length || 0}`);
    console.log('\n📝 Instruções (primeiros 500 caracteres):');
    console.log(assistant.instructions?.substring(0, 500) || 'SEM INSTRUÇÕES!');
    console.log('\n...\n');
    
    if (!assistant.instructions || assistant.instructions.length < 100) {
      console.log('⚠️  PROBLEMA: Instruções estão vazias ou muito curtas!');
    } else if (!assistant.instructions.includes('cobrança') && !assistant.instructions.includes('Maria')) {
      console.log('⚠️  PROBLEMA: Instruções não contêm palavras-chave de cobrança!');
    } else {
      console.log('✅ Instruções parecem corretas!');
    }
    
  } catch (error: any) {
    console.error('\n❌ Erro ao verificar:', error.message);
    process.exit(1);
  }
}

checkConfig();
