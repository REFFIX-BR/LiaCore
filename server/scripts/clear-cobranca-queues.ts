import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis-config';

const COBRANCA_QUEUES = [
  'voice-campaign-ingest',
  'voice-crm-sync',
  'voice-promise-monitor',
  'voice-whatsapp-collection',
];

async function clearAllCobrancaQueues() {
  console.log('🧹 Limpando TODAS as filas de cobrança...\n');
  
  for (const queueName of COBRANCA_QUEUES) {
    console.log(`🔄 Limpando fila: ${queueName}...`);
    
    const queue = new Queue(queueName, { connection: redisConnection });
    
    try {
      const waiting = await queue.getWaitingCount();
      const active = await queue.getActiveCount();
      const delayed = await queue.getDelayedCount();
      
      console.log(`   📊 Jobs: waiting=${waiting}, active=${active}, delayed=${delayed}`);
      
      await queue.obliterate({ force: true });
      console.log(`   ✅ Fila ${queueName} limpa com sucesso`);
    } catch (error: any) {
      console.error(`   ❌ Erro ao limpar ${queueName}:`, error.message);
    }
    
    await queue.close();
  }
  
  await redisConnection.quit();
  console.log('\n🎉 Todas as filas de cobrança foram limpas!');
  process.exit(0);
}

clearAllCobrancaQueues();
