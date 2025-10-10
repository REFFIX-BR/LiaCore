import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection configuration
const redisConnection = new IORedis({
  host: process.env.UPSTASH_REDIS_HOST || 'localhost',
  port: parseInt(process.env.UPSTASH_REDIS_PORT || '6379'),
  password: process.env.UPSTASH_REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Queue names
export const QUEUE_NAMES = {
  MESSAGE_PROCESSING: 'message-processing',
  AI_RESPONSE: 'ai-response',
  IMAGE_ANALYSIS: 'image-analysis',
  NPS_SURVEY: 'nps-survey',
  LEARNING_TASKS: 'learning-tasks',
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
}

export interface LearningTaskJob {
  type: 'analyze_patterns' | 'suggest_improvements';
  data: any;
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

// Graceful shutdown
export async function closeQueues() {
  console.log('🔴 Closing queues...');
  await messageQueue.close();
  await aiResponseQueue.close();
  await imageAnalysisQueue.close();
  await npsSurveyQueue.close();
  await learningTasksQueue.close();
  await redisConnection.quit();
  console.log('✅ Queues closed successfully');
}

// Handle shutdown signals
process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);

console.log('✅ [Queue] Sistema de filas inicializado');
console.log('📊 [Queue] Filas ativas:', Object.values(QUEUE_NAMES).join(', '));
