/**
 * NUCLEAR OPTION - Remove ABSOLUTAMENTE TUDO da fila WhatsApp
 */

import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function nukeQueue() {
  console.log('💣 [NUKE] Removendo ABSOLUTAMENTE TUDO da fila WhatsApp...\n');

  const queue = new Queue('voice-whatsapp-collection', {
    connection: redisConnection,
  });

  try {
    // Stats iniciais
    const stats = {
      waiting: await queue.getWaitingCount(),
      active: await queue.getActiveCount(),
      delayed: await queue.getDelayedCount(),
      failed: await queue.getFailedCount(),
      completed: await queue.getCompletedCount(),
    };

    console.log('📊 [Before] Estado da fila:');
    console.log(`   Waiting: ${stats.waiting}`);
    console.log(`   Active: ${stats.active}`);
    console.log(`   Delayed: ${stats.delayed}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Completed: ${stats.completed}\n`);

    // OBLITERAR TUDO
    console.log('💣 [Nuking] Obliterando todos os jobs...');
    
    // Obliterate delayed jobs (the stubborn ones)
    await queue.obliterate({ force: true });
    
    console.log('✅ [Nuked] Queue obliterated!\n');

    // Stats finais
    const finalStats = {
      waiting: await queue.getWaitingCount(),
      active: await queue.getActiveCount(),
      delayed: await queue.getDelayedCount(),
      failed: await queue.getFailedCount(),
      completed: await queue.getCompletedCount(),
    };

    console.log('📊 [After] Estado da fila:');
    console.log(`   Waiting: ${finalStats.waiting}`);
    console.log(`   Active: ${finalStats.active}`);
    console.log(`   Delayed: ${finalStats.delayed}`);
    console.log(`   Failed: ${finalStats.failed}`);
    console.log(`   Completed: ${finalStats.completed}\n`);

    if (finalStats.delayed === 0 && finalStats.waiting === 0 && finalStats.active === 0) {
      console.log('✅ [SUCCESS] Fila COMPLETAMENTE VAZIA!');
    } else {
      console.warn('⚠️  [WARNING] Ainda há jobs restantes - verifique manualmente');
    }

    await queue.close();
  } catch (error) {
    console.error('❌ [ERROR]:', error);
    throw error;
  }
}

nukeQueue()
  .then(() => {
    console.log('\n✅ Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
