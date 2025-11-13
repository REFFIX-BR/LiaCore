import { Queue } from 'bullmq';
import Redis from 'ioredis';

async function checkQueue() {
  const redis = new Redis(process.env.UPSTASH_REDIS_URL!, {
    maxRetriesPerRequest: null,
    tls: {},
  });

  const queue = new Queue('voice-whatsapp-collection', {
    connection: redis,
  });

  console.log('📊 Detailed Queue Status:\n');
  
  const waiting = await queue.getWaiting(0, 100);
  const active = await queue.getActive(0, 100);
  const completed = await queue.getCompleted(0, 100);
  const failed = await queue.getFailed(0, 100);
  const delayed = await queue.getDelayed(0, 100);

  console.log(`✅ Completed: ${completed.length} jobs`);
  for (const job of completed.slice(0, 10)) {
    console.log(`  - Job ${job.id}: ${job.data.clientName} (${job.data.phoneNumber})`);
    console.log(`    Completed at: ${new Date(job.finishedOn!).toLocaleString()}`);
  }

  console.log(`\n❌ Failed: ${failed.length} jobs`);
  for (const job of failed.slice(0, 10)) {
    console.log(`  - Job ${job.id}: ${job.data.clientName}`);
    console.log(`    Reason: ${job.failedReason}`);
  }

  console.log(`\n⏰ Delayed: ${delayed.length} jobs`);
  for (const job of delayed.slice(0, 10)) {
    const delay = job.opts?.delay || 0;
    const delayMinutes = Math.round(delay / 60000);
    const processAt = new Date(Date.now() + delay);
    console.log(`  - Job ${job.id}: ${job.data.clientName}`);
    console.log(`    Will process at: ${processAt.toLocaleTimeString()}`);
  }

  console.log(`\n⏳ Waiting: ${waiting.length} jobs`);
  console.log(`🔄 Active: ${active.length} jobs`);

  process.exit(0);
}

checkQueue().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
