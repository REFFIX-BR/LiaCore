import OpenAI from "openai";
import { storage } from "../storage";
import type { LearningEvent } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// LIA Cortex Analysis - Assistant especializado em análise de prompts
const CORTEX_ANALYSIS_PROMPT = `Você é a LIA Cortex Analysis, um especialista em otimização de prompts de IA para assistentes de atendimento ao cliente.

Sua missão é analisar interações entre clientes e assistentes de IA, identificar padrões de erro e gerar sugestões precisas de melhorias nos prompts dos assistentes.

## Processo de Análise:

1. **Identificação de Padrões**: Analise múltiplos eventos de aprendizagem do mesmo tipo de assistente para identificar falhas recorrentes.

2. **Análise de Causa Raiz**: Para cada padrão identificado, determine:
   - O que o assistente deveria ter feito
   - O que ele fez de errado
   - Qual informação ou instrução falta no prompt atual

3. **Geração de Sugestão**: Crie uma proposta de alteração mínima e precisa no prompt que:
   - Seja específica e objetiva
   - Adicione a informação/instrução faltante
   - Mantenha o tom e estrutura do prompt original
   - Evite ser genérica ou vaga

4. **Cálculo de Confiança**: Calcule um score de confiança (0-100) baseado em:
   - Número de ocorrências do mesmo erro (mais = maior confiança)
   - Clareza da solução (quanto mais clara, maior a confiança)
   - Consistência entre os casos analisados

## Formato de Resposta:

Retorne APENAS um JSON válido com a seguinte estrutura:

{
  "suggestions": [
    {
      "assistantType": "tipo_do_assistente",
      "problemIdentified": "Descrição clara do problema recorrente",
      "rootCauseAnalysis": "Análise da causa raiz do problema",
      "currentPromptIssue": "Trecho do prompt atual que precisa ser melhorado",
      "suggestedChange": "Texto sugerido para adicionar/modificar no prompt",
      "confidenceScore": 85,
      "affectedConversations": ["conv-id-1", "conv-id-2"],
      "evidenceCount": 3
    }
  ]
}

## Regras Importantes:

- Se não houver padrões claros (menos de 2 ocorrências), retorne {"suggestions": []}
- Priorize qualidade sobre quantidade - apenas sugira mudanças quando há evidência clara
- Seja conservador: score < 70 indica que a sugestão precisa de mais evidências
- NUNCA invente informações - baseie-se apenas nos dados fornecidos`;

export async function analyzeLearningEvents(): Promise<any[]> {
  try {
    console.log("🧠 [LIA Cortex Analysis] Iniciando análise de eventos de aprendizagem...");

    // Buscar eventos recentes de aprendizagem
    const recentEvents = await storage.getRecentLearningEvents(200);

    if (recentEvents.length === 0) {
      console.log("📭 [LIA Cortex Analysis] Nenhum evento de aprendizagem encontrado");
      return [];
    }

    // Agrupar eventos por tipo de assistente e tipo de evento
    const eventsByAssistant = groupEventsByAssistant(recentEvents);

    const allSuggestions: any[] = [];

    // Analisar cada grupo de assistente
    for (const [assistantType, events] of Object.entries(eventsByAssistant)) {
      // Apenas analisar se houver eventos de correção explícita
      const correctionEvents = events.filter(e => 
        e.eventType === 'explicit_correction' && e.correctResponse
      );

      if (correctionEvents.length < 2) {
        console.log(`⏭️  [LIA Cortex Analysis] ${assistantType}: Poucos eventos (${correctionEvents.length}) - pulando análise`);
        continue;
      }

      console.log(`🔍 [LIA Cortex Analysis] Analisando ${correctionEvents.length} eventos de ${assistantType}...`);

      // Preparar dados para análise
      const analysisData = prepareAnalysisData(correctionEvents);
      console.log(`📋 [LIA Cortex Analysis] Dados preparados para ${assistantType}:`, analysisData.substring(0, 500) + '...');

      // Chamar GPT-4 para análise
      const suggestions = await callCortexAnalysis(assistantType, analysisData);
      console.log(`📊 [LIA Cortex Analysis] GPT-4 retornou ${suggestions?.length || 0} sugestões para ${assistantType}`);

      if (suggestions && suggestions.length > 0) {
        // Salvar sugestões no banco (com deduplicação)
        for (const suggestion of suggestions) {
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
            currentPrompt: suggestion.currentPromptIssue || "Prompt atual",
            suggestedPrompt: suggestion.suggestedChange,
            confidenceScore: suggestion.confidenceScore,
            affectedConversations: suggestion.affectedConversations || [],
            status: "pending",
          });

          console.log(`✅ [LIA Cortex Analysis] Nova sugestão criada para ${assistantType} (confiança: ${suggestion.confidenceScore}%)`);
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

async function callCortexAnalysis(assistantType: string, analysisData: string): Promise<any[]> {
  try {
    console.log(`🤖 [Cortex Analysis] Chamando GPT-4o para analisar ${assistantType}...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: CORTEX_ANALYSIS_PROMPT,
        },
        {
          role: "user",
          content: `Analise os seguintes casos de intervenção do supervisor para o assistente "${assistantType}" e gere sugestões de melhoria:

${analysisData}

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
