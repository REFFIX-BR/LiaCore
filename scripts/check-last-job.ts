import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function checkLastJob() {
  const queue = new Queue('voice-whatsapp-collection', {
    connection: redisConnection
  });

  console.log('\n📋 Verificando último job processado...\n');
  
  const completed = await queue.getCompleted();
  
  if (completed.length > 0) {
    // Pegar o último job completado
    const lastJob = completed[completed.length - 1];
    
    console.log(`✅ Último job completado:`);
    console.log(`   ID: ${lastJob.id}`);
    console.log(`   Cliente: ${lastJob.data.clientName}`);
    console.log(`   Telefone: ${lastJob.data.phoneNumber}`);
    console.log(`   Tentativa: ${lastJob.data.attemptNumber}`);
    console.log(`   Processado em: ${lastJob.finishedOn ? new Date(lastJob.finishedOn).toLocaleString('pt-BR') : 'N/A'}\n`);
    
    if (lastJob.returnvalue) {
      console.log(`📤 Resultado:`);
      console.log(JSON.stringify(lastJob.returnvalue, null, 2));
    }
  } else {
    console.log('Nenhum job completado encontrado.');
  }
  
  await queue.close();
}

checkLastJob().catch(console.error);
