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
  alertType: 'duplicate_data_request' | 'ignored_history' | 'duplicate_routing' | 'context_reset';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detectedAt: Date;
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
    recentMessages: Message[]
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
    recentMessages: Message[]
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
    recentMessages: Message[]
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
        metadata: {
          assistantMessage: assistantMessage.substring(0, 200),
          availableMessages: recentMessages.length,
        }
      };
    }
    
    return null;
  }
  
  /**
   * Monitora uma interação completa do assistente
   */
  static async monitorInteraction(
    conversationId: string,
    assistantMessage: string,
    newAssistantType?: string
  ): Promise<ContextQualityAlert[]> {
    const alerts: ContextQualityAlert[] = [];
    
    try {
      // Buscar mensagens recentes da conversa
      const allMessages = await storage.getMessagesByConversationId(conversationId);
      const recentMessages = allMessages.slice(-50); // Últimas 50 mensagens
      
      // Executar todos os detectores
      const [
        duplicateDataAlert,
        ignoredHistoryAlert,
        duplicateRoutingAlert,
        contextResetAlert,
      ] = await Promise.all([
        this.detectDuplicateDataRequest(conversationId, assistantMessage, recentMessages),
        this.detectIgnoredHistory(conversationId, assistantMessage, recentMessages),
        newAssistantType 
          ? this.detectDuplicateRouting(conversationId, newAssistantType, recentMessages)
          : null,
        this.detectContextReset(conversationId, assistantMessage, recentMessages),
      ]);
      
      // Coletar alertas não-nulos
      [
        duplicateDataAlert,
        ignoredHistoryAlert,
        duplicateRoutingAlert,
        contextResetAlert,
      ].forEach(alert => {
        if (alert) {
          alerts.push(alert);
          this.alerts.push(alert);
          
          // Log no console para visibilidade imediata
          console.warn(`⚠️  [CONTEXT MONITOR] ${alert.severity.toUpperCase()}: ${alert.description}`);
          console.warn(`   Conversation: ${conversationId}`);
          console.warn(`   Alert Type: ${alert.alertType}`);
        }
      });
      
      // Garantir limite máximo de 304 alertas (remover mais antigos)
      if (this.alerts.length > 304) {
        this.alerts = this.alerts
          .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()) // Mais recentes primeiro
          .slice(0, 304); // Manter apenas os 304 mais recentes
      }
      
      // Limpar alertas antigos (mais de 7 dias)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      this.alerts = this.alerts.filter(a => a.detectedAt > sevenDaysAgo);
      
    } catch (error) {
      console.error('❌ [Context Monitor] Error monitoring interaction:', error);
    }
    
    return alerts;
  }
  
  /**
   * Retorna alertas recentes (últimas N horas), ordenados do mais recente ao mais antigo
   */
  static getRecentAlerts(hours: number = 24): ContextQualityAlert[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts
      .filter(alert => alert.detectedAt >= cutoffTime)
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()); // Mais recentes primeiro
  }
  
  /**
   * Obtém estatísticas de qualidade de contexto
   */
  static getStats(hours: number = 24) {
    const recentAlerts = this.getRecentAlerts(hours);
    
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
  
  /**
   * Limpa alertas antigos (mais de 7 dias)
   */
  static cleanup() {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.detectedAt >= cutoffTime);
  }
}

// Limpeza automática a cada hora
setInterval(() => {
  ContextMonitor.cleanup();
}, 60 * 60 * 1000);
