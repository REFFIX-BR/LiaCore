import { storage } from "../server/storage";

/**
 * Script para corrigir chatIds de conversas de campanha WhatsApp
 * Bug: foram criadas com whatsapp_24... ao invés de whatsapp_5524...
 */
async function fixChatIds() {
  console.log('🔧 [Fix ChatIds] Iniciando correção...\n');
  
  try {
    // Buscar todas conversas de campanha WhatsApp das últimas 24 horas
    const { db } = await import('../server/db');
    const { conversations } = await import('../shared/schema');
    const { and, eq, like, gte, sql } = await import('drizzle-orm');
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const campaignConversations = await db.query.conversations.findMany({
      where: and(
        eq(conversations.conversationSource, 'whatsapp_campaign'),
        gte(conversations.createdAt, oneDayAgo)
      )
    });
    
    console.log(`📊 [Fix ChatIds] Encontradas ${campaignConversations.length} conversas de campanha\n`);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const conv of campaignConversations) {
      const currentChatId = conv.chatId;
      
      // Verificar se chatId começa com whatsapp_ mas NÃO tem 55 depois
      if (currentChatId.startsWith('whatsapp_')) {
        const number = currentChatId.replace('whatsapp_', '');
        
        // Se não começar com 55, precisa corrigir
        if (!number.startsWith('55')) {
          const newChatId = `whatsapp_55${number}`;
          
          console.log(`🔄 [Fix] ${conv.clientName}`);
          console.log(`   ❌ Antigo: ${currentChatId}`);
          console.log(`   ✅ Novo:   ${newChatId}`);
          
          // Atualizar chatId
          await db.update(conversations)
            .set({ 
              chatId: newChatId,
              clientId: `55${number}`
            })
            .where(eq(conversations.id, conv.id));
          
          fixed++;
          console.log(`   ✅ Corrigido!\n`);
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    }
    
    console.log(`\n🎉 [Fix ChatIds] Correção concluída!`);
    console.log(`   ✅ Corrigidos: ${fixed}`);
    console.log(`   ⏭️  Pulados: ${skipped}`);
    
  } catch (error) {
    console.error('❌ [Fix ChatIds] Erro:', error);
    throw error;
  }
}

// Executar
fixChatIds()
  .then(() => {
    console.log('\n✅ Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
