import campaignIngestWorker from './campaign-ingest.worker';
import schedulingWorker from './scheduling.worker';
import dialerWorker from './dialer.worker';
import postCallWorker from './post-call.worker';
import promiseMonitorWorker from './promise-monitor.worker';

console.log('🎙️ [Voice Workers] All voice workers initialized successfully');

export {
  campaignIngestWorker,
  schedulingWorker,
  dialerWorker,
  postCallWorker,
  promiseMonitorWorker,
};

export default {
  campaignIngestWorker,
  schedulingWorker,
  dialerWorker,
  postCallWorker,
  promiseMonitorWorker,
};
