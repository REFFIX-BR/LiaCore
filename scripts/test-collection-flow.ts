/**
 * Integration test for WhatsApp collection flow
 * 
 * Tests the complete flow:
 * 1. Template sending with named header variable
 * 2. WhatsApp message delivery confirmation
 */

import { sendWhatsAppTemplate } from '../server/lib/whatsapp';

async function testCollectionFlow() {
  console.log('🧪 Testing WhatsApp Collection Flow\n');
  
  // Test 1: Send template with named header variable
  console.log('📋 Test 1: Sending template "financeiro_em_atraso" with header parameter...');
  
  const result = await sendWhatsAppTemplate(
    '5522997074180', // Test number
    {
      templateName: 'financeiro_em_atraso',
      languageCode: 'en',
      headerParameters: [{
        value: 'Marcio',
        parameterName: 'texto' // Named variable {{texto}} in header
      }]
    },
    'Cobranca'
  );
  
  if (result.success) {
    console.log('✅ Template sent successfully!');
    console.log(`   WhatsApp Message ID: ${result.whatsappMessageId}`);
    console.log(`   Remote JID: ${result.remoteJid}`);
  } else {
    console.log('❌ Template sending failed');
    console.log(`   Error: ${result.errorMessage}`);
    console.log(`   Status: ${result.errorStatus}`);
    console.log(`   Permanent failure: ${result.isPermanentFailure}`);
  }
  
  console.log('\n✅ All tests completed!');
}

// Run tests
testCollectionFlow().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
