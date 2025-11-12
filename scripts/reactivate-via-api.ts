import { apiRequest } from '../client/src/lib/queryClient';

(async () => {
  // Simular login admin
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    credentials: 'include'
  });
  
  if (!loginRes.ok) {
    console.error('❌ Erro no login:', await loginRes.text());
    process.exit(1);
  }
  
  const cookies = loginRes.headers.get('set-cookie');
  console.log('✅ Login feito');
  
  // Buscar campanhas
  const campaignsRes = await fetch('http://localhost:5000/api/voice/campaigns', {
    headers: { 'Cookie': cookies || '' }
  });
  const campaigns = await campaignsRes.json();
  const activeCampaign = campaigns.find((c: any) => c.status === 'active');
  
  if (!activeCampaign) {
    console.log('❌ Nenhuma campanha ativa');
    process.exit(1);
  }
  
  console.log(`📊 Campanha: ${activeCampaign.name}`);
  
  // Pausar
  console.log('⏸️  Pausando...');
  await fetch(`http://localhost:5000/api/voice/campaigns/${activeCampaign.id}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify({ status: 'paused' })
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Reativar
  console.log('▶️  Reativando...');
  const activateRes = await fetch(`http://localhost:5000/api/voice/campaigns/${activeCampaign.id}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify({ status: 'active' })
  });
  
  const result = await activateRes.json();
  console.log('📊 Resultado:', JSON.stringify(result, null, 2));
  console.log('✅ Concluído!');
  process.exit(0);
})();
