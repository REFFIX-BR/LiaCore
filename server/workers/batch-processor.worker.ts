/**
 * Worker para Processamento Persistente de Batches
 * 
 * Substitui setTimeout volátil por jobs BullMQ garantidos pelo Redis.
 * Jobs sobrevivem a reinicializações e são processados mesmo sob alta carga.
 */

import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis-config';
import { QUEUE_NAMES, type BatchProcessingJob } from '../lib/queue';

const BATCH_KEY_PREFIX = "msg_batch:";
const TIMER_KEY_PREFIX = "msg_timer:";

/**
 * Processa batch quando job do Redis disparar
 */
async function processBatchJob(job: Job<BatchProcessingJob>) {
  const { chatId, timerValue } = job.data;
  
  console.log(`\n🔄 [Batch Worker] Job disparado para ${chatId}`);
  console.log(`   Timer esperado: ${timerValue}`);
  console.log(`   Job ID: ${job.id}`);
  
  const batchKey = `${BATCH_KEY_PREFIX}${chatId}`;
  const timerKey = `${TIMER_KEY_PREFIX}${chatId}`;
  
  try {
    // Pega timestamp atual do timer
    const currentTimerValue = await redisConnection.get(timerKey);
    console.log(`🔍 [Batch Worker] Timer atual: ${currentTimerValue}`);
    
    // Se timer mudou, nova mensagem chegou - não processar ainda
    if (currentTimerValue && currentTimerValue !== timerValue) {
      console.log(`⏸️  [Batch Worker] Timer mudou (${timerValue} → ${currentTimerValue}) - novo job foi agendado`);
      return { skipped: true, reason: 'timer_updated' };
    }
    
    // Timer não mudou ou expirou - processar batch ATOMICAMENTE
    // Lua script para ler e deletar batch SOMENTE se timer não mudou (previne race condition)
    const luaScript = `
      local expectedTimer = ARGV[1]
      local currentTimer = redis.call('GET', KEYS[2])
      
      -- Se timer mudou, nova mensagem chegou - não processar
      if currentTimer ~= nil and currentTimer ~= expectedTimer then
        return {}
      end
      
      -- Timer não mudou ou expirou - processar batch
      local batch = redis.call('LRANGE', KEYS[1], 0, -1)
      if #batch > 0 then
        redis.call('DEL', KEYS[1])
        redis.call('DEL', KEYS[2])
      end
      return batch
    `;
    
    const batchItems = await redisConnection.eval(
      luaScript,
      2,
      batchKey,
      timerKey,
      timerValue
    ) as string[];
    
    if (!batchItems || batchItems.length === 0) {
      console.log(`📭 [Batch Worker] Batch vazio para ${chatId} - nada a processar`);
      return { processed: false, reason: 'empty_batch' };
    }
    
    // Parse mensagens do batch
    const batch = batchItems.map(item => JSON.parse(item));
    
    console.log(`✅ [Batch Worker] Processando ${batch.length} mensagem(ns) de ${chatId}`);
    
    // 🚫 GUARDA: Detectar se batch contém mídia (edge case de batches antigos)
    const hasMediaInBatch = batch.some((m: any) => m.hasImage || m.hasAudio || m.hasPdf);
    
    const { addMessageToQueue } = await import("../lib/queue");
    
    if (hasMediaInBatch) {
      console.warn(`⚠️ [Batch Worker] Batch contém mídia - processando mensagens individualmente`);
      
      // Processar cada mensagem individualmente com TODOS os metadados de mídia
      for (let i = 0; i < batch.length; i++) {
        const msg = batch[i];
        await addMessageToQueue({
          chatId: msg.chatId,
          conversationId: msg.conversationId,
          message: msg.message,
          fromNumber: msg.fromNumber,
          messageId: msg.messageId || `batch_replay_${Date.now()}_${i}`,
          timestamp: msg.timestamp,
          evolutionInstance: msg.evolutionInstance || undefined,
          clientName: msg.clientName,
          hasImage: msg.hasImage,
          imageUrl: msg.imageUrl,
        }, 1);
      }
      
      console.log(`📬 [Batch Worker] ${batch.length} mensagem(ns) com mídia processadas individualmente`);
    } else {
      // Batch de texto puro - combinar normalmente
      const combinedMessage = batch.map((m: any) => m.message).join('\n');
      
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
      
      console.log(`📬 [Batch Worker] ${batch.length} mensagem(ns) de texto combinadas e enfileiradas`);
    }
    
    return { 
      processed: true, 
      messageCount: batch.length,
      combined: !hasMediaInBatch 
    };
    
  } catch (error) {
    console.error(`❌ [Batch Worker] Erro ao processar batch:`, error);
    
    // Em caso de erro, limpar batch para não ficar travado
    try {
      await redisConnection.del(batchKey);
      await redisConnection.del(timerKey);
      console.log(`🧹 [Batch Worker] Batch limpo após erro`);
    } catch (cleanupError) {
      console.error(`❌ [Batch Worker] Erro ao limpar batch:`, cleanupError);
    }
    
    throw error; // Re-throw para BullMQ registrar como falha
  }
}

// Criar worker BullMQ
export const batchProcessorWorker = new Worker(
  QUEUE_NAMES.BATCH_PROCESSING,
  processBatchJob,
  {
    connection: redisConnection,
    concurrency: 10, // Processar até 10 batches simultaneamente
    limiter: {
      max: 50, // Máximo 50 jobs por segundo
      duration: 1000,
    },
  }
);

batchProcessorWorker.on('ready', () => {
  console.log('✅ [Batch Worker] Worker pronto - aguardando jobs de batch processing');
});

batchProcessorWorker.on('completed', (job, result) => {
  if (result.processed) {
    console.log(`✅ [Batch Worker] Job ${job.id} concluído: ${result.messageCount} mensagens processadas`);
  } else if (result.skipped) {
    console.log(`⏭️  [Batch Worker] Job ${job.id} ignorado: ${result.reason}`);
  }
});

batchProcessorWorker.on('failed', (job, err) => {
  console.error(`❌ [Batch Worker] Job ${job?.id} falhou:`, err.message);
});

batchProcessorWorker.on('error', (err) => {
  console.error('❌ [Batch Worker] Erro no worker:', err);
});

console.log('🎯 [Batch Worker] Worker starting...');
