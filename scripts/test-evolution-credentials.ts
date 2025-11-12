import { validateEvolutionCredentials } from '../server/lib/evolution-diagnostics';

(async () => {
  console.log('🔍 Testando credenciais Evolution API...');
  const isValid = await validateEvolutionCredentials();
  console.log(`\n${isValid ? '✅' : '❌'} Credenciais válidas: ${isValid}`);
  process.exit(isValid ? 0 : 1);
})();
