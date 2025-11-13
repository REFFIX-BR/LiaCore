import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';
import { QUEUE_NAMES, WhatsAppCollectionJob } from '../server/lib/queue';

async function testSingleMessage() {
  console.log('📤 Enviando 1 mensagem de teste para validar webhook...\n');
  
  const collectionQueue = new Queue<WhatsAppCollectionJob>(QUEUE_NAMES.VOICE_WHATSAPP_COLLECTION, {
    connection: redisConnection,
  });
  
  try {
    // Use a fixed target ID for testing
    const targetId = '7d5fdcba-90d7-4cb9-97b3-c6d083258d01'; // GABRIEL
    
    await collectionQueue.add(
      'send-whatsapp',
      { targetId },
      {
        jobId: `test-${targetId}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    
    console.log('✅ Mensagem enfileirada para GABRIEL TAVARES');
    console.log('\n⏳ Aguarde ~30 segundos e verifique:');
    console.log('   1. Mensagem enviada nos logs');
    console.log('   2. Webhook recebido (DELIVERY_ACK/SERVER_ACK)');
    console.log('   3. Status no banco de dados atualizado');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  } finally {
    await collectionQueue.close();
  }
}

testSingleMessage().catch(console.error);
