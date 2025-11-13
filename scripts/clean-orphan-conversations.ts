import { db } from '../server/db';
import { conversations, messages } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function cleanOrphanConversations() {
  console.log('🧹 Iniciando limpeza de conversas órfãs (sem mensagens)...\n');

  try {
    // 1. Identificar conversas sem mensagens
    console.log('📋 ETAPA 1: Identificando conversas sem mensagens');
    
    const orphanConversations = await db.execute(sql`
      SELECT 
        c.id,
        c.chat_id,
        c.client_name,
        c.assistant_type,
        c.status,
        c.created_at
      FROM conversations c
      WHERE NOT EXISTS (
        SELECT 1 FROM messages m WHERE m.conversation_id = c.id
      )
      ORDER BY c.created_at DESC
    `);

    const totalOrphans = orphanConversations.rows.length;
    console.log(`  ✅ Encontradas ${totalOrphans} conversas sem mensagens\n`);

    if (totalOrphans === 0) {
      console.log('✅ Nenhuma conversa órfã encontrada. Banco de dados está limpo!');
      process.exit(0);
    }

    // 2. Agrupar por tipo de assistente
    const byType = orphanConversations.rows.reduce((acc: any, row: any) => {
      const type = row.assistant_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 Conversas órfãs por tipo de assistente:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });
    console.log('');

    // 3. Deletar conversas órfãs
    console.log('📋 ETAPA 2: Deletando conversas órfãs');
    
    const deleted = await db.execute(sql`
      DELETE FROM conversations
      WHERE NOT EXISTS (
        SELECT 1 FROM messages m WHERE m.conversation_id = conversations.id
      )
    `);

    console.log(`  ✅ ${deleted.rowCount || 0} conversas deletadas\n`);

    // 4. Verificar resultado
    console.log('📋 ETAPA 3: Verificando resultado');
    const remaining = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM conversations c
      WHERE NOT EXISTS (
        SELECT 1 FROM messages m WHERE m.conversation_id = c.id
      )
    `);

    const remainingCount = remaining.rows[0]?.count || 0;
    console.log(`  ✅ Conversas órfãs restantes: ${remainingCount}\n`);

    console.log('✅ Limpeza de conversas órfãs finalizada com sucesso!');
    console.log('\n📊 Resumo:');
    console.log(`  - Total de conversas órfãs encontradas: ${totalOrphans}`);
    console.log(`  - Conversas deletadas: ${deleted.rowCount || 0}`);
    console.log(`  - Conversas órfãs restantes: ${remainingCount}`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erro durante a limpeza:', error);
    process.exit(1);
  }
}

cleanOrphanConversations();
