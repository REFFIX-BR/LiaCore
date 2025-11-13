/**
 * Simular mensagem recebida do WhatsApp (webhook)
 */

const WEBHOOK_URL = 'http://localhost:5000/api/webhooks/evolution';

async function simulateIncomingMessage() {
  console.log('📨 SIMULANDO MENSAGEM RECEBIDA DO WHATSAPP\n');
  
  const payload = {
    event: 'messages.upsert',
    instance: 'Cobranca',
    data: {
      key: {
        remoteJid: '5522997074180@s.whatsapp.net',
        fromMe: false,
        id: 'TEST_MESSAGE_' + Date.now()
      },
      pushName: 'Lucas',
      message: {
        conversation: 'Oi, quero pagar minha conta'
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      messageType: 'conversation'
    }
  };
  
  console.log('📤 Enviando para:', WEBHOOK_URL);
  console.log('📦 Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    console.log('✅ Resposta do webhook:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    
    if (result.success) {
      console.log('✅ Webhook processado com sucesso!');
      console.log('   O sistema deve ter:');
      console.log('   1. Identificado a mensagem recebida');
      console.log('   2. Criado/reaberto a conversa');
      console.log('   3. Processado com IA Cobrança');
      console.log('   4. Enviado resposta automática');
    } else {
      console.log('❌ Webhook não foi processado');
      console.log('   Motivo:', result.reason || 'desconhecido');
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  }
  
  process.exit(0);
}

simulateIncomingMessage();
