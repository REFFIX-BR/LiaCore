/**
 * 📊 LATENCY TRACKING SYSTEM
 * 
 * Sistema de instrumentação para rastrear tempo de resposta em cada etapa do pipeline:
 * Webhook → BullMQ → Worker → OpenAI → WhatsApp
 * 
 * Meta: ≤30 segundos end-to-end (P95)
 */

import { redis } from './redis-config';

export interface LatencyCheckpoint {
  step: 'webhook_received' | 'queue_enqueued' | 'worker_started' | 'openai_request' | 'openai_response' | 'whatsapp_sent';
  timestamp: number; // Unix timestamp em ms
  metadata?: Record<string, any>;
}

export interface LatencyTracker {
  conversationId?: string;
  messageId: string;
  checkpoints: LatencyCheckpoint[];
  startTime: number;
}

/**
 * Cria um novo tracker de latência
 */
export function createLatencyTracker(messageId: string, conversationId?: string): LatencyTracker {
  return {
    conversationId,
    messageId,
    checkpoints: [],
    startTime: Date.now(),
  };
}

/**
 * Adiciona um checkpoint ao tracker
 */
export function addCheckpoint(
  tracker: LatencyTracker,
  step: LatencyCheckpoint['step'],
  metadata?: Record<string, any>
): void {
  tracker.checkpoints.push({
    step,
    timestamp: Date.now(),
    metadata,
  });
}

/**
 * Calcula latência entre dois checkpoints
 */
export function getLatencyBetween(
  tracker: LatencyTracker,
  stepA: LatencyCheckpoint['step'],
  stepB: LatencyCheckpoint['step']
): number | null {
  const checkpointA = tracker.checkpoints.find(c => c.step === stepA);
  const checkpointB = tracker.checkpoints.find(c => c.step === stepB);
  
  if (!checkpointA || !checkpointB) return null;
  
  return checkpointB.timestamp - checkpointA.timestamp;
}

/**
 * Calcula latência total (end-to-end)
 */
export function getTotalLatency(tracker: LatencyTracker): number {
  const lastCheckpoint = tracker.checkpoints[tracker.checkpoints.length - 1];
  if (!lastCheckpoint) return 0;
  
  return lastCheckpoint.timestamp - tracker.startTime;
}

/**
 * Gera relatório de latência com breakdown por etapa
 */
export interface LatencyReport {
  messageId: string;
  conversationId?: string;
  totalLatencyMs: number;
  breakdown: {
    webhook_to_queue?: number;
    queue_to_worker?: number;
    worker_to_openai?: number;
    openai_processing?: number;
    openai_to_whatsapp?: number;
    whatsapp_delivery?: number;
  };
  checkpoints: LatencyCheckpoint[];
  timestamp: number;
}

export function generateLatencyReport(tracker: LatencyTracker): LatencyReport {
  const breakdown: LatencyReport['breakdown'] = {};
  
  // Webhook → Queue
  const webhookToQueue = getLatencyBetween(tracker, 'webhook_received', 'queue_enqueued');
  if (webhookToQueue !== null) breakdown.webhook_to_queue = webhookToQueue;
  
  // Queue → Worker
  const queueToWorker = getLatencyBetween(tracker, 'queue_enqueued', 'worker_started');
  if (queueToWorker !== null) breakdown.queue_to_worker = queueToWorker;
  
  // Worker → OpenAI Request
  const workerToOpenAI = getLatencyBetween(tracker, 'worker_started', 'openai_request');
  if (workerToOpenAI !== null) breakdown.worker_to_openai = workerToOpenAI;
  
  // OpenAI Processing (request → response)
  const openaiProcessing = getLatencyBetween(tracker, 'openai_request', 'openai_response');
  if (openaiProcessing !== null) breakdown.openai_processing = openaiProcessing;
  
  // OpenAI Response → WhatsApp Send
  const openaiToWhatsApp = getLatencyBetween(tracker, 'openai_response', 'whatsapp_sent');
  if (openaiToWhatsApp !== null) breakdown.openai_to_whatsapp = openaiToWhatsApp;
  
  return {
    messageId: tracker.messageId,
    conversationId: tracker.conversationId,
    totalLatencyMs: getTotalLatency(tracker),
    breakdown,
    checkpoints: tracker.checkpoints,
    timestamp: Date.now(),
  };
}

/**
 * Persiste métricas de latência no Redis (para análise posterior)
 * Mantém últimos 1000 reports em uma lista circular
 */
export async function persistLatencyReport(report: LatencyReport): Promise<void> {
  try {
    // Adicionar ao histórico de latência
    await redis.lpush('latency:reports', JSON.stringify(report));
    
    // Manter apenas últimos 1000 reports
    await redis.ltrim('latency:reports', 0, 999);
    
    // Atualizar métricas agregadas (P50, P95, P99)
    await updateLatencyMetrics(report.totalLatencyMs);
    
    // Log estruturado
    const totalSeconds = (report.totalLatencyMs / 1000).toFixed(2);
    const openaiMs = report.breakdown.openai_processing || 0;
    const queueMs = report.breakdown.queue_to_worker || 0;
    
    console.log(`⏱️  [Latency] Total: ${totalSeconds}s | OpenAI: ${openaiMs}ms | Queue: ${queueMs}ms`, {
      messageId: report.messageId,
      conversationId: report.conversationId,
      breakdown: report.breakdown,
    });
    
    // Alerta se exceder 30s
    if (report.totalLatencyMs > 30000) {
      console.warn(`⚠️  [Latency] SLA BREACH! Resposta demorou ${totalSeconds}s (meta: ≤30s)`, {
        messageId: report.messageId,
        breakdown: report.breakdown,
      });
    }
  } catch (error) {
    console.error('❌ [Latency] Erro ao persistir report:', error);
  }
}

/**
 * Atualiza métricas agregadas de latência (usa lista circular para percentis)
 * 
 * CRITICAL FIX v3: Usa lista circular simples (LPUSH + LTRIM)
 * - Evita desincronização de dual-ZSET
 * - Operação atômica O(1)
 * - Mantém últimas 1000 medições cronologicamente
 * - Sem bias (remove sempre as mais antigas)
 */
async function updateLatencyMetrics(latencyMs: number): Promise<void> {
  // CRITICAL: Usar lista circular ao invés de ZSET para evitar bugs de cleanup
  // LPUSH + LTRIM é atômico e garante FIFO perfeito (sem bias)
  await redis.lpush('latency:measurements', latencyMs.toString());
  await redis.ltrim('latency:measurements', 0, 999); // Mantém últimas 1000
}

/**
 * Calcula percentis de latência (P50, P95, P99)
 * 
 * CRITICAL FIX v3: Usa lista circular (LRANGE) para cálculo robusto
 * - Sem desincronização
 * - Ordenação simples em memória
 * - Percentis matematicamente corretos
 */
export async function getLatencyPercentiles(): Promise<{
  p50: number;
  p95: number;
  p99: number;
  count: number;
} | null> {
  try {
    // Obter todas as medições da lista
    const measurements = await redis.lrange('latency:measurements', 0, -1);
    
    if (!Array.isArray(measurements) || measurements.length === 0) {
      return null;
    }
    
    // Converter para números e ordenar
    const values = measurements
      .map(m => parseFloat(m as string))
      .filter(v => !isNaN(v))
      .sort((a, b) => a - b);
    
    const count = values.length;
    
    if (count === 0) {
      return null;
    }
    
    const getPercentile = (p: number) => {
      const index = Math.ceil(count * p) - 1;
      return values[Math.max(0, index)];
    };
    
    return {
      p50: getPercentile(0.50),
      p95: getPercentile(0.95),
      p99: getPercentile(0.99),
      count,
    };
  } catch (error) {
    console.error('❌ [Latency] Erro ao calcular percentis:', error);
    return null;
  }
}

/**
 * Obtém últimos N reports de latência
 */
export async function getRecentLatencyReports(limit = 100): Promise<LatencyReport[]> {
  try {
    const reports = await redis.lrange('latency:reports', 0, limit - 1);
    
    if (!Array.isArray(reports)) {
      return [];
    }
    
    return reports.map(r => JSON.parse(r as string)) as LatencyReport[];
  } catch (error) {
    console.error('❌ [Latency] Erro ao obter reports:', error);
    return [];
  }
}

/**
 * Helper: Salva tracker parcial no Redis (para casos onde processo é interrompido)
 * Útil para recuperar checkpoints se worker crashar
 */
export async function saveTrackerSnapshot(tracker: LatencyTracker): Promise<void> {
  try {
    const key = `latency:tracker:${tracker.messageId}`;
    await redis.set(key, JSON.stringify(tracker), { ex: 300 }); // TTL 5 min
  } catch (error) {
    console.error('❌ [Latency] Erro ao salvar snapshot:', error);
  }
}

/**
 * Helper: Recupera tracker do Redis
 */
export async function loadTrackerSnapshot(messageId: string): Promise<LatencyTracker | null> {
  try {
    const key = `latency:tracker:${messageId}`;
    const data = await redis.get(key);
    
    if (!data) return null;
    
    return JSON.parse(data as string) as LatencyTracker;
  } catch (error) {
    console.error('❌ [Latency] Erro ao carregar snapshot:', error);
    return null;
  }
}
