import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { storage } from '../server/storage';

console.log('🧹 Limpando jobs falhados da fila WhatsApp...\n');

async function main() {
  const queue = new Queue('voice-whatsapp-collection', { connection: redisConnection });
  
  // Get failed jobs
  const failedJobs = await queue.getFailed(0, 100);
  console.log(`📊 Encontrados ${failedJobs.length} jobs falhados\n`);
  
  if (failedJobs.length === 0) {
    console.log('✅ Nenhum job falhado encontrado!');
    return;
  }
  
  // Clean failed jobs
  console.log('🔄 Removendo jobs falhados...');
  for (const job of failedJobs) {
    await job.remove();
    console.log(`   ✅ Removido: ${job.id}`);
  }
  
  console.log(`\n✅ ${failedJobs.length} jobs falhados removidos!`);
  
  // Re-enqueue the 2 specific targets
  console.log('\n🔄 Re-enfileirando os 2 targets que falharam...');
  
  const targetIds = [
    '9ca4962a-daa8-415c-9edf-5ee288ba48aa', // MANUELA
    '7d5fdcba-90d7-4cb9-97b3-c6d083258d01'  // GABRIEL
  ];
  
  for (const targetId of targetIds) {
    const target = await storage.getVoiceCampaignTarget(targetId);
    
    if (!target) {
      console.warn(`   ⚠️ Target ${targetId} não encontrado`);
      continue;
    }
    
    console.log(`   📤 Re-enfileirando: ${target.debtorName} (${target.phoneNumber})`);
    
    // Reset target state
    await storage.updateVoiceCampaignTarget(targetId, {
      state: 'pending',
      lastAttemptAt: null,
    });
    
    // Re-enqueue
    const { addVoiceWhatsAppCollectionToQueue } = await import('../server/lib/queue');
    await addVoiceWhatsAppCollectionToQueue({
      targetId: target.id,
      campaignId: target.campaignId,
      phoneNumber: target.phoneNumber,
      clientName: target.debtorName,
      clientDocument: target.debtorDocument || '',
      debtAmount: target.debtAmount || 0,
      attemptNumber: 1,
    });
    
    console.log(`   ✅ Re-enfileirado com sucesso!`);
  }
  
  console.log('\n✅ Limpeza concluída!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
