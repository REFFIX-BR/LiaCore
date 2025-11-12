import { testEvolutionConnectivity } from "../server/lib/evolution-diagnostics";

/**
 * Script de diagnóstico - testa conectividade com Evolution API
 * 
 * Uso:
 *   tsx scripts/test-evolution-connectivity.ts
 */
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Evolution API - Teste de Conectividade');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    await testEvolutionConnectivity();
    console.log('═══════════════════════════════════════════════════');
    console.log('  Teste concluído!');
    console.log('═══════════════════════════════════════════════════\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ [Fatal] Erro no teste:', error);
    process.exit(1);
  }
}

main();
