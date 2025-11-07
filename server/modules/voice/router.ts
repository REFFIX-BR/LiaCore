import express from 'express';
import { isFeatureEnabled, getAllFeatureFlags, setFeatureFlag } from '../../lib/featureFlags';
import { authenticate, requireAdmin, requireAdminOrSupervisor } from '../../middleware/auth';

const router = express.Router();

// Middleware para verificar se o módulo está habilitado
async function requireVoiceModule(req: express.Request, res: express.Response, next: express.NextFunction) {
  const isEnabled = await isFeatureEnabled('voice_outbound_enabled');
  if (!isEnabled) {
    return res.status(503).json({ 
      error: 'Módulo LIA VOICE não está habilitado',
      code: 'VOICE_MODULE_DISABLED'
    });
  }
  next();
}

// ===== FEATURE FLAGS =====
router.get('/feature-flags', authenticate, async (req, res) => {
  try {
    const flags = await getAllFeatureFlags();
    res.json(flags);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching feature flags:', error);
    res.status(500).json({ error: 'Erro ao buscar feature flags' });
  }
});

router.put('/feature-flags/:key', authenticate, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { isEnabled, metadata } = req.body;
    const userId = req.user?.id;

    await setFeatureFlag(
      key as any,
      isEnabled,
      userId,
      metadata
    );

    res.json({ success: true, message: `Feature flag ${key} atualizada` });
  } catch (error: any) {
    console.error('❌ [Voice API] Error updating feature flag:', error);
    res.status(500).json({ error: 'Erro ao atualizar feature flag' });
  }
});

// ===== CAMPAIGNS =====
router.get('/campaigns', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    // TODO: Implementar listagem de campanhas
    res.json([]);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching campaigns:', error);
    res.status(500).json({ error: 'Erro ao buscar campanhas' });
  }
});

router.post('/campaigns', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    // TODO: Implementar criação de campanha
    res.status(501).json({ error: 'Não implementado' });
  } catch (error: any) {
    console.error('❌ [Voice API] Error creating campaign:', error);
    res.status(500).json({ error: 'Erro ao criar campanha' });
  }
});

router.get('/campaigns/:id', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    // TODO: Implementar busca de campanha por ID
    res.status(501).json({ error: 'Não implementado' });
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching campaign:', error);
    res.status(500).json({ error: 'Erro ao buscar campanha' });
  }
});

router.patch('/campaigns/:id', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    // TODO: Implementar atualização de campanha
    res.status(501).json({ error: 'Não implementado' });
  } catch (error: any) {
    console.error('❌ [Voice API] Error updating campaign:', error);
    res.status(500).json({ error: 'Erro ao atualizar campanha' });
  }
});

// ===== TARGETS =====
router.get('/campaigns/:campaignId/targets', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    // TODO: Implementar listagem de targets
    res.json([]);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching targets:', error);
    res.status(500).json({ error: 'Erro ao buscar alvos' });
  }
});

// ===== PROMISES =====
router.get('/promises', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    // TODO: Implementar listagem de promessas
    res.json([]);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching promises:', error);
    res.status(500).json({ error: 'Erro ao buscar promessas' });
  }
});

// ===== STATS =====
router.get('/stats', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    // TODO: Implementar estatísticas gerais
    res.json({
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalCalls: 0,
      successRate: 0,
      promisesMade: 0,
      promisesFulfilled: 0,
    });
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching stats:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

export default router;
