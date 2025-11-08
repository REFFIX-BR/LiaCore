import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function checkQueue() {
  const queue = new Queue('voice-whatsapp-collection', {
    connection: redisConnection
  });

  console.log('\n📊 Status detalhado da fila...\n');
  
  const [waiting, active, delayed, paused] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getDelayed(),
    queue.isPaused()
  ]);
  
  console.log(`⏳ Aguardando: ${waiting.length}`);
  console.log(`⚙️  Ativos: ${active.length}`);
  console.log(`⏰ Atrasados: ${delayed.length}`);
  console.log(`⏸️  Pausado: ${paused}\n`);
  
  if (delayed.length > 0) {
    console.log('⏰ Jobs atrasados (delayed):');
    for (const job of delayed.slice(0, 5)) {
      const delay = job.opts?.delay || 0;
      const timestamp = job.timestamp || 0;
      const processTime = new Date(timestamp + delay);
      console.log(`  - Job ${job.id}: ${job.data.clientName}`);
      console.log(`    Agendar para: ${processTime.toLocaleString('pt-BR')}`);
    }
  }
  
  await queue.close();
}

checkQueue().catch(console.error);
