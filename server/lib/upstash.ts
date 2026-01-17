import { Index } from "@upstash/vector";
import { generateEmbedding } from "./openai";
import { redis, knowledgeCache, metadataCache } from "./redis-config";

export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

// Re-export redis from centralized config
export { redis };

export interface KnowledgeChunk {
  id: string;
  name?: string;
  content: string;
  source: string;
  metadata?: Record<string, any>;
}

// OTIMIZAÇÃO DE CUSTO: Reduzido topK de 20 para 5 (economia 75% nos tokens de contexto RAG)
export async function searchKnowledge(query: string, topK: number = 5): Promise<Array<{
  chunk: KnowledgeChunk;
  score: number;
}>> {
  console.log(`🔍 [Upstash] Searching knowledge base:`, { query, topK });
  
  // Create cache key based on query and topK
  const cacheKey = `search:${query.toLowerCase().trim()}:${topK}`;
  
  // Try to get from cache first
  const cached = await knowledgeCache.get<Array<{ chunk: KnowledgeChunk; score: number }>>(cacheKey);
  if (cached) {
    console.log(`💾 [Cache] Knowledge search HIT:`, { query, results: cached.length });
    return cached;
  }
  
  try {
    const queryEmbedding = await generateEmbedding(query);
    
    const results = await vectorIndex.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    const formattedResults = results.map(result => ({
      chunk: {
        id: String(result.id),
        name: result.metadata?.name as string || undefined,
        content: result.metadata?.content as string || "",
        source: result.metadata?.source as string || "Unknown",
        metadata: result.metadata,
      },
      score: result.score,
    }));

    // Cache results for 1 hour with 'knowledge' tag for invalidation
    await knowledgeCache.set(cacheKey, formattedResults, { 
      ttl: 3600, // 1 hour
      tags: ['knowledge-search'] 
    });
    
    console.log(`✅ [Upstash] Found ${formattedResults.length} results (cached)`);
    return formattedResults;
  } catch (error) {
    console.error("❌ [Upstash] Error searching knowledge base:", error);
    return [];
  }
}

export async function storeConversationThread(chatId: string, threadId: string, metadata?: Record<string, any>): Promise<void> {
  try {
    // ✨ OTIMIZAÇÃO: Pipeline para salvar thread + metadata em 1 request (se suportado)
    if (typeof redis.pipeline === 'function') {
      const pipeline = redis.pipeline();
      
      // Salva thread
      pipeline.set(`thread:${chatId}`, threadId, { ex: 86400 * 7 });
      
      // Salva metadata se fornecido
      if (metadata) {
        pipeline.set(`metadata:${chatId}`, JSON.stringify(metadata), { ex: 86400 * 7 });
      }
      
      await pipeline.exec();
      console.log(`💾 [Optimized] Thread + metadata saved in 1 request`);
    } else {
      // Fallback: operações individuais (para Upstash REST que não suporta pipeline)
      await redis.set(`thread:${chatId}`, threadId, { ex: 86400 * 7 });
      
      if (metadata) {
        await redis.set(`metadata:${chatId}`, JSON.stringify(metadata), { ex: 86400 * 7 });
      }
      console.log(`💾 [Fallback] Thread + metadata saved (2 requests)`);
    }
  } catch (error) {
    console.error(`❌ [Upstash] Error storing conversation thread:`, error);
    // Não falhar o webhook por causa disso - continuar processamento
  }
  
  // Cache local para metadata (não faz request Redis)
  if (metadata) {
    await metadataCache.set(chatId, metadata, { 
      ttl: 3600,
      tags: [`conv:${chatId}`] 
    });
  }
}

export async function getConversationThread(chatId: string): Promise<string | null> {
  return await redis.get(`thread:${chatId}`);
}

export async function updateConversationMetadata(chatId: string, metadata: Record<string, any>): Promise<void> {
  // Store in Redis with 7 days TTL
  await redis.set(`metadata:${chatId}`, JSON.stringify(metadata), { ex: 86400 * 7 });
  
  // Also update cache for faster access (1 hour TTL)
  await metadataCache.set(chatId, metadata, { 
    ttl: 3600,
    tags: [`conv:${chatId}`] 
  });
  
  console.log(`💾 [Cache] Metadata updated for chat ${chatId}`);
}

export async function getConversationMetadata(chatId: string): Promise<Record<string, any> | null> {
  // Try cache first (read-through cache pattern)
  const cached = await metadataCache.get<Record<string, any>>(chatId);
  if (cached) {
    console.log(`💾 [Cache] Metadata HIT for chat ${chatId}`);
    return cached;
  }
  
  // If not in cache, get from Redis and populate cache
  const data = await redis.get(`metadata:${chatId}`);
  if (data) {
    const metadata = typeof data === 'string' ? JSON.parse(data) : data;
    
    // Populate cache for next time
    await metadataCache.set(chatId, metadata, { 
      ttl: 3600,
      tags: [`conv:${chatId}`] 
    });
    
    console.log(`💾 [Cache] Metadata MISS for chat ${chatId} - cached for next time`);
    return metadata;
  }
  
  return null;
}

export async function addKnowledgeChunk(
  id: string,
  content: string,
  source: string,
  name?: string,
  metadata?: Record<string, any>
): Promise<void> {
  console.log("🔵 [Upstash] Adding knowledge chunk:", { id, name, source });
  try {
    const embedding = await generateEmbedding(content);
    
    const result = await vectorIndex.upsert({
      id,
      vector: embedding,
      metadata: {
        name,
        content,
        source,
        ...metadata,
      },
    });
    
    // Invalidate knowledge search cache when KB is updated
    await knowledgeCache.invalidateByTag('knowledge-search');
    console.log("✅ [Upstash] Chunk added successfully and cache invalidated:", { id, result });
  } catch (error) {
    console.error("❌ [Upstash] Error adding chunk:", error);
    throw error;
  }
}

export async function addKnowledgeChunks(
  chunks: Array<{
    id: string;
    name?: string;
    content: string;
    source: string;
    metadata?: Record<string, any>;
  }>
): Promise<void> {
  console.log(`🔵 [Upstash] Adding ${chunks.length} knowledge chunks`);
  try {
    const upsertData = await Promise.all(
      chunks.map(async (chunk) => {
        const embedding = await generateEmbedding(chunk.content);
        return {
          id: chunk.id,
          vector: embedding,
          metadata: {
            name: chunk.name,
            content: chunk.content,
            source: chunk.source,
            ...chunk.metadata,
          },
        };
      })
    );

    const result = await vectorIndex.upsert(upsertData);
    
    // Invalidate knowledge search cache when KB is updated
    await knowledgeCache.invalidateByTag('knowledge-search');
    console.log(`✅ [Upstash] ${chunks.length} chunks added successfully and cache invalidated:`, result);
  } catch (error) {
    console.error("❌ [Upstash] Error adding chunks:", error);
    throw error;
  }
}

export async function deleteKnowledgeChunk(id: string): Promise<void> {
  await vectorIndex.delete(id);
  // Invalidate knowledge search cache when KB is updated
  await knowledgeCache.invalidateByTag('knowledge-search');
  console.log(`✅ [Upstash] Chunk deleted and cache invalidated:`, { id });
}

export async function clearKnowledgeBase(): Promise<void> {
  await vectorIndex.reset();
  // Invalidate all knowledge search cache when KB is cleared
  await knowledgeCache.invalidateByTag('knowledge-search');
  console.log(`✅ [Upstash] Knowledge base cleared and cache invalidated`);
}
