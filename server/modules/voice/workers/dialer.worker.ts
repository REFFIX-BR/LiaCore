import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, VoiceDialerJob, addVoicePostCallToQueue } from '../../../lib/queue';
import { storage } from '../../../storage';
import { initiateVoiceCall } from '../../../lib/voiceCall';

console.log('📞 [Voice Dialer] Worker starting...');

const worker = new Worker<VoiceDialerJob>(
  QUEUE_NAMES.VOICE_DIALER,
  async (job: Job<VoiceDialerJob>) => {
    const {
      targetId,
      campaignId,
      phoneNumber,
      clientName,
      clientDocument,
      debtAmount,
      attemptNumber,
    } = job.data;

    console.log(`📞 [Voice Dialer] Dialing ${phoneNumber} (${clientName}) - Attempt #${attemptNumber}`);

    try {
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.error('❌ [Voice Dialer] Twilio credentials not configured - cannot place calls');
        console.error('⚠️  [Voice Dialer] Skipping attempt without consuming retry count');
        
        return {
          success: false,
          error: 'Twilio credentials not configured - please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER',
          configError: true,
        };
      }

      if (!process.env.VOICE_WEBHOOK_BASE_URL) {
        console.error('❌ [Voice Dialer] VOICE_WEBHOOK_BASE_URL not configured');
        console.error('⚠️  [Voice Dialer] Skipping attempt without consuming retry count');
        
        return {
          success: false,
          error: 'VOICE_WEBHOOK_BASE_URL not configured - required for Twilio callbacks',
          configError: true,
        };
      }

      const target = await storage.getVoiceCampaignTarget(targetId);
      if (!target) {
        throw new Error(`Target ${targetId} não encontrado`);
      }

      await storage.updateVoiceCampaignTarget(targetId, {
        state: 'calling',
      });

      const attempt = await storage.createVoiceCallAttempt({
        targetId,
        campaignId,
        phoneNumber,
        attemptNumber,
        scheduledFor: new Date(),
        status: 'queued',
      });

      console.log(`📝 [Voice Dialer] Call attempt created: ${attempt.id}`);

      const callResult = await initiateVoiceCall({
        phoneNumber,
        clientName,
        debtAmount,
        debtDetails: target.debtorMetadata ? JSON.stringify(target.debtorMetadata) : undefined,
        campaignId,
        targetId,
        attemptNumber,
      });

      if (!callResult.success) {
        console.error(`❌ [Voice Dialer] Call failed:`, callResult.error);
        
        await storage.updateVoiceCallAttempt(attempt.id, {
          status: 'failed',
          errorMessage: callResult.error,
        });

        await storage.updateVoiceCampaignTarget(targetId, {
          state: 'pending',
          attemptCount: attemptNumber,
          lastAttemptAt: new Date(),
        });

        await addVoicePostCallToQueue({
          attemptId: attempt.id,
          targetId,
          campaignId,
          callSid: callResult.callSid || '',
          callDuration: 0,
          callStatus: 'failed',
          conversationData: {},
        });

        return { success: false, error: callResult.error };
      }

      console.log(`✅ [Voice Dialer] Call initiated: ${callResult.callSid}`);

      await storage.updateVoiceCallAttempt(attempt.id, {
        callSid: callResult.callSid,
        status: 'in-progress',
        dialedAt: new Date(),
      });

      await storage.updateVoiceCampaignTarget(targetId, {
        attemptCount: attemptNumber,
        lastAttemptAt: new Date(),
      });

      console.log(`✅ [Voice Dialer] Call in progress for target ${targetId}`);

      return {
        success: true,
        callSid: callResult.callSid,
        attemptId: attempt.id,
      };

    } catch (error: any) {
      console.error(`❌ [Voice Dialer] Error dialing ${phoneNumber}:`, error);
      
      await storage.updateVoiceCampaignTarget(targetId, {
        state: 'pending',
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

worker.on('completed', (job: Job) => {
  console.log(`✅ [Voice Dialer] Job ${job.id} completed`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`❌ [Voice Dialer] Job ${job?.id} failed:`, error.message);
});

worker.on('error', (error: Error) => {
  console.error('❌ [Voice Dialer] Worker error:', error);
});

console.log('✅ [Voice Dialer] Worker ready');

export default worker;
