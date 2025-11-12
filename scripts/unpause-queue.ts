import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function unpauseQueue() {
  try {
    const queue = new Queue('voice-whatsapp-collection', {
      connection: redisConnection,
    });
    
    console.log('🔍 Checking queue status...');
    const wasPaused = await queue.isPaused();
    console.log(`   Queue was paused: ${wasPaused}`);
    
    if (wasPaused) {
      console.log('\n🚀 Unpausing queue...');
      await queue.resume();
      console.log('✅ Queue resumed successfully!');
    } else {
      console.log('\n✅ Queue is already running');
    }
    
    const isPaused = await queue.isPaused();
    console.log(`\n📊 Current status: ${isPaused ? 'PAUSED' : 'RUNNING'}`);
    
    await queue.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

unpauseQueue();
