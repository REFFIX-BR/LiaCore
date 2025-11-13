import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

async function send() {
  try {
    await addVoiceWhatsAppCollectionToQueue({
      targetId: 'b0d5f46f-5593-4fda-9576-2a513c1afb14',
      campaignId: 'ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2',
      phoneNumber: '5522997074180',
      clientName: 'TESTE',
      clientDocument: null,
      debtAmount: '0',
      attemptNumber: 1,
    }, 0);
    
    console.log('✅ JOB ENVIADO');
    console.log('📱 Aguarde 15-20 segundos e verifique seu WhatsApp');
  } catch (e: any) {
    console.error('❌', e.message);
  }
  process.exit(0);
}
send();
