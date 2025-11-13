/**
 * Envio de teste direto para número do usuário
 */

let EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'evolutionapi.trtelecom.net';
if (!EVOLUTION_API_URL.startsWith('http')) {
  EVOLUTION_API_URL = `https://${EVOLUTION_API_URL}`;
}

const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const USER_PHONE = '5522997074180';
const USER_NAME = 'TESTE';

async function sendTest() {
  console.log('📱 TESTE DE ENVIO WHATSAPP');
  console.log(`📞 Para: ${USER_PHONE}`);
  console.log(`📋 Template: financeiro_em_atraso\n`);

  if (!EVOLUTION_API_KEY) {
    console.error('❌ EVOLUTION_API_KEY não configurada!');
    process.exit(1);
  }

  try {
    const url = `${EVOLUTION_API_URL}/message/sendTemplate/Cobranca`;
    
    const payload = {
      number: USER_PHONE,
      name: 'financeiro_em_atraso',
      language: 'en',
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'text',
              text: USER_NAME,
              parameter_name: 'texto'
            }
          ]
        }
      ]
    };

    console.log('📤 Enviando...\n');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    console.log('✅ Resposta Evolution API:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    // Analisar
    if (result.message?.conversation?.includes('▶️')) {
      console.log('⚠️  PROBLEMA: Template não expandiu');
      console.log(`   Retornou: "${result.message.conversation}"`);
      console.log('   → Verificar status do template no Meta Business Manager\n');
    }

    console.log('📱 Verifique seu WhatsApp nos próximos 2-3 minutos:');
    console.log('   ✅ Recebeu = Sistema funcionando!');
    console.log('   ❌ Não recebeu = Problema no template/Meta');

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

sendTest();
