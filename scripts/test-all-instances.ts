/**
 * Testar envio com TODAS as instâncias disponíveis
 */

const INSTANCES = {
  Principal: process.env.EVOLUTION_API_KEY_PRINCIPAL || process.env.EVOLUTION_API_KEY || '',
  Leads: process.env.EVOLUTION_API_KEY_LEADS || '',
  Cobranca: process.env.EVOLUTION_API_KEY_COBRANCA || '',
};

async function testAllInstances() {
  console.log('🧪 TESTANDO TODAS AS INSTÂNCIAS\n');
  console.log('='.repeat(70));
  
  const baseUrl = 'https://evolutionapi.trtelecom.net';
  const phoneNumber = '5522997074180';
  
  for (const [instanceName, apiKey] of Object.entries(INSTANCES)) {
    if (!apiKey) {
      console.log(`\n⏭️  Pulando ${instanceName} - sem API key configurada`);
      continue;
    }
    
    console.log(`\n🔄 Testando instância: ${instanceName}`);
    console.log('-'.repeat(70));
    
    try {
      // Verificar conexão
      const connUrl = `${baseUrl}/instance/connectionState/${instanceName}`;
      const connResponse = await fetch(connUrl, {
        headers: { 'apikey': apiKey }
      });
      
      if (connResponse.ok) {
        const connData = await connResponse.json();
        console.log(`   Status: ${connData.instance?.state || connData.state || 'unknown'}`);
        
        if (connData.instance?.state === 'open' || connData.state === 'open') {
          console.log(`   ✅ Instância conectada! Tentando enviar...`);
          
          // Tentar enviar
          const sendUrl = `${baseUrl}/message/sendTemplate/${instanceName}`;
          const payload = {
            number: phoneNumber,
            name: 'financeiro_em_atraso',
            language: 'en',
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: 'Teste' }]
              }
            ]
          };
          
          const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey
            },
            body: JSON.stringify(payload)
          });
          
          const sendText = await sendResponse.text();
          
          if (sendResponse.ok) {
            console.log(`   🎉 MENSAGEM ENVIADA COM SUCESSO via ${instanceName}!`);
            console.log(`   Verifique seu WhatsApp: ${phoneNumber}`);
            
            try {
              const sendData = JSON.parse(sendText);
              if (sendData.key?.id) {
                console.log(`   Message ID: ${sendData.key.id}`);
              }
            } catch {}
            
            break; // Parar após primeiro sucesso
          } else {
            console.log(`   ❌ Erro ao enviar: ${sendResponse.status}`);
            console.log(`   Resposta: ${sendText.substring(0, 200)}`);
          }
        } else {
          console.log(`   ⏭️  Instância não conectada (state: ${connData.instance?.state || connData.state})`);
        }
      } else {
        console.log(`   ❌ Erro ao verificar conexão: ${connResponse.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${(error as Error).message}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
}

testAllInstances().catch(error => {
  console.error('ERRO:', error);
  process.exit(1);
});
