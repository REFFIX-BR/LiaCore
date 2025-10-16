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
  hasAudio?: boolean;
  audioUrl?: string;
  hasPdf?: boolean;
  pdfBase64?: string;
  pdfName?: string;
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
    // 🚫 NÃO fazer batching de mensagens com mídia (imagens/audio/PDF)
    // Processar imediatamente para evitar perda de anexos múltiplos
    const hasMedia = messageData.hasImage || messageData.hasAudio || messageData.hasPdf;
    
    if (hasMedia) {
      console.log(`📸 [Batch] Mensagem com mídia detectada - processando imediatamente (sem batching)`);
      return { 
        shouldProcess: true, 
        messages: [messageData] 
      };
    }
    
    // Adiciona mensagem de TEXTO PURO ao batch
    const batch = await getBatch(chatId);
    batch.push(messageData);
    
    // Salva batch atualizado com TTL
    await redisConnection.setex(
      batchKey,
      BATCH_TTL,
      JSON.stringify(batch)
    );
    
    // Atualiza timer com timestamp atual
    const now = Date.now();
    await redisConnection.setex(
      timerKey,
      Math.ceil(DEBOUNCE_WINDOW_MS / 1000) + 1, // +1 segundo extra para segurança
      now.toString()
    );
    
    console.log(`📦 [Batch] Mensagem de texto adicionada ao batch para ${chatId} (${batch.length} no total)`);
    
    // SEMPRE agenda verificação após debounce window
    // A verificação vai checar se passaram 3s desde o último update
    setTimeout(async () => {
      await processWhenReady(chatId);
    }, DEBOUNCE_WINDOW_MS);
    
    return { 
      shouldProcess: false, 
      messages: [] 
    };
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
    // Pega timestamp do timer
    const timerValue = await redisConnection.get(timerKey);
    
    if (timerValue) {
      const lastUpdateTime = parseInt(timerValue);
      const now = Date.now();
      const elapsed = now - lastUpdateTime;
      
      // Se passaram menos de 3 segundos desde última atualização, aguardar
      if (elapsed < DEBOUNCE_WINDOW_MS) {
        console.log(`⏸️  [Batch] Timer ainda recente para ${chatId} (${elapsed}ms < ${DEBOUNCE_WINDOW_MS}ms) - aguardando...`);
        return;
      }
    }
    
    // Timer expirou ou não existe - processar batch
    const batch = await getBatch(chatId);
    
    if (batch.length === 0) {
      console.log(`📭 [Batch] Batch vazio para ${chatId} - nada a processar`);
      return;
    }
    
    console.log(`✅ [Batch] Período de silêncio completo para ${chatId} - processando ${batch.length} mensagem(ns)`);
    
    // 🚫 GUARDA: Detectar se batch contém mídia (edge case de batches antigos)
    // Se encontrar mídia, processar cada mensagem individualmente para preservar anexos
    const hasMediaInBatch = batch.some(m => m.hasImage || m.hasAudio || m.hasPdf);
    
    const { addMessageToQueue } = await import("./queue");
    
    if (hasMediaInBatch) {
      console.warn(`⚠️ [Batch] Batch contém mídia - processando mensagens individualmente para preservar todos os anexos`);
      
      // Processar cada mensagem individualmente com TODOS os metadados de mídia
      for (let i = 0; i < batch.length; i++) {
        const msg = batch[i];
        await addMessageToQueue({
          chatId: msg.chatId,
          conversationId: msg.conversationId,
          message: msg.message,
          fromNumber: msg.fromNumber,
          messageId: msg.messageId || `batch_replay_${Date.now()}_${i}`, // ID único por mensagem
          timestamp: msg.timestamp,
          evolutionInstance: msg.evolutionInstance || undefined,
          clientName: msg.clientName,
          hasImage: msg.hasImage,
          imageUrl: msg.imageUrl,
        }, 1);
        
        // Log metadados preservados
        if (msg.hasImage || msg.hasAudio || msg.hasPdf) {
          console.log(`📸 [Batch Replay] Mídia preservada:`, {
            hasImage: msg.hasImage,
            hasAudio: msg.hasAudio,
            hasPdf: msg.hasPdf,
            imageUrl: msg.imageUrl?.substring(0, 50),
            audioUrl: msg.audioUrl?.substring(0, 50),
            pdfName: msg.pdfName
          });
        }
      }
      
      console.log(`📬 [Batch] ${batch.length} mensagem(ns) com mídia processadas individualmente com todos os anexos preservados`);
    } else {
      // Batch de texto puro - combinar normalmente
      const combinedMessage = batch.map(m => m.message).join('\n');
      
      // Usa dados da primeira mensagem como base
      const firstMessage = batch[0];
      const lastMessage = batch[batch.length - 1];
      
      await addMessageToQueue({
        chatId: firstMessage.chatId,
        conversationId: firstMessage.conversationId,
        message: combinedMessage,
        fromNumber: firstMessage.fromNumber,
        messageId: lastMessage.messageId || `batch_${Date.now()}`,
        timestamp: lastMessage.timestamp,
        evolutionInstance: firstMessage.evolutionInstance || undefined,
        clientName: firstMessage.clientName,
        hasImage: false,
        imageUrl: undefined,
      }, 1);
      
      console.log(`📬 [Batch] ${batch.length} mensagem(ns) de texto combinadas e enfileiradas para ${chatId}`);
    }
    
    // Limpa batch e timer
    await redisConnection.del(batchKey);
    await redisConnection.del(timerKey);
    
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
