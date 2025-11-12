// Forçar inicialização dos workers
import '../server/modules/voice/workers';
console.log('✅ Workers importados forçadamente');
setTimeout(() => {
  console.log('⏳ Workers devem estar rodando agora...');
  process.exit(0);
}, 5000);
