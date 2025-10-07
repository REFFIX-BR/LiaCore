// Test script para simular webhooks do Evolution API
const API_BASE = "http://localhost:5000/api";

async function testEvolutionWebhook() {
  console.log("🧪 === TESTE DE WEBHOOK EVOLUTION API ===\n");

  try {
    // Simulação 1: Mensagem simples (conversation)
    console.log("📤 1. Simulando mensagem simples do WhatsApp...");
    const payload1 = {
      event: "messages.upsert",
      instance: "tr_telecom",
      data: {
        key: {
          remoteJid: "5511999887766@s.whatsapp.net",
          fromMe: false,
          id: "3EB0D2F0F7C5E6E7A1B2"
        },
        pushName: "João Silva",
        message: {
          conversation: "Olá, preciso de ajuda com minha internet que está muito lenta"
        },
        messageType: "conversation",
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    };

    const response1 = await fetch(`${API_BASE}/webhooks/evolution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload1)
    });
    const result1 = await response1.json();
    console.log("✅ Resposta:", result1);

    // Aguardar processamento
    console.log("\n⏳ Aguardando processamento da IA...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Simulação 2: Mensagem extendida (com resposta)
    console.log("\n📤 2. Simulando mensagem com texto estendido...");
    const payload2 = {
      event: "messages.upsert",
      instance: "tr_telecom",
      data: {
        key: {
          remoteJid: "5511999887766@s.whatsapp.net",
          fromMe: false,
          id: "4FC1E3G1H8D6F7H8B2C3"
        },
        pushName: "João Silva",
        message: {
          extendedTextMessage: {
            text: "Quero falar com um atendente humano, por favor"
          }
        },
        messageType: "extendedTextMessage",
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    };

    const response2 = await fetch(`${API_BASE}/webhooks/evolution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload2)
    });
    const result2 = await response2.json();
    console.log("✅ Resposta:", result2);

    // Aguardar processamento
    console.log("\n⏳ Aguardando processamento...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simulação 3: Verificar se conversa foi transferida
    console.log("\n📋 3. Verificando conversas transferidas...");
    const response3 = await fetch(`${API_BASE}/conversations/transferred`);
    const transferred = await response3.json();
    
    if (transferred.length > 0) {
      console.log(`✅ ${transferred.length} conversa(s) transferida(s):`);
      transferred.forEach(conv => {
        console.log(`   - ${conv.clientName} (${conv.chatId})`);
        console.log(`     Motivo: ${conv.transferReason}`);
      });
    } else {
      console.log("⚠️  Nenhuma conversa transferida");
    }

    // Simulação 4: Mensagem de outro cliente (comercial)
    console.log("\n📤 4. Simulando mensagem comercial de outro cliente...");
    const payload3 = {
      event: "messages.upsert",
      instance: "tr_telecom",
      data: {
        key: {
          remoteJid: "5511988776655@s.whatsapp.net",
          fromMe: false,
          id: "5GD2F4H2I9E7G8I9C3D4"
        },
        pushName: "Maria Souza",
        message: {
          conversation: "Quero contratar um plano de internet"
        },
        messageType: "conversation",
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    };

    const response4 = await fetch(`${API_BASE}/webhooks/evolution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload4)
    });
    const result4 = await response4.json();
    console.log("✅ Resposta:", result4);

    // Simulação 5: Mensagem com imagem
    console.log("\n📤 5. Simulando mensagem com imagem...");
    const payload5 = {
      event: "messages.upsert",
      instance: "tr_telecom",
      data: {
        key: {
          remoteJid: "5511988776655@s.whatsapp.net",
          fromMe: false,
          id: "6HE3G5I3J0F8H9J0D4E5"
        },
        pushName: "Maria Souza",
        message: {
          imageMessage: {
            caption: "Olha como está minha conexão",
            url: "https://example.com/image.jpg",
            mimetype: "image/jpeg"
          }
        },
        messageType: "imageMessage",
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    };

    const response5 = await fetch(`${API_BASE}/webhooks/evolution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload5)
    });
    const result5 = await response5.json();
    console.log("✅ Resposta:", result5);

    // Simulação 6: Mensagem enviada por nós (deve ser ignorada)
    console.log("\n📤 6. Simulando mensagem enviada por nós (deve ser ignorada)...");
    const payload6 = {
      event: "messages.upsert",
      instance: "tr_telecom",
      data: {
        key: {
          remoteJid: "5511988776655@s.whatsapp.net",
          fromMe: true,  // Mensagem nossa
          id: "7IF4H6J4K1G9I0K1E5F6"
        },
        pushName: "TR Telecom",
        message: {
          conversation: "Olá! Como posso ajudar?"
        },
        messageType: "conversation",
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    };

    const response6 = await fetch(`${API_BASE}/webhooks/evolution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload6)
    });
    const result6 = await response6.json();
    console.log("✅ Resposta (deve estar ignorada):", result6);

    console.log("\n✅ === TESTE CONCLUÍDO ===");
    
  } catch (error) {
    console.error("❌ Erro no teste:", error.message);
  }
}

testEvolutionWebhook();
