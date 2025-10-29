import { searchKnowledge } from '../lib/upstash';

async function testCarneSearch() {
  console.log('🔍 Testando busca por documento de Carnê...\n');
  
  const testQueries = [
    'carnê de pagamento',
    'boleto físico',
    'carnê digital',
    'lojas TR Telecom',
    'Central do Assinante'
  ];
  
  for (const query of testQueries) {
    console.log(`📋 Buscando: "${query}"`);
    try {
      const results = await searchKnowledge(query, 3);
      
      if (results.length > 0) {
        console.log(`   ✅ Encontrados ${results.length} resultados:`);
        results.forEach((result, idx) => {
          console.log(`      ${idx + 1}. ${result.chunk.name || 'Sem nome'}`);
          console.log(`         Score: ${(result.score * 100).toFixed(1)}%`);
          console.log(`         Source: ${result.chunk.source}`);
          if (result.chunk.id === 'kb-carne-pagamento-2025') {
            console.log(`         🎯 DOCUMENTO CORRETO ENCONTRADO!`);
          }
        });
      } else {
        console.log(`   ⚠️ Nenhum resultado encontrado`);
      }
      console.log('');
    } catch (error) {
      console.error(`   ❌ Erro na busca:`, error);
    }
  }
  
  process.exit(0);
}

testCarneSearch();
