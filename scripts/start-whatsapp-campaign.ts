import { storage } from "../server/storage";
import { addVoiceWhatsAppCollectionToQueue } from "../server/lib/queue";

/**
 * Script para iniciar disparos WhatsApp de campanha ativa
 * Enfileira apenas targets pending com contactMethod=whatsapp
 */
async function startWhatsAppCampaign() {
  const campaignId = '424364ec-2721-49e3-9edb-98ff68e42ca0';
  
  console.log(`🚀 [Start] Iniciando disparos WhatsApp da campanha ${campaignId}...\n`);
  
  try {
    // Verificar se campanha está ativa
    const campaign = await storage.getVoiceCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campanha não encontrada');
    }
    
    if (campaign.status !== 'active') {
      throw new Error(`Campanha não está ativa (status: ${campaign.status})`);
    }
    
    console.log(`✅ [Start] Campanha "${campaign.name}" está ativa\n`);
    
    // Buscar targets pending com contactMethod=whatsapp e attemptCount=0
    const targets = await storage.getVoiceCampaignTargets(campaignId);
    
    const pendingWhatsAppTargets = targets.filter(t => 
      t.contactMethod === 'whatsapp' &&
      (t.state === 'pending' || t.state === 'scheduled') &&
      (t.attemptCount ?? 0) === 0
    );
    
    console.log(`📊 [Start] Total targets: ${targets.length}`);
    console.log(`📱 [Start] Targets WhatsApp pendentes: ${pendingWhatsAppTargets.length}\n`);
    
    if (pendingWhatsAppTargets.length === 0) {
      console.log('⚠️  [Start] Nenhum target WhatsApp pendente encontrado');
      return;
    }
    
    let enqueued = 0;
    let errors = 0;
    
    // Enfileirar com intervalo de 40 segundos entre cada
    for (let i = 0; i < pendingWhatsAppTargets.length; i++) {
      const target = pendingWhatsAppTargets[i];
      
      try {
        // Calcular delay: primeiro imediato, depois espaçados
        const delayMs = i * 40000; // 40 segundos entre cada
        
        await addVoiceWhatsAppCollectionToQueue({
          targetId: target.id,
          campaignId,
          phoneNumber: target.phoneNumber,
          clientName: target.debtorName,
          clientDocument: target.debtorDocument || 'N/A',
          debtAmount: target.debtAmount || 0,
          attemptNumber: 1,
        }, delayMs);
        
        enqueued++;
        
        if (enqueued % 100 === 0) {
          console.log(`📤 [Start] Enfileirados: ${enqueued}/${pendingWhatsAppTargets.length}`);
        }
      } catch (error: any) {
        console.error(`❌ [Start] Erro ao enfileirar ${target.id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n🎉 [Start] Enfileiramento concluído!`);
    console.log(`   ✅ Enfileirados: ${enqueued}`);
    console.log(`   ❌ Erros: ${errors}`);
    console.log(`\n💬 [Start] Worker WhatsApp processará 1 disparo a cada 40 segundos`);
    console.log(`⏱️  [Start] Tempo estimado: ${Math.ceil((enqueued * 40) / 60)} minutos\n`);
    
  } catch (error) {
    console.error('❌ [Start] Erro fatal:', error);
    throw error;
  }
}

// Executar
startWhatsAppCampaign()
  .then(() => {
    console.log('✅ Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
