import { db } from '../server/db';
import { conversations, messages } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';

async function checkMariaConversation() {
  const conv = await db
    .select()
    .from(conversations)
    .where(sql`client_name ILIKE '%MARIA APARECIDA NEVES%' AND status = 'active'`)
    .limit(1);

  if (conv.length === 0) {
    console.log('Conversa não encontrada');
    return;
  }

  const conversation = conv[0];
  
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id));

  console.log(`Mensagens: ${msgs.length}`);
  
  if (msgs.length === 0) {
    console.log('SEM MENSAGENS - deletar esta conversa');
    
    await db
      .delete(conversations)
      .where(eq(conversations.id, conversation.id));
    
    console.log('Conversa deletada!');
  } else {
    console.log('TEM mensagens - não deletar');
  }
}

checkMariaConversation()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
