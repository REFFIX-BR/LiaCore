import { storage } from '../server/storage';
import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

/**
 * Script para enfileirar manualmente um target para teste
 * Uso: tsx scripts/enqueue-test-target.ts <targetId>
 */

async function enqueueTestTarget() {
  const targetId = process.argv[2];
  
  if (!targetId) {
    console.error('❌ Usage: tsx scripts/enqueue-test-target.ts <targetId>');
    process.exit(1);
  }
  
  console.log(`📤 Enfileirando target ${targetId}...`);
  
  // Buscar dados do target
  const target = await storage.getVoiceCampaignTarget(targetId);
  
  if (!target) {
    console.error(`❌ Target não encontrado: ${targetId}`);
    process.exit(1);
  }
  
  console.log(`✅ Target encontrado:`, {
    id: target.id,
    name: target.debtorName,
    phone: target.phoneNumber,
    state: target.state,
    campaignId: target.campaignId,
  });
  
  // Enfileirar para processamento
  await addVoiceWhatsAppCollectionToQueue({
    targetId: target.id,
    campaignId: target.campaignId,
    phoneNumber: target.phoneNumber,
    clientName: target.debtorName,
    clientDocument: target.debtorDocument || 'N/A',
    debtAmount: target.debtAmount || 0,
    attemptNumber: (target.attemptCount || 0) + 1,
  }, 0); // Sem delay - processar imediatamente
  
  console.log(`✅ Target enfileirado com sucesso!`);
  console.log(`⏳ Aguarde alguns segundos para o worker processar...`);
}

enqueueTestTarget().then(() => {
  console.log('✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
