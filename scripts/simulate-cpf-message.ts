import axios from 'axios';

async function simulateCPFMessage() {
  console.log('\n📤 Simulando recebimento de mensagem com CPF...\n');
  
  const payload = {
    event: 'messages.upsert',
    instance: 'Cobranca',
    data: {
      key: {
        remoteJid: '5522997074180@s.whatsapp.net',
        fromMe: false,
        id: `SIMULATE-CPF-${Date.now()}`
      },
      pushName: 'Marcio',
      message: {
        conversation: '08422123703'
      },
      messageType: 'conversation',
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  };
  
  try {
    console.log('📋 Enviando webhook para /api/webhooks/evolution...');
    const response = await axios.post('http://localhost:5000/api/webhooks/evolution', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Webhook aceito: ${response.status}`);
    console.log(`📊 Resposta: ${JSON.stringify(response.data, null, 2)}`);
    console.log('\n⏳ Aguarde alguns segundos e verifique o WhatsApp...\n');
  } catch (error: any) {
    console.error('❌ Erro ao enviar webhook:', error.message);
    if (error.response) {
      console.error('📊 Resposta:', error.response.data);
    }
  }
}

simulateCPFMessage().catch(console.error);
