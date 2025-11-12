import { db } from "../server/db";
import { eq } from "drizzle-orm";
import { conversations } from "../shared/schema";

/**
 * Script para corrigir instância Evolution API de conversas de cobrança
 * TODAS as cobranças devem usar a instância "Cobranca" (sem acento - normalizada)
 */
async function fixCobrancaInstances() {
  console.log("🔧 Iniciando correção de instâncias de cobrança...\n");

  try {
    // 1. Buscar todas as conversas com assistantType = 'cobranca' que NÃO estão em 'Cobranca'
    const result = await db
      .update(conversations)
      .set({
        evolutionInstance: 'Cobranca', // Usar "Cobranca" (sem acento) que é o padrão normalizado
      })
      .where(eq(conversations.assistantType, 'cobranca'))
      .returning({
        id: conversations.id,
        clientName: conversations.clientName,
        oldInstance: conversations.evolutionInstance,
      });

    console.log(`✅ Atualizadas ${result.length} conversas de cobrança\n`);

    if (result.length > 0) {
      console.log("📋 Conversas corrigidas:");
      result.forEach((conv, idx) => {
        console.log(`   ${idx + 1}. ${conv.clientName} - Instância: ${conv.oldInstance} → Cobranca`);
      });
      console.log("");
    }

    // 2. Verificar conversas de cobrança atuais
    const summary = await db
      .select()
      .from(conversations)
      .where(eq(conversations.assistantType, 'cobranca'));

    console.log("\n📊 RESUMO FINAL:");
    console.log(`   Total de conversas de cobrança: ${summary.length}`);
    
    const byInstance = summary.reduce((acc: Record<string, number>, conv) => {
      const inst = conv.evolutionInstance || 'null';
      acc[inst] = (acc[inst] || 0) + 1;
      return acc;
    }, {});

    console.log("   Por instância:");
    Object.entries(byInstance).forEach(([inst, count]) => {
      const status = inst === 'Cobranca' ? '✅' : '❌';
      console.log(`   ${status} ${inst}: ${count} conversas`);
    });

    console.log("\n🎉 Correção concluída!");
    console.log("\n📌 PRÓXIMOS PASSOS:");
    console.log("   1. Todas as cobranças agora usam a instância 'Cobranca'");
    console.log("   2. Verifique se a campanha tem targets carregados");
    console.log("   3. Inicie os disparos via dashboard de cobranças");

  } catch (error) {
    console.error("❌ Erro ao corrigir instâncias:", error);
    throw error;
  }
}

// Executar o script
fixCobrancaInstances()
  .then(() => {
    console.log("\n✅ Script concluído com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro fatal:", error);
    process.exit(1);
  });
