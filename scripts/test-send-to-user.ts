import { sendWhatsAppTemplate } from '../server/lib/whatsapp';

async function testSendToUser() {
  try {
    const phoneNumber = '5522997074180';
    const firstName = 'Teste'; // Nome que aparecerá na mensagem
    
    console.log('📱 TESTE DE ENVIO WHATSAPP - COBRANÇA');
    console.log('='.repeat(50));
    console.log(`Telefone: ${phoneNumber}`);
    console.log(`Primeiro nome: ${firstName}`);
    console.log(`Template: financeiro_em_atraso`);
    console.log(`Instância: Cobranca`);
    console.log(`Idioma: en (inglês - aprovado Meta)`);
    console.log('='.repeat(50));
    console.log('\n🚀 Enviando template via Evolution API...\n');
    
    const result = await sendWhatsAppTemplate(
      phoneNumber,
      {
        templateName: 'financeiro_em_atraso',
        languageCode: 'en',
        parameters: [firstName],
      },
      'Cobranca'
    );
    
    console.log('\n📊 RESULTADO DO ENVIO:');
    console.log('='.repeat(50));
    console.log(`✅ Success: ${result.success}`);
    
    if (result.success) {
      console.log(`📝 Message: ${result.message || 'Mensagem enviada com sucesso!'}`);
      console.log(`\n🎉 MENSAGEM ENVIADA COM SUCESSO!`);
      console.log(`   Verifique seu WhatsApp: ${phoneNumber}`);
      console.log(`   Você deve receber a mensagem em alguns segundos.`);
    } else {
      console.log(`\n❌ ERRO AO ENVIAR:`);
      console.log(`   Error Message: ${result.errorMessage}`);
      console.log(`   HTTP Status: ${result.errorStatus || 'N/A'}`);
      console.log(`   Is Permanent Failure: ${result.isPermanentFailure}`);
      
      if (result.errorStatus === 403) {
        console.log(`\n⚠️  ERRO 403: Possíveis causas:`);
        console.log(`   - Template não aprovado pela Meta`);
        console.log(`   - Instância Evolution API sem permissão`);
        console.log(`   - API key incorreta`);
      }
    }
    
    console.log('='.repeat(50));
    console.log('\n✅ Teste concluído');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error);
    console.error('\nStack trace:', (error as Error).stack);
    process.exit(1);
  }
}

console.log('🚀 Iniciando teste de envio WhatsApp...\n');
testSendToUser();
