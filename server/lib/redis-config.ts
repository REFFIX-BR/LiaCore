import IORedis from 'ioredis';
import { Redis } from "@upstash/redis";

// =============================================================================
// UPSTASH REDIS CONFIGURATION
// =============================================================================

// REST API client (for general use - threads, cache, metadata)
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// TCP/TLS client for BullMQ (requires IORedis)
// Using Upstash-compatible configuration
export const redisConnection = new IORedis({
  host: process.env.UPSTASH_REDIS_HOST!,
  port: parseInt(process.env.UPSTASH_REDIS_PORT || '6379'),
  password: process.env.UPSTASH_REDIS_PASSWORD!,
  
  // ===== CONNECTION POOLING OPTIMIZATION =====
  maxRetriesPerRequest: null, // Required for BullMQ blocking operations
  enableReadyCheck: false,
  lazyConnect: false,
  keepAlive: 30000, // Keep connection alive for 30s
  connectTimeout: 10000, // 10s timeout for initial connection
  
  // TLS configuration for Upstash
  tls: {
    // Upstash provides valid certificates, use standard validation
  },
  
  // Retry strategy
  retryStrategy(times) {
    if (times > 10) {
      console.error('❌ [Redis] Max retries reached, giving up');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 50, 2000);
    console.log(`🔄 [Redis] Retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  
  // Reconnect on error
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Reconnect on READONLY errors (happens during failover)
      return true;
    }
    return false;
  },
});

// Connection event handlers
redisConnection.on('connect', () => {
  console.log('✅ [Redis] Connected to Upstash');
});

redisConnection.on('ready', () => {
  console.log('✅ [Redis] Ready to accept commands');
});

redisConnection.on('error', (err) => {
  console.error('❌ [Redis] Connection error:', err.message);
});

redisConnection.on('close', () => {
  console.log('🔌 [Redis] Connection closed');
});

redisConnection.on('reconnecting', () => {
  console.log('🔄 [Redis] Reconnecting...');
});

// =============================================================================
// CACHE UTILITIES
// =============================================================================

interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 1 hour)
  tags?: string[]; // Cache tags for invalidation
}

export class RedisCache {
  private prefix: string;

  constructor(prefix: string = 'cache') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(this.getKey(key));
      if (!value) return null;
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (error) {
      console.error(`❌ [Cache] Error getting key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || 3600; // Default 1 hour
      const serialized = JSON.stringify(value);
      await redis.set(this.getKey(key), serialized, { ex: ttl });
      
      // Store tags for invalidation
      // Tag TTL must be longer than any cached value to ensure invalidation works
      if (options.tags && options.tags.length > 0) {
        const tagTtl = ttl + 3600; // Tag lives 1 hour longer than content
        for (const tag of options.tags) {
          await redis.sadd(`tag:${tag}`, this.getKey(key));
          // Get current tag TTL to ensure we always use the longest one
          const currentTtl = await redis.ttl(`tag:${tag}`);
          if (currentTtl === -1 || currentTtl < tagTtl) {
            await redis.expire(`tag:${tag}`, tagTtl);
          }
        }
      }
    } catch (error) {
      console.error(`❌ [Cache] Error setting key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redis.del(this.getKey(key));
    } catch (error) {
      console.error(`❌ [Cache] Error deleting key ${key}:`, error);
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    try {
      const keys = await redis.smembers(`tag:${tag}`);
      if (keys && keys.length > 0) {
        await redis.del(...keys);
        await redis.del(`tag:${tag}`);
        console.log(`🗑️ [Cache] Invalidated ${keys.length} keys with tag "${tag}"`);
      }
    } catch (error) {
      console.error(`❌ [Cache] Error invalidating tag ${tag}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await redis.keys(`${this.prefix}:*`);
      if (keys && keys.length > 0) {
        await redis.del(...keys);
        console.log(`🗑️ [Cache] Cleared ${keys.length} keys`);
      }
    } catch (error) {
      console.error(`❌ [Cache] Error clearing cache:`, error);
    }
  }
}

// Pre-configured cache instances for common use cases
export const faqCache = new RedisCache('faq');
export const metadataCache = new RedisCache('metadata');
export const assistantCache = new RedisCache('assistant');
export const knowledgeCache = new RedisCache('knowledge');

// =============================================================================
// OPTIMIZED CACHE WITH LOCAL MEMORY
// =============================================================================

import { getCached, localCache } from './redis-cache';

/**
 * 🚀 Cache híbrido para Assistants (quase nunca mudam)
 * - Local: 1 hora (0 requests Redis)
 * - Redis: 6 horas (backup distribuído)
 */
export async function getCachedAssistants(
  fetcher: () => Promise<Record<string, string>>
): Promise<Record<string, string>> {
  return getCached(
    redis,
    'assistants:all',
    fetcher,
    {
      localTTL: 60 * 60 * 1000,  // 1h local (quase nenhum request)
      redisTTL: 6 * 3600,         // 6h Redis
    }
  );
}

/**
 * Invalida cache de assistants (quando atualizados)
 */
export function invalidateAssistantsCache(): void {
  localCache.delete('assistants:all');
  redis.del('assistants:all').catch(err => 
    console.error('❌ [Cache] Error invalidating assistants:', err)
  );
  console.log('🗑️ [Cache] Assistants cache invalidated');
}

// =============================================================================
// EPHEMERAL INSTALLATION POINT SELECTION SYSTEM
// =============================================================================

export interface InstallationPointMenuItem {
  numero: number;
  endereco: string;
  bairro: string;
  cidade: string;
  login?: string;
  totalBoletos: number;
  totalVencidos: number;
  valorTotal: number;
  keywords: string[]; // Para matching textual: ['amazonas', 'cariri', '3', 'terceiro']
}

export interface InstallationPointMenu {
  conversationId: string;
  cpf: string;
  pontos: InstallationPointMenuItem[];
  createdAt: number;
}

/**
 * Sistema efêmero para gerenciar seleção de pontos de instalação
 * - TTL: 5 minutos (tempo suficiente para cliente escolher)
 * - Não persiste no banco de dados
 * - Cada consulta de boleto recomeça do zero
 */
export class InstallationPointSelectionManager {
  private readonly MENU_TTL = 300; // 5 minutos
  private readonly FLAG_TTL = 300; // 5 minutos
  
  /**
   * Salva menu de pontos de instalação no Redis (efêmero)
   */
  async saveMenu(menu: InstallationPointMenu): Promise<void> {
    try {
      const key = `menu:boleto:${menu.conversationId}`;
      await redis.set(key, JSON.stringify(menu), { ex: this.MENU_TTL });
      
      // Marca flag indicando que conversa está aguardando seleção
      await this.setAwaitingSelection(menu.conversationId, true);
      
      console.log(`💾 [Boleto Menu] Menu salvo para conversa ${menu.conversationId} (${menu.pontos.length} pontos, TTL: ${this.MENU_TTL}s)`);
    } catch (error) {
      console.error(`❌ [Boleto Menu] Erro ao salvar menu:`, error);
      throw error;
    }
  }
  
  /**
   * Recupera menu de pontos de instalação do Redis
   */
  async getMenu(conversationId: string): Promise<InstallationPointMenu | null> {
    try {
      const key = `menu:boleto:${conversationId}`;
      const data = await redis.get(key);
      
      if (!data) {
        console.log(`💾 [Boleto Menu] Menu não encontrado para conversa ${conversationId} (expirou ou nunca foi criado)`);
        return null;
      }
      
      const menu = typeof data === 'string' ? JSON.parse(data) : data;
      console.log(`💾 [Boleto Menu] Menu recuperado para conversa ${conversationId} (${menu.pontos?.length || 0} pontos)`);
      return menu;
    } catch (error) {
      console.error(`❌ [Boleto Menu] Erro ao recuperar menu:`, error);
      return null;
    }
  }
  
  /**
   * Remove menu do Redis (após processamento ou timeout)
   */
  async deleteMenu(conversationId: string): Promise<void> {
    try {
      const key = `menu:boleto:${conversationId}`;
      await redis.del(key);
      
      // Remove flag de awaiting selection
      await this.setAwaitingSelection(conversationId, false);
      
      console.log(`🗑️ [Boleto Menu] Menu removido para conversa ${conversationId}`);
    } catch (error) {
      console.error(`❌ [Boleto Menu] Erro ao remover menu:`, error);
    }
  }
  
  /**
   * Define se conversa está aguardando seleção de ponto
   */
  async setAwaitingSelection(conversationId: string, awaiting: boolean): Promise<void> {
    try {
      const key = `awaiting:point:${conversationId}`;
      
      if (awaiting) {
        await redis.set(key, '1', { ex: this.FLAG_TTL });
        console.log(`🚩 [Boleto Selection] Flag ATIVA para conversa ${conversationId} (TTL: ${this.FLAG_TTL}s)`);
      } else {
        await redis.del(key);
        console.log(`🚩 [Boleto Selection] Flag REMOVIDA para conversa ${conversationId}`);
      }
    } catch (error) {
      console.error(`❌ [Boleto Selection] Erro ao definir flag:`, error);
    }
  }
  
  /**
   * Verifica se conversa está aguardando seleção de ponto
   */
  async isAwaitingSelection(conversationId: string): Promise<boolean> {
    try {
      const key = `awaiting:point:${conversationId}`;
      const value = await redis.get(key);
      const awaiting = value === '1';
      
      console.log(`🚩 [Boleto Selection] Conversa ${conversationId} aguardando seleção: ${awaiting}`);
      return awaiting;
    } catch (error) {
      console.error(`❌ [Boleto Selection] Erro ao verificar flag:`, error);
      return false;
    }
  }
  
  /**
   * Mapeia resposta do cliente (textual ou ordinal) para número do ponto
   * Exemplos: "3", "terceiro", "amazonas", "cariri" → 3
   */
  mapClientResponseToPointNumber(
    clientMessage: string,
    menu: InstallationPointMenu
  ): number | null {
    const messageLower = clientMessage.toLowerCase().trim();
    
    // 1. Tentar número direto: "3", "4"
    const directNumber = parseInt(messageLower);
    if (!isNaN(directNumber) && directNumber >= 1 && directNumber <= menu.pontos.length) {
      const ponto = menu.pontos.find(p => p.numero === directNumber);
      if (ponto) {
        console.log(`🎯 [Boleto Mapping] Cliente escolheu ponto ${directNumber} via número direto`);
        return directNumber;
      }
    }
    
    // 2. Tentar ordinais por extenso: "primeiro", "segunda", "terceiro"
    const ordinaisMap: Record<string, number> = {
      'primeiro': 1, 'primeira': 1,
      'segundo': 2, 'segunda': 2,
      'terceiro': 3, 'terceira': 3,
      'quarto': 4, 'quarta': 4,
      'quinto': 5, 'quinta': 5
    };
    
    for (const [ordinal, numero] of Object.entries(ordinaisMap)) {
      if (messageLower.includes(ordinal)) {
        const ponto = menu.pontos.find(p => p.numero === numero);
        if (ponto) {
          console.log(`🎯 [Boleto Mapping] Cliente escolheu ponto ${numero} via ordinal "${ordinal}"`);
          return numero;
        }
      }
    }
    
    // 3. Tentar matching por keywords (endereço, bairro)
    for (const ponto of menu.pontos) {
      for (const keyword of ponto.keywords) {
        if (messageLower.includes(keyword)) {
          console.log(`🎯 [Boleto Mapping] Cliente escolheu ponto ${ponto.numero} via keyword "${keyword}"`);
          return ponto.numero;
        }
      }
    }
    
    console.log(`❌ [Boleto Mapping] Não foi possível mapear "${clientMessage}" para nenhum ponto`);
    return null;
  }
}

// Instância global para uso em toda a aplicação
export const installationPointManager = new InstallationPointSelectionManager();
