import { storage } from '../storage';
import { addVoiceWhatsAppCollectionToQueue } from '../lib/queue';

async function triggerCampaign() {
  const campaignId = '0cc96323-da52-4d19-b505-8ed082c8d789';
  console.log(`🚀 [Manual] Continuing campaign ${campaignId}`);
  
  const targets = await storage.getVoiceCampaignTargets(campaignId);
  const pendingTargets = targets.filter(t => 
    (t.state === 'pending' || t.state === 'scheduled') && 
    (t.attemptCount ?? 0) === 0
  );
  
  console.log(`📊 Found ${pendingTargets.length} pending targets (remaining)`);
  
  if (pendingTargets.length === 0) {
    console.log('✅ All targets already enqueued!');
    process.exit(0);
  }
  
  let enqueued = 0;
  for (const target of pendingTargets) {
    try {
      await addVoiceWhatsAppCollectionToQueue({
        targetId: target.id,
        campaignId,
        phoneNumber: target.phoneNumber,
        clientName: target.debtorName,
        clientDocument: target.debtorDocument || 'N/A',
        debtAmount: target.debtAmount || 0,
        attemptNumber: 1,
      }, 0);
      enqueued++;
      if (enqueued % 100 === 0) {
        console.log(`✅ Progress: ${enqueued}/${pendingTargets.length}`);
      }
    } catch (error: any) {
      if (error.message?.includes('Job with id target-')) {
        // Job already exists - this is expected due to idempotency
        continue;
      }
      console.error(`❌ Failed: ${error.message}`);
    }
  }
  
  console.log(`🎉 Done: ${enqueued} new targets enqueued`);
  process.exit(0);
}

triggerCampaign();
