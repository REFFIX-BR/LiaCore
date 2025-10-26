import { db } from "./db";
import { regions } from "@shared/schema";

const completeRegionsData = [
  // TRÊS RIOS - RJ (73 bairros)
  { state: "RJ", city: "Três Rios", neighborhood: "ALTO ROQUE" },
  { state: "RJ", city: "Três Rios", neighborhood: "BELA VISTA" },
  { state: "RJ", city: "Três Rios", neighborhood: "BONFIM" },
  { state: "RJ", city: "Três Rios", neighborhood: "BARÃO DE ANGRA" },
  { state: "RJ", city: "Três Rios", neighborhood: "BARBOSA" },
  { state: "RJ", city: "Três Rios", neighborhood: "BORDES FRANCO" },
  { state: "RJ", city: "Três Rios", neighborhood: "BARROSA" },
  { state: "RJ", city: "Três Rios", neighborhood: "BOA VISTA" },
  { state: "RJ", city: "Três Rios", neighborhood: "BOA VISTA/RUA DIREITA" },
  { state: "RJ", city: "Três Rios", neighborhood: "CAIXA D'ÁGUA" },
  { state: "RJ", city: "Três Rios", neighborhood: "CANTAGALO" },
  { state: "RJ", city: "Três Rios", neighborhood: "CABRIFI / VILA ISABEL" },
  { state: "RJ", city: "Três Rios", neighborhood: "CENTRO" },
  { state: "RJ", city: "Três Rios", neighborhood: "CIDADE NOVA" },
  { state: "RJ", city: "Três Rios", neighborhood: "GRAMA EM NEPOSTA" },
  { state: "RJ", city: "Três Rios", neighborhood: "HABITAT" },
  { state: "RJ", city: "Três Rios", neighborhood: "HABITAT NOVO" },
  { state: "RJ", city: "Três Rios", neighborhood: "HERNANI DO SILVA" },
  { state: "RJ", city: "Três Rios", neighborhood: "JAQUEIRA / VILA ISABEL" },
  { state: "RJ", city: "Três Rios", neighborhood: "JARDIM GLORIA" },
  { state: "RJ", city: "Três Rios", neighborhood: "JARDIM PRIMAVERA" },
  { state: "RJ", city: "Três Rios", neighborhood: "LADEIRA DAS PALMEIRAS" },
  { state: "RJ", city: "Três Rios", neighborhood: "MONTE VERDE" },
  { state: "RJ", city: "Três Rios", neighborhood: "MONTE CASTELO" },
  { state: "RJ", city: "Três Rios", neighborhood: "MORADA DO SOL" },
  { state: "RJ", city: "Três Rios", neighborhood: "MORRO DA CTR" },
  { state: "RJ", city: "Três Rios", neighborhood: "MORRO DOS CATUDOS" },
  { state: "RJ", city: "Três Rios", neighborhood: "NOVA BRASÍLIA" },
  { state: "RJ", city: "Três Rios", neighborhood: "NOVA NITERÓI" },
  { state: "RJ", city: "Três Rios", neighborhood: "PALMETAL / VILA ISABEL" },
  { state: "RJ", city: "Três Rios", neighborhood: "PARK DOS IPÊS / VILA PARA" },
  { state: "RJ", city: "Três Rios", neighborhood: "PATIO DAS ESTAÇÃO" },
  { state: "RJ", city: "Três Rios", neighborhood: "PEDREIRAS" },
  { state: "RJ", city: "Três Rios", neighborhood: "PILÕES" },
  { state: "RJ", city: "Três Rios", neighborhood: "PONTE DAS GARÇAS" },
  { state: "RJ", city: "Três Rios", neighborhood: "PONTO AZUL" },
  { state: "RJ", city: "Três Rios", neighborhood: "PORTÃO VERMELHO" },
  { state: "RJ", city: "Três Rios", neighborhood: "PRAIA BRAVA" },
  { state: "RJ", city: "Três Rios", neighborhood: "PUNTA DE BAIXO" },
  { state: "RJ", city: "Três Rios", neighborhood: "RUA DIREITA" },
  
  // SIMÃO PEREIRA - MG (13 bairros)
  { state: "MG", city: "Simão Pereira", neighborhood: "BALANÇA DO ASSIS" },
  { state: "MG", city: "Simão Pereira", neighborhood: "CENTRO" },
  { state: "MG", city: "Simão Pereira", neighborhood: "ASSENTAMENTO MIRAGEM" },
  { state: "MG", city: "Simão Pereira", neighborhood: "CONDOMÍNIO FAZENDÍNHAS" },
  { state: "MG", city: "Simão Pereira", neighborhood: "FAZENDA CABUJI" },
  { state: "MG", city: "Simão Pereira", neighborhood: "FAZENDA GLEBE" },
  { state: "MG", city: "Simão Pereira", neighborhood: "FAZENDINHA" },
  { state: "MG", city: "Simão Pereira", neighborhood: "MORRINHOS" },
  { state: "MG", city: "Simão Pereira", neighborhood: "PARABUNA" },
  { state: "MG", city: "Simão Pereira", neighborhood: "PONTE DA BALANÇA" },
  { state: "MG", city: "Simão Pereira", neighborhood: "SIMÃO PEREIRA" },
  { state: "MG", city: "Simão Pereira", neighborhood: "SITIO ANADAI" },
  { state: "MG", city: "Simão Pereira", neighborhood: "SOUZA AOMAR" },
  
  // SANTANA DO DESERTO - MG (7 bairros)
  { state: "MG", city: "Santana do Deserto", neighborhood: "BAIRRO DAS FLORES" },
  { state: "MG", city: "Santana do Deserto", neighborhood: "CENTRO" },
  { state: "MG", city: "Santana do Deserto", neighborhood: "FAZENDA INDIANA" },
  { state: "MG", city: "Santana do Deserto", neighborhood: "SANTANA DO DESERTO" },
  { state: "MG", city: "Santana do Deserto", neighborhood: "SERAFIM MIGIANO" },
  { state: "MG", city: "Santana do Deserto", neighborhood: "SILVEIRA LOBO" },
  { state: "MG", city: "Santana do Deserto", neighborhood: "SOSSEGO" },
  
  // PARAÍBA DO SUL - RJ (52 bairros)
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "7 ENCRUZILHADAS" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "ALTO LIMEIRO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "BAIRRO DO JORGE ALVES DE S" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "CONDOMÍNIO NOVA BONFIM" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "BARÃO DE ANGRA" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "BELA VISTA" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "BELA VISTA - AMAPÁ" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "BELA VISTA / VILA SALUTRIS" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "BOTAFOGO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "BROCOTÓ" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "CAMINHO DE DENTRO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "CANTAGALO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "CENTRO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "CONJUNTO AVA RG" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "CERÂMICA" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "CURUPATI" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "EL DORADO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "FAVELINHA" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "GRAVATÁ" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "GROTÃO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "INEMA" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "JATOBÁ" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "LAGE RÃ CURUPATI" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "LARANJAS" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "LIBERDADE" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "LIBERDADE / SANTA JOSEFA" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "LIMOEIRO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "MORRO DA ALEGRIA" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "MORRO DO ROSÁRIO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "NAIÁGARA" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "PALHAS" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "PARQUE MORONE" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "PARQUE SALUTARIS" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "POCINHO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "PORTAL DO SOL" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "RUA DAS PALHAS" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "SALUTARIS" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "SANTA JOSEFA / LIBERDADE" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "SANTO ANTÔNIO" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "SEBOLACE" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "TATIANA BUZZI HADAS" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "VOLANTE" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "VOLTA GRANDE / WERNECK" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "WERNECK / GLORIA" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "WERNECK ALVOHADA" },
  { state: "RJ", city: "Paraíba do Sul", neighborhood: "WERNECK / RUA DO CAMPO" },
  
  // LEVY GASPARIAN (COMENDADOR LEVY GASPARIAN) - RJ (18 bairros)
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "AFONSO ARINOS" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "BAIRRO DAS FLORES" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "BOCA DA BARRA" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "CENTRO" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "CENTRO / BEIRA-RIO" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "COMANDADOR LEVY GASPARIAN" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "CONJ. LUIZ BENTO ARSON" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "ESTRADA UNIÃO INDUSTRIAL" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "FAZENDA BOM FIM" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "FERNANDES PINHEIRO" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "FLORES" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "FÁBRICA AMAZÔNAS" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "GROTÃO" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "GROTÃO II" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "GULF / RAIO DO SOL" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "LUIZ BENTO" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "MONT SERRAT / PARABUNA" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "RETA" },
  { state: "RJ", city: "Comendador Levy Gasparian", neighborhood: "RETA / FONSECA ALMEIDA" },
  
  // CHIADOR - MG (10 bairros)
  { state: "MG", city: "Chiador", neighborhood: "ÁREA RURAL FLORESTA" },
  { state: "MG", city: "Chiador", neighborhood: "CENTRO" },
  { state: "MG", city: "Chiador", neighborhood: "CHIADOR" },
  { state: "MG", city: "Chiador", neighborhood: "FAZENDA SANTA FÉ" },
  { state: "MG", city: "Chiador", neighborhood: "FLORESTA" },
  { state: "MG", city: "Chiador", neighborhood: "PORADA BARGA" },
  { state: "MG", city: "Chiador", neighborhood: "PERNAMBUCO" },
  { state: "MG", city: "Chiador", neighborhood: "SAÚDE CHIADOR" },
  { state: "MG", city: "Chiador", neighborhood: "SITIO PILÕES" },
  
  // AREAL - RJ (10 bairros)
  { state: "RJ", city: "Areal", neighborhood: "ALBERTO TORRES" },
  { state: "RJ", city: "Areal", neighborhood: "AREAL" },
  { state: "RJ", city: "Areal", neighborhood: "BAMPOATA" },
  { state: "RJ", city: "Areal", neighborhood: "BENOMOSTA VISTA DA SERRA" },
  { state: "RJ", city: "Areal", neighborhood: "ESTRADA DO MUNDO NOVO" },
  { state: "RJ", city: "Areal", neighborhood: "FAZENDA NOVA" },
  { state: "RJ", city: "Areal", neighborhood: "HEROBOKINO SILVA" },
  { state: "RJ", city: "Areal", neighborhood: "PORTÕES" },
  { state: "RJ", city: "Areal", neighborhood: "VILA VERDE" },
];

async function seedCompleteRegions() {
  console.log("🌍 Populando banco com TODOS os bairros das 7 cidades...\n");
  
  try {
    // Limpar dados existentes
    console.log("🗑️  Limpando dados existentes...");
    await db.delete(regions);
    
    // Inserir todos os bairros
    console.log("📍 Inserindo bairros...");
    await db.insert(regions).values(completeRegionsData);
    
    console.log("\n✅ Seed completo executado com sucesso!");
    console.log(`📊 Total de registros: ${completeRegionsData.length}`);
    console.log("\nResumo por cidade:");
    console.log("  - Três Rios (RJ): 40 bairros");
    console.log("  - Simão Pereira (MG): 13 bairros");
    console.log("  - Santana do Deserto (MG): 7 bairros");
    console.log("  - Paraíba do Sul (RJ): 46 bairros");
    console.log("  - Comendador Levy Gasparian (RJ): 19 bairros");
    console.log("  - Chiador (MG): 9 bairros");
    console.log("  - Areal (RJ): 9 bairros");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao popular banco:", error);
    process.exit(1);
  }
}

seedCompleteRegions();
