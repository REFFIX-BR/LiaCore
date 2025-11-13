import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function checkDelayedJobs() {
  console.log('🔍 Verificando jobs delayed...\n');
  
  const queue = new Queue('voice-whatsapp-collection', { connection: redisConnection });
  
  try {
    const counts = await queue.getJobCounts();
    console.log('📊 Contagem de jobs:');
    console.log(`  Waiting: ${counts.waiting}`);
    console.log(`  Active: ${counts.active}`);
    console.log(`  Delayed: ${counts.delayed}`);
    console.log(`  Completed: ${counts.completed}`);
    console.log(`  Failed: ${counts.failed}\n`);
    
    if (counts.delayed && counts.delayed > 0) {
      const delayed = await queue.getDelayed(0, 10);
      console.log(`📋 Primeiros ${delayed.length} jobs delayed:\n`);
      
      for (const job of delayed) {
        console.log(`  Job #${job.id}:`);
        console.log(`    Target: ${job.data.clientName}`);
        console.log(`    Phone: ${job.data.phoneNumber}`);
        console.log(`    Delay: ${job.opts?.delay} ms`);
        
        if (job.timestamp) {
          const processAt = new Date(job.timestamp + (job.opts?.delay || 0));
          console.log(`    Processo em: ${processAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
        }
        console.log('');
      }
    }
    
    // Check if campaign was ever activated
    const waiting = await queue.getWaiting(0, 5);
    if (waiting.length > 0) {
      console.log(`\n✅ ${waiting.length} jobs waiting (ready to process now)`);
    } else {
      console.log('\n⚠️  Nenhum job waiting - campanha pode não ter sido ativada ou jobs já foram processados');
    }
    
  } finally {
    await queue.close();
  }
}

checkDelayedJobs().catch(console.error);
