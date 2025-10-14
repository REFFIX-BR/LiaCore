import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function verifyAssistantTools() {
  const assistantId = 'asst_pRXVhoy1o4YxNxVmaRiNOTMX'; // Financeiro
  
  console.log('🔍 Verificando configuração do assistente Financeiro...\n');
  
  try {
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    
    console.log('📋 Assistente:', assistant.name);
    console.log('📋 ID:', assistant.id);
    console.log('\n🛠️  TOOLS CONFIGURADAS:\n');
    
    if (!assistant.tools || assistant.tools.length === 0) {
      console.log('❌ NENHUMA TOOL CONFIGURADA!');
      console.log('\n⚠️  O assistente não tem ferramentas. Por isso nunca entra em requires_action!\n');
      return;
    }
    
    assistant.tools.forEach((tool: any, index: number) => {
      console.log(`${index + 1}. Tipo: ${tool.type}`);
      if (tool.type === 'function') {
        console.log(`   Nome: ${tool.function.name}`);
        console.log(`   Descrição: ${tool.function.description || '(sem descrição)'}`);
        console.log(`   Parâmetros:`, JSON.stringify(tool.function.parameters, null, 2));
      }
      console.log('');
    });
    
    // Verificar se a função consulta_boleto_cliente está presente
    const hasConsultaBoleto = assistant.tools.some(
      (tool: any) => tool.type === 'function' && tool.function.name === 'consulta_boleto_cliente'
    );
    
    if (hasConsultaBoleto) {
      console.log('✅ FUNÇÃO consulta_boleto_cliente ENCONTRADA!');
    } else {
      console.log('❌ FUNÇÃO consulta_boleto_cliente NÃO ENCONTRADA!');
      console.log('\n📝 Você precisa adicionar esta ferramenta no painel do OpenAI:');
      console.log('   https://platform.openai.com/assistants/' + assistantId);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar assistente:', error);
  }
}

verifyAssistantTools();
