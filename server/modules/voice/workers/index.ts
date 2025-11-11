import campaignIngestWorker from './campaign-ingest.worker';
import crmSyncWorker from './crm-sync.worker';
import schedulingWorker from './scheduling.worker';
import dialerWorker from './dialer.worker';
import postCallWorker from './post-call.worker';
import promiseMonitorWorker from './promise-monitor.worker';
import whatsappCollectionWorker from './whatsapp-collection.worker';

console.log('🎙️ [Voice Workers] All voice workers initialized successfully');

export {
  campaignIngestWorker,
  crmSyncWorker,
  schedulingWorker,
  dialerWorker,
  postCallWorker,
  promiseMonitorWorker,
  whatsappCollectionWorker,
};

export default {
  campaignIngestWorker,
  crmSyncWorker,
  schedulingWorker,
  dialerWorker,
  postCallWorker,
  promiseMonitorWorker,
  whatsappCollectionWorker,
};
