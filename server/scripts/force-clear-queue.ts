import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis-config';

async function forceCleanQueue() {
  console.log('🧹 Force cleaning voice-whatsapp-collection queue...');
  
  const queue = new Queue('voice-whatsapp-collection', { connection: redisConnection });
  
  try {
    // Use obliterate which is more aggressive
    console.log('🔄 Starting obliterate (this may take a while)...');
    await queue.obliterate({ force: true });
    console.log('✅ Queue obliterated successfully');
  } catch (error: any) {
    console.error('❌ Obliterate failed:', error.message);
  }
  
  await queue.close();
  await redisConnection.quit();
  console.log('🎉 Done');
  process.exit(0);
}

forceCleanQueue();
