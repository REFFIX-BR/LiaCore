import { searchKnowledge } from "./lib/upstash";

async function testSearch() {
  console.log("🔍 Testando busca: 'como finalizar conversa'...\n");
  
  const results = await searchKnowledge("como finalizar conversa", 3);
  
  console.log(`📊 Encontrados ${results.length} resultados:\n`);
  
  results.forEach((result, index) => {
    console.log(`\n--- Resultado ${index + 1} (Relevância: ${Math.round(result.score * 100)}%) ---`);
    console.log(`📝 Nome: ${result.chunk.name}`);
    console.log(`📂 Fonte: ${result.chunk.source}`);
    console.log(`💬 Conteúdo (primeiras 200 chars):`);
    console.log(result.chunk.content.substring(0, 200) + "...\n");
  });
  
  // Testar outras queries
  console.log("\n🔍 Testando busca: 'quando usar finalizar_conversa'...\n");
  const results2 = await searchKnowledge("quando usar finalizar_conversa", 2);
  console.log(`📊 Encontrados ${results2.length} resultados`);
  results2.forEach((result, index) => {
    console.log(`${index + 1}. ${result.chunk.name} (${Math.round(result.score * 100)}%)`);
  });
}

testSearch()
  .then(() => {
    console.log("\n✅ Teste concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
