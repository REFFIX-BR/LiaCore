import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, VoiceCRMSyncJob, addVoiceCampaignIngestToQueue } from '../../../lib/queue';
import { storage } from '../../../storage';
import axios from 'axios';
import { validarDocumentoFlexivel } from '../../../ai-tools';

function cleanClientName(name: string): string {
  if (!name) return 'Cliente sem nome';
  
  // Remove prefixos numéricos do início do nome
  // Ex: "2 CRISTIANE APARECIDA" → "CRISTIANE APARECIDA"
  // Ex: "123 MARIA SILVA" → "MARIA SILVA"
  const cleaned = name.replace(/^\d+\s+/, '').trim();
  
  // Log para debug
  if (name !== cleaned) {
    console.log(`🧹 [CRM Sync] Nome limpo: "${name}" → "${cleaned}"`);
  }
  
  return cleaned || 'Cliente sem nome';
}

console.log('🔄 [CRM Sync] Worker starting...');

const worker = new Worker<VoiceCRMSyncJob>(
  QUEUE_NAMES.VOICE_CRM_SYNC,
  async (job: Job<VoiceCRMSyncJob>) => {
    const { syncConfigId, campaignId, isManualTrigger } = job.data;

    console.log(`🔄 [CRM Sync] Processing sync for campaign ${campaignId} (manual: ${isManualTrigger})`);

    try {
      // Buscar configuração de sincronização
      const syncConfig = await storage.getCRMSyncConfig(syncConfigId);
      if (!syncConfig) {
        throw new Error(`Configuração de sincronização ${syncConfigId} não encontrada`);
      }

      if (!syncConfig.enabled && !isManualTrigger) {
        console.log(`⏸️ [CRM Sync] Sincronização desabilitada para campanha ${campaignId}`);
        return { success: false, reason: 'disabled' };
      }

      // Calcular intervalo de datas
      let dateFrom: string;
      let dateTo: string;

      if (syncConfig.dateRangeType === 'relative') {
        const days = syncConfig.dateRangeDays || 30;
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days);
        
        dateFrom = from.toISOString().split('T')[0]; // YYYY-MM-DD
        dateTo = to.toISOString().split('T')[0];
      } else {
        // Tipo 'fixed'
        dateFrom = syncConfig.dateRangeFrom ? new Date(syncConfig.dateRangeFrom).toISOString().split('T')[0] : '';
        dateTo = syncConfig.dateRangeTo ? new Date(syncConfig.dateRangeTo).toISOString().split('T')[0] : '';
      }

      console.log(`📅 [CRM Sync] Buscando inadimplentes de ${dateFrom} até ${dateTo}`);

      // Chamar API do CRM
      const response = await axios.get(syncConfig.apiUrl, {
        params: {
          datafrom: dateFrom,
          dateto: dateTo,
        },
        headers: syncConfig.apiKey ? {
          'Authorization': `Bearer ${syncConfig.apiKey}`
        } : undefined,
        timeout: 60000,
      });

      const crmClients = response.data;
      if (!Array.isArray(crmClients)) {
        throw new Error('API do CRM retornou formato inválido (esperava array)');
      }

      console.log(`✅ [CRM Sync] Recebidos ${crmClients.length} clientes da API`);

      // Filtrar por valor mínimo/máximo
      const filteredClients = crmClients.filter((client: any) => {
        const valor = parseFloat(client.VALOR || '0');
        const valorCentavos = Math.round(valor * 100);

        if (syncConfig.minDebtAmount && valorCentavos < syncConfig.minDebtAmount) {
          return false;
        }
        if (syncConfig.maxDebtAmount && valorCentavos > syncConfig.maxDebtAmount) {
          return false;
        }
        return true;
      });

      console.log(`📊 [CRM Sync] ${filteredClients.length} clientes após filtro de valor`);

      // Transformar dados da API para formato do sistema
      const targets = filteredClients.map((client: any) => {
        // Priorizar CPF se disponível, senão usar COD_CLIENTE
        const rawDocument = client.CPF || client.COD_CLIENTE;
        const validacao = validarDocumentoFlexivel(rawDocument);

        // Processar telefones e adicionar prefixo 55 automaticamente
        const normalizePhone = (phone: string): string => {
          if (!phone) return '';
          
          // Remover tudo que não é número
          let cleaned = phone.replace(/\D/g, '');
          
          // Remover prefixo +55 ou 55 se já existir
          cleaned = cleaned.replace(/^(55)/, '');
          
          // Validar tamanho (10 ou 11 dígitos no formato brasileiro)
          if (cleaned.length < 10 || cleaned.length > 11) {
            return '';
          }
          
          // Adicionar prefixo 55
          return `55${cleaned}`;
        };
        
        const phone1 = normalizePhone(client.TELEFONE_CELULAR1 || '');
        const phone2 = normalizePhone(client.TELEFONE_CELULAR2 || '');
        const phones = [phone1, phone2].filter(p => p.length >= 12); // 55 + 10 ou 11 dígitos

        if (phones.length === 0) {
          console.warn(`⚠️ [CRM Sync] Cliente ${client.NOME} sem telefone válido`);
          return null;
        }

        return {
          campaignId,
          debtorName: cleanClientName(client.NOME),
          debtorDocument: validacao.documentoNormalizado,
          debtorDocumentType: validacao.tipo,
          phoneNumber: phones[0],
          alternativePhones: phones.slice(1),
          debtAmount: Math.round(parseFloat(client.VALOR || '0') * 100),
          dueDate: client.DATA_VENCIMENTO ? new Date(client.DATA_VENCIMENTO) : null,
          debtorMetadata: {
            codCliente: client.COD_CLIENTE,
            syncSource: 'crm_api',
            syncedAt: new Date().toISOString(),
          },
          priority: 0,
          state: 'pending' as const,
          attemptCount: 0,
          nextAttemptAt: new Date(Date.now() + 60000),
          paymentStatus: 'pending' as const,
          crmSyncState: 'synced' as const,
          crmLastSyncAt: new Date(),
        };
      }).filter((t: any) => t !== null);

      console.log(`💾 [CRM Sync] Preparados ${targets.length} targets válidos`);

      if (targets.length === 0) {
        await storage.updateCRMSyncConfig(syncConfigId, {
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          lastSyncImported: 0,
          lastSyncSkipped: 0,
        });
        return { success: true, imported: 0, skipped: 0 };
      }

      // Deduplicação e processamento
      let newTargets = 0;
      let updatedTargets = 0;
      let skipped = 0;

      for (const target of targets as Array<NonNullable<typeof targets[number]>>) {
        const exists = await storage.checkTargetExists(
          campaignId,
          target.debtorDocument,
          target.phoneNumber,
          syncConfig.deduplicateBy
        );

        if (exists && !syncConfig.updateExisting) {
          skipped++;
          continue;
        }

        if (exists && syncConfig.updateExisting) {
          await storage.updateVoiceCampaignTarget(exists.id, target);
          updatedTargets++;
        } else {
          await storage.createVoiceCampaignTargets([target]);
          newTargets++;
        }
      }

      const totalImported = newTargets + updatedTargets;

      // Atualizar estatísticas da campanha - apenas incrementar com novos targets
      const campaign = await storage.getVoiceCampaign(campaignId);
      if (campaign) {
        await storage.updateVoiceCampaign(campaignId, {
          totalTargets: (campaign.totalTargets || 0) + newTargets,
        });
      }

      // Atualizar status da sincronização
      await storage.updateCRMSyncConfig(syncConfigId, {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncImported: totalImported,
        lastSyncSkipped: skipped,
        lastSyncError: null,
      });

      console.log(`✅ [CRM Sync] Concluído: ${newTargets} novos, ${updatedTargets} atualizados, ${skipped} ignorados`);

      return {
        success: true,
        imported: totalImported,
        newTargets,
        updatedTargets,
        skipped,
        total: targets.length,
      };

    } catch (error: any) {
      console.error(`❌ [CRM Sync] Erro na sincronização:`, error);
      
      await storage.updateCRMSyncConfig(syncConfigId, {
        lastSyncAt: new Date(),
        lastSyncStatus: 'failed',
        lastSyncError: error.message,
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Uma sincronização por vez
  }
);

worker.on('completed', (job: Job) => {
  console.log(`✅ [CRM Sync] Job ${job.id} completed`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`❌ [CRM Sync] Job ${job?.id} failed:`, error.message);
});

worker.on('error', (error: Error) => {
  console.error('❌ [CRM Sync] Worker error:', error);
});

console.log('✅ [CRM Sync] Worker ready');

export default worker;
