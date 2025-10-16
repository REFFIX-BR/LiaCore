import { redisConnection } from "./redis-config";

/**
 * Sistema de Debouncing/Batching de Mensagens
 * 
 * Agrupa mensagens que chegam em sequência rápida do mesmo cliente
 * para evitar múltiplas respostas da IA
 */

const DEBOUNCE_WINDOW_MS = 3000; // 3 segundos de espera após última mensagem
const BATCH_KEY_PREFIX = "msg_batch:";
const TIMER_KEY_PREFIX = "msg_timer:";
const BATCH_TTL = 60; // TTL de 60 segundos para segurança

export interface PendingMessage {
  chatId: string;
  conversationId: string;
  message: string;
  fromNumber: string;
  messageId?: string;
  timestamp: number;
  evolutionInstance?: string;
  clientName: string;
  hasImage: boolean;
  imageUrl?: string;
  receivedAt: number; // Quando foi recebida
}

/**
 * Adiciona mensagem ao batch ou retorna mensagens prontas para processar
 */
export async function addToBatch(
  chatId: string, 
  messageData: PendingMessage
): Promise<{ shouldProcess: boolean; messages: PendingMessage[] }> {
  const batchKey = `${BATCH_KEY_PREFIX}${chatId}`;
  const timerKey = `${TIMER_KEY_PREFIX}${chatId}`;
  
  try {
    // Adiciona mensagem ao batch
    const batch = await getBatch(chatId);
    batch.push(messageData);
    
    // Salva batch atualizado com TTL
    await redisConnection.setex(
      batchKey,
      BATCH_TTL,
      JSON.stringify(batch)
    );
    
    // Verifica se há timer ativo
    const hasTimer = await redisConnection.exists(timerKey);
    
    if (hasTimer) {
      // Já existe timer - apenas adiciona mensagem e reseta timer
      console.log(`⏱️  [Batch] Timer ativo para ${chatId} - adicionando mensagem ${batch.length} ao batch`);
      
      // Reseta timer (renova TTL)
      await redisConnection.setex(
        timerKey,
        Math.ceil(DEBOUNCE_WINDOW_MS / 1000),
        Date.now().toString()
      );
      
      return { 
        shouldProcess: false, 
        messages: [] 
      };
    } else {
      // Primeiro mensagem ou timer expirado - cria novo timer
      console.log(`🆕 [Batch] Criando novo timer para ${chatId} (${DEBOUNCE_WINDOW_MS}ms)`);
      
      // Cria timer
      await redisConnection.setex(
        timerKey,
        Math.ceil(DEBOUNCE_WINDOW_MS / 1000),
        Date.now().toString()
      );
      
      // Agenda verificação após debounce window
      setTimeout(async () => {
        await processWhenReady(chatId);
      }, DEBOUNCE_WINDOW_MS);
      
      return { 
        shouldProcess: false, 
        messages: [] 
      };
    }
  } catch (error) {
    console.error(`❌ [Batch] Erro ao processar batch:`, error);
    // Em caso de erro, processar imediatamente (fallback seguro)
    return { 
      shouldProcess: true, 
      messages: [messageData] 
    };
  }
}

/**
 * Obtém batch atual de mensagens
 */
async function getBatch(chatId: string): Promise<PendingMessage[]> {
  const batchKey = `${BATCH_KEY_PREFIX}${chatId}`;
  
  try {
    const batchData = await redisConnection.get(batchKey);
    
    if (!batchData) {
      return [];
    }
    
    return JSON.parse(batchData) as PendingMessage[];
  } catch (error) {
    console.error(`❌ [Batch] Erro ao ler batch:`, error);
    return [];
  }
}

/**
 * Processa batch quando timer expirar
 */
async function processWhenReady(chatId: string): Promise<void> {
  const batchKey = `${BATCH_KEY_PREFIX}${chatId}`;
  const timerKey = `${TIMER_KEY_PREFIX}${chatId}`;
  
  try {
    // Verifica se ainda existe timer (pode ter sido resetado)
    const timerExists = await redisConnection.exists(timerKey);
    
    if (timerExists) {
      // Timer ainda ativo - não processar ainda
      console.log(`⏸️  [Batch] Timer ainda ativo para ${chatId} - aguardando...`);
      return;
    }
    
    // Timer expirou - processar batch
    const batch = await getBatch(chatId);
    
    if (batch.length === 0) {
      console.log(`📭 [Batch] Batch vazio para ${chatId} - nada a processar`);
      return;
    }
    
    console.log(`✅ [Batch] Timer expirado para ${chatId} - processando ${batch.length} mensagem(ns)`);
    
    // Combina todas as mensagens em uma só
    const combinedMessage = batch.map(m => m.message).join('\n');
    
    // Usa dados da primeira mensagem como base
    const firstMessage = batch[0];
    const lastMessage = batch[batch.length - 1];
    
    // Processa mensagem combinada
    const { addMessageToQueue } = await import("./queue");
    
    await addMessageToQueue({
      chatId: firstMessage.chatId,
      conversationId: firstMessage.conversationId,
      message: combinedMessage,
      fromNumber: firstMessage.fromNumber,
      messageId: lastMessage.messageId || `batch_${Date.now()}`, // ID da última mensagem ou gera um
      timestamp: lastMessage.timestamp,
      evolutionInstance: firstMessage.evolutionInstance || undefined,
      clientName: firstMessage.clientName,
      hasImage: batch.some(m => m.hasImage), // Se alguma tem imagem
      imageUrl: batch.find(m => m.imageUrl)?.imageUrl, // Primeira imagem encontrada
    }, 1);
    
    console.log(`📬 [Batch] ${batch.length} mensagem(ns) combinadas e enfileiradas para ${chatId}`);
    
    // Limpa batch
    await redisConnection.del(batchKey);
    
  } catch (error) {
    console.error(`❌ [Batch] Erro ao processar batch quando pronto:`, error);
    // Em caso de erro, limpar batch para não ficar travado
    await redisConnection.del(batchKey);
    await redisConnection.del(timerKey);
  }
}

/**
 * Limpa batch de um chat (útil para testes ou limpeza manual)
 */
export async function clearBatch(chatId: string): Promise<void> {
  const batchKey = `${BATCH_KEY_PREFIX}${chatId}`;
  const timerKey = `${TIMER_KEY_PREFIX}${chatId}`;
  
  await redisConnection.del(batchKey);
  await redisConnection.del(timerKey);
  
  console.log(`🧹 [Batch] Batch limpo para ${chatId}`);
}
