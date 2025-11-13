import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

const QUEUE_NAME = 'voice-whatsapp-collection';

async function pauseQueue() {
  console.log('⏸️  Pausando fila de cobranças via WhatsApp...');

  try {
    const queue = new Queue(QUEUE_NAME, { connection: redisConnection });
    
    // Pausar a fila
    await queue.pause();
    
    // Verificar status
    const isPaused = await queue.isPaused();
    console.log(`\n✅ Fila pausada: ${isPaused ? 'SIM ✅' : 'NÃO ❌'}`);
    
    // Status da fila
    const counts = await queue.getJobCounts();
    console.log('\n📊 Status da fila:');
    console.log(JSON.stringify(counts, null, 2));
    
    await queue.close();
    console.log('\n✅ Fila pausada com sucesso!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erro ao pausar fila:', error);
    process.exit(1);
  }
}

pauseQueue();
