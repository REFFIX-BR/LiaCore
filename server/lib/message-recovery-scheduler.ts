/**
 * Sistema de Recuperação Automática de Mensagens
 * 
 * Processa conversas onde o cliente enviou mensagem mas a IA não respondeu.
 * Roda a cada 2 minutos para garantir que nenhuma mensagem fique sem resposta.
 * 
 * PROBLEMA IDENTIFICADO:
 * - Webhooks do Evolution API salvam mensagens no banco
 * - Sistema de batching às vezes não processa automaticamente
 * - Este scheduler garante recuperação em até 2 minutos
 */

import { storage } from "../storage";
import { addMessageToQueue } from "./queue";

// Intervalo de verificação: 2 minutos (120 segundos)
const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 120000ms = 2 minutos

// Tempo mínimo sem resposta antes de considerar "travada" (2 minutos)
const MIN_AGE_MINUTES = 2;

let isRunning = false;
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Processa mensagens sem resposta da IA
 */
async function recoverStuckMessages() {
  if (isRunning) {
    console.log('⏭️  [Message Recovery] Verificação anterior ainda em andamento - pulando');
    return;
  }

  isRunning = true;
  
  try {
    console.log('\n🔄 [Message Recovery] Iniciando verificação de mensagens travadas...');
    
    // Buscar todas as conversas ativas (não transferidas)
    const allConversations = await storage.getAllConversations();
    const activeConversations = allConversations.filter(
      c => c.status === 'active' && !c.transferredToHuman
    );
    
    if (activeConversations.length === 0) {
      console.log('✅ [Message Recovery] Nenhuma conversa ativa - verificação completa');
      return;
    }
    
    console.log(`📊 [Message Recovery] Analisando ${activeConversations.length} conversas ativas...`);
    
    let recoveredCount = 0;
    let errorCount = 0;
    
    // Processar cada conversa
    for (const conv of activeConversations) {
      try {
        // Buscar mensagens da conversa
        const messages = await storage.getMessagesByConversationId(conv.id);
        
        if (messages.length === 0) continue;
        
        // Verificar se última mensagem é do usuário (sem resposta da IA)
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage.role !== 'user') {
          continue; // IA já respondeu
        }
        
        // Calcular idade da mensagem
        const messageAge = Date.now() - new Date(lastMessage.timestamp!).getTime();
        const ageMinutes = Math.floor(messageAge / (1000 * 60));
        
        // Processar apenas se mensagem tem mais de MIN_AGE_MINUTES sem resposta
        if (ageMinutes < MIN_AGE_MINUTES) {
          continue;
        }
        
        // MENSAGEM TRAVADA DETECTADA - Recuperar!
        console.log(`🚨 [Message Recovery] Mensagem travada detectada:`);
        console.log(`   Cliente: ${conv.clientName} (${conv.chatId})`);
        console.log(`   Aguardando há: ${ageMinutes} minutos`);
        console.log(`   Mensagem: "${lastMessage.content.substring(0, 60)}..."`);
        
        // CRITICAL FIX: Extrair fromNumber corretamente para suportar WhatsApp Business (@lid)
        // BEFORE: conv.chatId.replace('whatsapp_', '').replace('@lid', '') → removia @lid (BUG!)
        // AFTER: Usa clientId (já tem lid_ prefix) ou extrai corretamente do chatId
        let fromNumber: string;
        
        if (conv.clientId) {
          // Usar clientId salvo pelo webhook (formato: "lid_12345" ou "5524999207033")
          fromNumber = conv.clientId;
        } else {
          // Fallback: extrair do chatId preservando formato LID
          // whatsapp_lid_12345 → lid_12345
          // whatsapp_54520398757908@lid → lid_54520398757908
          // whatsapp_5524999207033 → 5524999207033
          const withoutPrefix = conv.chatId.replace('whatsapp_', '');
          
          if (withoutPrefix.startsWith('lid_')) {
            // Já tem formato correto: whatsapp_lid_12345 → lid_12345
            fromNumber = withoutPrefix;
          } else if (withoutPrefix.endsWith('@lid')) {
            // Formato legado: whatsapp_12345@lid → lid_12345
            fromNumber = 'lid_' + withoutPrefix.replace('@lid', '');
          } else {
            // Regular phone: whatsapp_5524999207033 → 5524999207033
            fromNumber = withoutPrefix.replace('@s.whatsapp.net', '');
          }
        }
        
        // Adicionar à fila de processamento com prioridade normal
        // IMPORTANT: Generate unique messageId per retry attempt to avoid idempotency blocking
        // Using lastMessage.id would reuse the same key on every retry attempt
        await addMessageToQueue({
          chatId: conv.chatId,
          conversationId: conv.id,
          message: lastMessage.content,
          fromNumber, // FIXED: Preserva lid_ prefix para WhatsApp Business
          messageId: `recovery_${conv.id}_${Date.now()}`, // Unique per attempt - prevents idempotency blocking
          timestamp: Date.now(),
          evolutionInstance: conv.evolutionInstance || 'Principal',
          clientName: conv.clientName,
          hasImage: !!lastMessage.imageBase64,
          imageUrl: undefined,
        }, 1); // Prioridade normal
        
        recoveredCount++;
        
        // Aguardar 200ms entre jobs para não sobrecarregar sistema
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error: any) {
        console.error(`❌ [Message Recovery] Erro ao processar conversa ${conv.id}:`, error.message);
        errorCount++;
      }
    }
    
    // Log resumo
    if (recoveredCount > 0 || errorCount > 0) {
      console.log(`\n✅ [Message Recovery] Verificação completa:`);
      console.log(`   ✅ Recuperadas: ${recoveredCount}`);
      if (errorCount > 0) {
        console.log(`   ❌ Erros: ${errorCount}`);
      }
      console.log('');
    } else {
      console.log('✅ [Message Recovery] Nenhuma mensagem travada encontrada\n');
    }
    
  } catch (error: any) {
    console.error('❌ [Message Recovery] Erro no scheduler:', error.message);
    console.error(error.stack);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o scheduler de recuperação de mensagens
 */
export function startMessageRecoveryScheduler() {
  if (schedulerInterval) {
    console.log('⚠️  [Message Recovery] Scheduler já está rodando');
    return;
  }
  
  console.log(`⏰ [Message Recovery] Iniciando scheduler - verificação a cada ${CHECK_INTERVAL_MS / 1000}s (${CHECK_INTERVAL_MS / 60000} minutos)`);
  
  // Executar imediatamente na inicialização (após 10 segundos)
  setTimeout(() => {
    console.log('🔄 [Message Recovery] Executando primeira verificação...');
    recoverStuckMessages().catch(err => {
      console.error('❌ [Message Recovery] Erro na primeira verificação:', err);
    });
  }, 10000); // 10 segundos após startup
  
  // Agendar verificações periódicas
  schedulerInterval = setInterval(() => {
    recoverStuckMessages().catch(err => {
      console.error('❌ [Message Recovery] Erro na verificação periódica:', err);
    });
  }, CHECK_INTERVAL_MS);
  
  console.log('✅ [Message Recovery] Scheduler configurado com sucesso');
}

/**
 * Para o scheduler de recuperação de mensagens
 */
export function stopMessageRecoveryScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('✅ [Message Recovery] Scheduler parado');
  }
}
