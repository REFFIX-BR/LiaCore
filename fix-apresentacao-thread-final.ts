import OpenAI from 'openai';
import Redis from 'ioredis';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const redis = new Redis({
  host: process.env.UPSTASH_REDIS_HOST!,
  port: parseInt(process.env.UPSTASH_REDIS_PORT || '6379'),
  password: process.env.UPSTASH_REDIS_PASSWORD!,
  tls: {},
  maxRetriesPerRequest: 3
});

async function fixThread() {
  try {
    const conversationId = '80e5fe7f-551e-4955-b489-e014ad775488';
    const chatId = 'whatsapp_5522997074180';
    
    // 1. Buscar thread atual
    const currentThreadId = await redis.get(`thread:${chatId}`);
    console.log(`🔍 Thread atual: ${currentThreadId}`);
    
    if (currentThreadId) {
      // 2. Tentar deletar thread antiga (pode já ter sido deletada)
      try {
        console.log('🗑️  Deletando thread contaminada...');
        await openai.beta.threads.delete(currentThreadId);
        console.log('✅ Thread deletada!');
      } catch (err: any) {
        console.log(`⚠️  Thread não encontrada (já deletada): ${err.message}`);
      }
    }
    
    // 3. Criar nova thread limpa
    console.log('🆕 Criando thread limpa...');
    const newThread = await openai.beta.threads.create({
      metadata: {
        conversationId,
        chatId,
        created_at: new Date().toISOString()
      }
    });
    console.log(`✅ Nova thread criada: ${newThread.id}`);
    
    // 4. Salvar no Redis
    await redis.set(`thread:${chatId}`, newThread.id);
    console.log('✅ Redis atualizado!');
    
    console.log('\n========== THREAD ATUALIZADA ==========');
    console.log('Conversa:', conversationId);
    console.log('❌ Thread antiga:', currentThreadId);
    console.log('✅ Thread nova:', newThread.id);
    console.log('\n🎯 Agora a Apresentação NÃO vai mais perguntar sobre endereços!');
    console.log('📌 Ela vai APENAS rotear para o assistente correto!');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

fixThread();
