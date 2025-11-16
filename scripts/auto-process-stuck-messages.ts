/**
 * Sistema de recuperação automática para mensagens sem resposta
 * 
 * Processa conversas onde o cliente enviou mensagem mas a IA não respondeu
 */

import { storage } from '../server/storage';
import { addMessageToQueue } from '../server/lib/queue';

async function autoProcessStuckMessages() {
  console.log('🔄 SISTEMA DE RECUPERAÇÃO AUTOMÁTICA\n');
  console.log('Processando mensagens sem resposta da IA...\n');
  
  try {
    // Buscar todas as conversas ativas
    const allConversations = await storage.getAllConversations();
    const activeConversations = allConversations.filter(c => c.status === 'active');
    
    console.log(`📊 Conversas ativas: ${activeConversations.length}`);
    
    let processedCount = 0;
    let skippedCount = 0;
    
    for (const conv of activeConversations) {
      // Pular conversas transferidas para humanos
      if (conv.transferredToHuman) {
        skippedCount++;
        continue;
      }
      
      // Buscar mensagens da conversa
      const messages = await storage.getMessagesByConversationId(conv.id);
      
      if (messages.length === 0) continue;
      
      // Verificar se última mensagem é do usuário
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage.role !== 'user') {
        continue; // IA já respondeu
      }
      
      // Verificar há quanto tempo a mensagem foi enviada
      const messageAge = Date.now() - new Date(lastMessage.timestamp!).getTime();
      const ageMinutes = Math.floor(messageAge / (1000 * 60));
      
      // Processar se mensagem tem mais de 2 minutos sem resposta
      if (ageMinutes >= 2) {
        console.log(`🔄 Processando: ${conv.clientName} (${conv.chatId})`);
        console.log(`   Aguardando há ${ageMinutes} minutos`);
        console.log(`   Mensagem: "${lastMessage.content.substring(0, 50)}..."`);
        
        // Adicionar à fila de processamento
        await addMessageToQueue({
          chatId: conv.chatId,
          conversationId: conv.id,
          message: lastMessage.content,
          fromNumber: conv.chatId.replace('whatsapp_', ''),
          messageId: lastMessage.id || `recovery_${Date.now()}`,
          timestamp: Date.now(),
          evolutionInstance: conv.evolutionInstance || 'Principal',
          clientName: conv.clientName,
          hasImage: false,
        }, 1); // Prioridade normal
        
        processedCount++;
        
        // Aguardar 500ms entre jobs para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('');
    console.log('✅ RECUPERAÇÃO CONCLUÍDA');
    console.log(`   Processadas: ${processedCount}`);
    console.log(`   Puladas (transferidas): ${skippedCount}`);
    console.log(`   Total analisadas: ${activeConversations.length}`);
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

autoProcessStuckMessages();
