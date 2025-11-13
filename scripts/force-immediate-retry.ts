import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { neon } from '@neondatabase/serverless';
import { QUEUE_NAMES, WhatsAppRetryJob } from '../server/lib/queue';

/**
 * Force IMMEDIATE retry of all PENDING WhatsApp messages (ignoring cooldown)
 * by temporarily clearing the retry timestamp
 */

async function forceImmediateRetry() {
  console.log('🚀 Forçando reenvio IMEDIATO de mensagens PENDING (ignorando cooldown)...\n');
  
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
        whatsapp_retry_count,
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
    
    // Clear last retry timestamp to bypass cooldown
    console.log('🔓 Resetando timestamps de retry para bypass do cooldown...');
    await sql(`
      UPDATE messages
      SET whatsapp_last_retry_at = NULL
      WHERE whatsapp_status = 'PENDING'
    `);
    console.log('✅ Timestamps resetados\n');
    
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
        const retryCount = message.whatsapp_retry_count || 0;
        
        // Add to retry queue (immediate processing)
        await retryQueue.add(
          `retry-${messageId}`,
          {
            messageId,
            attemptNumber: retryCount + 1,
          },
          {
            jobId: `force-retry-${messageId}-${Date.now()}`,
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
    console.log(`\n⏳ As mensagens serão reenviadas IMEDIATAMENTE...`);
    console.log(`\n💡 Monitore os logs do worker para acompanhar o reenvio`);
    
  } catch (error: any) {
    console.error('❌ Erro ao processar mensagens PENDING:', error);
    throw error;
  } finally {
    await retryQueue.close();
  }
}

forceImmediateRetry().catch(console.error);
