import { Queue, Worker, QueueEvents } from 'bullmq';
import { redisConnection } from './redis-config';

// Queue names
export const QUEUE_NAMES = {
  MESSAGE_PROCESSING: 'message-processing',
  AI_RESPONSE: 'ai-response',
  IMAGE_ANALYSIS: 'image-analysis',
  NPS_SURVEY: 'nps-survey',
  LEARNING_TASKS: 'learning-tasks',
  INACTIVITY_FOLLOWUP: 'inactivity-followup',
  AUTO_CLOSURE: 'auto-closure',
  // LIA VOICE - Módulo de Cobrança Ativa
  VOICE_CAMPAIGN_INGEST: 'voice:campaign-ingest',
  VOICE_SCHEDULING: 'voice:scheduling',
  VOICE_DIALER: 'voice:dialer',
  VOICE_POST_CALL: 'voice:post-call',
  VOICE_PROMISE_MONITOR: 'voice:promise-monitor',
} as const;

// Queue configurations with different priorities and retry strategies
export const QUEUE_CONFIGS = {
  [QUEUE_NAMES.MESSAGE_PROCESSING]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 1000,
      },
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: {
        count: 500, // Keep last 500 failed jobs for debugging
      },
    },
  },
  [QUEUE_NAMES.AI_RESPONSE]: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential' as const,
        delay: 2000,
      },
      removeOnComplete: {
        count: 100,
      },
      removeOnFail: {
        count: 200,
      },
    },
  },
  [QUEUE_NAMES.IMAGE_ANALYSIS]: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'fixed' as const,
        delay: 5000, // Vision is slow, wait more between retries
      },
      removeOnComplete: {
        count: 50,
      },
      removeOnFail: {
        count: 100,
      },
    },
  },
  [QUEUE_NAMES.NPS_SURVEY]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 5000,
      },
      removeOnComplete: {
        count: 200,
      },
      removeOnFail: {
        count: 100,
      },
    },
  },
  [QUEUE_NAMES.LEARNING_TASKS]: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'fixed' as const,
        delay: 60000, // Learning is heavy, wait 1 min between retries
      },
      removeOnComplete: {
        count: 20,
      },
      removeOnFail: {
        count: 50,
      },
    },
  },
  [QUEUE_NAMES.INACTIVITY_FOLLOWUP]: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential' as const,
        delay: 5000,
      },
      removeOnComplete: {
        count: 100,
      },
      removeOnFail: {
        count: 50,
      },
    },
  },
  [QUEUE_NAMES.AUTO_CLOSURE]: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential' as const,
        delay: 5000,
      },
      removeOnComplete: {
        count: 100,
      },
      removeOnFail: {
        count: 50,
      },
    },
  },
  // LIA VOICE - Configurations
  [QUEUE_NAMES.VOICE_CAMPAIGN_INGEST]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 2000,
      },
      removeOnComplete: {
        count: 50,
      },
      removeOnFail: {
        count: 100,
      },
    },
  },
  [QUEUE_NAMES.VOICE_SCHEDULING]: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential' as const,
        delay: 5000,
      },
      removeOnComplete: {
        count: 200,
      },
      removeOnFail: {
        count: 100,
      },
    },
  },
  [QUEUE_NAMES.VOICE_DIALER]: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'fixed' as const,
        delay: 10000, // Wait 10s between call retries (compliance)
      },
      removeOnComplete: {
        count: 500, // Keep more for audit
      },
      removeOnFail: {
        count: 200,
      },
    },
  },
  [QUEUE_NAMES.VOICE_POST_CALL]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 3000,
      },
      removeOnComplete: {
        count: 300,
      },
      removeOnFail: {
        count: 100,
      },
    },
  },
  [QUEUE_NAMES.VOICE_PROMISE_MONITOR]: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential' as const,
        delay: 10000,
      },
      removeOnComplete: {
        count: 100,
      },
      removeOnFail: {
        count: 50,
      },
    },
  },
};

// Create queues
export const messageQueue = new Queue(
  QUEUE_NAMES.MESSAGE_PROCESSING,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.MESSAGE_PROCESSING],
  }
);

export const aiResponseQueue = new Queue(
  QUEUE_NAMES.AI_RESPONSE,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.AI_RESPONSE],
  }
);

export const imageAnalysisQueue = new Queue(
  QUEUE_NAMES.IMAGE_ANALYSIS,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.IMAGE_ANALYSIS],
  }
);

export const npsSurveyQueue = new Queue(
  QUEUE_NAMES.NPS_SURVEY,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.NPS_SURVEY],
  }
);

export const learningTasksQueue = new Queue(
  QUEUE_NAMES.LEARNING_TASKS,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.LEARNING_TASKS],
  }
);

export const inactivityFollowupQueue = new Queue(
  QUEUE_NAMES.INACTIVITY_FOLLOWUP,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.INACTIVITY_FOLLOWUP],
  }
);

export const autoClosureQueue = new Queue(
  QUEUE_NAMES.AUTO_CLOSURE,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.AUTO_CLOSURE],
  }
);

// LIA VOICE - Queue instances
export const voiceCampaignIngestQueue = new Queue(
  QUEUE_NAMES.VOICE_CAMPAIGN_INGEST,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.VOICE_CAMPAIGN_INGEST],
  }
);

export const voiceSchedulingQueue = new Queue(
  QUEUE_NAMES.VOICE_SCHEDULING,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.VOICE_SCHEDULING],
  }
);

export const voiceDialerQueue = new Queue(
  QUEUE_NAMES.VOICE_DIALER,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.VOICE_DIALER],
  }
);

export const voicePostCallQueue = new Queue(
  QUEUE_NAMES.VOICE_POST_CALL,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.VOICE_POST_CALL],
  }
);

export const voicePromiseMonitorQueue = new Queue(
  QUEUE_NAMES.VOICE_PROMISE_MONITOR,
  {
    connection: redisConnection,
    ...QUEUE_CONFIGS[QUEUE_NAMES.VOICE_PROMISE_MONITOR],
  }
);

// Queue events for monitoring
export const messageQueueEvents = new QueueEvents(QUEUE_NAMES.MESSAGE_PROCESSING, {
  connection: redisConnection,
});

export const aiResponseQueueEvents = new QueueEvents(QUEUE_NAMES.AI_RESPONSE, {
  connection: redisConnection,
});

export const imageAnalysisQueueEvents = new QueueEvents(QUEUE_NAMES.IMAGE_ANALYSIS, {
  connection: redisConnection,
});

// Job data types
export interface MessageProcessingJob {
  chatId: string;
  conversationId: string;
  message: string;
  fromNumber: string;
  messageId: string;
  timestamp: number;
  hasImage?: boolean;
  imageUrl?: string;
  evolutionInstance?: string;
  clientName?: string;
}

export interface AIResponseJob {
  conversationId: string;
  chatId: string;
  threadId: string;
  assistantId: string;
  message: string;
}

export interface ImageAnalysisJob {
  conversationId: string;
  chatId: string;
  imageUrl: string;
  messageId: string;
  caption?: string;
}

export interface NPSSurveyJob {
  conversationId: string;
  chatId: string;
  customerName: string;
  wasResolved: boolean;
  evolutionInstance?: string;
}

export interface LearningTaskJob {
  type: 'analyze_patterns' | 'suggest_improvements';
  data: any;
}

export interface InactivityFollowupJob {
  conversationId: string;
  chatId: string;
  clientId: string;
  clientName: string;
  evolutionInstance?: string;
  scheduledAt: number;
  lastClientMessageTime: number;
}

export interface AutoClosureJob {
  conversationId: string;
  chatId: string;
  clientId: string;
  clientName: string;
  evolutionInstance?: string;
  scheduledAt: number;
  followupSentAt: number;
}

// LIA VOICE - Job data types
export interface VoiceCampaignIngestJob {
  campaignId: string;
  crmApiUrl: string;
  crmApiKey?: string;
  filters?: Record<string, any>;
}

export interface VoiceSchedulingJob {
  targetId: string;
  campaignId: string;
  scheduledFor: Date;
  attemptNumber: number;
}

export interface VoiceDialerJob {
  targetId: string;
  campaignId: string;
  phoneNumber: string;
  clientName: string;
  clientDocument: string;
  debtAmount: number;
  attemptNumber: number;
}

export interface VoicePostCallJob {
  attemptId: string;
  targetId: string;
  campaignId: string;
  callSid: string;
  callDuration: number;
  callStatus: string;
  recordingUrl?: string;
  transcription?: string;
  conversationData?: Record<string, any>;
}

export interface VoicePromiseMonitorJob {
  promiseId: string;
  dueDate: Date;
  targetId: string;
  campaignId: string;
}

// Helper functions to add jobs
export async function addMessageToQueue(data: MessageProcessingJob, priority?: number) {
  return await messageQueue.add('process-message', data, {
    priority: priority || 1, // Higher priority = processed first (1 is highest)
  });
}

export async function addAIResponseToQueue(data: AIResponseJob) {
  return await aiResponseQueue.add('generate-response', data, {
    priority: 2,
  });
}

export async function addImageToQueue(data: ImageAnalysisJob) {
  return await imageAnalysisQueue.add('analyze-image', data, {
    priority: 3, // Lower priority, can wait a bit
  });
}

export async function addNPSSurveyToQueue(data: NPSSurveyJob, delay?: number) {
  return await npsSurveyQueue.add('send-nps', data, {
    delay: delay || 60000, // Default 1 minute delay after conversation ends
  });
}

export async function addLearningTaskToQueue(data: LearningTaskJob) {
  return await learningTasksQueue.add('learning-task', data, {
    priority: 10, // Lowest priority, background task
  });
}

export async function addInactivityFollowupToQueue(data: InactivityFollowupJob) {
  const TEN_MINUTES = 10 * 60 * 1000; // 10 minutos em milissegundos
  
  return await inactivityFollowupQueue.add('check-inactivity', data, {
    delay: TEN_MINUTES,
    jobId: `inactivity-${data.conversationId}`, // ID único para poder cancelar depois
    priority: 5,
  });
}

export async function cancelInactivityFollowup(conversationId: string) {
  try {
    const jobId = `inactivity-${conversationId}`;
    const job = await inactivityFollowupQueue.getJob(jobId);
    
    if (job) {
      await job.remove();
      console.log(`✅ [Inactivity] Follow-up cancelado para conversa ${conversationId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ [Inactivity] Erro ao cancelar follow-up:`, error);
    return false;
  }
}

export async function addAutoClosureToQueue(data: AutoClosureJob) {
  const TWENTY_MINUTES = 20 * 60 * 1000; // 20 minutos em milissegundos
  
  return await autoClosureQueue.add('auto-close-conversation', data, {
    delay: TWENTY_MINUTES,
    jobId: `auto-closure-${data.conversationId}`, // ID único para poder cancelar depois
    priority: 5,
  });
}

export async function cancelAutoClosure(conversationId: string) {
  try {
    const jobId = `auto-closure-${conversationId}`;
    const job = await autoClosureQueue.getJob(jobId);
    
    if (job) {
      await job.remove();
      console.log(`✅ [Auto-Closure] Encerramento automático cancelado para conversa ${conversationId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ [Auto-Closure] Erro ao cancelar encerramento automático:`, error);
    return false;
  }
}

// LIA VOICE - Helper functions
export async function addVoiceCampaignIngestToQueue(data: VoiceCampaignIngestJob) {
  return await voiceCampaignIngestQueue.add('ingest-campaign', data, {
    priority: 5,
  });
}

export async function addVoiceSchedulingToQueue(data: VoiceSchedulingJob) {
  const delay = Math.max(0, new Date(data.scheduledFor).getTime() - Date.now());
  
  return await voiceSchedulingQueue.add('schedule-call', data, {
    delay,
    jobId: `schedule-${data.targetId}-${data.attemptNumber}`,
    priority: 3,
  });
}

export async function addVoiceDialerToQueue(data: VoiceDialerJob, delay?: number) {
  return await voiceDialerQueue.add('make-call', data, {
    delay: delay || 0,
    jobId: `dial-${data.targetId}-${data.attemptNumber}`,
    priority: 2,
  });
}

export async function addVoicePostCallToQueue(data: VoicePostCallJob) {
  return await voicePostCallQueue.add('process-call-result', data, {
    priority: 3,
  });
}

export async function addVoicePromiseMonitorToQueue(data: VoicePromiseMonitorJob) {
  const delay = Math.max(0, new Date(data.dueDate).getTime() - Date.now());
  
  return await voicePromiseMonitorQueue.add('check-promise', data, {
    delay,
    jobId: `promise-${data.promiseId}`,
    priority: 4,
  });
}

export async function cancelVoiceScheduledCall(targetId: string, attemptNumber: number) {
  try {
    const jobId = `schedule-${targetId}-${attemptNumber}`;
    const job = await voiceSchedulingQueue.getJob(jobId);
    
    if (job) {
      await job.remove();
      console.log(`✅ [Voice] Chamada agendada cancelada: ${jobId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ [Voice] Erro ao cancelar chamada agendada:`, error);
    return false;
  }
}

// Graceful shutdown
export async function closeQueues() {
  console.log('🔴 Closing queues...');
  await messageQueue.close();
  await aiResponseQueue.close();
  await imageAnalysisQueue.close();
  await npsSurveyQueue.close();
  await learningTasksQueue.close();
  await inactivityFollowupQueue.close();
  await autoClosureQueue.close();
  // LIA VOICE queues
  await voiceCampaignIngestQueue.close();
  await voiceSchedulingQueue.close();
  await voiceDialerQueue.close();
  await voicePostCallQueue.close();
  await voicePromiseMonitorQueue.close();
  await redisConnection.quit();
  console.log('✅ Queues closed successfully');
}

// Handle shutdown signals
process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);

console.log('✅ [Queue] Sistema de filas inicializado');
console.log('📊 [Queue] Filas ativas:', Object.values(QUEUE_NAMES).join(', '));
