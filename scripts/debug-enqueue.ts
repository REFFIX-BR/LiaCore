import { addVoiceWhatsAppCollectionToQueue } from '../server/lib/queue';

async function debugEnqueue() {
  try {
    console.log('🔍 Debug: Trying to add job to queue...');
    
    const job = await addVoiceWhatsAppCollectionToQueue({
      targetId: 'TEST-ID-123',
      campaignId: '2025b997-22ea-4e72-987b-9896bd923fc9',
      phoneNumber: '5527999999999',
      clientName: 'TEST CLIENTE',
      clientDocument: '12345678900',
      debtAmount: 100.00,
      attemptNumber: 1,
    }, 0);
    
    console.log('✅ Job added successfully!');
    console.log(`   Job ID: ${job.id}`);
    console.log(`   Job name: ${job.name}`);
    console.log(`   Job data:`, job.data);
    console.log(`   Job opts:`, job.opts);
    
    // Wait a bit before checking
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n📊 Now checking queue status...');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error adding job:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

debugEnqueue();
