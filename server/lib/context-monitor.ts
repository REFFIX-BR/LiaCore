/**
 * Sistema de Monitoramento de Qualidade de Contexto
 * 
 * Detecta automaticamente situações de perda de contexto:
 * - Assistente pede dados já fornecidos
 * - Assistente ignora histórico da conversa
 * - Roteamentos duplicados ou desnecessários
 */

import { storage } from "../storage";
import type { Message } from "@shared/schema";

export interface ContextQualityAlert {
  conversationId: string;
  alertType: 'duplicate_data_request' | 'ignored_history' | 'duplicate_routing' | 'context_reset' | 'client_repetition' | 'misrouting_frustration';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detectedAt: Date;
  assistantType?: string; // Tipo do assistente que gerou o alerta
  metadata?: Record<string, any>;
}

export class ContextMonitor {
  private static alerts: ContextQualityAlert[] = [];
  
  /**
   * Detecta se assistente está pedindo dados já fornecidos pelo cliente
   */
  static async detectDuplicateDataRequest(
    conversationId: string,
    assistantMessage: string,
    recentMessages: Message[],
    assistantType?: string
  ): Promise<ContextQualityAlert | null> {
    // Padrões de solicitação de dados
    const dataRequestPatterns = {
      cpf: /(?:qual|me (?:passa|informa|envia)|preciso (?:do|de)|pode (?:me )?(?:passar|informar)|confirma).{0,50}(?:seu )?(?:cpf|cnpj)/i,
      nome: /(?:qual|me (?:passa|informa|envia)|preciso (?:do|de)|pode (?:me )?(?:passar|informar)|confirma).{0,50}(?:seu )?nome(?: completo)?/i,
      telefone: /(?:qual|me (?:passa|informa|envia)|preciso (?:do|de)|pode (?:me )?(?:passar|informar)|confirma).{0,50}(?:seu )?(?:telefone|número|contato)/i,
      endereco: /(?:qual|me (?:passa|informa|envia)|preciso (?:do|de)|pode (?:me )?(?:passar|informar)|confirma).{0,50}(?:seu )?(?:endereço|cep|rua|número)/i,
    };
    
    // Padrões de dados fornecidos pelo cliente
    const dataProvidedPatterns = {
      cpf: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/,
      nome: /(?:meu nome é|me chamo|sou|nome:)\s+([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ][a-záàâãéèêíïóôõöúçñ]+(?:\s+[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ][a-záàâãéèêíïóôõöúçñ]+)+)/i,
      telefone: /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/,
      endereco: /(?:rua|av|avenida|travessa)\s+.{3,}/i,
    };
    
    // Verificar se assistente está pedindo dados
    const requestedDataTypes = Object.entries(dataRequestPatterns)
      .filter(([_, pattern]) => pattern.test(assistantMessage))
      .map(([type]) => type);
    
    if (requestedDataTypes.length === 0) {
      return null; // Não está pedindo dados
    }
    
    // Verificar se cliente já forneceu esses dados nas últimas 10 mensagens
    const last10UserMessages = recentMessages
      .filter(m => m.role === 'user')
      .slice(-10);
    
    for (const dataType of requestedDataTypes) {
      const providedPattern = dataProvidedPatterns[dataType as keyof typeof dataProvidedPatterns];
      const alreadyProvided = last10UserMessages.some(m => providedPattern.test(m.content));
      
      if (alreadyProvided) {
        return {
          conversationId,
          alertType: 'duplicate_data_request',
          severity: 'high',
          description: `Assistente pediu ${dataType.toUpperCase()} que cliente já forneceu anteriormente`,
          detectedAt: new Date(),
          assistantType,
          metadata: {
            requestedData: dataType,
            assistantMessage: assistantMessage.substring(0, 200),
            messagesAnalyzed: last10UserMessages.length,
          }
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detecta se assistente está ignorando contexto recente (ex: responder "Bom dia" após já ter conversado)
   */
  static async detectIgnoredHistory(
    conversationId: string,
    assistantMessage: string,
    recentMessages: Message[],
    assistantType?: string
  ): Promise<ContextQualityAlert | null> {
    // Mensagens genéricas de início de conversa
    const greetingPatterns = [
      /^(?:oi|olá|bom dia|boa tarde|boa noite)[!.]?\s*(?:😊|🙂)?\s*como posso (?:te )?ajudar/i,
      /^(?:oi|olá|bem-vindo).*em que posso ajudar/i,
    ];
    
    const isGreeting = greetingPatterns.some(pattern => pattern.test(assistantMessage));
    
    if (!isGreeting) {
      return null; // Não é saudação genérica
    }
    
    // Verificar se há histórico recente (mais de 5 mensagens)
    const conversationLength = recentMessages.length;
    
    if (conversationLength > 5) {
      // Há histórico substancial, assistente não deveria cumprimentar como se fosse novo
      return {
        conversationId,
        alertType: 'ignored_history',
        severity: 'medium',
        description: `Assistente enviou saudação genérica ignorando ${conversationLength} mensagens anteriores`,
        detectedAt: new Date(),
        assistantType,
        metadata: {
          assistantMessage: assistantMessage.substring(0, 200),
          conversationLength,
          lastUserMessage: recentMessages.filter(m => m.role === 'user').slice(-1)[0]?.content,
        }
      };
    }
    
    return null;
  }
  
  /**
   * Detecta roteamentos duplicados ou desnecessários
   */
  static async detectDuplicateRouting(
    conversationId: string,
    newAssistantType: string,
    recentMessages: Message[]
  ): Promise<ContextQualityAlert | null> {
    // Verificar se houve mudança de assistente recentemente (últimas 3 mensagens)
    const lastAssistantMessages = recentMessages
      .filter(m => m.role === 'assistant')
      .slice(-3);
    
    // Detectar menções de roteamento nas mensagens
    const routingPatterns = /(?:encaminhando|transferindo|roteando).*(?:para|ao)/i;
    const recentRoutings = lastAssistantMessages.filter(m => 
      routingPatterns.test(m.content)
    );
    
    if (recentRoutings.length >= 2) {
      return {
        conversationId,
        alertType: 'duplicate_routing',
        severity: 'medium',
        description: `Detectados ${recentRoutings.length} roteamentos consecutivos (pode indicar confusão do assistente)`,
        detectedAt: new Date(),
        assistantType: newAssistantType,
        metadata: {
          newAssistantType,
          recentRoutings: recentRoutings.map(m => m.content.substring(0, 100)),
        }
      };
    }
    
    return null;
  }
  
  /**
   * Detecta reset completo de contexto (assistente age como se não soubesse nada)
   */
  static async detectContextReset(
    conversationId: string,
    assistantMessage: string,
    recentMessages: Message[],
    assistantType?: string
  ): Promise<ContextQualityAlert | null> {
    // Padrões que indicam total falta de contexto
    const contextResetPatterns = [
      /não (?:tenho|encontrei|localizei).{0,30}(?:informação|dado|registro|histórico)/i,
      /não (?:consigo|consegui).{0,30}(?:acessar|localizar|encontrar).{0,30}(?:histórico|informação)/i,
      /parece que (?:não tenho|perdemos).{0,30}(?:histórico|contexto|informação)/i,
    ];
    
    const hasContextResetMessage = contextResetPatterns.some(pattern => 
      pattern.test(assistantMessage)
    );
    
    if (!hasContextResetMessage) {
      return null;
    }
    
    // Verificar se realmente há histórico disponível
    if (recentMessages.length > 3) {
      return {
        conversationId,
        alertType: 'context_reset',
        severity: 'high',
        description: `Assistente alegou não ter informações apesar de ${recentMessages.length} mensagens disponíveis`,
        detectedAt: new Date(),
        assistantType,
        metadata: {
          assistantMessage: assistantMessage.substring(0, 200),
          availableMessages: recentMessages.length,
        }
      };
    }
    
    return null;
  }
  
  /**
   * Detecta quando cliente repete a mesma mensagem/problema 2+ vezes
   * (indica que IA não está processando ou respondendo adequadamente)
   */
  static async detectClientRepetition(
    conversationId: string,
    recentMessages: Message[],
    assistantType?: string
  ): Promise<ContextQualityAlert | null> {
    // Pegar últimas mensagens do cliente (últimas 10)
    const userMessages = recentMessages
      .filter(m => m.role === 'user')
      .slice(-10);
    
    if (userMessages.length < 2) {
      return null; // Precisa de pelo menos 2 mensagens do cliente
    }
    
    // Padrões comuns de repetição que indicam problema não resolvido
    const problemPatterns = [
      /sem (?:internet|conexão|rede|sinal)/i,
      /não (?:consigo|estou conseguindo) (?:acessar|conectar|usar)/i,
      /(?:boleto|fatura|conta)/i,
      /(?:não )?recebo (?:boleto|fatura)/i,
      /(?:segunda via|2.? via)/i,
      /(?:pagamento|pagar)/i,
      /(?:suporte|ajuda|resolver)/i,
      /(?:técnico|atendente|humano)/i,
    ];
    
    // Verificar se últimas 2-3 mensagens do cliente são similares
    const lastUserMessage = userMessages[userMessages.length - 1];
    const previousUserMessages = userMessages.slice(-4, -1); // 3 mensagens anteriores
    
    // Detectar repetição de keywords/problemas
    const lastMessageProblems = problemPatterns.filter(pattern => 
      pattern.test(lastUserMessage.content)
    );
    
    if (lastMessageProblems.length === 0) {
      return null; // Mensagem atual não menciona problema específico
    }
    
    // Contar quantas mensagens anteriores mencionam o mesmo problema
    let repetitionCount = 0;
    for (const prevMsg of previousUserMessages) {
      const matchesAnyProblem = lastMessageProblems.some(pattern => 
        pattern.test(prevMsg.content)
      );
      if (matchesAnyProblem) {
        repetitionCount++;
      }
    }
    
    // Se cliente repetiu 2+ vezes o mesmo problema, alertar
    if (repetitionCount >= 2) {
      return {
        conversationId,
        alertType: 'client_repetition',
        severity: 'high',
        description: `Cliente repetiu o mesmo problema ${repetitionCount + 1}x (indica IA não está respondendo adequadamente)`,
        detectedAt: new Date(),
        assistantType,
        metadata: {
          repetitionCount: repetitionCount + 1,
          lastMessage: lastUserMessage.content.substring(0, 150),
          previousMessages: previousUserMessages.map(m => m.content.substring(0, 100)),
        }
      };
    }
    
    return null;
  }
  
  /**
   * Detecta roteamento incorreto quando cliente expressa frustração com problema
   * (ex: "vou cancelar pois não recebo boleto" → cancelamento [ERRADO], deveria ser financeiro)
   * 
   * MELHORIA: Analisa últimas mensagens do assistente para detectar roteamento incorreto
   * mesmo quando assistente atual está correto (problema pode ter sido causado anteriormente)
   */
  static async detectMisroutingFrustration(
    conversationId: string,
    assistantType: string,
    recentMessages: Message[]
  ): Promise<ContextQualityAlert | null> {
    // Pegar últimas 3 mensagens do cliente
    const lastUserMessages = recentMessages
      .filter(m => m.role === 'user')
      .slice(-3);
    
    if (lastUserMessages.length === 0) {
      return null;
    }
    
    const lastUserMessage = lastUserMessages[lastUserMessages.length - 1].content;
    
    // Pegar últimas 3 mensagens do assistente para detectar roteamentos recentes
    const lastAssistantMessages = recentMessages
      .filter(m => m.role === 'assistant')
      .slice(-3);
    
    // Padrão de mensagem de roteamento: "encaminhando para [departamento]"
    const routingPattern = /(?:encaminhando|transferindo|roteando).*(?:para|ao)\s*(?:setor\s+)?(?:de\s+)?(\w+)/i;
    
    // Detectar último roteamento explícito
    let lastRoutedDepartment = assistantType;
    for (let i = lastAssistantMessages.length - 1; i >= 0; i--) {
      const match = lastAssistantMessages[i].content.match(routingPattern);
      if (match) {
        lastRoutedDepartment = match[1].toLowerCase();
        break;
      }
    }
    
    // Detectar frustração + problema real
    const frustrationWithProblem = [
      // Frustração com boleto → deveria ser FINANCEIRO, não CANCELAMENTO
      {
        pattern: /(?:vou (?:ter que )?cancelar|vou desistir).{0,50}(?:boleto|fatura|não recebo|bloqueio|pagar)/i,
        correctDepartment: 'financeiro',
        wrongDepartments: ['cancelamento'],
        problem: 'boleto/pagamento'
      },
      // Frustração com internet → deveria ser SUPORTE, não CANCELAMENTO
      {
        pattern: /(?:vou (?:ter que )?cancelar|vou desistir).{0,50}(?:internet|conexão|sinal|lenta|péssima)/i,
        correctDepartment: 'suporte',
        wrongDepartments: ['cancelamento'],
        problem: 'internet/conexão'
      },
      // Frustração com atendimento → deveria ser OUVIDORIA, não CANCELAMENTO
      {
        pattern: /(?:vou (?:ter que )?cancelar|vou desistir).{0,50}(?:atendimento|não resolvem|ninguém resolve)/i,
        correctDepartment: 'ouvidoria',
        wrongDepartments: ['cancelamento'],
        problem: 'atendimento ruim'
      },
    ];
    
    // Verificar se mensagem contém frustração + problema
    for (const { pattern, correctDepartment, wrongDepartments, problem } of frustrationWithProblem) {
      if (pattern.test(lastUserMessage)) {
        // Verificar se foi roteado para departamento errado (atual OU anterior)
        if (wrongDepartments.includes(lastRoutedDepartment)) {
          return {
            conversationId,
            alertType: 'misrouting_frustration',
            severity: 'high',
            description: `Cliente frustrado com ${problem} foi roteado para ${lastRoutedDepartment.toUpperCase()} (correto seria ${correctDepartment.toUpperCase()})`,
            detectedAt: new Date(),
            assistantType: lastRoutedDepartment, // Reportar quem causou o misroute
            metadata: {
              lastUserMessage: lastUserMessage.substring(0, 200),
              wrongDepartment: lastRoutedDepartment,
              currentAssistant: assistantType,
              correctDepartment,
              detectedProblem: problem,
            }
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Monitora uma interação completa do assistente
   */
  static async monitorInteraction(
    conversationId: string,
    assistantMessage: string,
    assistantType?: string
  ): Promise<ContextQualityAlert[]> {
    const alerts: ContextQualityAlert[] = [];
    
    try {
      console.log(`🔍 [Context Monitor] Monitoring interaction - Assistant: ${assistantType || 'unknown'}, Conversation: ${conversationId.substring(0, 8)}...`);
      
      // Buscar mensagens recentes da conversa
      const allMessages = await storage.getMessagesByConversationId(conversationId);
      const recentMessages = allMessages.slice(-50); // Últimas 50 mensagens
      
      console.log(`🔍 [Context Monitor] Analyzing ${recentMessages.length} messages for potential issues...`);
      
      // Executar todos os detectores
      const [
        duplicateDataAlert,
        ignoredHistoryAlert,
        duplicateRoutingAlert,
        contextResetAlert,
        clientRepetitionAlert,
        misroutingFrustrationAlert,
      ] = await Promise.all([
        this.detectDuplicateDataRequest(conversationId, assistantMessage, recentMessages, assistantType),
        this.detectIgnoredHistory(conversationId, assistantMessage, recentMessages, assistantType),
        assistantType 
          ? this.detectDuplicateRouting(conversationId, assistantType, recentMessages)
          : null,
        this.detectContextReset(conversationId, assistantMessage, recentMessages, assistantType),
        this.detectClientRepetition(conversationId, recentMessages, assistantType),
        assistantType 
          ? this.detectMisroutingFrustration(conversationId, assistantType, recentMessages)
          : null,
      ]);
      
      // Coletar alertas não-nulos e persistir (usando for...of para aguardar await)
      const allAlerts = [
        duplicateDataAlert,
        ignoredHistoryAlert,
        duplicateRoutingAlert,
        contextResetAlert,
        clientRepetitionAlert,
        misroutingFrustrationAlert,
      ].filter(alert => alert !== null) as ContextQualityAlert[];
      
      for (const alert of allAlerts) {
        alerts.push(alert);
        
        // Salvar no banco de dados para persistência
        try {
          const { storage } = await import("../storage");
          await storage.createContextQualityAlert({
            conversationId: alert.conversationId,
            alertType: alert.alertType as any,
            severity: alert.severity as any,
            description: alert.description,
            assistantType: alert.assistantType,
            metadata: alert.metadata,
          });
          console.log(`💾 [Context Monitor] Alert saved to database: ${alert.alertType}`);
        } catch (saveError) {
          console.error(`❌ [Context Monitor] Failed to save alert to database:`, saveError);
          // Fallback to in-memory storage
          this.alerts.push(alert);
        }
        
        // Log no console para visibilidade imediata
        console.warn(`⚠️  [CONTEXT MONITOR] ${alert.severity.toUpperCase()}: ${alert.description}`);
        console.warn(`   Conversation: ${conversationId}`);
        console.warn(`   Alert Type: ${alert.alertType}`);
        console.warn(`   Assistant: ${alert.assistantType || 'unknown'}`);
      }
      
      if (alerts.length === 0) {
        console.log(`✅ [Context Monitor] No issues detected - conversation quality is good`);
      } else {
        console.warn(`⚠️  [Context Monitor] Detected ${alerts.length} quality issue(s)`);
        
        // Limpar alertas antigos do banco (>7 dias) - executar periodicamente
        try {
          const { storage } = await import("../storage");
          const deleted = await storage.deleteOldContextQualityAlerts(7);
          if (deleted > 0) {
            console.log(`🧹 [Context Monitor] Cleaned ${deleted} old alerts from database (>7 days)`);
          }
        } catch (cleanupError) {
          console.error(`❌ [Context Monitor] Failed to cleanup old alerts:`, cleanupError);
        }
      }
      
    } catch (error) {
      console.error('❌ [Context Monitor] Error monitoring interaction:', error);
    }
    
    return alerts;
  }
  
  /**
   * Retorna alertas recentes do banco de dados (últimas N horas)
   */
  static async getRecentAlerts(hours: number = 24): Promise<ContextQualityAlert[]> {
    try {
      const { storage } = await import("../storage");
      return await storage.getRecentContextQualityAlerts(hours);
    } catch (error) {
      console.error(`❌ [Context Monitor] Failed to fetch recent alerts:`, error);
      // Fallback to in-memory alerts
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      return this.alerts
        .filter(alert => alert.detectedAt >= cutoffTime)
        .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
    }
  }
  
  /**
   * Obtém estatísticas de qualidade de contexto do banco de dados
   */
  static async getStats(hours: number = 24) {
    try {
      const { storage } = await import("../storage");
      const stats = await storage.getContextQualityStats(hours);
      return {
        ...stats,
        period: `${hours}h`,
      };
    } catch (error) {
      console.error(`❌ [Context Monitor] Failed to fetch stats:`, error);
      // Fallback to in-memory calculation
      const recentAlerts = await this.getRecentAlerts(hours);
      const byType = recentAlerts.reduce((acc, alert) => {
        acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const bySeverity = recentAlerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return {
        totalAlerts: recentAlerts.length,
        byType,
        bySeverity,
        period: `${hours}h`,
      };
    }
  }
}

// Limpeza automática de alertas antigos a cada hora
setInterval(async () => {
  try {
    const { storage } = await import("../storage");
    const deleted = await storage.deleteOldContextQualityAlerts(7);
    if (deleted > 0) {
      console.log(`🧹 [Context Monitor Cleanup] Removed ${deleted} old alerts (>7 days)`);
    }
  } catch (error) {
    console.error(`❌ [Context Monitor Cleanup] Failed:`, error);
  }
}, 60 * 60 * 1000);
