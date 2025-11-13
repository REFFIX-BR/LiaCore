/**
 * Verificar Status Detalhado da Instância
 */

const CONFIG = {
  apiUrl: process.env.EVOLUTION_API_URL || '',
  instance: 'Cobranca',
  apiKey: process.env.EVOLUTION_API_KEY_COBRANCA || '',
};

async function checkInstanceStatus() {
  console.log('🔍 VERIFICAÇÃO DETALHADA DA INSTÂNCIA\n');
  console.log('='.repeat(70));
  
  let baseUrl = CONFIG.apiUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  
  // 1. Verificar conexão da instância
  console.log('\n1️⃣ STATUS DA CONEXÃO:');
  console.log('-'.repeat(70));
  
  try {
    const connectionUrl = `${baseUrl}/instance/connectionState/${CONFIG.instance}`;
    const connResponse = await fetch(connectionUrl, {
      headers: { 'apikey': CONFIG.apiKey }
    });
    
    if (connResponse.ok) {
      const connData = await connResponse.json();
      console.log(JSON.stringify(connData, null, 2));
      
      if (connData.state !== 'open') {
        console.log('\n❌ PROBLEMA: Instância não está conectada!');
        console.log(`   Estado atual: ${connData.state}`);
        console.log(`   Precisa estar: "open"`);
        console.log('\n💡 SOLUÇÃO: Reconectar a instância via QR Code');
      } else {
        console.log('\n✅ Instância conectada corretamente');
      }
    } else {
      console.log(`❌ Erro ao verificar: HTTP ${connResponse.status}`);
      const errorText = await connResponse.text();
      console.log(errorText);
    }
  } catch (error) {
    console.log(`❌ Erro: ${(error as Error).message}`);
  }
  
  // 2. Listar todas as instâncias
  console.log('\n2️⃣ TODAS AS INSTÂNCIAS DISPONÍVEIS:');
  console.log('-'.repeat(70));
  
  try {
    const listUrl = `${baseUrl}/instance/fetchInstances`;
    const listResponse = await fetch(listUrl, {
      headers: { 'apikey': CONFIG.apiKey }
    });
    
    if (listResponse.ok) {
      const instances = await listResponse.json();
      
      if (instances && instances.length > 0) {
        instances.forEach((inst: any) => {
          const name = inst.instance?.instanceName || 'N/A';
          const status = inst.instance?.status || 'N/A';
          const state = inst.instance?.state || 'N/A';
          
          console.log(`\n   📱 ${name}`);
          console.log(`      Status: ${status}`);
          console.log(`      State: ${state}`);
          
          if (name === CONFIG.instance) {
            if (status === 'open' && state === 'open') {
              console.log(`      ✅ CONECTADA E PRONTA`);
            } else {
              console.log(`      ❌ NÃO CONECTADA - Este é o problema!`);
            }
          }
        });
        
        // Verificar se a instância Cobranca existe
        const cobrancaExists = instances.some((i: any) => 
          i.instance?.instanceName === CONFIG.instance
        );
        
        if (!cobrancaExists) {
          console.log(`\n❌ PROBLEMA CRÍTICO: Instância "${CONFIG.instance}" não existe!`);
          console.log(`\n💡 Instâncias disponíveis:`);
          instances.forEach((i: any) => {
            console.log(`   - ${i.instance?.instanceName}`);
          });
        }
      } else {
        console.log('   ⚠️  Nenhuma instância encontrada');
      }
    } else {
      console.log(`   ❌ Erro: HTTP ${listResponse.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${(error as Error).message}`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 DIAGNÓSTICO FINAL:');
  console.log('-'.repeat(70));
  console.log(`
Se a instância "${CONFIG.instance}" mostrar status diferente de "open":
  
  ❌ PROBLEMA: Instância desconectada do WhatsApp
  
  ✅ SOLUÇÃO:
     1. Acesse: ${baseUrl.replace('/instance/', '').replace('/message/', '')}
     2. Vá na instância "${CONFIG.instance}"
     3. Clique em "Conectar" ou "Reconectar"
     4. Escaneie o QR Code com o WhatsApp Business
     5. Aguarde o status mudar para "open"
     6. Teste novamente o envio
  
Alternativamente, você pode usar uma instância que já está conectada
(Principal ou Leads, se estiverem com status "open").
  `);
  console.log('='.repeat(70));
}

checkInstanceStatus().catch(error => {
  console.error('ERRO:', error);
  process.exit(1);
});
