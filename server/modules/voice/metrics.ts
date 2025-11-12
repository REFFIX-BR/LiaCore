import { storage } from '../../storage';

export interface VoiceMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalTargets: number;
  contactedTargets: number;
  successfulContacts: number;
  pendingPromises: number;
  fulfilledPromises: number;
  conversionRate: number;
  whatsapp: {
    total: number;
    contacted: number;
    successful: number;
    failed: number;
    pending: number;
    successRate: string;
  };
}

export async function getVoiceMetrics(): Promise<VoiceMetrics> {
  console.log('📊 [Collection Metrics] Calculating WhatsApp-only metrics...');

  // 1. Get all campaigns
  const campaigns = await storage.getAllVoiceCampaigns();
  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  console.log(`📋 [Collection Metrics] ${campaigns.length} campaigns total, ${activeCampaigns.length} active`);

  // 2. Get all targets (WhatsApp-only now)
  let allTargets: any[] = [];
  for (const campaign of campaigns) {
    const targets = await storage.getVoiceCampaignTargets(campaign.id);
    allTargets = allTargets.concat(targets);
  }

  console.log(`🎯 [Collection Metrics] ${allTargets.length} targets total`);

  // 3. Calculate WhatsApp statistics
  const whatsappStats = {
    total: allTargets.length,
    contacted: allTargets.filter(t => t.state === 'contacted' || t.state === 'completed').length,
    successful: allTargets.filter(t => t.outcome === 'whatsapp_sent' || t.outcome === 'payment_promise' || t.outcome === 'paid').length,
    failed: allTargets.filter(t => t.outcome === 'refused' || t.state === 'failed').length,
    pending: allTargets.filter(t => t.state === 'pending' || t.state === 'scheduled').length,
    successRate: '0',
  };

  // Calculate success rate
  if (whatsappStats.contacted > 0) {
    whatsappStats.successRate = ((whatsappStats.successful / whatsappStats.contacted) * 100).toFixed(2);
  }

  // 4. Get payment promises
  const promises = await storage.getAllVoicePromises();
  const pendingPromises = promises.filter(p => p.status === 'pending');
  const fulfilledPromises = promises.filter(p => p.status === 'fulfilled');

  console.log(`🤝 [Collection Metrics] ${promises.length} promises total (${pendingPromises.length} pending, ${fulfilledPromises.length} fulfilled)`);

  // 5. Calculate overall conversion rate
  const totalAttempted = allTargets.filter(t => t.state !== 'pending' && t.state !== 'scheduled').length;
  const conversionRate = totalAttempted > 0 ? (whatsappStats.successful / totalAttempted) * 100 : 0;

  const metrics: VoiceMetrics = {
    totalCampaigns: campaigns.length,
    activeCampaigns: activeCampaigns.length,
    totalTargets: allTargets.length,
    contactedTargets: whatsappStats.contacted,
    successfulContacts: whatsappStats.successful,
    pendingPromises: pendingPromises.length,
    fulfilledPromises: fulfilledPromises.length,
    conversionRate: Math.round(conversionRate * 10) / 10, // 1 decimal place
    whatsapp: whatsappStats,
  };

  console.log('✅ [Collection Metrics] Metrics calculated:', {
    totalTargets: metrics.totalTargets,
    contacted: metrics.contactedTargets,
    successful: metrics.successfulContacts,
    conversionRate: `${metrics.conversionRate}%`,
  });

  return metrics;
}
