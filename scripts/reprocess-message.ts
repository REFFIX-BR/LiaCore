import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { db } from '../server/db';
import { messages } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

async function reprocessMessage() {
  const messageId = '88b5f760-8546-44af-9280-f97162c822b6'; // CPF message ID
  
  console.log('\n🔄 Reprocessando mensagem com CPF...\n');
  
  // Get message details
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  
  if (!message) {
    console.log('❌ Mensagem não encontrada');
    return;
  }
  
  console.log('📋 Mensagem encontrada:');
  console.log(`  - ID: ${message.id}`);
  console.log(`  - Conversa: ${message.conversationId}`);
  console.log(`  - Conteúdo: ${message.content}`);
  console.log(`  - Role: ${message.role}`);
  
  const queue = new Queue('message-processing', {
    connection: redisConnection
  });
  
  // Create job to reprocess this user message
  const job = await queue.add('process-message', {
    conversationId: message.conversationId,
    fromNumber: '5522997074180',
    content: message.content,
    idempotencyKey: `reprocess-${message.id}`,
    evolutionInstance: 'Cobranca',
    hasImage: false
  });
  
  console.log(`\n✅ Job criado: ${job.id}`);
  console.log('⏳ Aguardando processamento...\n');
  
  await queue.close();
}

reprocessMessage().catch(console.error);
