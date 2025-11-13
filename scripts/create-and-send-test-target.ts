/**
 * Criar target real e enviar via fila
 */

import { storage } from '../server/storage';
import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

async function createAndSendTest() {
  console.log('🎯 CRIANDO TARGET REAL E ENVIANDO VIA FILA\n');
  
  try {
    // Criar campanha de teste
    let campaign = await storage.getVoiceCampaignByName('TESTE_CORRECAO');
    
    if (!campaign) {
      console.log('📋 Criando campanha de teste...');
      campaign = await storage.createVoiceCampaign({
        name: 'TESTE_CORRECAO',
        description: 'Teste de correção do template',
        startDate: new Date(),
        targetCount: 1,
        state: 'active',
      });
      console.log(`✅ Campanha criada: ID ${campaign.id}\n`);
    } else {
      console.log(`✅ Campanha já existe: ID ${campaign.id}\n`);
    }
    
    // Criar target de teste
    console.log('👤 Criando target de teste...');
    const target = await storage.createVoiceCampaignTarget({
      campaignId: campaign.id,
      phoneNumber: '5522997074180', // Seu número
      clientName: 'TESTE FILA CORRIGIDA',
      clientDocument: null,
      debtAmount: '50.00',
      installationId: null,
      alternativePhones: [],
      state: 'pending',
      attemptCount: 0,
      enabled: true,
    });
    
    console.log(`✅ Target criado: ID ${target.id}`);
    console.log(`   Nome: ${target.clientName}`);
    console.log(`   Telefone: ${target.phoneNumber}\n`);
    
    // Adicionar à fila
    console.log('📤 Adicionando à fila WhatsApp...');
    const job = await addVoiceWhatsAppCollectionToQueue({
      targetId: target.id,
      campaignId: campaign.id,
      phoneNumber: target.phoneNumber,
      clientName: target.clientName,
      clientDocument: target.clientDocument,
      debtAmount: target.debtAmount || '0.00',
      attemptNumber: 1,
    }, 0); // Enviar imediatamente
    
    console.log(`✅ Job criado: ID ${job.id}\n`);
    console.log('📱 AGUARDE 15-30 SEGUNDOS:');
    console.log('   1. Worker vai processar o job');
    console.log('   2. Vai enviar WhatsApp com template CORRIGIDO');
    console.log('   3. Verifique seu WhatsApp (22 99707-4180)');
    console.log('');
    console.log('RESULTADO ESPERADO:');
    console.log('   ✅ Mensagem completa expandida (nome + texto)');
    console.log('   ❌ Se vier só "▶️financeiro_em_atraso◀️" = ainda com problema');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

createAndSendTest();
