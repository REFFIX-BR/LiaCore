import { db } from "../db";
import { conversations, messages, learningEvents, supervisorActions } from "@shared/schema";
import fs from "fs/promises";
import path from "path";
import { sql } from "drizzle-orm";

interface ImportStats {
  conversations: { total: number; imported: number; skipped: number };
  messages: { total: number; imported: number; skipped: number };
  learningEvents: { total: number; imported: number; skipped: number };
  supervisorActions: { total: number; imported: number; skipped: number };
}

async function readJsonFile<T>(filename: string): Promise<T[]> {
  const filePath = path.join(process.cwd(), "attached_assets", filename);
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content);
}

async function importConversations(data: any[]): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  console.log(`\n📥 Importando ${data.length} conversas...`);

  for (const conv of data) {
    try {
      await db.insert(conversations).values({
        id: conv.id,
        chatId: conv.chat_id,
        clientName: conv.client_name,
        clientId: conv.client_id,
        threadId: conv.thread_id,
        assistantType: conv.assistant_type,
        status: conv.status,
        sentiment: conv.sentiment,
        urgency: conv.urgency,
        duration: conv.duration,
        lastMessage: conv.last_message,
        lastMessageTime: conv.last_message_time ? new Date(conv.last_message_time) : new Date(),
        createdAt: conv.created_at ? new Date(conv.created_at) : new Date(),
        metadata: conv.metadata,
        conversationSummary: conv.conversation_summary,
        lastSummarizedAt: conv.last_summarized_at ? new Date(conv.last_summarized_at) : null,
        messageCountAtLastSummary: conv.message_count_at_last_summary || 0,
        transferredToHuman: conv.transferred_to_human || false,
        transferReason: conv.transfer_reason,
        transferredAt: conv.transferred_at ? new Date(conv.transferred_at) : null,
        assignedTo: conv.assigned_to,
        resolvedAt: conv.resolved_at ? new Date(conv.resolved_at) : null,
        resolutionTime: conv.resolution_time,
        clientDocument: conv.client_document,
        evolutionInstance: conv.evolution_instance,
      }).onConflictDoNothing();
      imported++;
      
      if (imported % 10 === 0) {
        process.stdout.write(`\r✓ Importadas: ${imported}/${data.length}`);
      }
    } catch (error) {
      console.error(`\n❌ Erro ao importar conversa ${conv.id}:`, error);
      skipped++;
    }
  }

  console.log(`\n✅ Conversas: ${imported} importadas, ${skipped} ignoradas`);
  return { imported, skipped };
}

async function importMessages(data: any[]): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  console.log(`\n📥 Importando ${data.length} mensagens...`);

  // Importar em lotes de 100 para melhor performance
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    try {
      const values = batch.map(msg => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        functionCall: msg.function_call,
        assistant: msg.assistant,
        imageBase64: msg.image_base64,
        pdfBase64: msg.pdf_base64,
        pdfName: msg.pdf_name,
      }));

      await db.insert(messages).values(values).onConflictDoNothing();
      imported += batch.length;
      
      process.stdout.write(`\r✓ Importadas: ${imported}/${data.length}`);
    } catch (error) {
      console.error(`\n❌ Erro ao importar lote de mensagens:`, error);
      skipped += batch.length;
    }
  }

  console.log(`\n✅ Mensagens: ${imported} importadas, ${skipped} ignoradas`);
  return { imported, skipped };
}

async function importLearningEvents(data: any[]): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  console.log(`\n📥 Importando ${data.length} eventos de aprendizado...`);

  for (const event of data) {
    try {
      await db.insert(learningEvents).values({
        id: event.id,
        conversationId: event.conversation_id,
        eventType: event.event_type,
        assistantType: event.assistant_type,
        userMessage: event.user_message,
        aiResponse: event.ai_response,
        correctResponse: event.correct_response,
        feedback: event.feedback,
        sentiment: event.sentiment,
        resolution: event.resolution,
        createdAt: event.created_at ? new Date(event.created_at) : new Date(),
        metadata: event.metadata,
      }).onConflictDoNothing();
      imported++;
      
      if (imported % 10 === 0) {
        process.stdout.write(`\r✓ Importados: ${imported}/${data.length}`);
      }
    } catch (error) {
      console.error(`\n❌ Erro ao importar evento ${event.id}:`, error);
      skipped++;
    }
  }

  console.log(`\n✅ Eventos de aprendizado: ${imported} importados, ${skipped} ignorados`);
  return { imported, skipped };
}

async function importSupervisorActions(data: any[]): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  console.log(`\n📥 Importando ${data.length} ações de supervisor...`);

  for (const action of data) {
    try {
      await db.insert(supervisorActions).values({
        id: action.id,
        conversationId: action.conversation_id,
        action: action.action,
        notes: action.notes,
        createdBy: action.created_by,
        createdAt: action.created_at ? new Date(action.created_at) : new Date(),
      }).onConflictDoNothing();
      imported++;
      
      if (imported % 10 === 0) {
        process.stdout.write(`\r✓ Importadas: ${imported}/${data.length}`);
      }
    } catch (error) {
      console.error(`\n❌ Erro ao importar ação ${action.id}:`, error);
      skipped++;
    }
  }

  console.log(`\n✅ Ações de supervisor: ${imported} importadas, ${skipped} ignoradas`);
  return { imported, skipped };
}

async function main() {
  console.log("🚀 Iniciando importação de dados de produção...\n");
  
  const stats: ImportStats = {
    conversations: { total: 0, imported: 0, skipped: 0 },
    messages: { total: 0, imported: 0, skipped: 0 },
    learningEvents: { total: 0, imported: 0, skipped: 0 },
    supervisorActions: { total: 0, imported: 0, skipped: 0 },
  };

  try {
    // 1. Importar conversas primeiro (são referenciadas pelas outras tabelas)
    const conversationsData = await readJsonFile("conversations (5)_1760189866744.json");
    stats.conversations.total = conversationsData.length;
    const convResult = await importConversations(conversationsData);
    stats.conversations.imported = convResult.imported;
    stats.conversations.skipped = convResult.skipped;

    // 2. Importar mensagens
    const messagesData = await readJsonFile("messages_1760189954885.json");
    stats.messages.total = messagesData.length;
    const msgResult = await importMessages(messagesData);
    stats.messages.imported = msgResult.imported;
    stats.messages.skipped = msgResult.skipped;

    // 3. Importar eventos de aprendizado
    const learningData = await readJsonFile("learning_events_1760189935670.json");
    stats.learningEvents.total = learningData.length;
    const learnResult = await importLearningEvents(learningData);
    stats.learningEvents.imported = learnResult.imported;
    stats.learningEvents.skipped = learnResult.skipped;

    // 4. Importar ações de supervisor
    const actionsData = await readJsonFile("supervisor_actions_1760189985632.json");
    stats.supervisorActions.total = actionsData.length;
    const actionsResult = await importSupervisorActions(actionsData);
    stats.supervisorActions.imported = actionsResult.imported;
    stats.supervisorActions.skipped = actionsResult.skipped;

    // Relatório final
    console.log("\n\n" + "=".repeat(60));
    console.log("📊 RELATÓRIO FINAL DE IMPORTAÇÃO");
    console.log("=".repeat(60));
    console.log(`\n📝 Conversas:`);
    console.log(`   Total: ${stats.conversations.total}`);
    console.log(`   ✅ Importadas: ${stats.conversations.imported}`);
    console.log(`   ⏭️  Ignoradas: ${stats.conversations.skipped}`);
    
    console.log(`\n💬 Mensagens:`);
    console.log(`   Total: ${stats.messages.total}`);
    console.log(`   ✅ Importadas: ${stats.messages.imported}`);
    console.log(`   ⏭️  Ignoradas: ${stats.messages.skipped}`);
    
    console.log(`\n🧠 Eventos de Aprendizado:`);
    console.log(`   Total: ${stats.learningEvents.total}`);
    console.log(`   ✅ Importados: ${stats.learningEvents.imported}`);
    console.log(`   ⏭️  Ignorados: ${stats.learningEvents.skipped}`);
    
    console.log(`\n👨‍💼 Ações de Supervisor:`);
    console.log(`   Total: ${stats.supervisorActions.total}`);
    console.log(`   ✅ Importadas: ${stats.supervisorActions.imported}`);
    console.log(`   ⏭️  Ignoradas: ${stats.supervisorActions.skipped}`);
    
    const totalImported = 
      stats.conversations.imported + 
      stats.messages.imported + 
      stats.learningEvents.imported + 
      stats.supervisorActions.imported;
    
    const totalRecords = 
      stats.conversations.total + 
      stats.messages.total + 
      stats.learningEvents.total + 
      stats.supervisorActions.total;

    console.log("\n" + "=".repeat(60));
    console.log(`✨ IMPORTAÇÃO CONCLUÍDA!`);
    console.log(`   Total de registros: ${totalRecords}`);
    console.log(`   ✅ Importados: ${totalImported}`);
    console.log(`   ⏭️  Ignorados: ${totalRecords - totalImported}`);
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("\n❌ Erro fatal durante importação:", error);
    process.exit(1);
  }
}

main();
