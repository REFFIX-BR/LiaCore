import { redisConnection } from './redis-config';

/**
 * WhatsApp Rate Limiter - Token Bucket Implementation
 * 
 * Coordinates WhatsApp message sending across multiple workers to prevent
 * exceeding WhatsApp Business API rate limits (Tier 3: 10,000 conversations/day).
 * 
 * Configuration:
 * - Capacity: 6 tokens (sends/minute)
 * - Refill: 1 token every 10 seconds
 * - Shared across: whatsapp-collection worker + retry worker
 */

const REDIS_KEY = 'whatsapp:send_rate';
const CAPACITY = 6; // Max tokens (sends per minute)
const REFILL_RATE = 10; // Seconds per token
const TTL = 60; // Key TTL in seconds

/**
 * Lua script for atomic token bucket operations
 * Returns: number of tokens consumed (1 if successful, 0 if no tokens available)
 */
const TOKEN_BUCKET_LUA = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local refill_rate = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local ttl = tonumber(ARGV[4])
  
  -- Get current bucket state
  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens = tonumber(bucket[1])
  local last_refill = tonumber(bucket[2])
  
  -- Initialize if first time
  if not tokens then
    tokens = capacity
    last_refill = now
  end
  
  -- Calculate tokens to add based on time elapsed
  local elapsed = now - last_refill
  local tokens_to_add = math.floor(elapsed / refill_rate)
  
  if tokens_to_add > 0 then
    tokens = math.min(capacity, tokens + tokens_to_add)
    last_refill = last_refill + (tokens_to_add * refill_rate)
  end
  
  -- Try to consume 1 token
  if tokens > 0 then
    tokens = tokens - 1
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
    redis.call('EXPIRE', key, ttl)
    return 1 -- Success
  else
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
    redis.call('EXPIRE', key, ttl)
    return 0 -- No tokens available
  end
`;

export class WhatsAppRateLimiter {
  private scriptSha: string | null = null;

  constructor() {
    this.loadScript();
  }

  /**
   * Load Lua script into Redis (cached with SHA)
   */
  private async loadScript(): Promise<void> {
    try {
      this.scriptSha = await redisConnection.script('LOAD', TOKEN_BUCKET_LUA) as string;
      console.log(`✅ [Rate Limiter] Lua script loaded with SHA: ${this.scriptSha}`);
    } catch (error) {
      console.error('❌ [Rate Limiter] Failed to load Lua script:', error);
    }
  }

  /**
   * Acquire a token (non-blocking)
   * @returns true if token acquired, false if no tokens available
   */
  async acquireToken(): Promise<boolean> {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      let result: number;
      if (this.scriptSha) {
        try {
          result = await redisConnection.evalsha(
            this.scriptSha,
            1,
            REDIS_KEY,
            CAPACITY.toString(),
            REFILL_RATE.toString(),
            now.toString(),
            TTL.toString()
          ) as number;
        } catch (error) {
          // Script SHA might have been evicted, reload and retry
          await this.loadScript();
          result = await redisConnection.eval(
            TOKEN_BUCKET_LUA,
            1,
            REDIS_KEY,
            CAPACITY.toString(),
            REFILL_RATE.toString(),
            now.toString(),
            TTL.toString()
          ) as number;
        }
      } else {
        // Fallback: use eval directly
        result = await redisConnection.eval(
          TOKEN_BUCKET_LUA,
          1,
          REDIS_KEY,
          CAPACITY.toString(),
          REFILL_RATE.toString(),
          now.toString(),
          TTL.toString()
        ) as number;
      }

      const acquired = result === 1;
      
      if (!acquired) {
        console.log('⏸️  [Rate Limiter] No tokens available - rate limit reached');
      }
      
      return acquired;
    } catch (error) {
      console.error('❌ [Rate Limiter] Error acquiring token:', error);
      // Fail open: allow send on Redis error to prevent blocking all sends
      return true;
    }
  }

  /**
   * Get number of available tokens
   */
  async availableTokens(): Promise<number> {
    try {
      const bucket = await redisConnection.hmget(REDIS_KEY, 'tokens', 'last_refill');
      const tokens = parseInt(bucket[0] || CAPACITY.toString());
      const lastRefill = parseInt(bucket[1] || Math.floor(Date.now() / 1000).toString());
      
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - lastRefill;
      const tokensToAdd = Math.floor(elapsed / REFILL_RATE);
      
      return Math.min(CAPACITY, tokens + tokensToAdd);
    } catch (error) {
      console.error('❌ [Rate Limiter] Error checking tokens:', error);
      return CAPACITY; // Fail open
    }
  }

  /**
   * Wait for a token to become available (with jitter)
   * @param maxWaitMs Maximum time to wait in milliseconds (default: 30s)
   * @returns true if token acquired, false if timeout
   */
  async waitForToken(maxWaitMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const acquired = await this.acquireToken();
      if (acquired) {
        return true;
      }
      
      // Wait with jitter (8-12 seconds)
      const baseWait = 10000;
      const jitter = Math.random() * 4000 - 2000; // ±2s
      const waitMs = Math.max(1000, baseWait + jitter);
      
      console.log(`⏳ [Rate Limiter] Waiting ${Math.round(waitMs / 1000)}s for token...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    
    console.warn(`⚠️  [Rate Limiter] Timeout waiting for token after ${maxWaitMs}ms`);
    return false;
  }
}

// Singleton instance
export const whatsappRateLimiter = new WhatsAppRateLimiter();
