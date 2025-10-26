import OpenAI from 'openai';
import { db } from './server/db';
import { conversations } from './shared/schema';
import { eq } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function fixApresentacaoThread() {
  try {
    const conversationId = '80e5fe7f-551e-4955-b489-e014ad775488';
    
    console.log(`🔍 Buscando conversa ${conversationId}...`);
    
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    if (!conversation) {
      console.error('❌ Conversa não encontrada');
      return;
    }
    
    console.log(`✅ Conversa encontrada:`);
    console.log(`   Thread ID atual: ${conversation.threadId}`);
    console.log(`   Assistant Type: ${conversation.assistantType}`);
    console.log(`   Cliente: ${conversation.clientPhone}`);
    
    // Deletar thread antiga se existir
    if (conversation.threadId) {
      try {
        console.log(`\n🗑️  Deletando thread antiga ${conversation.threadId}...`);
        await openai.beta.threads.del(conversation.threadId);
        console.log(`✅ Thread antiga deletada com sucesso`);
      } catch (error: any) {
        console.log(`⚠️  Thread antiga já não existe ou erro ao deletar: ${error.message}`);
      }
    }
    
    // Criar nova thread
    console.log(`\n🆕 Criando nova thread para Apresentação...`);
    const newThread = await openai.beta.threads.create();
    console.log(`✅ Nova thread criada: ${newThread.id}`);
    
    // Atualizar banco de dados
    console.log(`\n💾 Atualizando banco de dados...`);
    await db
      .update(conversations)
      .set({
        threadId: newThread.id,
        assistantType: 'apresentacao',
        metadata: {
          ...conversation.metadata as any,
          threadHistory: [
            ...((conversation.metadata as any)?.threadHistory || []),
            {
              oldThreadId: conversation.threadId,
              newThreadId: newThread.id,
              reason: 'Reset - remover ferramentas antigas da thread',
              timestamp: new Date().toISOString()
            }
          ]
        }
      })
      .where(eq(conversations.id, conversationId));
    
    console.log(`✅ Banco de dados atualizado!`);
    
    console.log(`\n\n========== RESUMO ==========`);
    console.log(`Conversa: ${conversationId}`);
    console.log(`Thread antiga: ${conversation.threadId} ❌ (deletada)`);
    console.log(`Thread nova: ${newThread.id} ✅ (criada)`);
    console.log(`Assistant: apresentacao`);
    console.log(`\n🎯 Próxima mensagem do cliente irá para thread LIMPA!`);
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

fixApresentacaoThread();
