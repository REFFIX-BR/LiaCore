/**
 * Script para resetar target preso em estado "calling"
 */
import { storage } from "../server/storage";

const TARGET_ID = 'a5535bc4-5c60-42b3-866d-a734798ba94a';

async function resetTarget() {
  console.log(`🔧 Resetando target ${TARGET_ID}...`);

  const target = await storage.getVoiceCampaignTarget(TARGET_ID);
  
  if (!target) {
    console.error('❌ Target não encontrado!');
    process.exit(1);
  }

  console.log(`📋 Estado atual: ${target.state}, tentativas: ${target.attemptCount}`);

  // Resetar para estado inicial
  await storage.updateVoiceCampaignTarget(TARGET_ID, {
    state: 'pending',
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    outcome: null,
    outcomeDetails: 'Reset manual - pronto para nova tentativa',
  });

  console.log(`✅ Target resetado para estado "pending" com 0 tentativas`);
  console.log(`🚀 Agora você pode ativar a campanha novamente!`);

  process.exit(0);
}

resetTarget().catch((error) => {
  console.error("❌ Erro ao resetar target:", error);
  process.exit(1);
});
