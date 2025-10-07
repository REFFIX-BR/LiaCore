import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConversationSchema, insertMessageSchema, insertAlertSchema, insertSupervisorActionSchema } from "@shared/schema";
import { routeMessage, createThread, sendMessageAndGetResponse } from "./lib/openai";
import { storeConversationThread, getConversationThread, searchKnowledge } from "./lib/upstash";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Chat endpoint - Main entry point for TR Chat messages
  app.post("/api/chat/message", async (req, res) => {
    try {
      const { chatId, clientName, clientId, message } = req.body;

      if (!chatId || !message) {
        return res.status(400).json({ error: "chatId and message are required" });
      }

      // Get or create conversation
      let conversation = await storage.getConversationByChatId(chatId);
      let threadId = await getConversationThread(chatId);

      if (!conversation) {
        // New conversation - route to appropriate assistant
        const routing = await routeMessage(message);
        
        // Create thread
        threadId = await createThread();
        await storeConversationThread(chatId, threadId);

        // Create conversation record
        conversation = await storage.createConversation({
          chatId,
          clientName: clientName || "Cliente",
          clientId,
          threadId,
          assistantType: routing.assistantType,
          status: "active",
          sentiment: "neutral",
          urgency: "normal",
          duration: 0,
          lastMessage: message,
          metadata: { routing },
        });
      } else if (!threadId) {
        // Existing conversation but no thread - create one
        threadId = await createThread();
        await storeConversationThread(chatId, threadId);
        
        // Update conversation with threadId
        await storage.updateConversation(conversation.id, {
          threadId,
        });
      }

      // Store user message
      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: message,
        assistant: null,
      });

      // Send message and get response
      if (!threadId) {
        console.error("❌ No threadId available for conversation:", { chatId, conversationId: conversation.id });
        return res.status(500).json({ error: "Thread ID not found" });
      }

      const assistantId = (conversation.metadata as any)?.routing?.assistantId;
      const response = await sendMessageAndGetResponse(threadId, assistantId, message);

      // Store assistant response
      await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: response,
        assistant: conversation.assistantType,
      });

      // Analyze sentiment (simplified)
      const sentiment = message.includes("!") || message.toUpperCase() === message ? "negative" : "neutral";
      const urgency = message.includes("URGENTE") || message.includes("!!!") ? "critical" : "normal";

      // Update conversation
      await storage.updateConversation(conversation.id, {
        lastMessage: message,
        lastMessageTime: new Date(),
        duration: (conversation.duration || 0) + 30,
        sentiment,
        urgency,
      });

      return res.json({
        success: true,
        response,
        assistantType: conversation.assistantType,
        chatId,
      });
    } catch (error) {
      console.error("Chat error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all active conversations for monitoring
  app.get("/api/monitor/conversations", async (req, res) => {
    try {
      const conversations = await storage.getAllActiveConversations();
      return res.json(conversations);
    } catch (error) {
      console.error("Monitor error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get conversation details
  app.get("/api/monitor/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await storage.getMessagesByConversationId(conversation.id);
      const alerts = await storage.getAlertsByConversationId(conversation.id);
      const actions = await storage.getActionsByConversationId(conversation.id);

      return res.json({
        conversation,
        messages,
        alerts,
        actions,
      });
    } catch (error) {
      console.error("Conversation details error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get active alerts
  app.get("/api/monitor/alerts", async (req, res) => {
    try {
      const alerts = await storage.getActiveAlerts();
      return res.json(alerts);
    } catch (error) {
      console.error("Alerts error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Supervisor actions
  app.post("/api/supervisor/transfer", async (req, res) => {
    try {
      const { conversationId, department, notes, supervisorId } = req.body;

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "transfer",
        notes: `Transfer to ${department}: ${notes}`,
        createdBy: supervisorId || "supervisor",
      });

      // Update conversation status
      await storage.updateConversation(conversationId, {
        status: "transferred",
      });

      return res.json({ success: true, action });
    } catch (error) {
      console.error("Transfer error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/supervisor/pause", async (req, res) => {
    try {
      const { conversationId, supervisorId } = req.body;

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "pause_ai",
        notes: "AI paused by supervisor",
        createdBy: supervisorId || "supervisor",
      });

      return res.json({ success: true, action });
    } catch (error) {
      console.error("Pause error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/supervisor/note", async (req, res) => {
    try {
      const { conversationId, note, supervisorId } = req.body;

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "add_note",
        notes: note,
        createdBy: supervisorId || "supervisor",
      });

      return res.json({ success: true, action });
    } catch (error) {
      console.error("Note error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/supervisor/resolve", async (req, res) => {
    try {
      const { conversationId, supervisorId } = req.body;

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "mark_resolved",
        notes: "Conversation marked as resolved",
        createdBy: supervisorId || "supervisor",
      });

      await storage.updateConversation(conversationId, {
        status: "resolved",
      });

      return res.json({ success: true, action });
    } catch (error) {
      console.error("Resolve error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Knowledge base search
  app.post("/api/knowledge/search", async (req, res) => {
    try {
      const { query, topK = 20 } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const results = await searchKnowledge(query, topK);
      return res.json(results);
    } catch (error) {
      console.error("Knowledge search error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add knowledge chunks
  app.post("/api/knowledge/add", async (req, res) => {
    try {
      const { chunks } = req.body;

      if (!chunks || !Array.isArray(chunks)) {
        return res.status(400).json({ error: "Chunks array is required" });
      }

      const { addKnowledgeChunks } = await import("./lib/upstash");
      await addKnowledgeChunks(chunks);
      
      return res.json({ success: true, count: chunks.length });
    } catch (error) {
      console.error("Add knowledge error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Populate knowledge base with initial data
  app.post("/api/knowledge/populate", async (req, res) => {
    try {
      const { addKnowledgeChunks } = await import("./lib/upstash");
      
      const knowledgeBase = [
        {
          id: "kb-001",
          name: "Planos e Produtos",
          content: "A TR Telecom oferece planos de internet fibra óptica com velocidades de 300 Mbps, 500 Mbps e 1 Gbps. Os planos incluem instalação gratuita e roteador Wi-Fi 6 de última geração.",
          source: "Manual de Produtos",
          metadata: { category: "produtos", topic: "planos" }
        },
        {
          id: "kb-002",
          name: "Problemas de Conexão",
          content: "Para problemas de conexão, siga estes passos: 1) Verifique se todos os cabos estão conectados corretamente. 2) Reinicie o roteador (desligue por 30 segundos). 3) Verifique se há interrupções no serviço. 4) Teste a conexão com cabo direto.",
          source: "Manual Técnico",
          metadata: { category: "suporte", topic: "conexao" }
        },
        {
          id: "kb-003",
          name: "Latência e Performance",
          content: "A latência esperada para conexões de fibra óptica da TR Telecom é entre 5-15ms para servidores nacionais. Para jogos online, recomendamos o plano Fibra Gamer que prioriza tráfego de jogos e oferece latência média de 8ms.",
          source: "Manual Técnico",
          metadata: { category: "suporte", topic: "latencia" }
        },
        {
          id: "kb-004",
          name: "Faturas e Pagamentos",
          content: "As faturas são enviadas por email até o dia 5 de cada mês. O vencimento padrão é dia 15. Aceitamos pagamento via PIX, boleto bancário, cartão de crédito e débito automático. O código PIX está disponível na fatura digital.",
          source: "Manual Financeiro",
          metadata: { category: "financeiro", topic: "faturas" }
        },
        {
          id: "kb-005",
          name: "Velocidades e Horários de Pico",
          content: "Velocidades podem variar dependendo do horário (pico entre 19h-23h) e quantidade de dispositivos conectados. Para melhor desempenho, conecte dispositivos críticos via cabo Ethernet. O Wi-Fi 5GHz oferece melhor velocidade para dispositivos próximos ao roteador.",
          source: "Manual Técnico",
          metadata: { category: "suporte", topic: "performance" }
        },
        {
          id: "kb-006",
          name: "Agendamento de Visitas",
          content: "Para agendar visita técnica, entre em contato pelo telefone 0800-123-4567 ou pelo chat. As visitas são realizadas de segunda a sábado, das 8h às 18h. Você receberá uma janela de 4 horas e confirmação 1 dia antes via SMS.",
          source: "Manual de Atendimento",
          metadata: { category: "suporte", topic: "visita-tecnica" }
        },
        {
          id: "kb-007",
          name: "Preços dos Planos",
          content: "O plano Fibra 300 custa R$ 99,90/mês, Fibra 500 custa R$ 129,90/mês e Fibra Gamer 1 Gbps custa R$ 199,90/mês. Todos os planos incluem instalação gratuita, sem fidelidade, e Wi-Fi 6 incluso.",
          source: "Tabela de Preços",
          metadata: { category: "comercial", topic: "precos" }
        },
        {
          id: "kb-008",
          name: "Cancelamento de Serviço",
          content: "Para cancelar o serviço, entre em contato pelo 0800-123-4567 ou chat. Não há multa de cancelamento. O serviço permanece ativo até o fim do período pago. Equipamentos devem ser devolvidos em até 15 dias após o cancelamento.",
          source: "Política de Cancelamento",
          metadata: { category: "cancelamento", topic: "processo" }
        },
        {
          id: "kb-009",
          name: "Especificações do Roteador",
          content: "O roteador Wi-Fi 6 suporta até 50 dispositivos simultâneos. Possui 4 antenas de alto ganho, cobertura de até 200m² e velocidades de até 3 Gbps combinadas. Suporta beamforming e MU-MIMO para melhor distribuição de sinal.",
          source: "Especificações Técnicas",
          metadata: { category: "suporte", topic: "equipamento" }
        },
        {
          id: "kb-010",
          name: "Troubleshooting de Instabilidade",
          content: "Em caso de instabilidade na conexão, verifique: 1) Interferências de outros dispositivos Wi-Fi próximos. 2) Distância do roteador. 3) Obstáculos físicos (paredes, móveis). 4) Muitos dispositivos conectados. 5) Atualizações do firmware do roteador.",
          source: "Troubleshooting",
          metadata: { category: "suporte", topic: "instabilidade" }
        },
        {
          id: "kb-011",
          name: "Informações da Empresa",
          content: "A TR Telecom é uma empresa de telecomunicações brasileira especializada em fibra óptica. Oferece internet de alta velocidade, suporte técnico 24/7 e atendimento personalizado. Fundada em 2020, atende milhares de clientes com excelência.",
          source: "Sobre a Empresa",
          metadata: { category: "apresentacao", topic: "empresa" }
        }
      ];

      await addKnowledgeChunks(knowledgeBase);
      
      return res.json({ 
        success: true, 
        message: "Base de conhecimento populada com sucesso",
        count: knowledgeBase.length 
      });
    } catch (error) {
      console.error("Populate knowledge error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Clear knowledge base
  app.post("/api/knowledge/clear", async (req, res) => {
    try {
      const { clearKnowledgeBase } = await import("./lib/upstash");
      await clearKnowledgeBase();
      
      return res.json({ success: true, message: "Base de conhecimento limpa" });
    } catch (error) {
      console.error("Clear knowledge error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete single knowledge chunk
  app.delete("/api/knowledge/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { deleteKnowledgeChunk } = await import("./lib/upstash");
      
      await deleteKnowledgeChunk(id);
      
      return res.json({ success: true, message: "Documento excluído" });
    } catch (error) {
      console.error("Delete knowledge error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
