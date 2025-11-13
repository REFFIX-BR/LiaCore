import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { QUEUE_NAMES } from '../server/lib/queue';

/**
 * Diagnóstico completo da fila de cobrança WhatsApp
 */

async function diagnoseQueue() {
  console.log('🔍 ========== DIAGNÓSTICO DA FILA ==========');
  
  // Criar instância da queue
  const queue = new Queue(QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION, {
    connection: redisConnection,
  });
  
  console.log('📋 Nome da fila:', QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION);
  
  // Verificar jobs
  const waiting = await queue.getWaiting();
  const active = await queue.getActive();
  const completed = await queue.getCompleted();
  const failed = await queue.getFailed();
  const delayed = await queue.getDelayed();
  
  console.log('\n📊 Status da fila:');
  console.log(`  - Waiting: ${waiting.length} jobs`);
  console.log(`  - Active: ${active.length} jobs`);
  console.log(`  - Completed: ${completed.length} jobs`);
  console.log(`  - Failed: ${failed.length} jobs`);
  console.log(`  - Delayed: ${delayed.length} jobs`);
  
  // Se há jobs waiting, mostrar detalhes
  if (waiting.length > 0) {
    console.log('\n✅ Detalhes dos jobs waiting:');
    waiting.forEach((job, index) => {
      console.log(`\n  Job #${index + 1}:`);
      console.log(`    ID: ${job.id}`);
      console.log(`    Name: ${job.name}`);
      console.log(`    Data:`, JSON.stringify(job.data, null, 6));
    });
  }
  
  // Verificar workers conectados
  const workers = await queue.getWorkers();
  console.log(`\n👷 Workers conectados: ${workers.length}`);
  if (workers.length > 0) {
    workers.forEach((worker, index) => {
      console.log(`  Worker #${index + 1}:`, worker);
    });
  } else {
    console.log('  ❌ NENHUM WORKER CONECTADO!');
  }
  
  // Verificar se a fila está pausada
  const isPaused = await queue.isPaused();
  console.log(`\n⏸️  Fila pausada: ${isPaused ? '❌ SIM' : '✅ NÃO'}`);
  
  await queue.close();
  process.exit(0);
}

diagnoseQueue().catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
