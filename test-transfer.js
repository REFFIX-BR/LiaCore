// Test script to simulate a conversation with human transfer
const API_BASE = 'http://localhost:5000/api';

async function testTransfer() {
  console.log('\n🧪 === TESTE DE TRANSFERÊNCIA PARA HUMANO ===\n');
  
  const chatId = `test-${Date.now()}`;
  
  try {
    // Passo 1: Enviar mensagem inicial
    console.log('📤 1. Enviando mensagem inicial: "Olá, preciso de ajuda"');
    const msg1 = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        clientName: 'Cliente Teste',
        clientId: 'test-client-123',
        message: 'Olá, preciso de ajuda com minha internet'
      })
    });
    const response1 = await msg1.json();
    console.log('✅ Resposta do assistente:', response1.response);
    console.log('   Tipo de assistente:', response1.assistantType);
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Passo 2: Solicitar transferência
    console.log('\n📤 2. Solicitando transferência: "quero falar com um atendente humano"');
    const msg2 = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        clientName: 'Cliente Teste',
        clientId: 'test-client-123',
        message: 'quero falar com um atendente humano'
      })
    });
    const response2 = await msg2.json();
    console.log('✅ Resposta do assistente:', response2.response);
    console.log('   Transferido?', response2.transferred ? '✅ SIM' : '❌ NÃO');
    if (response2.transferred) {
      console.log('   Departamento:', response2.transferredTo);
    }
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Passo 3: Verificar conversas transferidas
    console.log('\n📋 3. Verificando conversas transferidas...');
    const transferred = await fetch(`${API_BASE}/conversations/transferred`);
    const transferredConvs = await transferred.json();
    
    const myConv = transferredConvs.find(c => c.chatId === chatId);
    
    if (myConv) {
      console.log('✅ Conversa encontrada na fila de transferências!');
      console.log('   ID:', myConv.id);
      console.log('   Status:', myConv.status);
      console.log('   Transferido para humano?', myConv.transferredToHuman ? 'SIM' : 'NÃO');
      console.log('   Motivo da transferência:', myConv.transferReason);
      console.log('   Departamento:', myConv.metadata?.transferredTo);
    } else {
      console.log('⚠️  Conversa não encontrada na fila de transferências');
      console.log('   Total de conversas transferidas:', transferredConvs.length);
    }
    
    // Passo 4: Verificar no monitor
    console.log('\n📊 4. Verificando no monitor...');
    const monitor = await fetch(`${API_BASE}/monitor/conversations`);
    const monitorConvs = await monitor.json();
    
    const monitorConv = monitorConvs.find(c => c.chatId === chatId);
    
    if (monitorConv) {
      console.log('✅ Conversa encontrada no monitor!');
      console.log('   Status:', monitorConv.status);
      console.log('   Urgência:', monitorConv.urgency);
      console.log('   Sentimento:', monitorConv.sentiment);
      console.log('   Transferido?', monitorConv.transferredToHuman ? 'SIM' : 'NÃO');
    } else {
      console.log('⚠️  Conversa não encontrada no monitor');
    }
    
    console.log('\n✅ === TESTE CONCLUÍDO ===\n');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testTransfer();
