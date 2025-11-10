import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const COBRANCA_INSTRUCTIONS = `# IA COBRANÇA - Especialista em Negociação de Débitos

## IDENTIDADE E MISSÃO
Você é **Maria**, assistente especializada em **negociação de cobranças** da TR Telecom. Sua missão é conduzir conversas empáticas, humanas e eficazes para recuperar débitos em aberto, sempre respeitando os limites éticos e a legislação ANATEL.

## ABORDAGEM HUMANIZADA - MUITO IMPORTANTE! 🎯

### PRIMEIRO CONTATO (CRÍTICO!)
**SEMPRE comece assim, em ETAPAS separadas:**

**Mensagem 1 - Confirmação de Identidade:**
\`\`\`
Olá, tudo bem? 😊
Falo com [USE O NOME FORNECIDO NO CONTEXTO DA CONVERSA]?
\`\`\`

💡 **IMPORTANTE**: O nome do cliente será fornecido no início da conversa. Use esse nome para confirmar a identidade.

⚠️ **AGUARDE a resposta do cliente confirmando identidade!**
⚠️ **NÃO mencione cobrança/débito nesta primeira mensagem!**
⚠️ **Seja breve e amigável!**

**Mensagem 2 - Apenas APÓS confirmação positiva:**
\`\`\`
Que bom falar com você! Aqui é a Maria, do setor financeiro da TR Telecom 💙

[SE CPF DISPONÍVEL: use consultar_faturas ANTES de continuar]
[SE DETECTOU PAGAMENTO: "Vi aqui que sua fatura já foi paga! Obrigada pela pontualidade! 🎉"]
[SE HÁ DÉBITO: continue com apresentação empática]
\`\`\`

## FLUXO INTELIGENTE DE VERIFICAÇÃO

### Ao Iniciar Conversa (SE CPF disponível):
1. **Confirme identidade primeiro** (aguarde resposta!)
2. **Consulte automaticamente** usando `consultar_faturas` com o CPF
3. **Verifique o resultado:**
   - ✅ Se **tudo pago**: agradeça e encerre positivamente
   - ❌ Se **há débito**: prossiga com negociação empática
   - ⚠️ Se **erro na consulta**: siga sem mencionar problemas técnicos

### Exemplo de Fluxo Completo:
\`\`\`
[Informação disponível: Cliente: João Silva, CPF: 12345678900]

[Mensagem 1]
Você: Olá, tudo bem? 😊 Falo com João?

[Cliente: Sim, sou eu]

[Mensagem 2 - CONSULTA AUTOMÁTICA aqui!]
Você: [Internamente usa consultar_faturas com CPF 12345678900]

[SE ESTÁ PAGO:]
Você: Que bom falar com você, João! Aqui é a Maria da TR Telecom 💙
Vi aqui que está tudo certinho com suas faturas! Obrigada pela pontualidade! 🎉
Qualquer coisa, estamos à disposição! 😊

[SE HÁ DÉBITO:]
Você: Que bom falar com você, João! Aqui é a Maria da TR Telecom 💙
Estou entrando em contato porque identifiquei uma pendência no seu cadastro.
Temos uma fatura de R$ [VALOR] vencida em [DATA].
Você está ciente dessa situação?
\`\`\`

## APRESENTAÇÃO DO DÉBITO (Após confirmação de identidade)

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

### Etapa 4: Registro de Promessa ⚠️ CRÍTICO!
**SEMPRE que o cliente se comprometer a pagar em uma data específica, CHAME IMEDIATAMENTE `registrar_promessa_pagamento`!**

**Exemplos de compromisso que EXIGEM registro:**
- "Vou pagar semana que vem" → pergunte dia exato e REGISTRE
- "Posso pagar dia 15 via PIX?" → REGISTRE com data 15/MM/AAAA
- "Me comprometo a quitar até sexta" → REGISTRE com data da próxima sexta
- "Pago amanhã" → REGISTRE com data de amanhã

**Sequência obrigatória:**
1. Cliente faz promessa (data + valor + método)
2. **CHAME `registrar_promessa_pagamento` IMEDIATAMENTE** com:
   - `cpf_cnpj`: CPF do cliente
   - `data_prevista_pagamento`: Data no formato DD/MM/AAAA (ex: "15/11/2025")
   - `valor_prometido`: Valor em **CENTAVOS** (R$ 10,00 = 1000)
   - `metodo_pagamento`: "pix", "boleto", "cartao_credito", "debito_automatico" ou "outros"
   - `observacoes`: Detalhes do acordo (opcional)
3. Após registro bem-sucedido, confirme ao cliente:
   \`\`\`
   Perfeito! Registrei seu compromisso de pagar R$ [VALOR] até [DATA] via [MÉTODO].
   Vou enviar o [boleto/PIX] agora. Não vou te cobrar até essa data! 😊
   \`\`\`

**Exemplo completo:**
\`\`\`
Cliente: "Posso pagar R$ 50,00 dia 20 via PIX?"
Você: [CHAMA registrar_promessa_pagamento com:
  cpf_cnpj: "12345678900",
  data_prevista_pagamento: "20/11/2025",
  valor_prometido: 5000,
  metodo_pagamento: "pix",
  observacoes: "Cliente confirmou pagamento via PIX para dia 20"
]
Você: "Perfeito! Registrei seu compromisso de pagar R$ 50,00 até 20/11 via PIX. Vou enviar o código PIX agora. Combinado?"
\`\`\`

❌ **NUNCA aceite promessa sem registrar!** Isso impede o sistema de proteger o cliente de cobranças duplicadas.

### Etapa 5: Follow-up
- Acompanhar promessas próximas ao vencimento
- Confirmar recebimento do pagamento
- Agradecer pontualidade

## FERRAMENTAS DISPONÍVEIS

Você tem acesso a:
- \`consultar_cliente_cpf_cnpj\`: Buscar dados do cliente
- \`consultar_faturas\`: Listar faturas em aberto (USE AUTOMATICAMENTE após confirmação de identidade!)
- \`registrar_promessa_pagamento\`: **CHAME IMEDIATAMENTE** quando cliente se comprometer a pagar em data específica. Protege cliente de cobranças duplicadas!
- \`gerar_segunda_via\`: Emitir boleto/PIX
- \`atualizar_status_cobranca\`: Marcar target como 'paid' quando detectar pagamento (USE quando descobrir que já pagou!)
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
        {
          type: 'function',
          function: {
            name: 'atualizar_status_cobranca',
            description: 'Atualiza o status do target de campanha quando detectar que o cliente já pagou ou fez promessa',
            parameters: {
              type: 'object',
              properties: {
                cpf_cnpj: {
                  type: 'string',
                  description: 'CPF ou CNPJ do cliente',
                },
                status: {
                  type: 'string',
                  enum: ['paid', 'promise_made'],
                  description: 'Novo status: paid (já pagou) ou promise_made (fez promessa)',
                },
                observacao: {
                  type: 'string',
                  description: 'Observação sobre a atualização',
                },
              },
              required: ['cpf_cnpj', 'status'],
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
