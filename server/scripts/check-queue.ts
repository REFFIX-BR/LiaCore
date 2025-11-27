import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis-config';

async function checkQueue() {
  const queue = new Queue('voice-whatsapp-collection', { connection: redisConnection });
  const counts = await queue.getJobCounts();
  console.log('📊 Queue status:', counts);
  await queue.close();
  await redisConnection.quit();
  process.exit(0);
}
checkQueue();
