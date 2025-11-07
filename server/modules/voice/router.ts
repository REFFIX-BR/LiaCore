import express from 'express';
import { isFeatureEnabled, getAllFeatureFlags, setFeatureFlag } from '../../lib/featureFlags';
import { authenticate, requireAdmin, requireAdminOrSupervisor } from '../../middleware/auth';
import { storage } from '../../storage';
import { insertVoiceCampaignSchema, insertVoiceCampaignTargetSchema } from '@shared/schema';
import { z } from 'zod';
import twilio from 'twilio';
import { addVoiceSchedulingToQueue } from '../../lib/queue';

const router = express.Router();

/**
 * Service to activate a voice campaign by enqueuing all pending targets
 * This is idempotent - won't duplicate jobs for already-scheduled targets
 */
async function activateVoiceCampaign(campaignId: string): Promise<{ enqueued: number; skipped: number }> {
  console.log(`🚀 [Voice Activation] Activating campaign ${campaignId}`);
  
  const targets = await storage.getVoiceCampaignTargets(campaignId);
  
  console.log(`🔍 [Voice Activation] DEBUG - First target:`, targets[0] ? {
    id: targets[0].id,
    state: targets[0].state,
    attemptCount: targets[0].attemptCount,
    keys: Object.keys(targets[0])
  } : 'No targets');
  
  const pendingTargets = targets.filter(t => t.state === 'pending' && t.attemptCount === 0);
  
  console.log(`📊 [Voice Activation] Found ${pendingTargets.length} pending targets (${targets.length} total)`);
  
  let enqueued = 0;
  let skipped = 0;
  
  for (const target of pendingTargets) {
    try {
      // Schedule for 10 seconds from now to allow time for logs to be visible
      const scheduledFor = new Date(Date.now() + 10000);
      
      await addVoiceSchedulingToQueue({
        targetId: target.id,
        campaignId,
        scheduledFor,
        attemptNumber: 1,
      });
      
      enqueued++;
      console.log(`✅ [Voice Activation] Enqueued target: ${target.debtorName} (${target.phoneNumber})`);
    } catch (error: any) {
      console.error(`❌ [Voice Activation] Failed to enqueue target ${target.id}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`🎉 [Voice Activation] Campaign activated: ${enqueued} enqueued, ${skipped} skipped`);
  
  return { enqueued, skipped };
}

// Middleware para verificar assinatura Twilio
async function validateTwilioSignature(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const { getTwilioAuthToken } = await import('../../lib/twilioIntegration');
    const authToken = await getTwilioAuthToken();
    const baseUrl = process.env.WEBHOOK_BASE_URL;

    if (!baseUrl) {
      console.error('❌ [Twilio Webhook] Missing WEBHOOK_BASE_URL');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const twilioSignature = req.headers['x-twilio-signature'] as string;
    if (!twilioSignature) {
      console.error('❌ [Twilio Webhook] Missing X-Twilio-Signature header');
      return res.status(403).json({ error: 'Forbidden: Missing signature' });
    }

    const url = `${baseUrl}${req.originalUrl}`;
    const params = req.method === 'POST' ? req.body : req.query;

    const isValid = twilio.validateRequest(authToken, twilioSignature, url, params);

    if (!isValid) {
      console.error('❌ [Twilio Webhook] Invalid signature');
      return res.status(403).json({ error: 'Forbidden: Invalid signature' });
    }

    console.log('✅ [Twilio Webhook] Signature validated');
    next();
  } catch (error: any) {
    console.error('❌ [Twilio Webhook] Error validating signature:', error.message);
    return res.status(500).json({ error: 'Server configuration error' });
  }
}

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

// ===== TWILIO CONNECTION TEST =====
router.get('/test-twilio', authenticate, requireAdminOrSupervisor, async (req, res) => {
  try {
    const { getTwilioClient, getTwilioFromPhoneNumber } = await import('../../lib/twilioIntegration');
    
    const twilioClient = await getTwilioClient();
    const fromPhoneNumber = await getTwilioFromPhoneNumber();
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL;
    
    const account = await twilioClient.api.accounts(twilioClient.accountSid).fetch();
    
    const maskString = (str: string, visibleChars: number = 4) => {
      if (!str || str.length <= visibleChars) return str;
      return str.slice(0, visibleChars) + '***' + str.slice(-visibleChars);
    };
    
    res.json({
      success: true,
      connection: {
        accountSid: maskString(account.sid),
        accountStatus: account.status,
        accountFriendlyName: account.friendlyName,
        fromPhoneNumber: fromPhoneNumber,
        webhookBaseUrl: webhookBaseUrl || 'NOT_CONFIGURED',
      },
      message: 'Conexão Twilio validada com sucesso',
    });
  } catch (error: any) {
    console.error('❌ [Voice API] Error testing Twilio connection:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao testar conexão Twilio',
      details: error.message,
    });
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
    
    // Get current campaign to detect status change
    const currentCampaign = await storage.getVoiceCampaign(id);
    if (!currentCampaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }
    
    // Update campaign
    const campaign = await storage.updateVoiceCampaign(id, updates);
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }
    
    console.log('✅ [Voice API] Campaign updated:', id);
    
    // If status changed to 'active', enqueue all pending targets
    if (updates.status === 'active' && currentCampaign.status !== 'active') {
      console.log('🚀 [Voice API] Status changed to active, triggering campaign activation...');
      try {
        const result = await activateVoiceCampaign(id);
        console.log(`✅ [Voice API] Campaign activation complete: ${result.enqueued} targets enqueued`);
        res.json({ ...campaign, activationResult: result });
      } catch (activationError: any) {
        console.error('❌ [Voice API] Error during campaign activation:', activationError);
        // Campaign was updated but activation failed - still return success but with warning
        res.json({ ...campaign, activationWarning: 'Campaign updated but target scheduling failed' });
      }
    } else {
      res.json(campaign);
    }
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
    
    // Recalculate campaign statistics
    await storage.recalculateVoiceCampaignStats(campaignId);
    
    console.log(`✅ [Voice API] ${created.length} targets created for campaign ${campaignId}`);
    res.status(201).json({ success: true, count: created.length, targets: created });
  } catch (error: any) {
    console.error('❌ [Voice API] Error creating targets:', error);
    res.status(500).json({ error: 'Erro ao criar alvos' });
  }
});

router.get('/targets', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const { campaignId, state, search } = req.query;
    
    let targets;
    if (campaignId && typeof campaignId === 'string') {
      if (state && typeof state === 'string') {
        targets = await storage.getVoiceCampaignTargetsByState(campaignId, state);
      } else {
        targets = await storage.getVoiceCampaignTargets(campaignId);
      }
    } else {
      // Get all targets across all campaigns
      targets = await storage.getAllVoiceCampaignTargets();
    }
    
    // Apply search filter if provided
    if (search && typeof search === 'string' && targets) {
      const searchLower = search.toLowerCase();
      targets = targets.filter((t: any) => 
        (t.debtorName && t.debtorName.toLowerCase().includes(searchLower)) ||
        (t.phoneNumber && t.phoneNumber.includes(search))
      );
    }
    
    res.json(targets || []);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching targets:', error);
    res.status(500).json({ error: 'Erro ao buscar alvos' });
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

// ===== RECENT ACTIVITY =====
router.get('/activity', authenticate, requireAdminOrSupervisor, requireVoiceModule, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const allTargets = await storage.getAllVoiceCampaignTargets();
    
    const recentActivity = allTargets
      .filter(t => t.state !== 'pending' || (t.attemptCount || 0) > 0)
      .sort((a, b) => {
        const aTime = a.lastAttemptAt || a.createdAt;
        const bTime = b.lastAttemptAt || b.createdAt;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return bTime.getTime() - aTime.getTime();
      })
      .slice(0, limit)
      .map(t => ({
        id: t.id,
        campaignId: t.campaignId,
        debtorName: t.debtorName,
        phoneNumber: t.phoneNumber,
        state: t.state,
        outcome: t.outcome,
        attemptCount: t.attemptCount || 0,
        lastAttemptAt: t.lastAttemptAt,
      }));
    
    res.json(recentActivity);
  } catch (error: any) {
    console.error('❌ [Voice API] Error fetching activity:', error);
    res.status(500).json({ error: 'Erro ao buscar atividades' });
  }
});

// ===== TWILIO WEBHOOKS (Twilio signature verification) =====
router.post('/webhook/twiml', express.text({ type: '*/*' }), validateTwilioSignature, async (req, res) => {
  try {
    const { targetId, campaignId, attemptNumber } = req.query;
    
    console.log(`📞 [Voice Webhook] TwiML requested for target ${targetId}`);

    const target = await storage.getVoiceCampaignTarget(targetId as string);
    if (!target) {
      console.error(`❌ [Voice Webhook] Target ${targetId} not found`);
      return res.status(404).send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Erro no sistema.</Say><Hangup/></Response>');
    }

    const campaign = await storage.getVoiceCampaign(campaignId as string);
    if (!campaign) {
      console.error(`❌ [Voice Webhook] Campaign ${campaignId} not found`);
      return res.status(404).send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Erro no sistema.</Say><Hangup/></Response>');
    }

    const { createOpenAIRealtimeSession } = await import('../../lib/voiceCall');
    
    const openAISession = await createOpenAIRealtimeSession({
      systemPrompt: campaign.systemPrompt || '',
      clientName: target.debtorName,
      debtAmount: target.debtAmount || 0,
      debtDetails: target.debtorMetadata ? JSON.stringify(target.debtorMetadata) : undefined,
    });

    const baseUrl = process.env.VOICE_WEBHOOK_BASE_URL || '';
    const streamUrl = `wss://${baseUrl.replace('https://', '')}/api/voice/webhook/stream?sessionId=${openAISession.sessionId}&targetId=${targetId}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;

    console.log(`✅ [Voice Webhook] TwiML generated for target ${targetId}`);
    res.type('text/xml').send(twiml);
  } catch (error: any) {
    console.error('❌ [Voice Webhook] Error generating TwiML:', error);
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Desculpe, ocorreu um erro.</Say><Hangup/></Response>');
  }
});

router.post('/webhook/status', express.urlencoded({ extended: false }), validateTwilioSignature, async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;
    
    console.log(`📊 [Voice Webhook] Status update: ${CallSid} - ${CallStatus}`);

    if (CallStatus === 'completed') {
      const attempts = await storage.getAllVoiceCallAttempts();
      const attempt = attempts.find(a => a.callSid === CallSid);
      
      if (attempt) {
        await storage.updateVoiceCallAttempt(attempt.id, {
          status: 'completed',
          durationSeconds: parseInt(CallDuration || '0', 10),
          recordingUrl: RecordingUrl,
        });

        const { addVoicePostCallToQueue } = await import('../../lib/queue');
        await addVoicePostCallToQueue({
          attemptId: attempt.id,
          targetId: attempt.targetId,
          campaignId: attempt.campaignId,
          callSid: CallSid,
          callDuration: parseInt(CallDuration || '0', 10),
          callStatus: CallStatus,
          recordingUrl: RecordingUrl,
          conversationData: {},
        });

        console.log(`✅ [Voice Webhook] Post-call processing queued for attempt ${attempt.id}`);
      }
    }

    res.sendStatus(200);
  } catch (error: any) {
    console.error('❌ [Voice Webhook] Error processing status:', error);
    res.sendStatus(500);
  }
});

router.post('/webhook/recording', express.urlencoded({ extended: false }), validateTwilioSignature, async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingSid } = req.body;
    
    console.log(`🎙️ [Voice Webhook] Recording received: ${RecordingSid}`);

    const attempts = await storage.getAllVoiceCallAttempts();
    const attempt = attempts.find(a => a.callSid === CallSid);
    
    if (attempt) {
      await storage.updateVoiceCallAttempt(attempt.id, {
        recordingUrl: RecordingUrl,
      });
      console.log(`✅ [Voice Webhook] Recording URL saved for attempt ${attempt.id}`);
    }

    res.sendStatus(200);
  } catch (error: any) {
    console.error('❌ [Voice Webhook] Error processing recording:', error);
    res.sendStatus(500);
  }
});

export default router;
