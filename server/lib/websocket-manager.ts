import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { webhookLogger } from "./webhook-logger";
import { agentLogger } from "./agent-logger";

export function setupWebSockets(server: Server) {
  // Create WebSocketServer in noServer mode to manually handle upgrades
  const wss = new WebSocketServer({ noServer: true });

  // Manually handle HTTP upgrade requests
  server.on('upgrade', (req, socket, head) => {
    const path = req.url;
    
    // Only handle our specific paths, let Vite handle its own
    if (path === '/ws/webhook-logs' || path === '/ws/reasoning') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        if (path === '/ws/webhook-logs') {
          console.log('🔌 [WebSocket] Cliente conectado ao monitor de webhook');
          webhookLogger.handleConnection(ws);
        } else if (path === '/ws/reasoning') {
          console.log('🤖 [Agent Logger] Cliente conectado ao monitor de agentes');
          agentLogger.handleConnection(ws);
        }
      });
    }
    // Ignore other paths (like Vite HMR) - let them be handled elsewhere
  });

  console.log('✅ [WebSocket] Servidor WebSocket unificado configurado (noServer mode)');
}
