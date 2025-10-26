import { db } from "./db";
import { regions } from "@shared/schema";

const CITIES = [
  { name: "Três Rios", state: "RJ" },
  { name: "Comendador Levy Gasparian", state: "RJ" },
  { name: "Santana do Deserto", state: "MG" },
  { name: "Simão Pereira", state: "MG" },
  { name: "Paraíba do Sul", state: "RJ" },
  { name: "Chiador", state: "MG" },
  { name: "Areal", state: "RJ" },
];

const TRES_RIOS_NEIGHBORHOODS = [
  "ALTO PURIS",
  "AREAL",
  "ATAULFO",
  "BAIXO PURYS",
  "BARÃO DE ANGRA",
  "BARRINHA",
  "BARROS FRANCO",
  "BEMPOSTA",
  "BOA UNIÃO",
  "BOA VISTA/RUA DIREITA",
  "CAIXA DAGUA",
  "CANTAGALO",
  "CARIRI / VILA ISABEL",
  "CENTRO",
  "CIDADE NOVA",
  "GRAMA BEMPOSTA",
  "HABITAT",
  "HABITAT NOVO",
  "HEMOGENIO SILVA",
  "JAQUEIRA / VILA ISABEL",
  "JARDIM GLORIA",
  "JARDIM PRIMAVERA",
  "LADEIRA DAS PALMEIRAS",
  "MIRANTE SUL",
  "MONTE CASTELO",
  "MORADA DO SOL",
  "MORRO DA CTB",
  "MORRO DOS CAETANOS",
  "MOURA BRASIL",
  "NOVA NITEROI",
  "PALMITAL / VILA ISABEL",
  "PARK DOS IPÊS / VILA PARA",
  "PATIO DAS ESTAÇÕES",
  "PEDREIRA",
  "PILÕES",
  "PONTE DAS GRAÇAS",
  "PONTO AZUL",
  "PORTÃO VERMELHO",
  "PURYS",
  "PURYS DE BAIXO",
  "RUA DIREITA",
];

async function seedRegions() {
  console.log("🌱 [Seed] Iniciando população de regiões...");

  try {
    // 1. Popular Três Rios com seus bairros
    console.log(`📍 [Seed] Adicionando ${TRES_RIOS_NEIGHBORHOODS.length} bairros de Três Rios RJ...`);
    for (const neighborhood of TRES_RIOS_NEIGHBORHOODS) {
      await db.insert(regions).values({
        state: "RJ",
        city: "Três Rios",
        neighborhood: neighborhood,
      });
    }

    // 2. Popular as outras 6 cidades com um bairro "CENTRO" padrão
    // (Usuário pode adicionar mais bairros depois pela UI)
    console.log("📍 [Seed] Adicionando outras 6 cidades...");
    for (const city of CITIES.filter(c => c.name !== "Três Rios")) {
      await db.insert(regions).values({
        state: city.state,
        city: city.name,
        neighborhood: "CENTRO",
      });
    }

    console.log("✅ [Seed] Regiões populadas com sucesso!");
    console.log(`📊 [Seed] Total de registros: ${TRES_RIOS_NEIGHBORHOODS.length + 6}`);

  } catch (error) {
    console.error("❌ [Seed] Erro ao popular regiões:", error);
    throw error;
  }
}

// Executar seed
seedRegions()
  .then(() => {
    console.log("✅ [Seed] Processo concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ [Seed] Processo falhou:", error);
    process.exit(1);
  });
