/**
 * Script de correção - Normaliza todos os números de telefone em voice_campaign_targets
 * 
 * Remove caracteres especiais e adiciona prefixo +55 automaticamente
 * 
 * Uso:
 *   tsx scripts/fix-campaign-target-phones.ts
 */

import { db } from '../server/db';
import { voiceCampaignTargets } from '../shared/schema';
import { normalizePhone, isPhoneNormalized } from '../server/lib/phone-utils';

async function fixCampaignTargetPhones() {
  console.log('🔧 [Fix Phones] Iniciando correção de números de telefone...\n');

  try {
    // Buscar todos os targets
    const allTargets = await db.select().from(voiceCampaignTargets);
    
    console.log(`📊 [Fix Phones] Encontrados ${allTargets.length} targets no banco\n`);

    let fixed = 0;
    let alreadyNormalized = 0;
    let invalid = 0;
    let deleted = 0;

    for (const target of allTargets) {
      const currentPhone = target.phoneNumber;
      
      // Verificar se já está normalizado
      if (isPhoneNormalized(currentPhone)) {
        alreadyNormalized++;
        continue;
      }

      // Tentar normalizar
      const normalizedPhone = normalizePhone(currentPhone);

      if (!normalizedPhone) {
        // Número inválido - deletar target
        console.warn(`❌ [Fix Phones] Deletando target com número inválido: ID ${target.id}, Phone: "${currentPhone}"`);
        await db.delete(voiceCampaignTargets).where(eq(voiceCampaignTargets.id, target.id));
        deleted++;
        invalid++;
        continue;
      }

      // Atualizar número normalizado
      console.log(`✅ [Fix Phones] Corrigindo: "${currentPhone}" -> "${normalizedPhone}"`);
      
      const updates: any = { phoneNumber: normalizedPhone };

      // Normalizar alternativePhones se existir
      if (target.alternativePhones && target.alternativePhones.length > 0) {
        const normalizedAlternatives = target.alternativePhones
          .map(p => normalizePhone(p))
          .filter((p): p is string => p !== null);
        
        if (normalizedAlternatives.length > 0) {
          updates.alternativePhones = normalizedAlternatives;
        }
      }

      await db.update(voiceCampaignTargets)
        .set(updates)
        .where(eq(voiceCampaignTargets.id, target.id));

      fixed++;
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Resultado da Correção');
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Corrigidos: ${fixed}`);
    console.log(`🟢 Já normalizados: ${alreadyNormalized}`);
    console.log(`❌ Inválidos (deletados): ${deleted}`);
    console.log(`📊 Total processados: ${allTargets.length}`);
    console.log('═══════════════════════════════════════════════════\n');

    if (fixed > 0) {
      console.log('🎉 Correção concluída com sucesso!');
    } else if (alreadyNormalized === allTargets.length) {
      console.log('✅ Todos os números já estão normalizados!');
    }

  } catch (error) {
    console.error('\n❌ [Fix Phones] Erro fatal:', error);
    throw error;
  }
}

// Import eq from drizzle-orm
import { eq } from 'drizzle-orm';

fixCampaignTargetPhones()
  .then(() => {
    console.log('\n✅ Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
