/**
 * Forçar processamento da conversa COSTA que está parada
 */

import { storage } from '../server/storage';
import { addMessageToQueue } from '../server/lib/queue';

async function forceProcessCosta() {
  console.log('🚀 FORÇANDO PROCESSAMENTO DA CONVERSA COSTA\n');
  
  try {
    const conv = await storage.getConversationByChatId('whatsapp_553298144141');
    
    if (!conv) {
      console.error('❌ Conversa não encontrada!');
      process.exit(1);
    }
    
    console.log(`✅ Conversa encontrada: ${conv.id}`);
    console.log(`   Nome: ${conv.clientName}`);
    console.log(`   Status: ${conv.status}`);
    console.log('');
    
    const messages = await storage.getMessagesByConversationId(conv.id);
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    
    if (!lastUserMessage) {
      console.error('❌ Nenhuma mensagem do usuário encontrada!');
      process.exit(1);
    }
    
    console.log(`📬 Última mensagem do cliente:`);
    console.log(`   Quando: ${lastUserMessage.timestamp}`);
    console.log(`   Conteúdo: "${lastUserMessage.content}"`);
    console.log('');
    
    // Forçar processamento adicionando à fila
    console.log(`🔄 Adicionando mensagem à fila de processamento...`);
    
    await addMessageToQueue({
      chatId: conv.chatId,
      conversationId: conv.id,
      message: lastUserMessage.content,
      fromNumber: '553298144141',
      messageId: lastUserMessage.id!,
      timestamp: Date.now(),
      evolutionInstance: conv.evolutionInstance || 'Principal',
      clientName: conv.clientName,
      hasImage: false,
    }, 0); // Prioridade máxima
    
    console.log('✅ Mensagem enfileirada com sucesso!');
    console.log('   A IA deve processar em alguns segundos...');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

forceProcessCosta();
