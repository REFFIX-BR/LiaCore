import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

const QUEUE_NAME = 'voice-whatsapp-collection';

async function resumeQueue() {
  console.log('▶️  Despausando fila de cobranças via WhatsApp...');

  try {
    const queue = new Queue(QUEUE_NAME, { connection: redisConnection });
    
    // Despausar a fila
    await queue.resume();
    
    // Verificar status
    const isPaused = await queue.isPaused();
    console.log(`\n✅ Fila despausada: ${isPaused ? 'NÃO (ainda pausada)' : 'SIM ✅'}`);
    
    // Status da fila
    const counts = await queue.getJobCounts();
    console.log('\n📊 Status da fila:');
    console.log(JSON.stringify(counts, null, 2));
    
    await queue.close();
    console.log('\n✅ Fila despausada com sucesso!');
    console.log('⏱️  Aguarde ~40 segundos para processar 1 mensagem...');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erro ao despausar fila:', error);
    process.exit(1);
  }
}

resumeQueue();
