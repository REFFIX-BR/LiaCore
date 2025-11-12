import { storage } from '../server/storage';
import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

async function requeuePendingTargets() {
  console.log('🔄 [Requeue] Buscando campanhas ativas...');
  
  const activeCampaigns = await storage.getVoiceCampaignsByStatus('active');
  
  console.log(`📊 [Requeue] Encontradas ${activeCampaigns.length} campanha(s) ativa(s)`);
  
  for (const campaign of activeCampaigns) {
    console.log(`\n🎯 [Requeue] Processando campanha: ${campaign.name} (${campaign.id})`);
    
    const targets = await storage.getVoiceCampaignTargets(campaign.id);
    
    // Filtrar apenas targets que ainda não foram contatados
    const pendingTargets = targets.filter(t => 
      (t.state === 'pending' || t.state === 'scheduled') && (t.attemptCount ?? 0) === 0
    );
    
    console.log(`   📋 Total de alvos: ${targets.length}`);
    console.log(`   ⏳ Alvos pendentes para reprocessar: ${pendingTargets.length}`);
    
    let requeued = 0;
    for (const target of pendingTargets) {
      try {
        await addVoiceWhatsAppCollectionToQueue({
          targetId: target.id,
          campaignId: campaign.id,
          phoneNumber: target.phoneNumber,
          clientName: target.debtorName,
          clientDocument: target.debtorDocument || 'N/A',
          debtAmount: target.debtAmount || 0,
          attemptNumber: 1,
        }, 0);
        
        requeued++;
        
        if (requeued <= 5) {
          console.log(`   ✅ Reenfileirado: ${target.debtorName} (${target.phoneNumber})`);
        }
      } catch (error: any) {
        console.error(`   ❌ Erro ao reenfileirar ${target.id}:`, error.message);
      }
    }
    
    console.log(`   🎉 ${requeued} alvos reenfileirados com sucesso!`);
  }
  
  console.log('\n✅ [Requeue] Processo concluído!');
  process.exit(0);
}

requeuePendingTargets().catch((error) => {
  console.error('❌ [Requeue] Erro fatal:', error);
  process.exit(1);
});
