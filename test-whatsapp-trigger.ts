import { addVoiceWhatsAppCollectionToQueue } from './server/lib/queue';

async function testWhatsAppCollection() {
  try {
    console.log('🚀 [Test] Enfileirando job de cobrança WhatsApp...');
    
    await addVoiceWhatsAppCollectionToQueue({
      targetId: '4edc0211-eb76-4533-bc04-fb896cfaddd9',
      campaignId: '849b5780-945b-4dc3-91e1-0b73f1f33f80',
      phoneNumber: '+5522997074180',
      clientName: 'Cliente Teste API',
      clientDocument: '12345678901',
      debtAmount: 15000, // R$ 150,00
      attemptNumber: 1,
    }, 0); // Sem delay
    
    console.log('✅ [Test] Job enfileirado com sucesso!');
    console.log('📱 [Test] Verifique o WhatsApp +5522997074180 em alguns segundos...');
    
    // Aguardar 2 segundos antes de finalizar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ [Test] Erro ao enfileirar job:', error.message);
    process.exit(1);
  }
}

testWhatsAppCollection();
