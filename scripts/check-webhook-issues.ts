/**
 * Verificar problemas com webhooks
 */

import { storage } from '../server/storage';

async function checkWebhookIssues() {
  console.log('🔍 VERIFICANDO PROBLEMAS COM WEBHOOKS\n');
  
  try {
    // 1. Verificar conversas ativas sem mensagens recentes
    const allConversations = await storage.getAllConversations();
    const activeConversations = allConversations.filter(c => c.status === 'active');
    
    console.log(`📊 Total de conversas ativas: ${activeConversations.length}\n`);
    
    // 2. Verificar conversas onde última mensagem é muito antiga
    const now = Date.now();
    const staleConversations = activeConversations.filter(c => {
      if (!c.lastMessageTime) return false;
      const hoursSinceLastMessage = (now - new Date(c.lastMessageTime).getTime()) / (1000 * 60 * 60);
      return hoursSinceLastMessage > 1; // Mais de 1 hora
    });
    
    console.log(`⚠️  Conversas ativas sem mensagens há mais de 1 hora: ${staleConversations.length}`);
    
    if (staleConversations.length > 0) {
      console.log('\n📋 Conversas suspeitas (sem mensagens recentes):');
      for (const conv of staleConversations.slice(0, 10)) {
        const hoursSinceLastMessage = conv.lastMessageTime 
          ? Math.floor((now - new Date(conv.lastMessageTime).getTime()) / (1000 * 60 * 60))
          : '?';
        console.log(`  - ${conv.clientName} (${conv.chatId})`);
        console.log(`    Última mensagem: há ${hoursSinceLastMessage}h`);
        console.log(`    Status: ${conv.status}`);
      }
    }
    
    // 3. Verificar conversa específica COSTA
    const costa = allConversations.find(c => c.chatId === 'whatsapp_553298144141');
    if (costa) {
      console.log('\n🔍 CONVERSA COSTA (553298144141):');
      console.log(`  ID: ${costa.id}`);
      console.log(`  Nome: ${costa.clientName}`);
      console.log(`  Status: ${costa.status}`);
      console.log(`  Assistente: ${costa.assistantType}`);
      console.log(`  Thread ID: ${costa.threadId || 'nenhum'}`);
      
      const messages = await storage.getConversationMessages(costa.id);
      console.log(`  Total de mensagens: ${messages.length}`);
      
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        console.log(`  Última mensagem:`);
        console.log(`    De: ${lastMessage.role}`);
        console.log(`    Quando: ${lastMessage.timestamp}`);
        console.log(`    Conteúdo: ${lastMessage.content.substring(0, 100)}...`);
      }
    } else {
      console.log('\n❌ Conversa COSTA não encontrada no banco de dados!');
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

checkWebhookIssues();
