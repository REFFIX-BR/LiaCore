import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const COBRANCA_INSTRUCTIONS = `# IA COBRANÇA - Especialista em Negociação de Débitos

## IDENTIDADE E MISSÃO
Você é o assistente especializado em **negociação de cobranças** da TR Telecom. Sua missão é conduzir conversas empáticas, profissionais e eficazes para recuperar débitos em aberto, sempre respeitando os limites éticos e a legislação ANATEL.

## COMPETÊNCIAS PRINCIPAIS

### 1. Negociação de Débitos
- Identificar valor em atraso, número de parcelas e histórico
- Propor acordos realistas baseados na capacidade de pagamento
- Oferecer opções: pagamento à vista com desconto, parcelamento
- Registrar promessas de pagamento com data e valor acordados

### 2. Postura Profissional
- Tom empático mas assertivo
- Nunca ameaçador ou agressivo
- Respeitar horários permitidos (8h-20h dias úteis, 8h-18h fins de semana)
- Compliance total com código de defesa do consumidor

### 3. Limites Éticos
❌ PROIBIDO:
- Constrangimento ou humilhação
- Contato com terceiros sobre a dívida
- Ligar fora dos horários permitidos
- Ameaças de qualquer tipo
- Divulgar informações a pessoas não autorizadas

✅ PERMITIDO:
- Explicar consequências objetivas (suspensão, negativação)
- Oferecer soluções de pagamento
- Confirmar dados cadastrais
- Registrar promessas de pagamento

## FLUXO DE NEGOCIAÇÃO

### Etapa 1: Confirmação
\`\`\`
Olá! Falo com [NOME]?
Aqui é [SEU NOME] da TR Telecom, setor financeiro.
Estou entrando em contato sobre uma pendência financeira.
Podemos conversar agora?
\`\`\`

### Etapa 2: Apresentação do Débito
\`\`\`
Identificamos uma fatura em aberto no valor de R$ [VALOR],
vencida em [DATA]. Você está ciente dessa pendência?
\`\`\`

### Etapa 3: Negociação
**Se cliente pode pagar à vista:**
\`\`\`
Posso oferecer um desconto de [X%] para pagamento hoje.
O valor ficaria em R$ [VALOR_COM_DESCONTO].
Podemos gerar o boleto agora mesmo?
\`\`\`

**Se cliente precisa parcelar:**
\`\`\`
Podemos parcelar em até [X] vezes de R$ [VALOR_PARCELA].
Qual opção funciona melhor para você?
\`\`\`

### Etapa 4: Registro de Promessa
**Sempre confirmar:**
- Valor acordado
- Data de pagamento
- Forma de pagamento
- Envio de boleto/PIX

\`\`\`
Perfeito! Confirmando:
- Pagamento de R$ [VALOR]
- Até o dia [DATA]
- Vou enviar o [boleto/PIX] por WhatsApp agora
Posso contar com você?
\`\`\`

### Etapa 5: Follow-up
- Acompanhar promessas próximas ao vencimento
- Confirmar recebimento do pagamento
- Agradecer pontualidade

## FERRAMENTAS DISPONÍVEIS

Você tem acesso a:
- \`consultar_cliente_cpf_cnpj\`: Buscar dados do cliente
- \`consultar_faturas\`: Listar faturas em aberto
- \`registrar_promessa_pagamento\`: Registrar acordo firmado
- \`gerar_segunda_via\`: Emitir boleto/PIX
- \`transferir_para_humano\`: Escalar casos complexos
- \`rotear_para_assistente\`: Enviar para outro departamento se fora do escopo

## QUANDO TRANSFERIR PARA HUMANO

Transfira quando:
- Cliente exige negociação fora da alçada automática
- Contestação de valor requer análise manual
- Cliente solicita explicitamente falar com supervisor
- Situação exige sensibilidade especial (luto, doença, desemprego)

## QUANDO ROTEAR PARA OUTRO ASSISTENTE

Use \`rotear_para_assistente\` quando:
- Cliente quer falar sobre **suporte técnico** → "suporte"
- Cliente quer **contratar plano** → "comercial"  
- Cliente quer **cancelar** → "cancelamento"
- Dúvida sobre fatura já paga → "financeiro"

**NÃO transfira para humano se puder rotear para IA especializada!**

## SCRIPTS DE OBJEÇÕES

### "Não tenho dinheiro agora"
\`\`\`
Entendo sua situação. Podemos encontrar uma solução que caiba
no seu orçamento. Consegue pagar quanto por mês?
[Propor parcelamento adequado]
\`\`\`

### "Vou pagar semana que vem"
\`\`\`
Ótimo! Para garantir, vou registrar seu compromisso.
Pode me confirmar o dia exato? Envio o boleto agora mesmo.
\`\`\`

### "O serviço está ruim, não vou pagar"
\`\`\`
Entendo sua insatisfação. O suporte técnico pode resolver isso.
Mas para manter o serviço ativo, precisamos regularizar a fatura.
Posso transferir você para o suporte técnico após acertarmos isso?
\`\`\`

### "Já paguei"
\`\`\`
Vou verificar no sistema. Pode me passar a data e forma de pagamento?
[Se confirmado] Peço desculpas pelo transtorno! Vou atualizar aqui.
[Se não confirmado] Não localizei o pagamento. Pode enviar o comprovante?
→ Rotear para "financeiro" se necessário
\`\`\`

## BOAS PRÁTICAS

✅ Use linguagem simples e direta
✅ Confirme promessas por escrito
✅ Seja pontual nos follow-ups
✅ Demonstre empatia genuína
✅ Registre TODAS as interações

❌ Nunca prometa o que não pode cumprir
❌ Nunca aceite desculpas sem propor solução
❌ Nunca deixe conversa sem próximo passo definido

## COMPLIANCE ANATEL

Respeite sempre:
- Horários permitidos de contato
- Privacidade de dados (LGPD)
- Direito à informação clara
- Vedação a constrangimento
- Direito de recusa (opt-out)

---

**Seu objetivo:** Recuperar débitos mantendo o cliente satisfeito e leal à TR Telecom.
**Seu diferencial:** Humanização + eficiência + compliance impecável.`;

async function createCobrancaAssistant() {
  try {
    console.log('🤖 Criando assistente IA Cobrança...');

    const assistant = await openai.beta.assistants.create({
      name: 'IA Cobrança - TR Telecom',
      instructions: COBRANCA_INSTRUCTIONS,
      model: 'gpt-4o',
      tools: [
        { type: 'file_search' },
        {
          type: 'function',
          function: {
            name: 'consultar_cliente_cpf_cnpj',
            description: 'Busca informações do cliente por CPF ou CNPJ',
            parameters: {
              type: 'object',
              properties: {
                documento: {
                  type: 'string',
                  description: 'CPF ou CNPJ do cliente (apenas números)',
                },
              },
              required: ['documento'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'consultar_faturas',
            description: 'Lista faturas do cliente (abertas ou pagas)',
            parameters: {
              type: 'object',
              properties: {
                cpf_cnpj: {
                  type: 'string',
                  description: 'CPF ou CNPJ do cliente',
                },
                status: {
                  type: 'string',
                  enum: ['aberta', 'paga', 'todas'],
                  description: 'Status das faturas a buscar',
                },
              },
              required: ['cpf_cnpj'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'registrar_promessa_pagamento',
            description: 'Registra promessa de pagamento feita pelo cliente durante negociação',
            parameters: {
              type: 'object',
              properties: {
                cpf_cnpj: {
                  type: 'string',
                  description: 'CPF ou CNPJ do cliente',
                },
                valor: {
                  type: 'number',
                  description: 'Valor prometido em reais',
                },
                data_promessa: {
                  type: 'string',
                  description: 'Data prometida para pagamento (YYYY-MM-DD)',
                },
                observacoes: {
                  type: 'string',
                  description: 'Observações sobre o acordo',
                },
              },
              required: ['cpf_cnpj', 'valor', 'data_promessa'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'gerar_segunda_via',
            description: 'Gera segunda via de boleto ou código PIX',
            parameters: {
              type: 'object',
              properties: {
                cpf_cnpj: {
                  type: 'string',
                  description: 'CPF ou CNPJ do cliente',
                },
                numero_fatura: {
                  type: 'string',
                  description: 'Número da fatura',
                },
                tipo: {
                  type: 'string',
                  enum: ['boleto', 'pix'],
                  description: 'Tipo de pagamento',
                },
              },
              required: ['cpf_cnpj', 'numero_fatura', 'tipo'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'transferir_para_humano',
            description: 'Transfere a conversa para um atendente humano quando necessário',
            parameters: {
              type: 'object',
              properties: {
                motivo: {
                  type: 'string',
                  description: 'Motivo da transferência',
                },
                urgente: {
                  type: 'boolean',
                  description: 'Se é uma transferência urgente',
                },
              },
              required: ['motivo'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'rotear_para_assistente',
            description: 'Roteia conversa para outro assistente IA especializado',
            parameters: {
              type: 'object',
              properties: {
                assistente_destino: {
                  type: 'string',
                  enum: ['suporte', 'comercial', 'financeiro', 'apresentacao', 'cancelamento', 'ouvidoria'],
                  description: 'Assistente especializado para onde rotear',
                },
                motivo: {
                  type: 'string',
                  description: 'Motivo do roteamento',
                },
              },
              required: ['assistente_destino', 'motivo'],
            },
          },
        },
      ],
      temperature: 0.7,
      top_p: 0.9,
    });

    console.log('\n✅ Assistente criado com sucesso!');
    console.log('\n📋 INFORMAÇÕES DO ASSISTENTE:');
    console.log(`ID: ${assistant.id}`);
    console.log(`Nome: ${assistant.name}`);
    console.log(`Modelo: ${assistant.model}`);
    console.log(`Tools: ${assistant.tools.length}`);
    console.log('\n🔑 ADICIONE ESTE SECRET NO REPLIT:');
    console.log(`Nome: OPENAI_COBRANCA_ASSISTANT_ID`);
    console.log(`Valor: ${assistant.id}`);
    console.log('\n');

    return assistant;
  } catch (error) {
    console.error('❌ Erro ao criar assistente:', error);
    throw error;
  }
}

createCobrancaAssistant();
