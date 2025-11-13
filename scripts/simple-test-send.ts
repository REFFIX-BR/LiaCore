/**
 * Teste simples via fila (usando campanha existente)
 */

import { db } from '../server/db';
import { voiceCampaignTargets } from '../shared/schema';
import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

async function simpleTest() {
  console.log('🎯 TESTE SIMPLES VIA FILA\n');
  
  try {
    // Criar target direto no banco
    const [target] = await db.insert(voiceCampaignTargets).values({
      campaignId: 1, // Usar campanha ID 1 (deve existir)
      phoneNumber: '5522997074180',
      clientName: 'TESTE CORRECAO',
      clientDocument: null,
      debtAmount: '99.90',
      installationId: null,
      alternativePhones: [],
      state: 'pending',
      attemptCount: 0,
      enabled: true,
    }).returning();
    
    console.log(`✅ Target criado: ID ${target.id}\n`);
    
    // Adicionar à fila
    await addVoiceWhatsAppCollectionToQueue({
      targetId: target.id,
      campaignId: 1,
      phoneNumber: '5522997074180',
      clientName: 'TESTE CORRECAO',
      clientDocument: null,
      debtAmount: '99.90',
      attemptNumber: 1,
    }, 0);
    
    console.log('✅ Adicionado à fila!\n');
    console.log('📱 Verifique seu WhatsApp em 20 segundos:');
    console.log('   Se a mensagem vier COMPLETA = CORRIGIDO ✅');
    console.log('   Se vier só "▶️template◀️" = ainda com problema ❌');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

simpleTest();
