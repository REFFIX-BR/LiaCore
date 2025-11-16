import { redisConnection } from '../lib/redis-config';
import { messageQueue } from '../lib/queue';

async function forceRecovery() {
  console.log('🧹 Forçando recovery limpo de Gabriele Bello...\n');
  
  try {
    // 1. Limpar chave de idempotência antiga
    const oldKey = 'idempotency:a6d3fa35-0e99-4239-a1ed-cb4cef9c1ed8';
    console.log(`🗑️  Deletando chave antiga: ${oldKey}`);
    await redisConnection?.del(oldKey);
    console.log('✅ Chave deletada\n');
    
    // 2. Verificar jobs pendentes na fila
    console.log('🔍 Verificando jobs pendentes...');
    const waitingJobs = await messageQueue.getWaiting();
    console.log(`📊 Jobs aguardando: ${waitingJobs.length}`);
    
    // Limpar jobs relacionados a Gabriele Bello
    for (const job of waitingJobs) {
      const data = job.data as any;
      if (data.fromNumber === '5524988333041' || data.chatId === 'whatsapp_5524988333041') {
        console.log(`🗑️  Removendo job antigo: ${job.id}`);
        await job.remove();
      }
    }
    
    console.log('\n✅ Limpeza completa! Recovery vai criar novo job limpo nas próximas 2 min.\n');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  } finally {
    process.exit(0);
  }
}

forceRecovery();
