import { db } from './server/db';
import { conversations } from './shared/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';

async function checkCustomerAPI() {
  try {
    const conversationId = '80e5fe7f-551e-4955-b489-e014ad775488';
    const cpf = '08784164719'; // CPF sem formatação
    
    console.log('========== VERIFICAÇÃO DA CONVERSA ==========\n');
    
    // 1. Buscar conversa
    console.log(`🔍 Buscando conversa ${conversationId}...`);
    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    if (conv.length === 0) {
      console.log('❌ Conversa não encontrada!');
      return;
    }
    
    const conversation = conv[0];
    console.log('✅ Conversa encontrada:');
    console.log(`   - ID: ${conversation.id}`);
    console.log(`   - Chat ID: ${conversation.chatId}`);
    console.log(`   - Status: ${conversation.status}`);
    console.log(`   - Assistente: ${conversation.assistantType}`);
    console.log(`   - CPF salvo: ${conversation.clientDocument || 'NÃO'}`);
    console.log(`   - Transferido para humano: ${conversation.transferredToHuman ? 'SIM' : 'NÃO'}`);
    console.log(`   - Ponto selecionado: ${conversation.selectedInstallationPoint || 'NENHUM'}`);
    
    // 2. Consultar API do CRM
    console.log('\n========== CONSULTA API CRM ==========\n');
    console.log(`📞 Consultando CPF: ${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9,11)}`);
    
    const crmApiUrl = process.env.CRM_API_URL || 'https://api.trtelecom.net/api';
    const crmApiKey = process.env.CRM_API_KEY;
    
    if (!crmApiKey) {
      console.log('⚠️  CRM_API_KEY não configurada!');
      return;
    }
    
    try {
      const response = await axios.get(`${crmApiUrl}/clientes/${cpf}`, {
        headers: {
          'Authorization': `Bearer ${crmApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('✅ Resposta da API recebida!\n');
      console.log('📋 DADOS DO CLIENTE:');
      console.log(JSON.stringify(response.data, null, 2));
      
      // Verificar múltiplos pontos
      const data = response.data;
      if (data.pontos_instalacao && Array.isArray(data.pontos_instalacao)) {
        console.log(`\n🔀 MÚLTIPLOS PONTOS DE INSTALAÇÃO: ${data.pontos_instalacao.length} ponto(s)`);
        data.pontos_instalacao.forEach((ponto: any, index: number) => {
          console.log(`\n   📍 Ponto ${index + 1}:`);
          console.log(`      Endereço: ${ponto.endereco || ponto.logradouro || 'N/A'}`);
          console.log(`      Cidade: ${ponto.cidade || 'N/A'}`);
          console.log(`      Bairro: ${ponto.bairro || 'N/A'}`);
          console.log(`      Contrato: ${ponto.contrato || ponto.id || 'N/A'}`);
        });
      } else {
        console.log('\n✅ Cliente possui APENAS 1 ponto de instalação');
      }
      
    } catch (apiError: any) {
      console.log('❌ Erro ao consultar API:');
      console.log(`   Status: ${apiError.response?.status || 'N/A'}`);
      console.log(`   Mensagem: ${apiError.message}`);
      if (apiError.response?.data) {
        console.log(`   Resposta: ${JSON.stringify(apiError.response.data, null, 2)}`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erro geral:', error.message);
  }
}

checkCustomerAPI();
