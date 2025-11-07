import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, VoicePromiseMonitorJob } from '../../../lib/queue';
import { storage } from '../../../storage';

console.log('👁️ [Voice Promise Monitor] Worker starting...');

const worker = new Worker<VoicePromiseMonitorJob>(
  QUEUE_NAMES.VOICE_PROMISE_MONITOR,
  async (job: Job<VoicePromiseMonitorJob>) => {
    const { promiseId, dueDate, targetId, campaignId } = job.data;

    console.log(`📊 [Voice Promise Monitor] Checking promise ${promiseId}`);

    try {
      const promise = await storage.getVoicePromise(promiseId);
      if (!promise) {
        console.log(`⚠️ [Voice Promise Monitor] Promise ${promiseId} não encontrada`);
        return { success: false, reason: 'promise_not_found' };
      }

      if (promise.status === 'fulfilled') {
        console.log(`✅ [Voice Promise Monitor] Promise ${promiseId} já cumprida`);
        return { success: true, reason: 'already_fulfilled' };
      }

      const now = new Date();
      const promiseDueDate = new Date(dueDate);
      const daysSinceDue = Math.floor((now.getTime() - promiseDueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceDue <= 0) {
        console.log(`⏰ [Voice Promise Monitor] Promise ${promiseId} ainda não vencida (vence em ${Math.abs(daysSinceDue)} dias)`);
        return { success: true, reason: 'not_due_yet' };
      }

      console.log(`⚠️ [Voice Promise Monitor] Promise ${promiseId} vencida há ${daysSinceDue} dias`);

      if (daysSinceDue >= 7) {
        console.log(`❌ [Voice Promise Monitor] Promise ${promiseId} quebrada (>7 dias vencida)`);
        
        await storage.updateVoicePromise(promiseId, {
          status: 'broken',
        });

        if (targetId) {
          await storage.updateVoiceCampaignTarget(targetId, {
            outcome: 'promise_broken',
            outcomeDetails: `Promessa quebrada - ${daysSinceDue} dias após vencimento`,
          });
        }

        const allPromises = await storage.getVoicePromisesByCampaign(campaignId);
        await storage.updateVoiceCampaignStats(campaignId, {
          promisesFulfilled: allPromises.filter(p => p.status === 'fulfilled').length,
          promisesMade: allPromises.length,
        });

        return { success: true, status: 'broken', daysSinceDue };
      }

      console.log(`🔔 [Voice Promise Monitor] Promise ${promiseId} aguardando verificação manual (${daysSinceDue} dias vencida)`);
      
      return { success: true, status: 'monitoring', daysSinceDue };

    } catch (error: any) {
      console.error(`❌ [Voice Promise Monitor] Error checking promise ${promiseId}:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 60000,
    },
  }
);

worker.on('completed', (job: Job) => {
  console.log(`✅ [Voice Promise Monitor] Job ${job.id} completed`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`❌ [Voice Promise Monitor] Job ${job?.id} failed:`, error.message);
});

worker.on('error', (error: Error) => {
  console.error('❌ [Voice Promise Monitor] Worker error:', error);
});

console.log('✅ [Voice Promise Monitor] Worker ready');

export default worker;
