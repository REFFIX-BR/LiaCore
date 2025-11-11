import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { storage } from '../../storage';
import { addVoiceWhatsAppCollectionToQueue } from '../../lib/queue';
import { eq } from 'drizzle-orm';
import { voiceCampaignTargets } from '@shared/schema';

const router = Router();

// Aplicar middlewares de autenticação e autorização a todas as rotas
router.use(authenticate, requireAdmin);

// GET /api/admin/cobranca/failed-targets - Listar targets com erro
router.get('/failed-targets', async (req, res) => {
  try {
    const { db } = await import('../../db');
    
    // Buscar todos os targets com state='failed'
    const failedTargets = await db
      .select()
      .from(voiceCampaignTargets)
      .where(eq(voiceCampaignTargets.state, 'failed'))
      .orderBy(voiceCampaignTargets.updatedAt);
    
    console.log(`📊 [Admin Cobrança] ${failedTargets.length} target(s) com erro encontrado(s)`);
    
    res.json({
      success: true,
      total: failedTargets.length,
      targets: failedTargets.map(target => ({
        id: target.id,
        campaignId: target.campaignId,
        clientName: target.debtorName,
        phoneNumber: target.phoneNumber,
        clientDocument: target.debtorDocument,
        debtAmount: target.debtAmount,
        attemptCount: target.attemptCount,
        outcome: target.outcome,
        outcomeDetails: target.outcomeDetails,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      })),
    });
  } catch (error) {
    console.error('❌ [Admin Cobrança] Erro ao listar targets falhados:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar targets com erro',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/admin/cobranca/retry-failed - Resetar e reenviar targets
router.post('/retry-failed', async (req, res) => {
  try {
    const { targetIds, retryAll = false } = req.body;
    
    if (!retryAll && (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Forneça targetIds (array) ou retryAll (boolean)',
      });
    }
    
    const { db } = await import('../../db');
    const { createThread } = await import('../../lib/openai');
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    let targetsToRetry;
    
    if (retryAll) {
      // Buscar todos os targets falhados
      targetsToRetry = await db
        .select()
        .from(voiceCampaignTargets)
        .where(eq(voiceCampaignTargets.state, 'failed'));
      
      console.log(`🔄 [Admin Cobrança] Reenviando TODOS os targets falhados (${targetsToRetry.length})`);
    } else {
      // Buscar apenas os IDs especificados
      const { inArray } = await import('drizzle-orm');
      targetsToRetry = await db
        .select()
        .from(voiceCampaignTargets)
        .where(inArray(voiceCampaignTargets.id, targetIds));
      
      console.log(`🔄 [Admin Cobrança] Reenviando ${targetsToRetry.length} target(s) específico(s)`);
    }
    
    if (targetsToRetry.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhum target encontrado para reenvio',
        requeued: 0,
      });
    }
    
    // Resetar estado e reenviar para a fila
    const results = await Promise.all(
      targetsToRetry.map(async (target) => {
        try {
          // 1. Resetar estado do target (sem criar thread - será criado pelo worker)
          await storage.updateVoiceCampaignTarget(target.id, {
            state: 'pending',
            attemptCount: 0,
            outcome: null,
            outcomeDetails: null,
          });
          
          // 2. Re-adicionar à fila
          await addVoiceWhatsAppCollectionToQueue({
            targetId: target.id,
            campaignId: target.campaignId,
            phoneNumber: target.phoneNumber,
            clientName: target.debtorName || 'Cliente',
            clientDocument: target.debtorDocument || '',
            debtAmount: target.debtAmount || 0,
            attemptNumber: 1,
          });
          
          console.log(`✅ [Admin Cobrança] Target ${target.id} (${target.debtorName}) resetado e reenviado`);
          
          return {
            targetId: target.id,
            clientName: target.debtorName,
            success: true,
          };
        } catch (error) {
          console.error(`❌ [Admin Cobrança] Erro ao reenviar target ${target.id}:`, error);
          return {
            targetId: target.id,
            clientName: target.debtorName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    res.json({
      success: true,
      message: `${successful.length} target(s) reenviado(s) com sucesso`,
      requeued: successful.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    console.error('❌ [Admin Cobrança] Erro ao resetar targets:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao resetar e reenviar targets',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/admin/cobranca/unlock-stuck-targets - Desbloquear targets presos em 'calling'
router.post('/unlock-stuck-targets', async (req, res) => {
  try {
    const { db } = await import('../../db');
    const { and } = await import('drizzle-orm');
    
    // Buscar targets presos: state='calling' AND attemptCount >= 3
    const stuckTargets = await db
      .select()
      .from(voiceCampaignTargets)
      .where(
        and(
          eq(voiceCampaignTargets.state, 'calling'),
          // attemptCount >= 3
        )
      );
    
    // Filtrar apenas os que têm attemptCount >= 3
    const targetsToUnlock = stuckTargets.filter(t => (t.attemptCount || 0) >= 3);
    
    console.log(`🔓 [Admin Cobrança] Encontrados ${targetsToUnlock.length} target(s) presos em 'calling' com attemptCount >= 3`);
    
    if (targetsToUnlock.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhum target preso encontrado',
        unlocked: 0,
      });
    }
    
    // Marcar todos como 'failed' com outcome 'max_attempts'
    const results = await Promise.all(
      targetsToUnlock.map(async (target) => {
        try {
          await storage.updateVoiceCampaignTarget(target.id, {
            state: 'failed',
            outcome: 'max_attempts',
            outcomeDetails: `Máximo de tentativas atingido (${target.attemptCount}). Target preso em estado 'calling' - desbloqueado administrativamente.`,
          });
          
          console.log(`✅ [Admin Cobrança] Target ${target.id} (${target.debtorName}) desbloqueado e marcado como 'failed'`);
          
          return {
            targetId: target.id,
            clientName: target.debtorName,
            attemptCount: target.attemptCount,
            success: true,
          };
        } catch (error) {
          console.error(`❌ [Admin Cobrança] Erro ao desbloquear target ${target.id}:`, error);
          return {
            targetId: target.id,
            clientName: target.debtorName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    res.json({
      success: true,
      message: `${successful.length} target(s) desbloqueado(s) com sucesso`,
      unlocked: successful.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    console.error('❌ [Admin Cobrança] Erro ao desbloquear targets presos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao desbloquear targets presos',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/admin/cobranca/enrich-documents - Enriquecer targets com CPF/CNPJ do CRM
router.post('/enrich-documents', async (req, res) => {
  try {
    const { db } = await import('../../db');
    const { isNull } = await import('drizzle-orm');
    
    // Buscar todos os targets SEM CPF/CNPJ
    const targetsWithoutDoc = await db
      .select()
      .from(voiceCampaignTargets)
      .where(isNull(voiceCampaignTargets.debtorDocument));
    
    console.log(`📋 [Admin Cobrança] Encontrados ${targetsWithoutDoc.length} target(s) sem CPF/CNPJ`);
    
    if (targetsWithoutDoc.length === 0) {
      return res.json({
        success: true,
        message: 'Todos os targets já possuem CPF/CNPJ',
        enriched: 0,
      });
    }
    
    const results = await Promise.all(
      targetsWithoutDoc.map(async (target) => {
        try {
          // Consultar CRM para buscar CPF/CNPJ usando telefone
          const cleanPhone = target.phoneNumber.replace(/\D/g, '');
          
          // API do CRM que busca cliente por telefone
          const crmUrl = `https://webhook.trtelecom.net/webhook/buscar_cliente_por_telefone`;
          const response = await fetch(crmUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telefone: cleanPhone }),
          });
          
          if (!response.ok) {
            throw new Error(`CRM API error: ${response.status}`);
          }
          
          const crmData = await response.json();
          
          // CRM retorna { cpf: string, nome: string } ou null
          if (crmData && crmData.cpf) {
            await storage.updateVoiceCampaignTarget(target.id, {
              debtorDocument: crmData.cpf,
            });
            
            console.log(`✅ [Admin Cobrança] Target ${target.id} enriquecido com CPF: ${crmData.cpf}`);
            
            return {
              targetId: target.id,
              clientName: target.debtorName,
              phoneNumber: target.phoneNumber,
              documentFound: crmData.cpf,
              success: true,
            };
          } else {
            console.log(`⚠️ [Admin Cobrança] CPF não encontrado no CRM para ${target.phoneNumber}`);
            
            return {
              targetId: target.id,
              clientName: target.debtorName,
              phoneNumber: target.phoneNumber,
              documentFound: null,
              success: false,
              reason: 'not_found_in_crm',
            };
          }
        } catch (error) {
          console.error(`❌ [Admin Cobrança] Erro ao enriquecer target ${target.id}:`, error);
          return {
            targetId: target.id,
            clientName: target.debtorName,
            phoneNumber: target.phoneNumber,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );
    
    const successful = results.filter(r => r.success);
    const notFound = results.filter(r => !r.success && r.reason === 'not_found_in_crm');
    const failed = results.filter(r => !r.success && r.reason !== 'not_found_in_crm');
    
    res.json({
      success: true,
      message: `${successful.length} target(s) enriquecido(s) com sucesso`,
      enriched: successful.length,
      notFoundInCrm: notFound.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    console.error('❌ [Admin Cobrança] Erro ao enriquecer targets:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao enriquecer targets com CPF/CNPJ',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// DELETE /api/admin/cobranca/clear-targets - Limpar targets para nova importação
router.delete('/clear-targets', async (req, res) => {
  try {
    const { campaignId, confirmDelete = false } = req.body;
    
    if (!confirmDelete) {
      return res.status(400).json({
        success: false,
        error: 'Confirmação necessária: envie { confirmDelete: true } no body',
      });
    }
    
    const { db } = await import('../../db');
    
    let deletedCount = 0;
    
    if (campaignId) {
      // Deletar apenas targets de uma campanha específica
      console.log(`🗑️ [Admin Cobrança] Deletando targets da campanha ${campaignId}`);
      
      const targetsToDelete = await db
        .select()
        .from(voiceCampaignTargets)
        .where(eq(voiceCampaignTargets.campaignId, campaignId));
      
      deletedCount = targetsToDelete.length;
      
      if (deletedCount > 0) {
        await db
          .delete(voiceCampaignTargets)
          .where(eq(voiceCampaignTargets.campaignId, campaignId));
        
        // Resetar estatísticas da campanha
        await storage.updateVoiceCampaignStats(campaignId, {
          totalTargets: 0,
          contactedTargets: 0,
          successfulContacts: 0,
          promisesMade: 0,
          promisesFulfilled: 0,
        });
        
        console.log(`✅ [Admin Cobrança] ${deletedCount} target(s) deletado(s) da campanha ${campaignId}`);
      }
    } else {
      // Deletar TODOS os targets de TODAS as campanhas
      console.log(`🗑️ [Admin Cobrança] Deletando TODOS os targets de todas as campanhas`);
      
      const allTargets = await db.select().from(voiceCampaignTargets);
      deletedCount = allTargets.length;
      
      if (deletedCount > 0) {
        await db.delete(voiceCampaignTargets);
        
        // Resetar estatísticas de todas as campanhas
        const { voiceCampaigns } = await import('@shared/schema');
        await db.update(voiceCampaigns).set({
          totalTargets: 0,
          contactedTargets: 0,
          successfulContacts: 0,
          promisesMade: 0,
          promisesFulfilled: 0,
        });
        
        console.log(`✅ [Admin Cobrança] ${deletedCount} target(s) deletado(s) de todas as campanhas`);
      }
    }
    
    res.json({
      success: true,
      message: `${deletedCount} target(s) deletado(s) com sucesso`,
      deleted: deletedCount,
      campaignId: campaignId || 'all',
    });
  } catch (error) {
    console.error('❌ [Admin Cobrança] Erro ao limpar targets:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar targets',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/admin/cobranca/crm-sync/:campaignId - Buscar configuração de sincronização
router.get('/crm-sync/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const config = await storage.getCRMSyncConfigByCampaignId(campaignId);
    
    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('❌ [Admin Cobrança] Erro ao buscar config de sync:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar configuração de sincronização',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/admin/cobranca/crm-sync/:campaignId/trigger - Executar sincronização manual
router.post('/crm-sync/:campaignId/trigger', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const {
      relativeDays,
      startDate,
      endDate,
      minDebtAmount,
      maxDebtAmount,
      deduplicateBy = 'both',
      updateExisting = true,
    } = req.body;

    // Validar campanha
    const campaign = await storage.getVoiceCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada',
      });
    }

    // Criar ou atualizar configuração de sincronização
    let config = await storage.getCRMSyncConfigByCampaignId(campaignId);
    
    const configData: any = {
      campaignId,
      createdBy: (req as any).user?.id || 'admin',
      apiUrl: 'https://webhook.trtelecom.net/webhook/liacore-consulta-inadimplentes',
      dateRangeType: startDate && endDate ? 'fixed' : 'relative',
      dateRangeDays: relativeDays || 30,
      dateRangeFrom: startDate ? new Date(startDate) : null,
      dateRangeTo: endDate ? new Date(endDate) : null,
      minDebtAmount: minDebtAmount || null,
      maxDebtAmount: maxDebtAmount || null,
      deduplicateBy,
      updateExisting,
    };

    if (config) {
      await storage.updateCRMSyncConfig(config.id, configData);
      config = await storage.getCRMSyncConfig(config.id);
    } else {
      config = await storage.createCRMSyncConfig(configData);
    }

    if (!config) {
      throw new Error('Erro ao criar/atualizar configuração');
    }

    // Adicionar job à fila
    const { addVoiceCRMSyncToQueue } = await import('../../lib/queue');
    await addVoiceCRMSyncToQueue({ 
      syncConfigId: config.id,
      campaignId,
      isManualTrigger: true, // Bypass enabled check for manual triggers
    });

    console.log(`✅ [Admin Cobrança] Sincronização CRM iniciada para campanha ${campaignId}`);

    res.json({
      success: true,
      message: 'Sincronização iniciada com sucesso',
      configId: config.id,
    });
  } catch (error) {
    console.error('❌ [Admin Cobrança] Erro ao iniciar sync:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao iniciar sincronização',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/admin/cobranca/crm-sync-history - Histórico de sincronizações
router.get('/crm-sync-history', async (req, res) => {
  try {
    const { db } = await import('../../db');
    const { crmSyncConfigs } = await import('@shared/schema');
    const { desc } = await import('drizzle-orm');

    // Buscar todas as configurações com histórico de sync
    const configs = await db
      .select()
      .from(crmSyncConfigs)
      .orderBy(desc(crmSyncConfigs.lastSyncAt));

    res.json({
      success: true,
      history: configs,
    });
  } catch (error) {
    console.error('❌ [Admin Cobrança] Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar histórico de sincronizações',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/admin/cobranca/clear-queue - Limpar fila de WhatsApp pendente
router.post('/clear-queue', async (req, res) => {
  try {
    const { Queue } = await import('bullmq');
    const { QUEUE_NAMES } = await import('../../lib/queue');
    const { redisConnection } = await import('../../lib/redis-config');
    
    console.log('🧹 [Admin Cobrança] Limpando fila de WhatsApp pendente...');
    
    // Conectar à fila
    const whatsappQueue = new Queue(QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION, {
      connection: redisConnection,
    });
    
    // Obter estatísticas antes da limpeza
    const beforeStats = await whatsappQueue.getJobCounts();
    console.log('📊 [Admin Cobrança] Jobs antes da limpeza:', beforeStats);
    
    // Limpar todos os jobs pendentes (waiting, delayed, active)
    await whatsappQueue.drain(true); // true = remover jobs delayed também
    
    // Obter estatísticas depois da limpeza
    const afterStats = await whatsappQueue.getJobCounts();
    console.log('📊 [Admin Cobrança] Jobs após limpeza:', afterStats);
    
    res.json({
      success: true,
      message: 'Fila de WhatsApp limpa com sucesso',
      before: beforeStats,
      after: afterStats,
      cleared: {
        waiting: beforeStats.waiting,
        delayed: beforeStats.delayed,
        active: beforeStats.active,
      }
    });
  } catch (error) {
    console.error('❌ [Admin Cobrança] Erro ao limpar fila:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar fila de WhatsApp',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
