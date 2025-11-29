import { solicitarDesbloqueio } from "../server/ai-tools";
import { storage } from "../server/storage";

async function main() {
  console.log("🔓 Executando desbloqueio em confiança para Kauan...");
  
  try {
    const resultado = await solicitarDesbloqueio(
      "18833253660",  // CPF do Kauan
      { conversationId: "644a4be5-9b57-4d8b-90fb-b105af74efe0" },
      storage
    );
    
    console.log("✅ Resultado:", JSON.stringify(resultado, null, 2));
  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

main();
