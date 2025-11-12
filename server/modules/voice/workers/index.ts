import campaignIngestWorker from './campaign-ingest.worker';
import crmSyncWorker from './crm-sync.worker';
import promiseMonitorWorker from './promise-monitor.worker';
import whatsappCollectionWorker from './whatsapp-collection.worker';

console.log('📱 [Collection Workers] All WhatsApp collection workers initialized successfully');

export {
  campaignIngestWorker,
  crmSyncWorker,
  promiseMonitorWorker,
  whatsappCollectionWorker,
};

export default {
  campaignIngestWorker,
  crmSyncWorker,
  promiseMonitorWorker,
  whatsappCollectionWorker,
};
