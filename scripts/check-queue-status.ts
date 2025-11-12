import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { QUEUE_NAMES } from '../server/lib/queue';

(async () => {
  try {
    const queue = new Queue(QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION, { connection: redisConnection });
    
    const waiting = await queue.getWaiting(0, 5);
    const active = await queue.getActive(0, 5);
    const delayed = await queue.getDelayed(0, 5);
    
    console.log(`\n📊 Queue Status:`);
    console.log(`  Waiting: ${waiting.length}`);
    console.log(`  Active: ${active.length}`);
    console.log(`  Delayed: ${delayed.length}`);
    
    if (waiting.length > 0) {
      console.log(`\n✅ First 3 waiting jobs:`);
      waiting.slice(0, 3).forEach(job => {
        console.log(`  - Job ${job.id}: ${job.data.clientName}`);
      });
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
