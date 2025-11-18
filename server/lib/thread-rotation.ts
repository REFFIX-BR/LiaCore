/**
 * Thread Rotation Service - Context Window Optimization
 * 
 * Responsável por rotacionar threads do OpenAI quando o contexto fica muito grande,
 * reduzindo latência e custos mantendo contexto essencial através de resumos.
 */

import { storage } from "../storage";
import { openai } from "./openai";
import type { Conversation, Message } from "@shared/schema";

// Threshold de mensagens antes de rotacionar (com buffer)
const MESSAGE_THRESHOLD = 55; // Rotaciona antes de atingir 60 (P95 está em 98)

/**
 * Verifica se uma conversa precisa de rotação de thread
 * Conta mensagens do thread ATUAL (não histórico total)
 */
export async function shouldRotateThread(conversationId: string): Promise<boolean> {
  // Buscar conversa para pegar threadId atual
  const conversation = await storage.getConversation(conversationId);
  if (!conversation || !conversation.threadId) {
    return false;
  }
  
  // CALCULAR messageCount em tempo real contando mensagens do DB
  const allMessages = await storage.getMessagesByConversationId(conversationId);
  
  // Buscar thread ativo (se existir)
  const activeThread = await storage.getActiveThreadByConversationId(conversationId);
  
  let messageCount: number;
  
  if (activeThread) {
    // Se existe thread ativo, contar mensagens desde a última rotação
    // (mensagens criadas após o createdAt do thread ativo)
    const messagesAfterRotation = allMessages.filter(
      m => m.timestamp && activeThread.createdAt && m.timestamp >= activeThread.createdAt
    );
    messageCount = messagesAfterRotation.length;
  } else {
    // Se não existe thread ativo (conversa antiga ou primeira vez)
    // Contar TODAS as mensagens da conversa
    messageCount = allMessages.length;
  }
  
  if (messageCount >= MESSAGE_THRESHOLD) {
    console.log(`🔄 [Thread Rotation] Thread ${conversation.threadId.substring(0, 12)} tem ${messageCount} mensagens (threshold: ${MESSAGE_THRESHOLD})`);
    return true;
  }
  
  return false;
}

/**
 * Identifica mensagens críticas que devem ser preservadas na rotação
 * - Transferências para humano
 * - Roteamentos entre assistentes
 * - Ações importantes (finalizar_conversa, etc)
 */
async function getPreservedMessages(conversationId: string): Promise<string[]> {
  const messages = await storage.getMessagesByConversationId(conversationId);
  const preservedIds: string[] = [];
  
  for (const msg of messages) {
    // Preservar mensagens com function calls importantes
    if (msg.functionCall && msg.role === 'assistant') {
      const functionCall = msg.functionCall as any;
      const functionName = functionCall?.name || functionCall?.function?.name;
      
      // Funções críticas que alteram estado da conversa
      const criticalFunctions = [
        'transferir_para_humano',
        'rotear_para_assistente',
        'finalizar_conversa',
        'enviar_cadastro_venda',
        'registrar_promessa_pagamento'
      ];
      
      if (criticalFunctions.includes(functionName)) {
        preservedIds.push(msg.id);
        console.log(`📌 [Thread Rotation] Preservando mensagem crítica: ${functionName} (${msg.id.substring(0, 8)})`);
      }
    }
  }
  
  return preservedIds;
}

/**
 * Gera resumo compacto do histórico da conversa usando GPT-4o-mini
 * Inclui: identificação do cliente, problema/necessidade, status atual
 */
async function generateConversationSummary(
  conversation: Conversation,
  messages: Message[]
): Promise<string> {
  // Filtrar apenas mensagens relevantes (últimas 20 + primeiras 5)
  const recentMessages = messages.slice(-20);
  const firstMessages = messages.slice(0, 5);
  const messagesToSummarize = Array.from(new Set([...firstMessages, ...recentMessages]));
  
  // Construir histórico formatado
  const historyText = messagesToSummarize
    .map(m => `[${m.role}]: ${m.content.substring(0, 200)}`) // Limitar cada mensagem
    .join('\n');
  
  const summaryPrompt = `Resuma esta conversa de atendimento em 3-4 linhas, incluindo:
1. Nome do cliente e documento (se mencionado)
2. Motivo principal do contato
3. Status atual e próximos passos

Conversa:
${historyText}

Resumo compacto (máximo 300 caracteres):`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Modelo mais rápido e barato para resumos
      messages: [{ role: "user", content: summaryPrompt }],
      max_tokens: 150,
      temperature: 0.3,
    });
    
    const summary = response.choices[0].message.content?.trim() || "Resumo indisponível";
    console.log(`📝 [Thread Rotation] Resumo gerado: ${summary.substring(0, 100)}...`);
    
    return summary;
  } catch (error) {
    console.error("❌ [Thread Rotation] Erro ao gerar resumo:", error);
    // Fallback: resumo básico sem IA
    return `Cliente: ${conversation.clientName}. Assistente: ${conversation.assistantType}. ${messages.length} mensagens trocadas.`;
  }
}

// Lock de rotação por conversação para evitar concorrência
const rotationLocks = new Map<string, Promise<{ newThreadId: string; summary: string }>>();

/**
 * Executa a rotação de thread:
 * 1. Fecha thread atual
 * 2. Gera resumo do histórico
 * 3. Cria novo thread com resumo + mensagens preservadas
 * 4. Atualiza conversation com novo threadId
 * 
 * CONCURRENCY SAFE: Usa lock por conversação
 */
export async function rotateThread(conversationId: string): Promise<{ newThreadId: string; summary: string }> {
  // CRITICAL: Verificar se já existe rotação em andamento
  const existingRotation = rotationLocks.get(conversationId);
  if (existingRotation) {
    console.log(`⏳ [Thread Rotation] Rotação já em andamento para ${conversationId}, aguardando...`);
    return existingRotation;
  }
  
  const startTime = Date.now();
  console.log(`🔄 [Thread Rotation] Iniciando rotação para conversa ${conversationId}`);
  
  // Criar promessa de rotação e adicionar ao lock
  const rotationPromise = (async () => {
    try {
      // 1. Buscar conversa e mensagens
      const conversation = await storage.getConversation(conversationId);
      if (!conversation || !conversation.threadId) {
        throw new Error(`Conversa ${conversationId} não encontrada ou sem threadId`);
      }
      
      const messages = await storage.getMessagesByConversationId(conversationId);
      const currentThreadId = conversation.threadId;
  
      // 2. Identificar mensagens preservadas
      const preservedMessageIds = await getPreservedMessages(conversationId);
      
      // 3. Gerar resumo do histórico
      const summary = await generateConversationSummary(conversation, messages);
      
      // 4. Fechar thread atual (marcar closedAt + closedReason)
      await storage.closeConversationThread(currentThreadId, 'rotation', summary, preservedMessageIds);
  
      // 5. Criar novo thread OpenAI
      const newThread = await openai.beta.threads.create();
      const newThreadId = newThread.id;
      
      // 6. Adicionar mensagem de sistema com resumo + data/hora
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const timeStr = now.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      await openai.beta.threads.messages.create(newThreadId, {
        role: 'user',
        content: `[CONTEXTO PRESERVADO - Thread rotacionado]
Data: ${dateStr} às ${timeStr}
Cliente: ${conversation.clientName}${conversation.clientDocument ? ` (CPF/CNPJ: ${conversation.clientDocument})` : ''}

RESUMO DO HISTÓRICO:
${summary}

Mensagens preservadas: ${preservedMessageIds.length}
Total de mensagens anteriores: ${messages.length}

Continue o atendimento normalmente com base no contexto acima.`
      });
      
      console.log(`📅 [Thread Rotation] Novo thread criado: ${newThreadId}`);
      
      // 7. Copiar mensagens preservadas (críticas) para novo thread
      const preservedMessages = messages.filter(m => preservedMessageIds.includes(m.id));
      for (const msg of preservedMessages) {
        await openai.beta.threads.messages.create(newThreadId, {
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
        console.log(`📋 [Thread Rotation] Mensagem preservada copiada: ${msg.id.substring(0, 8)}`);
      }
      
      // 8. Atualizar conversation com novo threadId
      await storage.updateConversation(conversationId, {
        threadId: newThreadId,
      });
      
      // 9. Criar registro do novo thread ativo (sem closedAt = thread ativo)
      await storage.createConversationThread({
        conversationId,
        threadId: newThreadId,
        messageCount: preservedMessageIds.length + 1, // Resumo + mensagens preservadas
        summary: null,
        preservedMessageIds: null,
        closedReason: null,
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ [Thread Rotation] Concluída em ${duration}ms`);
      console.log(`   Thread antigo: ${currentThreadId} (${messages.length} msgs)`);
      console.log(`   Thread novo: ${newThreadId} (${preservedMessageIds.length + 1} msgs)`);
      console.log(`   Redução: ${((1 - (preservedMessageIds.length + 1) / messages.length) * 100).toFixed(1)}%`);
      
      return { newThreadId, summary };
    } finally {
      // Remover lock após conclusão
      rotationLocks.delete(conversationId);
    }
  })();
  
  // Adicionar promessa ao lock
  rotationLocks.set(conversationId, rotationPromise);
  
  return rotationPromise;
}
