/**
 * Testar se conseguimos fazer request para Evolution API
 * e verificar configuração de webhook
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

async function testEvolutionConnection() {
  console.log('🔍 TESTANDO CONEXÃO COM EVOLUTION API\n');
  
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error('❌ Variáveis de ambiente não configuradas:');
    console.error('   EVOLUTION_API_URL:', EVOLUTION_API_URL ? '✓' : '✗');
    console.error('   EVOLUTION_API_KEY:', EVOLUTION_API_KEY ? '✓' : '✗');
    process.exit(1);
  }
  
  console.log('📡 Evolution API URL:', EVOLUTION_API_URL);
  console.log('');
  
  try {
    // Tentar buscar informações da instância Cobranca
    const url = `${EVOLUTION_API_URL}/instance/fetchInstances`;
    
    console.log(`📤 GET ${url}`);
    console.log('');
    
    const response = await fetch(url, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
      },
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      const text = await response.text();
      console.error('Response:', text.substring(0, 500));
      process.exit(1);
    }
    
    const data = await response.json();
    
    console.log('✅ Resposta recebida!\n');
    console.log('📊 Total de instâncias:', Array.isArray(data) ? data.length : '?');
    console.log('');
    
    // Procurar instâncias Cobranca, Principal, Leads
    const instances = Array.isArray(data) ? data : [];
    const cobranca = instances.find((i: any) => 
      i.instance?.instanceName === 'Cobranca' || 
      i.instance?.instanceName === 'Cobrança'
    );
    const principal = instances.find((i: any) => i.instance?.instanceName === 'Principal');
    const leads = instances.find((i: any) => i.instance?.instanceName === 'Leads');
    
    if (cobranca) {
      console.log('✅ Instância Cobranca encontrada!');
      console.log('   Nome:', cobranca.instance?.instanceName);
      console.log('   Status:', cobranca.instance?.status || '?');
      console.log('   Webhook:', cobranca.webhook?.url || 'NÃO CONFIGURADO ❌');
      console.log('   Webhook events:', cobranca.webhook?.events || 'nenhum');
    } else {
      console.log('❌ Instância Cobranca NÃO encontrada');
    }
    
    console.log('');
    
    if (principal) {
      console.log('✅ Instância Principal encontrada!');
      console.log('   Webhook:', principal.webhook?.url || 'NÃO CONFIGURADO ❌');
    }
    
    if (leads) {
      console.log('✅ Instância Leads encontrada!');
      console.log('   Webhook:', leads.webhook?.url || 'NÃO CONFIGURADO ❌');
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

testEvolutionConnection();
