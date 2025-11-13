import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { QUEUE_NAMES, VoiceWhatsAppCollectionJob } from '../server/lib/queue';
import { neon } from '@neondatabase/serverless';

async function sendImmediateTest() {
  console.log('📤 Enviando 1 mensagem de teste IMEDIATA (sem delay)...\n');
  
  const sql = neon(process.env.DATABASE_URL!);
  const queue = new Queue<VoiceWhatsAppCollectionJob>(QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION, {
    connection: redisConnection,
  });
  
  try {
    // Get 1 pending target
    const targets = await sql`
      SELECT id, phone_number, debtor_name, debtor_document, debt_amount
      FROM voice_campaign_targets
      WHERE campaign_id = 'ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2'
        AND state = 'pending'
        AND attempt_count = 0
      LIMIT 1
    `;
    
    if (targets.length === 0) {
      console.log('❌ Nenhum target pendente disponível');
      await queue.close();
      return;
    }
    
    const target = targets[0];
    console.log(`✅ Target encontrado: ${target.debtor_name} (${target.phone_number})`);
    
    // Add to queue with NO delay (immediate processing)
    await queue.add(
      'immediate-test',
      {
        targetId: target.id,
        campaignId: 'ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2',
        phoneNumber: target.phone_number,
        clientName: target.debtor_name,
        clientDocument: target.debtor_document || 'N/A',
        debtAmount: target.debt_amount || 0,
        attemptNumber: 1,
      },
      {
        delay: 0, // IMMEDIATE - no delay!
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    
    console.log(`\n✅ Mensagem enfileirada para processamento IMEDIATO!`);
    console.log(`\n⏳ Aguarde ~10 segundos e verifique:`);
    console.log(`   1. Logs do worker para ver envio`);
    console.log(`   2. Logs de webhook para confirmar recebimento`);
    console.log(`   3. Status da mensagem no banco`);
    
  } finally {
    await queue.close();
  }
}

sendImmediateTest().catch(console.error);
