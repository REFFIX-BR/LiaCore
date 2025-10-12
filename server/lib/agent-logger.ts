import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";

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

class AgentLogger {
  private logs: AgentLog[] = [];
  private maxLogs = 500;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  setupWebSocket(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/agent-logs'
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🤖 [Agent Logger] Cliente conectado ao monitor de agentes');
      this.clients.add(ws);

      // Enviar histórico de logs ao conectar
      ws.send(JSON.stringify({
        type: 'history',
        logs: this.logs,
      }));

      ws.on('close', () => {
        console.log('🤖 [Agent Logger] Cliente desconectado do monitor de agentes');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('🤖 [Agent Logger] Erro:', error);
        this.clients.delete(ws);
      });
    });

    console.log('✅ [Agent Logger] Servidor de logs de agentes configurado em /ws/agent-logs');
  }

  log(
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
      'cortex': 'LIA Cortex (Router)'
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

    // Manter apenas os últimos N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Broadcast para todos os clientes conectados
    this.broadcast({
      type: 'new',
      log,
    });

    // Também logar no console com emoji apropriado
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

  clearLogs(): void {
    this.logs = [];
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
