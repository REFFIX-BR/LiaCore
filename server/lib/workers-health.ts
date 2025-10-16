import { Queue } from 'bullmq';
import { redisConnection } from './redis-config';

export const QUEUE_NAMES = {
  MESSAGE_PROCESSING: 'message-processing',
  AI_RESPONSE: 'ai-response',
  IMAGE_ANALYSIS: 'image-analysis',
  NPS_SURVEY: 'nps-survey',
  INACTIVITY_FOLLOWUP: 'inactivity-followup',
  AUTO_CLOSURE: 'auto-closure',
  LEARNING_TASKS: 'learning-tasks',
  AUDIO_TRANSCRIPTION: 'audio-transcription',
};

export interface QueueHealth {
  name: string;
  isHealthy: boolean;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface WorkersHealthStatus {
  allHealthy: boolean;
  queues: QueueHealth[];
  totalWaiting: number;
  totalActive: number;
  totalFailed: number;
}

/**
 * Verifica a saúde de todas as filas BullMQ
 */
export async function checkWorkersHealth(): Promise<WorkersHealthStatus> {
  try {
    const queueNames = Object.values(QUEUE_NAMES);
    const queueHealths: QueueHealth[] = [];
    let totalWaiting = 0;
    let totalActive = 0;
    let totalFailed = 0;
    let allHealthy = true;

    for (const queueName of queueNames) {
      try {
        const queue = new Queue(queueName, {
          connection: redisConnection,
        });

        // Obtém contadores de jobs
        const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.isPaused(),
        ]);

        // Considera não saudável se:
        // - Fila está pausada
        // - Há muitas falhas (> 10)
        // - Há muitas mensagens esperando (> 100) e nenhuma ativa (worker pode estar parado)
        const isHealthy = !isPaused && failed < 10 && !(waiting > 100 && active === 0);

        if (!isHealthy) {
          allHealthy = false;
        }

        queueHealths.push({
          name: queueName,
          isHealthy,
          waiting,
          active,
          completed,
          failed,
          delayed,
          paused: isPaused,
        });

        totalWaiting += waiting;
        totalActive += active;
        totalFailed += failed;

        // Fecha a conexão da fila
        await queue.close();
      } catch (error) {
        console.error(`❌ [Workers Health] Error checking queue ${queueName}:`, error);
        allHealthy = false;
        queueHealths.push({
          name: queueName,
          isHealthy: false,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: true,
        });
      }
    }

    return {
      allHealthy,
      queues: queueHealths,
      totalWaiting,
      totalActive,
      totalFailed,
    };
  } catch (error) {
    console.error('❌ [Workers Health] Error checking workers health:', error);
    return {
      allHealthy: false,
      queues: [],
      totalWaiting: 0,
      totalActive: 0,
      totalFailed: 0,
    };
  }
}

/**
 * Verifica se um worker específico está ativo
 */
export async function isWorkerActive(queueName: string): Promise<boolean> {
  try {
    const queue = new Queue(queueName, {
      connection: redisConnection,
    });

    const workers = await queue.getWorkers();
    await queue.close();

    return workers.length > 0;
  } catch (error) {
    console.error(`❌ [Workers Health] Error checking worker ${queueName}:`, error);
    return false;
  }
}

/**
 * Obtém estatísticas detalhadas de uma fila
 */
export async function getQueueStats(queueName: string): Promise<QueueHealth | null> {
  try {
    const queue = new Queue(queueName, {
      connection: redisConnection,
    });

    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    await queue.close();

    const isHealthy = !isPaused && failed < 10 && !(waiting > 100 && active === 0);

    return {
      name: queueName,
      isHealthy,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  } catch (error) {
    console.error(`❌ [Workers Health] Error getting queue stats for ${queueName}:`, error);
    return null;
  }
}
