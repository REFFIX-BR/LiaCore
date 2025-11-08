import { messageQueue } from '../server/lib/queue';

async function checkStatus() {
  console.log('🔍 Verificando status da fila...\n');
  
  const waiting = await messageQueue.getWaiting();
  const active = await messageQueue.getActive();
  const completed = await messageQueue.getCompleted();
  const failed = await messageQueue.getFailed();
  
  console.log(`⏳ Jobs aguardando: ${waiting.length}`);
  console.log(`⚡ Jobs ativos: ${active.length}`);
  console.log(`✅ Jobs completos (últimos): ${completed.length}`);
  console.log(`❌ Jobs falhados: ${failed.length}\n`);
  
  if (waiting.length > 0) {
    console.log('📋 Jobs aguardando:');
    for (const job of waiting.slice(0, 3)) {
      console.log(`  - Job ${job.id}: ${job.data.conversationId} (${job.data.chatId})`);
    }
  }
  
  if (active.length > 0) {
    console.log('\n⚡ Jobs ativos:');
    for (const job of active) {
      console.log(`  - Job ${job.id}: ${job.data.conversationId} (processando...)`);
    }
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Jobs falhados recentes:');
    for (const job of failed.slice(0, 3)) {
      console.log(`  - Job ${job.id}: ${job.failedReason}`);
    }
  }
  
  await messageQueue.close();
}

checkStatus().catch(console.error);
