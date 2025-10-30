import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ContextAlert {
  alertType: string;
  severity: string;
  description: string;
  conversationId: string;
  metadata?: Record<string, any>;
}

interface PromptSuggestion {
  assistantType: string;
  problemSummary: string;
  rootCause: string;
  suggestedFix: string;
  exampleBefore: string;
  exampleAfter: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Gera sugestões de correção de prompt baseadas nos alertas de contexto
 */
export async function generatePromptSuggestions(
  alerts: ContextAlert[],
  assistantType: string,
  currentPrompt?: string
): Promise<PromptSuggestion> {
  
  // Agrupar alertas por tipo
  const alertsByType = alerts.reduce((acc, alert) => {
    acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Identificar problema mais frequente
  const mostFrequentType = Object.entries(alertsByType)
    .sort(([, a], [, b]) => b - a)[0];

  const [problemType, count] = mostFrequentType || ['unknown', 0];

  // Pegar exemplos de alertas desse tipo
  const exampleAlerts = alerts
    .filter(a => a.alertType === problemType)
    .slice(0, 3)
    .map(a => a.description);

  const prompt = `Você é um especialista em engenharia de prompts para assistentes de IA em atendimento ao cliente.

**CONTEXTO:**
Assistente: ${assistantType}
Problema Detectado: ${problemType}
Frequência: ${count} ocorrências
Prompt Atual: ${currentPrompt ? `\n${currentPrompt.substring(0, 500)}...` : 'Não fornecido'}

**EXEMPLOS DE PROBLEMAS DETECTADOS:**
${exampleAlerts.map((desc, i) => `${i + 1}. ${desc}`).join('\n')}

**SUA MISSÃO:**
Analise os problemas detectados e gere uma sugestão ESPECÍFICA e PRÁTICA de correção do prompt.

**RETORNE UM JSON com esta estrutura EXATA:**
{
  "problemSummary": "Resumo claro do problema em 1 linha",
  "rootCause": "Causa raiz do problema (por que está acontecendo)",
  "suggestedFix": "Texto específico para adicionar/modificar no prompt (máximo 300 palavras, direto ao ponto)",
  "exampleBefore": "Exemplo de como o assistente responde INCORRETAMENTE agora",
  "exampleAfter": "Exemplo de como DEVERIA responder após a correção",
  "priority": "high" | "medium" | "low"
}

**DIRETRIZES IMPORTANTES:**
1. A correção deve ser ESPECÍFICA para o tipo de problema detectado
2. Use linguagem CLARA e IMPERATIVA (ex: "SEMPRE revise...", "NUNCA peça...")
3. Inclua exemplos práticos no suggestedFix
4. O texto deve ser pronto para copiar e colar no prompt
5. Seja conciso mas completo

**TIPOS DE PROBLEMA E SUAS CORREÇÕES:**

**duplicate_data_request:**
- Causa: Assistente não consulta histórico antes de perguntar
- Correção: Adicionar regra para SEMPRE revisar histórico antes de pedir dados

**ignored_history:**
- Causa: Assistente não lê mensagens anteriores
- Correção: Adicionar obrigação de ler todo histórico antes de cada resposta

**duplicate_routing:**
- Causa: Lógica de roteamento mal configurada
- Correção: Adicionar verificação de roteamentos anteriores

**context_reset:**
- Causa: Assistente alega não ter informações quando tem
- Correção: Proibir frases como "não tenho informações" quando há histórico

Retorne APENAS o JSON, sem markdown ou explicações extras.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em engenharia de prompts. Retorne apenas JSON válido, sem markdown.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No content in response');
    }

    const suggestion = JSON.parse(content);
    
    return {
      assistantType,
      problemSummary: suggestion.problemSummary,
      rootCause: suggestion.rootCause,
      suggestedFix: suggestion.suggestedFix,
      exampleBefore: suggestion.exampleBefore,
      exampleAfter: suggestion.exampleAfter,
      priority: suggestion.priority || 'medium'
    };

  } catch (error) {
    console.error('❌ [Prompt Suggestions] Error generating suggestion:', error);
    
    // Fallback: sugestões pré-definidas
    return generateFallbackSuggestion(problemType, assistantType, count);
  }
}

/**
 * Gera sugestões fallback caso a API falhe
 */
function generateFallbackSuggestion(
  problemType: string,
  assistantType: string,
  count: number
): PromptSuggestion {
  
  const suggestions: Record<string, PromptSuggestion> = {
    duplicate_data_request: {
      assistantType,
      problemSummary: `Assistente pedindo dados que cliente já forneceu (${count} ocorrências)`,
      rootCause: 'O assistente não está consultando o histórico da conversa antes de perguntar informações',
      suggestedFix: `⚠️ REGRA CRÍTICA - REVISAR HISTÓRICO ANTES DE PERGUNTAR DADOS:

ANTES de perguntar CPF, CNPJ, nome, email ou qualquer informação pessoal:
1. REVISE COMPLETAMENTE o histórico da conversa
2. PROCURE se o cliente JÁ forneceu essa informação
3. SE ENCONTROU no histórico → USE diretamente, NÃO pergunte novamente
4. APENAS pergunte se NÃO ENCONTROU no histórico

✅ EXEMPLO CORRETO:
Cliente: "Quero segunda via do boleto"
Assistente: "Vi que você já informou o CPF 123.456.789-00 anteriormente. Vou consultar seu boleto agora."

❌ EXEMPLO ERRADO:
Cliente: "Quero segunda via do boleto"  
Assistente: "Qual seu CPF?" (mesmo tendo no histórico)`,
      exampleBefore: 'Cliente: "Quero segunda via"\nAssistente: "Qual seu CPF?" (já foi informado)',
      exampleAfter: 'Cliente: "Quero segunda via"\nAssistente: "Vi seu CPF 123.456.789-00. Consultando boleto..."',
      priority: 'high'
    },
    
    ignored_history: {
      assistantType,
      problemSummary: `Assistente ignorando informações já discutidas (${count} ocorrências)`,
      rootCause: 'O assistente não está revisando o contexto completo da conversa antes de responder',
      suggestedFix: `⚠️ REGRA OBRIGATÓRIA - SEMPRE REVISAR TODO O HISTÓRICO:

ANTES de cada resposta:
1. LEIA TODAS as mensagens anteriores da conversa
2. IDENTIFIQUE o que já foi discutido e decidido
3. NUNCA repita informações já abordadas
4. NUNCA insista em algo que o cliente já recusou

✅ EXEMPLO CORRETO:
Cliente: "Não quero cancelar, só quero mudar o plano"
Assistente: "Entendido! Vou te ajudar com a mudança de plano. Quais planos te interessam?"

❌ EXEMPLO ERRADO:
Cliente: "Não quero cancelar"
Assistente: "Posso ajudar com o cancelamento" (ignorou o que cliente disse)`,
      exampleBefore: 'Cliente: "Não quero cancelar"\nAssistente: "Vamos prosseguir com o cancelamento"',
      exampleAfter: 'Cliente: "Não quero cancelar"\nAssistente: "Entendido! Como posso ajudar então?"',
      priority: 'high'
    },
    
    duplicate_routing: {
      assistantType,
      problemSummary: `Roteamentos duplicados para o mesmo assistente (${count} ocorrências)`,
      rootCause: 'O assistente está roteando múltiplas vezes para o mesmo setor',
      suggestedFix: `⚠️ REGRA DE ROTEAMENTO - EVITAR DUPLICAÇÕES:

ANTES de rotear para outro assistente:
1. VERIFIQUE no histórico se já foi roteado para esse mesmo assistente
2. SE já foi roteado para lá → NÃO rotear novamente
3. SE precisa rotear novamente → significa que VOCÊ não consegue resolver
4. NESSE CASO → TRANSFERIR PARA ATENDENTE HUMANO

✅ EXEMPLO CORRETO:
[Cliente já foi para Financeiro antes]
Assistente: "Vejo que você já conversou com o setor Financeiro. Vou transferir você para um atendente humano que pode ajudar melhor."

❌ EXEMPLO ERRADO:
[Cliente já foi para Financeiro antes]
Assistente: "Vou transferir você para o Financeiro" (novamente)`,
      exampleBefore: 'Roteia para Financeiro → Cliente volta → Roteia para Financeiro de novo',
      exampleAfter: 'Roteia para Financeiro → Cliente volta → Transfere para humano',
      priority: 'medium'
    },
    
    context_reset: {
      assistantType,
      problemSummary: `Assistente alegando não ter informações quando tem histórico (${count} ocorrências)`,
      rootCause: 'O assistente está perdendo o contexto da conversa',
      suggestedFix: `⚠️ REGRA FUNDAMENTAL - NUNCA NEGAR HISTÓRICO EXISTENTE:

NUNCA diga frases como:
❌ "Não tenho suas informações"
❌ "Não tenho histórico"
❌ "Você não me passou dados"
❌ "Preciso que você me informe tudo novamente"

SE você precisa de um dado específico que NÃO está no histórico:
✅ "Vi nosso histórico de conversa. Para continuar, só preciso confirmar [dado específico]"
✅ "Tenho aqui que você informou [X e Y]. Só falta confirmar [Z]"

✅ EXEMPLO CORRETO:
[Após 15 mensagens]
Assistente: "Vi todo nosso histórico. Tenho seu CPF e endereço. Só preciso confirmar o número da instalação para prosseguir."

❌ EXEMPLO ERRADO:
[Após 15 mensagens]
Assistente: "Não tenho suas informações. Pode me passar seus dados novamente?"`,
      exampleBefore: '[20 mensagens depois]\nAssistente: "Não tenho suas informações"',
      exampleAfter: '[20 mensagens depois]\nAssistente: "Tenho seu histórico. Só preciso de [dado X]"',
      priority: 'high'
    }
  };

  return suggestions[problemType] || {
    assistantType,
    problemSummary: `Problema de qualidade de contexto detectado (${count} ocorrências)`,
    rootCause: 'Problema não categorizado',
    suggestedFix: 'Revise o prompt do assistente e adicione instruções para sempre consultar o histórico completo antes de responder.',
    exampleBefore: 'Comportamento atual problemático',
    exampleAfter: 'Comportamento esperado após correção',
    priority: 'medium'
  };
}
