/**
 * Script de Diagnóstico WhatsApp - Evolution API
 * Verifica configurações e possíveis problemas
 */

const EVOLUTION_CONFIG = {
  apiUrl: process.env.EVOLUTION_API_URL || '',
  instance: 'Cobranca',
  apiKey: process.env.EVOLUTION_API_KEY_COBRANCA || '',
};

async function diagnoseWhatsApp() {
  console.log('🔍 DIAGNÓSTICO EVOLUTION API - WhatsApp Template\n');
  console.log('='.repeat(60));
  
  // 1. Verificar configurações
  console.log('\n📋 1. VERIFICANDO CONFIGURAÇÕES');
  console.log('-'.repeat(60));
  console.log(`   URL: ${EVOLUTION_CONFIG.apiUrl || '❌ NÃO CONFIGURADA'}`);
  console.log(`   Instância: ${EVOLUTION_CONFIG.instance}`);
  console.log(`   API Key: ${EVOLUTION_CONFIG.apiKey ? '✅ Configurada' : '❌ NÃO CONFIGURADA'}`);
  
  if (!EVOLUTION_CONFIG.apiUrl || !EVOLUTION_CONFIG.apiKey) {
    console.log('\n❌ ERRO: Credenciais não configuradas. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY_COBRANCA');
    process.exit(1);
  }
  
  let baseUrl = EVOLUTION_CONFIG.apiUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  
  // 2. Verificar status da instância
  console.log('\n📡 2. VERIFICANDO STATUS DA INSTÂNCIA');
  console.log('-'.repeat(60));
  
  try {
    const instanceUrl = `${baseUrl}/instance/fetchInstances?instanceName=${EVOLUTION_CONFIG.instance}`;
    const instanceResponse = await fetch(instanceUrl, {
      headers: { 'apikey': EVOLUTION_CONFIG.apiKey }
    });
    
    if (instanceResponse.ok) {
      const instances = await instanceResponse.json();
      if (instances && instances.length > 0) {
        const inst = instances[0];
        console.log(`   Nome: ${inst.instance?.instanceName || 'N/A'}`);
        console.log(`   Status Conexão: ${inst.instance?.status || 'N/A'}`);
        console.log(`   State: ${inst.instance?.state || 'N/A'}`);
        
        if (inst.instance?.status !== 'open') {
          console.log(`\n   ⚠️  AVISO: Instância não está conectada!`);
          console.log(`   Status atual: ${inst.instance?.status}`);
          console.log(`   A instância precisa estar com status "open" para enviar mensagens.`);
        } else {
          console.log(`   ✅ Instância conectada`);
        }
      } else {
        console.log(`   ❌ Instância "${EVOLUTION_CONFIG.instance}" não encontrada`);
      }
    } else {
      console.log(`   ❌ Erro ao verificar instância: HTTP ${instanceResponse.status}`);
      const errorText = await instanceResponse.text();
      console.log(`   Resposta: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ Erro ao conectar com API: ${(error as Error).message}`);
  }
  
  // 3. Verificar templates disponíveis
  console.log('\n📝 3. VERIFICANDO TEMPLATES DISPONÍVEIS');
  console.log('-'.repeat(60));
  
  try {
    const templateUrl = `${baseUrl}/template/find/${EVOLUTION_CONFIG.instance}`;
    const templateResponse = await fetch(templateUrl, {
      headers: { 'apikey': EVOLUTION_CONFIG.apiKey }
    });
    
    if (templateResponse.ok) {
      const templates = await templateResponse.json();
      
      if (templates && Array.isArray(templates) && templates.length > 0) {
        console.log(`   ✅ Total de templates: ${templates.length}\n`);
        
        // Procurar template específico
        const targetTemplate = templates.find((t: any) => t.name === 'financeiro_em_atraso');
        
        if (targetTemplate) {
          console.log('   🎯 Template "financeiro_em_atraso" encontrado:');
          console.log(`      - Status: ${targetTemplate.status || 'N/A'}`);
          console.log(`      - Idioma: ${targetTemplate.language || 'N/A'}`);
          console.log(`      - Categoria: ${targetTemplate.category || 'N/A'}`);
          
          if (targetTemplate.status !== 'APPROVED') {
            console.log(`\n      ⚠️  PROBLEMA ENCONTRADO!`);
            console.log(`      Status do template: ${targetTemplate.status}`);
            console.log(`      O template precisa estar com status "APPROVED" para funcionar.`);
            console.log(`      Verifique no Meta Business Manager se o template foi aprovado.`);
          } else {
            console.log(`      ✅ Template aprovado`);
          }
          
          // Mostrar componentes
          if (targetTemplate.components) {
            console.log(`\n      Componentes do template:`);
            targetTemplate.components.forEach((comp: any, idx: number) => {
              console.log(`        ${idx + 1}. Tipo: ${comp.type}`);
              if (comp.text) {
                console.log(`           Texto: ${comp.text.substring(0, 100)}...`);
              }
            });
          }
        } else {
          console.log(`   ❌ Template "financeiro_em_atraso" NÃO encontrado`);
          console.log(`\n   Templates disponíveis:`);
          templates.slice(0, 5).forEach((t: any) => {
            console.log(`      - ${t.name} (${t.language}) - ${t.status}`);
          });
          if (templates.length > 5) {
            console.log(`      ... e mais ${templates.length - 5} templates`);
          }
        }
      } else {
        console.log(`   ⚠️  Nenhum template encontrado`);
        console.log(`   Você precisa criar e aprovar templates no Meta Business Manager`);
      }
    } else {
      console.log(`   ❌ Erro ao buscar templates: HTTP ${templateResponse.status}`);
      const errorText = await templateResponse.text();
      console.log(`   Resposta: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ Erro ao verificar templates: ${(error as Error).message}`);
  }
  
  // 4. Verificar se número tem WhatsApp
  console.log('\n📱 4. VERIFICANDO NÚMERO DE DESTINO');
  console.log('-'.repeat(60));
  
  const testNumber = '5522997074180';
  console.log(`   Número a verificar: ${testNumber}`);
  
  try {
    const checkUrl = `${baseUrl}/chat/whatsappNumbers/${EVOLUTION_CONFIG.instance}`;
    const checkResponse = await fetch(checkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_CONFIG.apiKey
      },
      body: JSON.stringify({
        numbers: [testNumber]
      })
    });
    
    if (checkResponse.ok) {
      const result = await checkResponse.json();
      console.log(`   Resultado: ${JSON.stringify(result, null, 2)}`);
      
      if (result && Array.isArray(result) && result.length > 0) {
        const numberInfo = result[0];
        if (numberInfo.exists) {
          console.log(`   ✅ Número tem WhatsApp ativo`);
        } else {
          console.log(`   ❌ Número NÃO tem WhatsApp ou está incorreto`);
        }
      }
    } else {
      console.log(`   ⚠️  Não foi possível verificar (HTTP ${checkResponse.status})`);
    }
  } catch (error) {
    console.log(`   ⚠️  Não foi possível verificar: ${(error as Error).message}`);
  }
  
  // 5. Resumo e recomendações
  console.log('\n💡 5. RECOMENDAÇÕES');
  console.log('='.repeat(60));
  console.log(`
   Possíveis motivos para não receber a mensagem:
   
   1. ✅ Template não aprovado pela Meta
      → Verifique no Meta Business Manager se o status é "APPROVED"
      
   2. ✅ Método de pagamento não configurado (WhatsApp Cloud API)
      → Adicione um cartão em Meta Business Manager > Configurações de Pagamento
      
   3. ✅ Instância não conectada
      → Verifique se o status da instância é "open"
      
   4. ✅ Formato de número incorreto
      → Use: ${testNumber} (com código do país 55)
      
   5. ✅ Parâmetros do template incorretos
      → Verifique se o idioma é "en" e se os parâmetros estão corretos
      
   6. ✅ Número bloqueou a conta de negócio
      → Teste com outro número para confirmar
      
   7. ✅ Delay de entrega do WhatsApp
      → Às vezes pode levar alguns minutos
  `);
  
  console.log('\n✅ Diagnóstico concluído');
  console.log('='.repeat(60));
}

diagnoseWhatsApp().catch(error => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});
