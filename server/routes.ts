import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConversationSchema, insertMessageSchema, insertAlertSchema, insertSupervisorActionSchema } from "@shared/schema";
import { routeMessage, createThread, addMessageToThread, runAssistant } from "./lib/openai";
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
      }

      // Store user message
      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: message,
        assistant: null,
      });

      // Add message to thread and run assistant
      if (threadId) {
        await addMessageToThread(threadId, message);
        const assistantId = (conversation.metadata as any)?.routing?.assistantId;
        const response = await runAssistant(threadId, assistantId);

        // Store assistant response
        await storage.createMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: response,
          assistant: conversation.assistantType,
        });

        // Update conversation
        await storage.updateConversation(conversation.id, {
          lastMessage: message,
          lastMessageTime: new Date(),
          duration: (conversation.duration || 0) + 1,
        });

        return res.json({
          success: true,
          response,
          assistantType: conversation.assistantType,
          chatId,
        });
      }

      return res.status(500).json({ error: "Failed to process message" });
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
      const { query, topK = 5 } = req.body;

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

  const httpServer = createServer(app);

  return httpServer;
}
