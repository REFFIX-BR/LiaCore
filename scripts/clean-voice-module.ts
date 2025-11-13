import { Queue } from 'bullmq';
import { db } from '../server/db';
import { voiceCampaigns, voiceCampaignTargets, voicePromises, crmSyncConfigs } from '../shared/schema';
import { redisConnection } from '../server/lib/redis-config';

const QUEUE_NAME = 'voice-whatsapp-collection';

async function cleanVoiceModule() {
  console.log('🧹 Iniciando limpeza completa do módulo de cobranças...\n');

  try {
    // 1. Limpar fila BullMQ
    console.log('📋 ETAPA 1: Limpando fila voice-whatsapp-collection');
    const queue = new Queue(QUEUE_NAME, { connection: redisConnection });
    
    const counts = await queue.getJobCounts();
    console.log('  Status atual da fila:', counts);
    
    const isPaused = await queue.isPaused();
    console.log('  Fila pausada?', isPaused);
    
    // Retomar fila se estiver pausada
    if (isPaused) {
      await queue.resume();
      console.log('  ✅ Fila retomada');
    }
    
    // Limpar todos os jobs
    await queue.obliterate({ force: true });
    console.log('  ✅ Todos os jobs foram removidos\n');
    
    // 2. Deletar promessas de pagamento
    console.log('📋 ETAPA 2: Deletando promessas de pagamento');
    const deletedPromises = await db.delete(voicePromises);
    console.log(`  ✅ ${deletedPromises.rowCount || 0} promessas deletadas\n`);
    
    // 3. Deletar alvos de campanha
    console.log('📋 ETAPA 3: Deletando alvos de campanhas');
    const deletedTargets = await db.delete(voiceCampaignTargets);
    console.log(`  ✅ ${deletedTargets.rowCount || 0} alvos deletados\n`);
    
    // 4. Deletar configurações de sincronização CRM
    console.log('📋 ETAPA 4: Deletando configurações de sincronização CRM');
    const deletedConfigs = await db.delete(crmSyncConfigs);
    console.log(`  ✅ ${deletedConfigs.rowCount || 0} configurações deletadas\n`);
    
    // 5. Deletar campanhas
    console.log('📋 ETAPA 5: Deletando campanhas');
    const deletedCampaigns = await db.delete(voiceCampaigns);
    console.log(`  ✅ ${deletedCampaigns.rowCount || 0} campanhas deletadas\n`);
    
    console.log('✅ Limpeza completa do módulo de cobranças finalizada com sucesso!');
    console.log('\n📊 Resumo:');
    console.log(`  - Promessas deletadas: ${deletedPromises.rowCount || 0}`);
    console.log(`  - Alvos deletados: ${deletedTargets.rowCount || 0}`);
    console.log(`  - Configurações CRM deletadas: ${deletedConfigs.rowCount || 0}`);
    console.log(`  - Campanhas deletadas: ${deletedCampaigns.rowCount || 0}`);
    console.log(`  - Fila limpa: ${QUEUE_NAME}`);
    
    await queue.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erro durante a limpeza:', error);
    process.exit(1);
  }
}

cleanVoiceModule();
