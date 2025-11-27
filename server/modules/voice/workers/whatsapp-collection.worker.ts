import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, VoiceWhatsAppCollectionJob, addVoiceWhatsAppCollectionToQueue } from '../../../lib/queue';
import { storage } from '../../../storage';
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '../../../lib/whatsapp';
import { whatsappRateLimiter } from '../../../lib/whatsapp-rate-limiter';
import { createThread } from '../../../lib/openai';
import { buildWhatsAppChatId } from '../../../lib/phone-utils';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('💬 [Voice WhatsApp] Worker starting...');

// Função auxiliar para obter horário de Brasília (UTC-3)
function getBrasiliaDate(utcDate: Date = new Date()): Date {
  // Converte UTC para horário de Brasília usando Intl API
  const brasiliaTime = new Date(utcDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brasiliaTime;
}

function isWithinBusinessHours(date: Date = new Date()): boolean {
  // CRITICAL: Sempre usar horário de Brasília para verificação
  const brasiliaDate = getBrasiliaDate(date);
  const hours = brasiliaDate.getHours();
  const day = brasiliaDate.getDay();
  
  // Domingo: fechado
  if (day === 0) {
    return false;
  }
  
  // Sábado: 08h-18h
  if (day === 6) {
    return hours >= 8 && hours < 18;
  }
  
  // Segunda a Sexta: 08h-20h
  return hours >= 8 && hours < 20;
}

function getNextBusinessHourSlot(): Date {
  const now = new Date();
  const brasiliaDate = getBrasiliaDate(now);
  const next = new Date(now);
  
  if (!isWithinBusinessHours(now)) {
    const currentHour = brasiliaDate.getHours();
    const currentDay = brasiliaDate.getDay();
    
    // Sábado após 18h -> segunda 8h
    if (currentDay === 6 && currentHour >= 18) {
      next.setDate(next.getDate() + 2);
      next.setHours(8 + 3, 0, 0, 0); // 8h Brasília = 11h UTC
    } 
    // Dias de semana após 20h -> próximo dia 8h
    else if (currentDay >= 1 && currentDay <= 5 && currentHour >= 20) {
      next.setDate(next.getDate() + 1);
      next.setHours(8 + 3, 0, 0, 0); // 8h Brasília = 11h UTC
    } 
    // Antes das 8h -> mesmo dia 8h
    else {
      next.setHours(8 + 3, 0, 0, 0); // 8h Brasília = 11h UTC
    }
    
    // Pula domingo
    while (getBrasiliaDate(next).getDay() === 0) {
      next.setDate(next.getDate() + 1);
    }
  }
  
  return next;
}

console.log(`🔍 [Voice WhatsApp] Creating worker for queue: ${QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION}`);

const worker = new Worker<VoiceWhatsAppCollectionJob>(
  QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION,
  async (job: Job<VoiceWhatsAppCollectionJob>) => {
    console.log(`💬 [Voice WhatsApp] ==== JOB RECEIVED ==== Job ID: ${job.id}, Name: ${job.name}`);
    const { targetId, campaignId, phoneNumber, clientName, clientDocument, debtAmount, attemptNumber } = job.data;

    console.log(`💬 [Voice WhatsApp] Processing target ${targetId} (attempt ${attemptNumber})`);

    try {
      const target = await storage.getVoiceCampaignTarget(targetId);
      if (!target) {
        throw new Error(`Target ${targetId} não encontrado`);
      }

      if (target.state === 'completed' || target.state === 'failed') {
        console.log(`⚠️ [Voice WhatsApp] Target ${targetId} já finalizado (${target.state})`);
        return { success: false, reason: 'target_completed' };
      }

      const maxAttempts = 3;
      const currentAttempts = target.attemptCount || 0;
      if (currentAttempts >= maxAttempts) {
        console.log(`⚠️ [Voice WhatsApp] Target ${targetId} atingiu máximo de tentativas (${maxAttempts})`);
        await storage.updateVoiceCampaignTarget(targetId, { 
          state: 'failed',
          outcome: 'max_attempts',
          outcomeDetails: 'Máximo de tentativas atingido via WhatsApp',
        });
        return { success: false, reason: 'max_attempts' };
      }

      // TEMPORARIAMENTE DESABILITADO PARA TESTE
      // Verificação de horário comercial (ANATEL compliance)
      // if (!isWithinBusinessHours()) {
      //   const nextSlot = getNextBusinessHourSlot();
      //   console.log(`🕐 [Voice WhatsApp] Fora do horário comercial, reagendando para ${nextSlot.toISOString()}`);
      //   
      //   await addVoiceWhatsAppCollectionToQueue({
      //     targetId,
      //     campaignId,
      //     phoneNumber,
      //     clientName,
      //     clientDocument,
      //     debtAmount,
      //     attemptNumber,
      //   }, nextSlot.getTime() - Date.now());
      //
      //   return { success: true, rescheduled: true, nextSlot };
      // }
      
      console.log(`⚠️ [Voice WhatsApp] MODO TESTE - Horário comercial DESABILITADO`);

      // ============================================================================
      // VERIFICAÇÃO PRÉ-ENVIO: Consultar CRM para verificar se já pagou
      // ============================================================================
      if (clientDocument) {
        console.log(`🔍 [Voice WhatsApp] Verificando status de pagamento via CRM para CPF/CNPJ: ${clientDocument}`);
        
        try {
          // CRITICAL: Validate clientDocument before calling replace()
          if (!clientDocument) {
            console.warn(`⚠️ [Voice WhatsApp] Target ${targetId} has no document - skipping boleto consultation`);
            throw new Error('Cliente sem documento cadastrado - impossível consultar boleto');
          }
          
          // Normalizar documento (remover formatação)
          const documentoNormalizado = clientDocument.replace(/\D/g, '');
          
          // Consultar API de boletos (mesmo endpoint usado pela IA)
          const response = await fetch("https://webhook.trtelecom.net/webhook/consulta_boleto", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ documento: documentoNormalizado }),
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const boletos = await response.json() as any[];
          
          // Se não houver boletos pendentes, cliente já pagou!
          if (!boletos || boletos.length === 0) {
            console.log(`✅ [Voice WhatsApp] Cliente ${clientName} já está em dia - marcando target como 'paid' e pulando envio`);
            
            await storage.updateVoiceCampaignTarget(targetId, {
              state: 'completed',
              outcome: 'paid',
              outcomeDetails: 'Cliente já estava em dia no momento da verificação pré-envio',
              completedAt: new Date(),
            });
            
            return {
              success: true,
              skipped: true,
              reason: 'already_paid',
              clientName,
            };
          }
          
          console.log(`📋 [Voice WhatsApp] Cliente possui ${boletos.length} boleto(s) pendente(s) - verificando promessas...`);
          
        } catch (error) {
          console.error(`❌ [Voice WhatsApp] Erro ao verificar status de pagamento:`, error);
          console.log(`⚠️ [Voice WhatsApp] Continuando com envio por segurança (em caso de erro de API)`);
        }
        
        // ============================================================================
        // VERIFICAÇÃO DE PROMESSAS PENDENTES VÁLIDAS
        // ============================================================================
        // IMPORTANTE: Apenas promessas 'pending' com vencimento FUTURO bloqueiam envio.
        // Promessas 'broken' (quebradas) ou 'fulfilled' (cumpridas) NÃO bloqueiam,
        // permitindo que o cliente receba cobranças diárias até regularizar o pagamento.
        // ============================================================================
        console.log(`🔍 [Voice WhatsApp] Verificando promessas ATIVAS para CPF/CNPJ: ${clientDocument}`);
        
        try {
          const { db } = await import('../../../db');
          const { voicePromises } = await import('../../../../shared/schema');
          const { and, eq, gte } = await import('drizzle-orm');
          
          // Buscar APENAS promessas pendentes com vencimento futuro (promessas ativas)
          // Promessas 'broken' ou 'fulfilled' são ignoradas e NÃO bloqueiam envio
          const now = new Date();
          const pendingPromises = await db.query.voicePromises.findMany({
            where: and(
              eq(voicePromises.contactDocument, clientDocument),
              eq(voicePromises.status, 'pending'),    // Apenas 'pending' bloqueia
              gte(voicePromises.dueDate, now)         // Apenas com vencimento futuro
            ),
            orderBy: (voicePromises, { asc }) => [asc(voicePromises.dueDate)]
          });
          
          if (pendingPromises && pendingPromises.length > 0) {
            const nextPromise = pendingPromises[0];
            
            if (!nextPromise.dueDate) {
              console.warn(`⚠️ [Voice WhatsApp] Promessa ${nextPromise.id} sem data de vencimento - ignorando`);
              console.log(`✅ [Voice WhatsApp] Prosseguindo com envio`);
            } else {
              const dueDate = new Date(nextPromise.dueDate);
              const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              
              console.log(`⏳ [Voice WhatsApp] Cliente tem promessa pendente válida - vencimento: ${dueDate.toISOString()} (${daysUntilDue} dias)`);
              console.log(`✅ [Voice WhatsApp] Pulando envio - cliente prometeu pagar até ${dueDate.toLocaleDateString('pt-BR')}`);
              
              // Não marcar como 'completed', apenas documentar que foi pulado por promessa
              await storage.updateVoiceCampaignTarget(targetId, {
                state: 'contacted', // Mantém como 'contacted' (já foi contatado antes e fez promessa)
                outcome: 'promise_made',
                outcomeDetails: `Cliente possui promessa pendente válida até ${dueDate.toLocaleDateString('pt-BR')}. Envio pulado para evitar contato duplicado durante período de promessa.`,
                updatedAt: new Date(),
              });
              
              return {
                success: true,
                skipped: true,
                reason: 'active_promise',
                promiseId: nextPromise.id,
                dueDate: dueDate.toISOString(),
                daysUntilDue,
                clientName,
              };
            }
          }
          
          console.log(`✅ [Voice WhatsApp] Nenhuma promessa pendente válida encontrada - prosseguindo com envio`);
          
        } catch (error) {
          console.error(`❌ [Voice WhatsApp] Erro ao verificar promessas:`, error);
          console.log(`⚠️ [Voice WhatsApp] Continuando com envio por segurança`);
        }
      } else {
        console.warn(`⚠️ [Voice WhatsApp] CPF/CNPJ não disponível - pulando verificações pré-envio`);
      }
      
      console.log(`✅ [Voice WhatsApp] Enviando mensagem de cobrança para ${phoneNumber}`);
      
      await storage.updateVoiceCampaignTarget(targetId, { 
        state: 'calling',
        attemptCount: currentAttempts + 1,
        lastAttemptAt: new Date(),
      });

      // CRITICAL: phoneNumber already comes normalized from database (55XXXXXXXXXXX)
      // Use helper to build chatId without adding extra "55"
      const chatId = buildWhatsAppChatId(phoneNumber);

      // Verificar se já existe conversa para este chatId
      let conversation = await storage.getConversationByChatId(chatId);
      
      if (!conversation) {
        // Criar nova conversa de cobrança com IA Cobrança automaticamente atribuída
        console.log(`📝 [Voice WhatsApp] Criando conversa de cobrança para ${clientName}`);
        conversation = await storage.createConversation({
          chatId,
          clientName,
          clientId: phoneNumber, // Already normalized (55XXXXXXXXXXX)
          clientDocument: clientDocument || null,
          assistantType: 'cobranca', // IMPORTANTE: IA Cobrança especializada
          department: 'financial',
          status: 'active',
          evolutionInstance: 'Cobranca',
          conversationSource: 'whatsapp_campaign',
          voiceCampaignTargetId: targetId,
        });
        console.log(`✅ [Voice WhatsApp] Conversa criada com IA Cobrança atribuída`);
      } else {
        // Atualizar conversa existente para marcar como campanha de cobrança
        console.log(`🔄 [Voice WhatsApp] Atualizando conversa existente ${conversation.id} para campanha de cobrança`);
        await storage.updateConversation(conversation.id, {
          conversationSource: 'whatsapp_campaign',
          voiceCampaignTargetId: targetId,
          assistantType: 'cobranca', // IA Cobrança
          department: 'financial',
          evolutionInstance: 'Cobranca',
          status: 'active', // Reativar se estiver resolvida
        });
        console.log(`✅ [Voice WhatsApp] Conversa atualizada com IA Cobrança atribuída`);
        
        // Atualizar referência local para ter os campos atualizados
        conversation = await storage.getConversation(conversation.id) || conversation;
      }

      // ============================================================================
      // MENSAGEM DIRETA DE COBRANÇA (Sem template Meta)
      // ============================================================================
      // Estratégia: Envio direto com delay de 5 minutos entre mensagens
      // Mensagens randomizadas para parecer mais natural e evitar detecção de spam
      // ============================================================================
      
      const firstName = clientName.split(' ')[0]; // Apenas primeiro nome
      
      // Array de mensagens variadas para parecer mais natural
      const collectionMessages = [
        `Oi ${firstName}, tudo bem? Aqui é a Lia da TR Telecom! Notei uma pendência na sua conta e queria ver se posso te ajudar a resolver. Podemos conversar?`,
        
        `Olá ${firstName}! Sou a Lia, assistente da TR Telecom. Vi que tem um valor em aberto na sua conta. Posso te ajudar a regularizar de um jeito simples?`,
        
        `E aí ${firstName}, como vai? Aqui é a Lia da TR Telecom. Estou passando porque identifiquei uma pendência no seu cadastro. Bora resolver juntos?`,
        
        `Oi ${firstName}! Tudo certo? Sou a Lia da TR Telecom e preciso falar com você sobre sua conta. Tem um minutinho pra gente conversar?`,
        
        `${firstName}, boa tarde! Aqui é a Lia, da TR Telecom. Vi que você tem uma pendência e queria te ajudar a colocar tudo em dia. Posso te passar as opções?`,
        
        `Olá ${firstName}, aqui é a Lia da TR Telecom! Passando pra lembrar que tem um valor pendente na sua conta. Quer que eu te ajude a resolver isso agora?`,
        
        `Oi ${firstName}! Sou a Lia, assistente virtual da TR Telecom. Notei uma pendência aqui e vim ver como posso te ajudar a regularizar. Vamos conversar?`,
        
        `Hey ${firstName}, tudo bem contigo? Aqui é a Lia da TR Telecom. Preciso conversar sobre sua conta, tem um tempinho?`,
      ];
      
      // Selecionar mensagem aleatória
      const randomIndex = Math.floor(Math.random() * collectionMessages.length);
      const collectionMessage = collectionMessages[randomIndex];
      
      console.log(`💬 [Voice WhatsApp] Enviando mensagem direta para ${clientName} (${phoneNumber}) - Variação #${randomIndex + 1}`);

      // Adquirir token do rate limiter antes de enviar
      console.log('🔑 [Voice WhatsApp] Acquiring rate limiter token...');
      const tokenAcquired = await whatsappRateLimiter.waitForToken(60000); // 60s timeout
      
      if (!tokenAcquired) {
        console.warn('⚠️  [Voice WhatsApp] Failed to acquire rate limiter token - requeueing');
        throw new Error('Rate limit token timeout - will retry');
      }
      
      console.log('✅ [Voice WhatsApp] Rate limiter token acquired');

      // Enviar mensagem direta via WhatsApp (sem template)
      const result = await sendWhatsAppMessage(
        phoneNumber,
        collectionMessage,
        'Cobranca' // CRITICAL: Use accent-free instance name
      );
      
      // Mensagem que será salva no histórico
      const messagePreview = collectionMessage;

      // CRITICAL: Verify WhatsApp send success before marking as completed
      if (!result.success) {
        console.error(`❌ [Voice WhatsApp] Failed to send message to ${clientName} - Evolution API error`);
        
        // Check if this is a permanent failure (credentials/configuration issue)
        if (result.isPermanentFailure) {
          const errorMsg = `PERMANENT FAILURE: WhatsApp template send failed with HTTP ${result.errorStatus}. ` +
            `This is a credentials or configuration issue that won't be fixed by retrying. ` +
            `Fix the Evolution API configuration before resuming campaign.`;
          
          console.error(`🚫 [Voice WhatsApp] ${errorMsg}`);
          
          // Mark target as failed permanently
          await storage.updateVoiceCampaignTarget(targetId, {
            state: 'failed',
            outcome: 'send_failed',
            outcomeDetails: `PERMANENT API FAILURE - HTTP ${result.errorStatus}: ${result.errorMessage?.substring(0, 200)}. Fix Evolution API credentials/configuration before resuming.`,
          });
          
          // Throw error but BullMQ should not retry this job
          const error = new Error(errorMsg);
          (error as any).isPermanent = true; // Custom flag for monitoring
          throw error;
        }
        
        // Transient error - will be retried by BullMQ
        throw new Error(`Failed to send WhatsApp message: Evolution API returned success=false (transient error)`);
      }

      console.log(`✅ [Voice WhatsApp] Mensagem enviada para ${clientName}`);

      // ============================================================================
      // CRITICAL FIX: Adicionar mensagem à thread da OpenAI também!
      // ============================================================================
      
      // Garantir que a conversa tenha uma thread
      let threadId = conversation.threadId;
      
      if (!threadId) {
        console.log(`🔧 [Voice WhatsApp] Criando thread da OpenAI para conversa ${conversation.id}`);
        threadId = await createThread();
        await storage.updateConversation(conversation.id, { threadId });
        console.log(`✅ [Voice WhatsApp] Thread criada: ${threadId}`);
        
        // Adicionar system message com contexto do cliente
        try {
          console.log(`📝 [Voice WhatsApp] Adicionando contexto do cliente à thread`);
          const contextMessage = `CONTEXTO DO CLIENTE:
- Nome: ${clientName}
- Telefone: ${phoneNumber}
${clientDocument ? `- CPF/CNPJ: ${clientDocument}` : ''}
${debtAmount ? `- Débito: R$ ${debtAmount}` : ''}

Use o nome "${clientName.split(' ')[0]}" para se dirigir ao cliente.`;
          
          await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: contextMessage,
          });
          console.log(`✅ [Voice WhatsApp] Contexto do cliente adicionado`);
        } catch (error: any) {
          console.error(`❌ [Voice WhatsApp] Erro ao adicionar contexto:`, error);
        }
      }
      
      // Adicionar mensagem à thread da OpenAI
      try {
        console.log(`💾 [Voice WhatsApp] Adicionando mensagem inicial à thread ${threadId}`);
        await openai.beta.threads.messages.create(threadId, {
          role: 'assistant',
          content: messagePreview,
        });
        console.log(`✅ [Voice WhatsApp] Mensagem adicionada à thread da OpenAI`);
      } catch (error: any) {
        console.error(`❌ [Voice WhatsApp] Erro ao adicionar mensagem à thread:`, error);
        // Não falhar o job inteiro por isso, mas registrar
      }

      // Registrar mensagem no histórico da conversa (IA Cobrança)
      await storage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: messagePreview,
        assistant: 'cobranca', // IA Cobrança especializada
        sendBy: 'ai',
        whatsappMessageId: result.whatsappMessageId || undefined,
        whatsappStatus: result.success ? 'PENDING' : 'ERROR',
        whatsappStatusUpdatedAt: new Date(),
      });

      // Atualizar conversa com última mensagem
      await storage.updateConversation(conversation.id, {
        lastMessage: messagePreview,
        lastMessageTime: new Date(),
      });

      // Atualizar target - a conversa foi criada e está pronta para respostas
      await storage.updateVoiceCampaignTarget(targetId, {
        state: 'contacted',
        outcome: 'whatsapp_sent',
        outcomeDetails: `Mensagem de cobrança enviada via WhatsApp (tentativa ${attemptNumber})`,
        conversationId: conversation.id,
      });

      return {
        success: true,
        messageSent: true,
        phoneNumber,
        conversationId: conversation.id,
      };

    } catch (error: any) {
      console.error(`❌ [Voice WhatsApp] Error processing target ${targetId}:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Uma mensagem por vez (sequencial)
    limiter: {
      max: 1, // Máximo de 1 mensagem por intervalo (WhatsApp rate limiting)
      // WhatsApp Business API aplica rate limiting severo para templates
      // Contas novas: 250 conversas/24h. Delay previne spam detection
      // Configurável via env: WHATSAPP_COLLECTION_DELAY_MS (padrão: 2 minutos)
      duration: parseInt(process.env.WHATSAPP_COLLECTION_DELAY_MS || '120000'), // 2 minutos (120000ms)
    },
  }
);

worker.on('completed', (job: Job) => {
  console.log(`✅ [Voice WhatsApp] Job ${job.id} (${job.name}) completed successfully`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`❌ [Voice WhatsApp] Job ${job?.id} (${job?.name}) failed:`, error.message);
  console.error(`   Stack:`, error.stack);
});

worker.on('error', (error: Error) => {
  console.error('❌ [Voice WhatsApp] Worker error:', error);
  console.error('   Stack:', error.stack);
});

worker.on('active', (job: Job) => {
  console.log(`🎯 [Voice WhatsApp] Job ${job.id} (${job.name}) is now active`);
});

worker.on('stalled', (jobId: string) => {
  console.warn(`⚠️ [Voice WhatsApp] Job ${jobId} stalled`);
});

console.log('✅ [Voice WhatsApp] Worker ready - listening for jobs on queue:', QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION);

export default worker;
