import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, WhatsAppRetryJob } from '../../../lib/queue';
import { storage } from '../../../storage';
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '../../../lib/whatsapp';
import { whatsappRateLimiter } from '../../../lib/whatsapp-rate-limiter';

console.log('🔄 [WhatsApp Retry] Worker starting...');

/**
 * Calculate backoff delay based on retry attempt
 * Backoff: 30min → 60min → 120min (with jitter)
 */
function calculateBackoffMinutes(attemptNumber: number): number {
  const baseBackoffs = {
    1: 30,   // First retry: 30 minutes
    2: 60,   // Second retry: 60 minutes
    3: 120,  // Third retry: 120 minutes
  };
  
  const baseMinutes = baseBackoffs[attemptNumber as keyof typeof baseBackoffs] || 120;
  
  // Add jitter ±10%
  const jitter = (Math.random() * 0.2 - 0.1) * baseMinutes;
  return Math.round(baseMinutes + jitter);
}

/**
 * Retry Worker - Reprocessa mensagens WhatsApp travadas em PENDING
 */
const worker = new Worker<WhatsAppRetryJob>(
  QUEUE_NAMES.WHATSAPP_RETRY,
  async (job: Job<WhatsAppRetryJob>) => {
    const { messageId, attemptNumber, originalTargetId } = job.data;
    
    console.log(`🔄 [WhatsApp Retry] Processing retry for message ${messageId} (attempt ${attemptNumber})`);
    
    try {
      // 1. Buscar mensagem no banco
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        console.error(`❌ [WhatsApp Retry] Message ${messageId} not found`);
        return { success: false, reason: 'message_not_found' };
      }
      
      // 2. Verificar status atual
      if (message.whatsappStatus !== 'PENDING') {
        console.log(`✅ [WhatsApp Retry] Message ${messageId} no longer PENDING (status: ${message.whatsappStatus})`);
        return { success: true, reason: 'status_changed' };
      }
      
      // 3. Verificar retry count
      const currentRetryCount = message.whatsappRetryCount || 0;
      if (currentRetryCount >= 3) {
        console.warn(`⚠️  [WhatsApp Retry] Message ${messageId} reached max retries (${currentRetryCount})`);
        
        // Marcar como ERROR após 3 tentativas
        await storage.updateMessage(messageId, {
          whatsappStatus: 'ERROR',
          whatsappStatusUpdatedAt: new Date(),
        });
        
        // Atualizar target se existir
        if (originalTargetId) {
          await storage.updateVoiceCampaignTarget(originalTargetId, {
            lastWhatsappStatus: 'ERROR',
            lastWhatsappStatusAt: new Date(),
          });
        }
        
        return { success: false, reason: 'max_retries_reached' };
      }
      
      // 4. Verificar cooldown (backoff não expirado ainda)
      if (message.whatsappLastRetryAt) {
        const backoffMinutes = calculateBackoffMinutes(currentRetryCount);
        const nextRetryTime = new Date(message.whatsappLastRetryAt.getTime() + backoffMinutes * 60 * 1000);
        
        if (new Date() < nextRetryTime) {
          console.log(`⏰ [WhatsApp Retry] Message ${messageId} still in cooldown (next retry: ${nextRetryTime.toISOString()})`);
          return { success: false, reason: 'cooldown_active' };
        }
      }
      
      console.log(`🎯 [WhatsApp Retry] Attempting to resend message ${messageId} (retry ${currentRetryCount + 1}/3)`);
      
      // 5. Adquirir token do rate limiter
      console.log('🔑 [WhatsApp Retry] Acquiring rate limiter token...');
      const tokenAcquired = await whatsappRateLimiter.waitForToken(30000); // 30s timeout
      
      if (!tokenAcquired) {
        console.warn('⚠️  [WhatsApp Retry] Failed to acquire rate limiter token - requeueing');
        // Requeue job para tentar depois
        throw new Error('Rate limit token timeout - will retry');
      }
      
      console.log('✅ [WhatsApp Retry] Rate limiter token acquired');
      
      // 6. Reenviar mensagem
      let sendResult;
      
      // Determinar se é mensagem de template ou texto simples
      if (message.conversationId && message.content) {
        // Buscar conversa para obter evolutionInstance
        const conversation = await storage.getConversation(message.conversationId);
        const evolutionInstance = conversation?.evolutionInstance || 'Principal';
        
        // Extrair número do chatId (remover prefixo "whatsapp_")
        const chatId = conversation?.chatId || '';
        const phoneNumber = chatId.replace('whatsapp_', '');
        
        if (!phoneNumber) {
          console.error(`❌ [WhatsApp Retry] Could not extract phone number from chatId: ${chatId}`);
          return { success: false, reason: 'invalid_phone_number' };
        }
        
        // Se tiver whatsappMessageId, é um template (campanha de cobrança)
        // Caso contrário, é mensagem de texto simples
        if (originalTargetId) {
          // Buscar target para obter dados do template
          const target = await storage.getVoiceCampaignTarget(originalTargetId);
          
          if (!target) {
            console.error(`❌ [WhatsApp Retry] Target ${originalTargetId} not found`);
            return { success: false, reason: 'target_not_found' };
          }
          
          // Reenviar template
          console.log(`📤 [WhatsApp Retry] Resending template to ${target.phoneNumber} via ${evolutionInstance}`);
          
          sendResult = await sendWhatsAppTemplate(
            target.phoneNumber,
            {
              templateName: 'financeiro_em_atraso',
              languageCode: 'en',
              headerParameters: [{ 
                value: target.debtorName.split(' ')[0],
                parameterName: 'texto'
              }],
              bodyParameters: [],
            },
            evolutionInstance
          );
        } else {
          // Reenviar mensagem de texto
          console.log(`📤 [WhatsApp Retry] Resending text message to ${phoneNumber} via ${evolutionInstance}`);
          
          sendResult = await sendWhatsAppMessage(
            phoneNumber,
            message.content,
            evolutionInstance
          );
        }
        
        // 7. Processar resultado do envio
        if (sendResult.success) {
          console.log(`✅ [WhatsApp Retry] Message ${messageId} resent successfully`);
          
          // Resetar status para PENDING e incrementar retry count
          await storage.updateMessage(messageId, {
            whatsappStatus: 'PENDING', // Webhook atualizará para SERVER_ACK/DELIVERY_ACK
            whatsappStatusUpdatedAt: new Date(),
            whatsappRetryCount: currentRetryCount + 1,
            whatsappLastRetryAt: new Date(),
            whatsappMessageId: sendResult.whatsappMessageId || message.whatsappMessageId,
          });
          
          // Atualizar target se existir
          if (originalTargetId) {
            await storage.updateVoiceCampaignTarget(originalTargetId, {
              lastWhatsappStatus: 'PENDING',
              lastWhatsappStatusAt: new Date(),
            });
          }
          
          return { 
            success: true, 
            retryCount: currentRetryCount + 1,
            whatsappMessageId: sendResult.whatsappMessageId 
          };
        } else {
          // Envio falhou
          console.error(`❌ [WhatsApp Retry] Failed to resend message ${messageId}:`, sendResult.errorMessage);
          
          // Verificar se é erro permanente (4xx)
          const isPermanent = sendResult.isPermanentFailure || false;
          
          if (isPermanent) {
            console.error(`🚫 [WhatsApp Retry] Permanent failure detected - marking message as ERROR`);
            
            await storage.updateMessage(messageId, {
              whatsappStatus: 'ERROR',
              whatsappStatusUpdatedAt: new Date(),
            });
            
            if (originalTargetId) {
              await storage.updateVoiceCampaignTarget(originalTargetId, {
                lastWhatsappStatus: 'ERROR',
                lastWhatsappStatusAt: new Date(),
              });
            }
            
            return { success: false, reason: 'permanent_failure', errorStatus: sendResult.errorStatus };
          } else {
            // Erro transitório (429, 503, etc) - incrementar retry count e manter PENDING
            await storage.updateMessage(messageId, {
              whatsappRetryCount: currentRetryCount + 1,
              whatsappLastRetryAt: new Date(),
              whatsappStatusUpdatedAt: new Date(),
            });
            
            const nextBackoff = calculateBackoffMinutes(currentRetryCount + 1);
            console.warn(`⏰ [WhatsApp Retry] Transient failure - will retry in ~${nextBackoff} minutes`);
            
            return { 
              success: false, 
              reason: 'transient_failure', 
              errorStatus: sendResult.errorStatus,
              nextRetryMinutes: nextBackoff
            };
          }
        }
      } else {
        console.error(`❌ [WhatsApp Retry] Message ${messageId} missing conversationId or content`);
        return { success: false, reason: 'invalid_message_data' };
      }
    } catch (error) {
      console.error(`❌ [WhatsApp Retry] Error processing retry for message ${messageId}:`, error);
      
      // Re-throw para BullMQ requeue automaticamente
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process retries one at a time to respect rate limits
  }
);

// Event handlers
worker.on('completed', (job, result) => {
  console.log(`✅ [WhatsApp Retry] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`❌ [WhatsApp Retry] Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('❌ [WhatsApp Retry] Worker error:', err);
});

console.log(`✅ [WhatsApp Retry] Worker ready - listening for jobs on queue: ${QUEUE_NAMES.WHATSAPP_RETRY}`);

export default worker;
