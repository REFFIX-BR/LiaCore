import { voiceWhatsAppCollectionQueue } from '../server/lib/queue';
import { storage } from '../server/storage';

/**
 * Script para limpar fila de cobrança e preparar para novo início
 * Uso: tsx scripts/clean-and-restart-collection.ts
 */

async function cleanAndRestart() {
  console.log('🧹 Limpando fila voice-whatsapp-collection...');
  
  try {
    // 1. Limpar todos os jobs da fila
    await voiceWhatsAppCollectionQueue.drain(true); // Remove all jobs
    console.log('✅ Fila drenada (todos os jobs removidos)');
    
    // 2. Limpar jobs completados e falhados
    await voiceWhatsAppCollectionQueue.clean(0, 1000, 'completed');
    console.log('✅ Jobs completados removidos');
    
    await voiceWhatsAppCollectionQueue.clean(0, 1000, 'failed');
    console.log('✅ Jobs falhados removidos');
    
    // 3. Verificar status final
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      voiceWhatsAppCollectionQueue.getWaitingCount(),
      voiceWhatsAppCollectionQueue.getActiveCount(),
      voiceWhatsAppCollectionQueue.getDelayedCount(),
      voiceWhatsAppCollectionQueue.getCompletedCount(),
      voiceWhatsAppCollectionQueue.getFailedCount(),
    ]);
    
    console.log('\n📊 Status da fila após limpeza:');
    console.log(`  - Waiting: ${waiting}`);
    console.log(`  - Active: ${active}`);
    console.log(`  - Delayed: ${delayed}`);
    console.log(`  - Completed: ${completed}`);
    console.log(`  - Failed: ${failed}`);
    
    console.log('\n✅ Fila limpa e pronta para novos jobs!');
    console.log('💡 Próximo passo: enfileirar targets com scripts/enqueue-test-target.ts');
    
  } catch (error) {
    console.error('❌ Erro ao limpar fila:', error);
    process.exit(1);
  }
}

cleanAndRestart().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
