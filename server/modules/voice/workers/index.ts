import campaignIngestWorker from './campaign-ingest.worker';
import crmSyncWorker from './crm-sync.worker';
import promiseMonitorWorker from './promise-monitor.worker';
import whatsappCollectionWorker from './whatsapp-collection.worker';
import whatsappRetryWorker from './whatsapp-retry.worker';
import { whatsappRetryScheduler } from './whatsapp-retry-scheduler';

console.log('📱 [Collection Workers] All WhatsApp collection workers initialized successfully');

// Start retry scheduler (scans for stuck PENDING messages every 10 min)
whatsappRetryScheduler.start();

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
