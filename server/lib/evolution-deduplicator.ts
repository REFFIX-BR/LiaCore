import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface EvolutionSuggestion {
  id: string;
  problemIdentified: string;
  rootCauseAnalysis: string;
  currentPrompt: string;
  suggestedPrompt: string;
  confidenceScore: number;
}

export interface DeduplicationResult {
  uniqueSuggestions: EvolutionSuggestion[];
  duplicateGroups: Array<{
    mainSuggestionId: string;
    duplicateIds: string[];
    reason: string;
    mergedProblem: string;
  }>;
  statistics: {
    total: number;
    unique: number;
    duplicates: number;
    duplicatePercentage: number;
  };
}

/**
 * Calcula similaridade entre dois textos (0-1)
 * Usa algoritmo de Levenshtein simplificado
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const str1 = text1.toLowerCase().trim();
  const str2 = text2.toLowerCase().trim();

  if (str1 === str2) return 1.0;

  // Tokenizar e comparar palavras
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));

  const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
  const union = new Set([...Array.from(words1), ...Array.from(words2)]);

  if (union.size === 0) return 0;

  // Jaccard similarity
  return intersection.size / union.size;
}

/**
 * Detecta se duas evoluções são duplicadas ou muito similares
 */
function areSuggestionsSimilar(
  s1: EvolutionSuggestion,
  s2: EvolutionSuggestion,
  threshold: number = 0.7
): boolean {
  // Comparar problema identificado
  const problemSimilarity = calculateTextSimilarity(
    s1.problemIdentified,
    s2.problemIdentified
  );

  // Comparar análise de causa raiz
  const rootCauseSimilarity = calculateTextSimilarity(
    s1.rootCauseAnalysis,
    s2.rootCauseAnalysis
  );

  // Comparar sugestão de mudança
  const suggestionSimilarity = calculateTextSimilarity(
    s1.suggestedPrompt,
    s2.suggestedPrompt
  );

  // Média ponderada (problema e sugestão têm mais peso)
  const averageSimilarity =
    (problemSimilarity * 0.4 +
    rootCauseSimilarity * 0.2 +
    suggestionSimilarity * 0.4);

  return averageSimilarity >= threshold;
}

/**
 * Agrupa evoluções similares
 */
function groupSimilarSuggestions(
  suggestions: EvolutionSuggestion[]
): Array<EvolutionSuggestion[]> {
  const groups: Array<EvolutionSuggestion[]> = [];
  const processed = new Set<string>();

  for (const suggestion of suggestions) {
    if (processed.has(suggestion.id)) continue;

    const group: EvolutionSuggestion[] = [suggestion];
    processed.add(suggestion.id);

    // Encontrar sugestões similares
    for (const other of suggestions) {
      if (processed.has(other.id)) continue;

      if (areSuggestionsSimilar(suggestion, other)) {
        group.push(other);
        processed.add(other.id);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Analisa e remove duplicatas de evoluções usando análise inteligente
 */
export async function deduplicateEvolutions(
  suggestions: EvolutionSuggestion[]
): Promise<DeduplicationResult> {
  console.log(`🔍 [Deduplicator] Analisando ${suggestions.length} evoluções...`);

  if (suggestions.length === 0) {
    return {
      uniqueSuggestions: [],
      duplicateGroups: [],
      statistics: {
        total: 0,
        unique: 0,
        duplicates: 0,
        duplicatePercentage: 0,
      },
    };
  }

  // Agrupar sugestões similares
  const groups = groupSimilarSuggestions(suggestions);

  const uniqueSuggestions: EvolutionSuggestion[] = [];
  const duplicateGroups: Array<{
    mainSuggestionId: string;
    duplicateIds: string[];
    reason: string;
    mergedProblem: string;
  }> = [];

  // Para cada grupo, manter apenas a sugestão com maior confiança
  for (const group of groups) {
    // Ordenar por confiança (maior primeiro)
    const sorted = group.sort((a, b) => b.confidenceScore - a.confidenceScore);
    const mainSuggestion = sorted[0];
    const duplicates = sorted.slice(1);

    uniqueSuggestions.push(mainSuggestion);

    if (duplicates.length > 0) {
      duplicateGroups.push({
        mainSuggestionId: mainSuggestion.id,
        duplicateIds: duplicates.map(d => d.id),
        reason: `Sugestões similares consolidadas (${duplicates.length + 1} total)`,
        mergedProblem: mainSuggestion.problemIdentified,
      });
    }
  }

  const totalDuplicates = suggestions.length - uniqueSuggestions.length;

  const result = {
    uniqueSuggestions,
    duplicateGroups,
    statistics: {
      total: suggestions.length,
      unique: uniqueSuggestions.length,
      duplicates: totalDuplicates,
      duplicatePercentage: Math.round((totalDuplicates / suggestions.length) * 100),
    },
  };

  console.log(`✅ [Deduplicator] Resultado:`);
  console.log(`   - Total: ${result.statistics.total}`);
  console.log(`   - Únicas: ${result.statistics.unique}`);
  console.log(`   - Duplicadas: ${result.statistics.duplicates} (${result.statistics.duplicatePercentage}%)`);
  console.log(`   - Grupos de duplicatas: ${duplicateGroups.length}`);

  return result;
}

/**
 * Análise avançada usando GPT-4o para detectar duplicatas semânticas
 * (Opcional - usar apenas se o método baseado em similaridade não for suficiente)
 */
export async function deduplicateEvolutionsWithAI(
  suggestions: EvolutionSuggestion[]
): Promise<DeduplicationResult> {
  console.log(`🤖 [AI Deduplicator] Analisando ${suggestions.length} evoluções com GPT-4o...`);

  if (suggestions.length === 0 || suggestions.length === 1) {
    return deduplicateEvolutions(suggestions);
  }

  const analysisPrompt = `Você é um especialista em análise de sugestões de melhoria de prompts.

**SUA TAREFA:**
Analise as ${suggestions.length} sugestões de evolução abaixo e identifique quais são DUPLICADAS ou MUITO SIMILARES.

**CRITÉRIOS PARA DUPLICATAS:**
1. Abordam o MESMO problema
2. Propõem mudanças SIMILARES no prompt
3. Têm análise de causa raiz SIMILAR

**SUGESTÕES:**
${suggestions.map((s, i) => `
SUGESTÃO ${i + 1} (ID: ${s.id}):
- Problema: ${s.problemIdentified}
- Causa Raiz: ${s.rootCauseAnalysis}
- Confiança: ${s.confidenceScore}%
- Mudança: ${s.suggestedPrompt.substring(0, 200)}...
`).join('\n---\n')}

**RETORNE UM JSON:**
{
  "duplicateGroups": [
    {
      "mainSuggestionId": "id-da-melhor-sugestão",
      "duplicateIds": ["id-duplicata-1", "id-duplicata-2"],
      "reason": "Explicação de por que são duplicatas"
    }
  ]
}

**REGRAS:**
- Só agrupe sugestões REALMENTE similares (>70% de overlap semântico)
- Escolha como "main" a sugestão com maior confiança
- Se duas sugestões são diferentes, NÃO agrupe
- Retorne APENAS JSON válido`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Usar mini para custo menor
      messages: [{ role: "user", content: analysisPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const aiResult = JSON.parse(response.choices[0].message.content || "{}");
    const aiDuplicateGroups = aiResult.duplicateGroups || [];

    // Marcar sugestões como duplicadas
    const duplicateIds = new Set<string>();
    for (const group of aiDuplicateGroups) {
      for (const dupId of group.duplicateIds) {
        duplicateIds.add(dupId);
      }
    }

    const uniqueSuggestions = suggestions.filter(s => !duplicateIds.has(s.id));
    const totalDuplicates = duplicateIds.size;

    const result = {
      uniqueSuggestions,
      duplicateGroups: aiDuplicateGroups.map((g: any) => ({
        mainSuggestionId: g.mainSuggestionId,
        duplicateIds: g.duplicateIds,
        reason: g.reason,
        mergedProblem: suggestions.find(s => s.id === g.mainSuggestionId)?.problemIdentified || "",
      })),
      statistics: {
        total: suggestions.length,
        unique: uniqueSuggestions.length,
        duplicates: totalDuplicates,
        duplicatePercentage: Math.round((totalDuplicates / suggestions.length) * 100),
      },
    };

    console.log(`✅ [AI Deduplicator] Resultado:`);
    console.log(`   - Total: ${result.statistics.total}`);
    console.log(`   - Únicas: ${result.statistics.unique}`);
    console.log(`   - Duplicadas: ${result.statistics.duplicates} (${result.statistics.duplicatePercentage}%)`);

    return result;
  } catch (error) {
    console.error("❌ [AI Deduplicator] Erro, usando fallback:", error);
    // Fallback para método baseado em similaridade
    return deduplicateEvolutions(suggestions);
  }
}
