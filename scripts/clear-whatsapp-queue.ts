import { voiceWhatsAppCollectionQueue } from '../server/lib/queue';

async function clearQueue() {
  console.log('🧹 [Clear Queue] Limpando fila de WhatsApp...');
  
  try {
    // Obter estatísticas antes
    const waiting = await voiceWhatsAppCollectionQueue.getWaitingCount();
    const active = await voiceWhatsAppCollectionQueue.getActiveCount();
    const delayed = await voiceWhatsAppCollectionQueue.getDelayedCount();
    
    console.log(`📊 [Clear Queue] Jobs na fila antes:`);
    console.log(`   - Aguardando: ${waiting}`);
    console.log(`   - Ativos: ${active}`);
    console.log(`   - Agendados: ${delayed}`);
    console.log(`   - Total: ${waiting + active + delayed}`);
    
    // Drenar a fila (remove todos os jobs aguardando e agendados)
    await voiceWhatsAppCollectionQueue.drain(true);
    
    console.log('✅ [Clear Queue] Fila limpa com sucesso!');
    
    // Estatísticas depois
    const waitingAfter = await voiceWhatsAppCollectionQueue.getWaitingCount();
    const activeAfter = await voiceWhatsAppCollectionQueue.getActiveCount();
    const delayedAfter = await voiceWhatsAppCollectionQueue.getDelayedCount();
    
    console.log(`📊 [Clear Queue] Jobs na fila depois:`);
    console.log(`   - Aguardando: ${waitingAfter}`);
    console.log(`   - Ativos: ${activeAfter}`);
    console.log(`   - Agendados: ${delayedAfter}`);
    console.log(`   - Total: ${waitingAfter + activeAfter + delayedAfter}`);
    
    console.log('\n🎉 [Clear Queue] Processo concluído!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ [Clear Queue] Erro:', error.message);
    process.exit(1);
  }
}

clearQueue();
