/**
 * Evolution API - Full Debug
 * Mostra TODAS as informações sobre instâncias disponíveis
 */

async function fullDebug() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Evolution API - Debug Completo');
  console.log('═══════════════════════════════════════════════════\n');

  const keys = {
    PRINCIPAL: process.env.EVOLUTION_API_KEY_PRINCIPAL || process.env.EVOLUTION_API_KEY,
    LEADS: process.env.EVOLUTION_API_KEY_LEADS,
    COBRANCA: process.env.EVOLUTION_API_KEY_COBRANCA,
  };

  const baseUrl = process.env.EVOLUTION_API_URL?.trim().startsWith('http') 
    ? process.env.EVOLUTION_API_URL.trim()
    : `https://${process.env.EVOLUTION_API_URL?.trim()}`;

  console.log(`📡 Base URL: ${baseUrl}\n`);

  for (const [name, key] of Object.entries(keys)) {
    if (!key) {
      console.log(`⏭️  ${name}: API key não configurada\n`);
      continue;
    }

    console.log(`🔍 Testando ${name}`);
    console.log(`   API Key: ${key.substring(0, 12)}...${key.slice(-8)}`);

    try {
      const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': key,
          'Content-Type': 'application/json',
        },
      });

      console.log(`   HTTP Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        
        console.log(`\n   ✅ CONECTOU COM SUCESSO!`);
        console.log(`   📦 Tipo do payload: ${Array.isArray(data) ? 'Array' : typeof data}`);
        console.log(`   📦 Payload completo (JSON):`);
        console.log(JSON.stringify(data, null, 2).split('\n').map(line => `      ${line}`).join('\n'));
        
        if (Array.isArray(data)) {
          console.log(`\n   📊 Total de instâncias retornadas: ${data.length}`);
          
          if (data.length > 0) {
            console.log(`   📋 Instâncias disponíveis:`);
            data.forEach((inst: any, idx: number) => {
              const instanceName = inst.instanceName || inst.instance?.instanceName || 'N/A';
              const status = inst.status || inst.instance?.status || 'unknown';
              console.log(`      ${idx + 1}. "${instanceName}" (status: ${status})`);
            });
          } else {
            console.log(`   ⚠️  ARRAY VAZIO - nenhuma instância retornada`);
          }
        } else {
          console.log(`   ℹ️  Resposta não é array - estrutura diferente`);
        }
      } else {
        const errorText = await response.text();
        console.log(`   ❌ FALHOU!`);
        console.log(`   Erro: ${errorText.substring(0, 300)}`);
      }
    } catch (error: any) {
      console.log(`   ❌ ERRO DE CONEXÃO: ${error.message}`);
    }

    console.log(''); // linha vazia
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  Debug Concluído!');
  console.log('═══════════════════════════════════════════════════\n');
}

fullDebug()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal:', error);
    process.exit(1);
  });
