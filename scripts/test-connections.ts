import { db } from '../server/db';
import Redis from 'ioredis';
import { sql } from 'drizzle-orm';

async function testConnections() {
  console.log('🧪 Testando conexões com serviços...\n');

  let allOk = true;

  // 1. PostgreSQL
  console.log('📊 PostgreSQL:');
  try {
    const result = await db.execute(sql`SELECT version() as version`);
    const version = (result.rows[0] as any)?.version;
    console.log(`  ✅ Conectado!`);
    console.log(`  📌 Versão: ${version?.substring(0, 50)}...`);
    
    // Testar contagem de tabelas
    const tables = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tableCount = (tables.rows[0] as any)?.count;
    console.log(`  📌 Tabelas encontradas: ${tableCount}`);
  } catch (err: any) {
    console.error('  ❌ Falhou:', err.message);
    allOk = false;
  }

  // 2. Redis
  console.log('\n🔴 Redis:');
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
    });
    
    await redis.connect();
    
    // Testar ping
    const pingResult = await redis.ping();
    console.log(`  ✅ Conectado! (PING: ${pingResult})`);
    
    // Testar set/get
    await redis.set('test_key', 'test_value', 'EX', 10);
    const value = await redis.get('test_key');
    
    if (value === 'test_value') {
      console.log('  ✅ SET/GET funcionando');
    }
    
    // Info
    const info = await redis.info('server');
    const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1];
    console.log(`  📌 Versão: ${redisVersion}`);
    
    await redis.del('test_key');
    await redis.quit();
  } catch (err: any) {
    console.error('  ❌ Falhou:', err.message);
    allOk = false;
  }

  // 3. Upstash Vector
  console.log('\n🎯 Upstash Vector:');
  try {
    const vectorUrl = process.env.UPSTASH_VECTOR_URL;
    const vectorToken = process.env.UPSTASH_VECTOR_TOKEN;
    
    if (vectorUrl && vectorToken) {
      console.log('  ✅ Configurado');
      console.log(`  📌 URL: ${vectorUrl.substring(0, 40)}...`);
    } else {
      console.log('  ⚠️  Não configurado (opcional para desenvolvimento)');
    }
  } catch (err: any) {
    console.error('  ❌ Erro:', err.message);
  }

  // 4. OpenAI
  console.log('\n🤖 OpenAI:');
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (apiKey) {
      console.log('  ✅ API Key configurada');
      console.log(`  📌 Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
    } else {
      console.log('  ⚠️  API Key não configurada');
      allOk = false;
    }
  } catch (err: any) {
    console.error('  ❌ Erro:', err.message);
  }

  // Resultado final
  console.log('\n========================================');
  if (allOk) {
    console.log('✅ Todos os serviços essenciais OK!');
    console.log('🚀 Você pode iniciar o desenvolvimento.');
  } else {
    console.log('⚠️  Alguns serviços apresentaram problemas.');
    console.log('📖 Consulte GUIA_DESENVOLVIMENTO_LOCAL.md');
  }
  console.log('========================================\n');

  process.exit(allOk ? 0 : 1);
}

testConnections().catch(err => {
  console.error('❌ Erro fatal nos testes:', err);
  process.exit(1);
});
