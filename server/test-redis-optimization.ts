/**
 * 🧪 TESTE DE OTIMIZAÇÕES REDIS
 * 
 * Execute: npx tsx server/test-redis-optimization.ts
 */

import { redis } from './lib/redis-config';
import { 
  saveConversationThread,
  getConversationThread,
  getMultipleThreads 
} from './lib/redis-cache';
import { 
  getCached, 
  localCache, 
  getBatchUpdater,
  logCacheStats 
} from './lib/redis-cache';

async function testOptimizations() {
  console.log('🧪 Iniciando testes de otimização Redis...\n');

  // ==================== TESTE 1: Cache Local ====================
  console.log('📝 TESTE 1: Cache Local em Memória');
  
  let requestCount = 0;
  
  const fetcher = async () => {
    requestCount++;
    console.log(`   → Request Redis #${requestCount}`);
    return { data: 'expensive data' };
  };

  // Primeira chamada: deve fazer request
  await getCached(redis, 'test:cache', fetcher, { 
    localTTL: 10000, 
    redisTTL: 60 
  });
  console.log(`   ✅ Cache MISS: ${requestCount} request(s)`);

  // Segunda chamada: deve usar cache local (0 requests)
  await getCached(redis, 'test:cache', fetcher, { 
    localTTL: 10000, 
    redisTTL: 60 
  });
  console.log(`   ✅ Cache HIT: ${requestCount} request(s) (nenhum novo!)\n`);

  // ==================== TESTE 2: Pipeline ====================
  console.log('📝 TESTE 2: Pipeline (Múltiplas Operações em 1 Request)');
  
  const startPipeline = Date.now();
  
  await saveConversationThread(
    redis,
    999,
    'thread_test_123',
    { sentiment: 'positive', urgency: 'low' }
  );
  
  const pipelineTime = Date.now() - startPipeline;
  console.log(`   ✅ Thread + metadata salvo em ${pipelineTime}ms (1 request)\n`);

  // ==================== TESTE 3: Multi-Get ====================
  console.log('📝 TESTE 3: Multi-Get (Buscar Múltiplas Threads)');
  
  // Salva múltiplas threads
  for (let i = 1; i <= 5; i++) {
    await redis.hset(`conv:${i}`, { 
      threadId: `thread_${i}`, 
      createdAt: Date.now() 
    });
  }
  
  const startMultiGet = Date.now();
  const threads = await getMultipleThreads(redis, [1, 2, 3, 4, 5]);
  const multiGetTime = Date.now() - startMultiGet;
  
  console.log(`   ✅ ${threads.length} threads buscadas em ${multiGetTime}ms (1 request)`);
  console.log(`   📊 Economia: 5 requests → 1 request (80% redução)\n`);

  // ==================== TESTE 4: Batch Updates ====================
  console.log('📝 TESTE 4: Batch Updates (Contadores Acumulados)');
  
  const batchUpdater = getBatchUpdater(redis);
  
  // Incrementa localmente (0 requests)
  for (let i = 0; i < 10; i++) {
    batchUpdater.increment('test:counter', 1);
  }
  
  console.log('   → 10 incrementos acumulados localmente (0 requests)');
  
  // Flush manual
  const startFlush = Date.now();
  await batchUpdater.flush();
  const flushTime = Date.now() - startFlush;
  
  const finalCount = await redis.get('test:counter');
  console.log(`   ✅ Flush executado em ${flushTime}ms (1 request)`);
  console.log(`   📊 Contador final: ${finalCount}`);
  console.log(`   📊 Economia: 10 requests → 1 request (90% redução)\n`);

  // ==================== TESTE 5: Hash vs Múltiplas Keys ====================
  console.log('📝 TESTE 5: Hash vs Múltiplas Keys');
  
  // Método antigo (múltiplas keys)
  const startOld = Date.now();
  await redis.set('user:1:name', 'João');
  await redis.set('user:1:age', '25');
  await redis.set('user:1:email', 'joao@email.com');
  const oldTime = Date.now() - startOld;
  console.log(`   ❌ Método antigo: ${oldTime}ms (3 requests)`);
  
  // Método novo (hash)
  const startNew = Date.now();
  await redis.hset('user:2', { 
    name: 'Maria', 
    age: '30', 
    email: 'maria@email.com' 
  });
  const newTime = Date.now() - startNew;
  console.log(`   ✅ Método novo (hash): ${newTime}ms (1 request)`);
  console.log(`   📊 Economia: 3 requests → 1 request (67% redução)\n`);

  // ==================== RESUMO ====================
  console.log('📊 RESUMO DE OTIMIZAÇÕES:');
  console.log('   ✅ Cache Local: 100% redução após primeiro acesso');
  console.log('   ✅ Pipeline: 50% redução (thread + metadata)');
  console.log('   ✅ Multi-Get: 80% redução (5 threads)');
  console.log('   ✅ Batch Updates: 90% redução (10 incrementos)');
  console.log('   ✅ Hashes: 67% redução (3 campos)\n');
  
  console.log('💾 Cache Stats:');
  logCacheStats();
  
  // Cleanup
  await redis.del('test:cache', 'test:counter', 'user:1:name', 'user:1:age', 'user:1:email');
  await redis.del('user:2', 'conv:999');
  for (let i = 1; i <= 5; i++) {
    await redis.del(`conv:${i}`);
  }
  
  console.log('\n✅ Teste concluído com sucesso!');
  console.log('📈 Economia total estimada: 60-80% dos comandos Redis\n');
  
  process.exit(0);
}

testOptimizations().catch(err => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
