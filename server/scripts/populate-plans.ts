import { db } from "../db";
import { plans } from "../../shared/schema";
import { sql } from "drizzle-orm";

/**
 * Script para popular a tabela de planos com os 3 planos da TR Telecom
 * Baseado no documento HAG_IA_CADASTRO_CLIENTES.md
 */

const plansData = [
  // ========== PLANOS DE INTERNET PURA ==========
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
  
  // ========== COMBOS COMPLETOS (Internet + Móvel + TV/Fixa) ==========
  {
    id: "24",
    name: "BRONZE - 650 Mega + 8GB + TV",
    type: "combo",
    speed: 650,
    price: 14990, // R$ 149,90 em centavos
    description: "Combo completo com internet, telefonia móvel e TV. Ideal para quem quer tudo integrado.",
    features: [
      "650 Mbps de internet fibra óptica",
      "8GB móvel (7GB + 1GB bônus portabilidade)",
      "TV inclusa",
      "Dupla operadora: Vivo e Tim",
      "Portabilidade gratuita",
      "Desconto de 3%"
    ],
    isActive: true,
  },
  {
    id: "25",
    name: "PRATA - 650 Mega + 25GB + TV",
    type: "combo",
    speed: 650,
    price: 17990, // R$ 179,90 em centavos
    description: "Combo intermediário com mais dados móveis. Perfeito para famílias conectadas.",
    features: [
      "650 Mbps de internet fibra óptica",
      "25GB móvel (22GB + 3GB bônus portabilidade)",
      "TV inclusa",
      "Dupla operadora: Vivo e Tim",
      "Portabilidade gratuita",
      "Desconto de 9%"
    ],
    isActive: true,
  },
  {
    id: "26",
    name: "OURO - 650 Mega + 50GB + TV",
    type: "combo",
    speed: 650,
    price: 19900, // R$ 199,00 em centavos
    description: "Combo premium com grande pacote de dados móveis. Para quem precisa estar sempre conectado.",
    features: [
      "650 Mbps de internet fibra óptica",
      "50GB móvel (45GB + 5GB bônus portabilidade)",
      "TV inclusa",
      "Dupla operadora: Vivo e Tim",
      "Portabilidade gratuita",
      "Desconto de 7%"
    ],
    isActive: true,
  },
  {
    id: "27",
    name: "DIAMANTE - 1 Giga + 50GB + Telefonia Fixa",
    type: "combo",
    speed: 1000,
    price: 24990, // R$ 249,90 em centavos
    description: "Combo top de linha com máxima velocidade. Para quem não abre mão de performance.",
    features: [
      "1 Giga (1000 Mbps) fibra óptica",
      "50GB móvel (45GB + 5GB bônus portabilidade)",
      "Telefonia Fixa inclusa",
      "Dupla operadora: Vivo e Tim",
      "Portabilidade gratuita",
      "Plano premium"
    ],
    isActive: true,
  },
  
  // ========== PLANOS MÓVEIS AVULSOS ==========
  {
    id: "28",
    name: "Móvel 8GB",
    type: "movel",
    speed: 0, // Plano móvel não tem velocidade de internet fixa
    price: 4990, // R$ 49,90 em centavos
    description: "Plano móvel com boa quantidade de dados. Ideal para uso moderado.",
    features: [
      "8GB móvel (7GB + 1GB bônus portabilidade)",
      "Dupla operadora: Vivo e Tim",
      "Portabilidade gratuita",
      "Melhor cobertura nacional",
      "Desconto de 39%"
    ],
    isActive: true,
  },
  {
    id: "29",
    name: "Móvel 25GB",
    type: "movel",
    speed: 0,
    price: 7990, // R$ 79,90 em centavos
    description: "Plano móvel intermediário. Perfeito para quem usa redes sociais e streaming.",
    features: [
      "25GB móvel (22GB + 3GB bônus portabilidade)",
      "Dupla operadora: Vivo e Tim",
      "Portabilidade gratuita",
      "Melhor cobertura nacional",
      "Desconto de 43%"
    ],
    isActive: true,
  },
  {
    id: "30",
    name: "Móvel 50GB",
    type: "movel",
    speed: 0,
    price: 9990, // R$ 99,90 em centavos
    description: "Plano móvel premium com grande pacote de dados. Para uso intenso.",
    features: [
      "50GB móvel (45GB + 5GB bônus portabilidade)",
      "Dupla operadora: Vivo e Tim",
      "Portabilidade gratuita",
      "Melhor cobertura nacional",
      "Desconto de 32%"
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
