import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, VoiceWhatsAppCollectionJob, addVoiceWhatsAppCollectionToQueue } from '../../../lib/queue';
import { storage } from '../../../storage';
import { isFeatureEnabled } from '../../../lib/featureFlags';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';
import { createThread } from '../../../lib/openai';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('💬 [Voice WhatsApp] Worker starting...');

function isWithinBusinessHours(date: Date = new Date()): boolean {
  const hours = date.getHours();
  const day = date.getDay();
  
  if (day === 0 || day === 6) {
    return false;
  }
  
  return hours >= 8 && hours < 20;
}

function getNextBusinessHourSlot(): Date {
  const now = new Date();
  const next = new Date(now);
  
  if (!isWithinBusinessHours(now)) {
    if (now.getHours() >= 20) {
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0);
    } else {
      next.setHours(8, 0, 0, 0);
    }
    
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
  }
  
  return next;
}

const worker = new Worker<VoiceWhatsAppCollectionJob>(
  QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION,
  async (job: Job<VoiceWhatsAppCollectionJob>) => {
    const { targetId, campaignId, phoneNumber, clientName, clientDocument, debtAmount, attemptNumber } = job.data;

    console.log(`💬 [Voice WhatsApp] Processing target ${targetId} (attempt ${attemptNumber})`);

    try {
      const isEnabled = await isFeatureEnabled('voice_outbound_enabled');
      if (!isEnabled) {
        console.log(`⚠️ [Voice WhatsApp] Feature flag disabled, skipping`);
        return { success: false, reason: 'feature_disabled' };
      }

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

      // TEMPORARIAMENTE DESABILITADO PARA TESTE FINAL
      // TODO: Reabilitar verificação de horário comercial em produção
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
      
      console.log(`✅ [Voice WhatsApp] Prosseguindo com envio (verificação de horário desabilitada para teste)`);

      // ============================================================================
      // VERIFICAÇÃO PRÉ-ENVIO: Consultar CRM para verificar se já pagou
      // ============================================================================
      if (clientDocument) {
        console.log(`🔍 [Voice WhatsApp] Verificando status de pagamento via CRM para CPF/CNPJ: ${clientDocument}`);
        
        try {
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

      // Formatar número WhatsApp (remover caracteres especiais)
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // IMPORTANTE: Usar formato normalizado consistente com webhook (whatsapp_NUMERO)
      // para garantir que as respostas do cliente sejam processadas na mesma conversa
      const chatId = `whatsapp_${cleanPhone}`;

      // Verificar se já existe conversa para este chatId
      let conversation = await storage.getConversationByChatId(chatId);
      
      if (!conversation) {
        // Criar nova conversa de cobrança com IA Cobrança automaticamente atribuída
        console.log(`📝 [Voice WhatsApp] Criando conversa de cobrança para ${clientName}`);
        conversation = await storage.createConversation({
          chatId,
          clientName,
          clientId: cleanPhone,
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
      // MENSAGEM INICIAL HUMANIZADA (Tom da IA Cobrança)
      // ============================================================================
      console.log(`💬 [Voice WhatsApp] Preparando mensagem humanizada de cobrança...`);
      
      // Mensagem humanizada seguindo o estilo da IA Cobrança
      // A IA vai assumir a conversa quando o cliente responder
      const firstName = clientName.split(' ')[0]; // Apenas primeiro nome
      const message = `Olá ${firstName}!

Aqui é a Lia, assistente virtual da TR Telecom.

Tudo bem? Estou entrando em contato porque identifiquei uma pendência na sua conta.

Podemos conversar rapidinho sobre isso? Estou aqui para te ajudar a regularizar da melhor forma possível.`;

      console.log(`✅ [Voice WhatsApp] Mensagem preparada: "${message.substring(0, 60)}..."`)

      // Enviar mensagem via WhatsApp
      const result = await sendWhatsAppMessage(phoneNumber, message, 'Cobranca');

      // CRITICAL: Verify WhatsApp send success before marking as completed
      if (!result.success) {
        console.error(`❌ [Voice WhatsApp] Failed to send message to ${clientName} - Evolution API error`);
        throw new Error(`Failed to send WhatsApp message: Evolution API returned success=false`);
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
      }
      
      // Adicionar mensagem à thread da OpenAI
      try {
        console.log(`💾 [Voice WhatsApp] Adicionando mensagem inicial à thread ${threadId}`);
        await openai.beta.threads.messages.create(threadId, {
          role: 'assistant',
          content: message,
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
        content: message,
        assistant: 'cobranca', // IA Cobrança especializada
        sendBy: 'ai',
      });

      // Atualizar conversa com última mensagem
      await storage.updateConversation(conversation.id, {
        lastMessage: message,
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
    concurrency: 3, // Reduzido para modo conservador
    limiter: {
      max: 5, // Máximo de 5 mensagens por minuto (modo conservador - compliance WhatsApp)
      duration: 60000,
    },
  }
);

worker.on('completed', (job: Job) => {
  console.log(`✅ [Voice WhatsApp] Job ${job.id} completed`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`❌ [Voice WhatsApp] Job ${job?.id} failed:`, error.message);
});

worker.on('error', (error: Error) => {
  console.error('❌ [Voice WhatsApp] Worker error:', error);
});

console.log('✅ [Voice WhatsApp] Worker ready');

export default worker;
