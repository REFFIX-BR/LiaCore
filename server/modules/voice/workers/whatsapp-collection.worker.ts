import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES, VoiceWhatsAppCollectionJob, addVoiceWhatsAppCollectionToQueue } from '../../../lib/queue';
import { storage } from '../../../storage';
import { isFeatureEnabled } from '../../../lib/featureFlags';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';

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

      if (!isWithinBusinessHours()) {
        const nextSlot = getNextBusinessHourSlot();
        console.log(`🕐 [Voice WhatsApp] Fora do horário comercial, reagendando para ${nextSlot.toISOString()}`);
        
        await addVoiceWhatsAppCollectionToQueue({
          targetId,
          campaignId,
          phoneNumber,
          clientName,
          clientDocument,
          debtAmount,
          attemptNumber,
        }, nextSlot.getTime() - Date.now());

        return { success: true, rescheduled: true, nextSlot };
      }

      console.log(`✅ [Voice WhatsApp] Enviando mensagem de cobrança para ${phoneNumber}`);
      
      await storage.updateVoiceCampaignTarget(targetId, { 
        state: 'calling',
        attemptCount: currentAttempts + 1,
        lastAttemptAt: new Date(),
      });

      // Formatar número WhatsApp (remover caracteres especiais)
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const chatId = `${cleanPhone}@s.whatsapp.net`;

      // Verificar se já existe conversa para este chatId
      let conversation = await storage.getConversationByChatId(chatId);
      
      if (!conversation) {
        // Criar nova conversa de cobrança
        console.log(`📝 [Voice WhatsApp] Criando conversa de cobrança para ${clientName}`);
        conversation = await storage.createConversation({
          chatId,
          clientName,
          clientId: cleanPhone,
          clientDocument: clientDocument || null,
          assistantType: 'financeiro',
          department: 'financial',
          status: 'active',
          evolutionInstance: 'Cobranca',
          conversationSource: 'whatsapp_campaign',
          voiceCampaignTargetId: targetId,
        });
      } else {
        // Atualizar conversa existente para marcar como campanha de cobrança
        console.log(`🔄 [Voice WhatsApp] Atualizando conversa existente ${conversation.id} para campanha de cobrança`);
        await storage.updateConversation(conversation.id, {
          conversationSource: 'whatsapp_campaign',
          voiceCampaignTargetId: targetId,
          assistantType: 'financeiro',
          department: 'financial',
          evolutionInstance: 'Cobranca',
          status: 'active', // Reativar se estiver resolvida
        });
        
        // Atualizar referência local para ter os campos atualizados
        conversation = await storage.getConversation(conversation.id) || conversation;
      }

      // Formatar valor da dívida
      const debtValue = (debtAmount / 100).toFixed(2).replace('.', ',');

      // Mensagem de cobrança personalizada
      const message = `Olá ${clientName}!

Aqui é a TR Telecom. Identificamos uma pendência financeira de *R$ ${debtValue}* em sua conta.

Para regularizar sua situação e evitar a suspensão dos serviços, podemos te ajudar com:
• Negociação de pagamento
• Emissão de segunda via do boleto
• Parcelamento facilitado

Como podemos ajudar?`;

      // Enviar mensagem via WhatsApp
      const result = await sendWhatsAppMessage(phoneNumber, message, 'Cobranca');

      // CRITICAL: Verify WhatsApp send success before marking as completed
      if (!result.success) {
        console.error(`❌ [Voice WhatsApp] Failed to send message to ${clientName} - Evolution API error`);
        throw new Error(`Failed to send WhatsApp message: Evolution API returned success=false`);
      }

      console.log(`✅ [Voice WhatsApp] Mensagem enviada para ${clientName}`);

      // Registrar mensagem no histórico da conversa
      await storage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: message,
        assistant: 'financeiro',
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
    concurrency: 5, // Permite múltiplas mensagens simultâneas
    limiter: {
      max: 10, // Máximo de 10 mensagens por minuto (compliance WhatsApp)
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
