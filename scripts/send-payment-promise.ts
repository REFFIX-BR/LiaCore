const webhookUrl = 'http://localhost:5000/api/webhooks/evolution';

const payload = {
  event: 'messages.upsert',
  instance: 'whatsapp_principal',
  data: {
    key: {
      remoteJid: '5522997074180@s.whatsapp.net',
      fromMe: false,
      id: `PROMISE_${Date.now()}`
    },
    message: {
      conversation: 'Consigo pagar dia 15 desse mês via PIX, pode ser?'
    },
    messageType: 'conversation',
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Cliente Teste',
    participant: '5522997074180@s.whatsapp.net'
  }
};

async function send() {
  console.log('📤 Enviando negociação: "Consigo pagar dia 15 desse mês via PIX, pode ser?"\n');
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  console.log(`✅ Status: ${response.status}`);
  console.log(`📊 Resposta:`, JSON.stringify(result, null, 2));
  console.log('\n⏳ Aguardando processamento da IA e registro da promessa...');
}

send().catch(console.error);
