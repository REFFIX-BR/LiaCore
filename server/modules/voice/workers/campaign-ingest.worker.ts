import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, VoiceCampaignIngestJob, addVoiceWhatsAppCollectionToQueue } from '../../../lib/queue';
import { storage } from '../../../storage';
import axios from 'axios';
import { validarDocumentoFlexivel } from '../../../ai-tools';

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

      // ============================================================================
      // VALIDAÇÃO E CLASSIFICAÇÃO DE DOCUMENTOS
      // ============================================================================
      // Aceita CPF, CNPJ ou Códigos de Cliente (ex: "1.8331")
      // Rejeita apenas clientes SEM nenhum identificador
      const targets = crmData.clients
        .filter((client: any) => {
          const hasIdentifier = !!(client.document || client.cpf || client.cnpj || client.clientCode);
          if (!hasIdentifier) {
            console.warn(`⚠️ [Voice Campaign Ingest] Cliente sem identificador será REJEITADO: ${client.name || 'sem nome'} (${client.phone || client.phoneNumber || 'sem telefone'})`);
          }
          return hasIdentifier;
        })
        .map((client: any) => {
          // Extrair documento do CRM
          // PRIORIDADE: CPF/CNPJ (validados) > Código de Cliente (fallback)
          const rawDocument = client.document || client.cpf || client.cnpj || client.clientCode;
          
          // Classificar e validar documento
          const validacao = validarDocumentoFlexivel(rawDocument);
          
          if (!validacao.valido) {
            console.warn(`⚠️ [Voice Campaign Ingest] Documento inválido para cliente ${client.name}: ${validacao.motivo}`);
          }
          
          console.log(`📝 [Voice Campaign Ingest] Cliente ${client.name} - Documento: ${validacao.tipo} (${validacao.documentoNormalizado.substring(0, 5)}***)`);
        
          
          return {
            campaignId,
            debtorName: client.name || 'Cliente sem nome',
            debtorDocument: validacao.documentoNormalizado,
            debtorDocumentType: validacao.tipo,
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
          };
        });

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

      console.log(`📅 [Voice Campaign Ingest] Enqueueing WhatsApp collection for ${createdTargets.length} targets`);
      
      let enqueuedCount = 0;
      for (const target of createdTargets) {
        try {
          // Enqueue WhatsApp collection directly
          await addVoiceWhatsAppCollectionToQueue({
            targetId: target.id,
            campaignId,
            phoneNumber: target.phoneNumber,
            clientName: target.debtorName,
            clientDocument: target.debtorDocument || 'N/A',
            debtAmount: target.debtAmount || 0,
            attemptNumber: 1,
          }, 0); // No delay - send immediately
          enqueuedCount++;
        } catch (error) {
          console.error(`❌ [Voice Campaign Ingest] Erro ao enfileirar target ${target.id}:`, error);
        }
      }

      console.log(`✅ [Voice Campaign Ingest] Campaign ${campaignId} ingested: ${createdTargets.length} targets, ${enqueuedCount} enqueued`);

      return {
        success: true,
        imported: createdTargets.length,
        enqueued: enqueuedCount,
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
