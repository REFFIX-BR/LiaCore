/**
 * Production Logger - Sistema de logs estruturados para debug
 * 
 * Permite rastrear todas as operações da LIA e identificar problemas em produção
 */

import { storage } from '../storage';

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'webhook' | 'worker' | 'openai' | 'whatsapp' | 'conversation' | 'system';
  message: string;
  metadata?: Record<string, any>;
  conversationId?: string;
  phoneNumber?: string;
  error?: string;
  stack?: string;
}

class ProductionLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Manter últimos 1000 logs em memória
  
  /**
   * Log de informação geral
   */
  info(category: LogEntry['category'], message: string, metadata?: Record<string, any>) {
    this.addLog('info', category, message, metadata);
  }
  
  /**
   * Log de warning
   */
  warn(category: LogEntry['category'], message: string, metadata?: Record<string, any>) {
    this.addLog('warn', category, message, metadata);
  }
  
  /**
   * Log de erro
   */
  error(category: LogEntry['category'], message: string, error?: Error, metadata?: Record<string, any>) {
    this.addLog('error', category, message, {
      ...metadata,
      error: error?.message,
      stack: error?.stack,
    });
  }
  
  /**
   * Log de debug (só em desenvolvimento)
   */
  debug(category: LogEntry['category'], message: string, metadata?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development') {
      this.addLog('debug', category, message, metadata);
    }
  }
  
  /**
   * Adicionar log à memória e ao console
   */
  private addLog(
    level: LogEntry['level'],
    category: LogEntry['category'],
    message: string,
    metadata?: Record<string, any>
  ) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      metadata,
      conversationId: metadata?.conversationId,
      phoneNumber: metadata?.phoneNumber,
    };
    
    // Adicionar à memória (circular buffer)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Log no console com formatação
    const emoji = this.getEmoji(level, category);
    const timestamp = entry.timestamp.toISOString();
    const meta = metadata ? ` | ${JSON.stringify(metadata)}` : '';
    
    console.log(`${emoji} [${level.toUpperCase()}] [${category}] ${message}${meta}`);
  }
  
  /**
   * Obter emoji para o tipo de log
   */
  private getEmoji(level: LogEntry['level'], category: LogEntry['category']): string {
    if (level === 'error') return '❌';
    if (level === 'warn') return '⚠️';
    if (level === 'debug') return '🔍';
    
    // Info emojis por categoria
    const categoryEmojis: Record<LogEntry['category'], string> = {
      webhook: '📨',
      worker: '⚙️',
      openai: '🤖',
      whatsapp: '💬',
      conversation: '💭',
      system: '🖥️',
    };
    
    return categoryEmojis[category] || '📝';
  }
  
  /**
   * Buscar logs por filtros
   */
  search(filters: {
    level?: LogEntry['level'];
    category?: LogEntry['category'];
    conversationId?: string;
    phoneNumber?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];
    
    if (filters.level) {
      filtered = filtered.filter(log => log.level === filters.level);
    }
    
    if (filters.category) {
      filtered = filtered.filter(log => log.category === filters.category);
    }
    
    if (filters.conversationId) {
      filtered = filtered.filter(log => log.conversationId === filters.conversationId);
    }
    
    if (filters.phoneNumber) {
      filtered = filtered.filter(log => log.phoneNumber === filters.phoneNumber);
    }
    
    if (filters.startDate) {
      filtered = filtered.filter(log => log.timestamp >= filters.startDate!);
    }
    
    if (filters.endDate) {
      filtered = filtered.filter(log => log.timestamp <= filters.endDate!);
    }
    
    // Ordenar por timestamp (mais recentes primeiro)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Limitar resultados
    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }
    
    return filtered;
  }
  
  /**
   * Obter todos os logs
   */
  getAll(limit = 100): LogEntry[] {
    return this.logs.slice(-limit).reverse();
  }
  
  /**
   * Obter logs de erros
   */
  getErrors(limit = 50): LogEntry[] {
    return this.search({ level: 'error', limit });
  }
  
  /**
   * Limpar logs
   */
  clear() {
    this.logs = [];
    console.log('🗑️ Production logs cleared');
  }
  
  /**
   * Obter estatísticas dos logs
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      errors: 0,
      warnings: 0,
    };
    
    for (const log of this.logs) {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      
      if (log.level === 'error') stats.errors++;
      if (log.level === 'warn') stats.warnings++;
    }
    
    return stats;
  }
}

// Singleton instance
export const prodLogger = new ProductionLogger();

/**
 * Helper para logar eventos de conversação
 */
export function logConversationEvent(
  event: 'created' | 'updated' | 'message_received' | 'ai_response' | 'transferred' | 'resolved',
  conversationId: string,
  metadata?: Record<string, any>
) {
  prodLogger.info('conversation', `Conversation ${event}`, {
    conversationId,
    event,
    ...metadata,
  });
}

/**
 * Helper para logar eventos de webhook
 */
export function logWebhookEvent(
  event: string,
  phoneNumber: string,
  metadata?: Record<string, any>
) {
  prodLogger.info('webhook', `Webhook event: ${event}`, {
    phoneNumber,
    event,
    ...metadata,
  });
}

/**
 * Helper para logar erros de worker
 */
export function logWorkerError(
  conversationId: string,
  error: Error,
  metadata?: Record<string, any>
) {
  prodLogger.error('worker', 'Worker processing failed', error, {
    conversationId,
    ...metadata,
  });
}
