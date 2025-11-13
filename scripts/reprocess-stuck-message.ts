import { storage } from '../server/storage';
import { addMessageToQueue } from '../server/lib/queue';

/**
 * Script para reprocessar mensagem que não foi respondida pela IA
 * Uso: tsx scripts/reprocess-stuck-message.ts <messageId>
 */

async function reprocessMessage(messageId: string) {
  try {
    console.log(`🔄 [Reprocess] Buscando mensagem ${messageId}...`);
    
    const message = await storage.getMessage(messageId);
    if (!message) {
      console.error(`❌ [Reprocess] Mensagem não encontrada: ${messageId}`);
      process.exit(1);
    }
    
    console.log(`✅ [Reprocess] Mensagem encontrada:`, {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content.substring(0, 100),
      timestamp: message.timestamp,
    });
    
    if (message.role !== 'user') {
      console.error(`❌ [Reprocess] Mensagem não é do usuário (role=${message.role})`);
      process.exit(1);
    }
    
    if (!message.conversationId) {
      console.error(`❌ [Reprocess] Mensagem sem conversationId`);
      process.exit(1);
    }
    
    console.log(`🔍 [Reprocess] Buscando conversa ${message.conversationId}...`);
    const conversation = await storage.getConversation(message.conversationId);
    
    if (!conversation) {
      console.error(`❌ [Reprocess] Conversa não encontrada: ${message.conversationId}`);
      process.exit(1);
    }
    
    console.log(`✅ [Reprocess] Conversa encontrada:`, {
      id: conversation.id,
      clientName: conversation.clientName,
      chatId: conversation.chatId,
      status: conversation.status,
      evolutionInstance: conversation.evolutionInstance,
    });
    
    // Extrair número de telefone do chatId
    const phoneNumber = conversation.chatId.replace('whatsapp_', '');
    
    console.log(`📤 [Reprocess] Enfileirando mensagem para processamento...`);
    
    await addMessageToQueue({
      chatId: conversation.chatId,
      conversationId: conversation.id,
      message: message.content,
      fromNumber: phoneNumber,
      messageId: message.id,
      timestamp: message.timestamp.getTime(),
      evolutionInstance: conversation.evolutionInstance || undefined,
      clientName: conversation.clientName,
      hasImage: false,
    }, 1);
    
    console.log(`✅ [Reprocess] Mensagem enfileirada com sucesso!`);
    console.log(`⏳ [Reprocess] Aguarde alguns segundos para a IA processar...`);
    
  } catch (error) {
    console.error(`❌ [Reprocess] Erro ao reprocessar mensagem:`, error);
    process.exit(1);
  }
}

// Get messageId from command line
const messageId = process.argv[2];

if (!messageId) {
  console.error('❌ Usage: tsx scripts/reprocess-stuck-message.ts <messageId>');
  process.exit(1);
}

reprocessMessage(messageId).then(() => {
  console.log('✅ Done');
  process.exit(0);
});
