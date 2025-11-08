import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function checkQueue() {
  const queue = new Queue('voice-whatsapp-collection', {
    connection: redisConnection
  });

  console.log('\n📊 Verificando fila de WhatsApp...\n');
  
  const waiting = await queue.getWaiting();
  const active = await queue.getActive();
  const completed = await queue.getCompleted();
  const failed = await queue.getFailed();
  
  console.log(`⏳ Aguardando: ${waiting.length}`);
  console.log(`⚙️  Ativos: ${active.length}`);
  console.log(`✅ Completados: ${completed.length}`);
  console.log(`❌ Falhos: ${failed.length}\n`);
  
  if (waiting.length > 0) {
    console.log('📋 Jobs aguardando:');
    waiting.forEach(job => {
      console.log(`  - Job ${job.id}: ${job.data.clientName}`);
    });
  }
  
  if (active.length > 0) {
    console.log('\n⚙️  Jobs ativos:');
    active.forEach(job => {
      console.log(`  - Job ${job.id}: ${job.data.clientName}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Jobs falhos:');
    for (const job of failed.slice(0, 3)) {
      console.log(`  - Job ${job.id}: ${job.data.clientName}`);
      console.log(`    Erro: ${job.failedReason}`);
    }
  }
  
  await queue.close();
}

checkQueue().catch(console.error);
