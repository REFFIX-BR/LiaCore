import { storage } from '../server/storage';
import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

const CAMPAIGN_ID = '424364ec-2721-49e3-9edb-98ff68e42ca0';

async function activateCampaign() {
  console.log(`🚀 [Force Activation] Activating campaign ${CAMPAIGN_ID}`);
  
  const targets = await storage.getVoiceCampaignTargets(CAMPAIGN_ID);
  
  console.log(`📊 [Force Activation] Total targets: ${targets.length}`);
  
  const pendingTargets = targets.filter(t => 
    (t.state === 'pending' || t.state === 'scheduled') && (t.attemptCount ?? 0) === 0
  );
  
  console.log(`🎯 [Force Activation] Pending targets: ${pendingTargets.length}`);
  
  for (const target of pendingTargets) {
    if (target.contactMethod === 'whatsapp') {
      console.log(`📱 [Force Activation] Enqueuing WhatsApp target: ${target.debtorName}`);
      
      await addVoiceWhatsAppCollectionToQueue({
        targetId: target.id,
        campaignId: CAMPAIGN_ID,
        phoneNumber: target.phoneNumber,
        clientName: target.debtorName,
        clientDocument: target.debtorDocument || 'N/A',
        debtAmount: target.debtAmount || 0,
        attemptNumber: 1,
      }, 0); // No delay - send immediately
      
      console.log(`✅ [Force Activation] Enqueued: ${target.debtorName} (${target.phoneNumber})`);
    }
  }
  
  // Reativar campanha
  await storage.updateVoiceCampaign(CAMPAIGN_ID, { status: 'active' });
  console.log('✅ [Force Activation] Campaign reactivated');
  
  process.exit(0);
}

activateCampaign().catch(error => {
  console.error('❌ [Force Activation] Error:', error);
  process.exit(1);
});
