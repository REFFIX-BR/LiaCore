import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

export interface WebhookLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  event: string;
  message: string;
  details?: any;
}

class WebhookLogger {
  private logs: WebhookLog[] = [];
  private maxLogs = 500;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  handleConnection(ws: WebSocket) {
    this.clients.add(ws);

    // Enviar histórico de logs ao conectar
    ws.send(JSON.stringify({
      type: 'history',
      logs: this.logs,
    }));

    ws.on('close', () => {
      console.log('🔌 [WebSocket] Cliente desconectado do monitor de webhook');
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('🔌 [WebSocket] Erro:', error);
      this.clients.delete(ws);
    });
  }

  // Removed - using unified websocket-manager instead

  log(type: WebhookLog['type'], event: string, message: string, details?: any) {
    const log: WebhookLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
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

    // Também logar no console
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
    }[type];

    console.log(`${emoji} [Webhook Monitor] [${event}] ${message}`, details || '');
  }

  info(event: string, message: string, details?: any) {
    this.log('info', event, message, details);
  }

  success(event: string, message: string, details?: any) {
    this.log('success', event, message, details);
  }

  error(event: string, message: string, details?: any) {
    this.log('error', event, message, details);
  }

  warning(event: string, message: string, details?: any) {
    this.log('warning', event, message, details);
  }

  private broadcast(data: any) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('Erro ao enviar para cliente WebSocket:', error);
        }
      }
    });
  }

  getLogs(): WebhookLog[] {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    this.broadcast({
      type: 'clear',
    });
    console.log('🗑️ [Webhook Monitor] Logs limpos');
  }

  getStats() {
    const now = Date.now();
    const last5min = new Date(now - 5 * 60 * 1000).toISOString();
    const last1hour = new Date(now - 60 * 60 * 1000).toISOString();

    const recentLogs = this.logs.filter(log => log.timestamp > last5min);
    const hourlyLogs = this.logs.filter(log => log.timestamp > last1hour);

    return {
      total: this.logs.length,
      last5Minutes: recentLogs.length,
      lastHour: hourlyLogs.length,
      byType: {
        info: this.logs.filter(l => l.type === 'info').length,
        success: this.logs.filter(l => l.type === 'success').length,
        error: this.logs.filter(l => l.type === 'error').length,
        warning: this.logs.filter(l => l.type === 'warning').length,
      },
      connectedClients: this.clients.size,
    };
  }
}

export const webhookLogger = new WebhookLogger();
