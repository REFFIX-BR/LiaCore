/**
 * Script de diagnóstico para verificar configuração de webhooks da Evolution API
 * 
 * Verifica:
 * 1. Configuração atual de webhooks
 * 2. Eventos habilitados
 * 3. URL do webhook configurada
 */

let EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolutionapi.trtelecom.net';
const EVOLUTION_API_KEY_LEADS = process.env.EVOLUTION_API_KEY_LEADS;

// Garantir que a URL tenha protocolo
if (!EVOLUTION_API_URL.startsWith('http://') && !EVOLUTION_API_URL.startsWith('https://')) {
  EVOLUTION_API_URL = `https://${EVOLUTION_API_URL}`;
}

async function checkWebhookConfig() {
  console.log('🔍 [Evolution Diagnostic] Iniciando verificação de webhooks...\n');
  console.log(`📡 Evolution API URL: ${EVOLUTION_API_URL}\n`);
  
  if (!EVOLUTION_API_KEY_LEADS) {
    console.error('❌ EVOLUTION_API_KEY_LEADS não configurada');
    process.exit(1);
  }
  
  try {
    // 1. Verificar configuração de webhooks
    console.log('📡 Verificando configuração de webhooks da instância "Leads"...');
    const webhookConfigUrl = `${EVOLUTION_API_URL}/webhook/find/Leads`;
    
    const webhookResponse = await fetch(webhookConfigUrl, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY_LEADS,
        'Content-Type': 'application/json'
      }
    });
    
    if (!webhookResponse.ok) {
      console.error(`❌ Erro ao buscar configuração: ${webhookResponse.status} ${webhookResponse.statusText}`);
      const errorText = await webhookResponse.text();
      console.error('Resposta:', errorText);
      process.exit(1);
    }
    
    const webhookConfig = await webhookResponse.json();
    
    console.log('\n✅ Configuração de Webhooks:');
    console.log(JSON.stringify(webhookConfig, null, 2));
    
    // 2. Verificar se webhook está habilitado
    if (webhookConfig.webhook) {
      const webhook = webhookConfig.webhook;
      console.log('\n📋 Status do Webhook:');
      console.log(`  ✓ Habilitado: ${webhook.enabled ? 'SIM ✅' : 'NÃO ❌'}`);
      console.log(`  ✓ URL: ${webhook.url || 'NÃO CONFIGURADA ❌'}`);
      console.log(`  ✓ Webhook por tópico: ${webhook.webhookByEvents ? 'SIM' : 'NÃO'}`);
      
      if (webhook.events && Array.isArray(webhook.events)) {
        console.log(`\n📋 Eventos habilitados (${webhook.events.length}):`);
        webhook.events.forEach((event: string) => {
          const isLocationRelated = event.toLowerCase().includes('message');
          console.log(`  ${isLocationRelated ? '📍' : '  '} ${event}`);
        });
        
        // Verificar eventos específicos
        const hasMessagesUpsert = webhook.events.includes('MESSAGES_UPSERT') || 
                                 webhook.events.includes('messages.upsert');
        const hasMessagesUpdate = webhook.events.includes('MESSAGES_UPDATE') || 
                                 webhook.events.includes('messages.update');
        
        console.log('\n🔍 Eventos críticos:');
        console.log(`  MESSAGES_UPSERT: ${hasMessagesUpsert ? '✅ HABILITADO' : '❌ DESABILITADO'}`);
        console.log(`  MESSAGES_UPDATE: ${hasMessagesUpdate ? '✅ HABILITADO' : '❌ DESABILITADO'}`);
        
        if (!hasMessagesUpsert) {
          console.warn('\n⚠️  ATENÇÃO: MESSAGES_UPSERT não está habilitado!');
          console.warn('   Mensagens de localização precisam deste evento!');
        }
      } else {
        console.log('\n⚠️  Nenhum evento configurado ou informação não disponível');
      }
    } else {
      console.error('\n❌ Webhook não configurado para esta instância!');
    }
    
    // 3. Verificar status da instância
    console.log('\n\n🔍 Verificando status da instância...');
    const instanceUrl = `${EVOLUTION_API_URL}/instance/connectionState/Leads`;
    
    const instanceResponse = await fetch(instanceUrl, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY_LEADS
      }
    });
    
    if (instanceResponse.ok) {
      const instanceStatus = await instanceResponse.json();
      console.log('\n✅ Status da Instância:');
      console.log(JSON.stringify(instanceStatus, null, 2));
    } else {
      console.warn(`⚠️  Não foi possível verificar status: ${instanceResponse.status}`);
    }
    
    console.log('\n\n✅ Diagnóstico concluído!');
    
  } catch (error) {
    console.error('\n❌ Erro durante diagnóstico:', error);
    process.exit(1);
  }
}

checkWebhookConfig();
