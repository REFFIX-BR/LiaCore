import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { redis } from "./redis-config";

export interface AgentLog {
  id: string;
  timestamp: string;
  type: 'reasoning' | 'routing' | 'function_call' | 'decision' | 'error';
  assistantType: string;
  assistantName: string;
  event: string;
  message: string;
  details?: {
    conversationId?: string;
    chatId?: string;
    clientName?: string;
    fromAssistant?: string;
    toAssistant?: string;
    functionName?: string;
    functionArgs?: any;
    reasoning?: string;
    decision?: string;
    confidence?: number;
    [key: string]: any;
  };
}

const REDIS_KEY = 'agent:reasoning:logs';
const MAX_LOGS = 500;
const LOG_TTL_SECONDS = 48 * 60 * 60; // 48 hours

class AgentLogger {
  private logs: AgentLog[] = [];
  private maxLogs = MAX_LOGS;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    try {
      const storedLogs = await redis.lrange(REDIS_KEY, 0, this.maxLogs - 1);
      if (storedLogs && storedLogs.length > 0) {
        const parsedLogs = storedLogs.map((log: any) => {
          if (typeof log === 'string') {
            try {
              return JSON.parse(log);
            } catch {
              return log;
            }
          }
          return log;
        }).filter((log: any) => log && log.id);
        
        // Merge: keep any logs buffered before init, add persisted logs that don't overlap
        const existingIds = new Set(this.logs.map(l => l.id));
        const newFromRedis = parsedLogs.filter((log: AgentLog) => !existingIds.has(log.id));
        this.logs = [...newFromRedis, ...this.logs].slice(-this.maxLogs);
        
        console.log(`📋 [Agent Logger] Carregados ${newFromRedis.length} logs do Redis (total: ${this.logs.length})`);
      } else {
        console.log(`📋 [Agent Logger] Nenhum log anterior encontrado no Redis`);
      }
      this.initialized = true;
    } catch (error) {
      console.error('❌ [Agent Logger] Erro ao carregar logs do Redis:', error);
      this.initialized = true;
    }
  }

  handleConnection(ws: WebSocket) {
    this.clients.add(ws);

    this.initialize().then(() => {
      ws.send(JSON.stringify({
        type: 'history',
        logs: this.logs,
      }));
    });

    ws.on('close', () => {
      console.log('🤖 [Agent Logger] Cliente desconectado do monitor de agentes');
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('🤖 [Agent Logger] Erro:', error);
      this.clients.delete(ws);
    });
  }

  async log(
    type: AgentLog['type'], 
    assistantType: string, 
    event: string, 
    message: string, 
    details?: AgentLog['details']
  ) {
    const assistantNames: Record<string, string> = {
      'apresentacao': 'LIA Apresentação (Recepcionista)',
      'comercial': 'LIA Comercial',
      'financeiro': 'LIA Financeiro',
      'suporte': 'LIA Suporte Técnico',
      'ouvidoria': 'LIA Ouvidoria',
      'cancelamento': 'LIA Cancelamento',
      'cortex': 'LIA Cortex (Router)',
      'cobranca': 'LIA Cobrança'
    };

    const log: AgentLog = {
      id: `agent-log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      assistantType,
      assistantName: assistantNames[assistantType] || assistantType,
      event,
      message,
      details,
    };

    this.logs.push(log);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    try {
      await redis.lpush(REDIS_KEY, JSON.stringify(log));
      await redis.ltrim(REDIS_KEY, 0, this.maxLogs - 1);
      await redis.expire(REDIS_KEY, LOG_TTL_SECONDS);
    } catch (error) {
      console.error('❌ [Agent Logger] Erro ao persistir log no Redis:', error);
    }

    this.broadcast({
      type: 'new',
      log,
    });

    const emoji = {
      reasoning: '🧠',
      routing: '🔀',
      function_call: '🛠️',
      decision: '🎯',
      error: '❌',
    }[type];

    console.log(`${emoji} [Agent ${assistantNames[assistantType] || assistantType}] [${event}] ${message}`, details ? `\n   Details: ${JSON.stringify(details, null, 2).substring(0, 200)}...` : '');
  }

  reasoning(assistantType: string, message: string, details?: AgentLog['details']) {
    this.log('reasoning', assistantType, 'REASONING', message, details);
  }

  routing(assistantType: string, message: string, details?: AgentLog['details']) {
    this.log('routing', assistantType, 'ROUTING', message, details);
  }

  functionCall(assistantType: string, functionName: string, message: string, details?: AgentLog['details']) {
    this.log('function_call', assistantType, `FUNCTION_${functionName.toUpperCase()}`, message, {
      ...details,
      functionName
    });
  }

  decision(assistantType: string, message: string, details?: AgentLog['details']) {
    this.log('decision', assistantType, 'DECISION', message, details);
  }

  error(assistantType: string, message: string, details?: AgentLog['details']) {
    this.log('error', assistantType, 'ERROR', message, details);
  }

  private broadcast(data: any) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  getLogs(): AgentLog[] {
    return this.logs;
  }

  async clearLogs(): Promise<void> {
    this.logs = [];
    try {
      await redis.del(REDIS_KEY);
    } catch (error) {
      console.error('❌ [Agent Logger] Erro ao limpar logs no Redis:', error);
    }
    this.broadcast({ type: 'clear' });
  }

  getStats() {
    const byType = this.logs.reduce((acc, log) => {
      acc[log.type] = (acc[log.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byAssistant = this.logs.reduce((acc, log) => {
      acc[log.assistantType] = (acc[log.assistantType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.logs.length,
      byType,
      byAssistant,
    };
  }
}

export const agentLogger = new AgentLogger();
