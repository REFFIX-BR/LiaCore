import { db } from '../server/db';
import { conversations } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';

console.log('🧹 Limpando conversas de cobrança do monitor...\n');

async function main() {
  // 1. Find all active whatsapp_campaign conversations
  console.log('📊 Buscando conversas de cobrança ativas...');
  
  const cobrancaConversations = await db
    .select()
    .from(conversations)
    .where(sql`${conversations.conversationSource} = 'whatsapp_campaign' AND ${conversations.status} = 'active'`);
  
  console.log(`   Encontradas ${cobrancaConversations.length} conversas de cobrança ativas\n`);
  
  if (cobrancaConversations.length === 0) {
    console.log('✅ Nenhuma conversa de cobrança ativa encontrada!');
    return;
  }
  
  // 2. Ask for confirmation
  console.log('⚠️  ATENÇÃO: Isso irá RESOLVER todas as conversas de cobrança ativas.');
  console.log('   As conversas não serão deletadas, apenas marcadas como "resolved".\n');
  
  // 3. Resolve all cobrança conversations
  console.log('🔄 Resolvendo conversas...');
  let resolved = 0;
  
  for (const conv of cobrancaConversations) {
    try {
      await db
        .update(conversations)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          autoClosedReason: 'Limpeza manual de conversas de cobrança'
        })
        .where(eq(conversations.id, conv.id));
      
      console.log(`   ✅ RESOLVIDA: ${conv.chatId} (${conv.clientName})`);
      resolved++;
      
    } catch (error) {
      console.error(`   ❌ ERRO: ${conv.chatId}:`, error);
    }
  }
  
  console.log('\n📊 Resumo:');
  console.log(`   ✅ Resolvidas: ${resolved} conversas`);
  console.log(`   📦 Total: ${cobrancaConversations.length} conversas\n`);
  
  // 4. Validation
  console.log('🔍 Validando resultados...');
  const remaining = await db
    .select()
    .from(conversations)
    .where(sql`${conversations.conversationSource} = 'whatsapp_campaign' AND ${conversations.status} = 'active'`);
  
  if (remaining.length === 0) {
    console.log('   ✅ Todas as conversas de cobrança foram resolvidas!\n');
  } else {
    console.warn(`   ⚠️ Ainda há ${remaining.length} conversas ativas\n`);
  }
  
  console.log('✅ Limpeza concluída!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Limpeza falhou:', error);
    process.exit(1);
  });
