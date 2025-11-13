import { db } from '../server/db';
import { voiceCampaignTargets } from '../shared/schema';
import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

async function test() {
  try {
    const [t] = await db.insert(voiceCampaignTargets).values({
      campaignId: 'ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2',
      phoneNumber: '5522997074180',
      debtorName: 'TESTE',
      state: 'pending',
      attemptCount: 0,
      enabled: true,
    }).returning();
    
    await addVoiceWhatsAppCollectionToQueue({
      targetId: t.id,
      campaignId: 'ab185c91-1f4f-4b9c-bf4c-4650e2ca9fb2',
      phoneNumber: '5522997074180',
      clientName: 'TESTE',
      clientDocument: null,
      debtAmount: '0',
      attemptNumber: 1,
    }, 0);
    
    console.log('\n✅ JOB ENVIADO! Target ID:', t.id);
    console.log('\n⏰ Aguarde 25 segundos...\n');
  } catch (e: any) {
    console.error('❌', e.message);
  }
  process.exit(0);
}
test();
