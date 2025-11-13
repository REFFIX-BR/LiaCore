/**
 * Testar mensagem de texto simples (não template)
 */

const CONFIG = {
  apiUrl: 'https://evolutionapi.trtelecom.net',
  instance: 'Principal',
  apiKey: process.env.EVOLUTION_API_KEY_PRINCIPAL || process.env.EVOLUTION_API_KEY || '',
};

async function testSimpleMessage() {
  console.log('📱 TESTE - Mensagem de Texto Simples\n');
  console.log('='.repeat(70));
  
  const phoneNumber = '5522997074180';
  const message = 'Olá! Esta é uma mensagem de TESTE do sistema LIA CORTEX. Se você recebeu esta mensagem, a conectividade está OK.';
  
  console.log(`\n📋 Enviando para: ${phoneNumber}`);
  console.log(`📝 Mensagem: ${message}`);
  console.log(`🔌 Instância: ${CONFIG.instance}\n`);
  
  try {
    const url = `${CONFIG.apiUrl}/message/sendText/${CONFIG.instance}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.apiKey,
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: message,
        delay: 1200,
      }),
    });
    
    const responseText = await response.text();
    
    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ MENSAGEM ENVIADA COM SUCESSO!');
        console.log(`\nDetalhes:`);
        console.log(JSON.stringify(data, null, 2));
        console.log(`\n🎉 Verifique seu WhatsApp: ${phoneNumber}`);
        console.log(`   Esta é uma mensagem de TEXTO (não template)`);
        console.log(`   Deve chegar IMEDIATAMENTE se a conectividade estiver OK`);
      } catch {
        console.log('✅ Sucesso (resposta não é JSON)');
        console.log(responseText);
      }
    } else {
      console.log('❌ ERRO AO ENVIAR:');
      console.log(responseText);
    }
    
  } catch (error) {
    console.log('❌ ERRO:', (error as Error).message);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n💡 IMPORTANTE:');
  console.log('   - Mensagens de texto simples NÃO precisam de template aprovado');
  console.log('   - Mas só funcionam se houver uma "janela de 24h" ativa');
  console.log('   - (Janela = cliente enviou mensagem para você nas últimas 24h)');
  console.log('\n   Se você NÃO receber esta mensagem:');
  console.log('   → Pode ser que não haja janela de 24h ativa');
  console.log('   → Templates Meta são obrigatórios neste caso');
  console.log('='.repeat(70));
}

testSimpleMessage().catch(error => {
  console.error('ERRO:', error);
  process.exit(1);
});
