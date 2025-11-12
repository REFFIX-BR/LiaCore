import { sendWhatsAppTemplate } from '../server/lib/whatsapp';
import { db } from '../server/db';
import { voiceCampaignTargets } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

async function forceWhatsAppTest() {
  try {
    const campaignId = '2025b997-22ea-4e72-987b-9896bd923fc9';
    
    console.log('🔍 Buscando target habilitado...\n');
    
    // Pegar primeiro target habilitado
    const targets = await db
      .select()
      .from(voiceCampaignTargets)
      .where(and(
        eq(voiceCampaignTargets.campaignId, campaignId),
        eq(voiceCampaignTargets.enabled, true),
        eq(voiceCampaignTargets.state, 'pending')
      ))
      .limit(1);
    
    if (targets.length === 0) {
      console.log('❌ Nenhum target habilitado encontrado');
      process.exit(1);
    }
    
    const target = targets[0];
    const firstName = target.debtorName.split(' ')[0];
    
    console.log('📱 TESTE DE ENVIO WHATSAPP FORÇADO');
    console.log(`Cliente: ${target.debtorName}`);
    console.log(`Telefone: ${target.phoneNumber}`);
    console.log(`Primeiro nome: ${firstName}`);
    console.log(`Template: financeiro_em_atraso`);
    console.log(`Instância: Cobranca\n`);
    
    console.log('Enviando template via Evolution API...\n');
    
    const result = await sendWhatsAppTemplate(
      target.phoneNumber,
      {
        templateName: 'financeiro_em_atraso',
        languageCode: 'en',
        parameters: [firstName],
      },
      'Cobranca'
    );
    
    console.log('📊 RESULTADO DO ENVIO:');
    console.log('='.repeat(50));
    console.log(`✅ Success: ${result.success}`);
    console.log(`📝 Message: ${result.message || 'N/A'}`);
    
    if (!result.success) {
      console.log(`\n❌ ERRO DETECTADO:`);
      console.log(`   Error Message: ${result.errorMessage}`);
      console.log(`   HTTP Status: ${result.errorStatus}`);
      console.log(`   Is Permanent Failure: ${result.isPermanentFailure}`);
    } else {
      console.log(`\n🎉 MENSAGEM ENVIADA COM SUCESSO!`);
      console.log(`   O cliente deve receber a mensagem em breve.`);
    }
    
    console.log('='.repeat(50));
    console.log('\n✅ Teste concluído');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error);
    console.error('\nStack trace:', (error as Error).stack);
    process.exit(1);
  }
}

console.log('🚀 Iniciando teste de envio WhatsApp...\n');
forceWhatsAppTest();
