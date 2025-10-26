import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function listAllTools() {
  try {
    const assistantId = process.env.OPENAI_APRESENTACAO_ASSISTANT_ID!;
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    
    console.log('========== TODAS AS FERRAMENTAS DO ASSISTENTE APRESENTAÇÃO ==========\n');
    console.log(`Total de ferramentas: ${assistant.tools.length}\n`);
    
    assistant.tools.forEach((tool: any, index: number) => {
      console.log(`\n🔧 TOOL ${index + 1}:`);
      if (tool.type === 'function') {
        console.log(`   Nome: ${tool.function.name}`);
        console.log(`   Descrição: ${tool.function.description || 'N/A'}`);
        console.log(`   Parâmetros:`, JSON.stringify(tool.function.parameters, null, 2));
      } else {
        console.log(`   Tipo: ${tool.type}`);
      }
    });
    
    console.log('\n\n========== LISTA RESUMIDA ==========');
    const toolNames = assistant.tools
      .filter((t: any) => t.type === 'function')
      .map((t: any) => t.function.name);
    
    console.log('Ferramentas configuradas:');
    toolNames.forEach((name: string, i: number) => {
      console.log(`  ${i + 1}. ${name}`);
    });
    
    console.log('\n\n========== FERRAMENTAS QUE DEVERIAM ESTAR ==========');
    const expectedTools = ['rotear_para_assistente', 'transferir_para_humano', 'selecionar_ponto_instalacao'];
    console.log('Esperadas:');
    expectedTools.forEach((name, i) => {
      const exists = toolNames.includes(name) ? '✅' : '❌';
      console.log(`  ${exists} ${i + 1}. ${name}`);
    });
    
    console.log('\n\n========== FERRAMENTAS QUE NÃO DEVERIAM ESTAR ==========');
    const unexpectedTools = toolNames.filter((name: string) => !expectedTools.includes(name));
    if (unexpectedTools.length > 0) {
      console.log('🚨 EXTRAS ENCONTRADAS:');
      unexpectedTools.forEach((name, i) => {
        console.log(`  ❌ ${i + 1}. ${name}`);
      });
    } else {
      console.log('✅ Nenhuma ferramenta extra encontrada');
    }
    
  } catch (error: any) {
    console.error('Erro:', error.message);
  }
}

listAllTools();
