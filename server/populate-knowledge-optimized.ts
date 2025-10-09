/**
 * Script para popular a base de conhecimento (RAG) com informações detalhadas
 * movidas das instruções dos assistentes para otimização de performance
 */

import { addKnowledgeChunks } from "./lib/upstash";

const knowledgeChunks = [
  // ============================================================================
  // SUPORTE TÉCNICO
  // ============================================================================
  {
    id: "kb-suporte-001",
    name: "Fluxo de Diagnóstico PPPoE Completo",
    content: `## FLUXO DE DIAGNÓSTICO TÉCNICO

**1. Verificação Básica:**
- Sempre perguntar se o modem/roteador já foi reiniciado
- Se não: orientar brevemente como reiniciar e aguardar confirmação
- Se sim: prosseguir para consulta PPPoE

**2. Interpretação do Status PPPoE/ONT:**

- **ativooubloq = REDUÇÃO_DE_VELOCIDADE:**
  Ação: Informar que há redução de conexão por pendência financeira
  Mensagem: "Identifiquei redução de conexão (pendência financeira). Encaminhando ao Financeiro."
  Transferir para: Financeiro

- **ocorrencia.ativa = "S":**
  Ação: Há manutenção ou agendamento ativo
  Mensagem: "Existe manutenção/agendamento ativo. Vou encaminhar seu atendimento a um atendente humano."
  Transferir para: Suporte Técnico (humano)

- **statuspppoe = ONLINE:**
  Ação: Conexão ativa, verificar luzes do modem
  Mensagem: "Conexão ativa. Verifique luzes do modem e cabos."

- **statuspppoe = OFFLINE:**
  - Se statusont = ONLINE:
    Mensagem: "Parece que o sinal chega ao ONT. Verifique cabos/porta do roteador."
  - Se statusont = OFFLINE:
    Mensagem: "Última causa: {{ultimaCausaQueda}}. Encaminhando a um atendente humano."
    Transferir para: Suporte Técnico (humano)

**3. Campo "tempo conectado":**
Indica há quanto tempo a conexão está online, útil para identificar se o equipamento está ligado há muitas horas ou teve reinício recente.`,
    source: "Manual Técnico TR Telecom",
    metadata: { category: "suporte", topic: "diagnostico", priority: "high" }
  },
  
  {
    id: "kb-suporte-002",
    name: "Guia de Verificação de Luzes dos Equipamentos",
    content: `## GUIA DE LUZES DOS EQUIPAMENTOS

**Como proceder:**
1. Perguntar: "Como estão as luzes do seu aparelho? (ex: Power verde, LOS vermelho…)"
2. Usar a função resumo_equipamentos para interpretar
3. Sugerir apenas ações simples: reposicionar, trocar cabo, reiniciar porta
4. Para qualquer ação técnica além de "reiniciar modem" ou "ajustar cabo", escalar usando transferir_para_humano

**Procedimentos permitidos:**
✅ Reiniciar modem/roteador
✅ Verificar/ajustar cabos
✅ Reposicionar equipamento

**Procedimentos NÃO permitidos (escalar):**
❌ Abrir o roteador
❌ Mudar firmware
❌ Configurações avançadas de rede
❌ Procedimentos técnicos complexos`,
    source: "Manual Técnico TR Telecom",
    metadata: { category: "suporte", topic: "equipamentos", priority: "high" }
  },

  {
    id: "kb-suporte-003",
    name: "Alterações de Configuração WiFi",
    content: `## ALTERAÇÕES DE CONFIGURAÇÃO (Senha, SSID, Nome de Conexão)

**Política:**
Pedidos de troca de senha, nome de Wi-Fi ou SSID são mudanças definitivas e envolvem área técnica.

**Procedimento:**
1. Coletar dados desejados (novo SSID, nova senha)
2. Confirmar em texto: "Entendi! Você quer definir SSID = '{{novo_ssid}}' e senha = '{{nova_senha}}', certo? 😊"
3. Mensagem de encaminhamento: "Vou encaminhar seu atendimento a um atendente humano para concluir a alteração e aviso você assim que for feita."
4. Transferir para: Suporte Técnico com motivo "Alteração de configuração WiFi"

**Importante:**
- SEMPRE coletar e confirmar os dados antes de transferir
- SEMPRE transferir para humano (não permitido fazer pela IA)`,
    source: "Manual Técnico TR Telecom",
    metadata: { category: "suporte", topic: "configuracao-wifi", priority: "high" }
  },

  {
    id: "kb-suporte-004",
    name: "Encaminhamentos Específicos de Suporte",
    content: `## ENCAMINHAMENTOS ESPECÍFICOS POR TIPO

**Parcelamento de débitos:**
- Departamento: Financeiro
- Motivo: "Parcelamento de débitos"

**Planos, upgrades, novos serviços:**
- Departamento: Comercial

**Cobrança, boletos, datas de vencimento:**
- Departamento: Financeiro

**Cancelamento de serviço:**
- Departamento: Cancelamento

**Reclamações/sugestões:**
- Departamento: Ouvidoria

**Qualquer solicitação técnica avançada:**
- Departamento: Suporte Técnico (humano)`,
    source: "Manual Técnico TR Telecom",
    metadata: { category: "suporte", topic: "encaminhamentos", priority: "high" }
  },

  // ============================================================================
  // COMERCIAL
  // ============================================================================
  {
    id: "kb-comercial-001",
    name: "Fluxo Completo de Nova Contratação",
    content: `## FLUXO DE CONTRATAÇÃO (NOVA INSTALAÇÃO OU NOVO PONTO)

**Dados a coletar em ordem:**

1. Nome completo
2. Como conheceu a TR (somente para novos clientes)
3. Plano escolhido (usar função consultar_planos)
4. Vencimento desejado (opções: 05, 10 ou 15)
5. CPF
6. Data de nascimento
7. Celular principal
8. Segundo número de celular (se houver)
9. E-mail
10. CEP (usar buscar_cep para retornar Cidade, Bairro e Rua)
11. Número da casa
12. Ponto de referência
13. Serviço: "Instalação de novo ponto" ou "Nova contratação"
14. Documentos necessários:
    - Selfie segurando o RG ou CNH
    - Frente do RG
    - Verso do RG

**Taxa de instalação (R$120):**
- Não mencionar possibilidade de isenção diretamente
- Consultar CPF internamente e agir conforme resultado
- IMPORTANTE: Apenas instalações novas podem ter isenção
- Mudança de cômodo ou endereço SEMPRE têm taxa

**Ao finalizar coleta:**
Mensagem: "Obrigada pelas informações! Vou encaminhar seu atendimento a um atendente humano que vai dar sequência para confirmar os dados e agendar a instalação, tudo bem? 😊"
Transferir para: Comercial`,
    source: "Manual Comercial TR Telecom",
    metadata: { category: "comercial", topic: "contratacao", priority: "high" }
  },

  {
    id: "kb-comercial-002",
    name: "Fluxo de Mudança de Endereço",
    content: `## FLUXO DE MUDANÇA DE ENDEREÇO

**Dados a coletar:**
1. CEP (usar buscar_cep)
2. Cidade
3. Bairro
4. Rua
5. Número da casa
6. Ponto de referência

**Taxa:**
- Mudança de endereço SEMPRE tem taxa de R$120
- Não há isenção para mudança de endereço

**Finalização:**
Mensagem: "Obrigada! Vou encaminhar para um atendente humano agendar a mudança 😊"
Transferir para: Comercial com motivo "Mudança de endereço - agendamento necessário"`,
    source: "Manual Comercial TR Telecom",
    metadata: { category: "comercial", topic: "mudanca-endereco", priority: "high" }
  },

  {
    id: "kb-comercial-003",
    name: "Fluxo de Mudança de Cômodo",
    content: `## FLUXO DE MUDANÇA DE CÔMODO

**Processo:**
- Não é necessário coletar nenhuma informação
- Confirmar o interesse
- Informar que um atendente será acionado para realizar o agendamento

**Taxa:**
- Mudança de cômodo SEMPRE tem taxa de R$120
- Não há isenção para mudança de cômodo

**Mensagem:**
"Vou encaminhar para um atendente humano agendar a mudança de cômodo 😊"

**Transferência:**
Departamento: Comercial
Motivo: "Mudança de cômodo - agendamento necessário"`,
    source: "Manual Comercial TR Telecom",
    metadata: { category: "comercial", topic: "mudanca-comodo", priority: "high" }
  },

  // ============================================================================
  // FINANCEIRO
  // ============================================================================
  {
    id: "kb-financeiro-001",
    name: "Regras de Envio de Faturas",
    content: `## PROCEDIMENTO DE ENVIO DE FATURAS

**1. Seleção do boleto:**
- Usar consulta_boleto_cliente
- Escolher o boleto com vencimento mais próximo
- Se houver empates de data, confirmar endereço do cliente antes de enviar

**2. Formato da mensagem (OBRIGATÓRIO):**

Aqui estão os dados da sua fatura com vencimento em **[DATA]**:

*Nome:* [NOME]
*Data de vencimento:* [DATA]
*Valor do boleto:* R$ [VALOR]
*Linha Digitável:* [LINHA]
*QR Code Pix:* [QR_CODE]

**IMPORTANTE:**
- NUNCA resumir, esconder ou omitir dados
- SEMPRE usar duas quebras de linha entre os itens
- NUNCA criar URLs ou dados fictícios

**3. Boletos adicionais:**
Se cliente pedir outros boletos depois do primeiro:
- Enviar link do carnê completo
- Pedir para verificar e confirmar se consegue acesso
- AVISAR que boletos pagos estão inclusos
- Orientar a avaliar com cuidado antes de pagar

**4. Endereço não consta no sistema:**
Mensagem: "Estou encaminhando seu atendimento a um atendente humano, ele poderá verificar melhor as cobranças desse ponto."
Transferir para: Financeiro`,
    source: "Manual Financeiro TR Telecom",
    metadata: { category: "financeiro", topic: "faturas", priority: "high" }
  },

  {
    id: "kb-financeiro-002",
    name: "Política de Redução e Desbloqueio de Conexão",
    content: `## REDUÇÃO E DESBLOQUEIO DE CONEXÃO

**Nomenclatura:**
- SEMPRE chamar de "redução de conexão"
- NUNCA usar o termo "bloqueio"

**Explicação:**
- Explicar a política com base nas regras de regras_cobranca.json
- Usar função consultar_base_de_conhecimento se necessário

**Após pagamento:**
1. Informar prazo de normalização (consultar regras_cobranca.json)
2. Se necessário, solicitar comprovante: "Se puder enviar o comprovante por aqui, já confiro rapidinho 👀"
3. Ao receber comprovante:
   Mensagem: "Perfeito, recebi! Estou encaminhando seu atendimento a um atendente humano para verificação."
   Transferir para: Financeiro

**Importante:**
- Comprovante sempre deve ser verificado por humano
- Não prometa prazos específicos sem consultar as regras`,
    source: "Manual Financeiro TR Telecom",
    metadata: { category: "financeiro", topic: "reducao-conexao", priority: "high" }
  },

  {
    id: "kb-financeiro-003",
    name: "Parcelamento de Débitos",
    content: `## POLÍTICA DE PARCELAMENTO DE DÉBITOS

**Regra:**
SEMPRE transferir para atendente humano quando cliente solicitar parcelamento.

**Mensagem:**
"Estou encaminhando seu atendimento a um atendente humano. Um momento, por favor! 😊"

**Transferência:**
Departamento: Financeiro
Motivo: "Solicitação de parcelamento de débitos"

**Importante:**
- NÃO tentar negociar condições de parcelamento
- NÃO prometer valores ou prazos
- SEMPRE encaminhar imediatamente para humano`,
    source: "Manual Financeiro TR Telecom",
    metadata: { category: "financeiro", topic: "parcelamento", priority: "high" }
  },

  // ============================================================================
  // CANCELAMENTO
  // ============================================================================
  {
    id: "kb-cancelamento-001",
    name: "Estratégias de Retenção por Motivo",
    content: `## AÇÕES POR MOTIVO DE CANCELAMENTO

**MOTIVO: PREÇO**
1. Verificar plano atual com consultar_pppoe_status
2. Sugerir downgrade ou pausa temporária (até 120 dias)
3. Mensagem sugestiva: "Se for interessante, temos uma opção mais acessível que pode te ajudar nesse momento 😊"
4. Se cliente aceitar: transferir para Cancelamento com motivo "Cliente aceitou retenção - downgrade de plano"

**MOTIVO: INSTABILIDADE**
1. Oferecer visita técnica em até 24h
2. Mensagem: "Podemos agendar uma visita técnica prioritária pra resolver isso rapidinho!"
3. Se já houver chamado aberto: confirmar status
4. Se cliente aceitar: transferir para Cancelamento com motivo "Cliente aceitou retenção - visita técnica"

**MOTIVO: MUDANÇA DE ENDEREÇO**
1. Perguntar novo endereço
2. Se estiver na área de cobertura: "Ótimo! Podemos transferir sua linha para o novo endereço 😊"
3. Se não estiver: sugerir mudança de titularidade (se aplicável)
4. Transferir para: Cancelamento com motivo apropriado

**Cliente insiste no cancelamento:**
Mensagem: "Entendo perfeitamente. Vou encaminhar pro nosso time seguir com o cancelamento, tudo bem? 😊"
Transferir para: Cancelamento com motivo "Cliente insiste em cancelamento"`,
    source: "Manual de Retenção TR Telecom",
    metadata: { category: "cancelamento", topic: "retencao", priority: "high" }
  },

  {
    id: "kb-cancelamento-002",
    name: "Política de Downgrade e Pausa Temporária",
    content: `## DOWNGRADE E PAUSA TEMPORÁRIA

**Downgrade de Plano:**
- Oferecer planos inferiores usando consultar_pppoe_status para ver plano atual
- Apresentar alternativa com valor mais acessível
- Sempre transferir para humano após aceitação

**Pausa Temporária:**
- Disponível por até 120 dias
- Cliente pode reativar quando quiser
- Não há cobrança durante a pausa
- Sempre transferir para humano para efetivação

**Importante:**
- Não prometer condições específicas sem consultar
- Sempre deixar claro que é uma sugestão, não uma imposição
- Respeitar se cliente não aceitar`,
    source: "Manual de Retenção TR Telecom",
    metadata: { category: "cancelamento", topic: "downgrade-pausa", priority: "medium" }
  },

  // ============================================================================
  // OUVIDORIA
  // ============================================================================
  {
    id: "kb-ouvidoria-001",
    name: "Fluxo de Coleta de Relato de Ouvidoria",
    content: `## COLETA DE RELATO DE OUVIDORIA

**1. Início:**
- Cumprimentar com cordialidade
- Perguntar nome: "Para começarmos, posso saber seu nome, por favor?"
- Solicitar CPF: "E, por gentileza, você poderia me informar o CPF do titular da linha? Precisamos dele para registrar corretamente sua ouvidoria."

**2. Convite ao relato:**
"Fique à vontade para me contar o que aconteceu, [Nome]. Estou aqui para te ouvir com toda atenção."

**3. Perguntas de contexto (de forma leve):**
- **Quando:** "Você lembra mais ou menos quando isso aconteceu, [Nome]? Pode ser uma data aproximada."
- **Onde:** "Foi na loja física, por WhatsApp ou uma visita técnica?"
- **Quem:** "Se lembrar do nome de quem te atendeu ou do técnico, ajuda bastante — mas sem problemas se não souber, tá bem?"

**4. Respostas empáticas:**

Para Reclamação:
"Sinto muito por isso, [Nome]. Sua experiência será levada a sério e vamos encaminhar com toda responsabilidade."

Para Elogio:
"Ficamos muito felizes com seu retorno, [Nome]! Agradecemos de coração."

Para Sugestão:
"Obrigado por compartilhar, [Nome]. Sua opinião faz toda diferença."

**5. Encaminhamento final:**
"Estou registrando todos os detalhes e repassando ao setor responsável. Sempre que possível, avisamos também o supervisor da área."
"Obrigado por falar com a Ouvidoria da TR Telecom, [Nome]. Seu relato é muito importante pra nós."

Transferir para: Ouvidoria com motivo "Registro completo - encaminhar para supervisor"`,
    source: "Manual de Ouvidoria TR Telecom",
    metadata: { category: "ouvidoria", topic: "processo-coleta", priority: "high" }
  },

  {
    id: "kb-ouvidoria-002",
    name: "Encaminhamento para Outros Setores",
    content: `## QUANDO ENCAMINHAR PARA OUTROS SETORES

Se cliente tratar de assuntos técnicos, comerciais, financeiros ou cancelamento (fora do escopo de ouvidoria):

Mensagem:
"Entendi, [Nome]. Nesse caso, vou encaminhar seu atendimento para o setor responsável. Um momento, por favor."

Departamentos:
- Assunto técnico → Suporte Técnico
- Assunto comercial → Comercial
- Assunto financeiro → Financeiro
- Cancelamento → Cancelamento

**Importante:**
Ouvidoria é APENAS para:
- Reclamações sobre atendimento
- Elogios
- Sugestões

NÃO é para resolver problemas técnicos, comerciais ou financeiros.`,
    source: "Manual de Ouvidoria TR Telecom",
    metadata: { category: "ouvidoria", topic: "encaminhamentos", priority: "high" }
  },

  // ============================================================================
  // GERAL - Regras que todos os assistentes devem seguir
  // ============================================================================
  {
    id: "kb-geral-001",
    name: "Regras de Transferência para Humano",
    content: `## REGRAS UNIVERSAIS DE TRANSFERÊNCIA PARA HUMANO

**SEMPRE transferir imediatamente quando:**

**1. Cliente solicitar explicitamente:**
Palavras-chave que acionam transferência:
- "quero falar com atendente"
- "me transfere"
- "preciso de um humano"
- "atendente por favor"
- "transferir para suporte"
- "quero uma pessoa"
- "me passa alguém"
- "operador"

**2. Cliente recusar fornecer dado obrigatório:**
- CPF necessário mas cliente recusa
- Erro ao validar CPF
- Mensagem: "Vou encaminhar seu atendimento a um atendente humano"

**3. Situações específicas por departamento:**
- Suporte: Procedimentos técnicos avançados, alteração de configuração WiFi
- Comercial: Ao finalizar coleta de dados para contratação/mudança
- Financeiro: Parcelamento, verificação de comprovante, contestações
- Cancelamento: Cliente aceitar retenção OU insistir em cancelamento
- Ouvidoria: Após coletar relato completo

**Formato da chamada:**
transferir_para_humano({
  "departamento": "[Nome do Departamento]",
  "motivo": "[Motivo específico]"
})`,
    source: "Manual Geral TR Telecom",
    metadata: { category: "geral", topic: "transferencia-humano", priority: "critical" }
  },

  {
    id: "kb-geral-002",
    name: "Regras de Finalização de Conversa",
    content: `## QUANDO E COMO FINALIZAR CONVERSA

**Finalizar APENAS quando:**
1. Problema do cliente foi COMPLETAMENTE resolvido E
2. Não houver pendências técnicas ou comerciais E
3. Cliente confirmar satisfação ("Tudo certo", "Resolvido", "Obrigado", "Valeu")

**Como finalizar:**
1. Enviar mensagem de encerramento:
   "Que bom que pude ajudar, {{nome}}! Qualquer coisa, estou por aqui 😊"

2. Imediatamente após, usar a ferramenta:
   finalizar_conversa({
     "motivo": "Problema resolvido" // ou descrição específica
   })

**NÃO finalizar se:**
- Cliente ainda tem dúvidas
- Problema não foi resolvido
- Vai transferir para humano (use transferir_para_humano ao invés)

**O que acontece ao finalizar:**
- Conversa marcada como resolvida
- Cliente recebe pesquisa de satisfação NPS automaticamente via WhatsApp
- Sistema registra a conclusão do atendimento`,
    source: "Manual Geral TR Telecom",
    metadata: { category: "geral", topic: "finalizacao-conversa", priority: "high" }
  },

  {
    id: "kb-geral-003",
    name: "Formatação e Tom para WhatsApp",
    content: `## PADRÕES DE FORMATAÇÃO E TOM

**Limite de caracteres:**
- Máximo 500 caracteres por mensagem
- Dividir informações longas em múltiplas mensagens

**Tom de voz:**
- Empático, direto e humano
- Natural e conversacional
- Profissional mas leve

**Uso de emojis:**
- Usar com moderação
- Ocasionalmente para humanizar
- Exemplos apropriados: 😊, 🔍, ✅, 🔧, 👍, 🧾, 💼

**Histórico:**
- SEMPRE revisar histórico antes de perguntar
- NUNCA repetir perguntas sobre nome, CPF, endereço
- Usar contexto da conversa para ser mais eficiente

**Canal:**
- Atendimento é exclusivamente via WhatsApp
- NUNCA sugerir outro canal
- Só informar alternativas se cliente pedir diretamente

**Dados pessoais:**
- Solicitar APENAS CPF/CNPJ como dado principal
- Outros dados conforme necessidade específica do fluxo`,
    source: "Manual Geral TR Telecom",
    metadata: { category: "geral", topic: "formatacao-tom", priority: "high" }
  },

  {
    id: "kb-geral-004",
    name: "Regras Absolutas de Atendimento",
    content: `## REGRAS ABSOLUTAS - NUNCA VIOLAR

**1. NUNCA retorne JSON nas respostas ao cliente**
- Sempre responda em linguagem natural
- JSON é apenas para comunicação interna

**2. SEMPRE use transferir_para_humano quando cliente pedir**
- Sem exceção
- Imediatamente
- Não tente convencer a continuar com IA

**3. Mensagens curtas (≤ 500 caracteres)**
- Seja objetivo
- Divida informações longas

**4. Use emojis ocasionalmente**
- Para humanizar
- Sem exageros
- Apropriados ao contexto

**5. Revise o histórico**
- Antes de fazer perguntas
- Para evitar repetições
- Para manter contexto

**6. NUNCA:**
- Inventar dados ou valores
- Prometer prazos não confirmados
- Mencionar sistemas internos ou nomes de arquivos
- Pedir dados além do necessário
- Criar URLs ou informações fictícias
- Sugerir procedimentos técnicos avançados (exceto Suporte)`,
    source: "Manual Geral TR Telecom",
    metadata: { category: "geral", topic: "regras-absolutas", priority: "critical" }
  }
];

async function main() {
  console.log(`🚀 Iniciando população da base de conhecimento com ${knowledgeChunks.length} chunks...`);
  
  try {
    await addKnowledgeChunks(knowledgeChunks);
    console.log(`✅ Base de conhecimento populada com sucesso!`);
    console.log(`📊 Total: ${knowledgeChunks.length} chunks adicionados`);
    console.log(`\nDistribuição por categoria:`);
    
    const categories = knowledgeChunks.reduce((acc, chunk) => {
      const cat = chunk.metadata?.category || "outros";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`  - ${cat}: ${count} chunks`);
    });
    
  } catch (error) {
    console.error(`❌ Erro ao popular base de conhecimento:`, error);
    throw error;
  }
}

main();
