import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';
import { storage } from '../server/storage';

async function enqueueTarget() {
  try {
    const targetId = '02b9a6c0-070c-4e02-9082-b550595568ef';
    const campaignId = '0f3ae74a-6dff-4b7f-b5dd-71ba2c0f4ffe';
    
    const target = await storage.getVoiceCampaignTarget(targetId);
    
    if (!target) {
      console.error('❌ Target não encontrado');
      process.exit(1);
    }
    
    console.log('📋 Target encontrado:', {
      nome: target.debtorName,
      telefone: target.phoneNumber,
      estado: target.state,
      tentativas: target.attemptCount
    });
    
    console.log('📤 Enfileirando para WhatsApp...');
    
    await addVoiceWhatsAppCollectionToQueue({
      targetId,
      campaignId,
      phoneNumber: target.phoneNumber,
      clientName: target.debtorName,
      clientDocument: target.debtorDocument || 'N/A',
      debtAmount: target.debtAmount || 0,
      attemptNumber: 1,
    }, 0); // Sem delay
    
    console.log('✅ Target enfileirado com sucesso!');
    console.log('💬 O WhatsApp Worker deve processar em breve...');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erro ao enfileirar:', error.message);
    process.exit(1);
  }
}

enqueueTarget();
