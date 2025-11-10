import { storage } from '../server/storage';
import { eq, and, or } from 'drizzle-orm';
import { voiceCampaignTargets } from '../shared/schema';

async function listFailedTargets() {
  try {
    console.log('🔍 Buscando targets de cobrança com erro...\n');
    
    // Buscar todos os targets com state='failed'
    const db = storage.db;
    const failedTargets = await db
      .select()
      .from(voiceCampaignTargets)
      .where(eq(voiceCampaignTargets.state, 'failed'));
    
    if (failedTargets.length === 0) {
      console.log('✅ Nenhum target com erro encontrado!');
      return;
    }
    
    console.log(`📊 Total de targets com erro: ${failedTargets.length}\n`);
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    failedTargets.forEach((target, index) => {
      console.log(`${index + 1}. Target ID: ${target.id}`);
      console.log(`   Cliente: ${target.clientName}`);
      console.log(`   Telefone: ${target.phoneNumber}`);
      console.log(`   CPF/CNPJ: ${target.clientDocument || 'N/A'}`);
      console.log(`   Valor: R$ ${target.debtAmount?.toFixed(2) || '0.00'}`);
      console.log(`   Tentativas: ${target.attemptCount || 0}`);
      console.log(`   Motivo: ${target.outcome || 'unknown'}`);
      console.log(`   Detalhes: ${target.outcomeDetails || 'N/A'}`);
      console.log(`   Criado em: ${target.createdAt}`);
      console.log(`   Atualizado: ${target.updatedAt}\n`);
      console.log('───────────────────────────────────────────────────────────────────\n');
    });
    
    console.log(`\n💡 Para resetar e reenviar, use: npm run reset-failed-targets\n`);
    
  } catch (error) {
    console.error('❌ Erro ao listar targets:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

listFailedTargets();
