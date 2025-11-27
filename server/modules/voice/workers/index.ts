import campaignIngestWorker from './campaign-ingest.worker';
import crmSyncWorker from './crm-sync.worker';
import promiseMonitorWorker from './promise-monitor.worker';
import whatsappCollectionWorker from './whatsapp-collection.worker';
import whatsappRetryWorker from './whatsapp-retry.worker';
import { whatsappRetryScheduler } from './whatsapp-retry-scheduler';
import { storage } from '../../../storage';
import { addVoiceWhatsAppCollectionToQueue } from '../../../lib/queue';

console.log('📱 [Collection Workers] All WhatsApp collection workers initialized successfully');

// Start retry scheduler (scans for stuck PENDING messages every 10 min)
whatsappRetryScheduler.start();

/**
 * STARTUP RECOVERY: Re-enqueue pending targets for active campaigns
 * IDEMPOTENCY: Only processes state='pending' targets. After enqueue,
 * state is updated to 'scheduled' to prevent re-enqueue on next restart.
 */
async function recoverPendingCampaignTargets(): Promise<void> {
  console.log('🔄 [Startup Recovery] Checking for pending campaign targets...');
  
  try {
    const activeCampaigns = await storage.getVoiceCampaignsByStatus('active');
    console.log(`📊 [Startup Recovery] Found ${activeCampaigns.length} active campaigns`);
    
    if (activeCampaigns.length === 0) {
      console.log('✅ [Startup Recovery] No active campaigns to recover');
      return;
    }
    
    let totalEnqueued = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const campaign of activeCampaigns) {
      const targets = await storage.getVoiceCampaignTargets(campaign.id);
      
      // CRITICAL: Only select 'pending' state - 'scheduled' means already in queue
      const pendingTargets = targets.filter(t => 
        t.state === 'pending' && 
        (t.attemptCount ?? 0) === 0
      );
      
      console.log(`📋 [Startup Recovery] Campaign "${campaign.name}": ${pendingTargets.length} pending targets`);
      
      if (pendingTargets.length === 0) {
        console.log('✅ [Startup Recovery] No pending targets to recover for this campaign');
        continue;
      }
      
      // Process one at a time to ensure state update after each enqueue
      // Rate limit: 1 message every 2 minutes (120000ms) - use sequential delays
      const RATE_LIMIT_MS = parseInt(process.env.WHATSAPP_COLLECTION_DELAY_MS || '120000');
      
      for (let i = 0; i < pendingTargets.length; i++) {
        const target = pendingTargets[i];
        
        try {
          // Calculate delay: job 0 starts immediately, job 1 at 2min, job 2 at 4min, etc.
          const delay = i * RATE_LIMIT_MS;
          
          await addVoiceWhatsAppCollectionToQueue({
            targetId: target.id,
            campaignId: campaign.id,
            phoneNumber: target.phoneNumber,
            clientName: target.debtorName,
            clientDocument: target.debtorDocument || 'N/A',
            debtAmount: target.debtAmount || 0,
            attemptNumber: 1,
          }, delay);
          
          // CRITICAL: Mark as 'scheduled' immediately to prevent re-enqueue on restart
          await storage.updateVoiceCampaignTarget(target.id, { state: 'scheduled' });
          totalEnqueued++;
        } catch (error: any) {
          const errorMsg = error.message || String(error);
          if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
            // Job exists, mark as scheduled anyway
            await storage.updateVoiceCampaignTarget(target.id, { state: 'scheduled' });
            totalSkipped++;
          } else {
            totalErrors++;
            if (totalErrors <= 5) {
              console.error(`❌ [Startup Recovery] Error:`, errorMsg);
            }
          }
        }
        
        // Log progress every 100 targets
        if ((i + 1) % 100 === 0) {
          console.log(`📦 [Startup Recovery] Progress: ${i + 1}/${pendingTargets.length} processed`);
        }
      }
    }
    
    console.log(`🎉 [Startup Recovery] Complete: ${totalEnqueued} enqueued, ${totalSkipped} already in queue, ${totalErrors} errors`);
  } catch (error: any) {
    console.error('❌ [Startup Recovery] Error recovering campaign targets:', error.message);
  }
}

// Run recovery after a short delay to ensure workers are ready
setTimeout(() => {
  recoverPendingCampaignTargets();
}, 5000);

export {
  campaignIngestWorker,
  crmSyncWorker,
  promiseMonitorWorker,
  whatsappCollectionWorker,
  whatsappRetryWorker,
};

export default {
  campaignIngestWorker,
  crmSyncWorker,
  promiseMonitorWorker,
  whatsappCollectionWorker,
  whatsappRetryWorker,
};
