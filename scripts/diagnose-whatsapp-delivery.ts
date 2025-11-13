/**
 * Diagnóstico completo de entrega de mensagens WhatsApp
 * Verifica se mensagens estão realmente chegando nos telefones dos clientes
 */

import axios from 'axios';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolutionapi.trtelecom.net';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

async function diagnoseDelivery() {
  console.log('🔍 ====== DIAGNÓSTICO DE ENTREGA WHATSAPP ======\n');

  if (!EVOLUTION_API_KEY) {
    console.error('❌ EVOLUTION_API_KEY não configurada!');
    process.exit(1);
  }

  try {
    // 1. Verificar status da conta WhatsApp Business
    console.log('1️⃣  Verificando status da conta WhatsApp Business...');
    const instanceUrl = `${EVOLUTION_API_URL}/instance/connectionState/Cobranca`;
    const instanceResponse = await axios.get(instanceUrl, {
      headers: { 'apikey': EVOLUTION_API_KEY },
    });

    console.log('✅ Status da conexão:', instanceResponse.data);
    
    // 2. Verificar templates disponíveis
    console.log('\n2️⃣  Verificando templates Meta aprovados...');
    try {
      const templatesUrl = `${EVOLUTION_API_URL}/template/find/Cobranca`;
      const templatesResponse = await axios.get(templatesUrl, {
        headers: { 'apikey': EVOLUTION_API_KEY },
      });

      console.log('\n📋 Templates encontrados:');
      const templates = Array.isArray(templatesResponse.data) 
        ? templatesResponse.data 
        : [templatesResponse.data];
      
      templates.forEach((template: any) => {
        console.log(`\n  Template: ${template.name || 'N/A'}`);
        console.log(`    Language: ${template.language || 'N/A'}`);
        console.log(`    Status: ${template.status || 'N/A'}`);
        console.log(`    Category: ${template.category || 'N/A'}`);
        
        if (template.name === 'financeiro_em_atraso') {
          console.log('\n  ⭐ Template "financeiro_em_atraso" encontrado:');
          console.log(`    Status: ${template.status}`);
          console.log(`    Rejeitado?: ${template.rejected_reason || 'Não'}`);
          
          if (template.components) {
            console.log('\n    Componentes:');
            template.components.forEach((comp: any, idx: number) => {
              console.log(`      ${idx + 1}. ${comp.type}: ${comp.text || JSON.stringify(comp)}`);
            });
          }
        }
      });
    } catch (error: any) {
      console.warn('⚠️  Não foi possível buscar templates:', error.message);
      console.log('   Isso pode significar que a rota /template/find não está disponível');
    }

    // 3. Testar envio real para número de teste
    console.log('\n3️⃣  ATENÇÃO: Para testar entrega real, vou precisar de um número de teste');
    console.log('   ⚠️  ATENÇÃO: Isso enviará uma mensagem REAL para o WhatsApp!');
    console.log('\n   Você pode adicionar um número de teste aqui se quiser continuar.');
    console.log('   Caso contrário, comente esta parte do código.');
    
    // DESCOMENTE E ADICIONE UM NÚMERO DE TESTE PARA ENVIAR MENSAGEM REAL
    // const testPhoneNumber = '5524999999999'; // ADICIONE SEU NÚMERO AQUI
    // console.log(`\n   Enviando mensagem de teste para ${testPhoneNumber}...`);
    // const sendUrl = `${EVOLUTION_API_URL}/message/sendTemplate/Cobranca`;
    // const sendResponse = await axios.post(sendUrl, {
    //   number: testPhoneNumber,
    //   options: {
    //     delay: 0,
    //     presence: 'composing'
    //   },
    //   template: {
    //     name: 'financeiro_em_atraso',
    //     language: 'en',
    //     components: [
    //       {
    //         type: 'HEADER',
    //         parameters: [
    //           {
    //             type: 'text',
    //             text: 'TESTE'
    //           }
    //         ]
    //       }
    //     ]
    //   }
    // }, {
    //   headers: { 'apikey': EVOLUTION_API_KEY },
    // });
    // console.log('\n✅ Resposta do envio de teste:', JSON.stringify(sendResponse.data, null, 2));

    // 4. Verificar restrições da conta
    console.log('\n4️⃣  Verificando possíveis restrições...');
    console.log('\n📋 Possíveis causas de mensagens não entregues:');
    console.log('   1. ❌ Número WhatsApp Business com restrição (Meta)');
    console.log('   2. ❌ Template bloqueado ou não aprovado');
    console.log('   3. ❌ Números de telefone inválidos ou bloqueados');
    console.log('   4. ❌ Rate limiting do WhatsApp atingido');
    console.log('   5. ❌ Conta sem permissão para enviar mensagens iniciadas por negócio');

    console.log('\n✅ Próximos passos recomendados:');
    console.log('   1. Acesse o Meta Business Manager e verifique:');
    console.log('      - Se o número do WhatsApp Business tem restrições');
    console.log('      - Se há algum aviso de qualidade (Quality Rating)');
    console.log('      - Se o template "financeiro_em_atraso" está APROVADO');
    console.log('   2. Teste manualmente enviando uma mensagem via Evolution API Web');
    console.log('   3. Verifique se você pode enviar mensagens iniciadas por negócio');

  } catch (error: any) {
    console.error('\n❌ Erro durante diagnóstico:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

diagnoseDelivery();
