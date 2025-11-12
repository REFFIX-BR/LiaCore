/**
 * Script para limpar jobs com números de telefone inválidos das filas
 * 
 * Remove jobs antigos criados antes da correção de normalização de telefones
 * 
 * Uso: tsx scripts/clean-invalid-queue-jobs.ts
 */

import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { isPhoneNormalized } from '../server/lib/phone-utils';

async function cleanInvalidQueueJobs() {
  console.log('🧹 Limpando jobs com números inválidos das filas...\n');

  const queues = [
    'voice-whatsapp-collection',
    'voice-scheduling',
    'voice-dialer',
    'voice-post-call',
    'voice-promise-monitor',
  ];

  let totalInvalid = 0;
  let totalCleaned = 0;

  for (const queueName of queues) {
    try {
      console.log(`\n📋 Verificando fila: ${queueName}`);
      const queue = new Queue(queueName, { connection: redisConnection });

      // Verificar jobs em diferentes estados
      const states = ['waiting', 'delayed', 'active', 'failed'] as const;
      
      for (const state of states) {
        let jobs;
        
        switch (state) {
          case 'waiting':
            jobs = await queue.getWaiting();
            break;
          case 'delayed':
            jobs = await queue.getDelayed();
            break;
          case 'active':
            jobs = await queue.getActive();
            break;
          case 'failed':
            jobs = await queue.getFailed();
            break;
        }

        if (jobs.length === 0) continue;

        console.log(`   ${state}: ${jobs.length} jobs`);

        let invalidCount = 0;
        
        for (const job of jobs) {
          let shouldRemove = false;
          let reason = '';

          // Verificar se job tem phoneNumber
          if (job.data.phoneNumber) {
            const phoneNumber = job.data.phoneNumber;
            
            if (!isPhoneNormalized(phoneNumber)) {
              shouldRemove = true;
              reason = `Número inválido: ${phoneNumber}`;
            }
          }

          // Limpar jobs failed muito antigos (mais de 24h)
          if (state === 'failed' && job.timestamp) {
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            if (job.timestamp < oneDayAgo) {
              shouldRemove = true;
              reason = 'Job failed muito antigo (>24h)';
            }
          }

          if (shouldRemove) {
            console.log(`      ❌ Removendo job ${job.id}: ${reason}`);
            await job.remove();
            invalidCount++;
            totalInvalid++;
          }
        }

        if (invalidCount > 0) {
          console.log(`   ✅ Removidos ${invalidCount} jobs ${state}`);
          totalCleaned += invalidCount;
        }
      }

      await queue.close();

    } catch (error: any) {
      console.error(`❌ Erro ao processar fila ${queueName}:`, error.message);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Resultado da Limpeza');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🗑️  Total de jobs removidos: ${totalCleaned}`);
  console.log(`❌ Jobs com números inválidos: ${totalInvalid}`);
  console.log('═══════════════════════════════════════════════════\n');
}

cleanInvalidQueueJobs()
  .then(() => {
    console.log('✅ Limpeza completa!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
