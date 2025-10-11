import { Redis } from '@upstash/redis';

/**
 * 🚀 SISTEMA DE CACHE OTIMIZADO
 * 
 * Reduz comandos Redis com:
 * 1. Cache local em memória para dados estáticos
 * 2. Pipelines para operações em lote
 * 3. TTL automático para limpeza
 */

// ==================== CACHE LOCAL ====================

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number; // TTL específico da entry em ms
}

class LocalCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutos (apenas fallback)

  get<T>(key: string, ttl?: number): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Usa TTL da entry se existir, senão usa o fornecido, senão usa default
    const maxAge = entry.ttl || ttl || this.defaultTTL;
    if (Date.now() - entry.timestamp > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL // Armazena TTL específico
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Auto-limpeza periódica - respeita TTL individual de cada entry
  startAutoCleanup(intervalMs = 10 * 60 * 1000) {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of Array.from(this.cache.entries())) {
        // Usa TTL específico da entry ao invés de defaultTTL global
        const entryTTL = entry.ttl || this.defaultTTL;
        if (now - entry.timestamp > entryTTL) {
          this.cache.delete(key);
        }
      }
    }, intervalMs);
  }
}

export const localCache = new LocalCache();
localCache.startAutoCleanup();

// ==================== CACHE HÍBRIDO (Local + Redis) ====================

export async function getCached<T>(
  redis: Redis,
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    localTTL?: number;    // TTL cache local (ms)
    redisTTL?: number;    // TTL Redis (segundos)
    skipLocal?: boolean;  // Pular cache local
  }
): Promise<T> {
  const { localTTL = 5 * 60 * 1000, redisTTL, skipLocal = false } = options || {};

  // 1. Tenta cache local primeiro
  if (!skipLocal) {
    const cached = localCache.get<T>(key, localTTL);
    if (cached !== null) {
      return cached;
    }
  }

  // 2. Tenta Redis
  const redisValue = await redis.get(key);
  if (redisValue) {
    const parsed = JSON.parse(redisValue as string) as T;
    // Salva no cache local com TTL específico
    localCache.set(key, parsed, localTTL);
    return parsed;
  }

  // 3. Executa fetcher e salva em ambos
  const value = await fetcher();
  
  // Salva local com TTL específico
  localCache.set(key, value, localTTL);
  
  // Salva Redis com TTL
  if (redisTTL) {
    await redis.set(key, JSON.stringify(value), { ex: redisTTL });
  } else {
    await redis.set(key, JSON.stringify(value));
  }

  return value;
}

// ==================== BATCH UPDATES ====================

class BatchUpdater {
  private counters = new Map<string, number>();
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(
    private redis: Redis,
    private intervalMs = 60000 // 1 minuto
  ) {
    this.startAutoFlush();
  }

  // Incrementa contador local
  increment(key: string, amount = 1): void {
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + amount);
  }

  // Envia todos os contadores acumulados para Redis
  async flush(): Promise<void> {
    if (this.counters.size === 0) return;

    const pipeline = this.redis.pipeline();
    
    for (const [key, amount] of Array.from(this.counters.entries())) {
      pipeline.incrby(key, amount);
    }

    await pipeline.exec();
    
    console.log(`📊 [Batch] Enviados ${this.counters.size} contadores para Redis`);
    this.counters.clear();
  }

  // Auto-flush periódico
  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(err => {
        console.error('❌ [Batch] Erro ao fazer flush:', err);
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

let batchUpdater: BatchUpdater | null = null;

export function getBatchUpdater(redis: Redis): BatchUpdater {
  if (!batchUpdater) {
    batchUpdater = new BatchUpdater(redis);
  }
  return batchUpdater;
}

// ==================== REDIS PIPELINE HELPERS ====================

/**
 * Salva thread de conversa com metadata em pipeline (1 request)
 */
export async function saveConversationThread(
  redis: Redis,
  conversationId: number,
  threadId: string,
  metadata?: Record<string, any>,
  ttl = 604800 // 7 dias
): Promise<void> {
  const pipeline = redis.pipeline();

  // Salva como hash (melhor que múltiplas keys)
  const data: Record<string, any> = {
    threadId,
    createdAt: Date.now(),
  };

  if (metadata) {
    data.metadata = JSON.stringify(metadata);
  }

  pipeline.hset(`conv:${conversationId}`, data);
  pipeline.expire(`conv:${conversationId}`, ttl);

  await pipeline.exec();
}

/**
 * Recupera thread de conversa
 */
export async function getConversationThread(
  redis: Redis,
  conversationId: number
): Promise<{ threadId: string; metadata?: any; createdAt?: number } | null> {
  const data = await redis.hgetall(`conv:${conversationId}`);
  
  if (!data || !data.threadId) return null;

  return {
    threadId: data.threadId as string,
    metadata: data.metadata ? JSON.parse(data.metadata as string) : undefined,
    createdAt: data.createdAt ? Number(data.createdAt) : undefined,
  };
}

/**
 * Atualiza múltiplas estatísticas em pipeline (1 request)
 */
export async function updateStats(
  redis: Redis,
  stats: Record<string, number>
): Promise<void> {
  const pipeline = redis.pipeline();

  for (const [key, amount] of Object.entries(stats)) {
    pipeline.hincrby('stats:daily', key, amount);
  }

  await pipeline.exec();
}

/**
 * Busca múltiplas threads de uma vez (MGET)
 */
export async function getMultipleThreads(
  redis: Redis,
  conversationIds: number[]
): Promise<Array<{ threadId: string; metadata?: any } | null>> {
  if (conversationIds.length === 0) return [];

  // Busca todos de uma vez com pipeline
  const pipeline = redis.pipeline();
  
  for (const id of conversationIds) {
    pipeline.hgetall(`conv:${id}`);
  }

  const results = await pipeline.exec();

  return results.map((result: any) => {
    if (!result || !result.threadId) return null;
    return {
      threadId: result.threadId as string,
      metadata: result.metadata ? JSON.parse(result.metadata as string) : undefined,
    };
  });
}

// ==================== CACHE DE ASSISTENTES ====================

const ASSISTANTS_CACHE_KEY = 'assistants:all';
const ASSISTANTS_TTL = 3600; // 1 hora

/**
 * Busca assistentes com cache inteligente
 */
export async function getCachedAssistants(
  redis: Redis,
  fetcher: () => Promise<Record<string, string>>
): Promise<Record<string, string>> {
  return getCached(
    redis,
    ASSISTANTS_CACHE_KEY,
    fetcher,
    {
      localTTL: 60 * 60 * 1000,  // 1h cache local
      redisTTL: ASSISTANTS_TTL,   // 1h Redis
    }
  );
}

/**
 * Invalida cache de assistentes
 */
export function invalidateAssistantsCache(): void {
  localCache.delete(ASSISTANTS_CACHE_KEY);
}

// ==================== LOGS & MONITORING ====================

export function logCacheStats(): void {
  console.log('📊 [Cache Stats]', {
    localCacheSize: (localCache as any).cache.size,
    batchCounters: batchUpdater ? (batchUpdater as any).counters.size : 0,
  });
}
