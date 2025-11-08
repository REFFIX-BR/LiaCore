import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function forceProcessNow() {
  const queue = new Queue('voice-whatsapp-collection', {
    connection: redisConnection
  });

  console.log('\n🔧 Forçando processamento imediato dos jobs atrasados...\n');
  
  const delayed = await queue.getDelayed();
  
  console.log(`📋 Encontrados ${delayed.length} jobs atrasados`);
  
  for (const job of delayed) {
    console.log(`⚡ Promovendo job ${job.id} (${job.data.clientName}) para processamento imediato...`);
    await job.promote();
  }
  
  console.log('\n✅ Todos os jobs foram promovidos para processamento imediato!');
  console.log('💬 O worker deve processar em breve...\n');
  
  await queue.close();
}

forceProcessNow().catch(console.error);
