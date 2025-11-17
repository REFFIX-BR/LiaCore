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
export async function persistLatencyReport(report: LatencyReport, tracker: LatencyTracker): Promise<void> {
  try {
    // Adicionar ao histórico de latência
    await redis.lpush('latency:reports', JSON.stringify(report));
    
    // Manter apenas últimos 1000 reports
    await redis.ltrim('latency:reports', 0, 999);
    
    // Atualizar métricas agregadas (P50, P95, P99) com tracker completo
    await updateLatencyMetrics(tracker);
    
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
 * CRITICAL FIX v4: Salva tracker completo com checkpoints para análise detalhada
 * - Permite calcular breakdowns por etapa
 * - Mantém últimas 1000 medições cronologicamente
 * - Sem bias (remove sempre as mais antigas)
 */
async function updateLatencyMetrics(tracker: LatencyTracker): Promise<void> {
  // Preparar objeto de medição com checkpoints
  const measurement = {
    messageId: tracker.messageId,
    conversationId: tracker.conversationId,
    timestamp: Date.now(),
    checkpoints: tracker.checkpoints.map(cp => ({
      name: cp.step,
      timestamp: cp.timestamp,
    })),
  };
  
  // Salvar medição completa como JSON
  await redis.lpush('latency:measurements', JSON.stringify(measurement));
  await redis.ltrim('latency:measurements', 0, 999); // Mantém últimas 1000
}

/**
 * Calcula percentis de latência (P50, P95, P99)
 * 
 * CRITICAL FIX v4: Extrai latência total de objetos tracker salvos
 * - Calcula latência total (webhook_received → whatsapp_sent)
 * - Ordenação em memória
 * - Percentis matematicamente corretos
 */
export async function getLatencyPercentiles(): Promise<{
  p50: number;
  p95: number;
  p99: number;
  count: number;
} | null> {
  try {
    // Obter todas as medições da lista (objetos com checkpoints)
    const measurements = await redis.lrange('latency:measurements', 0, -1);
    
    if (!Array.isArray(measurements) || measurements.length === 0) {
      return null;
    }
    
    // Converter para objetos e calcular latência total de cada
    const values: number[] = [];
    measurements.forEach((m: any) => {
      const data = typeof m === 'string' ? JSON.parse(m) : m;
      const checkpoints = data.checkpoints || [];
      
      const webhook = checkpoints.find((c: any) => c.name === 'webhook_received');
      const whatsapp = checkpoints.find((c: any) => c.name === 'whatsapp_sent');
      
      if (webhook && whatsapp) {
        // Latência em segundos
        values.push((whatsapp.timestamp - webhook.timestamp) / 1000);
      }
    });
    
    if (values.length === 0) {
      return null;
    }
    
    // Ordenar valores
    const sorted = values.sort((a, b) => a - b);
    const count = sorted.length;
    
    const getPercentile = (p: number) => {
      const index = Math.ceil(count * p) - 1;
      return sorted[Math.max(0, index)];
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

/**
 * Calcula métricas agregadas de latência (P50, P95, P99)
 */
export async function getLatencyMetrics(limit = 1000): Promise<{
  total: { p50: number; p95: number; p99: number };
  breakdown: {
    queueWait: { p50: number; p95: number; p99: number };
    batching: { p50: number; p95: number; p99: number };
    workerStart: { p50: number; p95: number; p99: number };
    openai: { p50: number; p95: number; p99: number };
    whatsapp: { p50: number; p95: number; p99: number };
  };
  sampleSize: number;
  lastMeasurement: number | null;
}> {
  try {
    // Buscar últimas medições do Redis (LIST)
    // IMPORTANTE: Upstash Redis retorna objetos já parseados, não strings
    let measurements: any[] = [];
    try {
      const result = await redis.lrange('latency:measurements', 0, limit - 1);
      measurements = (result || []) as any[];
    } catch (error: any) {
      // Se der erro WRONGTYPE, significa que a chave está em formato antigo (ZSET)
      // Deletar e retornar dados vazios
      if (error.message?.includes('WRONGTYPE')) {
        console.log('🧹 [Latency] Detectado formato antigo - limpando chaves...');
        await redis.del('latency:measurements');
        await redis.del('latency:timestamps');
        console.log('✅ [Latency] Chaves antigas deletadas - aguarde novas medições');
        measurements = [];
      } else {
        throw error;
      }
    }
    
    if (!measurements || measurements.length === 0) {
      return {
        total: { p50: 0, p95: 0, p99: 0 },
        breakdown: {
          queueWait: { p50: 0, p95: 0, p99: 0 },
          batching: { p50: 0, p95: 0, p99: 0 },
          workerStart: { p50: 0, p95: 0, p99: 0 },
          openai: { p50: 0, p95: 0, p99: 0 },
          whatsapp: { p50: 0, p95: 0, p99: 0 },
        },
        sampleSize: 0,
        lastMeasurement: null,
      };
    }
    
    // IMPORTANTE: Upstash Redis já retorna objetos parseados - não precisa JSON.parse!
    // Se vier como string, parsear. Se vier como objeto, usar direto.
    const data = measurements.map(m => typeof m === 'string' ? JSON.parse(m) : m);
    
    // Calcular latência total (webhook → whatsapp)
    const totalLatencies: number[] = [];
    const breakdowns = {
      queueWait: [] as number[],
      batching: [] as number[],
      workerStart: [] as number[],
      openai: [] as number[],
      whatsapp: [] as number[],
    };
    
    data.forEach((m: any) => {
      const checkpoints = m.checkpoints || [];
      const webhook = checkpoints.find((c: any) => c.name === 'webhook_received');
      const queued = checkpoints.find((c: any) => c.name === 'queue_enqueued');
      const workerStart = checkpoints.find((c: any) => c.name === 'worker_started');
      const openaiRequest = checkpoints.find((c: any) => c.name === 'openai_request');
      const openaiResponse = checkpoints.find((c: any) => c.name === 'openai_response');
      const whatsappSent = checkpoints.find((c: any) => c.name === 'whatsapp_sent');
      
      // Latência total
      if (webhook && whatsappSent) {
        totalLatencies.push((whatsappSent.timestamp - webhook.timestamp) / 1000);
      }
      
      // Breakdown
      if (webhook && queued) breakdowns.queueWait.push((queued.timestamp - webhook.timestamp) / 1000);
      if (queued && workerStart) breakdowns.batching.push((workerStart.timestamp - queued.timestamp) / 1000);
      if (workerStart && openaiRequest) breakdowns.workerStart.push((openaiRequest.timestamp - workerStart.timestamp) / 1000);
      if (openaiRequest && openaiResponse) breakdowns.openai.push((openaiResponse.timestamp - openaiRequest.timestamp) / 1000);
      if (openaiResponse && whatsappSent) breakdowns.whatsapp.push((whatsappSent.timestamp - openaiResponse.timestamp) / 1000);
    });
    
    // Função para calcular percentis
    const calculatePercentiles = (arr: number[]) => {
      if (arr.length === 0) return { p50: 0, p95: 0, p99: 0 };
      
      const sorted = [...arr].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
      const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
      
      return { 
        p50: Number(p50.toFixed(2)), 
        p95: Number(p95.toFixed(2)), 
        p99: Number(p99.toFixed(2)) 
      };
    };
    
    // Última medição
    const lastMeasurement = data.length > 0 ? data[0]?.timestamp || null : null;
    
    return {
      total: calculatePercentiles(totalLatencies),
      breakdown: {
        queueWait: calculatePercentiles(breakdowns.queueWait),
        batching: calculatePercentiles(breakdowns.batching),
        workerStart: calculatePercentiles(breakdowns.workerStart),
        openai: calculatePercentiles(breakdowns.openai),
        whatsapp: calculatePercentiles(breakdowns.whatsapp),
      },
      sampleSize: data.length,
      lastMeasurement,
    };
  } catch (error) {
    console.error('❌ [Latency] Erro ao calcular métricas:', error);
    throw error;
  }
}
