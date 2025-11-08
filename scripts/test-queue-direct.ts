import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: { rejectUnauthorized: false }
});

const queue = new Queue('message-processing', { connection });

async function test() {
  console.log('🧪 Testando fila message-processing...');
  
  const job = await queue.add('test-job', {
    chatId: 'test_123',
    conversationId: 'test-conv-123',
    message: 'Teste direto',
    fromNumber: '123456789',
    hasImage: false,
    clientName: 'Test Client',
    evolutionInstance: 'Principal'
  });
  
  console.log(`✅ Job ${job.id} adicionado à fila`);
  
  setTimeout(async () => {
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    
    console.log(`\n📊 Status da fila:`);
    console.log(`  Aguardando: ${waiting.length}`);
    console.log(`  Ativos: ${active.length}`);
    console.log(`  Completos: ${completed.length}`);
    console.log(`  Falhados: ${failed.length}`);
    
    await connection.quit();
    process.exit(0);
  }, 5000);
}

test().catch(console.error);
