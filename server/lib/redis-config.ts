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
    rejectUnauthorized: false, // Upstash uses self-signed certs
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
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await redis.sadd(`tag:${tag}`, this.getKey(key));
          await redis.expire(`tag:${tag}`, ttl);
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
