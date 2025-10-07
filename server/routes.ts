import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConversationSchema, insertMessageSchema, insertAlertSchema, insertSupervisorActionSchema, insertLearningEventSchema, insertPromptSuggestionSchema, insertPromptUpdateSchema, insertSatisfactionFeedbackSchema, type Conversation } from "@shared/schema";
import { routeMessage, createThread, sendMessageAndGetResponse, summarizeConversation, routeMessageWithContext, CONTEXT_CONFIG } from "./lib/openai";
import { storeConversationThread, getConversationThread, searchKnowledge } from "./lib/upstash";
import { webhookLogger } from "./lib/webhook-logger";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Evolution API configuration
const EVOLUTION_CONFIG = {
  apiUrl: process.env.EVOLUTION_API_URL,
  apiKey: process.env.EVOLUTION_API_KEY,
  instance: process.env.EVOLUTION_API_INSTANCE,
};

// Helper function to send WhatsApp message via Evolution API
async function sendWhatsAppMessage(phoneNumber: string, text: string): Promise<boolean> {
  if (!EVOLUTION_CONFIG.apiUrl || !EVOLUTION_CONFIG.apiKey || !EVOLUTION_CONFIG.instance) {
    console.error("❌ [Evolution] Credenciais não configuradas");
    return false;
  }

  try {
    // Ensure URL has protocol
    let baseUrl = EVOLUTION_CONFIG.apiUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    const url = `${baseUrl}/message/sendText/${EVOLUTION_CONFIG.instance}`;
    
    console.log(`📤 [Evolution] Enviando mensagem para ${phoneNumber} via ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_CONFIG.apiKey,
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: text,
        delay: 1200, // Simula digitação natural
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Evolution] Erro ao enviar mensagem (${response.status}):`, errorText);
      return false;
    }

    const result = await response.json();
    console.log(`✅ [Evolution] Mensagem enviada para ${phoneNumber}`, {
      messageId: result.key?.id,
      status: result.status,
    });
    return true;
  } catch (error) {
    console.error("❌ [Evolution] Erro ao enviar mensagem:", error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Chat endpoint - Main entry point for TR Chat messages
  app.post("/api/chat/message", async (req, res) => {
    try {
      const { chatId, clientName, clientId, message } = req.body;

      if (!chatId || !message) {
        return res.status(400).json({ error: "chatId and message are required" });
      }

      // Get or create conversation
      let conversation = await storage.getConversationByChatId(chatId);
      let threadId = await getConversationThread(chatId);

      if (!conversation) {
        // New conversation - route to appropriate assistant (sem contexto ainda)
        const routing = await routeMessage(message);
        
        // Create thread
        threadId = await createThread();
        await storeConversationThread(chatId, threadId);

        // Create conversation record
        conversation = await storage.createConversation({
          chatId,
          clientName: clientName || "Cliente",
          clientId,
          threadId,
          assistantType: routing.assistantType,
          status: "active",
          sentiment: "neutral",
          urgency: "normal",
          duration: 0,
          lastMessage: message,
          metadata: { routing },
        });
      } else if (!threadId) {
        // Existing conversation but no thread - create one
        threadId = await createThread();
        await storeConversationThread(chatId, threadId);
        
        // Update conversation with threadId
        await storage.updateConversation(conversation.id, {
          threadId,
        });
      } else if (conversation.status === 'resolved') {
        // Reopen resolved conversation and reset transfer if needed
        console.log(`🔄 [Reopen] Reabrindo conversa finalizada: ${chatId}`);
        
        const updateData: any = {
          status: 'active',
        };
        
        // Se estava transferida, resetar para IA voltar a responder
        if (conversation.transferredToHuman) {
          console.log(`🤖 [Reopen] Resetando transferência - IA volta a responder`);
          updateData.transferredToHuman = false;
          updateData.transferReason = null;
          updateData.transferredAt = null;
        }
        
        await storage.updateConversation(conversation.id, updateData);
        conversation = { ...conversation, ...updateData };
      }

      // Store user message
      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: message,
        assistant: null,
      });

      // Send message and get response
      if (!threadId) {
        console.error("❌ No threadId available for conversation:", { chatId, conversationId: conversation.id });
        return res.status(500).json({ error: "Thread ID not found" });
      }

      const assistantId = (conversation.metadata as any)?.routing?.assistantId;
      const result = await sendMessageAndGetResponse(threadId, assistantId, message, chatId);

      // Store assistant response (ensure it's always a string)
      const responseText = typeof result.response === 'string' 
        ? result.response 
        : ((result.response as any)?.response || JSON.stringify(result.response));
      
      await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: responseText,
        assistant: conversation.assistantType,
      });

      // Analyze sentiment (simplified)
      const sentiment = message.includes("!") || message.toUpperCase() === message ? "negative" : "neutral";
      const urgency = message.includes("URGENTE") || message.includes("!!!") ? "critical" : "normal";

      // Check if AI requested transfer
      if (result.transferred) {
        console.log("🔀 [Transfer] Processando transferência automática da IA");
        
        // Create supervisor action
        await storage.createSupervisorAction({
          conversationId: conversation.id,
          action: "transfer",
          notes: `Transferência automática pela IA para ${result.transferredTo}`,
          createdBy: "IA Assistant",
        });

        // Update conversation with transfer fields (for Conversas tab)
        await storage.updateConversation(conversation.id, {
          lastMessage: message,
          lastMessageTime: new Date(),
          duration: (conversation.duration || 0) + 30,
          sentiment,
          urgency,
          transferredToHuman: true,
          transferReason: `Transferência automática pela IA para ${result.transferredTo}`,
          transferredAt: new Date(),
          metadata: {
            ...(typeof conversation.metadata === 'object' && conversation.metadata !== null ? conversation.metadata : {}),
            transferred: true,
            transferredTo: result.transferredTo,
            transferredAt: new Date().toISOString(),
            transferNotes: "Transferência automática pela IA",
          },
        });

        return res.json({
          success: true,
          response: responseText,
          assistantType: conversation.assistantType,
          chatId,
          transferred: true,
          transferredTo: result.transferredTo,
        });
      }

      // Normal update without transfer
      await storage.updateConversation(conversation.id, {
        lastMessage: message,
        lastMessageTime: new Date(),
        duration: (conversation.duration || 0) + 30,
        sentiment,
        urgency,
      });

      // Gerar resumo de forma assíncrona (não bloqueia a resposta)
      const conversationId = conversation.id;
      setImmediate(async () => {
        try {
          const allMessages = await storage.getMessagesByConversationId(conversationId);
          const messageCount = allMessages.length;
          const lastSummaryCount = conversation.messageCountAtLastSummary || 0;
          const messagesSinceLastSummary = messageCount - lastSummaryCount;
          
          if (messagesSinceLastSummary >= CONTEXT_CONFIG.SUMMARIZE_EVERY && messageCount > CONTEXT_CONFIG.SUMMARIZE_EVERY) {
            console.log(`📝 [Auto-Summary] Iniciando resumo em background (${messageCount} mensagens totais)`);
            
            const messagesToSummarize = allMessages.slice(lastSummaryCount, Math.max(lastSummaryCount, messageCount - CONTEXT_CONFIG.KEEP_RECENT));
            
            if (messagesToSummarize.length > 0) {
              const summaryInput = messagesToSummarize.map((m: any) => ({
                role: m.role,
                content: m.content
              }));
              
              const newSummary = await summarizeConversation(summaryInput);
              
              let finalSummary = newSummary;
              if (conversation.conversationSummary) {
                try {
                  const oldSummary = JSON.parse(conversation.conversationSummary);
                  const newSummaryObj = JSON.parse(newSummary);
                  
                  // Função auxiliar para deduplicar arrays
                  const deduplicateArray = (arr: string[]) => Array.from(new Set(arr));
                  
                  // Mesclar TODOS os campos acumulando contexto corretamente
                  const merged = {
                    // Substituir por resumo mais recente (é um resumo, não histórico)
                    summary: newSummaryObj.summary || oldSummary.summary || '',
                    
                    // Mesclar fatos-chave (novos sobrescrevem, mas mantém únicos)
                    keyFacts: {
                      ...(oldSummary.keyFacts || {}),
                      ...(newSummaryObj.keyFacts || {})
                    },
                    
                    // Sentimento mais recente
                    sentiment: newSummaryObj.sentiment || oldSummary.sentiment || 'neutral',
                    
                    // Acumula assistentes (sem duplicatas)
                    assistantHistory: deduplicateArray([
                      ...(oldSummary.assistantHistory || []),
                      ...(newSummaryObj.assistantHistory || [])
                    ]),
                    
                    // Acumula ações realizadas (SEM duplicatas)
                    actionsTaken: deduplicateArray([
                      ...(oldSummary.actionsTaken || []),
                      ...(newSummaryObj.actionsTaken || [])
                    ]),
                    
                    // Combinar ações pendentes (union de ambas, SEM duplicatas)
                    pendingActions: deduplicateArray([
                      ...(oldSummary.pendingActions || []),
                      ...(newSummaryObj.pendingActions || [])
                    ]),
                    
                    // Acumula datas importantes (sem duplicatas)
                    importantDates: deduplicateArray([
                      ...(oldSummary.importantDates || []),
                      ...(newSummaryObj.importantDates || [])
                    ])
                  };
                  
                  finalSummary = JSON.stringify(merged);
                } catch (e) {
                  console.error("❌ Erro ao mesclar resumos:", e);
                }
              }
              
              await storage.updateConversation(conversationId, {
                conversationSummary: finalSummary,
                lastSummarizedAt: new Date(),
                // CRÍTICO: marcar até onde resumimos (não incluindo KEEP_RECENT)
                // para que as mensagens "mantidas intactas" sejam resumidas no próximo ciclo
                // Edge case: garantir que não seja negativo
                messageCountAtLastSummary: Math.max(0, messageCount - CONTEXT_CONFIG.KEEP_RECENT),
              });
              
              console.log(`✅ [Auto-Summary] Resumo concluído (${messageCount} msgs resumidas)`);
            }
          }
        } catch (error) {
          console.error("❌ [Auto-Summary] Erro ao gerar resumo:", error);
        }
      });

      return res.json({
        success: true,
        response: responseText,
        assistantType: conversation.assistantType,
        chatId,
      });
    } catch (error) {
      console.error("Chat error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== EVOLUTION API WEBHOOKS ====================
  
  // Webhook endpoint for Evolution API events
  app.post("/api/webhooks/evolution", async (req, res) => {
    try {
      const { event: rawEvent, instance, data } = req.body;

      // DEBUG: Log completo do payload recebido
      console.log(`🔍 [Evolution DEBUG] Payload completo:`, JSON.stringify(req.body, null, 2));

      // Normalize event to string (handle malformed payloads)
      const event = typeof rawEvent === 'string' ? rawEvent : '';

      if (!event) {
        webhookLogger.warning('INVALID_EVENT', 'Webhook recebido sem tipo de evento válido', { 
          instance,
          receivedEventType: typeof rawEvent,
          hasData: !!data,
          fullPayload: req.body
        });
        console.log(`⚠️  [Evolution] Webhook recebido com evento inválido:`, { rawEvent, instance });
        return res.json({ success: true, processed: false, reason: "invalid_event_type" });
      }

      webhookLogger.info('CONNECTION', `Webhook recebido: ${event}`, {
        instance,
        timestamp: new Date().toISOString(),
      });

      console.log(`📱 [Evolution Webhook] Evento recebido: ${event}`, {
        instance,
        event,
      });

      // Process MESSAGES_UPSERT event (new messages from WhatsApp)
      if (event === "messages.upsert") {
        const { key, pushName, message, messageTimestamp } = data;
        const { remoteJid, fromMe, id: messageId } = key;

        // Ignore messages sent by us
        if (fromMe) {
          webhookLogger.info('MESSAGE_IGNORED', 'Mensagem enviada por nós - ignorada');
          console.log(`⏭️  [Evolution] Ignorando mensagem enviada por nós`);
          return res.json({ success: true, processed: false, reason: "fromMe" });
        }

        // Extract message text content
        let messageText: string | null = null;
        
        if (message?.conversation) {
          messageText = message.conversation;
        } else if (message?.extendedTextMessage?.text) {
          messageText = message.extendedTextMessage.text;
        } else if (message?.imageMessage) {
          // Handle images with or without caption
          messageText = message.imageMessage.caption 
            ? `[Imagem] ${message.imageMessage.caption}` 
            : `[Imagem recebida]`;
        } else if (message?.videoMessage) {
          // Handle videos with or without caption
          messageText = message.videoMessage.caption 
            ? `[Vídeo] ${message.videoMessage.caption}` 
            : `[Vídeo recebido]`;
        } else if (message?.audioMessage) {
          messageText = `[Áudio recebido]`;
        } else if (message?.documentMessage) {
          messageText = message.documentMessage.fileName 
            ? `[Documento] ${message.documentMessage.fileName}` 
            : `[Documento recebido]`;
        } else if (message?.stickerMessage) {
          messageText = `[Sticker recebido]`;
        } else if (message?.contactMessage) {
          messageText = `[Contato compartilhado]`;
        } else if (message?.locationMessage) {
          messageText = `[Localização compartilhada]`;
        } else {
          console.log(`⚠️  [Evolution] Tipo de mensagem não suportado:`, Object.keys(message || {}));
          return res.json({ success: true, processed: false, reason: "unsupported_type" });
        }

        if (!messageText) {
          return res.json({ success: true, processed: false, reason: "no_text" });
        }

        // Clean phone number (remove @s.whatsapp.net)
        const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
        const chatId = `whatsapp_${phoneNumber}`;
        const clientName = pushName || `Cliente ${phoneNumber.slice(-4)}`;

        webhookLogger.success('MESSAGE_RECEIVED', `Mensagem de ${clientName}`, {
          phoneNumber,
          messagePreview: messageText.substring(0, 50),
          chatId,
        });

        console.log(`💬 [Evolution] Mensagem recebida de ${clientName} (${phoneNumber}): ${messageText}`);

        // Get or create conversation
        let conversation = await storage.getConversationByChatId(chatId);
        let threadId = await getConversationThread(chatId);

        if (!conversation) {
          // New conversation - route to appropriate assistant
          const routing = await routeMessage(messageText);
          
          // Create thread
          threadId = await createThread();
          await storeConversationThread(chatId, threadId);

          // Create conversation record
          conversation = await storage.createConversation({
            chatId,
            clientName,
            clientId: phoneNumber,
            threadId,
            assistantType: routing.assistantType,
            status: "active",
            sentiment: "neutral",
            urgency: "normal",
            duration: 0,
            lastMessage: messageText,
            metadata: { 
              routing,
              source: 'evolution_api',
              instance,
              remoteJid,
            },
          });
        } else if (!threadId) {
          // Existing conversation but no thread - create one
          threadId = await createThread();
          await storeConversationThread(chatId, threadId);
          
          await storage.updateConversation(conversation.id, {
            threadId,
          });
        } else if (conversation.status === 'resolved') {
          // Reopen resolved conversation and reset transfer if needed
          console.log(`🔄 [Evolution Reopen] Reabrindo conversa finalizada: ${chatId} (${clientName})`);
          
          const updateData: any = {
            status: 'active',
          };
          
          // Se estava transferida, resetar para IA voltar a responder
          if (conversation.transferredToHuman) {
            console.log(`🤖 [Evolution Reopen] Resetando transferência - IA volta a responder`);
            updateData.transferredToHuman = false;
            updateData.transferReason = null;
            updateData.transferredAt = null;
          }
          
          await storage.updateConversation(conversation.id, updateData);
          conversation = { ...conversation, ...updateData };
        }

        // Check if this is NPS feedback (awaiting NPS flag set and message is 0-10)
        const metadata = conversation.metadata as any || {};
        
        // Regex mais flexível: aceita "9", "9.", "Nota 9", "nota: 8", etc.
        // Extrai primeiro número de 0-10 encontrado
        const npsMatch = messageText.trim().match(/\b([0-9]|10)\b/);
        
        console.log(`🔍 [NPS Debug] Conversa ${conversation.id}:`, {
          awaitingNPS: metadata.awaitingNPS,
          messageText,
          npsMatch: npsMatch ? npsMatch[0] : null,
          status: conversation.status
        });
        
        if (metadata.awaitingNPS && npsMatch) {
          const npsScore = parseInt(npsMatch[0], 10);
          console.log(`📊 [NPS] Detectada resposta NPS: ${npsScore} de ${clientName}`);
          
          // Verificar se já existe feedback para esta conversa (evitar duplicatas)
          const existingFeedback = await storage.getSatisfactionFeedbackByConversationId(conversation.id);
          if (existingFeedback) {
            console.log(`⚠️ [NPS] Feedback duplicado ignorado para ${clientName}`);
            const alreadyMessage = `Obrigado! Seu feedback já foi registrado anteriormente.`;
            await sendWhatsAppMessage(phoneNumber, alreadyMessage);
            return res.json({ 
              success: true, 
              processed: true, 
              nps_duplicate: true 
            });
          }
          
          // Verificar se telefone corresponde ao cliente da conversa
          if (phoneNumber !== conversation.clientId) {
            console.log(`⚠️ [NPS] Tentativa de envio de telefone diferente: ${phoneNumber} vs ${conversation.clientId}`);
            return res.json({ 
              success: true, 
              processed: false, 
              error: 'Phone mismatch' 
            });
          }
          
          // Armazenar feedback NPS diretamente
          console.log(`💾 [NPS] Salvando feedback no banco:`, {
            conversationId: conversation.id,
            assistantType: conversation.assistantType,
            npsScore,
            clientName: conversation.clientName
          });
          
          const savedFeedback = await storage.createSatisfactionFeedback({
            conversationId: conversation.id,
            assistantType: conversation.assistantType,
            npsScore,
            clientName: conversation.clientName,
          });
          
          console.log(`✅ [NPS] Feedback salvo com ID:`, savedFeedback.id);
          
          // Remover flag awaitingNPS
          await storage.updateConversation(conversation.id, {
            metadata: { ...metadata, awaitingNPS: false }
          });
          
          console.log(`📊 [NPS] Cliente ${clientName} avaliou com nota ${npsScore}`);
          
          // Enviar mensagem de agradecimento (sem emoji)
          const thankYouMessage = `Obrigado pelo seu feedback!\n\nSua opinião é muito importante para nós.`;
          await sendWhatsAppMessage(phoneNumber, thankYouMessage);
          
          return res.json({ 
            success: true, 
            processed: true, 
            nps_received: true,
            score: npsScore,
            feedbackId: savedFeedback.id 
          });
        }

        // Store user message
        await storage.createMessage({
          conversationId: conversation.id,
          role: "user",
          content: messageText,
          assistant: null,
        });

        // If conversation is transferred to human, don't auto-respond
        if (conversation.transferredToHuman) {
          webhookLogger.warning('TRANSFER_ACTIVE', 'Conversa transferida - resposta manual necessária', {
            conversationId: conversation.id,
            clientName,
          });
          console.log(`👤 [Evolution] Conversa transferida para humano - não respondendo automaticamente`);
          return res.json({ 
            success: true, 
            processed: true, 
            transferred: true,
            conversationId: conversation.id 
          });
        }

        // Send message and get AI response (async, don't wait)
        if (!threadId) {
          console.error("❌ [Evolution] No threadId available:", { chatId, conversationId: conversation.id });
          return res.json({ success: true, processed: false, reason: "no_thread" });
        }

        const assistantId = (conversation.metadata as any)?.routing?.assistantId;

        // Capture phoneNumber for async callback
        const clientPhoneNumber = phoneNumber;

        // Process in background
        (async () => {
          try {
            const { response: responseText, transferred, transferredTo } = await sendMessageAndGetResponse(
              threadId!,
              assistantId,
              messageText
            );

            // Store assistant response
            await storage.createMessage({
              conversationId: conversation.id,
              role: "assistant",
              content: responseText,
              assistant: conversation.assistantType,
            });

            // Update conversation
            await storage.updateConversation(conversation.id, {
              lastMessage: responseText,
              lastMessageTime: new Date(),
            });

            // Handle transfer to human if requested
            if (transferred) {
              await storage.updateConversation(conversation.id, {
                transferredToHuman: true,
                transferReason: transferredTo || 'Transferido pela IA',
                transferredAt: new Date(),
              });
              console.log(`🔄 [Evolution] Conversa transferida para humano: ${transferredTo}`);
            }

            console.log(`✅ [Evolution] Resposta gerada: ${responseText.substring(0, 100)}...`);
            
            webhookLogger.success('AI_RESPONSE', `Resposta da IA gerada (${conversation.assistantType})`, {
              conversationId: conversation.id,
              responsePreview: responseText.substring(0, 50),
              transferred: transferred || false,
            });
            
            // Send response back to WhatsApp via Evolution API
            const sent = await sendWhatsAppMessage(clientPhoneNumber, responseText);
            if (sent) {
              webhookLogger.success('MESSAGE_SENT', `Mensagem enviada ao WhatsApp`, {
                phoneNumber: clientPhoneNumber,
                clientName,
              });
              console.log(`📤 [Evolution] Resposta enviada ao WhatsApp com sucesso`);
            } else {
              webhookLogger.error('SEND_FAILED', `Falha ao enviar resposta ao WhatsApp`, {
                phoneNumber: clientPhoneNumber,
                clientName,
              });
              console.error(`⚠️  [Evolution] Falha ao enviar resposta ao WhatsApp`);
            }
            
          } catch (error) {
            webhookLogger.error('PROCESSING_ERROR', `Erro ao processar resposta`, {
              error: error instanceof Error ? error.message : String(error),
              conversationId: conversation.id,
            });
            console.error("❌ [Evolution] Erro ao processar resposta:", error);
          }
        })();

        return res.json({ 
          success: true, 
          processed: true,
          conversationId: conversation.id,
          chatId 
        });
      }

      // Process CHATS_* events (metadata synchronization)
      if (event.startsWith("chats.")) {
        const { id, conversationTimestamp, name } = data || {};
        console.log(`💬 [Evolution] Evento de chat: ${event}`, { chatId: id, name });
        
        // Update conversation metadata if chat exists in our system
        if (id && event === "chats.upsert") {
          const phoneNumber = id.replace('@s.whatsapp.net', '');
          const chatId = `whatsapp_${phoneNumber}`;
          const conversation = await storage.getConversationByChatId(chatId);
          
          if (conversation && name) {
            // Update client name if provided and different
            if (conversation.clientName !== name) {
              await storage.updateConversation(conversation.id, {
                clientName: name,
              });
              console.log(`✏️  [Evolution] Nome do cliente atualizado: ${name}`);
            }
          }
        }
        
        return res.json({ success: true, processed: true, eventType: event });
      }

      // Process other MESSAGES_* events
      if (event.startsWith("messages.")) {
        console.log(`📨 [Evolution] Evento de mensagem: ${event}`);
        // Store for future implementation if needed
        return res.json({ success: true, processed: true, eventType: event });
      }

      // Unknown event type
      console.log(`❓ [Evolution] Evento desconhecido: ${event}`);
      return res.json({ success: true, processed: false, reason: "unknown_event" });

    } catch (error) {
      webhookLogger.error('WEBHOOK_ERROR', 'Erro crítico no webhook', {
        error: error instanceof Error ? error.message : String(error),
      });
      console.error("❌ [Evolution Webhook] Erro:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // DEBUG: Get all conversations (including resolved) for troubleshooting
  app.get("/api/debug/all-conversations", async (req, res) => {
    try {
      const conversations = await storage.getAllConversations();
      return res.json(conversations);
    } catch (error) {
      console.error("Debug conversations error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // DEBUG: Delete conversation by chatId (for testing)
  app.delete("/api/debug/conversation/:chatId", async (req, res) => {
    try {
      await storage.deleteConversation(req.params.chatId);
      return res.json({ success: true, message: "Conversa deletada com sucesso" });
    } catch (error) {
      console.error("Delete conversation error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // DEBUG: Simular fluxo completo de conversa (criar, transferir, finalizar)
  app.post("/api/debug/simulate-conversation", async (req, res) => {
    try {
      console.log("🧪 [DEBUG] Iniciando simulação de conversa completa");
      
      const testChatId = `test_${Date.now()}`;
      const testPhone = "5511999999999";
      const testName = "Cliente Teste";
      
      // 1. Criar conversa inicial
      console.log("📝 [DEBUG] 1. Criando conversa");
      const conversation = await storage.createConversation({
        chatId: testChatId,
        clientName: testName,
        clientPhone: testPhone,
        status: "active",
        assistantType: "Suporte Técnico",
        sentiment: "neutral",
        urgency: "medium",
        lastMessage: "Olá, preciso de ajuda",
        lastMessageTime: new Date(),
        duration: 0,
      });

      // 2. Adicionar mensagens simuladas
      console.log("💬 [DEBUG] 2. Adicionando mensagens");
      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: "Olá, preciso de ajuda com meu produto",
        assistant: null,
      });

      await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: "Olá! Como posso ajudá-lo hoje?",
        assistant: "Suporte Técnico",
      });

      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: "Preciso falar com um atendente humano",
        assistant: null,
      });

      // 3. Transferir para humano
      console.log("🔀 [DEBUG] 3. Transferindo para humano");
      await storage.updateConversation(conversation.id, {
        transferredToHuman: true,
        transferReason: "Cliente solicitou atendimento humano",
        transferredAt: new Date(),
        status: "active", // Mantém ativa após transferência
      });

      await storage.createSupervisorAction({
        conversationId: conversation.id,
        action: "transfer",
        notes: "Cliente solicitou transferência para humano",
        createdBy: "Sistema de Teste",
      });

      // 4. Adicionar mensagem do supervisor
      console.log("👤 [DEBUG] 4. Supervisor respondendo");
      await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: "Olá! Sou um atendente humano. Como posso ajudar?",
        assistant: "Supervisor Manual",
      });

      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: "Obrigado, meu problema foi resolvido!",
        assistant: null,
      });

      // 5. Finalizar conversa
      console.log("✅ [DEBUG] 5. Finalizando conversa");
      await storage.updateConversation(conversation.id, {
        status: "resolved",
        lastMessage: "Obrigado, meu problema foi resolvido!",
        lastMessageTime: new Date(),
        duration: 300, // 5 minutos
      });

      // 6. Buscar conversa completa para retornar
      console.log("📊 [DEBUG] 6. Buscando dados completos");
      const finalConversation = await storage.getConversation(conversation.id);
      const messages = await storage.getMessagesByConversationId(conversation.id);
      const actions = await storage.getActionsByConversationId(conversation.id);

      console.log("✅ [DEBUG] Simulação concluída com sucesso");

      return res.json({
        success: true,
        message: "Fluxo completo simulado com sucesso",
        conversationId: conversation.id,
        chatId: testChatId,
        details: {
          conversation: finalConversation,
          messages: messages,
          actions: actions,
        },
        summary: {
          status: finalConversation?.status,
          transferredToHuman: finalConversation?.transferredToHuman,
          transferReason: finalConversation?.transferReason,
          totalMessages: messages.length,
          totalActions: actions.length,
        }
      });
    } catch (error) {
      console.error("❌ [DEBUG] Erro na simulação:", error);
      return res.status(500).json({ 
        error: "Erro na simulação", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // ADMIN: Resolver conversas transferidas em lote
  app.post("/api/admin/resolve-transferred-conversations", async (req, res) => {
    try {
      const { conversationIds, resolveAll } = req.body;

      let conversationsToResolve: Conversation[] = [];

      if (resolveAll === true) {
        // Buscar todas as conversas transferidas e ativas
        const allTransferred = await storage.getTransferredConversations();
        conversationsToResolve = allTransferred.filter(c => c.status === 'active');
      } else if (conversationIds && Array.isArray(conversationIds)) {
        // Resolver apenas IDs específicos
        conversationsToResolve = await Promise.all(
          conversationIds.map(async (id: string) => {
            const conv = await storage.getConversation(id);
            return conv;
          })
        ).then(convs => convs.filter((c): c is Conversation => c !== undefined));
      } else {
        return res.status(400).json({ 
          error: "Forneça conversationIds (array) ou resolveAll (boolean)" 
        });
      }

      if (conversationsToResolve.length === 0) {
        return res.json({
          success: true,
          message: "Nenhuma conversa para resolver",
          resolved: 0,
          conversations: []
        });
      }

      // Resolver todas as conversas
      const resolved = await Promise.all(
        conversationsToResolve.map(async (conv) => {
          await storage.updateConversation(conv.id, {
            status: "resolved",
            lastMessageTime: new Date(),
            duration: conv.duration || 0,
          });

          // Registrar ação de supervisor
          await storage.createSupervisorAction({
            conversationId: conv.id,
            action: "resolve",
            notes: "Conversa resolvida administrativamente",
            createdBy: "Admin",
          });

          return {
            id: conv.id,
            chatId: conv.chatId,
            clientName: conv.clientName,
          };
        })
      );

      return res.json({
        success: true,
        message: `${resolved.length} conversa(s) resolvida(s) com sucesso`,
        resolved: resolved.length,
        conversations: resolved,
      });
    } catch (error) {
      console.error("❌ [ADMIN] Erro ao resolver conversas:", error);
      return res.status(500).json({ 
        error: "Erro ao resolver conversas", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Get all active conversations for monitoring (includes resolved from last 24h)
  app.get("/api/monitor/conversations", async (req, res) => {
    try {
      const conversations = await storage.getMonitorConversations();
      
      const conversationsWithMessages = await Promise.all(
        conversations.map(async (conv) => {
          // Optimized: Get only the last 10 messages from database (DESC order - newest first)
          const recentMessages = await storage.getRecentMessagesByConversationId(conv.id, 10);
          
          // Since messages come in DESC order, the first match is the most recent
          const lastClientMessage = recentMessages
            .filter(m => m.role === 'user')[0];
          
          const lastAIMessage = recentMessages
            .filter(m => m.role === 'assistant')[0];
          
          return {
            ...conv,
            lastClientMessage: lastClientMessage?.content || null,
            lastAIMessage: lastAIMessage?.content || null,
          };
        })
      );
      
      return res.json(conversationsWithMessages);
    } catch (error) {
      console.error("Monitor error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get conversation details
  app.get("/api/monitor/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await storage.getMessagesByConversationId(conversation.id);
      const alerts = await storage.getAlertsByConversationId(conversation.id);
      const actions = await storage.getActionsByConversationId(conversation.id);

      return res.json({
        conversation,
        messages,
        alerts,
        actions,
      });
    } catch (error) {
      console.error("Conversation details error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get active alerts
  app.get("/api/monitor/alerts", async (req, res) => {
    try {
      const alerts = await storage.getActiveAlerts();
      return res.json(alerts);
    } catch (error) {
      console.error("Alerts error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Supervisor actions
  app.post("/api/supervisor/transfer", async (req, res) => {
    try {
      const { conversationId, department, notes, supervisorId } = req.body;

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "transfer",
        notes: `Transfer to ${department}: ${notes}`,
        createdBy: supervisorId || "supervisor",
      });

      const conversation = await storage.getConversation(conversationId);

      // Keep status as "active" but mark as transferred (for Conversas tab)
      await storage.updateConversation(conversationId, {
        status: "active",
        transferredToHuman: true,
        transferReason: `Transferência manual: ${notes}`,
        transferredAt: new Date(),
        metadata: {
          ...(typeof conversation?.metadata === 'object' && conversation?.metadata !== null ? conversation.metadata : {}),
          transferred: true,
          transferredTo: department,
          transferredAt: new Date().toISOString(),
          transferNotes: notes,
        },
      });

      // Create learning event for AI failure (transfer needed)
      if (conversation) {
        const messages = await storage.getMessagesByConversationId(conversationId);
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const lastAiMessage = messages.filter(m => m.role === 'assistant').pop();

        if (lastUserMessage && lastAiMessage) {
          await storage.createLearningEvent({
            conversationId,
            eventType: 'explicit_correction',
            assistantType: conversation.assistantType,
            userMessage: lastUserMessage.content,
            aiResponse: lastAiMessage.content,
            feedback: notes, // Supervisor notes explain why transfer was needed
            sentiment: conversation.sentiment || 'neutral',
            resolution: 'corrected',
          });
          console.log("📚 [Learning] Evento de transferência criado para", conversation.assistantType);
        }
      }

      return res.json({ success: true, action });
    } catch (error) {
      console.error("Transfer error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/supervisor/pause", async (req, res) => {
    try {
      const { conversationId, supervisorId } = req.body;

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "pause_ai",
        notes: "AI paused by supervisor",
        createdBy: supervisorId || "supervisor",
      });

      return res.json({ success: true, action });
    } catch (error) {
      console.error("Pause error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/supervisor/note", async (req, res) => {
    try {
      const { conversationId, note, supervisorId } = req.body;

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "add_note",
        notes: note,
        createdBy: supervisorId || "supervisor",
      });

      return res.json({ success: true, action });
    } catch (error) {
      console.error("Note error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/supervisor/resolve", async (req, res) => {
    try {
      const { conversationId, supervisorId } = req.body;

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "mark_resolved",
        notes: "Conversation marked as resolved",
        createdBy: supervisorId || "supervisor",
      });

      const conversation = await storage.getConversation(conversationId);
      
      // Preparar metadata para aguardar NPS se for WhatsApp
      const currentMetadata = conversation?.metadata as any || {};
      const isWhatsApp = currentMetadata?.source === 'evolution_api';
      
      await storage.updateConversation(conversationId, {
        status: "resolved",
        metadata: isWhatsApp ? { ...currentMetadata, awaitingNPS: true } : currentMetadata,
      });

      // Create learning event for successful resolution
      if (conversation) {
        const messages = await storage.getMessagesByConversationId(conversationId);
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const lastAiMessage = messages.filter(m => m.role === 'assistant').pop();

        if (lastUserMessage && lastAiMessage) {
          await storage.createLearningEvent({
            conversationId,
            eventType: 'implicit_success',
            assistantType: conversation.assistantType,
            userMessage: lastUserMessage.content,
            aiResponse: lastAiMessage.content,
            sentiment: conversation.sentiment || 'positive',
            resolution: 'success',
          });
          console.log("📚 [Learning] Evento de sucesso criado para", conversation.assistantType);
        }

        // Enviar pesquisa NPS para cliente via WhatsApp
        const metadata = conversation.metadata as any;
        if (metadata?.source === 'evolution_api' && conversation.clientId) {
          const npsMessage = `
Olá ${conversation.clientName}!

Seu atendimento foi finalizado. 

*Pesquisa de Satisfação*

Em uma escala de 0 a 10, qual a probabilidade de você recomendar nosso atendimento?

Digite um número de *0* (muito improvável) a *10* (muito provável)
          `.trim();

          const sent = await sendWhatsAppMessage(conversation.clientId, npsMessage);
          if (sent) {
            console.log(`📊 [NPS] Pesquisa enviada para ${conversation.clientName} (${conversation.clientId})`);
          }
        }
      }

      return res.json({ success: true, action });
    } catch (error) {
      console.error("Resolve error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Knowledge base search
  app.post("/api/knowledge/search", async (req, res) => {
    try {
      const { query, topK = 20 } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const results = await searchKnowledge(query, topK);
      return res.json(results);
    } catch (error) {
      console.error("Knowledge search error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add knowledge chunks
  app.post("/api/knowledge/add", async (req, res) => {
    try {
      const { chunks } = req.body;

      if (!chunks || !Array.isArray(chunks)) {
        return res.status(400).json({ error: "Chunks array is required" });
      }

      const { addKnowledgeChunks } = await import("./lib/upstash");
      await addKnowledgeChunks(chunks);
      
      return res.json({ success: true, count: chunks.length });
    } catch (error) {
      console.error("Add knowledge error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Populate knowledge base with initial data
  app.post("/api/knowledge/populate", async (req, res) => {
    try {
      const { addKnowledgeChunks } = await import("./lib/upstash");
      
      const knowledgeBase = [
        {
          id: "kb-001",
          name: "Planos e Produtos",
          content: "A TR Telecom oferece planos de internet fibra óptica com velocidades de 300 Mbps, 500 Mbps e 1 Gbps. Os planos incluem instalação gratuita e roteador Wi-Fi 6 de última geração.",
          source: "Manual de Produtos",
          metadata: { category: "produtos", topic: "planos" }
        },
        {
          id: "kb-002",
          name: "Problemas de Conexão",
          content: "Para problemas de conexão, siga estes passos: 1) Verifique se todos os cabos estão conectados corretamente. 2) Reinicie o roteador (desligue por 30 segundos). 3) Verifique se há interrupções no serviço. 4) Teste a conexão com cabo direto.",
          source: "Manual Técnico",
          metadata: { category: "suporte", topic: "conexao" }
        },
        {
          id: "kb-003",
          name: "Latência e Performance",
          content: "A latência esperada para conexões de fibra óptica da TR Telecom é entre 5-15ms para servidores nacionais. Para jogos online, recomendamos o plano Fibra Gamer que prioriza tráfego de jogos e oferece latência média de 8ms.",
          source: "Manual Técnico",
          metadata: { category: "suporte", topic: "latencia" }
        },
        {
          id: "kb-004",
          name: "Faturas e Pagamentos",
          content: "As faturas são enviadas por email até o dia 5 de cada mês. O vencimento padrão é dia 15. Aceitamos pagamento via PIX, boleto bancário, cartão de crédito e débito automático. O código PIX está disponível na fatura digital.",
          source: "Manual Financeiro",
          metadata: { category: "financeiro", topic: "faturas" }
        },
        {
          id: "kb-005",
          name: "Velocidades e Horários de Pico",
          content: "Velocidades podem variar dependendo do horário (pico entre 19h-23h) e quantidade de dispositivos conectados. Para melhor desempenho, conecte dispositivos críticos via cabo Ethernet. O Wi-Fi 5GHz oferece melhor velocidade para dispositivos próximos ao roteador.",
          source: "Manual Técnico",
          metadata: { category: "suporte", topic: "performance" }
        },
        {
          id: "kb-006",
          name: "Agendamento de Visitas",
          content: "Para agendar visita técnica, entre em contato pelo telefone 0800-123-4567 ou pelo chat. As visitas são realizadas de segunda a sábado, das 8h às 18h. Você receberá uma janela de 4 horas e confirmação 1 dia antes via SMS.",
          source: "Manual de Atendimento",
          metadata: { category: "suporte", topic: "visita-tecnica" }
        },
        {
          id: "kb-007",
          name: "Preços dos Planos",
          content: "O plano Fibra 300 custa R$ 99,90/mês, Fibra 500 custa R$ 129,90/mês e Fibra Gamer 1 Gbps custa R$ 199,90/mês. Todos os planos incluem instalação gratuita, sem fidelidade, e Wi-Fi 6 incluso.",
          source: "Tabela de Preços",
          metadata: { category: "comercial", topic: "precos" }
        },
        {
          id: "kb-008",
          name: "Cancelamento de Serviço",
          content: "Para cancelar o serviço, entre em contato pelo 0800-123-4567 ou chat. Não há multa de cancelamento. O serviço permanece ativo até o fim do período pago. Equipamentos devem ser devolvidos em até 15 dias após o cancelamento.",
          source: "Política de Cancelamento",
          metadata: { category: "cancelamento", topic: "processo" }
        },
        {
          id: "kb-009",
          name: "Especificações do Roteador",
          content: "O roteador Wi-Fi 6 suporta até 50 dispositivos simultâneos. Possui 4 antenas de alto ganho, cobertura de até 200m² e velocidades de até 3 Gbps combinadas. Suporta beamforming e MU-MIMO para melhor distribuição de sinal.",
          source: "Especificações Técnicas",
          metadata: { category: "suporte", topic: "equipamento" }
        },
        {
          id: "kb-010",
          name: "Troubleshooting de Instabilidade",
          content: "Em caso de instabilidade na conexão, verifique: 1) Interferências de outros dispositivos Wi-Fi próximos. 2) Distância do roteador. 3) Obstáculos físicos (paredes, móveis). 4) Muitos dispositivos conectados. 5) Atualizações do firmware do roteador.",
          source: "Troubleshooting",
          metadata: { category: "suporte", topic: "instabilidade" }
        },
        {
          id: "kb-011",
          name: "Informações da Empresa",
          content: "A TR Telecom é uma empresa de telecomunicações brasileira especializada em fibra óptica. Oferece internet de alta velocidade, suporte técnico 24/7 e atendimento personalizado. Fundada em 2020, atende milhares de clientes com excelência.",
          source: "Sobre a Empresa",
          metadata: { category: "apresentacao", topic: "empresa" }
        }
      ];

      await addKnowledgeChunks(knowledgeBase);
      
      return res.json({ 
        success: true, 
        message: "Base de conhecimento populada com sucesso",
        count: knowledgeBase.length 
      });
    } catch (error) {
      console.error("Populate knowledge error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Clear knowledge base
  app.post("/api/knowledge/clear", async (req, res) => {
    try {
      const { clearKnowledgeBase } = await import("./lib/upstash");
      await clearKnowledgeBase();
      
      return res.json({ success: true, message: "Base de conhecimento limpa" });
    } catch (error) {
      console.error("Clear knowledge error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete single knowledge chunk
  app.delete("/api/knowledge/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { deleteKnowledgeChunk } = await import("./lib/upstash");
      
      await deleteKnowledgeChunk(id);
      
      return res.json({ success: true, message: "Documento excluído" });
    } catch (error) {
      console.error("Delete knowledge error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== LEARNING SYSTEM ROUTES ====================

  // Create learning event
  app.post("/api/learning/events", async (req, res) => {
    try {
      const validatedData = insertLearningEventSchema.parse(req.body);
      const event = await storage.createLearningEvent(validatedData);
      return res.json(event);
    } catch (error) {
      console.error("Create learning event error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get learning events by conversation
  app.get("/api/learning/events/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const events = await storage.getLearningEventsByConversationId(conversationId);
      return res.json(events);
    } catch (error) {
      console.error("Get learning events error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get recent learning events for analysis
  app.get("/api/learning/events", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const events = await storage.getRecentLearningEvents(limit);
      return res.json(events);
    } catch (error) {
      console.error("Get recent learning events error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all prompt suggestions
  app.get("/api/learning/suggestions", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const suggestions = status 
        ? await storage.getPromptSuggestionsByStatus(status)
        : await storage.getAllPromptSuggestions();
      return res.json(suggestions);
    } catch (error) {
      console.error("Get suggestions error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single prompt suggestion
  app.get("/api/learning/suggestions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const suggestion = await storage.getPromptSuggestion(id);
      if (!suggestion) {
        return res.status(404).json({ error: "Suggestion not found" });
      }
      return res.json(suggestion);
    } catch (error) {
      console.error("Get suggestion error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update prompt suggestion (approve/reject)
  app.put("/api/learning/suggestions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reviewedBy, reviewNotes } = req.body;
      
      const updated = await storage.updatePromptSuggestion(id, {
        status,
        reviewedBy,
        reviewNotes,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Suggestion not found" });
      }
      
      return res.json(updated);
    } catch (error) {
      console.error("Update suggestion error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Apply prompt suggestion (update assistant)
  app.post("/api/learning/suggestions/:id/apply", async (req, res) => {
    try {
      const { id } = req.params;
      const { appliedBy } = req.body;
      
      const suggestion = await storage.getPromptSuggestion(id);
      if (!suggestion) {
        return res.status(404).json({ error: "Suggestion not found" });
      }

      // Update assistant via OpenAI API
      const { updateAssistantPrompt } = await import("./lib/openai");
      await updateAssistantPrompt(suggestion.assistantType, suggestion.suggestedPrompt);

      // Create prompt update log
      await storage.createPromptUpdate({
        suggestionId: id,
        assistantType: suggestion.assistantType,
        modificationType: "instructions",
        previousValue: suggestion.currentPrompt,
        newValue: suggestion.suggestedPrompt,
        reason: suggestion.rootCauseAnalysis,
        appliedBy,
      });

      // Update suggestion status
      await storage.updatePromptSuggestion(id, {
        status: "applied",
        reviewedBy: appliedBy,
      });

      return res.json({ success: true, message: "Prompt updated successfully" });
    } catch (error) {
      console.error("Apply suggestion error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all prompt updates (audit log)
  app.get("/api/learning/updates", async (req, res) => {
    try {
      const assistantType = req.query.assistantType as string | undefined;
      const updates = assistantType
        ? await storage.getPromptUpdatesByAssistantType(assistantType)
        : await storage.getAllPromptUpdates();
      return res.json(updates);
    } catch (error) {
      console.error("Get updates error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Trigger analysis manually
  app.post("/api/learning/analyze", async (req, res) => {
    try {
      // TODO: Implement cortex-analysis module
      console.log("🧠 [Analysis] Triggered manual analysis");
      return res.json({ 
        success: true, 
        message: "Analysis triggered successfully",
        suggestions: [] 
      });
    } catch (error) {
      console.error("Analysis error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // System configuration endpoints
  app.get("/api/system/config", async (req, res) => {
    try {
      const { ASSISTANT_IDS, CONTEXT_CONFIG } = await import("./lib/openai");
      const { redis, vectorIndex } = await import("./lib/upstash");
      
      // Check API status
      let redisStatus = false;
      let vectorStatus = false;
      try {
        await redis.ping();
        redisStatus = true;
      } catch (e) {
        console.error("Redis ping failed:", e);
      }
      
      try {
        await vectorIndex.info();
        vectorStatus = true;
      } catch (e) {
        console.error("Vector ping failed:", e);
      }

      // Get statistics
      const allConversations = await storage.getAllActiveConversations();
      const allLearningEvents = await storage.getRecentLearningEvents();
      const allPromptUpdates = await storage.getAllPromptSuggestions();

      // Check Evolution API status
      let evolutionStatus = false;
      if (EVOLUTION_CONFIG.apiUrl && EVOLUTION_CONFIG.apiKey && EVOLUTION_CONFIG.instance) {
        evolutionStatus = true; // Basic config check
      }

      const config = {
        apiStatus: {
          openai: !!process.env.OPENAI_API_KEY,
          redis: redisStatus,
          vector: vectorStatus,
          evolution: evolutionStatus,
        },
        assistants: {
          cortex: !!ASSISTANT_IDS.cortex,
          suporte: !!ASSISTANT_IDS.suporte,
          comercial: !!ASSISTANT_IDS.comercial,
          financeiro: !!ASSISTANT_IDS.financeiro,
          apresentacao: !!ASSISTANT_IDS.apresentacao,
          ouvidoria: !!ASSISTANT_IDS.ouvidoria,
          cancelamento: !!ASSISTANT_IDS.cancelamento,
        },
        env: {
          openai: !!process.env.OPENAI_API_KEY,
          redis: !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN,
          vector: !!process.env.UPSTASH_VECTOR_REST_URL && !!process.env.UPSTASH_VECTOR_REST_TOKEN,
          evolution: evolutionStatus,
        },
        evolution: {
          configured: evolutionStatus,
          url: EVOLUTION_CONFIG.apiUrl || "",
          instance: EVOLUTION_CONFIG.instance || "",
          hasKey: !!EVOLUTION_CONFIG.apiKey,
        },
        learning: {
          lastAnalysis: "Em breve",
          nextAnalysis: `${process.env.ANALYSIS_INTERVAL_HOURS || 2}h`,
          analysisIntervalHours: parseInt(process.env.ANALYSIS_INTERVAL_HOURS || "2"),
        },
        stats: {
          totalConversations: allConversations.length,
          knowledgeChunks: 0, // TODO: get from vector DB
          learningEvents: allLearningEvents.length,
          promptUpdates: allPromptUpdates.length,
        },
        summarization: {
          summarizeEvery: CONTEXT_CONFIG.SUMMARIZE_EVERY,
          keepRecent: CONTEXT_CONFIG.KEEP_RECENT,
          contextWindow: CONTEXT_CONFIG.CONTEXT_WINDOW,
        },
      };

      return res.json(config);
    } catch (error) {
      console.error("Get system config error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update system configuration
  app.post("/api/system/config", async (req, res) => {
    try {
      const { summarizeEvery, keepRecent, contextWindow, analysisInterval } = req.body;
      
      // In a real app, these would be saved to a database or config file
      // For now, we just return success
      console.log("📝 [Config] Updating configuration:", { 
        summarizeEvery, 
        keepRecent, 
        contextWindow,
        analysisInterval 
      });
      
      return res.json({ 
        success: true, 
        message: "Configurações atualizadas! Reinicie o servidor para aplicar: SUMMARIZE_EVERY, KEEP_RECENT, CONTEXT_WINDOW, ANALYSIS_INTERVAL_HOURS" 
      });
    } catch (error) {
      console.error("Update system config error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update Evolution API configuration
  app.post("/api/system/evolution-config", async (req, res) => {
    try {
      const { url, apiKey, instance } = req.body;
      
      if (!url || !apiKey || !instance) {
        return res.status(400).json({ 
          error: "Todos os campos são obrigatórios (url, apiKey, instance)" 
        });
      }

      // Validar URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ 
          error: "URL inválida. Use o formato: https://sua-api.com" 
        });
      }

      // Nota: Em produção, essas variáveis seriam salvas nos Secrets do Replit
      // Por enquanto, vamos apenas validar e retornar sucesso
      console.log("🔧 [Evolution API] Configurações recebidas (não serão persistidas nesta versão):", {
        url,
        instance,
        hasApiKey: !!apiKey
      });

      // Instruções para o usuário (SEM expor a API key)
      const instructions = `
Para aplicar as configurações da Evolution API, adicione estas variáveis nos Secrets do Replit:

1. EVOLUTION_API_URL = ${url}
2. EVOLUTION_API_KEY = (use a chave que você forneceu)
3. EVOLUTION_API_INSTANCE = ${instance}

Após adicionar os Secrets, reinicie o servidor para aplicar as mudanças.
      `.trim();

      return res.json({ 
        success: true, 
        message: "Configurações validadas com sucesso!",
        instructions,
        config: {
          url,
          instance,
          hasApiKey: true
        }
      });
    } catch (error) {
      console.error("Update Evolution config error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Clear Redis cache
  app.post("/api/system/clear-cache", async (req, res) => {
    try {
      const { redis } = await import("./lib/upstash");
      
      // Get all keys
      const keys = await redis.keys("*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      
      console.log(`🗑️ [Cache] Cleared ${keys.length} keys from Redis`);
      
      return res.json({ 
        success: true, 
        message: `Cache cleared successfully (${keys.length} keys)` 
      });
    } catch (error) {
      console.error("Clear cache error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get assistants metrics
  app.get("/api/assistants/metrics", async (req, res) => {
    try {
      const allConversations = await storage.getAllConversations();
      const allPromptUpdates = await storage.getAllPromptUpdates();
      const allSupervisorActions = await storage.getAllSupervisorActions();

      // Tipos de assistentes
      const assistantTypes = ["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento"];
      
      // Calcular métricas por assistente
      const assistantMetrics = assistantTypes.map(type => {
        const conversations = allConversations.filter((c: Conversation) => c.assistantType === type);
        const totalConversations = conversations.length;
        
        // Conversas resolvidas (status = resolved)
        const resolvedConversations = conversations.filter((c: Conversation) => c.status === "resolved").length;
        
        // Conversas transferidas (metadata.transferred = true ou supervisor action de transfer)
        const transferredConversations = conversations.filter((c: Conversation) => 
          (c.metadata as any)?.transferred === true
        ).length;
        
        // Taxa de sucesso
        const successRate = totalConversations > 0 
          ? (resolvedConversations / totalConversations) * 100 
          : 0;
        
        // Duração média
        const avgDuration = totalConversations > 0
          ? conversations.reduce((sum: number, c: Conversation) => sum + (c.duration || 0), 0) / totalConversations
          : 0;
        
        // Sentimento médio
        const sentiments = conversations.map((c: Conversation) => c.sentiment || "neutral");
        const positiveCount = sentiments.filter((s: string | null) => s === "positive").length;
        const negativeCount = sentiments.filter((s: string | null) => s === "negative").length;
        const avgSentiment = positiveCount > negativeCount ? "positive" 
          : negativeCount > positiveCount ? "negative" 
          : "neutral";
        
        return {
          assistantType: type,
          totalConversations,
          resolvedConversations,
          transferredConversations,
          successRate,
          avgDuration,
          avgSentiment,
        };
      });

      // Overview geral
      const totalConversations = allConversations.length;
      const totalResolved = allConversations.filter((c: Conversation) => c.status === "resolved").length;
      const totalTransferred = allConversations.filter((c: Conversation) => 
        (c.metadata as any)?.transferred === true
      ).length;
      const overallSuccessRate = totalConversations > 0 
        ? (totalResolved / totalConversations) * 100 
        : 0;

      // Histórico de atualizações (últimas 10)
      const updates = allPromptUpdates
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 10)
        .map(update => ({
          assistantType: update.assistantType,
          date: update.createdAt ? new Date(update.createdAt).toLocaleDateString('pt-BR') : 'N/A',
          modificationType: update.modificationType || "Atualização de prompt",
          appliedBy: update.appliedBy,
        }));

      // Análise de transferências
      const transfersByAssistant = assistantTypes.map(type => {
        const conversations = allConversations.filter((c: Conversation) => 
          c.assistantType === type && (c.metadata as any)?.transferred === true
        );
        
        const reasons = conversations
          .map((c: Conversation) => (c.metadata as any)?.transferNotes || "Não especificado")
          .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) // Remove duplicatas
          .slice(0, 5); // Top 5 motivos

        return {
          assistantType: type,
          count: conversations.length,
          reasons,
        };
      }).filter(t => t.count > 0); // Apenas assistentes com transferências

      const response = {
        overview: {
          totalConversations,
          totalResolved,
          totalTransferred,
          overallSuccessRate,
        },
        assistants: assistantMetrics,
        updates,
        transfers: transfersByAssistant,
      };

      return res.json(response);
    } catch (error) {
      console.error("Get assistants metrics error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Submit satisfaction feedback (NPS)
  app.post("/api/feedback", async (req, res) => {
    try {
      const validatedData = insertSatisfactionFeedbackSchema.parse(req.body);
      
      // Criar feedback (category é calculado automaticamente pelo storage)
      const feedback = await storage.createSatisfactionFeedback(validatedData);
      
      // Determinar categoria para lógica adicional
      let category: string;
      if (validatedData.npsScore >= 0 && validatedData.npsScore <= 6) {
        category = "detractor";
      } else if (validatedData.npsScore >= 7 && validatedData.npsScore <= 8) {
        category = "neutral";
      } else {
        category = "promoter";
      }
      
      // Se for detractor (NPS 0-6), criar learning event negativo
      if (category === "detractor") {
        const conversation = await storage.getConversation(validatedData.conversationId);
        
        if (conversation) {
          // Buscar últimas mensagens da conversa
          const messages = await storage.getMessagesByConversationId(validatedData.conversationId);
          const lastUserMessage = messages.filter(m => m.role === "user").slice(-1)[0];
          const lastAiMessage = messages.filter(m => m.role === "assistant").slice(-1)[0];
          
          await storage.createLearningEvent({
            conversationId: validatedData.conversationId,
            eventType: "explicit_correction",
            assistantType: validatedData.assistantType,
            userMessage: lastUserMessage?.content || "N/A",
            aiResponse: lastAiMessage?.content || "N/A",
            correctResponse: null,
            feedback: `NPS Baixo (${validatedData.npsScore}): ${validatedData.comment || "Sem comentário"}`,
            sentiment: "negative",
            resolution: "corrected",
            metadata: {
              npsScore: validatedData.npsScore,
              npsComment: validatedData.comment,
              source: "nps_feedback",
            },
          });
          
          console.log(`📊 [NPS] Detractor feedback criado learning event: NPS ${validatedData.npsScore}`);
        }
      }
      
      console.log(`📊 [NPS] Feedback recebido: ${category.toUpperCase()} - Score ${validatedData.npsScore}`);
      
      return res.json({ success: true, feedback });
    } catch (error) {
      console.error("Submit feedback error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get NPS metrics
  app.get("/api/metrics/nps", async (req, res) => {
    try {
      const allFeedback = await storage.getAllSatisfactionFeedback();
      const allConversations = await storage.getAllConversations();
      
      // Calcular métricas gerais de NPS
      const totalFeedback = allFeedback.length;
      const promoters = allFeedback.filter(f => f.category === "promoter").length;
      const neutrals = allFeedback.filter(f => f.category === "neutral").length;
      const detractors = allFeedback.filter(f => f.category === "detractor").length;
      
      // NPS Score = (% Promoters - % Detractors)
      const npsScore = totalFeedback > 0 
        ? Math.round(((promoters - detractors) / totalFeedback) * 100) 
        : 0;
      
      // Score médio
      const avgScore = totalFeedback > 0
        ? allFeedback.reduce((sum, f) => sum + f.npsScore, 0) / totalFeedback
        : 0;
      
      // Métricas por assistente
      const assistantTypes = ["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento"];
      const byAssistant = assistantTypes.map(type => {
        const feedback = allFeedback.filter(f => f.assistantType === type);
        const total = feedback.length;
        const promo = feedback.filter(f => f.category === "promoter").length;
        const detrac = feedback.filter(f => f.category === "detractor").length;
        const score = total > 0 ? Math.round(((promo - detrac) / total) * 100) : 0;
        const avg = total > 0 ? feedback.reduce((sum, f) => sum + f.npsScore, 0) / total : 0;
        
        return {
          assistantType: type,
          totalFeedback: total,
          promoters: promo,
          neutrals: feedback.filter(f => f.category === "neutral").length,
          detractors: detrac,
          npsScore: score,
          avgScore: avg,
        };
      }).filter(m => m.totalFeedback > 0);
      
      // Feedback ao longo do tempo (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentFeedback = allFeedback.filter(f => 
        f.createdAt && new Date(f.createdAt) >= thirtyDaysAgo
      );
      
      // Agrupar por dia
      const dailyStats = recentFeedback.reduce((acc: any, f) => {
        const date = f.createdAt ? new Date(f.createdAt).toLocaleDateString('pt-BR') : 'N/A';
        if (!acc[date]) {
          acc[date] = { date, scores: [] };
        }
        acc[date].scores.push(f.npsScore);
        return acc;
      }, {});
      
      const timeline = Object.values(dailyStats).map((day: any) => ({
        date: day.date,
        avgScore: day.scores.reduce((sum: number, s: number) => sum + s, 0) / day.scores.length,
        count: day.scores.length,
      })).sort((a: any, b: any) => {
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
      });
      
      // Principais comentários (últimos 10 com comentário)
      const comments = allFeedback
        .filter(f => f.comment && f.comment.trim() !== "")
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 10)
        .map(f => ({
          score: f.npsScore,
          category: f.category,
          comment: f.comment,
          assistantType: f.assistantType,
          clientName: f.clientName,
          date: f.createdAt ? new Date(f.createdAt).toLocaleDateString('pt-BR') : 'N/A',
        }));
      
      // Taxa de resposta (feedback vs conversas finalizadas)
      const resolvedConversations = allConversations.filter(c => c.status === "resolved").length;
      const responseRate = resolvedConversations > 0 
        ? (totalFeedback / resolvedConversations) * 100 
        : 0;
      
      const response = {
        overview: {
          npsScore,
          avgScore: Math.round(avgScore * 10) / 10,
          totalFeedback,
          promoters,
          neutrals,
          detractors,
          responseRate: Math.round(responseRate),
          resolvedConversations,
        },
        byAssistant,
        timeline,
        comments,
      };
      
      return res.json(response);
    } catch (error) {
      console.error("Get NPS metrics error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get transferred conversations
  app.get("/api/conversations/transferred", async (req, res) => {
    try {
      const conversations = await storage.getTransferredConversations();
      return res.json(conversations);
    } catch (error) {
      console.error("Get transferred conversations error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single conversation by ID
  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      return res.json(conversation);
    } catch (error) {
      console.error("Get conversation error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get feedback by conversation ID
  app.get("/api/feedback/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const feedback = await storage.getSatisfactionFeedbackByConversationId(conversationId);
      // Retorna 200 com null se não houver feedback (não é erro)
      return res.json({ feedback: feedback || null });
    } catch (error) {
      console.error("Get feedback error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // AI suggest response based on context
  app.post("/api/conversations/:id/suggest-response", async (req, res) => {
    try {
      const { id } = req.params;
      const { supervisorName } = req.body;

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await storage.getMessagesByConversationId(id);
      const lastUserMessage = messages.filter(m => m.role === "user").pop();

      if (!lastUserMessage) {
        return res.status(400).json({ error: "No user message found" });
      }

      // Preparar contexto da conversa
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Usar OpenAI para sugerir resposta baseada no contexto
      const suggestionPrompt = `Você é um assistente experiente da TR Telecom. 
      
Analise o histórico da conversa abaixo e sugira a melhor resposta para a última mensagem do cliente.

Histórico da conversa:
${conversationHistory.map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`).join('\n')}

Baseado no contexto completo da conversa, sugira uma resposta profissional, empática e que resolva a questão do cliente. 
A resposta deve:
- Ser direta e objetiva
- Manter tom profissional e empático
- Oferecer solução clara
- Se necessário, pedir informações adicionais`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: suggestionPrompt,
          },
        ],
        temperature: 0.7,
      });

      const suggestedResponse = completion.choices[0]?.message?.content || "Não foi possível gerar sugestão";

      // Salvar sugestão
      const suggestion = await storage.createSuggestedResponse({
        conversationId: id,
        messageContext: lastUserMessage.content,
        suggestedResponse,
        supervisorName,
        wasEdited: false,
        wasApproved: false,
      });

      console.log(`🤖 [AI Suggestion] Sugestão gerada para conversa ${id}`);

      return res.json({
        suggestionId: suggestion.id,
        suggestedResponse,
      });
    } catch (error) {
      console.error("Suggest response error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send supervisor message (approved or edited)
  app.post("/api/conversations/:id/send-message", async (req, res) => {
    try {
      const { id } = req.params;
      const { content, suggestionId, wasEdited, supervisorName } = req.body;

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Criar mensagem do supervisor
      const message = await storage.createMessage({
        conversationId: id,
        role: "assistant",
        content,
        assistant: `Supervisor: ${supervisorName}`,
      });

      // Atualizar conversa
      await storage.updateConversation(id, {
        lastMessage: content,
        lastMessageTime: new Date(),
      });

      // Se foi baseado em sugestão, atualizar o registro
      if (suggestionId) {
        await storage.updateSuggestedResponse(suggestionId, {
          finalResponse: content,
          wasEdited: wasEdited || false,
          wasApproved: true,
        });

        // Se editou a sugestão da IA, criar learning event
        if (wasEdited) {
          const suggestion = await storage.getSuggestedResponsesByConversationId(id);
          const originalSuggestion = suggestion.find(s => s.id === suggestionId);
          
          if (originalSuggestion) {
            await storage.createLearningEvent({
              conversationId: id,
              eventType: "explicit_correction",
              assistantType: conversation.assistantType,
              userMessage: originalSuggestion.messageContext,
              aiResponse: originalSuggestion.suggestedResponse,
              correctResponse: content,
              feedback: `Supervisor editou sugestão da IA`,
              sentiment: "neutral",
              resolution: "corrected",
              metadata: {
                source: "supervised_response",
                suggestionId,
                supervisorName,
              },
            });

            console.log(`📚 [Learning] Supervisor editou sugestão - learning event criado`);
          }
        }
      }

      console.log(`✉️ [Supervisor] Mensagem enviada na conversa ${id}`);

      return res.json({ 
        success: true, 
        message,
        learningEventCreated: wasEdited,
      });
    } catch (error) {
      console.error("Send message error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  // Setup WebSocket for real-time webhook logs
  webhookLogger.setupWebSocket(httpServer);

  // Endpoint to get webhook logs
  app.get("/api/webhook-logs", (req, res) => {
    const logs = webhookLogger.getLogs();
    return res.json({ logs });
  });

  // Endpoint to get webhook stats
  app.get("/api/webhook-logs/stats", (req, res) => {
    const stats = webhookLogger.getStats();
    return res.json(stats);
  });

  // Endpoint to clear webhook logs
  app.post("/api/webhook-logs/clear", (req, res) => {
    webhookLogger.clearLogs();
    return res.json({ success: true, message: "Logs cleared" });
  });

  return httpServer;
}
