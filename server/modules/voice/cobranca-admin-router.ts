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
        clientName: target.clientName,
        phoneNumber: target.phoneNumber,
        clientDocument: target.clientDocument,
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
          // 1. Criar novo thread OpenAI com contexto do cliente
          const newThreadId = await createThread();
          
          // 2. Injetar contexto do cliente no thread (igual ao worker original)
          if (target.clientName && target.clientDocument) {
            const contextMessage = `
Cliente: ${target.clientName}
CPF/CNPJ: ${target.clientDocument}
Telefone: ${target.phoneNumber}
Valor em aberto: R$ ${target.debtAmount?.toFixed(2) || '0.00'}

Você está iniciando uma abordagem de cobrança empática. Siga o fluxo estruturado do seu prompt.
            `.trim();
            
            await openai.beta.threads.messages.create(newThreadId, {
              role: 'user',
              content: contextMessage,
            });
            
            console.log(`✅ [Admin Cobrança] Thread ${newThreadId} criado com contexto para ${target.clientName}`);
          }
          
          // 3. Resetar estado do target
          await storage.updateVoiceCampaignTarget(target.id, {
            state: 'pending',
            attemptCount: 0,
            outcome: null,
            outcomeDetails: null,
            threadId: newThreadId,
          });
          
          // 4. Re-adicionar à fila
          await addVoiceWhatsAppCollectionToQueue({
            targetId: target.id,
            campaignId: target.campaignId,
            phoneNumber: target.phoneNumber,
            clientName: target.clientName || 'Cliente',
            clientDocument: target.clientDocument || undefined,
            debtAmount: target.debtAmount || 0,
            attemptNumber: 1,
          });
          
          console.log(`✅ [Admin Cobrança] Target ${target.id} (${target.clientName}) resetado e reenviado`);
          
          return {
            targetId: target.id,
            clientName: target.clientName,
            success: true,
          };
        } catch (error) {
          console.error(`❌ [Admin Cobrança] Erro ao reenviar target ${target.id}:`, error);
          return {
            targetId: target.id,
            clientName: target.clientName,
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

export default router;
