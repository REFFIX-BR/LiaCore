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
    channelBreakdown: {
      voice: voiceStats,
      whatsapp: whatsappStats,
    },
  };

  console.log('✅ [Voice Metrics] Métricas calculadas:', {
    totalCalls: metrics.totalCalls,
    totalMessages: metrics.totalWhatsAppMessages,
    conversionRate: `${metrics.conversionRate}%`,
  });

  return metrics;
}
