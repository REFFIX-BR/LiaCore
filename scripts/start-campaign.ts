import { storage } from '../server/storage';
import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

/**
 * Script para iniciar campanha de cobrança
 * Enfileira targets pendentes para envio via WhatsApp
 * 
 * Uso: 
 *   tsx scripts/start-campaign.ts <campaignId> [batchSize]
 * 
 * Exemplos:
 *   tsx scripts/start-campaign.ts ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2 10    # Envia 10 mensagens
 *   tsx scripts/start-campaign.ts ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2 100   # Envia 100 mensagens
 *   tsx scripts/start-campaign.ts ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2      # Envia TODOS (cuidado!)
 */

async function startCampaign() {
  const campaignId = process.argv[2];
  const batchSize = process.argv[3] ? parseInt(process.argv[3]) : undefined;
  
  if (!campaignId) {
    console.error('❌ Usage: tsx scripts/start-campaign.ts <campaignId> [batchSize]');
    console.error('');
    console.error('Exemplos:');
    console.error('  tsx scripts/start-campaign.ts ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2 10');
    console.error('  tsx scripts/start-campaign.ts ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2 100');
    process.exit(1);
  }
  
  console.log(`🚀 Iniciando campanha ${campaignId}...`);
  if (batchSize) {
    console.log(`📊 Limite: ${batchSize} mensagens`);
  } else {
    console.log(`⚠️  SEM LIMITE - enviará TODOS os targets pendentes!`);
  }
  
  try {
    // 1. Buscar campanha
    const campaign = await storage.getVoiceCampaign(campaignId);
    
    if (!campaign) {
      console.error(`❌ Campanha não encontrada: ${campaignId}`);
      process.exit(1);
    }
    
    console.log(`✅ Campanha encontrada: ${campaign.name}`);
    console.log(`   Total de targets: ${campaign.totalTargets}`);
    
    // 2. Buscar targets pendentes
    const { db } = await import('../server/db');
    const { voiceCampaignTargets } = await import('../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const pendingTargets = await db.query.voiceCampaignTargets.findMany({
      where: and(
        eq(voiceCampaignTargets.campaignId, campaignId),
        eq(voiceCampaignTargets.state, 'pending')
      ),
      limit: batchSize || 10000, // Máximo 10k se não especificado
    });
    
    if (pendingTargets.length === 0) {
      console.log('✅ Nenhum target pendente encontrado!');
      process.exit(0);
    }
    
    console.log(`📋 Encontrados ${pendingTargets.length} targets pendentes`);
    
    // 3. Confirmar se não tiver limite
    if (!batchSize && pendingTargets.length > 100) {
      console.log('');
      console.log(`⚠️  ATENÇÃO: Você está prestes a enfileirar ${pendingTargets.length} mensagens!`);
      console.log(`⚠️  Isso pode gerar custos significativos e consumir sua cota de mensagens.`);
      console.log('');
      console.log('💡 Dica: Use um batchSize menor para testar primeiro:');
      console.log(`   tsx scripts/start-campaign.ts ${campaignId} 10`);
      console.log('');
      process.exit(1);
    }
    
    // 4. Enfileirar targets
    console.log(`\n📤 Enfileirando ${pendingTargets.length} targets...`);
    
    let enqueuedCount = 0;
    let errorCount = 0;
    
    for (const target of pendingTargets) {
      try {
        // Delay aleatório entre 5-10 minutos para distribuir carga
        const randomDelay = Math.floor(Math.random() * (10 * 60 * 1000 - 5 * 60 * 1000)) + 5 * 60 * 1000;
        
        await addVoiceWhatsAppCollectionToQueue({
          targetId: target.id,
          campaignId: target.campaignId,
          phoneNumber: target.phoneNumber,
          clientName: target.debtorName,
          clientDocument: target.debtorDocument || 'N/A',
          debtAmount: target.debtAmount || 0,
          attemptNumber: 1,
        }, randomDelay);
        
        enqueuedCount++;
        
        // Log a cada 10 targets
        if (enqueuedCount % 10 === 0) {
          console.log(`   ✅ Enfileirados: ${enqueuedCount}/${pendingTargets.length}`);
        }
      } catch (error) {
        console.error(`   ❌ Erro ao enfileirar ${target.debtorName}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n✅ Campanha iniciada com sucesso!`);
    console.log(`   📊 Enfileirados: ${enqueuedCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    console.log(`   ⏱️  Delay: 5-10 minutos por mensagem (distribuição de carga)`);
    console.log('');
    console.log('💡 Próximos passos:');
    console.log('   1. Mensagens serão enviadas gradualmente nos próximos minutos');
    console.log('   2. Sistema de retry automático monitora mensagens a cada 10min');
    console.log('   3. Use scripts/check-queue-status.ts para ver o progresso');
    
  } catch (error) {
    console.error('❌ Erro ao iniciar campanha:', error);
    process.exit(1);
  }
}

startCampaign().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
