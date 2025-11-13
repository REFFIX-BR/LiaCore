import { Queue } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES } from '../../../lib/queue';
import { storage } from '../../../storage';

console.log('🔄 [WhatsApp Retry Scheduler] Initializing...');

const MAX_RETRIES_PER_RUN = 100; // Limit batch size to avoid spikes
const SCAN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const PENDING_THRESHOLD_MINUTES = 30; // Retry messages stuck >30min

/**
 * Retry Scheduler - Periodically scans for stuck PENDING messages and enqueues retry jobs
 */
class WhatsAppRetryScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private retryQueue: Queue;
  
  constructor() {
    this.retryQueue = new Queue(QUEUE_NAMES.WHATSAPP_RETRY, {
      connection: redisConnection,
    });
  }
  
  start() {
    console.log(`🔄 [WhatsApp Retry Scheduler] Starting scheduler (scan every ${SCAN_INTERVAL_MS / 1000}s)`);
    
    // Run immediately on startup (after 2 min delay)
    setTimeout(() => this.scan(), 2 * 60 * 1000);
    
    // Then run periodically
    this.intervalId = setInterval(() => this.scan(), SCAN_INTERVAL_MS);
    
    console.log('✅ [WhatsApp Retry Scheduler] Scheduler started');
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️  [WhatsApp Retry Scheduler] Scheduler stopped');
    }
  }
  
  async scan() {
    try {
      console.log(`🔍 [WhatsApp Retry Scheduler] Scanning for stuck PENDING messages (>${PENDING_THRESHOLD_MINUTES} min)...`);
      
      // Get stuck PENDING messages
      const pendingMessages = await storage.getPendingWhatsAppMessages(PENDING_THRESHOLD_MINUTES);
      
      if (pendingMessages.length === 0) {
        console.log('✅ [WhatsApp Retry Scheduler] No stuck messages found');
        return;
      }
      
      console.log(`📊 [WhatsApp Retry Scheduler] Found ${pendingMessages.length} stuck messages`);
      
      // Filter messages eligible for retry (<3 retries)
      const eligibleMessages = pendingMessages.filter(msg => (msg.whatsappRetryCount || 0) < 3);
      
      if (eligibleMessages.length === 0) {
        console.log('⚠️  [WhatsApp Retry Scheduler] All stuck messages have reached max retries');
        return;
      }
      
      console.log(`📤 [WhatsApp Retry Scheduler] Enqueuing ${eligibleMessages.length} messages for retry (max ${MAX_RETRIES_PER_RUN})`);
      
      // Limit batch size
      const messagesToRetry = eligibleMessages.slice(0, MAX_RETRIES_PER_RUN);
      
      // Enqueue retry jobs
      let enqueued = 0;
      for (const message of messagesToRetry) {
        try {
          // Find original target if this is a campaign message
          const conversation = message.conversationId 
            ? await storage.getConversation(message.conversationId) 
            : null;
          const originalTargetId = conversation?.voiceCampaignTargetId || undefined;
          
          await this.retryQueue.add(
            'retry-message',
            {
              messageId: message.id,
              attemptNumber: (message.whatsappRetryCount || 0) + 1,
              originalTargetId,
            },
            {
              jobId: `retry-${message.id}-attempt-${(message.whatsappRetryCount || 0) + 1}`, // Idempotent job ID
            }
          );
          
          enqueued++;
        } catch (error) {
          console.error(`❌ [WhatsApp Retry Scheduler] Failed to enqueue message ${message.id}:`, error);
        }
      }
      
      console.log(`✅ [WhatsApp Retry Scheduler] Enqueued ${enqueued} retry jobs`);
      
      // Log metrics
      const totalStuck = pendingMessages.length;
      const totalEligible = eligibleMessages.length;
      const totalMaxRetries = pendingMessages.filter(msg => (msg.whatsappRetryCount || 0) >= 3).length;
      
      console.log(`📊 [WhatsApp Retry Scheduler] Metrics:`, {
        totalStuck,
        totalEligible,
        totalMaxRetries,
        enqueued,
      });
      
    } catch (error) {
      console.error('❌ [WhatsApp Retry Scheduler] Error during scan:', error);
    }
  }
}

export const whatsappRetryScheduler = new WhatsAppRetryScheduler();
