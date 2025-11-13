/**
 * Verificar configuração de webhook do Evolution API
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolutionapi.trtelecom.net';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

async function checkWebhook() {
  console.log('🔍 VERIFICANDO CONFIGURAÇÃO DE WEBHOOK\n');
  
  if (!EVOLUTION_API_KEY) {
    console.error('❌ EVOLUTION_API_KEY não configurada!');
    process.exit(1);
  }
  
  try {
    // Verificar configuração da instância Cobranca
    const url = `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=Cobranca`;
    
    console.log(`📡 Consultando: ${url}\n`);
    
    const response = await fetch(url, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
      },
    });
    
    const data = await response.json();
    
    console.log('✅ Resposta:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    // Verificar se webhook está configurado
    if (data && Array.isArray(data)) {
      const instance = data.find((i: any) => i.instance?.instanceName === 'Cobranca');
      
      if (instance) {
        console.log('📋 Instância Cobranca encontrada!');
        console.log('   Status:', instance.instance?.status);
        console.log('   Webhook:', instance.webhook || 'NÃO CONFIGURADO ❌');
      } else {
        console.log('⚠️  Instância Cobranca não encontrada');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

checkWebhook();
