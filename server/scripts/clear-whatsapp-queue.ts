import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../lib/queue';
import { redisConnection } from '../lib/redis-config';

async function clearWhatsAppQueue() {
  try {
    console.log('🧹 [Clear Queue] Limpando fila de WhatsApp pendente...');
    
    // Conectar à fila
    const whatsappQueue = new Queue(QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION, {
      connection: redisConnection,
    });
    
    // Obter estatísticas antes da limpeza
    const beforeStats = await whatsappQueue.getJobCounts();
    console.log('📊 [Clear Queue] Jobs antes da limpeza:', beforeStats);
    
    // Limpar todos os jobs pendentes (waiting, delayed, active)
    await whatsappQueue.drain(true); // true = remover jobs delayed também
    
    // Obter estatísticas depois da limpeza
    const afterStats = await whatsappQueue.getJobCounts();
    console.log('📊 [Clear Queue] Jobs após limpeza:', afterStats);
    
    console.log('✅ [Clear Queue] Fila limpa com sucesso!');
    console.log(`   - ${beforeStats.waiting} jobs waiting removidos`);
    console.log(`   - ${beforeStats.delayed} jobs delayed removidos`);
    console.log(`   - ${beforeStats.active} jobs active removidos`);
    
    await whatsappQueue.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ [Clear Queue] Erro ao limpar fila:', error);
    process.exit(1);
  }
}

clearWhatsAppQueue();
