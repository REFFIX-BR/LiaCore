import { searchKnowledge } from "../server/lib/upstash";

async function testRAG() {
  console.log("🧪 Testando RAG de Devolução de Equipamentos\n");
  
  const queries = [
    "Onde posso devolver os equipamentos em Três Rios?",
    "Preciso devolver equipamentos, moro em Levy Gasparian",
    "O que acontece se eu não devolver os equipamentos?",
    "Quais equipamentos eu preciso devolver?",
    "Onde fica o ponto de devolução mais próximo de Vila Isabel?"
  ];
  
  for (const query of queries) {
    console.log(`\n❓ Pergunta: "${query}"`);
    console.log("─".repeat(80));
    
    const results = await searchKnowledge(query, 3);
    
    if (results.length > 0) {
      console.log(`✅ Encontrados ${results.length} resultados:\n`);
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.chunk.name} (Score: ${result.score.toFixed(3)})`);
        console.log(`   📍 Fonte: ${result.chunk.source}`);
        console.log(`   📝 Preview: ${result.chunk.content.substring(0, 150)}...`);
        console.log();
      });
    } else {
      console.log("❌ Nenhum resultado encontrado");
    }
  }
  
  process.exit(0);
}

testRAG();
