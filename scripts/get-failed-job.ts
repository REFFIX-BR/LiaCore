import { messageQueue } from '../server/lib/queue';

async function getFailedJob() {
  const failed = await messageQueue.getFailed();
  
  if (failed.length > 0) {
    const lastFailed = failed[failed.length - 1];
    console.log('❌ Último job falhado:\n');
    console.log(`Job ID: ${lastFailed.id}`);
    console.log(`Data:`, JSON.stringify(lastFailed.data, null, 2));
    console.log(`\nRazão da falha: ${lastFailed.failedReason}`);
    console.log(`\nStack trace:`, lastFailed.stacktrace?.join('\n'));
  }
  
  await messageQueue.close();
}

getFailedJob().catch(console.error);
