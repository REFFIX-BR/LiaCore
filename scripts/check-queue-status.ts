import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

const queue = new Queue('voice-whatsapp-collection', {
  connection: redisConnection,
});

async function checkQueue() {
  try {
    console.log('🔍 Checking queue: voice-whatsapp-collection');
    
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    const delayed = await queue.getDelayed();
    
    console.log(`📊 Queue Status:`);
    console.log(`  - Waiting: ${waiting.length} jobs`);
    console.log(`  - Active: ${active.length} jobs`);
    console.log(`  - Completed: ${completed.length} jobs`);
    console.log(`  - Failed: ${failed.length} jobs`);
    console.log(`  - Delayed: ${delayed.length} jobs`);
    
    if (waiting.length > 0) {
      console.log(`\n📝 First waiting job:`);
      console.log(JSON.stringify(waiting[0].data, null, 2));
      console.log(`   Job name: ${waiting[0].name}`);
      console.log(`   Job ID: ${waiting[0].id}`);
    }
    
    if (failed.length > 0) {
      console.log(`\n❌ Failed jobs:`);
      failed.forEach((job, index) => {
        console.log(`\n  Job ${index + 1}:`);
        console.log(`    Name: ${job.name}`);
        console.log(`    ID: ${job.id}`);
        console.log(`    Error: ${job.failedReason}`);
      });
    }
    
    await queue.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkQueue();
