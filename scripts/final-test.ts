import { db } from '../server/db';
import { voiceCampaignTargets } from '../shared/schema';
import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

async function test() {
  try {
    const [t] = await db.insert(voiceCampaignTargets).values({
      campaignId: 1,
      phoneNumber: '5522997074180',
      debtorName: 'TESTE CORRECAO',
      state: 'pending',
      attemptCount: 0,
      enabled: true,
    }).returning();
    
    await addVoiceWhatsAppCollectionToQueue({
      targetId: t.id,
      campaignId: 1,
      phoneNumber: '5522997074180',
      clientName: 'TESTE CORRECAO',
      clientDocument: null,
      debtAmount: '0',
      attemptNumber: 1,
    }, 0);
    
    console.log('✅ JOB ENVIADO! Target ID:', t.id);
    console.log('');
    console.log('📱 VERIFIQUE SEU WHATSAPP EM 20 SEGUNDOS:');
    console.log('   ✅ Se a mensagem vier COMPLETA (com nome e texto) = CORRIGIDO!');
    console.log('   ❌ Se vier só "▶️financeiro_em_atraso◀️" = ainda há problema');
  } catch (e: any) {
    console.error('❌ Erro:', e.message);
  }
  process.exit(0);
}
test();
