/**
 * Teste Template WhatsApp - SEM parâmetros
 */

const CONFIG = {
  apiUrl: process.env.EVOLUTION_API_URL || '',
  instance: 'Cobranca',
  apiKey: process.env.EVOLUTION_API_KEY_COBRANCA || '',
};

async function testTemplate() {
  console.log('🧪 TESTE - Template WhatsApp (SEM PARÂMETROS)\n');
  console.log('='.repeat(70));
  
  let baseUrl = CONFIG.apiUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  
  const url = `${baseUrl}/message/sendTemplate/${CONFIG.instance}`;
  const phoneNumber = '5522997074180';
  
  // Template SEM parâmetros
  const payload = {
    number: phoneNumber,
    name: 'financeiro_em_atraso',
    language: 'en'
    // SEM components - template não tem parâmetros
  };
  
  console.log('\n📋 CONFIGURAÇÃO:');
  console.log(`   URL: ${url}`);
  console.log(`   Número: ${phoneNumber}`);
  console.log(`   Template: financeiro_em_atraso`);
  console.log(`   Idioma: en`);
  console.log(`   Parâmetros: NENHUM (template sem variáveis)`);
  
  console.log('\n🚀 Enviando...\n');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.apiKey,
      },
      body: JSON.stringify(payload),
    });
    
    const responseText = await response.text();
    
    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);
    
    try {
      const responseJson = JSON.parse(responseText);
      
      if (response.ok) {
        console.log('✅ MENSAGEM ENVIADA COM SUCESSO!');
        console.log(`\n   Message ID: ${responseJson.key?.id || 'N/A'}`);
        console.log(`   Remote JID: ${responseJson.key?.remoteJid || 'N/A'}`);
        console.log(`\n🎉 Verifique seu WhatsApp: ${phoneNumber}`);
      } else {
        console.log('❌ ERRO AO ENVIAR:');
        console.log(JSON.stringify(responseJson, null, 2));
        
        if (responseJson.code === 132000) {
          console.log('\n💡 Problema com parâmetros do template');
        } else if (responseJson.code === 131047) {
          console.log('\n💡 Template não aprovado ou não existe');
        }
      }
      
    } catch {
      console.log('Resposta:', responseText);
    }
    
  } catch (error) {
    console.log('❌ ERRO:', (error as Error).message);
  }
  
  console.log('\n' + '='.repeat(70));
}

testTemplate().catch(error => {
  console.error('ERRO:', error);
  process.exit(1);
});
