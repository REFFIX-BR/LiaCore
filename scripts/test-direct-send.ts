/**
 * Teste de envio direto para número do usuário
 */

import axios from 'axios';

let EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'evolutionapi.trtelecom.net';

// Normalizar URL
if (!EVOLUTION_API_URL.startsWith('http')) {
  EVOLUTION_API_URL = `https://${EVOLUTION_API_URL}`;
}

const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const USER_PHONE = '5522997074180';
const USER_NAME = 'TESTE';

async function sendTestMessage() {
  console.log('📱 ====== TESTE DE ENVIO WHATSAPP ======\n');
  console.log(`📞 Número: ${USER_PHONE}`);
  console.log(`👤 Nome: ${USER_NAME}`);
  console.log(`📋 Template: financeiro_em_atraso\n`);

  if (!EVOLUTION_API_KEY) {
    console.error('❌ EVOLUTION_API_KEY não configurada!');
    process.exit(1);
  }

  try {
    const sendUrl = `${EVOLUTION_API_URL}/message/sendTemplate/Cobranca`;
    
    console.log(`📤 Enviando para: ${sendUrl}\n`);

    const payload = {
      number: USER_PHONE,
      options: { delay: 0, presence: 'composing' },
      template: {
        name: 'financeiro_em_atraso',
        language: 'en',
        components: [{
          type: 'HEADER',
          parameters: [{
            type: 'text',
            text: USER_NAME,
            parameter_name: 'texto'
          }]
        }]
      }
    };

    const response = await axios.post(sendUrl, payload, {
      headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
    });

    console.log('✅ Resposta do Evolution API:');
    console.log(JSON.stringify(response.data, null, 2));

    const messageContent = response.data.message?.conversation || '';
    if (messageContent.includes('▶️') && messageContent.includes('◀️')) {
      console.log('\n⚠️  PROBLEMA: Template não expandiu!');
      console.log(`   Retornou: "${messageContent}"`);
      console.log('   → Template pode estar bloqueado no Meta');
    } else {
      console.log('\n✅ Template expandiu corretamente!');
    }

    console.log('\n📱 Verifique seu WhatsApp nos próximos 2-3 minutos.');
    console.log('   Se recebeu → Sistema OK ✅');
    console.log('   Se não recebeu → Problema no Meta/Template ❌');

  } catch (error: any) {
    console.error('\n❌ Erro:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

sendTestMessage();
