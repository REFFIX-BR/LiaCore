/**
 * Verificar batches travados no Redis
 */

import { redisConnection } from '../server/lib/redis-config';

async function checkStuckBatches() {
  console.log('🔍 VERIFICANDO BATCHES TRAVADOS NO REDIS\n');
  
  try {
    // Buscar todas as chaves de batch
    const batchKeys = await redisConnection.keys('msg_batch:*');
    const timerKeys = await redisConnection.keys('msg_timer:*');
    
    console.log(`📊 Batches no Redis:`);
    console.log(`   Batch keys: ${batchKeys.length}`);
    console.log(`   Timer keys: ${timerKeys.length}`);
    console.log('');
    
    if (batchKeys.length === 0) {
      console.log('✅ Nenhum batch pendente no Redis');
      process.exit(0);
    }
    
    // Verificar cada batch
    console.log('📋 BATCHES PENDENTES:\n');
    
    for (const batchKey of batchKeys) {
      const chatId = batchKey.replace('msg_batch:', '');
      const timerKey = `msg_timer:${chatId}`;
      
      // Pegar batch
      const batchItems = await redisConnection.lrange(batchKey, 0, -1);
      
      // Pegar timer
      const timerValue = await redisConnection.get(timerKey);
      const timerTTL = await redisConnection.ttl(timerKey);
      
      if (batchItems.length === 0) {
        console.log(`⚠️  ${chatId}: Batch vazio (mas chave existe)`);
        continue;
      }
      
      // Parse primeira mensagem para pegar info
      const firstMsg = JSON.parse(batchItems[0]);
      const now = Date.now();
      
      let ageSeconds = 0;
      if (timerValue) {
        const lastUpdate = parseInt(timerValue);
        ageSeconds = Math.floor((now - lastUpdate) / 1000);
      }
      
      console.log(`📦 ${chatId}`);
      console.log(`   Cliente: ${firstMsg.clientName}`);
      console.log(`   Mensagens no batch: ${batchItems.length}`);
      console.log(`   Timer value: ${timerValue || 'nenhum'}`);
      console.log(`   Timer TTL: ${timerTTL}s`);
      console.log(`   Idade do batch: ${ageSeconds}s`);
      
      if (ageSeconds > 10) {
        console.log(`   ⚠️  BATCH TRAVADO! Deveria ter processado há ${ageSeconds - 3}s`);
        
        // Mostrar mensagens
        console.log(`   Mensagens:`);
        for (let i = 0; i < Math.min(batchItems.length, 3); i++) {
          const msg = JSON.parse(batchItems[i]);
          const preview = msg.message.substring(0, 40);
          console.log(`     ${i + 1}. "${preview}..."`);
        }
      }
      
      console.log('');
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

checkStuckBatches();
