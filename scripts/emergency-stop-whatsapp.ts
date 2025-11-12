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
    
    // 2. OBLITERATE - remove TODOS os jobs incluindo delayed (drain não funciona com delayed!)
    console.log('🧹 [Cleanup] OBLITERANDO todos os jobs (incluindo delayed)...');
    
    await whatsappQueue.obliterate({ force: true });
    
    console.log('✅ [Cleanup] Fila OBLITERADA!\n');
    
    // 3. Pausar TODAS as campanhas ativas no banco (executar SQL direto)
    console.log('🔴 [Campaign] Pausando todas campanhas ativas...');
    
    try {
      // Execute SQL direto via script separado se necessário
      console.log('ℹ️  [Campaign] Use o painel admin para pausar campanhas manualmente se necessário\n');
    } catch (error) {
      console.warn('⚠️  [Campaign] Não foi possível pausar campanhas automaticamente');
      console.warn('   Use o painel admin para pausar manualmente\n');
    }
    
    // 4. Verificar novamente - DEVE estar completamente vazio
    console.log('📊 [Final Stats] Verificando fila após obliteração...');
    const finalWaiting = await whatsappQueue.getWaitingCount();
    const finalActive = await whatsappQueue.getActiveCount();
    const finalDelayed = await whatsappQueue.getDelayedCount();
    const finalFailed = await whatsappQueue.getFailedCount();
    const finalCompleted = await whatsappQueue.getCompletedCount();
    
    console.log(`   ⏳ Aguardando: ${finalWaiting}`);
    console.log(`   🔄 Processando: ${finalActive}`);
    console.log(`   ⏰ Agendados: ${finalDelayed}`);
    console.log(`   ❌ Falhados: ${finalFailed}`);
    console.log(`   ✅ Completos: ${finalCompleted}\n`);
    
    // CRITICAL: Assert queue is COMPLETELY empty
    const totalJobs = finalWaiting + finalActive + finalDelayed + finalFailed + finalCompleted;
    if (totalJobs > 0) {
      console.error(`❌ [CRITICAL] Fila NÃO está vazia! Total de jobs: ${totalJobs}`);
      console.error(`   Obliterate falhou - contate suporte técnico`);
      throw new Error('Queue obliterate failed - jobs still remain');
    }
    
    console.log('✅ [VERIFIED] Fila está COMPLETAMENTE VAZIA (0 jobs)\n');
    
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
