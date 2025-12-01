import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { QUEUE_NAMES } from '../server/lib/queue';

async function clearQueues() {
  console.log('🧹 Limpando filas de cobrança...\n');
  
  const queuesToClean = [
    QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION,
    QUEUE_NAMES.WHATSAPP_RETRY,
  ];
  
  for (const queueName of queuesToClean) {
    try {
      const queue = new Queue(queueName, { connection: redisConnection });
      
      const beforeStats = await queue.getJobCounts();
      console.log(`📊 [${queueName}] Antes:`, beforeStats);
      
      // Limpar todos os jobs
      await queue.drain(true); // true = remover delayed também
      await queue.clean(0, 1000, 'completed');
      await queue.clean(0, 1000, 'failed');
      
      const afterStats = await queue.getJobCounts();
      console.log(`✅ [${queueName}] Depois:`, afterStats);
      console.log('');
      
      await queue.close();
    } catch (error) {
      console.error(`❌ Erro ao limpar ${queueName}:`, error);
    }
  }
  
  console.log('🎉 Filas de cobrança limpas!');
  process.exit(0);
}

clearQueues();
