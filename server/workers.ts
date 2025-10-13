import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import {
  QUEUE_NAMES,
  MessageProcessingJob,
  ImageAnalysisJob,
  NPSSurveyJob,
} from './lib/queue';

// Redis connection for workers (BullMQ requirement)
let redisConnection: IORedis | null = null;

try {
  redisConnection = new IORedis({
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

  // Handle Redis errors gracefully
  redisConnection.on('error', (err) => {
    if (err.message.includes('max requests limit exceeded')) {
      console.error('❌ [Redis] Max requests limit exceeded - workers disabled');
      console.log('   Please reset Redis in Upstash dashboard');
      console.log('   App will continue with fallback processing');
    } else {
      console.error('❌ [Redis] Connection error:', err.message);
    }
  });
} catch (error) {
  console.error('❌ [Workers] Failed to create Redis connection:', error);
  console.log('   App will continue with fallback processing');
}

// Import processing functions
import { sendMessageAndGetResponse } from './lib/openai';
import { analyzeImageWithVision } from './lib/vision';
import { storage } from './storage';

// Helper function to send WhatsApp message
async function sendWhatsAppMessage(phoneNumber: string, text: string, instance?: string): Promise<boolean> {
  const evolutionInstance = instance || process.env.EVOLUTION_API_INSTANCE;
  
  // Tenta API key e URL específicos da instância primeiro, senão usa global
  const apiKey = evolutionInstance 
    ? (process.env[`EVOLUTION_API_KEY_${evolutionInstance}`] || process.env.EVOLUTION_API_KEY)
    : process.env.EVOLUTION_API_KEY;
  
  let baseUrl = evolutionInstance
    ? (process.env[`EVOLUTION_API_URL_${evolutionInstance}`] || process.env.EVOLUTION_API_URL)
    : process.env.EVOLUTION_API_URL;

  if (!evolutionInstance || !apiKey || !baseUrl) {
    console.error('❌ Evolution API config missing', { 
      evolutionInstance, 
      hasApiKey: !!apiKey, 
      baseUrl,
      triedKey: `EVOLUTION_API_KEY_${evolutionInstance}`,
      triedUrl: `EVOLUTION_API_URL_${evolutionInstance}`
    });
    return false;
  }

  // Sanitize and validate URL
  baseUrl = baseUrl.trim(); // Remove espaços extras
  
  // Adicionar https:// se não tiver protocolo
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
    console.log(`⚠️  [WhatsApp] URL sem protocolo detectada, adicionando https://: ${baseUrl}`);
  }
  
  // Remover trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  try {
    const fullUrl = `${baseUrl}/message/sendText/${evolutionInstance}`;
    console.log(`📤 [WhatsApp] Sending message to: ${phoneNumber} via ${fullUrl}`);
    
    const response = await fetch(fullUrl, {
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
  if (!redisConnection) return false;
  const key = `idempotency:${jobId}`;
  const exists = await redisConnection.exists(key);
  return exists === 1;
}

async function markJobProcessed(jobId: string, ttlSeconds = 86400): Promise<void> {
  if (!redisConnection) return;
  const key = `idempotency:${jobId}`;
  await redisConnection.setex(key, ttlSeconds, 'processed');
}

// Workers are only created if Redis is available
let messageProcessingWorker: Worker<MessageProcessingJob> | undefined;
let imageAnalysisWorker: Worker<ImageAnalysisJob> | undefined;
let npsSurveyWorker: Worker<NPSSurveyJob> | undefined;

if (redisConnection) {
  // Worker 1: Process incoming WhatsApp messages
  messageProcessingWorker = new Worker<MessageProcessingJob>(
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
      let conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        // CRÍTICO: Conversa não encontrada - pode ser race condition ou conversa deletada
        console.error(`❌ [CRITICAL WORKER] Conversa ID ${conversationId} NÃO ENCONTRADA no banco!`);
        console.error(`🔍 [DEBUG] Tentando buscar por chatId: ${chatId}`);
        
        // Tentar buscar por chatId como fallback
        conversation = await storage.getConversationByChatId(chatId);
        
        if (conversation) {
          console.log(`✅ [RECOVERY] Conversa encontrada por chatId! ID correto: ${conversation.id}`);
          console.log(`⚠️ [WARNING] Job tinha ID errado: ${conversationId} vs correto: ${conversation.id}`);
          
          prodLogger.warn('worker', 'Conversation ID mismatch - recovered by chatId', {
            wrongConversationId: conversationId,
            correctConversationId: conversation.id,
            chatId,
            fromNumber,
            jobId: job.id,
          });
          
          // Continuar processamento com conversa correta
        } else {
          // Conversa realmente não existe
          prodLogger.error(
            'worker', 
            'Conversation not found - deleted or never created',
            new Error(`Conversation not found: ${conversationId}`),
            {
              conversationId,
              chatId,
              fromNumber,
              jobId: job.id,
              action: 'skipping_job'
            }
          );
          
          console.error(`❌ [FATAL] Conversa ${conversationId} / ${chatId} não existe no banco!`);
          
          // Marcar idempotência mesmo assim para evitar reprocessamento
          await markJobProcessed(idempotencyKey!);
          
          // Retornar sucesso (não é erro, conversa foi removida intencionalmente)
          return { 
            status: 'skipped', 
            reason: 'conversation_not_found',
            conversationId,
            chatId
          };
        }
      }
      
      prodLogger.info('worker', 'Processing message', {
        conversationId,
        fromNumber,
        jobId: job.id,
        hasImage,
      });

      // 2. Check if conversation is transferred to human
      if (conversation.transferredToHuman) {
        console.log(`👤 [Worker] Conversa transferida para humano - apenas armazenando mensagem`);
        
        // Store user message only (no AI processing)
        await storage.createMessage({
          conversationId,
          role: 'user',
          content: message,
        });

        // Mark job as processed
        await markJobProcessed(idempotencyKey!);

        prodLogger.info('worker', 'Message stored for human agent', {
          conversationId,
          assignedTo: conversation.assignedTo,
          status: conversation.status,
        });

        return {
          success: true,
          handledByHuman: true,
          reason: 'conversation_transferred_to_human',
        };
      }

      let enhancedMessage = message;

      // 3. If message has image, process it first
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

      // 4. Get or create thread ID
      let threadId = conversation.threadId;
      
      if (!threadId) {
        const { createThread } = await import('./lib/openai');
        threadId = await createThread();
        
        await storage.updateConversation(conversationId, {
          threadId,
        });
      }

      // 5. Get assistant ID from conversation type (use ASSISTANT_IDS from openai.ts)
      const { ASSISTANT_IDS } = await import('./lib/openai');
      
      const assistantId = ASSISTANT_IDS[conversation.assistantType as keyof typeof ASSISTANT_IDS] || ASSISTANT_IDS.suporte;

      if (!assistantId) {
        const { prodLogger } = await import('./lib/production-logger');
        const { ASSISTANT_ENV_STATUS } = await import('./lib/openai');
        
        prodLogger.error('worker', 'No assistant ID available', new Error('Missing assistant environment variable'), {
          conversationId,
          assistantType: conversation.assistantType,
          configuredAssistants: ASSISTANT_ENV_STATUS.configured,
          missingAssistants: ASSISTANT_ENV_STATUS.missing,
          envStatus: ASSISTANT_ENV_STATUS,
        });
        
        console.error(`🔴 [Worker] No assistant ID for type: ${conversation.assistantType}`);
        console.error(`🔴 [Worker] Configured assistants:`, ASSISTANT_ENV_STATUS.configured);
        console.error(`🔴 [Worker] Missing assistants:`, ASSISTANT_ENV_STATUS.missing);
        throw new Error(`No assistant ID available for ${conversation.assistantType}. Configure as variáveis de ambiente em produção!`);
      }

      // 6. Send message to OpenAI and get response
      const result = await sendMessageAndGetResponse(
        threadId,
        assistantId,
        enhancedMessage,
        chatId,
        conversationId
      );

      // 7. Handle special responses
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

        // Send welcome message from new assistant
        const newAssistantId = ASSISTANT_IDS[result.assistantTarget.toLowerCase() as keyof typeof ASSISTANT_IDS];
        
        if (newAssistantId && threadId) {
          console.log(`👋 [Worker] Sending welcome message from new assistant: ${result.assistantTarget}`);
          
          try {
            const welcomeResult = await sendMessageAndGetResponse(
              threadId,
              newAssistantId,
              "Olá! Como posso ajudar você?", // Trigger welcome from new assistant
              chatId,
              conversationId
            );

            // Send welcome message to customer
            await sendWhatsAppMessage(fromNumber, welcomeResult.response, evolutionInstance);
            
            // Store welcome message
            await storage.createMessage({
              conversationId,
              role: 'assistant',
              content: welcomeResult.response,
              assistant: result.assistantTarget,
            });

            console.log(`✅ [Worker] Welcome message sent from ${result.assistantTarget}`);
          } catch (welcomeError) {
            console.error(`❌ [Worker] Error sending welcome message:`, welcomeError);
            // Continue anyway - routing was successful
          }
        }
      }

      if (result.resolved) {
        console.log(`✅ [Worker] Conversation resolved`);
        
        await storage.updateConversation(conversationId, {
          status: 'resolved',
          resolvedAt: new Date(),
        });
      }

      // 8. Send response back to customer
      const messageSent = await sendWhatsAppMessage(fromNumber, result.response, evolutionInstance);
      
      if (!messageSent) {
        throw new Error('Failed to send WhatsApp message - Evolution API error');
      }

      // 9. Store AI response (only if message was sent successfully)
      await storage.createMessage({
        conversationId,
        role: 'assistant',
        content: result.response,
        functionCall: result.functionCalls && result.functionCalls.length > 0 
          ? result.functionCalls[0] // Store first function call (most relevant)
          : undefined,
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
  imageAnalysisWorker = new Worker<ImageAnalysisJob>(
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
  npsSurveyWorker = new Worker<NPSSurveyJob>(
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

  console.log('✅ [Workers] Sistema de workers inicializado');
  console.log('👷 [Workers] Workers ativos: 3');
  console.log('⚡ [Workers] Concurrency:');
  console.log('  - Message Processing: 5');
  console.log('  - Image Analysis: 2');
  console.log('  - NPS Survey: 3');
} else {
  console.log('⚠️  [Workers] Redis connection not available - workers disabled');
  console.log('   Webhook will process messages synchronously');
}

// Graceful shutdown
async function closeWorkers() {
  if (messageProcessingWorker || imageAnalysisWorker || npsSurveyWorker) {
    console.log('🔴 Closing workers...');
    if (messageProcessingWorker) await messageProcessingWorker.close();
    if (imageAnalysisWorker) await imageAnalysisWorker.close();
    if (npsSurveyWorker) await npsSurveyWorker.close();
    if (redisConnection) await redisConnection.quit();
    console.log('✅ Workers closed successfully');
  }
}

process.on('SIGTERM', closeWorkers);
process.on('SIGINT', closeWorkers);

// Export workers (may be undefined if Redis is not available)
export { messageProcessingWorker, imageAnalysisWorker, npsSurveyWorker };
