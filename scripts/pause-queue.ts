import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function pauseQueue() {
  try {
    const queue = new Queue('voice-whatsapp-collection', {
      connection: redisConnection,
    });
    
    console.log('🔍 Verificando status da fila...');
    const isPausedBefore = await queue.isPaused();
    console.log(`   Fila pausada: ${isPausedBefore}`);
    
    if (!isPausedBefore) {
      console.log('\n⏸️  Pausando fila de cobranças...');
      await queue.pause();
      console.log('✅ Fila pausada com sucesso!');
    } else {
      console.log('\n✅ Fila já está pausada');
    }
    
    const isPausedAfter = await queue.isPaused();
    console.log(`\n📊 Status atual: ${isPausedAfter ? 'PAUSADA ⏸️' : 'ATIVA ▶️'}`);
    
    // Mostrar estatísticas
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
    console.log('\n📈 Estatísticas da fila:');
    console.log(`   Aguardando: ${counts.waiting}`);
    console.log(`   Em processamento: ${counts.active}`);
    console.log(`   Completados: ${counts.completed}`);
    console.log(`   Falhas: ${counts.failed}`);
    
    await queue.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao pausar fila:', error);
    process.exit(1);
  }
}

pauseQueue();
