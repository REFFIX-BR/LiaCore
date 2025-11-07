import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, VoiceCampaignIngestJob, addVoiceSchedulingToQueue } from '../../../lib/queue';
import { storage } from '../../../storage';
import axios from 'axios';

console.log('🎯 [Voice Campaign Ingest] Worker starting...');

const worker = new Worker<VoiceCampaignIngestJob>(
  QUEUE_NAMES.VOICE_CAMPAIGN_INGEST,
  async (job: Job<VoiceCampaignIngestJob>) => {
    const { campaignId, crmApiUrl, crmApiKey, filters } = job.data;

    console.log(`📥 [Voice Campaign Ingest] Processing campaign ${campaignId}`);

    try {
      const campaign = await storage.getVoiceCampaign(campaignId);
      if (!campaign) {
        throw new Error(`Campanha ${campaignId} não encontrada`);
      }

      await storage.updateVoiceCampaign(campaignId, { status: 'ingesting' });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (crmApiKey) {
        headers['Authorization'] = `Bearer ${crmApiKey}`;
      }

      console.log(`🔌 [Voice Campaign Ingest] Fetching data from CRM: ${crmApiUrl}`);
      const response = await axios.post(crmApiUrl, { filters }, { 
        headers,
        timeout: 60000,
      });

      const crmData = response.data;
      if (!Array.isArray(crmData.clients)) {
        throw new Error('CRM API retornou formato inválido (esperava array em clients)');
      }

      console.log(`✅ [Voice Campaign Ingest] Received ${crmData.clients.length} clients from CRM`);

      const targets = crmData.clients.map((client: any, index: number) => ({
        campaignId,
        debtorName: client.name || 'Cliente sem nome',
        debtorDocument: client.document || client.cpf || client.cnpj,
        phoneNumber: client.phone || client.phoneNumber,
        debtAmount: Math.round(parseFloat(client.debtAmount || client.valor || '0') * 100),
        dueDate: client.dueDate ? new Date(client.dueDate) : null,
        debtorMetadata: {
          contractId: client.contractId,
          invoiceNumber: client.invoiceNumber,
          additionalInfo: client.additionalInfo,
        },
        priority: client.priority || 0,
        state: 'pending' as const,
        attemptCount: 0,
        nextAttemptAt: new Date(Date.now() + 60000),
      }));

      if (targets.length === 0) {
        console.log(`⚠️ [Voice Campaign Ingest] Nenhum target válido para importar`);
        await storage.updateVoiceCampaign(campaignId, { 
          status: 'active',
          totalTargets: 0,
        });
        return { success: true, imported: 0 };
      }

      console.log(`💾 [Voice Campaign Ingest] Saving ${targets.length} targets to database`);
      const createdTargets = await storage.createVoiceCampaignTargets(targets);

      await storage.updateVoiceCampaignStats(campaignId, {
        totalTargets: createdTargets.length,
      });

      await storage.updateVoiceCampaign(campaignId, { status: 'active' });

      console.log(`📅 [Voice Campaign Ingest] Scheduling initial calls for ${createdTargets.length} targets`);
      
      let scheduledCount = 0;
      for (const target of createdTargets) {
        try {
          await addVoiceSchedulingToQueue({
            targetId: target.id,
            campaignId,
            scheduledFor: target.nextAttemptAt || new Date(Date.now() + 60000),
            attemptNumber: 1,
          });
          scheduledCount++;
        } catch (error) {
          console.error(`❌ [Voice Campaign Ingest] Erro ao agendar target ${target.id}:`, error);
        }
      }

      console.log(`✅ [Voice Campaign Ingest] Campaign ${campaignId} ingested: ${createdTargets.length} targets, ${scheduledCount} scheduled`);

      return {
        success: true,
        imported: createdTargets.length,
        scheduled: scheduledCount,
      };

    } catch (error: any) {
      console.error(`❌ [Voice Campaign Ingest] Error processing campaign ${campaignId}:`, error);
      
      await storage.updateVoiceCampaign(campaignId, { 
        status: 'failed',
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
    limiter: {
      max: 5,
      duration: 60000,
    },
  }
);

worker.on('completed', (job: Job) => {
  console.log(`✅ [Voice Campaign Ingest] Job ${job.id} completed`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`❌ [Voice Campaign Ingest] Job ${job?.id} failed:`, error.message);
});

worker.on('error', (error: Error) => {
  console.error('❌ [Voice Campaign Ingest] Worker error:', error);
});

console.log('✅ [Voice Campaign Ingest] Worker ready');

export default worker;
