import { addVoiceWhatsAppCollectionToQueue } from "../server/lib/queue";

/**
 * Script de teste - enfileirar 1 mensagem WhatsApp
 */
async function testWhatsAppSend() {
  console.log('📤 [Test] Enfileirando job WhatsApp de teste...\n');
  
  try {
    await addVoiceWhatsAppCollectionToQueue({
      targetId: 'd03694c6-f29f-4926-9fa0-d5494157acf7',
      campaignId: '424364ec-2721-49e3-9edb-98ff68e42ca0',
      phoneNumber: '24993053749',
      clientName: 'NIVALDO CORREA BASTOS',
      clientDocument: '04179526786',
      debtAmount: 100.00,
      attemptNumber: 1,
    }, 0); // delay 0 = processamento imediato
    
    console.log('✅ [Test] Job enfileirado com sucesso!');
    console.log('⏱️  [Test] Aguarde ~10 segundos e verifique os logs...\n');
  } catch (error: any) {
    console.error('❌ [Test] Erro:', error.message);
    throw error;
  }
}

testWhatsAppSend()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal:', error);
    process.exit(1);
  });
