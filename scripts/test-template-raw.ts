/**
 * Teste RAW do Template - Mostra resposta completa da API
 */

const CONFIG = {
  apiUrl: process.env.EVOLUTION_API_URL || '',
  instance: 'Cobranca',
  apiKey: process.env.EVOLUTION_API_KEY_COBRANCA || '',
};

async function testTemplateRaw() {
  console.log('🧪 TESTE RAW - Template WhatsApp\n');
  console.log('='.repeat(70));
  
  let baseUrl = CONFIG.apiUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  
  const url = `${baseUrl}/message/sendTemplate/${CONFIG.instance}`;
  const phoneNumber = '5522997074180';
  
  const payload = {
    number: phoneNumber,
    name: 'financeiro_em_atraso',
    language: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          {
            type: 'text',
            text: 'Teste'
          }
        ]
      }
    ]
  };
  
  console.log('\n📋 CONFIGURAÇÃO:');
  console.log(`   URL: ${url}`);
  console.log(`   Instância: ${CONFIG.instance}`);
  console.log(`   API Key: ${CONFIG.apiKey ? '***' + CONFIG.apiKey.slice(-4) : 'NÃO CONFIGURADA'}`);
  console.log(`   Número: ${phoneNumber}`);
  console.log(`\n📦 PAYLOAD:`);
  console.log(JSON.stringify(payload, null, 2));
  
  console.log('\n🚀 Enviando requisição...\n');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.apiKey,
      },
      body: JSON.stringify(payload),
    });
    
    console.log('📊 RESPOSTA HTTP:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`);
    response.headers.forEach((value, key) => {
      console.log(`      ${key}: ${value}`);
    });
    
    const responseText = await response.text();
    console.log(`\n📄 BODY DA RESPOSTA (RAW):`);
    console.log(responseText);
    
    // Tentar parsear JSON
    try {
      const responseJson = JSON.parse(responseText);
      console.log(`\n📄 BODY DA RESPOSTA (JSON):`);
      console.log(JSON.stringify(responseJson, null, 2));
      
      // Analisar resposta
      if (response.ok) {
        console.log('\n✅ SUCESSO - API aceitou a requisição');
        
        if (responseJson.key?.id) {
          console.log(`   Message ID: ${responseJson.key.id}`);
        }
        if (responseJson.key?.remoteJid) {
          console.log(`   Remote JID: ${responseJson.key.remoteJid}`);
        }
        
        console.log('\n💡 IMPORTANTE:');
        console.log('   - A API retornou sucesso, mas isso não garante entrega');
        console.log('   - Verifique se você recebeu a mensagem no WhatsApp');
        console.log('   - Se não recebeu, os motivos mais comuns são:');
        console.log('     1. Template não aprovado pela Meta (status diferente de APPROVED)');
        console.log('     2. Método de pagamento não configurado no Meta Business Manager');
        console.log('     3. Instância WhatsApp não conectada ou desconectada');
        console.log('     4. Número incorreto ou bloqueou a conta de negócio');
        
      } else {
        console.log('\n❌ ERRO - API rejeitou a requisição');
        
        if (response.status === 401) {
          console.log('   🔐 ERRO 401: API Key incorreta ou expirada');
          console.log('   → Verifique EVOLUTION_API_KEY_COBRANCA');
        } else if (response.status === 404) {
          console.log('   🔍 ERRO 404: Instância "Cobranca" não encontrada');
          console.log('   → Verifique se a instância existe na Evolution API');
        } else if (response.status === 400) {
          console.log('   ⚠️  ERRO 400: Requisição inválida');
          console.log('   → Pode ser:');
          console.log('      - Template não existe ou não está aprovado');
          console.log('      - Parâmetros incorretos');
          console.log('      - Instância não conectada ao WhatsApp');
        } else if (response.status === 403) {
          console.log('   🚫 ERRO 403: Sem permissão');
          console.log('   → Pode ser:');
          console.log('      - Template não aprovado pela Meta');
          console.log('      - Conta WhatsApp Business bloqueada');
          console.log('      - Número em lista de bloqueio');
        } else if (response.status === 500) {
          console.log('   💥 ERRO 500: Erro interno da Evolution API');
          console.log('   → Verifique os logs da Evolution API');
        }
        
        if (responseJson.error) {
          console.log(`\n   Mensagem de erro: ${responseJson.error}`);
        }
        if (responseJson.message) {
          console.log(`   Mensagem: ${responseJson.message}`);
        }
      }
      
    } catch (jsonError) {
      console.log('\n⚠️  Resposta não é JSON válido');
    }
    
  } catch (error) {
    console.log('\n❌ ERRO DE REDE:');
    console.log(`   ${(error as Error).message}`);
    console.log('\n   Possíveis causas:');
    console.log('   - URL da Evolution API incorreta');
    console.log('   - Servidor Evolution API offline');
    console.log('   - Problema de conectividade de rede');
  }
  
  console.log('\n' + '='.repeat(70));
}

testTemplateRaw().catch(error => {
  console.error('\n💥 ERRO FATAL:', error);
  process.exit(1);
});
