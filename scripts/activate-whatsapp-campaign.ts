import { storage } from "../server/storage";
import { addVoiceWhatsAppCollectionToQueue } from "../server/lib/queue";

/**
 * Script para ativar campanha de WhatsApp manualmente
 * Enfileira todos os targets pending para disparo
 */
async function activateCampaign() {
  const campaignId = '424364ec-2721-49e3-9edb-98ff68e42ca0'; // Cobrança 05/11
  
  console.log(`🚀 [Activation] Iniciando ativação da campanha ${campaignId}...`);
  
  try {
    // Buscar todos os targets da campanha
    const targets = await storage.getVoiceCampaignTargets(campaignId);
    
    console.log(`📊 [Activation] Total targets encontrados: ${targets.length}`);
    
    // Filtrar apenas pending com attemptCount = 0
    const pendingTargets = targets.filter(t => 
      (t.state === 'pending' || t.state === 'scheduled') && 
      (t.attemptCount ?? 0) === 0 &&
      t.contactMethod === 'whatsapp'
    );
    
    console.log(`✅ [Activation] Targets WhatsApp para enfileirar: ${pendingTargets.length}`);
    
    let enqueued = 0;
    let skipped = 0;
    
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
        }, 0); // Sem delay - enviar imediatamente
        
        enqueued++;
        if (enqueued % 100 === 0) {
          console.log(`📤 [Activation] Enfileirados: ${enqueued}/${pendingTargets.length}`);
        }
      } catch (error: any) {
        console.error(`❌ [Activation] Erro ao enfileirar ${target.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`\n🎉 [Activation] Ativação concluída!`);
    console.log(`   ✅ Enfileirados: ${enqueued}`);
    console.log(`   ❌ Pulados: ${skipped}`);
    console.log(`\n💬 Disparos WhatsApp iniciando via instância "Cobranca"!`);
    
  } catch (error) {
    console.error('❌ [Activation] Erro fatal:', error);
    throw error;
  }
}

// Executar
activateCampaign()
  .then(() => {
    console.log('\n✅ Script concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
