import { db } from './server/db';
import { conversations } from './shared/schema';
import { eq } from 'drizzle-orm';

async function checkCRMRealAPI() {
  try {
    const conversationId = '80e5fe7f-551e-4955-b489-e014ad775488';
    const cpf = '08784164719'; // CPF sem formatação
    
    console.log('========== VERIFICAÇÃO DA CONVERSA ==========\n');
    
    // 1. Buscar conversa
    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    if (conv.length > 0) {
      const conversation = conv[0];
      console.log('✅ Conversa encontrada:');
      console.log(`   - ID: ${conversation.id}`);
      console.log(`   - Assistente atual: ${conversation.assistentType}`);
      console.log(`   - CPF salvo: ${conversation.clientDocument || 'NÃO'}`);
      console.log(`   - Ponto selecionado:`, conversation.selectedInstallationPoint);
      console.log();
    }
    
    // 2. Consultar API REAL do CRM
    console.log('========== CONSULTA API CRM (REAL) ==========\n');
    console.log(`📞 Consultando CPF: ${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9,11)}`);
    
    const CRM_API_URL = "https://webhook.trtelecom.net/webhook/consultar/cliente/infoscontrato";
    
    const response = await fetch(`${CRM_API_URL}?documento=${cpf}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    console.log(`📡 Status da resposta: ${response.status} ${response.statusText}\n`);
    
    if (!response.ok) {
      console.log('❌ Erro na API!');
      const errorText = await response.text();
      console.log('Resposta:', errorText);
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ Resposta da API recebida!\n');
    console.log('📋 DADOS RETORNADOS (RAW):');
    console.log(JSON.stringify(data, null, 2));
    
    // Processar resposta
    const contracts = Array.isArray(data) ? data : [data];
    
    console.log(`\n🔍 Total de contratos/pontos: ${contracts.length}`);
    
    if (contracts.length > 1) {
      console.log('\n🔀 ⚠️  CLIENTE COM MÚLTIPLOS PONTOS DE INSTALAÇÃO! ⚠️\n');
    }
    
    contracts.forEach((contract: any, index: number) => {
      console.log(`\n📍 PONTO ${index + 1}:`);
      console.log(`   Cliente: ${contract.nomeCliente || contract.nome || 'N/A'}`);
      console.log(`   Endereço: ${contract.endereco || contract.logradouro || 'N/A'}`);
      console.log(`   Bairro: ${contract.bairro || 'N/A'}`);
      console.log(`   Cidade: ${contract.cidade || 'N/A'}`);
      console.log(`   Login: ${contract.login || 'N/A'}`);
      console.log(`   Plano: ${contract.plano || 'N/A'}`);
      console.log(`   Complemento: ${contract.complemento || 'N/A'}`);
    });
    
    console.log('\n========== ANÁLISE ==========');
    if (contracts.length > 1) {
      console.log(`✅ Sistema deve injetar contexto de múltiplos pontos`);
      console.log(`✅ IA deve perguntar qual endereço o cliente quer`);
      console.log(`✅ Cliente deve usar ferramenta selecionar_ponto_instalacao`);
    } else {
      console.log(`✅ Cliente tem apenas 1 ponto - processo normal`);
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

checkCRMRealAPI();
