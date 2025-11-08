import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function checkMessageQueue() {
  const queue = new Queue('message-processing', {
    connection: redisConnection
  });

  console.log('\n📊 Verificando fila de mensagens...\n');
  
  const [waiting, active, delayed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getDelayed()
  ]);
  
  console.log(`⏳ Aguardando: ${waiting.length}`);
  console.log(`⚙️  Ativos: ${active.length}`);
  console.log(`⏰ Atrasados: ${delayed.length}\n`);
  
  if (waiting.length > 0) {
    console.log('📋 Jobs aguardando (últimos 5):');
    for (const job of waiting.slice(-5)) {
      console.log(`  - Job ${job.id}: ${job.data.fromNumber || job.data.phoneNumber}`);
      console.log(`    Timestamp: ${new Date(job.timestamp).toLocaleString('pt-BR')}`);
    }
  }
  
  if (active.length > 0) {
    console.log('\n⚙️  Jobs ativos:');
    for (const job of active) {
      console.log(`  - Job ${job.id}: ${job.data.fromNumber || job.data.phoneNumber}`);
    }
  }
  
  await queue.close();
}

checkMessageQueue().catch(console.error);
