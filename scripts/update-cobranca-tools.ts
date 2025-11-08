import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const assistantId = process.env.OPENAI_COBRANCA_ASSISTANT_ID;

if (!assistantId) {
  console.error('❌ OPENAI_COBRANCA_ASSISTANT_ID não configurado!');
  process.exit(1);
}

async function updateTools() {
  try {
    console.log('🔧 Atualizando ferramentas do IA Cobrança...\n');
    
    // Buscar configuração atual
    const current = await openai.beta.assistants.retrieve(assistantId);
    
    // Atualizar apenas a ferramenta registrar_promessa_pagamento
    const updatedTools = current.tools.map(tool => {
      if (tool.type === 'function' && tool.function.name === 'registrar_promessa_pagamento') {
        return {
          type: 'function' as const,
          function: {
            name: 'registrar_promessa_pagamento',
            description: 'CRÍTICO: Registra promessa de pagamento para proteger cliente de cobranças duplicadas. CHAME IMEDIATAMENTE quando cliente se comprometer a pagar em data específica.',
            parameters: {
              type: 'object',
              properties: {
                cpf_cnpj: {
                  type: 'string',
                  description: 'CPF ou CNPJ do cliente (apenas números, sem pontos ou traços)',
                },
                valor_prometido: {
                  type: 'number',
                  description: 'Valor prometido em CENTAVOS (ex: R$ 10,00 = 1000). Sempre multiplique o valor em reais por 100.',
                },
                data_prevista_pagamento: {
                  type: 'string',
                  description: 'Data prometida no formato DD/MM/AAAA (ex: "15/11/2025"). Converta datas relativas: "amanhã" → calcule data; "sexta" → próxima sexta-feira.',
                },
                metodo_pagamento: {
                  type: 'string',
                  description: 'Método de pagamento: "pix", "boleto", "cartao_credito", "debito_automatico" ou "outros"',
                },
                observacoes: {
                  type: 'string',
                  description: 'Observações sobre o acordo (opcional): detalhes da negociação, condições especiais, etc.',
                },
              },
              required: ['cpf_cnpj', 'valor_prometido', 'data_prevista_pagamento', 'metodo_pagamento'],
            },
          },
        };
      }
      return tool;
    });
    
    // Atualizar assistente com os tools corrigidos
    const updated = await openai.beta.assistants.update(assistantId, {
      tools: updatedTools
    });
    
    console.log('✅ Ferramentas atualizadas com sucesso!\n');
    console.log(`🔧 Total de ferramentas: ${updated.tools.length}`);
    console.log('\n🎯 A função registrar_promessa_pagamento agora tem os parâmetros corretos!');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar:', error);
    throw error;
  }
}

updateTools();
