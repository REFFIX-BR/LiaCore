import { db } from '../server/db';
import { voiceCampaignTargets } from '../shared/schema';
import { eq } from 'drizzle-orm';

console.log('\n🔄 Resetando target de cobrança...\n');

async function resetTarget() {
  // Buscar o target do Marcio
  const targets = await db
    .select()
    .from(voiceCampaignTargets)
    .where(eq(voiceCampaignTargets.phoneNumber, '+5522997074180'))
    .limit(1);

  if (!targets || targets.length === 0) {
    console.log('❌ Target não encontrado para +5522997074180');
    process.exit(1);
  }

  const target = targets[0];
  console.log(`📋 Target encontrado: ${target.debtorName}`);
  console.log(`   Estado atual: ${target.state}`);
  console.log(`   Tentativas: ${target.attemptCount}`);

  // Resetar completamente
  await db
    .update(voiceCampaignTargets)
    .set({
      state: 'pending',
      attemptCount: 0,
      lastAttemptAt: null,
      outcome: null,
      outcomeDetails: null,
    })
    .where(eq(voiceCampaignTargets.id, target.id));

  console.log('\n✅ Target resetado com sucesso!');
  console.log('   Estado: pending');
  console.log('   Tentativas: 0\n');

  // Enfileirar
  console.log('📤 Enfileirando para envio...');
  
  // Importar função de enfileiramento dinamicamente
  const { addVoiceWhatsAppCollectionToQueue } = await import('../server/modules/voice/queue.js');
  
  await addVoiceWhatsAppCollectionToQueue({
    targetId: target.id,
    campaignId: target.campaignId,
    phoneNumber: target.phoneNumber,
    clientName: target.debtorName,
    clientDocument: target.debtorDocument || undefined,
    debtAmount: target.debtAmount,
    attemptNumber: 1,
  });

  console.log('✅ Target enfileirado! Aguarde o envio...\n');
  process.exit(0);
}

resetTarget().catch(console.error);
