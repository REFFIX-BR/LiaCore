import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, VoicePostCallJob, addVoiceSchedulingToQueue, addVoicePromiseMonitorToQueue } from '../../../lib/queue';
import { storage } from '../../../storage';

console.log('📊 [Voice Post-Call] Worker starting...');

const worker = new Worker<VoicePostCallJob>(
  QUEUE_NAMES.VOICE_POST_CALL,
  async (job: Job<VoicePostCallJob>) => {
    const { 
      attemptId, 
      targetId, 
      campaignId, 
      callSid, 
      callDuration, 
      callStatus,
      recordingUrl,
      transcription,
      conversationData,
    } = job.data;

    console.log(`📝 [Voice Post-Call] Processing call attempt ${attemptId}`);

    try {
      const target = await storage.getVoiceCampaignTarget(targetId);
      if (!target) {
        throw new Error(`Target ${targetId} não encontrado`);
      }

      const attempt = await storage.getVoiceCallAttempt(attemptId);
      if (!attempt) {
        throw new Error(`Attempt ${attemptId} não encontrado`);
      }

      const wasSuccessful = callStatus === 'completed' && callDuration > 30;

      await storage.updateVoiceCallAttempt(attemptId, {
        transcript: transcription,
        recordingUrl,
      });

      if (wasSuccessful && conversationData?.promiseMade) {
        console.log(`🤝 [Voice Post-Call] Cliente fez promessa de pagamento`);
        
        const promiseData = conversationData.promise || {};
        const dueDate = promiseData.dueDate ? new Date(promiseData.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        const promise = await storage.createVoicePromise({
          campaignId,
          targetId,
          callAttemptId: attemptId,
          contactName: target.debtorName,
          contactDocument: target.debtorDocument,
          phoneNumber: target.phoneNumber,
          promisedAmount: promiseData.amount || target.debtAmount,
          dueDate,
          paymentMethod: promiseData.paymentMethod || 'pix',
          status: 'pending',
          recordingUrl,
          notes: transcription,
        });

        await storage.updateVoiceCampaignTarget(targetId, {
          state: 'completed',
          outcome: 'promise_made',
          completedAt: new Date(),
        });

        await storage.updateVoiceCampaignStats(campaignId, {
          promisesMade: (await storage.getVoicePromisesByCampaign(campaignId)).length,
          successfulContacts: (await storage.getVoicePromisesByCampaign(campaignId)).length,
          contactedTargets: (await storage.getVoiceCallAttemptsByCampaign(campaignId)).length,
        });

        await addVoicePromiseMonitorToQueue({
          promiseId: promise.id,
          dueDate,
          targetId,
          campaignId,
        });

        console.log(`✅ [Voice Post-Call] Promessa registrada: ${promise.id}`);
        
        return { success: true, promiseMade: true, promiseId: promise.id };
        
      } else if (wasSuccessful && conversationData?.wontPay) {
        console.log(`❌ [Voice Post-Call] Cliente recusou pagamento`);
        
        await storage.updateVoiceCampaignTarget(targetId, {
          state: 'completed',
          outcome: 'refused',
          outcomeDetails: 'Cliente recusou pagamento',
          completedAt: new Date(),
        });

        return { success: true, refused: true };
        
      } else if (!wasSuccessful && (target.attemptCount || 0) < 3) {
        const currentAttempts = target.attemptCount || 0;
        console.log(`🔄 [Voice Post-Call] Chamada não bem-sucedida, reagendando tentativa ${currentAttempts + 1}`);
        
        const nextAttemptDelay = 24 * 60 * 60 * 1000;
        const nextAttemptAt = new Date(Date.now() + nextAttemptDelay);
        
        await storage.updateVoiceCampaignTarget(targetId, {
          state: 'pending',
          nextAttemptAt,
        });

        await addVoiceSchedulingToQueue({
          targetId,
          campaignId,
          scheduledFor: nextAttemptAt,
          attemptNumber: currentAttempts + 1,
        });

        return { success: true, rescheduled: true, nextAttemptAt };
        
      } else {
        console.log(`⚠️ [Voice Post-Call] Esgotadas tentativas para target ${targetId}`);
        
        await storage.updateVoiceCampaignTarget(targetId, {
          state: 'failed',
          outcome: 'no_answer',
          outcomeDetails: 'Máximo de tentativas sem sucesso',
          completedAt: new Date(),
        });

        return { success: true, failed: true };
      }

    } catch (error: any) {
      console.error(`❌ [Voice Post-Call] Error processing attempt ${attemptId}:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 60000,
    },
  }
);

worker.on('completed', (job: Job) => {
  console.log(`✅ [Voice Post-Call] Job ${job.id} completed`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`❌ [Voice Post-Call] Job ${job?.id} failed:`, error.message);
});

worker.on('error', (error: Error) => {
  console.error('❌ [Voice Post-Call] Worker error:', error);
});

console.log('✅ [Voice Post-Call] Worker ready');

export default worker;
