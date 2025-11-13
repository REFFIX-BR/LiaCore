import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { neon } from '@neondatabase/serverless';
import { QUEUE_NAMES, WhatsAppRetryJob } from '../server/lib/queue';

/**
 * Force retry of all PENDING WhatsApp messages
 */

async function forceRetryPending() {
  console.log('🔄 Forçando reenvio de mensagens PENDING...\n');
  
  const sql = neon(process.env.DATABASE_URL!);
  
  const retryQueue = new Queue<WhatsAppRetryJob>(QUEUE_NAMES.WHATSAPP_RETRY, {
    connection: redisConnection,
  });
  
  try {
    // Get all PENDING messages
    const pendingMessages = await sql(`
      SELECT 
        id,
        content,
        whatsapp_message_id,
        whatsapp_template_metadata,
        timestamp
      FROM messages
      WHERE whatsapp_status = 'PENDING'
      ORDER BY timestamp DESC
    `);
    
    console.log(`📊 Encontradas ${pendingMessages.length} mensagens PENDING\n`);
    
    if (pendingMessages.length === 0) {
      console.log('✅ Nenhuma mensagem PENDING para reenviar');
      await retryQueue.close();
      return;
    }
    
    let enqueued = 0;
    let skipped = 0;
    
    for (const message of pendingMessages) {
      const messageId = message.id;
      const templateMetadata = message.whatsapp_template_metadata;
      
      if (!templateMetadata) {
        console.log(`⚠️  Mensagem ${messageId.substring(0, 8)}... sem template metadata - pulando`);
        skipped++;
        continue;
      }
      
      try {
        // Add to retry queue (immediate processing, no delay)
        await retryQueue.add(
          `retry-${messageId}`,
          {
            messageId,
            attemptNumber: 1,
          },
          {
            jobId: `manual-retry-${messageId}`,
            removeOnComplete: true,
            removeOnFail: false,
          }
        );
        
        const contentPreview = message.content.substring(0, 30).replace(/\n/g, ' ');
        console.log(`✅ Enfileirada: ${messageId.substring(0, 8)}... (${contentPreview}...)`);
        enqueued++;
        
      } catch (error: any) {
        console.error(`❌ Erro ao enfileirar ${messageId}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`\n🎉 Concluído:`);
    console.log(`  ✅ Enfileiradas: ${enqueued}`);
    console.log(`  ⚠️  Puladas: ${skipped}`);
    console.log(`\n⏳ As mensagens serão reenviadas nos próximos segundos...`);
    console.log(`\n💡 Monitore os logs do worker para acompanhar o reenvio`);
    
  } catch (error: any) {
    console.error('❌ Erro ao processar mensagens PENDING:', error);
    throw error;
  } finally {
    await retryQueue.close();
  }
}

forceRetryPending().catch(console.error);
