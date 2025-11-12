import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';
import { storage } from '../server/storage';

async function enqueuePendingTargets() {
  try {
    console.log('🎯 Enfileirando targets pending habilitados...');
    
    const campaignId = '2025b997-22ea-4e72-987b-9896bd923fc9';
    
    // Buscar targets pending e habilitados
    const targets = await storage.db
      .select()
      .from(storage.schema.voiceCampaignTargets)
      .where(storage.schema.sql`
        campaign_id = ${campaignId} 
        AND enabled = true 
        AND state = 'pending'
      `)
      .limit(5);
    
    console.log(`📋 Encontrados ${targets.length} targets para enfileirar`);
    
    let enqueuedCount = 0;
    for (const target of targets) {
      try {
        await addVoiceWhatsAppCollectionToQueue({
          targetId: target.id,
          campaignId: target.campaignId,
          phoneNumber: target.phoneNumber,
          clientName: target.debtorName,
          clientDocument: target.debtorDocument || 'N/A',
          debtAmount: target.debtAmount || 0,
          attemptNumber: 1,
        }, 0); // No delay
        
        enqueuedCount++;
        console.log(`✅ ${enqueuedCount}/${targets.length} - ${target.debtorName} (${target.phoneNumber})`);
      } catch (err) {
        console.error(`❌ Erro ao enfileirar target ${target.id}:`, err);
      }
    }
    
    console.log(`\n🎉 Total enfileirado: ${enqueuedCount}/${targets.length}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

enqueuePendingTargets();
