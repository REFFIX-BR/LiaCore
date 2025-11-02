import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import {
  QUEUE_NAMES,
  MessageProcessingJob,
  ImageAnalysisJob,
  NPSSurveyJob,
  InactivityFollowupJob,
  AutoClosureJob,
  addAutoClosureToQueue,
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
import { checkAndNotifyMassiveFailure } from './lib/massive-failure-handler';
import { ContextMonitor } from './lib/context-monitor';

// Helper function to validate and normalize Evolution API instance
// Supported instances: "Leads", "Cobranca", "Principal"
function validateEvolutionInstance(instance?: string): string {
  const allowedInstances = ['Leads', 'Cobranca', 'Principal'];
  
  if (!instance) {
    return 'Leads'; // Default
  }
  
  // Normalize case
  const normalized = instance.charAt(0).toUpperCase() + instance.slice(1).toLowerCase();
  
  if (allowedInstances.includes(normalized)) {
    return normalized;
  }
  
  // If invalid instance, force to Leads
  console.warn(`⚠️ [Evolution] Invalid instance "${instance}" - forcing to "Leads" (allowed: ${allowedInstances.join(', ')})`);
  return 'Leads';
}

// Helper function to send WhatsApp message
async function sendWhatsAppMessage(phoneNumber: string, text: string, instance?: string): Promise<{success: boolean, whatsappMessageId?: string, remoteJid?: string}> {
  // Validate and normalize Evolution API instance (Leads, Cobranca, or Principal)
  const rawInstance = instance || process.env.EVOLUTION_API_INSTANCE || 'Leads';
  const evolutionInstance = validateEvolutionInstance(rawInstance);
  
  if (!instance) {
    console.log(`⚠️ [WhatsApp] Instância não fornecida, usando fallback: ${evolutionInstance}`);
  }
  
  // Tenta API key e URL específicos da instância primeiro, senão usa global (converter para MAIÚSCULAS)
  const apiKey = evolutionInstance 
    ? (process.env[`EVOLUTION_API_KEY_${evolutionInstance.toUpperCase()}`] || process.env.EVOLUTION_API_KEY)
    : process.env.EVOLUTION_API_KEY;
  
  let baseUrl = evolutionInstance
    ? (process.env[`EVOLUTION_API_URL_${evolutionInstance.toUpperCase()}`] || process.env.EVOLUTION_API_URL)
    : process.env.EVOLUTION_API_URL;

  if (!evolutionInstance || !apiKey || !baseUrl) {
    console.error('❌ Evolution API config missing', { 
      evolutionInstance, 
      hasApiKey: !!apiKey, 
      baseUrl,
      triedKey: `EVOLUTION_API_KEY_${evolutionInstance}`,
      triedUrl: `EVOLUTION_API_URL_${evolutionInstance}`
    });
    return {success: false};
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

    // Parse response to get WhatsApp message ID
    const data = await response.json() as any;
    
    return {
      success: true,
      whatsappMessageId: data?.key?.id || undefined,
      remoteJid: data?.key?.remoteJid || undefined,
    };
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return {success: false};
  }
}

// Helper function to send WhatsApp media (images, documents, audio)
export async function sendWhatsAppMedia(
  phoneNumber: string, 
  mediaBase64: string, 
  mediaType: 'image' | 'document' | 'audio',
  caption?: string,
  fileName?: string,
  instance?: string
): Promise<{success: boolean, whatsappMessageId?: string, remoteJid?: string}> {
  // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
  const rawInstance = instance || process.env.EVOLUTION_API_INSTANCE || 'Leads';
  const evolutionInstance = validateEvolutionInstance(rawInstance);
  
  if (!instance) {
    console.log(`⚠️ [WhatsApp Media] Instância não fornecida, usando fallback: ${evolutionInstance}`);
  }
  
  // Tenta API key e URL específicos da instância primeiro, senão usa global (converter para MAIÚSCULAS)
  const apiKey = evolutionInstance 
    ? (process.env[`EVOLUTION_API_KEY_${evolutionInstance.toUpperCase()}`] || process.env.EVOLUTION_API_KEY)
    : process.env.EVOLUTION_API_KEY;
  
  let baseUrl = evolutionInstance
    ? (process.env[`EVOLUTION_API_URL_${evolutionInstance.toUpperCase()}`] || process.env.EVOLUTION_API_URL)
    : process.env.EVOLUTION_API_URL;

  if (!evolutionInstance || !apiKey || !baseUrl) {
    console.error('❌ Evolution API config missing for media', { 
      evolutionInstance, 
      hasApiKey: !!apiKey, 
      baseUrl,
      triedKey: `EVOLUTION_API_KEY_${evolutionInstance}`,
      triedUrl: `EVOLUTION_API_URL_${evolutionInstance}`
    });
    return {success: false};
  }

  // Sanitize and validate URL
  baseUrl = baseUrl.trim();
  
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
    console.log(`⚠️  [WhatsApp Media] URL sem protocolo detectada, adicionando https://: ${baseUrl}`);
  }
  
  baseUrl = baseUrl.replace(/\/$/, '');

  try {
    // Define endpoint baseado no tipo de mídia
    const endpoint = 'sendMedia';
    
    const fullUrl = `${baseUrl}/message/${endpoint}/${evolutionInstance}`;
    console.log(`📤 [WhatsApp Media] Sending ${mediaType} to: ${phoneNumber} via ${fullUrl}`);
    
    // Preparar body no formato correto da Evolution API V1
    // Formato V1: usar mediaMessage objeto (não campos no root)
    
    // Garantir que o base64 tenha o prefixo data URI
    let formattedMedia = mediaBase64;
    if (!formattedMedia.startsWith('data:') && !formattedMedia.startsWith('http')) {
      // Adicionar prefixo baseado no tipo de mídia
      if (mediaType === 'image') {
        formattedMedia = `data:image/jpeg;base64,${mediaBase64}`;
      } else if (mediaType === 'document') {
        formattedMedia = `data:application/pdf;base64,${mediaBase64}`;
      } else if (mediaType === 'audio') {
        formattedMedia = `data:audio/mpeg;base64,${mediaBase64}`;
      }
    }
    
    // Formato híbrido: usar AMBOS mediatype (root) E mediaMessage (objeto)
    // Algumas versões da Evolution API requerem ambos os campos
    const body: any = {
      number: phoneNumber,
      mediatype: mediaType, // Campo no root (requerido por algumas versões)
      mediaMessage: {
        mediaType: mediaType,
        media: formattedMedia,
      }
    };

    // Adicionar campos opcionais ao mediaMessage
    if (mediaType === 'image') {
      if (fileName) body.mediaMessage.fileName = fileName || 'image.jpg';
      if (caption) body.mediaMessage.caption = caption;
    } else if (mediaType === 'document') {
      body.mediaMessage.fileName = fileName || 'document.pdf';
      if (caption) body.mediaMessage.caption = caption;
    } else if (mediaType === 'audio') {
      if (fileName) body.mediaMessage.fileName = fileName || 'audio.mp3';
    }
    
    // Log payload completo para debug
    console.log(`🔍 [WhatsApp Media Debug] Evolution API Hybrid Format - Payload:`, {
      url: fullUrl,
      number: phoneNumber,
      mediatypeRoot: body.mediatype,
      mediaType: body.mediaMessage.mediaType,
      fileName: body.mediaMessage.fileName,
      hasCaption: !!body.mediaMessage.caption,
      mediaPrefix: formattedMedia.substring(0, 40) + '...',
      mediaLength: formattedMedia.length,
      hasDataUriPrefix: formattedMedia.startsWith('data:')
    });
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Evolution API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    
    console.log(`✅ [WhatsApp Media] ${mediaType} sent successfully to ${phoneNumber}`);
    
    return {
      success: true,
      whatsappMessageId: data?.key?.id || undefined,
      remoteJid: data?.key?.remoteJid || undefined,
    };
  } catch (error) {
    console.error(`❌ Error sending WhatsApp ${mediaType}:`, error);
    return {success: false};
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

// Chat-level concurrency lock (prevents parallel processing of same chat messages)
async function acquireChatLock(chatId: string, timeoutMs: number = 30000): Promise<{ acquired: boolean; lockValue?: string }> {
  if (!redisConnection) return { acquired: true }; // No Redis = no lock needed
  
  const lockKey = `chat-processing-lock:${chatId}`;
  const lockValue = `lock-${Date.now()}-${Math.random()}`;
  const maxWaitTime = Date.now() + timeoutMs;
  
  while (Date.now() < maxWaitTime) {
    try {
      // TTL de 60s (tempo máximo razoável para processar uma mensagem)
      const acquired = await redisConnection.set(lockKey, lockValue, 'EX', 60, 'NX');
      
      if (acquired === 'OK') {
        console.log(`🔒 [Worker] Chat lock acquired for ${chatId}`);
        return { acquired: true, lockValue };
      }
      
      // Se não conseguiu, aguarda 200ms e tenta novamente
      console.log(`⏳ [Worker] Waiting for chat lock: ${chatId}...`);
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ [Worker] Error acquiring chat lock for ${chatId}:`, error);
      return { acquired: false };
    }
  }
  
  console.warn(`⏰ [Worker] Chat lock timeout for ${chatId} after ${timeoutMs}ms`);
  return { acquired: false };
}

async function releaseChatLock(chatId: string, lockValue: string): Promise<void> {
  if (!redisConnection) return;
  
  const lockKey = `chat-processing-lock:${chatId}`;
  
  try {
    // Lua script para verificar e deletar atomicamente (só deleta se for meu lock)
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redisConnection.eval(luaScript, 1, lockKey, lockValue);
    
    if (result === 1) {
      console.log(`🔓 [Worker] Chat lock released for ${chatId}`);
    } else {
      console.warn(`⚠️  [Worker] Chat lock for ${chatId} was already released or taken by another worker`);
    }
  } catch (error) {
    console.error(`❌ [Worker] Error releasing chat lock for ${chatId}:`, error);
  }
}

// Workers are only created if Redis is available
let messageProcessingWorker: Worker<MessageProcessingJob> | undefined;
let imageAnalysisWorker: Worker<ImageAnalysisJob> | undefined;
let npsSurveyWorker: Worker<NPSSurveyJob> | undefined;
let inactivityFollowupWorker: Worker<InactivityFollowupJob> | undefined;
let autoClosureWorker: Worker<AutoClosureJob> | undefined;

if (redisConnection) {
  // Worker 1: Process incoming WhatsApp messages
  messageProcessingWorker = new Worker<MessageProcessingJob>(
    QUEUE_NAMES.MESSAGE_PROCESSING,
    async (job: Job<MessageProcessingJob>) => {
      const { chatId, conversationId, message, fromNumber, hasImage, imageUrl, evolutionInstance: rawEvolutionInstance, clientName, messageId } = job.data;
      
      // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
      const evolutionInstance = validateEvolutionInstance(rawEvolutionInstance);

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

    // Acquire chat-level lock to prevent concurrent processing
    const chatLock = await acquireChatLock(chatId);
    
    if (!chatLock.acquired) {
      console.error(`❌ [Worker] Could not acquire chat lock for ${chatId} - message will be retried`);
      throw new Error(`Chat lock timeout for ${chatId} - concurrent processing detected`);
    }

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

      // 2. Cancelar follow-up de inatividade e auto-closure (cliente respondeu)
      try {
        const { cancelInactivityFollowup, cancelAutoClosure } = await import('./lib/queue');
        await cancelInactivityFollowup(conversationId);
        await cancelAutoClosure(conversationId);
        console.log(`✅ [Worker] Follow-up de inatividade e auto-closure cancelados - cliente respondeu`);
      } catch (cancelError) {
        console.error(`❌ [Worker] Erro ao cancelar follow-up/auto-closure:`, cancelError);
        // Não falhar o processamento por causa disso
      }

      // 3. Check if conversation is transferred to human
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

      // 3.5 MASSIVE FAILURE DETECTION - Check for active failures affecting this client
      let multiplePointsContext = '';
      try {
        const failureResult = await checkAndNotifyMassiveFailure(
          conversationId,
          fromNumber,
          conversation.clientDocument,
          evolutionInstance || 'Leads',
          sendWhatsAppMessage
        );

        // Log para debug
        if (failureResult.justNotified) {
          console.log(`✅ [Massive Failure] Cliente ACABOU de ser notificado - IA continua atendimento`);
        } else if (failureResult.alreadyNotified) {
          console.log(`✅ [Massive Failure] Cliente JÁ foi notificado anteriormente - IA continua atendimento`);
        }

        // NUNCA bloquear processamento - apenas notificar UMA VEZ e continuar
        // IA pode transferir para humano se cliente solicitar

        // ✅ IDENTIFICAÇÃO SILENCIOSA DE MÚLTIPLOS PONTOS
        // Sistema identifica múltiplos pontos internamente, mas NÃO afirma ou pergunta ao cliente
        // A IA só deve perguntar se for estritamente necessário para resolver o problema específico
        if (failureResult.needsPointSelection && failureResult.points) {
          console.log(`🔀 [Multiple Points] Cliente possui ${failureResult.points.length} pontos - identificação SILENCIOSA`);
          
          // Injetar apenas dados técnicos, SEM instruções para afirmar/perguntar
          const pointsList = failureResult.points
            .map((p, idx) => `${idx + 1}. ${p.bairro} - ${p.endereco}${p.complemento ? ', ' + p.complemento : ''} (${p.cidade})`)
            .join('\n');

          // ⚠️ NOVO COMPORTAMENTO: Contexto técnico SILENCIOSO - IA não deve mencionar ao cliente
          multiplePointsContext = `\n\n---\n[CONTEXTO INTERNO - NÃO MENCIONAR AO CLIENTE]\nCliente possui ${failureResult.points.length} pontos de instalação:\n${pointsList}\n\n**IDENTIFICAÇÃO SILENCIOSA:**\n- ❌ NÃO afirme: "Vejo que você possui ${failureResult.points.length} pontos de instalação"\n- ❌ NÃO liste os endereços proativamente\n- ✅ PODE perguntar naturalmente: "Qual endereço está com problema?" ou "Para qual endereço você deseja consultar?"\n- ✅ Após cliente mencionar o endereço, use 'selecionar_ponto_instalacao' discretamente\n---\n`;
        }
      } catch (failureError) {
        console.error(`❌ [Massive Failure] Erro ao verificar falha massiva:`, failureError);
        // Não falhar o processamento por causa disso - continuar normalmente
      }

      let enhancedMessage = message;

      // 4. If message has image, process it first
      if (hasImage) {
        console.log(`🖼️ [Worker] Image detected, analyzing...`);
        
        let imageSource = imageUrl;
        
        // Se imageUrl for uma URL S3, baixar primeiro
        if (imageSource && (imageSource.startsWith('http://') || imageSource.startsWith('https://'))) {
          console.log(`🔗 [Worker] imageUrl é URL S3/MinIO, baixando...`);
          console.log(`🔍 [Worker] URL: ${imageSource.substring(0, 100)}...`);
          
          const { downloadMediaFromUrl } = await import('./lib/vision');
          const downloadedBase64 = await downloadMediaFromUrl(imageSource);
          
          if (downloadedBase64) {
            // Detectar formato pela assinatura base64
            let imageFormat = 'jpeg';
            if (downloadedBase64.startsWith('iVBORw')) imageFormat = 'png';
            else if (downloadedBase64.startsWith('/9j/')) imageFormat = 'jpeg';
            else if (downloadedBase64.startsWith('R0lGOD')) imageFormat = 'gif';
            else if (downloadedBase64.startsWith('UklGR')) imageFormat = 'webp';
            
            imageSource = `data:image/${imageFormat};base64,${downloadedBase64}`;
            console.log(`✅ [Worker] Imagem baixada de S3 via imageUrl (${downloadedBase64.length} chars, formato: ${imageFormat})`);
          } else {
            console.error(`❌ [Worker] Falha ao baixar imageUrl de S3: ${imageSource}`);
            imageSource = ''; // Limpar
          }
        }
        
        // Se não tiver imageSource válido, buscar base64 do banco de dados
        if (!imageSource) {
          console.log(`📥 [Worker] No imageUrl, fetching from database...`);
          const messages = await storage.getMessagesByConversationId(conversationId);
          const lastMessage = messages[0]; // Mensagem mais recente
          
          if (lastMessage?.imageBase64) {
            let base64 = lastMessage.imageBase64;
            
            // Se for URL S3, baixar a imagem primeiro
            if (base64.startsWith('http://') || base64.startsWith('https://')) {
              console.log(`🔗 [Worker] Imagem é URL S3/MinIO, baixando...`);
              console.log(`🔍 [Worker] URL: ${base64.substring(0, 100)}...`);
              
              const { downloadMediaFromUrl } = await import('./lib/vision');
              const downloadedBase64 = await downloadMediaFromUrl(base64);
              
              if (downloadedBase64) {
                base64 = downloadedBase64;
                console.log(`✅ [Worker] Imagem baixada com sucesso de S3 (${base64.length} caracteres base64)`);
              } else {
                console.error(`❌ [Worker] Falha ao baixar imagem de S3: ${base64}`);
                base64 = ''; // Limpar para evitar erro
              }
            }
            
            if (base64) {
              // Detectar formato da imagem pela assinatura base64
              let imageFormat = 'jpeg'; // Padrão
              
              if (base64.startsWith('iVBORw')) {
                imageFormat = 'png';
              } else if (base64.startsWith('/9j/')) {
                imageFormat = 'jpeg';
              } else if (base64.startsWith('R0lGOD')) {
                imageFormat = 'gif';
              } else if (base64.startsWith('UklGR')) {
                imageFormat = 'webp';
              }
              
              console.log(`🔍 [Worker] Formato detectado: ${imageFormat}`);
              imageSource = `data:image/${imageFormat};base64,${base64}`;
              console.log(`✅ [Worker] Image base64 prepared (${base64.length} chars)`);
            }
          } else {
            console.warn(`⚠️ [Worker] No image found in database for conversation ${conversationId}`);
          }
        }
        
        if (imageSource) {
          const promptWithContext = message 
            ? `${message}\n\nPor favor, analise a imagem considerando a mensagem do cliente acima.`
            : 'Analise esta imagem em detalhes e extraia todas as informações relevantes. Se for um boleto, extraia identificador, vencimento, valor. Se for um documento, extraia CPF/CNPJ.';
          
          const visionResult = await analyzeImageWithVision(imageSource, promptWithContext);

          if (visionResult) {
            enhancedMessage = message 
              ? `${message}\n\n[Análise da imagem: ${visionResult}]`
              : `[Imagem enviada - ${visionResult}]`;
              
            console.log(`✅ [Worker] Vision analysis completed successfully`);
            
            // Salvar imageUrl original (S3) no metadata da conversa para uso posterior
            if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
              const currentMetadata = conversation.metadata || {};
              await storage.updateConversation(conversationId, {
                metadata: {
                  ...currentMetadata,
                  lastImageUrl: imageUrl,
                  lastImageProcessedAt: new Date().toISOString()
                }
              });
              console.log(`📎 [Worker] Link da imagem salvo no metadata para acesso futuro`);
            }
          }
        }
      }

      // 5. Get or create thread ID
      let threadId = conversation.threadId;
      
      if (!threadId) {
        const { createThread } = await import('./lib/openai');
        threadId = await createThread();
        
        await storage.updateConversation(conversationId, {
          threadId,
        });
      }

      // 6. Get assistant ID from conversation type (use ASSISTANT_IDS from openai.ts)
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

      // 7. Detectar e salvar CPF/CNPJ automaticamente (se presente na mensagem)
      try {
        const { detectClientDocument, persistClientDocument, getPersistedDocument } = await import('./lib/conversation-intelligence');
        
        // Verificar se já existe documento salvo
        const existingDocument = await getPersistedDocument(conversationId);
        
        if (!existingDocument) {
          // Tentar detectar documento na mensagem atual
          const detectedDocument = detectClientDocument(enhancedMessage);
          
          if (detectedDocument) {
            await persistClientDocument(conversationId, detectedDocument);
            console.log(`✅ [Worker] CPF/CNPJ detectado e salvo automaticamente na conversa ${conversationId}`);
          }
        }
      } catch (docError) {
        console.error(`❌ [Worker] Erro ao detectar/salvar documento:`, docError);
        // Não falhar o processamento por causa disso
      }

      // 7.5. Injetar contexto de múltiplos pontos APENAS para assistentes especializados
      // NÃO injetar para Apresentação - ela apenas roteia, não resolve problemas
      if (multiplePointsContext && (conversation.assistantType === 'financeiro' || conversation.assistantType === 'suporte')) {
        enhancedMessage = enhancedMessage + multiplePointsContext;
        console.log(`🔀 [Worker] Contexto de múltiplos pontos injetado na mensagem (assistente: ${conversation.assistantType})`);
      } else if (multiplePointsContext) {
        console.log(`⏭️  [Worker] Contexto de múltiplos pontos NÃO injetado - assistente ${conversation.assistantType} não precisa`);
      }

      // 7.6. 🆕 INTERCEPTOR: Verificar se está aguardando seleção de ponto de instalação
      const { installationPointManager } = await import('./lib/redis-config');
      const isAwaitingPointSelection = await installationPointManager.isAwaitingSelection(conversationId);
      
      if (isAwaitingPointSelection) {
        console.log(`🎯 [Worker] Conversa aguardando seleção de ponto - processando resposta do cliente`);
        
        try {
          // Recuperar menu do Redis
          const menu = await installationPointManager.getMenu(conversationId);
          
          if (!menu) {
            console.warn(`⚠️ [Worker] Menu não encontrado (expirou?) - permitindo IA processar normalmente`);
          } else {
            // Mapear resposta do cliente para número do ponto
            const selectedPointNumber = installationPointManager.mapClientResponseToPointNumber(enhancedMessage, menu);
            
            if (selectedPointNumber === null) {
              console.warn(`⚠️ [Worker] Não foi possível mapear "${enhancedMessage}" para um ponto - pedindo esclarecimento`);
              
              // Enviar mensagem de esclarecimento
              await sendWhatsAppMessage(
                chatId,
                `Desculpe, não consegui identificar qual endereço você quer. Por favor, responda com o número (1, 2, 3...) ou nome do endereço.`,
                evolutionInstance
              );
              
              return { processed: true, selectedPoint: false };
            }
            
            console.log(`✅ [Worker] Cliente selecionou ponto ${selectedPointNumber} - consultando boletos filtrados`);
            
            // Consultar boletos COM filtro de ponto
            const { consultaBoletoCliente } = await import('./ai-tools');
            
            if (!conversation.clientDocument) {
              throw new Error('CPF/CNPJ não disponível para consulta');
            }
            
            const boletosResult = await consultaBoletoCliente(
              conversation.clientDocument,
              { conversationId },
              storage,
              selectedPointNumber // 🎯 Filtrar por ponto selecionado
            );
            
            // Formatar resposta com boletos
            if (!boletosResult.boletos || boletosResult.boletos.length === 0) {
              await sendWhatsAppMessage(
                chatId,
                `✅ O endereço selecionado está EM DIA - sem boletos pendentes!`,
                evolutionInstance
              );
            } else {
              // Formatar boletos
              let mensagem = `📋 *Boletos do endereço selecionado*\n\n`;
              
              boletosResult.boletos!.forEach((boleto, index) => {
                // Formatar data de ISO (YYYY-MM-DD) para BR (DD/MM/YYYY)
                let dataFormatada = boleto.DATA_VENCIMENTO;
                try {
                  if (boleto.DATA_VENCIMENTO?.includes('-')) {
                    const [ano, mes, dia] = boleto.DATA_VENCIMENTO.split('-');
                    dataFormatada = `${dia}/${mes}/${ano}`;
                  }
                } catch (e) {
                  console.warn(`⚠️ [Worker] Erro ao formatar data: ${boleto.DATA_VENCIMENTO}`);
                }
                
                mensagem += `📄 *Fatura TR Telecom*${boleto.STATUS?.toUpperCase().includes('VENCIDO') ? ' *(Vencida)*' : ''}\n`;
                mensagem += `🗓️ *Vencimento:* ${dataFormatada}\n`;
                mensagem += `💰 *Valor:* R$ ${boleto.VALOR_TOTAL}\n\n`;
                mensagem += `📋 *Código de Barras (Linha Digitável):*\n${boleto.CODIGO_BARRA_TRANSACAO}\n\n`;
                mensagem += `📱 *Para Copiar e Colar (SEM espaços):*\n${boleto.CODIGO_BARRA_TRANSACAO.replace(/\D/g, '')}\n\n`;
                mensagem += `🔗 *Link para Pagamento:*\n${boleto.link_carne_completo}\n\n`;
                
                if (boleto.PIX_TXT) {
                  mensagem += `💳 *PIX Copia e Cola:*\n${boleto.PIX_TXT}\n\n`;
                }
                
                if (boletosResult.boletos && index < boletosResult.boletos.length - 1) {
                  mensagem += `---\n\n`;
                }
              });
              
              await sendWhatsAppMessage(chatId, mensagem, evolutionInstance);
            }
            
            // Limpar menu do Redis
            await installationPointManager.deleteMenu(conversationId);
            console.log(`🗑️ [Worker] Menu removido do Redis - seleção processada com sucesso`);
            
            // RETORNAR sem chamar IA
            return { processed: true, selectedPoint: true, pointNumber: selectedPointNumber };
          }
        } catch (error) {
          console.error(`❌ [Worker] Erro ao processar seleção de ponto:`, error);
          // Limpar menu em caso de erro
          await installationPointManager.deleteMenu(conversationId);
          // Permitir que IA processe (fallback)
        }
      }

      // 8. Send message to OpenAI and get response
      let result = await sendMessageAndGetResponse(
        threadId,
        assistantId,
        enhancedMessage,
        chatId,
        conversationId
      );

      // 8. Handle special responses
      if (result.transferred) {
        console.log(`🔀 [Worker] Conversation transferred to human`);
        
        // Map department names to conversation department codes
        const departmentMapping: Record<string, string> = {
          'Suporte Técnico': 'support',
          'Suporte': 'support',
          'Comercial': 'commercial',
          'Financeiro': 'financial',
          'Financial': 'financial',
          'Ouvidoria': 'cancellation',
          'Cancelamento': 'cancellation',
          'Suporte Geral': 'support',
        };
        
        const mappedDepartment = result.transferredTo 
          ? (departmentMapping[result.transferredTo] || 'support')
          : 'support';
        
        await storage.updateConversation(conversationId, {
          status: 'queued',
          transferredToHuman: true,
          department: mappedDepartment,
        });
        
        console.log(`✅ [Worker] Conversation transferred to ${mappedDepartment} department`);
      }

      // Flag para controlar se deve enviar a mensagem da Apresentação
      let shouldSendPresentationMessage = true;

      if (result.routed && result.assistantTarget) {
        console.log(`🎭 [Worker] Routed to assistant: ${result.assistantTarget}`);
        
        await storage.updateConversation(conversationId, {
          assistantType: result.assistantTarget,
        });

        // 🆕 BLOQUEIO: Não enviar mensagem da Apresentação ao rotear
        shouldSendPresentationMessage = false;
        console.log(`🚫 [Worker] Mensagem de despedida bloqueada - evitando confusão do cliente`);
        
        // 🔄 NOVO: Fazer o assistente de destino processar a mensagem original IMEDIATAMENTE
        console.log(`🔄 [Worker] Reprocessando mensagem com novo assistente ${result.assistantTarget}...`);
        
        try {
          // Converter assistantTarget para ID real do assistente
          const { ASSISTANT_IDS } = await import('./lib/openai');
          const newAssistantId = ASSISTANT_IDS[result.assistantTarget as keyof typeof ASSISTANT_IDS];
          
          if (!newAssistantId) {
            throw new Error(`Assistant ID não encontrado para tipo: ${result.assistantTarget}`);
          }
          
          // 🆕 INJETAR CONTEXTO DO ROTEAMENTO: Construir mensagem contextualizada
          // IMPORTANTE: Os assistentes agora têm instruções explícitas para revisar histórico completo
          // Portanto, NÃO precisamos modificar a mensagem original - ela já está no thread OpenAI
          let contextualizedMessage = message;
          
          if (result.routingReason && result.routingReason.trim().length > 0) {
            // Verificar se mensagem é apenas seleção numérica (1, 2, etc.)
            const isSimpleSelection = /^[0-9]{1,2}$/.test(message.trim());
            
            if (isSimpleSelection) {
              // Se é apenas número, SUBSTITUIR pela razão do roteamento
              // Ex: "2" → "Cliente solicitou boleto"
              contextualizedMessage = result.routingReason;
              console.log(`🔀 [Worker] Substituindo seleção numérica "${message}" por contexto: "${contextualizedMessage}"`);
            } else {
              // Se mensagem tem conteúdo real, MANTER MENSAGEM ORIGINAL
              // O assistente vai ler o histórico e terá contexto completo
              contextualizedMessage = message;
              console.log(`🔀 [Worker] Mantendo mensagem original (assistente lerá histórico): "${message}"`);
              console.log(`   Motivo do roteamento (apenas para log): "${result.routingReason}"`);
            }
          } else {
            console.log(`⚠️ [Worker] Sem motivo de roteamento - usando mensagem original: "${message}"`);
          }
          
          // Reprocessar com mensagem contextualizada
          const { sendMessageAndGetResponse } = await import('./lib/openai');
          const newAssistantResult = await sendMessageAndGetResponse(
            threadId,
            newAssistantId,  // ID real do assistente (asst_xxx)
            contextualizedMessage,  // 🆕 Mensagem contextualizada com motivo do roteamento
            chatId,
            conversationId
          );
          
          // Enviar a resposta do novo assistente
          if (newAssistantResult.response) {
            const messageSent = await sendWhatsAppMessage(fromNumber, newAssistantResult.response, evolutionInstance);
            
            if (messageSent.success) {
              // Armazenar resposta do novo assistente
              await storage.createMessage({
                conversationId,
                role: 'assistant',
                content: newAssistantResult.response,
                functionCall: newAssistantResult.functionCalls && newAssistantResult.functionCalls.length > 0 
                  ? newAssistantResult.functionCalls[0]
                  : undefined,
              });
              
              console.log(`✅ [Worker] Novo assistente ${result.assistantTarget} processou e respondeu com sucesso`);
              
              // 🔍 MONITORAR QUALIDADE DE CONTEXTO (após roteamento)
              await ContextMonitor.monitorInteraction(
                conversationId,
                newAssistantResult.response,
                result.assistantTarget
              ).catch(err => console.error('❌ [Context Monitor] Error:', err));
            } else {
              console.error(`❌ [Worker] Falha ao enviar resposta do novo assistente`);
            }
          }
          
          // Atualizar result com os dados do novo assistente para continuar o fluxo normal
          result = newAssistantResult;
        } catch (rerouteError) {
          console.error(`❌ [Worker] Erro ao reprocessar com novo assistente:`, rerouteError);
          // Manter fluxo normal sem resposta em caso de erro
        }
      }

      if (result.resolved) {
        console.log(`✅ [Worker] Conversation resolved by AI`);
        
        // ✅ BUG FIX: Usar método transacional atômico
        await storage.resolveConversation({
          conversationId,
          resolvedBy: null, // IA não tem userId
          resolvedAt: new Date(),
          createActivityLog: false, // IA não cria activity log
        });
      }

      // 9. Send response back to customer (apenas se não houve roteamento)
      if (shouldSendPresentationMessage) {
        // 🚨 FILTRO DE EMERGÊNCIA: Detectar se IA escreveu código de função ao invés de executar
        const debugPatterns = [
          /\*\[EXECUTO:/i,
          /\[EXECUTO:/i,
          /\[use rotear_para_assistente/i,
          /\[use transferir_para_humano/i,
          /\[chama função/i,
          /rotear_para_assistente\(/i,
        ];
        
        const hasDebugCode = debugPatterns.some(pattern => pattern.test(result.response));
        
        if (hasDebugCode) {
          console.error(`🚨🚨🚨 [CRITICAL BUG] IA ESCREVEU CÓDIGO AO INVÉS DE EXECUTAR!`);
          console.error(`🚨 Resposta com debug: ${result.response.substring(0, 200)}...`);
          console.error(`🚨 ConversationId: ${conversationId}, AssistantType: ${conversation.assistantType}`);
          
          // Tentar extrair assistente de destino da mensagem
          const routeMatch = result.response.match(/rotear_para_assistente\(['"](.*?)['"]|EXECUTO:.*?["'](.*?)["']/i);
          const targetAssistant = routeMatch ? (routeMatch[1] || routeMatch[2]) : null;
          
          if (targetAssistant && ['financeiro', 'suporte', 'comercial', 'ouvidoria', 'cancelamento'].includes(targetAssistant.toLowerCase())) {
            console.error(`🔧 [EMERGENCY FIX] Roteando automaticamente para: ${targetAssistant}`);
            
            // Forçar roteamento automático
            await storage.updateConversation(conversationId, {
              assistantType: targetAssistant.toLowerCase(),
              metadata: {
                ...(conversation.metadata || {}),
                emergency_routing: true,
                emergency_routing_at: new Date().toISOString(),
                emergency_routing_reason: 'IA escreveu código ao invés de executar Function Calling',
                blocked_debug_message: result.response,
              }
            });
            
            // Enviar mensagem limpa ao cliente
            const cleanMessage = "Entendi! Estou encaminhando você para o setor correto que vai te ajudar melhor. Aguarde um instante! 😊";
            await sendWhatsAppMessage(fromNumber, cleanMessage, evolutionInstance);
            
            await storage.createMessage({
              conversationId,
              role: 'assistant',
              content: cleanMessage,
              functionCall: undefined,
            });
            
            console.error(`✅ [EMERGENCY FIX] Mensagem de debug bloqueada e roteamento forçado`);
          } else {
            // Se não conseguiu extrair destino, enviar mensagem de erro genérica
            console.error(`❌ [EMERGENCY FIX] Não conseguiu extrair assistente de destino - enviando mensagem de erro`);
            const errorMessage = "Desculpe, houve um probleminha técnico. Vou te transferir para um atendente humano, tudo bem? 😊";
            await sendWhatsAppMessage(fromNumber, errorMessage, evolutionInstance);
            
            await storage.createMessage({
              conversationId,
              role: 'assistant',
              content: errorMessage,
              functionCall: undefined,
            });
            
            // Transferir para humano
            await storage.updateConversation(conversationId, {
              transferredToHuman: true,
              transferredAt: new Date(),
              transferReason: 'Erro crítico: IA escreveu código ao invés de executar',
            });
          }
        } else {
          // Fluxo normal - mensagem está limpa
          const messageSent = await sendWhatsAppMessage(fromNumber, result.response, evolutionInstance);
          
          if (!messageSent.success) {
            throw new Error('Failed to send WhatsApp message - Evolution API error');
          }

          // 10. Store AI response (only if message was sent successfully)
          await storage.createMessage({
            conversationId,
            role: 'assistant',
            content: result.response,
            functionCall: result.functionCalls && result.functionCalls.length > 0 
              ? result.functionCalls[0] // Store first function call (most relevant)
              : undefined,
          });
          
          // 🔍 MONITORAR QUALIDADE DE CONTEXTO (resposta normal)
          await ContextMonitor.monitorInteraction(
            conversationId,
            result.response,
            conversation.assistantType
          ).catch(err => console.error('❌ [Context Monitor] Error:', err));
        }
      } else {
        console.log(`⏩ [Worker] Skipping presentation message - routing already handled`);
      }

      // 11. Handle inactivity follow-up (somente se conversa ainda estiver ativa com IA)
      if (!result.transferred && !result.resolved && conversation.status === 'active') {
        try {
          const { addInactivityFollowupToQueue, cancelInactivityFollowup, cancelAutoClosure } = await import('./lib/queue');
          
          // Cancelar qualquer follow-up e auto-closure anterior agendado (cliente está respondendo)
          await cancelInactivityFollowup(conversationId);
          await cancelAutoClosure(conversationId);
          
          // Agendar novo follow-up para daqui a 10 minutos
          await addInactivityFollowupToQueue({
            conversationId,
            chatId,
            clientId: fromNumber,
            clientName: clientName || 'Cliente',
            evolutionInstance,
            scheduledAt: Date.now(),
            lastClientMessageTime: Date.now(), // Timestamp da última mensagem do cliente
          });
          
          console.log(`⏰ [Worker] Follow-up de inatividade agendado para daqui a 10 minutos`);
        } catch (followupError) {
          console.error(`❌ [Worker] Erro ao agendar follow-up de inatividade:`, followupError);
          // Não falhar o processamento da mensagem por causa disso
        }
      }

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
    } finally {
      // Always release chat lock, even on error
      if (chatLock.lockValue) {
        await releaseChatLock(chatId, chatLock.lockValue);
      }
    }
  },
  {
    connection: redisConnection,
    concurrency: 20, // OTIMIZADO: 20 workers simultâneos (balanceado)
    limiter: {
      max: 50, // OTIMIZADO: 50 jobs/segundo (balanceado)
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
    concurrency: 8, // OTIMIZADO: 8 workers para análise de imagens
  }
);

  // Worker 3: NPS Survey sender
  npsSurveyWorker = new Worker<NPSSurveyJob>(
    QUEUE_NAMES.NPS_SURVEY,
    async (job: Job<NPSSurveyJob>) => {
    const { chatId, conversationId, evolutionInstance: rawEvolutionInstance } = job.data;
    
    // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
    const evolutionInstance = validateEvolutionInstance(rawEvolutionInstance);

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
🌟 *Pesquisa de Satisfação - TR Telecom*

Olá! Seu atendimento foi finalizado 😊

*Sua opinião é muito importante para nós!*

📊 De 0 a 10, o quanto você recomendaria nosso atendimento para um amigo?

• 0 = Não recomendaria de jeito nenhum
• 10 = Recomendaria com certeza!

Por favor, responda apenas com um número de 0 a 10.
      `.trim();

      const surveySent = await sendWhatsAppMessage(chatId, npsMessage, evolutionInstance);
      
      if (!surveySent.success) {
        throw new Error('Failed to send NPS survey - Evolution API error');
      }
      
      console.log(`✅ [NPS Worker] Survey sent via instance: ${evolutionInstance}`);

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
    concurrency: 8, // OTIMIZADO: 8 workers para envio de NPS
  }
  );

  // Worker 4: Inactivity Follow-up
  inactivityFollowupWorker = new Worker<InactivityFollowupJob>(
    QUEUE_NAMES.INACTIVITY_FOLLOWUP,
    async (job: Job<InactivityFollowupJob>) => {
      const { conversationId, chatId, clientId, clientName, evolutionInstance: rawEvolutionInstance, lastClientMessageTime } = job.data;
      
      // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
      const evolutionInstance = validateEvolutionInstance(rawEvolutionInstance);

      // Check idempotency
      if (await isJobProcessed(job.id!)) {
        console.log(`⏭️ [Inactivity Worker] Job already processed, skipping: ${job.id}`);
        return { skipped: true, reason: 'already_processed' };
      }

      console.log(`⏰ [Inactivity Worker] Checking inactivity for conversation ${conversationId}`);

      try {
        // 1. Get current conversation status
        const conversation = await storage.getConversation(conversationId);

        if (!conversation) {
          console.log(`⚠️ [Inactivity Worker] Conversa não existe mais: ${conversationId}`);
          await markJobProcessed(job.id!);
          return { skipped: true, reason: 'conversation_not_found' };
        }

        // 2. Check if conversation is still active and waiting for client response
        if (conversation.status !== 'active') {
          console.log(`⚠️ [Inactivity Worker] Conversa não está mais ativa: ${conversation.status}`);
          await markJobProcessed(job.id!);
          return { skipped: true, reason: 'conversation_not_active' };
        }

        // 3. Check if conversation was transferred to human
        if (conversation.transferredToHuman) {
          console.log(`⚠️ [Inactivity Worker] Conversa foi transferida para humano`);
          await markJobProcessed(job.id!);
          return { skipped: true, reason: 'transferred_to_human' };
        }

        // 4. Check if client sent a new message since we scheduled this job
        if (conversation.lastMessageTime && new Date(conversation.lastMessageTime).getTime() > lastClientMessageTime) {
          console.log(`⚠️ [Inactivity Worker] Cliente já respondeu - cancelando follow-up`);
          await markJobProcessed(job.id!);
          return { skipped: true, reason: 'client_already_responded' };
        }

        // 4.5. Check for farewell pattern (prevent follow-up after goodbyes)
        const recentMessages = await storage.getRecentMessagesByConversationId(conversationId, 5);
        if (recentMessages.length >= 2) {
          const lastMessage = recentMessages[0];
          const secondLastMessage = recentMessages[1];
          
          // Validar que são as mensagens mais recentes e na ordem correta
          if (lastMessage.role !== 'assistant' || secondLastMessage.role !== 'user') {
            console.log(`⚠️ [Farewell Detection] Sequência de mensagens incorreta - pulando detecção`);
          } else {
            // Padrões de despedida do assistente (mantidos)
            const farewellPatterns = [
              /tenha um (ótimo|excelente|bom) dia/i,
              /estou sempre (à disposição|aqui|disponível)/i,
              /se precisar.*chamar/i,
              /fico (feliz|contente) em (ajudar|atender)/i,
              /até (logo|mais|breve)/i,
              /tchau|adeus/i,
              /qualquer (coisa|dúvida).*retornar/i,
              /conte comigo/i,
              /por nada.*disposição/i,
            ];
            
            // Padrões de despedida do cliente - MAIS ESPECÍFICOS (removidos "ok", "blz", "tá bom")
            const clientFarewellPatterns = [
              /^(obg|obrigad[oa]|valeu|vlw)\s*$/i,  // Apenas agradecimentos isolados
              /(tchau|adeus|até (mais|logo|breve))/i,  // Despedidas explícitas
              /muito obrigad[oa]/i,  // Agradecimento enfático
              /^(tá bom|ta bom|beleza).*(tchau|obrigad)/i,  // Combinação de confirmação + despedida
            ];
            
            const aiSaidGoodbye = farewellPatterns.some(pattern => pattern.test(lastMessage.content));
            const clientSaidGoodbye = clientFarewellPatterns.some(pattern => pattern.test(secondLastMessage.content.trim()));
            
            if (aiSaidGoodbye && clientSaidGoodbye) {
              console.log(`👋 [Inactivity Worker] Conversa terminou com despedida - encerrando automaticamente`);
              console.log(`   Cliente: "${secondLastMessage.content}" | IA: "${lastMessage.content.substring(0, 60)}..."`);
              
              // Validar estado da conversa antes de resolver
              const currentConversation = await storage.getConversation(conversationId);
              if (!currentConversation || currentConversation.status !== 'active') {
                console.log(`⚠️ [Auto-Resolve] Conversa ${conversationId} não está mais ativa - pulando auto-resolução`);
                await markJobProcessed(job.id!);
                return { skipped: true, reason: 'conversation_already_resolved' };
              }
              
              // Encerrar a conversa automaticamente
              const existingMetadata = currentConversation.metadata && typeof currentConversation.metadata === 'object' 
                ? currentConversation.metadata as Record<string, any>
                : {};
              
              await storage.resolveConversation({
                conversationId,
                resolvedBy: null, // Sistema automático
                resolvedAt: new Date(),
                createActivityLog: false,
                metadata: {
                  ...existingMetadata,
                  awaitingNPS: true,
                  resolvedBySystem: true,
                  resolveReason: 'Conversa encerrada automaticamente após despedidas mútuas',
                },
              });
              
              console.log(`✅ [Auto-Resolve] Conversa ${conversationId} encerrada automaticamente, enviando NPS...`);
              
              // Enviar pesquisa NPS com captura de resultado
              const npsTemplate = await storage.getMessageTemplateByKey('nps_survey');
              let npsSurveyMessage = npsTemplate?.template || 
                `Olá ${clientName}!\n\nSeu atendimento foi finalizado.\n\nPesquisa de Satisfação\n\nEm uma escala de 0 a 10, qual a satisfação com atendimento?\n\nDigite um número de 0 (muito insatisfeito) a 10 (muito satisfeito)`;
              
              npsSurveyMessage = npsSurveyMessage.replace(/{clientName}/g, clientName);
              
              let npsSent = false;
              try {
                const result = await sendWhatsAppMessage(clientId, npsSurveyMessage, evolutionInstance);
                if (result.success) {
                  console.log(`📊 [NPS] Pesquisa enviada ao cliente ${clientName} após encerramento automático`);
                  npsSent = true;
                } else {
                  console.error(`❌ [NPS] Falha ao enviar pesquisa - Evolution API retornou erro:`, result);
                }
              } catch (error) {
                console.error(`❌ [NPS] Erro ao enviar pesquisa:`, error);
              }
              
              await markJobProcessed(job.id!);
              return { skipped: true, reason: 'conversation_auto_resolved_with_farewell', npsSent };
            }
          }
        }

        // 5. Get message template from database
        const messageTemplates = await storage.getAllMessageTemplates();
        const inactivityTemplate = messageTemplates.find((t) => t.key === 'inactivity_followup');
        
        let followupMessage = `Olá ${clientName}, você está aí? Podemos dar continuidade no atendimento?`; // Fallback
        
        if (inactivityTemplate) {
          // Substituir variáveis no template
          followupMessage = inactivityTemplate.template.replace(/{clientName}/g, clientName);
          console.log(`✅ [Inactivity Worker] Usando template personalizado: ${inactivityTemplate.key}`);
        } else {
          console.warn(`⚠️ [Inactivity Worker] Template de inatividade não encontrado - usando mensagem padrão`);
        }
        
        console.log(`📤 [Inactivity Worker] Enviando mensagem de follow-up para ${clientName}`);
        const messageSent = await sendWhatsAppMessage(clientId, followupMessage, evolutionInstance);

        if (!messageSent.success) {
          throw new Error('Failed to send inactivity follow-up - Evolution API error');
        }

        // 6. Store the follow-up message in conversation
        await storage.createMessage({
          conversationId,
          role: 'assistant',
          content: followupMessage,
        });

        console.log(`✅ [Inactivity Worker] Follow-up enviado com sucesso para ${clientName}`);

        // 7. Schedule auto-closure job (20 minutes after follow-up)
        const followupSentAt = Date.now();
        await addAutoClosureToQueue({
          conversationId,
          chatId,
          clientId,
          clientName,
          evolutionInstance,
          scheduledAt: followupSentAt + (20 * 60 * 1000), // 20 min from now
          followupSentAt,
        });
        
        console.log(`⏰ [Inactivity Worker] Encerramento automático agendado para ${new Date(followupSentAt + (20 * 60 * 1000)).toLocaleString('pt-BR')}`);

        // Mark job as processed
        await markJobProcessed(job.id!);

        return {
          success: true,
          messageSent: true,
          autoClosureScheduled: true,
        };
      } catch (error) {
        console.error(`❌ [Inactivity Worker] Error:`, error);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2,
    }
  );

  // Worker 5: Auto-Closure (encerramento automático por inatividade)
  autoClosureWorker = new Worker<AutoClosureJob>(
    QUEUE_NAMES.AUTO_CLOSURE,
    async (job: Job<AutoClosureJob>) => {
      const { conversationId, chatId, clientId, clientName, evolutionInstance: rawEvolutionInstance, followupSentAt } = job.data;
      
      // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
      const evolutionInstance = validateEvolutionInstance(rawEvolutionInstance);

      // Check idempotency
      if (await isJobProcessed(job.id!)) {
        console.log(`⏭️ [Auto-Closure Worker] Job already processed, skipping: ${job.id}`);
        return { skipped: true, reason: 'already_processed' };
      }

      console.log(`🔒 [Auto-Closure Worker] Verificando encerramento automático para conversa ${conversationId}`);

      try {
        // 1. Get current conversation status
        const conversation = await storage.getConversation(conversationId);

        if (!conversation) {
          console.log(`⚠️ [Auto-Closure Worker] Conversa não existe mais: ${conversationId}`);
          await markJobProcessed(job.id!);
          return { skipped: true, reason: 'conversation_not_found' };
        }

        // 2. Check if conversation is still active
        if (conversation.status !== 'active') {
          console.log(`⚠️ [Auto-Closure Worker] Conversa não está mais ativa: ${conversation.status}`);
          await markJobProcessed(job.id!);
          return { skipped: true, reason: 'conversation_not_active' };
        }

        // 3. Check if conversation was transferred to human
        if (conversation.transferredToHuman) {
          console.log(`⚠️ [Auto-Closure Worker] Conversa foi transferida para humano - cancelando encerramento`);
          await markJobProcessed(job.id!);
          return { skipped: true, reason: 'transferred_to_human' };
        }

        // 4. Check if client sent a message after the follow-up was sent
        if (conversation.lastMessageTime && new Date(conversation.lastMessageTime).getTime() > followupSentAt) {
          console.log(`⚠️ [Auto-Closure Worker] Cliente respondeu após follow-up - cancelando encerramento`);
          await markJobProcessed(job.id!);
          return { skipped: true, reason: 'client_responded_after_followup' };
        }

        // 5. Get closure message template from database
        const messageTemplates = await storage.getAllMessageTemplates();
        const closureTemplate = messageTemplates.find((t) => t.key === 'auto_closure');
        
        let closureMessage = `⚠️ Aviso de encerramento de atendimento\n\nInformamos que, devido à inatividade, este atendimento será encerrado.\nSe precisar de ajuda novamente, basta entrar em contato conosco.`; // Fallback
        
        if (closureTemplate) {
          closureMessage = closureTemplate.template;
          console.log(`✅ [Auto-Closure Worker] Usando template personalizado: ${closureTemplate.key}`);
        } else {
          console.warn(`⚠️ [Auto-Closure Worker] Template de encerramento não encontrado - usando mensagem padrão`);
        }
        
        // 6. Send closure message to WhatsApp
        console.log(`📤 [Auto-Closure Worker] Enviando mensagem de encerramento para ${clientName}`);
        const messageSent = await sendWhatsAppMessage(clientId, closureMessage, evolutionInstance);

        if (!messageSent.success) {
          throw new Error('Failed to send auto-closure message - Evolution API error');
        }

        // 7. Store the closure message in conversation
        await storage.createMessage({
          conversationId,
          role: 'assistant',
          content: closureMessage,
        });

        // ✅ BUG FIX: Usar método transacional atômico
        // 8. Mark conversation as resolved (auto-closed)
        await storage.resolveConversation({
          conversationId,
          resolvedBy: null, // Auto-closure não tem userId
          resolvedAt: new Date(),
          autoClosed: true,
          autoClosedReason: 'inactivity',
          autoClosedAt: new Date(),
          createActivityLog: false, // Não criar activity log para auto-closure
        });

        console.log(`✅ [Auto-Closure Worker] Conversa ${conversationId} encerrada automaticamente por inatividade`);

        // 9. AUTO-SAVE LEAD: Se conversa comercial abandonada, salvar lead "Prospecção"
        if (conversation.assistantType === 'comercial') {
          try {
            // Verificar se já existe uma venda cadastrada para essa conversa
            const { db } = await import('./db');
            const { sales } = await import('../shared/schema');
            const { eq } = await import('drizzle-orm');
            
            const existingSale = await db.query.sales.findFirst({
              where: eq(sales.conversationId, conversationId)
            });
            
            if (!existingSale) {
              // Verificar se a conversa teve engajamento (pelo menos 3+ mensagens do cliente)
              const messages = await storage.getMessagesByConversationId(conversationId);
              const clientMessages = messages.filter((m: any) => m.role === 'user');
              
              if (clientMessages.length >= 3) {
                console.log(`📊 [Auto-Lead] Conversa comercial abandonada com ${clientMessages.length} mensagens do cliente - salvando lead automático`);
                
                // Extrair dados básicos da conversa para salvar o lead
                const leadData = {
                  type: "PF", // Default
                  customerName: clientName || "Lead Automático",
                  phone: clientId.replace(/\D/g, ''), // Remover caracteres não numéricos
                  email: null,
                  city: null,
                  state: null,
                  planId: null,
                  source: "chat",
                  status: "Prospecção",
                  conversationId,
                  observations: `Lead salvo automaticamente - conversa abandonada por inatividade. ${clientMessages.length} mensagens trocadas.`
                };
                
                const savedLead = await storage.addSale(leadData);
                console.log(`✅ [Auto-Lead] Lead Prospecção salvo automaticamente - ID: ${savedLead.id}`);
              } else {
                console.log(`⚠️ [Auto-Lead] Conversa comercial com apenas ${clientMessages.length} mensagens - não salvar lead (mínimo 3)`);
              }
            } else {
              console.log(`⚠️ [Auto-Lead] Venda já existe para conversa ${conversationId} (status: ${existingSale.status}) - não criar lead duplicado`);
            }
          } catch (error) {
            console.error(`❌ [Auto-Lead] Erro ao salvar lead automático:`, error);
            // Não lançar erro - não queremos falhar o auto-closure por causa disso
          }
        }

        // Mark job as processed
        await markJobProcessed(job.id!);

        return {
          success: true,
          messageSent: true,
          conversationClosed: true,
        };
      } catch (error) {
        console.error(`❌ [Auto-Closure Worker] Error:`, error);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2,
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

  inactivityFollowupWorker.on('failed', (job, error) => {
    console.error(`❌ [Inactivity Worker] Failed:`, {
      jobId: job?.id,
      error: error.message,
    });
  });

  autoClosureWorker.on('failed', (job, error) => {
    console.error(`❌ [Auto-Closure Worker] Failed:`, {
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
  console.log('👷 [Workers] Workers ativos: 5');
  console.log('⚡ [Workers] Concurrency (MODERADO - BALANCEADO):');
  console.log('  - Message Processing: 20 workers (50 jobs/s)');
  console.log('  - Image Analysis: 8 workers');
  console.log('  - NPS Survey: 8 workers');
  console.log('  - Inactivity Follow-up: 2 workers');
  console.log('  - Auto-Closure: 2 workers');
} else {
  console.log('⚠️  [Workers] Redis connection not available - workers disabled');
  console.log('   Webhook will process messages synchronously');
}

// Graceful shutdown
async function closeWorkers() {
  if (messageProcessingWorker || imageAnalysisWorker || npsSurveyWorker || inactivityFollowupWorker || autoClosureWorker) {
    console.log('🔴 Closing workers...');
    if (messageProcessingWorker) await messageProcessingWorker.close();
    if (imageAnalysisWorker) await imageAnalysisWorker.close();
    if (npsSurveyWorker) await npsSurveyWorker.close();
    if (inactivityFollowupWorker) await inactivityFollowupWorker.close();
    if (autoClosureWorker) await autoClosureWorker.close();
    if (redisConnection) await redisConnection.quit();
    console.log('✅ Workers closed successfully');
  }
}

process.on('SIGTERM', closeWorkers);
process.on('SIGINT', closeWorkers);

// Export workers (may be undefined if Redis is not available)
export { messageProcessingWorker, imageAnalysisWorker, npsSurveyWorker, inactivityFollowupWorker, autoClosureWorker };
