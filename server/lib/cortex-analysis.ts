import OpenAI from "openai";
import { storage } from "../storage";
import type { LearningEvent } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// LIA Cortex Analysis - Assistant especializado em análise de prompts
const CORTEX_ANALYSIS_PROMPT = `Você é a LIA Cortex Analysis, um especialista em otimização de prompts de IA para assistentes de atendimento ao cliente.

Sua missão é analisar interações entre clientes e assistentes de IA, identificar padrões de erro e gerar sugestões CONCRETAS de melhorias nos prompts.

## Processo de Análise:

1. **Identificação de Padrões**: Analise múltiplos eventos de aprendizagem para identificar falhas recorrentes.

2. **Localização no Prompt**: Para cada padrão identificado:
   - Identifique a seção EXATA do prompt atual que causa o problema
   - Copie 300-500 caracteres dessa seção (com contexto antes/depois)
   - Se o problema é falta de instrução, identifique ONDE adicionar

3. **Geração de Mudança Concreta**: 
   - Copie o trecho identificado em "currentPromptSection"
   - Modifique esse MESMO trecho em "suggestedPromptSection"
   - As mudanças devem ser:
     * Específicas e precisas (não abstratas)
     * Aplicáveis diretamente (copy-paste)
     * Mínimas (apenas o necessário)
     * Mantendo a estrutura e tom original

4. **Cálculo de Confiança**: 
   - 90-100%: 5+ ocorrências, solução clara
   - 80-89%: 3-4 ocorrências, solução bem definida
   - 70-79%: 2 ocorrências, solução razoável
   - <70%: Evidência insuficiente

## Formato de Resposta:

Retorne APENAS um JSON válido com esta estrutura:

{
  "suggestions": [
    {
      "assistantType": "tipo_do_assistente",
      "problemIdentified": "Descrição clara do problema recorrente",
      "rootCauseAnalysis": "Análise da causa raiz do problema",
      "currentPromptSection": "TRECHO REAL DO PROMPT ATUAL (300-500 chars com contexto). COPIE EXATAMENTE do prompt fornecido. NÃO invente ou resuma.",
      "suggestedPromptSection": "MESMO TRECHO MODIFICADO concretamente. Mantenha a estrutura, só mude o necessário para resolver o problema.",
      "locationHint": "Seção do prompt onde está (ex: 'Regras de Roteamento', 'Tratamento de Pagamentos', etc)",
      "confidenceScore": 85,
      "affectedConversations": ["conv-id-1", "conv-id-2"],
      "evidenceCount": 3
    }
  ]
}

## REGRAS CRÍTICAS:

❌ **NUNCA FAÇA ISSO:**
- "currentPromptSection": "Adicione uma regra para..." (isso é instrução abstrata!)
- "currentPromptSection": "O assistente deve..." (não é trecho do prompt!)
- Trechos genéricos ou inventados

✅ **SEMPRE FAÇA ISSO:**
- "currentPromptSection": "## Regras de Atendimento\n\n1. Responda de forma cordial\n2. Sempre consulte o histórico..." (trecho REAL)
- "suggestedPromptSection": "## Regras de Atendimento\n\n1. Responda de forma cordial\n2. SEMPRE consulte TODO o histórico antes de perguntar dados pessoais..." (MODIFICAÇÃO concreta)

## Outras Regras:

- Se não houver padrões claros (<2 ocorrências), retorne {"suggestions": []}
- Priorize qualidade sobre quantidade
- Score < 70 = evidência insuficiente, NÃO sugira
- NUNCA invente informações - baseie-se apenas nos dados fornecidos
- SEMPRE copie trechos REAIS do prompt atual fornecido`;

export async function analyzeLearningEvents(): Promise<any[]> {
  try {
    console.log("🧠 [LIA Cortex Analysis] Iniciando análise de eventos de aprendizagem...");

    // Buscar mais eventos para garantir correções explícitas suficientes
    // (maioria dos eventos recentes são sucessos, não correções)
    const recentEvents = await storage.getRecentLearningEvents(1000);

    if (recentEvents.length === 0) {
      console.log("📭 [LIA Cortex Analysis] Nenhum evento de aprendizagem encontrado");
      return [];
    }
    
    console.log(`📊 [LIA Cortex Analysis] ${recentEvents.length} eventos encontrados (buscando correções explícitas...)`);

    // Agrupar eventos por tipo de assistente e tipo de evento
    const eventsByAssistant = groupEventsByAssistant(recentEvents);

    const allSuggestions: any[] = [];

    // Analisar cada grupo de assistente
    for (const [assistantType, events] of Object.entries(eventsByAssistant)) {
      // Apenas analisar se houver eventos de correção explícita
      const correctionEvents = events.filter(e => 
        e.eventType === 'explicit_correction'
        // Não filtrar por correctResponse - muitos eventos não têm esse campo preenchido
      );

      if (correctionEvents.length < 2) {
        console.log(`⏭️  [LIA Cortex Analysis] ${assistantType}: Poucos eventos (${correctionEvents.length}) - pulando análise`);
        continue;
      }

      console.log(`🔍 [LIA Cortex Analysis] Analisando ${correctionEvents.length} eventos de ${assistantType}...`);

      // Preparar dados para análise
      const analysisData = prepareAnalysisData(correctionEvents);
      console.log(`📋 [LIA Cortex Analysis] Dados preparados para ${assistantType}:`, analysisData.substring(0, 500) + '...');

      // Buscar prompt atual do assistente
      const currentPrompt = await getCurrentAssistantPrompt(assistantType);
      console.log(`📋 [LIA Cortex Analysis] Prompt atual de ${assistantType}: ${currentPrompt?.length || 0} caracteres`);

      // Chamar GPT-4 para análise
      const suggestions = await callCortexAnalysis(assistantType, analysisData, currentPrompt);
      console.log(`📊 [LIA Cortex Analysis] GPT-4 retornou ${suggestions?.length || 0} sugestões para ${assistantType}`);

      if (suggestions && suggestions.length > 0) {
        // Salvar sugestões no banco (com deduplicação e validação)
        for (const suggestion of suggestions) {
          // Validar formato da sugestão
          const currentLen = suggestion.currentPromptSection?.length || 0;
          const suggestedLen = suggestion.suggestedPromptSection?.length || 0;
          
          // Validação 1: Campos obrigatórios existem
          if (!suggestion.currentPromptSection || !suggestion.suggestedPromptSection) {
            console.log(`⚠️  [LIA Cortex Analysis] Sugestão inválida ignorada para ${assistantType}: campos de prompt faltando`);
            continue;
          }

          // Validação 2: Comprimento adequado (mínimo 200 chars para ter contexto suficiente)
          if (currentLen < 200 || suggestedLen < 200) {
            console.log(`⚠️  [LIA Cortex Analysis] Sugestão inválida ignorada para ${assistantType}: trechos muito curtos (${currentLen}/${suggestedLen} chars, mínimo 200)`);
            continue;
          }

          // Validação 3: Os trechos devem ser diferentes
          if (suggestion.currentPromptSection === suggestion.suggestedPromptSection) {
            console.log(`⚠️  [LIA Cortex Analysis] Sugestão inválida ignorada para ${assistantType}: trechos idênticos`);
            continue;
          }

          // Verificar se já existe sugestão similar pendente
          const existingSuggestions = await storage.getPromptSuggestionsByStatus("pending");
          const isDuplicate = existingSuggestions.some(existing => 
            existing.assistantType === suggestion.assistantType &&
            existing.problemIdentified === suggestion.problemIdentified
          );

          if (isDuplicate) {
            console.log(`⏭️  [LIA Cortex Analysis] Sugestão duplicada ignorada para ${assistantType}`);
            continue;
          }

          await storage.createPromptSuggestion({
            assistantType: suggestion.assistantType,
            problemIdentified: suggestion.problemIdentified,
            rootCauseAnalysis: suggestion.rootCauseAnalysis,
            currentPrompt: suggestion.currentPromptSection,
            suggestedPrompt: suggestion.suggestedPromptSection,
            confidenceScore: suggestion.confidenceScore,
            affectedConversations: suggestion.affectedConversations || [],
            status: "pending",
          });

          console.log(`✅ [LIA Cortex Analysis] Nova sugestão criada para ${assistantType} (confiança: ${suggestion.confidenceScore}%, ${currentLen}→${suggestedLen} chars)`);
        }

        allSuggestions.push(...suggestions);
      }
    }

    console.log(`🎯 [LIA Cortex Analysis] Análise concluída: ${allSuggestions.length} sugestões geradas`);
    return allSuggestions;

  } catch (error) {
    console.error("❌ [LIA Cortex Analysis] Erro na análise:", error);
    throw error;
  }
}

function groupEventsByAssistant(events: LearningEvent[]): Record<string, LearningEvent[]> {
  const grouped: Record<string, LearningEvent[]> = {};
  
  for (const event of events) {
    if (!grouped[event.assistantType]) {
      grouped[event.assistantType] = [];
    }
    grouped[event.assistantType].push(event);
  }
  
  return grouped;
}

function prepareAnalysisData(events: LearningEvent[]): string {
  const cases = events.map((event, index) => ({
    caso: index + 1,
    conversationId: event.conversationId,
    mensagemCliente: event.userMessage,
    respostaIA: event.aiResponse,
    respostaCorreta: event.correctResponse,
    feedbackSupervisor: event.feedback,
  }));

  return JSON.stringify(cases, null, 2);
}

async function callCortexAnalysis(assistantType: string, analysisData: string, currentPrompt: string): Promise<any[]> {
  try {
    console.log(`🤖 [Cortex Analysis] Chamando GPT-4o para analisar ${assistantType}...`);
    console.log(`📝 [Cortex Analysis] Tamanho do prompt atual: ${currentPrompt.length} caracteres`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: CORTEX_ANALYSIS_PROMPT,
        },
        {
          role: "user",
          content: `Analise os seguintes casos de intervenção do supervisor para o assistente "${assistantType}" e gere sugestões de melhoria.

**PROMPT ATUAL DO ASSISTENTE (${currentPrompt.length} caracteres):**
\`\`\`
${currentPrompt}
\`\`\`

**CASOS DE ERRO/CORREÇÃO:**
${analysisData}

**SUA TAREFA:**
1. Identifique padrões recorrentes nos erros
2. Para cada padrão, LOCALIZE a seção relevante no PROMPT ATUAL acima
3. COPIE 300-500 caracteres dessa seção em "currentPromptSection"
4. Crie a versão modificada dessa MESMA seção em "suggestedPromptSection"

Retorne APENAS o JSON com as sugestões, sem markdown ou explicações adicionais.`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    console.log(`📥 [Cortex Analysis] Resposta da GPT-4o para ${assistantType}:`, content?.substring(0, 500));
    
    if (!content) {
      console.log(`⚠️  [Cortex Analysis] GPT-4o retornou resposta vazia para ${assistantType}`);
      return [];
    }

    const result = JSON.parse(content);
    console.log(`✅ [Cortex Analysis] JSON parseado com sucesso. Sugestões: ${result.suggestions?.length || 0}`);
    return result.suggestions || [];

  } catch (error) {
    console.error(`❌ [Cortex Analysis] Erro ao analisar ${assistantType}:`, error);
    return [];
  }
}

// Função auxiliar para buscar o prompt atual de um assistente
export async function getCurrentAssistantPrompt(assistantType: string): Promise<string> {
  // Esta função será implementada no openai.ts
  const { getAssistantInstructions } = await import("./openai");
  return await getAssistantInstructions(assistantType);
}
