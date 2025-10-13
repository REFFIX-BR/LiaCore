import { db } from "../db";
import { conversations, messages } from "@shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

/**
 * Sistema de Inteligência de Conversação
 * Detecta padrões, recorrências e sentiment para melhorar atendimento
 */

// Palavras-chave para detecção de insatisfação
const PALAVRAS_INSATISFACAO = [
  'sacanagem', 'absurdo', 'ridículo', 'demora', 'demorado',
  'já é a segunda vez', 'sempre acontece', 'toda hora',
  'de novo', 'novamente', 'outra vez', 'recorrente',
  'cansado', 'chato', 'péssimo', 'horrível', 'inaceitável',
  'indignado', 'revoltado', 'decepcionado', 'frustrado'
];

// Palavras-chave para detecção de urgência (movidas para dentro da função analyzeUrgency)

// Tipos de problemas técnicos rastreáveis
const PROBLEMAS_TECNICOS = [
  'sem internet', 'sem conexão', 'internet caiu', 'não conecta',
  'luz vermelha', 'luz piscando', 'roteador piscando',
  'lento', 'lentidão', 'travando', 'caindo',
  'não funciona', 'parou de funcionar'
];

/**
 * Analisa o sentimento de uma mensagem
 */
export function analyzeSentiment(message: string): {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  keywords: string[];
} {
  const messageLower = message.toLowerCase();
  const foundKeywords: string[] = [];

  // Detectar palavras de insatisfação
  for (const palavra of PALAVRAS_INSATISFACAO) {
    if (messageLower.includes(palavra)) {
      foundKeywords.push(palavra);
    }
  }

  if (foundKeywords.length > 0) {
    return {
      sentiment: 'negative',
      confidence: Math.min(0.9, 0.6 + (foundKeywords.length * 0.1)),
      keywords: foundKeywords
    };
  }

  // Palavras positivas
  const palavrasPositivas = ['obrigado', 'obrigada', 'ótimo', 'perfeito', 'excelente', 'resolvido'];
  for (const palavra of palavrasPositivas) {
    if (messageLower.includes(palavra)) {
      return { sentiment: 'positive', confidence: 0.7, keywords: [palavra] };
    }
  }

  return { sentiment: 'neutral', confidence: 0.5, keywords: [] };
}

/**
 * Detecta nível de urgência baseado na mensagem
 */
export function analyzeUrgency(message: string): {
  urgency: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
} {
  const messageLower = message.toLowerCase();

  // Palavras críticas (múltiplas = crítico)
  const palavrasCriticas = ['urgente', 'emergência', 'preciso agora', 'já', 'parado', 'sem internet'];
  const palavrasAltas = ['rápido', 'importante', 'crítico', 'trabalho', 'reunião', 'essencial'];
  const palavrasMedias = ['quando', 'possível', 'ajuda', 'dúvida', 'gostaria'];

  const criticasEncontradas: string[] = [];
  const altasEncontradas: string[] = [];
  const mediasEncontradas: string[] = [];

  for (const palavra of palavrasCriticas) {
    if (messageLower.includes(palavra)) {
      criticasEncontradas.push(palavra);
    }
  }

  for (const palavra of palavrasAltas) {
    if (messageLower.includes(palavra)) {
      altasEncontradas.push(palavra);
    }
  }

  for (const palavra of palavrasMedias) {
    if (messageLower.includes(palavra)) {
      mediasEncontradas.push(palavra);
    }
  }

  // Lógica de classificação com 4 níveis
  if (criticasEncontradas.length >= 2 || (criticasEncontradas.length >= 1 && altasEncontradas.length >= 1)) {
    return { urgency: 'critical', reasons: [...criticasEncontradas, ...altasEncontradas] };
  }

  if (criticasEncontradas.length === 1 || altasEncontradas.length >= 2) {
    return { urgency: 'high', reasons: criticasEncontradas.length > 0 ? criticasEncontradas : altasEncontradas };
  }

  if (altasEncontradas.length === 1 || mediasEncontradas.length >= 1) {
    return { urgency: 'medium', reasons: altasEncontradas.length > 0 ? altasEncontradas : mediasEncontradas };
  }

  // Sem palavras de urgência = baixa prioridade
  return { urgency: 'low', reasons: [] };
}

/**
 * Detecta tipo de problema técnico mencionado
 */
export function detectTechnicalProblem(message: string): {
  detected: boolean;
  problemType: string | null;
  keywords: string[];
} {
  const messageLower = message.toLowerCase();
  const keywords: string[] = [];

  for (const problema of PROBLEMAS_TECNICOS) {
    if (messageLower.includes(problema)) {
      keywords.push(problema);
    }
  }

  if (keywords.length > 0) {
    // Categorizar o tipo de problema
    let problemType = 'conectividade';
    if (keywords.some(k => k.includes('luz') || k.includes('roteador'))) {
      problemType = 'equipamento';
    } else if (keywords.some(k => k.includes('lento') || k.includes('travando'))) {
      problemType = 'performance';
    }

    return { detected: true, problemType, keywords };
  }

  return { detected: false, problemType: null, keywords: [] };
}

/**
 * Verifica se cliente já teve problemas similares recentemente (recorrência)
 */
export async function checkRecurrence(
  clientDocument: string,
  problemType: string,
  daysBack: number = 30
): Promise<{
  isRecurrent: boolean;
  previousOccurrences: number;
  lastOccurrence: Date | null;
  details: Array<{ date: Date; problem: string }>;
}> {
  if (!clientDocument) {
    return { isRecurrent: false, previousOccurrences: 0, lastOccurrence: null, details: [] };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // Buscar conversas anteriores do cliente
  const previousConversations = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.clientDocument, clientDocument),
        gte(conversations.createdAt, cutoffDate)
      )
    )
    .orderBy(desc(conversations.createdAt));

  const details: Array<{ date: Date; problem: string }> = [];
  let occurrences = 0;

  for (const conv of previousConversations) {
    // Verificar se metadata contém histórico de problemas
    const metadata = conv.metadata as any;
    if (metadata?.problemaDetectado?.type === problemType) {
      occurrences++;
      details.push({
        date: conv.createdAt || new Date(),
        problem: metadata.problemaDetectado.keywords?.join(', ') || problemType
      });
    }
  }

  return {
    isRecurrent: occurrences > 0,
    previousOccurrences: occurrences,
    lastOccurrence: details.length > 0 ? details[0].date : null,
    details
  };
}

/**
 * Atualiza metadata da conversa com informações de inteligência
 */
export async function updateConversationIntelligence(
  conversationId: string,
  updates: {
    sentiment?: string;
    urgency?: string;
    problemaDetectado?: any;
    recorrencia?: any;
  }
) {
  const conversation = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (conversation.length === 0) return;

  const currentMetadata = (conversation[0].metadata as any) || {};
  const newMetadata = {
    ...currentMetadata,
    ...updates,
    lastIntelligenceUpdate: new Date().toISOString()
  };

  await db
    .update(conversations)
    .set({
      metadata: newMetadata,
      sentiment: updates.sentiment || conversation[0].sentiment,
      urgency: updates.urgency || conversation[0].urgency
    })
    .where(eq(conversations.id, conversationId));
}

/**
 * Salva CPF validado na metadata para evitar perder contexto
 */
export async function persistClientDocument(
  conversationId: string,
  document: string
) {
  await db
    .update(conversations)
    .set({
      clientDocument: document,
      metadata: sql`jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{cliente,cpfValidado}',
        to_jsonb(${document}::text)
      )`
    })
    .where(eq(conversations.id, conversationId));
}

/**
 * Recupera CPF/CNPJ salvo para evitar pedir novamente
 */
export async function getPersistedDocument(conversationId: string): Promise<string | null> {
  const conversation = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (conversation.length === 0) return null;

  // Verificar se já está no campo clientDocument
  if (conversation[0].clientDocument) {
    return conversation[0].clientDocument;
  }

  // Verificar metadata
  const metadata = conversation[0].metadata as any;
  return metadata?.cliente?.cpfValidado || null;
}

/**
 * Detecta e extrai CPF ou CNPJ de uma mensagem
 * @param message Mensagem do cliente
 * @returns CPF/CNPJ limpo (apenas números) ou null se não encontrado
 */
export function detectClientDocument(message: string): string | null {
  if (!message) return null;

  // Remove espaços e caracteres especiais para facilitar a busca
  const cleanMessage = message.replace(/\s+/g, ' ');

  // Regex para CPF: 000.000.000-00 ou 00000000000
  const cpfRegex = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g;
  const cpfMatch = cleanMessage.match(cpfRegex);

  if (cpfMatch) {
    // Limpar formatação (manter apenas números)
    const cpfLimpo = cpfMatch[0].replace(/\D/g, '');
    if (cpfLimpo.length === 11) {
      console.log(`📋 [Document Detection] CPF detectado (mascarado: ***.***.*Fragment-**)`);
      return cpfLimpo;
    }
  }

  // Regex para CNPJ: 00.000.000/0000-00 ou 00000000000000
  const cnpjRegex = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g;
  const cnpjMatch = cleanMessage.match(cnpjRegex);

  if (cnpjMatch) {
    // Limpar formatação (manter apenas números)
    const cnpjLimpo = cnpjMatch[0].replace(/\D/g, '');
    if (cnpjLimpo.length === 14) {
      console.log(`📋 [Document Detection] CNPJ detectado (mascarado: **.***.***/****-**)`);
      return cnpjLimpo;
    }
  }

  return null;
}

/**
 * Gera resumo de inteligência para logging
 */
export function generateIntelligenceSummary(data: {
  sentiment: any;
  urgency: any;
  problem?: any;
  recurrence?: any;
}): string {
  const parts: string[] = [];

  if (data.sentiment?.sentiment === 'negative') {
    parts.push(`😡 Cliente insatisfeito (${data.sentiment.keywords.join(', ')})`);
  }

  if (data.urgency?.urgency === 'high' || data.urgency?.urgency === 'critical') {
    parts.push(`⚠️ Urgência ${data.urgency.urgency} (${data.urgency.reasons.join(', ')})`);
  }

  if (data.problem?.detected) {
    parts.push(`🔧 Problema: ${data.problem.problemType} (${data.problem.keywords.join(', ')})`);
  }

  if (data.recurrence?.isRecurrent) {
    parts.push(`🔁 RECORRÊNCIA detectada (${data.recurrence.previousOccurrences}x nos últimos 30 dias)`);
  }

  return parts.length > 0 ? parts.join(' | ') : '✅ Conversa normal';
}
