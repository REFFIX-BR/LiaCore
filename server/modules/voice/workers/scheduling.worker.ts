import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, VoiceSchedulingJob, addVoiceDialerToQueue } from '../../../lib/queue';
import { storage } from '../../../storage';
import { isFeatureEnabled } from '../../../lib/featureFlags';

console.log('📅 [Voice Scheduling] Worker starting...');

function isWithinBusinessHours(date: Date = new Date()): boolean {
  const hours = date.getHours();
  const day = date.getDay();
  
  if (day === 0 || day === 6) {
    return false;
  }
  
  return hours >= 8 && hours < 20;
}

function getNextBusinessHourSlot(): Date {
  const now = new Date();
  const next = new Date(now);
  
  if (!isWithinBusinessHours(now)) {
    if (now.getHours() >= 20) {
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0);
    } else {
      next.setHours(8, 0, 0, 0);
    }
    
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
  }
  
  return next;
}

const worker = new Worker<VoiceSchedulingJob>(
  QUEUE_NAMES.VOICE_SCHEDULING,
  async (job: Job<VoiceSchedulingJob>) => {
    const { targetId, campaignId, attemptNumber } = job.data;

    console.log(`📞 [Voice Scheduling] Processing target ${targetId} (attempt ${attemptNumber})`);

    try {
      const isEnabled = await isFeatureEnabled('voice_outbound_enabled');
      if (!isEnabled) {
        console.log(`⚠️ [Voice Scheduling] Feature flag disabled, skipping`);
        return { success: false, reason: 'feature_disabled' };
      }

      const target = await storage.getVoiceCampaignTarget(targetId);
      if (!target) {
        throw new Error(`Target ${targetId} não encontrado`);
      }

      if (target.state === 'completed' || target.state === 'failed') {
        console.log(`⚠️ [Voice Scheduling] Target ${targetId} já finalizado (${target.state})`);
        return { success: false, reason: 'target_completed' };
      }

      const maxAttempts = 3;
      const currentAttempts = target.attemptCount || 0;
      if (currentAttempts >= maxAttempts) {
        console.log(`⚠️ [Voice Scheduling] Target ${targetId} atingiu máximo de tentativas (${maxAttempts})`);
        await storage.updateVoiceCampaignTarget(targetId, { 
          state: 'failed',
          outcome: 'max_attempts',
          outcomeDetails: 'Máximo de tentativas atingido',
        });
        return { success: false, reason: 'max_attempts' };
      }

      if (!isWithinBusinessHours()) {
        const nextSlot = getNextBusinessHourSlot();
        console.log(`🕐 [Voice Scheduling] Fora do horário comercial, reagendando para ${nextSlot.toISOString()}`);
        
        await addVoiceDialerToQueue({
          targetId,
          campaignId,
          phoneNumber: target.phoneNumber,
          clientName: target.debtorName,
          clientDocument: target.debtorDocument || '',
          debtAmount: target.debtAmount || 0,
          attemptNumber,
        }, nextSlot.getTime() - Date.now());

        return { success: true, rescheduled: true, nextSlot };
      }

      console.log(`✅ [Voice Scheduling] Agendando chamada para target ${targetId}`);
      
      await storage.updateVoiceCampaignTarget(targetId, { 
        state: 'scheduled',
      });

      await addVoiceDialerToQueue({
        targetId,
        campaignId,
        phoneNumber: target.phoneNumber,
        clientName: target.debtorName,
        clientDocument: target.debtorDocument || '',
        debtAmount: target.debtAmount || 0,
        attemptNumber,
      });

      console.log(`✅ [Voice Scheduling] Target ${targetId} agendado para discagem`);

      return {
        success: true,
        scheduled: true,
      };

    } catch (error: any) {
      console.error(`❌ [Voice Scheduling] Error processing target ${targetId}:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
    limiter: {
      max: 50,
      duration: 60000,
    },
  }
);

worker.on('completed', (job: Job) => {
  console.log(`✅ [Voice Scheduling] Job ${job.id} completed`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`❌ [Voice Scheduling] Job ${job?.id} failed:`, error.message);
});

worker.on('error', (error: Error) => {
  console.error('❌ [Voice Scheduling] Worker error:', error);
});

console.log('✅ [Voice Scheduling] Worker ready');

export default worker;
