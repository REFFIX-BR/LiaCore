import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { QUEUE_NAMES, WhatsAppCollectionJob } from '../server/lib/queue';

async function testManuela() {
  console.log('📤 Enviando mensagem para MANUELA para validar webhook...\n');
  
  const collectionQueue = new Queue<WhatsAppCollectionJob>(QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION, {
    connection: redisConnection,
  });
  
  try {
    const targetId = '9ca4962a-daa8-415c-9edf-5ee288ba48aa'; // MANUELA
    
    await collectionQueue.add(
      'send-whatsapp',
      { targetId },
      {
        jobId: `test-manuela-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    
    console.log('✅ Mensagem enfileirada para MANUELA (55 24 99243-0009)');
    console.log('\n⏳ Aguarde ~30 segundos e verifique se webhook chega!');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  } finally {
    await collectionQueue.close();
  }
}

testManuela().catch(console.error);
