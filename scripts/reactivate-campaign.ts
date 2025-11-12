import { storage } from '../server/storage';

(async () => {
  const campaigns = await storage.getAllVoiceCampaigns();
  const activeCampaign = campaigns.find(c => c.status === 'active');
  
  if (!activeCampaign) {
    console.log('❌ Nenhuma campanha ativa encontrada');
    process.exit(1);
  }
  
  console.log(`📊 Campanha ativa: ${activeCampaign.name} (ID: ${activeCampaign.id})`);
  
  // Desativar
  console.log('⏸️  Pausando campanha...');
  await storage.updateVoiceCampaign(activeCampaign.id, { status: 'paused' });
  
  // Aguardar 2 segundos
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Reativar
  console.log('▶️  Reativando campanha...');
  await storage.updateVoiceCampaign(activeCampaign.id, { status: 'active' });
  
  console.log('✅ Campanha reativada! Aguarde o processamento dos jobs...');
  process.exit(0);
})();
