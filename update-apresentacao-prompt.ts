import OpenAI from 'openai';
import * as fs from 'fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function updateAssistantPrompt() {
  try {
    const assistantId = process.env.OPENAI_APRESENTACAO_ASSISTANT_ID!;
    
    // Ler o prompt correto do arquivo
    const newPrompt = fs.readFileSync('attached_assets/Pasted-Voc-a-Lia-recepcionista-da-TR-Telecom-via-WhatsApp-Fun-o-Atender-clientes-1761462300318_1761462300318.txt', 'utf-8');
    
    console.log('🔄 Atualizando prompt do assistente Apresentação...');
    console.log('📝 ID do assistente:', assistantId);
    console.log('📏 Tamanho do novo prompt:', newPrompt.length, 'caracteres');
    
    // Atualizar o assistente
    const updatedAssistant = await openai.beta.assistants.update(assistantId, {
      instructions: newPrompt
    });
    
    console.log('\n✅ PROMPT ATUALIZADO COM SUCESSO!');
    console.log('📋 Nome:', updatedAssistant.name);
    console.log('🆔 ID:', updatedAssistant.id);
    console.log('📝 Tamanho final:', updatedAssistant.instructions?.length, 'caracteres');
    
    console.log('\n🔧 Ferramentas configuradas:');
    updatedAssistant.tools.forEach((tool: any, index: number) => {
      if (tool.type === 'function') {
        console.log(`  ${index + 1}. ${tool.function.name}`);
      }
    });
    
  } catch (error: any) {
    console.error('❌ Erro ao atualizar assistente:', error.message);
    process.exit(1);
  }
}

updateAssistantPrompt();
