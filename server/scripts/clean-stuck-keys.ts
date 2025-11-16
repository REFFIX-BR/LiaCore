import { redisConnection } from '../lib/redis-config';

const blockedKeys = [
  '3205d5f1-12fe-4c8f-9e0d-c4239b0a88f0', // Gabriele Bello - primeira chave
  'a6d3fa35-0e99-4239-a1ed-cb4cef9c1ed8', // Gabriele Bello - segunda chave
];

async function cleanStuckKeys() {
  console.log('🧹 Limpando chaves de idempotência antigas que estão bloqueando recovery...\n');
  
  if (!redisConnection) {
    console.error('❌ Redis não conectado!');
    process.exit(1);
  }

  for (const key of blockedKeys) {
    const fullKey = `idempotency:${key}`;
    console.log(`Verificando: ${fullKey}`);
    
    const ttl = await redisConnection.ttl(fullKey);
    
    if (ttl > 0) {
      console.log(`  TTL restante: ${ttl}s (${Math.floor(ttl/3600)}h ${Math.floor((ttl%3600)/60)}min)`);
      
      const deleted = await redisConnection.del(fullKey);
      
      if (deleted) {
        console.log(`  ✅ Deletada com sucesso!\n`);
      } else {
        console.log(`  ⚠️  Falha ao deletar\n`);
      }
    } else if (ttl === -2) {
      console.log(`  ⚠️  Chave não existe\n`);
    } else if (ttl === -1) {
      console.log(`  ⚠️  Chave existe mas sem TTL (permanente)\n`);
      const deleted = await redisConnection.del(fullKey);
      if (deleted) {
        console.log(`  ✅ Deletada com sucesso!\n`);
      }
    }
  }

  console.log('✅ Limpeza completa! Recovery vai reprocessar nas próximas verificações (2 min).');
  
  await redisConnection.quit();
  process.exit(0);
}

cleanStuckKeys().catch((error) => {
  console.error('❌ Erro ao limpar chaves:', error);
  process.exit(1);
});
