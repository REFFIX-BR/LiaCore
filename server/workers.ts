import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import {
  QUEUE_NAMES,
  MessageProcessingJob,
  ImageAnalysisJob,
  NPSSurveyJob,
} from './lib/queue';

// Redis connection for workers (BullMQ requirement)
const redisConnection = new IORedis({
  host: process.env.UPSTASH_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.UPSTASH_REDIS_PORT || process.env.REDIS_PORT || '6379'),
  password: process.env.UPSTASH_REDIS_PASSWORD || process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // BullMQ requirement for blocking commands
  enableReadyCheck: false,
  // TLS configuration for Upstash (rediss://)
  tls: process.env.UPSTASH_REDIS_HOST ? {
    rejectUnauthorized: false, // Upstash uses self-signed certs
  } : undefined,
});

// Import processing functions
import { sendMessageAndGetResponse } from './lib/openai';
import { analyzeImageWithVision } from './lib/vision';
import { storage } from './storage';

// Helper function to send WhatsApp message
async function sendWhatsAppMessage(phoneNumber: string, text: string, instance?: string): Promise<boolean> {
  const evolutionInstance = instance || process.env.EVOLUTION_API_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const baseUrl = process.env.EVOLUTION_API_URL;

  if (!evolutionInstance || !apiKey || !baseUrl) {
    console.error('❌ Evolution API config missing');
    return false;
  }

  try {
    const response = await fetch(`${baseUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: phoneNumber,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return false;
  }
}

// Idempotency helper
async function isJobProcessed(jobId: string): Promise<boolean> {
  const key = `idempotency:${jobId}`;
  const exists = await redisConnection.exists(key);
  return exists === 1;
}

async function markJobProcessed(jobId: string, ttlSeconds = 86400): Promise<void> {
  const key = `idempotency:${jobId}`;
  await redisConnection.setex(key, ttlSeconds, 'processed');
}

// Worker 1: Process incoming WhatsApp messages
export const messageProcessingWorker = new Worker<MessageProcessingJob>(
  QUEUE_NAMES.MESSAGE_PROCESSING,
  async (job: Job<MessageProcessingJob>) => {
    const { chatId, conversationId, message, fromNumber, hasImage, imageUrl, evolutionInstance, clientName, messageId } = job.data;

    // Check idempotency
    const idempotencyKey = messageId || job.id;
    if (await isJobProcessed(idempotencyKey!)) {
      console.log(`⏭️ [Worker] Job already processed, skipping: ${idempotencyKey}`);
      return { skipped: true, reason: 'already_processed' };
    }

    console.log(`🔄 [Worker] Processing message from ${fromNumber}`, {
      jobId: job.id,
      idempotencyKey,
      conversationId,
      hasImage,
      evolutionInstance,
    });

    try {
      const { prodLogger, logWorkerError } = await import('./lib/production-logger');
      
      // 1. Get conversation to determine assistant
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        prodLogger.error('worker', 'Conversation not found', new Error(`Conversation not found: ${conversationId}`), {
          conversationId,
          fromNumber,
          jobId: job.id,
        });
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      
      prodLogger.info('worker', 'Processing message', {
        conversationId,
        fromNumber,
        jobId: job.id,
        hasImage,
      });

      let enhancedMessage = message;

      // 2. If message has image, process it first
      if (hasImage && imageUrl) {
        console.log(`🖼️ [Worker] Image detected, analyzing...`);
        
        const promptWithContext = message 
          ? `${message}\n\nPor favor, analise a imagem considerando a mensagem do cliente acima.`
          : 'Analise esta imagem em detalhes e extraia todas as informações relevantes. Se for um boleto, extraia identificador, vencimento, valor. Se for um documento, extraia CPF/CNPJ.';
        
        const visionResult = await analyzeImageWithVision(imageUrl, promptWithContext);

        if (visionResult) {
          enhancedMessage = message 
            ? `${message}\n\n[Análise da imagem: ${visionResult}]`
            : `[Imagem enviada - ${visionResult}]`;
        }
      }

      // 3. Get or create thread ID
      let threadId = conversation.threadId;
      
      if (!threadId) {
        const { createThread } = await import('./lib/openai');
        threadId = await createThread();
        
        await storage.updateConversation(conversationId, {
          threadId,
        });
      }

      // 4. Get assistant ID from conversation type
      const assistantIds: Record<string, string | undefined> = {
        'apresentacao': process.env.OPENAI_ASSISTANT_APRESENTACAO_ID,
        'suporte': process.env.OPENAI_ASSISTANT_SUPORTE_ID,
        'comercial': process.env.OPENAI_ASSISTANT_COMERCIAL_ID,
        'financeiro': process.env.OPENAI_ASSISTANT_FINANCEIRO_ID,
        'cancelamento': process.env.OPENAI_ASSISTANT_CANCELAMENTO_ID,
        'ouvidoria': process.env.OPENAI_ASSISTANT_OUVIDORIA_ID,
      };

      const assistantId = assistantIds[conversation.assistantType] || process.env.OPENAI_ASSISTANT_SUPORTE_ID;

      if (!assistantId) {
        throw new Error('No assistant ID available');
      }

      // 5. Send message to OpenAI and get response
      const result = await sendMessageAndGetResponse(
        threadId,
        assistantId,
        enhancedMessage,
        chatId,
        conversationId
      );

      // 6. Handle special responses
      if (result.transferred) {
        console.log(`🔀 [Worker] Conversation transferred to human`);
        
        await storage.updateConversation(conversationId, {
          status: 'queued',
          transferredToHuman: true,
        });
      }

      if (result.routed && result.assistantTarget) {
        console.log(`🎭 [Worker] Routed to assistant: ${result.assistantTarget}`);
        
        await storage.updateConversation(conversationId, {
          assistantType: result.assistantTarget,
        });
      }

      if (result.resolved) {
        console.log(`✅ [Worker] Conversation resolved`);
        
        await storage.updateConversation(conversationId, {
          status: 'resolved',
          resolvedAt: new Date(),
        });
      }

      // 7. Send response back to customer
      const messageSent = await sendWhatsAppMessage(fromNumber, result.response, evolutionInstance);
      
      if (!messageSent) {
        throw new Error('Failed to send WhatsApp message - Evolution API error');
      }

      // 8. Store AI response (only if message was sent successfully)
      await storage.createMessage({
        conversationId,
        role: 'assistant',
        content: result.response,
      });

      console.log(`✅ [Worker] Message processed successfully`);

      // Mark job as processed (idempotency)
      await markJobProcessed(idempotencyKey!);

      return {
        success: true,
        response: result.response,
      };
    } catch (error) {
      console.error(`❌ [Worker] Error processing message:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Worker 2: Image analysis
export const imageAnalysisWorker = new Worker<ImageAnalysisJob>(
  QUEUE_NAMES.IMAGE_ANALYSIS,
  async (job: Job<ImageAnalysisJob>) => {
    const { conversationId, imageUrl, caption } = job.data;

    // Check idempotency
    if (await isJobProcessed(job.id!)) {
      console.log(`⏭️ [Vision Worker] Job already processed, skipping: ${job.id}`);
      return { skipped: true, reason: 'already_processed' };
    }

    console.log(`🖼️ [Vision Worker] Analyzing image`, {
      jobId: job.id,
      conversationId,
    });

    try {
      const promptWithCaption = caption
        ? `${caption}\n\nAnalise a imagem considerando a legenda acima.`
        : 'Analise esta imagem em detalhes e extraia todas as informações relevantes.';
      
      const result = await analyzeImageWithVision(imageUrl, promptWithCaption);

      if (!result) {
        throw new Error('Vision analysis returned null');
      }

      console.log(`✅ [Vision Worker] Image analyzed successfully`);

      // Mark job as processed (idempotency)
      await markJobProcessed(job.id!);

      return {
        success: true,
        analysis: result,
      };
    } catch (error) {
      console.error(`❌ [Vision Worker] Error:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

// Worker 3: NPS Survey sender
export const npsSurveyWorker = new Worker<NPSSurveyJob>(
  QUEUE_NAMES.NPS_SURVEY,
  async (job: Job<NPSSurveyJob>) => {
    const { chatId, conversationId } = job.data;

    // Check idempotency
    if (await isJobProcessed(job.id!)) {
      console.log(`⏭️ [NPS Worker] Job already processed, skipping: ${job.id}`);
      return { skipped: true, reason: 'already_processed' };
    }

    console.log(`📊 [NPS Worker] Sending survey`, {
      jobId: job.id,
      conversationId,
    });

    try {
      const npsMessage = `
🌟 *Pesquisa de Satisfação*

Como você avalia nosso atendimento?

Numa escala de 0 a 10, onde 0 é "muito insatisfeito" e 10 é "muito satisfeito", que nota você daria?

Responda apenas com o número (0 a 10).
      `.trim();

      const surveySent = await sendWhatsAppMessage(chatId, npsMessage);
      
      if (!surveySent) {
        throw new Error('Failed to send NPS survey - Evolution API error');
      }

      // Mark conversation as awaiting NPS (only if survey was sent successfully)
      await storage.updateConversation(conversationId, {
        status: 'awaiting_nps',
      });

      console.log(`✅ [NPS Worker] Survey sent successfully`);

      // Mark job as processed (idempotency)
      await markJobProcessed(job.id!);

      return {
        success: true,
      };
    } catch (error) {
      console.error(`❌ [NPS Worker] Error:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

// Error handlers
messageProcessingWorker.on('failed', (job, error) => {
  console.error(`❌ [Worker] Message processing failed:`, {
    jobId: job?.id,
    error: error.message,
  });
});

imageAnalysisWorker.on('failed', (job, error) => {
  console.error(`❌ [Vision Worker] Failed:`, {
    jobId: job?.id,
    error: error.message,
  });
});

npsSurveyWorker.on('failed', (job, error) => {
  console.error(`❌ [NPS Worker] Failed:`, {
    jobId: job?.id,
    error: error.message,
  });
});

// Success handlers
messageProcessingWorker.on('completed', (job) => {
  console.log(`✅ [Worker] Message completed:`, {
    jobId: job.id,
    duration: job.finishedOn ? job.finishedOn - (job.processedOn || 0) : 0,
  });
});

// Graceful shutdown
async function closeWorkers() {
  console.log('🔴 Closing workers...');
  await messageProcessingWorker.close();
  await imageAnalysisWorker.close();
  await npsSurveyWorker.close();
  await redisConnection.quit();
  console.log('✅ Workers closed successfully');
}

process.on('SIGTERM', closeWorkers);
process.on('SIGINT', closeWorkers);

console.log('✅ [Workers] Sistema de workers inicializado');
console.log('👷 [Workers] Workers ativos: 3');
console.log('⚡ [Workers] Concurrency:');
console.log('  - Message Processing: 5');
console.log('  - Image Analysis: 2');
console.log('  - NPS Survey: 3');
