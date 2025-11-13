import { db } from '../server/db';
import { voiceCampaignTargets } from '../shared/schema';
import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

async function test() {
  try {
    const [t] = await db.insert(voiceCampaignTargets).values({
      campaignId: 1,
      phoneNumber: '5522997074180',
      clientName: 'TESTE',
      state: 'pending',
      attemptCount: 0,
      enabled: true,
    }).returning();
    
    await addVoiceWhatsAppCollectionToQueue({
      targetId: t.id,
      campaignId: 1,
      phoneNumber: '5522997074180',
      clientName: 'TESTE',
      clientDocument: null,
      debtAmount: '0',
      attemptNumber: 1,
    }, 0);
    
    console.log('✅ Enviado! Target ID:', t.id);
    console.log('📱 Verifique WhatsApp em 20s');
  } catch (e: any) {
    console.error('❌', e.message);
  }
  process.exit(0);
}
test();
