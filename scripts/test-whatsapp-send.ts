import { sendWhatsAppTemplate } from '../server/lib/whatsapp';

async function testWhatsAppSend() {
  const phoneNumber = '5522997074180'; // Número do usuário
  const firstName = 'TESTE'; // Nome para o template
  
  console.log('📋 Enviando mensagem de teste via WhatsApp...');
  console.log(`📱 Número: ${phoneNumber}`);
  console.log(`👤 Nome: ${firstName}`);
  console.log(`📨 Template: financeiro_em_atraso`);
  console.log(`📡 Instância: Cobranca\n`);
  
  try {
    const result = await sendWhatsAppTemplate(
      phoneNumber,
      {
        templateName: 'financeiro_em_atraso',
        headerParameters: [{ value: firstName, parameterName: 'texto' }],
      },
      'Cobranca'
    );
    
    console.log('✅ Mensagem enviada com sucesso!');
    console.log('📊 Resposta da API:', JSON.stringify(result, null, 2));
    console.log('\n🎉 Teste concluído! Verifique seu WhatsApp.');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erro ao enviar mensagem:', error.message);
    console.error('📋 Detalhes:', error);
    process.exit(1);
  }
}

testWhatsAppSend();
