import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { webhookLogger } from "./webhook-logger";
import { agentLogger } from "./agent-logger";

export function setupWebSockets(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    const path = req.url;
    
    if (path === '/ws/webhook-logs') {
      console.log('🔌 [WebSocket] Cliente conectado ao monitor de webhook');
      webhookLogger.handleConnection(ws);
    } else if (path === '/ws/agent-logs') {
      console.log('🤖 [Agent Logger] Cliente conectado ao monitor de agentes');
      agentLogger.handleConnection(ws);
    } else if (path?.startsWith('/?token=')) {
      // Vite HMR WebSocket - ignore silently
      ws.close();
    } else {
      console.log(`❌ [WebSocket] Path desconhecido: ${path}`);
      ws.close();
    }
  });

  console.log('✅ [WebSocket] Servidor WebSocket unificado configurado');
}
