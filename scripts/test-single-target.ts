import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

/**
 * Teste: enfileirar 1 target sem delay para ver se o worker processa
 */

async function testSingleTarget() {
  console.log('🧪 Enfileirando target de teste SEM delay...');
  
  await addVoiceWhatsAppCollectionToQueue({
    targetId: 'd1d9e715-f66f-4618-9240-7ad44a7318b8',  
    campaignId: 'ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2',
    phoneNumber: '5524999824813',
    clientName: 'JUDITE MOREIRA DE ASSUNÇÃO',
    clientDocument: '67905188787',
    debtAmount: 100,
    attemptNumber: 1,
  }, 0); // SEM DELAY - processa imediatamente
  
  console.log('✅ Target enfileirado! Verifique os logs em "Start application" nos próximos 10 segundos...');
  console.log('📋 Procure por: "💬 [Voice WhatsApp] ==== JOB RECEIVED ===="');
  
  process.exit(0);
}

testSingleTarget().catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
