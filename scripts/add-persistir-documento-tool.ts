import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const assistantId = process.env.OPENAI_COBRANCA_ASSISTANT_ID;

if (!assistantId) {
  console.error('❌ OPENAI_COBRANCA_ASSISTANT_ID não configurado!');
  process.exit(1);
}

async function addPersistirDocumentoTool() {
  try {
    console.log('📋 Buscando configuração atual do assistente...');
    const currentAssistant = await openai.beta.assistants.retrieve(assistantId);
    
    console.log(`✅ Assistant encontrado: ${currentAssistant.name}`);
    console.log(`📦 Tools atuais: ${currentAssistant.tools.length}`);
    
    // Verificar se tool já existe (idempotência)
    const existingTool = currentAssistant.tools.find(
      (t: any) => t.type === 'function' && t.function?.name === 'persistir_documento'
    );
    
    if (existingTool) {
      console.log('⚠️  Tool persistir_documento já existe! Nada a fazer.');
      return;
    }
    
    // Nova tool persistir_documento
    const newTool = {
      type: 'function' as const,
      function: {
        name: 'persistir_documento',
        description: 'CRÍTICO: Salva CPF/CNPJ do cliente no sistema. CHAME ESTA FUNÇÃO IMEDIATAMENTE quando cliente fornecer documento, ANTES de chamar consultar_faturas ou qualquer outra função que necessite do CPF.',
        parameters: {
          type: 'object',
          properties: {
            cpf_cnpj: {
              type: 'string',
              description: 'CPF ou CNPJ do cliente (pode ter formatação ou não - ex: "12345678900" ou "123.456.789-00")',
            },
          },
          required: ['cpf_cnpj'],
        },
      },
    };
    
    // Adicionar nova tool ao array existente
    const updatedTools = [...currentAssistant.tools, newTool];
    
    console.log('🔧 Atualizando assistant com nova tool...');
    await openai.beta.assistants.update(assistantId, {
      tools: updatedTools
    });
    
    console.log('✅ Tool persistir_documento adicionada com sucesso!');
    console.log(`📦 Total de tools agora: ${updatedTools.length}`);
    
  } catch (error) {
    console.error('❌ Erro ao adicionar tool:', error);
    process.exit(1);
  }
}

addPersistirDocumentoTool();
