import { storage } from '../server/storage';

(async () => {
  const campaigns = await storage.getAllVoiceCampaigns();
  const campaign = campaigns.find(c => c.status === 'active');
  
  if (!campaign) {
    console.log('❌ Nenhuma campanha ativa');
    process.exit(1);
  }
  
  const targets = await storage.getVoiceCampaignTargets(campaign.id);
  console.log(`📊 Total targets: ${targets.length}`);
  
  const enabledTargets = targets.filter(t => t.enabled === true);
  console.log(`✅ Enabled targets: ${enabledTargets.length}`);
  
  const pendingEnabled = targets.filter(t => 
    (t.state === 'pending' || t.state === 'scheduled') && 
    (t.attemptCount ?? 0) === 0 &&
    t.enabled === true
  );
  console.log(`🎯 Pending + enabled + attempt=0: ${pendingEnabled.length}`);
  
  if (pendingEnabled.length > 0) {
    console.log('\n📋 Targets que DEVERIAM ser enfileirados:');
    pendingEnabled.forEach(t => {
      console.log(`  - ${t.debtorName} (state: ${t.state}, attempts: ${t.attemptCount ?? 0}, enabled: ${t.enabled})`);
    });
  }
  
  process.exit(0);
})();
