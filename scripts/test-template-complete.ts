import axios from 'axios';

const EVOLUTION_URL = 'https://evolutionapi.trtelecom.net';
const API_KEY = process.env.EVOLUTION_API_KEY_COBRANCA;
const INSTANCE = 'Cobranca';

async function testTemplate() {
  console.log('🔄 Testando envio de template com variável no header...\n');

  const payload = {
    number: '5522997074180',
    name: 'financeiro_em_atraso',
    language: 'en',
    components: [
      {
        type: 'header',
        parameters: [
          {
            type: 'text',
            parameter_name: 'texto',
            text: 'Marcio Tr'
          }
        ]
      }
    ]
  };

  console.log('📤 Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const response = await axios.post(
      `${EVOLUTION_URL}/message/sendTemplate/${INSTANCE}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        }
      }
    );

    console.log('✅ SUCESSO!');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('❌ ERRO:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
  }
}

testTemplate();
