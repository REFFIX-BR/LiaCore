import { Index } from "@upstash/vector";
import { Redis } from "@upstash/redis";

export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface KnowledgeChunk {
  id: string;
  content: string;
  source: string;
  metadata?: Record<string, any>;
}

export async function searchKnowledge(query: string, topK: number = 5): Promise<Array<{
  chunk: KnowledgeChunk;
  score: number;
}>> {
  console.log(`🔍 [Upstash] Searching knowledge base:`, { query, topK });
  try {
    const results = await vectorIndex.query({
      data: query,
      topK,
      includeMetadata: true,
    });

    console.log(`✅ [Upstash] Found ${results.length} results`);
    
    return results.map(result => ({
      chunk: {
        id: String(result.id),
        content: result.metadata?.content as string || "",
        source: result.metadata?.source as string || "Unknown",
        metadata: result.metadata,
      },
      score: result.score,
    }));
  } catch (error) {
    console.error("❌ [Upstash] Error searching knowledge base:", error);
    return [];
  }
}

export async function storeConversationThread(chatId: string, threadId: string): Promise<void> {
  await redis.set(`thread:${chatId}`, threadId, { ex: 86400 * 7 }); // 7 days expiry
}

export async function getConversationThread(chatId: string): Promise<string | null> {
  return await redis.get(`thread:${chatId}`);
}

export async function updateConversationMetadata(chatId: string, metadata: Record<string, any>): Promise<void> {
  await redis.set(`metadata:${chatId}`, JSON.stringify(metadata), { ex: 86400 * 7 });
}

export async function getConversationMetadata(chatId: string): Promise<Record<string, any> | null> {
  const data = await redis.get(`metadata:${chatId}`);
  return data ? JSON.parse(data as string) : null;
}

export async function addKnowledgeChunk(
  id: string,
  content: string,
  source: string,
  metadata?: Record<string, any>
): Promise<void> {
  console.log("🔵 [Upstash] Adding knowledge chunk:", { id, source });
  try {
    const result = await vectorIndex.upsert({
      id,
      data: content,
      metadata: {
        content,
        source,
        ...metadata,
      },
    });
    console.log("✅ [Upstash] Chunk added successfully:", { id, result });
  } catch (error) {
    console.error("❌ [Upstash] Error adding chunk:", error);
    throw error;
  }
}

export async function addKnowledgeChunks(
  chunks: Array<{
    id: string;
    content: string;
    source: string;
    metadata?: Record<string, any>;
  }>
): Promise<void> {
  console.log(`🔵 [Upstash] Adding ${chunks.length} knowledge chunks`);
  try {
    const upsertData = chunks.map(chunk => ({
      id: chunk.id,
      data: chunk.content,
      metadata: {
        content: chunk.content,
        source: chunk.source,
        ...chunk.metadata,
      },
    }));

    const result = await vectorIndex.upsert(upsertData);
    console.log(`✅ [Upstash] ${chunks.length} chunks added successfully:`, result);
  } catch (error) {
    console.error("❌ [Upstash] Error adding chunks:", error);
    throw error;
  }
}

export async function deleteKnowledgeChunk(id: string): Promise<void> {
  await vectorIndex.delete(id);
}

export async function clearKnowledgeBase(): Promise<void> {
  await vectorIndex.reset();
}
