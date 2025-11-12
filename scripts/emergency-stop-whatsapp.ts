import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { storage } from '../server/storage';

/**
 * SCRIPT DE EMERGÊNCIA - Para todos disparos WhatsApp de cobrança
 * 1. Limpa fila voice-whatsapp-collection
 * 2. Pausa campanha no banco
 * 3. Mostra estatísticas
 */
async function emergencyStop() {
  console.log('🚨 [EMERGENCY STOP] Iniciando parada de emergência...\n');
  
  try {
    // 1. Criar instância da fila WhatsApp
    const whatsappQueue = new Queue('voice-whatsapp-collection', {
      connection: redisConnection,
    });
    
    console.log('📊 [Stats] Verificando fila WhatsApp...');
    
    // Obter contagens
    const waiting = await whatsappQueue.getWaitingCount();
    const active = await whatsappQueue.getActiveCount();
    const delayed = await whatsappQueue.getDelayedCount();
    const failed = await whatsappQueue.getFailedCount();
    
    console.log(`   ⏳ Aguardando: ${waiting}`);
    console.log(`   🔄 Processando: ${active}`);
    console.log(`   ⏰ Agendados: ${delayed}`);
    console.log(`   ❌ Falhados: ${failed}\n`);
    
    // 2. Limpar TODOS os jobs da fila
    console.log('🧹 [Cleanup] Removendo todos os jobs...');
    
    await whatsappQueue.drain(); // Remove waiting e delayed
    await whatsappQueue.clean(0, 1000, 'completed'); // Remove completed
    await whatsappQueue.clean(0, 1000, 'failed'); // Remove failed
    
    console.log('✅ [Cleanup] Fila limpa!\n');
    
    // 3. Pausar campanha no banco
    console.log('🔴 [Campaign] Pausando campanha...');
    const campaignId = '424364ec-2721-49e3-9edb-98ff68e42ca0';
    
    await storage.db.execute(`
      UPDATE voice_campaigns
      SET status = 'paused'
      WHERE id = '${campaignId}'
    `);
    
    console.log('✅ [Campaign] Campanha pausada!\n');
    
    // 4. Verificar novamente
    console.log('📊 [Final Stats] Verificando fila após limpeza...');
    const finalWaiting = await whatsappQueue.getWaitingCount();
    const finalActive = await whatsappQueue.getActiveCount();
    const finalDelayed = await whatsappQueue.getDelayedCount();
    
    console.log(`   ⏳ Aguardando: ${finalWaiting}`);
    console.log(`   🔄 Processando: ${finalActive}`);
    console.log(`   ⏰ Agendados: ${finalDelayed}\n`);
    
    // 5. Fechar conexão
    await whatsappQueue.close();
    
    console.log('✅ [SUCCESS] Parada de emergência concluída!');
    console.log('🔴 Todos disparos WhatsApp foram interrompidos.\n');
    
  } catch (error) {
    console.error('❌ [ERROR] Erro na parada de emergência:', error);
    throw error;
  }
}

// Executar
emergencyStop()
  .then(() => {
    console.log('✅ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
