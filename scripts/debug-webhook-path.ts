/**
 * Verificar como mensagens estão entrando no sistema
 */

import { storage } from '../server/storage';

async function debugWebhookPath() {
  console.log('🔍 INVESTIGANDO CAMINHO DE ENTRADA DE MENSAGENS\n');
  
  try {
    // Buscar todas as mensagens recebidas hoje
    const allMessages = await (storage as any).getAllMessages?.();
    
    if (!allMessages) {
      console.log('⚠️  getAllMessages() não disponível - usando query direta');
      process.exit(0);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayMessages = allMessages.filter((m: any) => {
      const msgDate = new Date(m.timestamp);
      return msgDate >= today && m.role === 'user';
    });
    
    console.log(`📊 Mensagens de USUÁRIOS recebidas hoje: ${todayMessages.length}\n`);
    
    // Agrupar por conversa
    const byConversation: Record<string, any[]> = {};
    
    for (const msg of todayMessages) {
      if (!byConversation[msg.conversationId]) {
        byConversation[msg.conversationId] = [];
      }
      byConversation[msg.conversationId].push(msg);
    }
    
    console.log('📋 CONVERSAS COM MENSAGENS HOJE:');
    
    for (const [convId, messages] of Object.entries(byConversation)) {
      const conv = await storage.getConversationById(convId);
      if (!conv) continue;
      
      console.log(`\n  💬 ${conv.clientName} (${conv.chatId})`);
      console.log(`     Status: ${conv.status} | Assistant: ${conv.assistantType}`);
      console.log(`     Mensagens hoje: ${messages.length}`);
      
      for (const msg of messages) {
        const time = new Date(msg.timestamp!).toLocaleTimeString('pt-BR');
        const preview = msg.content.substring(0, 40);
        console.log(`     ⏰ ${time} - "${preview}..."`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  }
  
  process.exit(0);
}

debugWebhookPath();
