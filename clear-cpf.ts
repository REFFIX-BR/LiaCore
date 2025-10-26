import { db } from './server/db';
import { conversations } from './shared/schema';
import { eq, sql } from 'drizzle-orm';

async function clearCPF() {
  try {
    const conversationId = '80e5fe7f-551e-4955-b489-e014ad775488';
    
    console.log(`🔍 Buscando conversa ${conversationId}...`);
    
    // Buscar conversa atual
    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    if (conv.length === 0) {
      console.log('❌ Conversa não encontrada!');
      return;
    }
    
    const currentDoc = conv[0].clientDocument;
    const metadata = conv[0].metadata as any;
    const metadataDoc = metadata?.cliente?.cpfValidado;
    
    console.log(`📋 CPF no campo clientDocument: ${currentDoc ? `***.***.***-${currentDoc.slice(-2)}` : 'NÃO'}`);
    console.log(`📋 CPF no metadata: ${metadataDoc ? `***.***.***-${metadataDoc.slice(-2)}` : 'NÃO'}`);
    
    // Limpar CPF
    console.log('\n🗑️  Limpando CPF...');
    await db
      .update(conversations)
      .set({
        clientDocument: null,
        metadata: sql`jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{cliente,cpfValidado}',
          'null'::jsonb
        )`
      })
      .where(eq(conversations.id, conversationId));
    
    console.log('✅ CPF limpo com sucesso!');
    
    // Verificar limpeza
    const updated = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    console.log('\n========== VERIFICAÇÃO ==========');
    console.log(`CPF no campo clientDocument: ${updated[0].clientDocument || 'LIMPO ✅'}`);
    const newMetadata = updated[0].metadata as any;
    console.log(`CPF no metadata: ${newMetadata?.cliente?.cpfValidado || 'LIMPO ✅'}`);
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

clearCPF();
