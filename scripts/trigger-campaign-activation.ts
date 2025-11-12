// Script simples para triggerar a ativação manual de uma campanha
import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';
import { db } from '../server/db';
import { voiceCampaignTargets } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

async function activateCampaign() {
  try {
    const campaignId = '2025b997-22ea-4e72-987b-9896bd923fc9';
    
    console.log(`🚀 [Activation] Ativando campanha ${campaignId}`);
    
    // Buscar targets pending/scheduled, attemptCount=0, enabled=true
    const targets = await db
      .select()
      .from(voiceCampaignTargets)
      .where(and(
        eq(voiceCampaignTargets.campaignId, campaignId),
        eq(voiceCampaignTargets.enabled, true)
      ));
    
    const pendingTargets = targets.filter(t => 
      (t.state === 'pending' || t.state === 'scheduled') && 
      (t.attemptCount ?? 0) === 0
    );
    
    console.log(`📊 Found ${pendingTargets.length} targets to enqueue (${targets.length} total)`);
    
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
        console.log(`✅ ${enqueued}/${pendingTargets.length} - ${target.debtorName}`);
      } catch (error) {
        console.error(`❌ Failed to enqueue ${target.id}:`, error);
      }
    }
    
    console.log(`\n🎉 Campaign activated: ${enqueued} enqueued`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

activateCampaign();
