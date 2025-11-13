import { sendWhatsAppTemplate } from '../server/lib/whatsapp';

async function test() {
  console.log('🧪 TESTE DIRETO DA FUNÇÃO send WhatsAppTemplate\n');
  
  const result = await sendWhatsAppTemplate(
    '5522997074180',
    {
      templateName: 'financeiro_em_atraso',
      languageCode: 'en',
      headerParameters: [{ 
        value: 'TESTE',
        parameterName: 'texto'
      }],
    },
    'Cobranca'
  );
  
  console.log('\n✅ Resultado:');
  console.log(JSON.stringify(result, null, 2));
  console.log('');
  console.log('📱 Verifique seu WhatsApp agora!');
  
  process.exit(0);
}
test();
