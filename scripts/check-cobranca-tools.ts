import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function checkTools() {
  const assistantId = process.env.OPENAI_COBRANCA_ASSISTANT_ID;
  
  if (!assistantId) {
    console.error('❌ OPENAI_COBRANCA_ASSISTANT_ID não configurado!');
    process.exit(1);
  }
  
  console.log(`🔍 Verificando assistant: ${assistantId}\n`);
  
  const assistant = await openai.beta.assistants.retrieve(assistantId);
  
  console.log(`📋 Nome: ${assistant.name}`);
  console.log(`📝 Modelo: ${assistant.model}`);
  console.log(`\n🔧 Ferramentas configuradas (${assistant.tools.length}):`);
  
  for (const tool of assistant.tools) {
    if (tool.type === 'function') {
      console.log(`\n  ✅ ${tool.function.name}`);
      console.log(`     Descrição: ${tool.function.description?.substring(0, 80)}...`);
    } else {
      console.log(`\n  ℹ️  ${tool.type}`);
    }
  }
  
  // Verificar se consultar_boleto_cliente existe
  const hasBoletoTool = assistant.tools.some(
    t => t.type === 'function' && t.function.name === 'consultar_boleto_cliente'
  );
  
  console.log(`\n${'='.repeat(60)}`);
  if (hasBoletoTool) {
    console.log('✅ Função consultar_boleto_cliente ENCONTRADA!');
  } else {
    console.log('❌ Função consultar_boleto_cliente NÃO ENCONTRADA!');
    console.log('   A IA Cobrança não consegue consultar boletos sem esta função.');
  }
  console.log('='.repeat(60));
}

checkTools().catch(console.error);
