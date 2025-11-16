/**
 * Verificar por que mensagens de COSTA não foram processadas
 */

import { storage } from '../server/storage';

async function checkCostaProcessing() {
  console.log('🔍 INVESTIGANDO PROCESSAMENTO DA CONVERSA COSTA\n');
  
  try {
    const conv = await storage.getConversationByChatId('whatsapp_553298144141');
    
    if (!conv) {
      console.error('❌ Conversa não encontrada!');
      process.exit(1);
    }
    
    console.log('📋 INFORMAÇÕES DA CONVERSA:');
    console.log(`  ID: ${conv.id}`);
    console.log(`  Nome: ${conv.clientName}`);
    console.log(`  Chat ID: ${conv.chatId}`);
    console.log(`  Status: ${conv.status}`);
    console.log(`  Assistente: ${conv.assistantType}`);
    console.log(`  Thread ID: ${conv.threadId || 'nenhum'}`);
    console.log(`  Última mensagem: ${conv.lastMessageTime}`);
    console.log('');
    
    const messages = await storage.getMessagesByConversationId(conv.id);
    
    console.log(`📬 TOTAL DE MENSAGENS: ${messages.length}\n`);
    
    // Mostrar últimas 10 mensagens
    const recent = messages.slice(-10);
    
    console.log('📨 ÚLTIMAS MENSAGENS:');
    for (const msg of recent) {
      const time = new Date(msg.timestamp!).toLocaleString('pt-BR');
      const preview = msg.content.substring(0, 60);
      console.log(`  ${msg.role === 'user' ? '👤' : '🤖'} ${time}`);
      console.log(`     ${preview}...`);
    }
    
    console.log('\n');
    
    // Verificar se há mensagens do usuário sem resposta
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
    
    if (lastUserMessage && lastAssistantMessage) {
      const userTime = new Date(lastUserMessage.timestamp!).getTime();
      const assistantTime = new Date(lastAssistantMessage.timestamp!).getTime();
      
      if (userTime > assistantTime) {
        const waitingMinutes = Math.floor((Date.now() - userTime) / (1000 * 60));
        console.log(`⚠️  PROBLEMA DETECTADO!`);
        console.log(`   Cliente enviou mensagem há ${waitingMinutes} minutos`);
        console.log(`   IA ainda não respondeu!`);
        console.log('');
        console.log(`   Última mensagem do cliente:`);
        console.log(`   "${lastUserMessage.content.substring(0, 100)}"`);
      } else {
        console.log('✅ IA já respondeu à última mensagem do cliente');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

checkCostaProcessing();
