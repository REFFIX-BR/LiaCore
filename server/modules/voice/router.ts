import express from 'express';
import { isFeatureEnabled, getAllFeatureFlags, setFeatureFlag } from '../../lib/featureFlags';
import { authenticate, requireAdmin, requireAdminOrSupervisor } from '../../middleware/auth';
import { storage } from '../../storage';
import { insertVoiceCampaignSchema, insertVoiceCampaignTargetSchema } from '@shared/schema';
import { z } from 'zod';

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
    const userId = req.user?.userId;

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
    const { status } = req.query;
    
    let campaigns;
    if (status && typeof status === 'string') {
      campaigns = await storage.getVoiceCampaignsByStatus(status);
    } else {
      campaigns = await storage.getAllVoiceCampaigns();
    }
    
    res.json(campaigns);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching campaigns:', error);
    res.status(500).json({ error: 'Erro ao buscar campanhas' });
  }
});

router.post('/campaigns', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const validatedData = insertVoiceCampaignSchema.parse({
      ...req.body,
      createdBy: req.user?.userId,
    });
    
    const campaign = await storage.createVoiceCampaign(validatedData);
    
    console.log('✅ [Voice API] Campaign created:', campaign.id);
    res.status(201).json(campaign);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('❌ [Voice API] Error creating campaign:', error);
    res.status(500).json({ error: 'Erro ao criar campanha' });
  }
});

router.get('/campaigns/:id', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await storage.getVoiceCampaign(id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }
    
    res.json(campaign);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching campaign:', error);
    res.status(500).json({ error: 'Erro ao buscar campanha' });
  }
});

router.patch('/campaigns/:id', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const campaign = await storage.updateVoiceCampaign(id, updates);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }
    
    console.log('✅ [Voice API] Campaign updated:', id);
    res.json(campaign);
  } catch (error: any) {
    console.error('❌ [Voice API] Error updating campaign:', error);
    res.status(500).json({ error: 'Erro ao atualizar campanha' });
  }
});

router.delete('/campaigns/:id', authenticate, requireAdmin, requireVoiceModule, async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteVoiceCampaign(id);
    
    console.log('✅ [Voice API] Campaign deleted:', id);
    res.json({ success: true, message: 'Campanha excluída com sucesso' });
  } catch (error: any) {
    console.error('❌ [Voice API] Error deleting campaign:', error);
    res.status(500).json({ error: 'Erro ao excluir campanha' });
  }
});

// ===== TARGETS =====
router.get('/campaigns/:campaignId/targets', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { state } = req.query;
    
    let targets;
    if (state && typeof state === 'string') {
      targets = await storage.getVoiceCampaignTargetsByState(campaignId, state);
    } else {
      targets = await storage.getVoiceCampaignTargets(campaignId);
    }
    
    res.json(targets);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching targets:', error);
    res.status(500).json({ error: 'Erro ao buscar alvos' });
  }
});

router.post('/campaigns/:campaignId/targets', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { targets } = req.body;
    
    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: 'Lista de targets é obrigatória' });
    }
    
    const targetsWithCampaign = targets.map(t => ({
      ...t,
      campaignId,
    }));
    
    const created = await storage.createVoiceCampaignTargets(targetsWithCampaign);
    
    console.log(`✅ [Voice API] ${created.length} targets created for campaign ${campaignId}`);
    res.status(201).json({ success: true, count: created.length, targets: created });
  } catch (error: any) {
    console.error('❌ [Voice API] Error creating targets:', error);
    res.status(500).json({ error: 'Erro ao criar alvos' });
  }
});

router.get('/targets/:id', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { id } = req.params;
    const target = await storage.getVoiceCampaignTarget(id);
    
    if (!target) {
      return res.status(404).json({ error: 'Alvo não encontrado' });
    }
    
    res.json(target);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching target:', error);
    res.status(500).json({ error: 'Erro ao buscar alvo' });
  }
});

router.patch('/targets/:id', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const target = await storage.updateVoiceCampaignTarget(id, updates);
    
    if (!target) {
      return res.status(404).json({ error: 'Alvo não encontrado' });
    }
    
    res.json(target);
  } catch (error: any) {
    console.error('❌ [Voice API] Error updating target:', error);
    res.status(500).json({ error: 'Erro ao atualizar alvo' });
  }
});

// ===== CALL ATTEMPTS =====
router.get('/targets/:targetId/attempts', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { targetId } = req.params;
    const attempts = await storage.getVoiceCallAttempts(targetId);
    res.json(attempts);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching attempts:', error);
    res.status(500).json({ error: 'Erro ao buscar tentativas' });
  }
});

router.get('/campaigns/:campaignId/attempts', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const attempts = await storage.getVoiceCallAttemptsByCampaign(campaignId);
    res.json(attempts);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching campaign attempts:', error);
    res.status(500).json({ error: 'Erro ao buscar tentativas da campanha' });
  }
});

// ===== PROMISES =====
router.get('/promises', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { status, campaignId } = req.query;
    
    let promises;
    if (status && typeof status === 'string') {
      promises = await storage.getVoicePromisesByStatus(status);
    } else if (campaignId && typeof campaignId === 'string') {
      promises = await storage.getVoicePromisesByCampaign(campaignId);
    } else {
      promises = await storage.getAllVoicePromises();
    }
    
    res.json(promises);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching promises:', error);
    res.status(500).json({ error: 'Erro ao buscar promessas' });
  }
});

router.get('/promises/:id', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { id } = req.params;
    const promise = await storage.getVoicePromise(id);
    
    if (!promise) {
      return res.status(404).json({ error: 'Promessa não encontrada' });
    }
    
    res.json(promise);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching promise:', error);
    res.status(500).json({ error: 'Erro ao buscar promessa' });
  }
});

router.patch('/promises/:id', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const promise = await storage.updateVoicePromise(id, updates);
    
    if (!promise) {
      return res.status(404).json({ error: 'Promessa não encontrada' });
    }
    
    res.json(promise);
  } catch (error: any) {
    console.error('❌ [Voice API] Error updating promise:', error);
    res.status(500).json({ error: 'Erro ao atualizar promessa' });
  }
});

router.post('/promises/:id/fulfill', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { id } = req.params;
    await storage.markVoicePromiseAsFulfilled(id);
    
    console.log('✅ [Voice API] Promise fulfilled:', id);
    res.json({ success: true, message: 'Promessa marcada como cumprida' });
  } catch (error: any) {
    console.error('❌ [Voice API] Error fulfilling promise:', error);
    res.status(500).json({ error: 'Erro ao cumprir promessa' });
  }
});

// ===== CONFIGS =====
router.get('/configs', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const configs = await storage.getAllVoiceConfigs();
    res.json(configs);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching configs:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

router.get('/configs/:key', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { key } = req.params;
    const config = await storage.getVoiceConfig(key);
    
    if (!config) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }
    
    res.json(config);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching config:', error);
    res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
});

router.put('/configs/:key', authenticate, requireAdmin, requireVoiceModule, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    
    const config = await storage.setVoiceConfig({
      key,
      value,
      description,
      updatedBy: req.user?.userId || null,
    });
    
    console.log('✅ [Voice API] Config updated:', key);
    res.json(config);
  } catch (error: any) {
    console.error('❌ [Voice API] Error setting config:', error);
    res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
});

router.delete('/configs/:key', authenticate, requireAdmin, requireVoiceModule, async (req, res) => {
  try {
    const { key } = req.params;
    await storage.deleteVoiceConfig(key);
    
    console.log('✅ [Voice API] Config deleted:', key);
    res.json({ success: true, message: 'Configuração excluída' });
  } catch (error: any) {
    console.error('❌ [Voice API] Error deleting config:', error);
    res.status(500).json({ error: 'Erro ao excluir configuração' });
  }
});

// ===== STATS =====
router.get('/stats', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const allCampaigns = await storage.getAllVoiceCampaigns();
    const activeCampaigns = await storage.getActiveVoiceCampaigns();
    const allPromises = await storage.getAllVoicePromises();
    
    const totalCalls = allCampaigns.reduce((sum, c) => sum + (c.contactedTargets || 0), 0);
    const successfulCalls = allCampaigns.reduce((sum, c) => sum + (c.successfulContacts || 0), 0);
    const promisesMade = allPromises.length;
    const promisesFulfilled = allPromises.filter(p => p.status === 'fulfilled').length;
    
    res.json({
      totalCampaigns: allCampaigns.length,
      activeCampaigns: activeCampaigns.length,
      totalCalls,
      successfulCalls,
      successRate: totalCalls > 0 ? (successfulCalls / totalCalls * 100).toFixed(2) : 0,
      promisesMade,
      promisesFulfilled,
      promiseFulfillmentRate: promisesMade > 0 ? (promisesFulfilled / promisesMade * 100).toFixed(2) : 0,
    });
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching stats:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

export default router;
