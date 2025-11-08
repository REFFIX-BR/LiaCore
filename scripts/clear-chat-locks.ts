import { redisConnection } from '../server/lib/redis-config';

async function clearLocks() {
  console.log('🔓 Limpando locks de chat travados...\n');
  
  const keys = await redisConnection.keys('chat_lock:*');
  console.log(`📋 Encontrados ${keys.length} locks`);
  
  if (keys.length > 0) {
    for (const key of keys) {
      const ttl = await redisConnection.ttl(key);
      console.log(`  - ${key} (TTL: ${ttl}s)`);
      await redisConnection.del(key);
    }
    console.log(`\n✅ ${keys.length} locks removidos!`);
  } else {
    console.log('✅ Nenhum lock travado encontrado');
  }
  
  await redisConnection.quit();
}

clearLocks().catch(console.error);
