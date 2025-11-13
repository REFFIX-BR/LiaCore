/**
 * Teste de envio via FILA (mesmo caminho das campanhas)
 */

import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

async function testQueueSend() {
  console.log('📋 TESTE DE ENVIO VIA FILA\n');
  
  try {
    const job = await addVoiceWhatsAppCollectionToQueue({
      targetId: 99999, // ID fake para teste
      campaignId: 1,
      phoneNumber: '5522997074180', // Seu número
      clientName: 'TESTE VIA FILA',
      clientDocument: null,
      debtAmount: '100.00',
      attemptNumber: 1,
    }, 0); // Envia imediatamente
    
    console.log('✅ Job adicionado à fila:');
    console.log(`   Job ID: ${job.id}`);
    console.log(`   Nome: ${job.name}`);
    console.log('');
    console.log('📱 Aguarde 10-20 segundos e verifique:');
    console.log('   1. Seu WhatsApp (22 99707-4180)');
    console.log('   2. Se recebeu = CORRIGIDO! ✅');
    console.log('   3. Se não recebeu = ainda tem problema ❌');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testQueueSend();
