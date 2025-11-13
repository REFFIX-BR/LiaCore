import axios from 'axios';

/**
 * Testa conectividade com Evolution API e verifica configuração de webhooks
 */

let EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'evolutionapi.trtelecom.net';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// Normalizar URL (adicionar https:// se necessário)
if (!EVOLUTION_API_URL.startsWith('http')) {
  EVOLUTION_API_URL = `https://${EVOLUTION_API_URL}`;
}

async function testWebhookConfig() {
  console.log('🔍 ====== DIAGNÓSTICO EVOLUTION API ======\n');
  console.log(`📡 Evolution API URL: ${EVOLUTION_API_URL}\n`);
  
  if (!EVOLUTION_API_KEY) {
    console.error('❌ EVOLUTION_API_KEY não configurada!');
    process.exit(1);
  }
  
  try {
    // 1. Verificar instância "Cobranca"
    console.log('1️⃣  Verificando instância "Cobranca"...');
    const instanceUrl = `${EVOLUTION_API_URL}/instance/fetchInstances`;
    const instancesResponse = await axios.get(instanceUrl, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
      },
    });
    
    const cobrancaInstance = instancesResponse.data.find((i: any) => 
      i.name === 'Cobranca' || i.name === 'Cobrança'
    );
    
    if (!cobrancaInstance) {
      console.error('❌ Instância "Cobranca" não encontrada!');
      console.log('\n📋 Instâncias disponíveis:');
      instancesResponse.data.forEach((i: any) => {
        console.log(`  - ${i.name || 'Unknown'}`);
      });
      process.exit(1);
    }
    
    console.log('✅ Instância "Cobranca" encontrada');
    console.log(`   ID: ${cobrancaInstance.id}`);
    console.log(`   Status: ${cobrancaInstance.connectionStatus}`);
    console.log(`   Number: ${cobrancaInstance.number}`);
    
    // 2. Verificar webhook configurado
    console.log('\n2️⃣  Verificando configuração de webhook...');
    const webhookUrl = `${EVOLUTION_API_URL}/webhook/find/Cobranca`;
    
    try {
      const webhookResponse = await axios.get(webhookUrl, {
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
      });
      
      const webhookData = webhookResponse.data;
      console.log('✅ Webhook encontrado:');
      console.log('   URL:', webhookData.url || 'Não configurada');
      console.log('   Enabled:', webhookData.enabled);
      console.log('   Events:', webhookData.events || 'Nenhum');
      
      // Verificar se MESSAGES_UPDATE está habilitado
      const hasMessagesUpdate = webhookData.events?.includes('MESSAGES_UPDATE');
      if (!hasMessagesUpdate) {
        console.warn('\n⚠️  PROBLEMA CRÍTICO: Evento MESSAGES_UPDATE não está habilitado!');
        console.log('   Sem este evento, o status das mensagens nunca será atualizado.');
      } else {
        console.log('\n✅ Evento MESSAGES_UPDATE está habilitado');
      }
      
      // Verificar se a URL aponta para o servidor correto
      const expectedWebhookPath = '/webhook/evolution';
      if (!webhookData.url?.includes(expectedWebhookPath)) {
        console.warn(`\n⚠️  URL do webhook não aponta para ${expectedWebhookPath}`);
        console.log(`   URL configurada: ${webhookData.url}`);
      }
      
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error('❌ NENHUM WEBHOOK CONFIGURADO para instância "Cobranca"!');
        console.log('\n📝 Instruções para configurar:');
        console.log('   1. Acesse o painel Evolution API');
        console.log('   2. Navegue até Webhooks > Cobranca');
        console.log('   3. Configure:');
        console.log('      - URL: https://[SEU_DOMINIO]/webhook/evolution');
        console.log('      - Events: [MESSAGES_UPDATE]');
        console.log('      - Enabled: true');
      } else {
        throw error;
      }
    }
    
    // 3. Testar conectividade de resposta
    console.log('\n3️⃣  Servidor webhook local:');
    const repl_domain = process.env.REPL_SLUG && process.env.REPL_OWNER 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'http://localhost:5000';
    console.log(`   URL pública esperada: ${repl_domain}/webhook/evolution`);
    
    console.log('\n✅ Diagnóstico completo!');
    console.log('\n📋 Resumo das ações necessárias:');
    console.log('   1. Configure webhook MESSAGES_UPDATE no Evolution API');
    console.log(`   2. URL do webhook: ${repl_domain}/webhook/evolution`);
    console.log('   3. Re-envie uma mensagem de teste');
    console.log('   4. Verifique se o status muda de PENDING');
    
  } catch (error: any) {
    console.error('❌ Erro ao conectar com Evolution API:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testWebhookConfig();
