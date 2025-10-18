import { db } from "../db";
import { plans } from "../../shared/schema";
import { sql } from "drizzle-orm";

/**
 * Script para popular a tabela de planos com os 3 planos da TR Telecom
 * Baseado no documento HAG_IA_CADASTRO_CLIENTES.md
 */

const plansData = [
  {
    id: "17",
    name: "50 Mega",
    type: "internet",
    speed: 50,
    price: 6990, // R$ 69,90 em centavos
    description: "Plano ideal para uso básico a moderado. Perfeito para 1-2 pessoas.",
    features: [
      "50 Mbps de velocidade",
      "Ideal para 1-2 pessoas",
      "Redes sociais e navegação",
      "Streaming em boa qualidade",
      "Fibra óptica verdadeira",
      "Suporte 24/7"
    ],
    isActive: true,
  },
  {
    id: "22",
    name: "650 Mega",
    type: "internet",
    speed: 650,
    price: 10990, // R$ 109,90 em centavos
    description: "Nosso plano mais vendido! Ideal para famílias e home office.",
    features: [
      "650 Mbps de velocidade",
      "Ideal para 3-4 pessoas",
      "Home office e videochamadas",
      "Streaming em 4K",
      "Gaming online",
      "Downloads rápidos",
      "Fibra óptica verdadeira",
      "Suporte 24/7"
    ],
    isActive: true,
  },
  {
    id: "23",
    name: "1 Giga",
    type: "internet",
    speed: 1000,
    price: 14990, // R$ 149,90 em centavos
    description: "Máxima performance para famílias grandes e pequenas empresas.",
    features: [
      "1000 Mbps (1 Gbps) de velocidade",
      "Ideal para 5+ pessoas ou empresas",
      "Múltiplos dispositivos simultâneos",
      "Streamers e criadores de conteúdo",
      "Gaming profissional",
      "Upload ultrarrápido",
      "Fibra óptica verdadeira",
      "Suporte 24/7 prioritário"
    ],
    isActive: true,
  },
];

async function populatePlans() {
  console.log("🚀 Iniciando população da tabela de planos...\n");

  try {
    // Limpar tabela existente (apenas para desenvolvimento)
    console.log("🗑️  Limpando tabela de planos...");
    await db.delete(plans);

    // Inserir planos
    console.log("📝 Inserindo planos da TR Telecom...\n");
    
    for (const plan of plansData) {
      await db.insert(plans).values(plan);
      console.log(`✅ Plano ${plan.name} (ID: ${plan.id}) - R$ ${(plan.price / 100).toFixed(2)}`);
    }

    console.log("\n✅ Tabela de planos populada com sucesso!");
    console.log(`\n📊 Total de planos cadastrados: ${plansData.length}`);

    // Verificar dados inseridos
    const allPlans = await db.select().from(plans);
    console.log("\n📋 Planos disponíveis no banco:");
    allPlans.forEach(p => {
      console.log(`   - ${p.name} (${p.speed} Mbps) - R$ ${(p.price / 100).toFixed(2)}/mês`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao popular planos:", error);
    process.exit(1);
  }
}

populatePlans();
