import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function removeToolFromApresentacao() {
  try {
    const assistantId = process.env.OPENAI_APRESENTACAO_ASSISTANT_ID!;
    
    console.log('🔍 Buscando assistente Apresentação...');
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    
    console.log('✅ Assistente encontrado:', assistant.name);
    console.log('🔧 Ferramentas atuais:', assistant.tools.length);
    
    assistant.tools.forEach((tool: any, index: number) => {
      if (tool.type === 'function') {
        console.log(`  ${index + 1}. ${tool.function.name}`);
      }
    });
    
    // Remover apenas selecionar_ponto_instalacao, manter as outras
    const filteredTools = assistant.tools.filter((tool: any) => {
      if (tool.type === 'function') {
        return tool.function.name !== 'selecionar_ponto_instalacao';
      }
      return true;
    });
    
    console.log('\n🗑️  Removendo ferramenta selecionar_ponto_instalacao...');
    console.log(`📊 Ferramentas antes: ${assistant.tools.length}`);
    console.log(`📊 Ferramentas depois: ${filteredTools.length}`);
    
    // Atualizar assistente
    const updatedAssistant = await openai.beta.assistants.update(assistantId, {
      tools: filteredTools
    });
    
    console.log('\n✅ ASSISTENTE ATUALIZADO COM SUCESSO!');
    console.log('🔧 Ferramentas restantes:');
    updatedAssistant.tools.forEach((tool: any, index: number) => {
      if (tool.type === 'function') {
        console.log(`  ${index + 1}. ${tool.function.name}`);
      }
    });
    
    console.log('\n\n========== RESUMO ==========');
    console.log('Assistente: Lia - Apresentação');
    console.log('ID:', assistantId);
    console.log('❌ Removida: selecionar_ponto_instalacao');
    console.log('✅ Mantidas: rotear_para_assistente, transferir_para_humano');
    console.log('\n🎯 Agora a Apresentação vai apenas ROTEAR, não perguntar sobre endereços!');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

removeToolFromApresentacao();
