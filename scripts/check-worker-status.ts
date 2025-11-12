import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function checkWorkerStatus() {
  try {
    const queue = new Queue('voice-whatsapp-collection', {
      connection: redisConnection,
    });
    
    console.log('🔍 Checking queue and worker status...\n');
    
    // Check queue status
    const isPaused = await queue.isPaused();
    console.log(`📊 Queue paused: ${isPaused}`);
    
    // Check workers
    const workers = await queue.getWorkers();
    console.log(`👷 Active workers: ${workers.length}`);
    
    // Check queue counts
    const counts = await queue.getJobCounts();
    console.log('\n📈 Job Counts:');
    for (const [state, count] of Object.entries(counts)) {
      if (count > 0) {
        console.log(`   ${state}: ${count}`);
      }
    }
    
    // Check recent jobs
    const completed = await queue.getCompleted(0, 5);
    const failed = await queue.getFailed(0, 5);
    
    console.log(`\n📊 Recent completed: ${completed.length}`);
    if (completed.length > 0) {
      console.log('   Last completed job ID:', completed[0].id);
    }
    
    console.log(`📊 Recent failed: ${failed.length}`);
    if (failed.length > 0) {
      console.log('   Last failed job:');
      console.log(`     ID: ${failed[0].id}`);
      console.log(`     Reason: ${failed[0].failedReason}`);
    }
    
    await queue.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkWorkerStatus();
