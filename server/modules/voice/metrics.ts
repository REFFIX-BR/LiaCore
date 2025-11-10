import { storage } from '../../storage';

export interface VoiceMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalCalls: number;
  totalWhatsAppMessages: number;
  successfulCalls: number;
  successfulMessages: number;
  pendingPromises: number;
  fulfilledPromises: number;
  conversionRate: number;
  byMethod: {
    voice: {
      totalTargets: number;
      contacted: number;
      successful: number;
      successRate: string;
    };
    whatsapp: {
      totalTargets: number;
      contacted: number;
      successful: number;
      successRate: string;
    };
  };
  channelBreakdown: {
    voice: {
      total: number;
      successful: number;
      failed: number;
      pending: number;
    };
    whatsapp: {
      total: number;
      successful: number;
      failed: number;
      pending: number;
    };
  };
}

export async function getVoiceMetrics(): Promise<VoiceMetrics> {
  console.log('📊 [Voice Metrics] Calculando métricas unificadas...');

  // 1. Buscar todas as campanhas
  const campaigns = await storage.getAllVoiceCampaigns();
  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  console.log(`📋 [Voice Metrics] ${campaigns.length} campanhas total, ${activeCampaigns.length} ativas`);

  // 2. Buscar todos os targets de todas as campanhas
  let allTargets: any[] = [];
  for (const campaign of campaigns) {
    const targets = await storage.getVoiceCampaignTargets(campaign.id);
    allTargets = allTargets.concat(targets);
  }

  console.log(`🎯 [Voice Metrics] ${allTargets.length} targets total`);

  // 3. Separar por canal (contactMethod)
  const voiceTargets = allTargets.filter(t => t.contactMethod === 'voice');
  const whatsappTargets = allTargets.filter(t => t.contactMethod === 'whatsapp');

  // 4. Calcular estatísticas por canal
  const voiceStats = {
    total: voiceTargets.length,
    successful: voiceTargets.filter(t => t.outcome === 'payment_promise' || t.outcome === 'paid').length,
    failed: voiceTargets.filter(t => t.outcome === 'refused' || t.outcome === 'no_answer' || t.state === 'failed').length,
    pending: voiceTargets.filter(t => t.state === 'pending' || t.state === 'scheduled' || t.state === 'in_progress').length,
  };

  const whatsappStats = {
    total: whatsappTargets.length,
    successful: whatsappTargets.filter(t => t.outcome === 'payment_promise' || t.outcome === 'paid').length,
    failed: whatsappTargets.filter(t => t.outcome === 'refused' || t.state === 'failed').length,
    pending: whatsappTargets.filter(t => t.state === 'pending' || t.state === 'scheduled' || t.state === 'in_progress').length,
  };

  // 4.1. Calcular métricas detalhadas por método (para dashboard)
  const voiceContacted = voiceTargets.filter(t => t.state === 'contacted' || t.state === 'completed').length;
  const voiceSuccessful = voiceTargets.filter(t => (t.attemptCount || 0) > 0 && t.state === 'completed').length;

  const whatsappContacted = whatsappTargets.filter(t => t.state === 'contacted' || t.state === 'completed').length;
  // WhatsApp: Count as successful when message was sent (outcome='whatsapp_sent')
  // Unlike voice calls, WhatsApp doesn't have a 'completed' state - it stops at 'contacted'
  const whatsappSuccessful = whatsappTargets.filter(t => t.outcome === 'whatsapp_sent').length;

  // 5. Buscar promessas de pagamento
  const promises = await storage.getAllVoicePromises();
  const pendingPromises = promises.filter(p => p.status === 'pending');
  const fulfilledPromises = promises.filter(p => p.status === 'fulfilled');

  console.log(`🤝 [Voice Metrics] ${promises.length} promessas total (${pendingPromises.length} pendentes, ${fulfilledPromises.length} cumpridas)`);

  // 6. Calcular taxa de conversão geral
  const totalAttempts = allTargets.filter(t => t.state !== 'pending' && t.state !== 'scheduled').length;
  const totalSuccessful = voiceStats.successful + whatsappStats.successful;
  const conversionRate = totalAttempts > 0 ? (totalSuccessful / totalAttempts) * 100 : 0;

  const metrics: VoiceMetrics = {
    totalCampaigns: campaigns.length,
    activeCampaigns: activeCampaigns.length,
    totalCalls: voiceStats.total,
    totalWhatsAppMessages: whatsappStats.total,
    successfulCalls: voiceStats.successful,
    successfulMessages: whatsappStats.successful,
    pendingPromises: pendingPromises.length,
    fulfilledPromises: fulfilledPromises.length,
    conversionRate: Math.round(conversionRate * 10) / 10, // 1 decimal place
    byMethod: {
      voice: {
        totalTargets: voiceTargets.length,
        contacted: voiceContacted,
        successful: voiceSuccessful,
        successRate: voiceContacted > 0 ? ((voiceSuccessful / voiceContacted) * 100).toFixed(2) : '0',
      },
      whatsapp: {
        totalTargets: whatsappTargets.length,
        contacted: whatsappContacted,
        successful: whatsappSuccessful,
        successRate: whatsappContacted > 0 ? ((whatsappSuccessful / whatsappContacted) * 100).toFixed(2) : '0',
      },
    },
    channelBreakdown: {
      voice: voiceStats,
      whatsapp: whatsappStats,
    },
  };

  console.log('✅ [Voice Metrics] Métricas calculadas:', {
    totalCalls: metrics.totalCalls,
    totalMessages: metrics.totalWhatsAppMessages,
    conversionRate: `${metrics.conversionRate}%`,
    byMethod: metrics.byMethod,
  });

  return metrics;
}
