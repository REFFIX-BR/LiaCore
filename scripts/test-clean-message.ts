/**
 * Envia uma mensagem limpa simulando início de conversa de cobrança
 */

const webhookUrl = 'http://localhost:5000/api/webhooks/evolution';

const testPayload = {
  event: 'messages.upsert',
  instance: 'whatsapp_principal',
  data: {
    key: {
      remoteJid: '5522997074180@s.whatsapp.net',
      fromMe: false,
      id: `TEST_${Date.now()}`
    },
    message: {
      conversation: 'Oi, preciso do meu boleto'
    },
    messageType: 'conversation',
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Cliente Teste',
    participant: '5522997074180@s.whatsapp.net'
  }
};

async function sendWebhook() {
  console.log('📤 Enviando mensagem inicial: "Oi, preciso do meu boleto"\n');
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
  });
  
  const result = await response.json();
  
  console.log(`✅ Webhook aceito: ${response.status}`);
  console.log(`📊 Resposta:`, JSON.stringify(result, null, 2));
  console.log('\n⏳ Aguarde ~15 segundos para processamento da IA...');
}

sendWebhook().catch(console.error);
