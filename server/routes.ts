import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConversationSchema, insertMessageSchema, insertAlertSchema, insertSupervisorActionSchema, insertLearningEventSchema, insertPromptSuggestionSchema, insertPromptUpdateSchema, insertSatisfactionFeedbackSchema, loginSchema, insertUserSchema, updateUserSchema, insertComplaintSchema, updateComplaintSchema, insertPlanSchema, updatePlanSchema, insertSaleSchema, updateGamificationSettingsSchema, type Conversation } from "@shared/schema";
import { routeMessage, createThread, sendMessageAndGetResponse, summarizeConversation, routeMessageWithContext, CONTEXT_CONFIG } from "./lib/openai";
import { z } from "zod";
import { storeConversationThread, getConversationThread, searchKnowledge } from "./lib/upstash";
import { RedisCache } from "./lib/redis-config";
import { webhookLogger } from "./lib/webhook-logger";
import { agentLogger } from "./lib/agent-logger";
import { setupWebSockets } from "./lib/websocket-manager";
import { authenticate, authenticateWithTracking, requireAdmin, requireAdminOrSupervisor, requireSalesAccess, requireAnyRole } from "./middleware/auth";
import { hashPassword, comparePasswords, generateToken, getUserFromUser } from "./lib/auth";
import { trackSecurityEvent, SecurityEventType } from "./lib/security-events";
import { extractNumberFromChatId, parseRemoteJid, normalizePhone, buildWhatsAppChatId } from "./lib/phone-utils";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to normalize Evolution API URL (ensure protocol)
function normalizeEvolutionUrl(url?: string): string {
  if (!url) return '';
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
    console.log(`✅ [Config] Evolution API URL normalized: ${normalized}`);
  }
  return normalized;
}

// Helper function to validate and normalize Evolution API instance
// Supported instances: "Leads", "Cobranca", "Principal"
// NOTE: Accepts both "Cobranca" and "Cobrança" (accent-insensitive)
function validateEvolutionInstance(instance?: string | null): string {
  const allowedInstances = ['Leads', 'Cobranca', 'Principal'];
  
  if (!instance) {
    return 'Leads'; // Default
  }
  
  // Normalize case and remove accents (ç -> c, ã -> a, etc.)
  const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalized = instance.charAt(0).toUpperCase() + removeAccents(instance.slice(1)).toLowerCase();
  
  if (allowedInstances.includes(normalized)) {
    return normalized;
  }
  
  // If invalid instance, force to Leads
  console.warn(`⚠️ [Evolution] Invalid instance "${instance}" - forcing to "Leads" (allowed: ${allowedInstances.join(', ')})`);
  return 'Leads';
}

// Helper function to get effective Evolution instance, preserving existing conversation instance
// Priority: existingInstance > payloadInstance > default 'Leads'
// This prevents webhook handlers from overwriting conversation evolutionInstance
function getEffectiveEvolutionInstance(
  existingInstance?: string | null,
  payloadInstance?: string | null
): string {
  // PRIORITY 1: Preserve existing conversation evolutionInstance
  if (existingInstance) {
    const validated = validateEvolutionInstance(existingInstance);
    console.log(`✅ [Instance] Preserving existing instance: ${validated}`);
    return validated;
  }
  
  // PRIORITY 2: Use payload instance if no existing instance
  if (payloadInstance) {
    const validated = validateEvolutionInstance(payloadInstance);
    console.log(`✅ [Instance] Using payload instance: ${validated}`);
    return validated;
  }
  
  // PRIORITY 3: Fallback to default
  console.log(`⚠️ [Instance] No instance found - using default: Leads`);
  return 'Leads';
}

// Evolution API configuration
const EVOLUTION_CONFIG = {
  apiUrl: normalizeEvolutionUrl(process.env.EVOLUTION_API_URL),
  apiKey: process.env.EVOLUTION_API_KEY,
  instance: "Leads", // Default instance (supported: Leads, Cobranca, Principal)
};

// Log configuration at startup
console.log(`📡 [Config] Evolution API URL: ${EVOLUTION_CONFIG.apiUrl}`);

// Helper function to get API key for specific instance
function getEvolutionApiKey(instanceName?: string): string | undefined {
  if (!instanceName) {
    return EVOLUTION_CONFIG.apiKey;
  }
  
  // Try to get instance-specific key from environment (convert to uppercase)
  const instanceKey = process.env[`EVOLUTION_API_KEY_${instanceName.toUpperCase()}`];
  if (instanceKey) {
    return instanceKey;
  }
  
  // Fallback to default key
  return EVOLUTION_CONFIG.apiKey;
}

// Helper function to get Evolution API URL for specific instance
function getEvolutionApiUrl(instanceName?: string): string {
  if (!instanceName) {
    return EVOLUTION_CONFIG.apiUrl;
  }
  
  // Try to get instance-specific URL from environment
  const instanceUrl = process.env[`EVOLUTION_API_URL_${instanceName.toUpperCase()}`];
  if (instanceUrl) {
    return normalizeEvolutionUrl(instanceUrl);
  }
  
  // Fallback to default URL
  return EVOLUTION_CONFIG.apiUrl;
}

// Helper function to send WhatsApp image via Evolution API
async function sendWhatsAppImage(phoneNumber: string, imageBase64: string, caption?: string, instanceName?: string): Promise<boolean> {
  // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
  const rawInstance = instanceName || EVOLUTION_CONFIG.instance;
  const instance = validateEvolutionInstance(rawInstance);
  const apiKey = getEvolutionApiKey(instance);
  
  if (!EVOLUTION_CONFIG.apiUrl || !apiKey || !instance) {
    console.error("❌ [Evolution] Credenciais não configuradas para envio de imagem");
    return false;
  }

  try {
    // CRITICAL FIX: Use extractNumberFromChatId to properly format number for Evolution API
    // This ensures @lid suffix for Business accounts, bare phones for regular accounts, and @g.us for groups
    const normalizedNumber = extractNumberFromChatId(phoneNumber);
    
    // Ensure URL has protocol
    let baseUrl = EVOLUTION_CONFIG.apiUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    // Remover prefixo data:image se houver
    let cleanBase64 = imageBase64;
    if (imageBase64.includes('base64,')) {
      cleanBase64 = imageBase64.split('base64,')[1];
    }
    
    const url = `${baseUrl}/message/sendMedia/${instance}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: normalizedNumber,
        mediatype: "image",
        mimetype: "image/jpeg",
        media: cleanBase64,
        caption: caption || "",
      }),
    });

    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.statusText}`);
    }

    console.log(`✅ [Evolution] Imagem enviada com sucesso para ${normalizedNumber}`);
    return true;
  } catch (error) {
    console.error("❌ [Evolution] Erro ao enviar imagem:", error);
    return false;
  }
}

// Helper function to send WhatsApp PDF/document via Evolution API
async function sendWhatsAppDocument(phoneNumber: string, pdfBase64: string, fileName?: string, caption?: string, instanceName?: string): Promise<boolean> {
  // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
  const rawInstance = instanceName || EVOLUTION_CONFIG.instance;
  const instance = validateEvolutionInstance(rawInstance);
  const apiKey = getEvolutionApiKey(instance);
  
  console.log(`🔍 [PDF Debug] sendWhatsAppDocument chamada:`, {
    phoneNumber,
    fileName,
    caption: caption?.substring(0, 50),
    instance,
    hasApiKey: !!apiKey,
    hasApiUrl: !!EVOLUTION_CONFIG.apiUrl,
    pdfBase64Length: pdfBase64?.length,
    pdfBase64Preview: pdfBase64?.substring(0, 50)
  });
  
  if (!EVOLUTION_CONFIG.apiUrl || !apiKey || !instance) {
    console.error("❌ [Evolution] Credenciais não configuradas para envio de documento");
    return false;
  }

  try {
    // CRITICAL FIX: Use extractNumberFromChatId to properly format number for Evolution API
    // This ensures @lid suffix for Business accounts, bare phones for regular accounts, and @g.us for groups
    const normalizedNumber = extractNumberFromChatId(phoneNumber);
    
    console.log(`📞 [PDF Debug] Número formatado para Evolution API: ${phoneNumber} → ${normalizedNumber}`);
    
    // Ensure URL has protocol
    let baseUrl = EVOLUTION_CONFIG.apiUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    // Remover prefixo data:application se houver
    let cleanBase64 = pdfBase64;
    if (pdfBase64.includes('base64,')) {
      cleanBase64 = pdfBase64.split('base64,')[1];
    }
    
    console.log(`🧹 [PDF Debug] Base64 limpo - tamanho: ${cleanBase64.length} caracteres`);
    
    const url = `${baseUrl}/message/sendMedia/${instance}`;
    console.log(`🌐 [PDF Debug] URL da API: ${url}`);
    
    const payload = {
      number: normalizedNumber,
      mediatype: "document",
      mimetype: "application/pdf",
      media: cleanBase64,
      fileName: fileName || "documento.pdf",
      caption: caption || "",
    };
    
    console.log(`📦 [PDF Debug] Payload (sem base64):`, {
      number: payload.number,
      mediatype: payload.mediatype,
      mimetype: payload.mimetype,
      fileName: payload.fileName,
      caption: payload.caption,
      mediaLength: payload.media.length
    });
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify(payload),
    });

    console.log(`📡 [PDF Debug] Resposta da API:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [PDF Debug] Erro da Evolution API:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Evolution API error: ${response.statusText} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log(`✅ [PDF Debug] Resposta completa da API:`, responseData);
    console.log(`✅ [Evolution] Documento PDF enviado com sucesso para ${normalizedNumber}`);
    return true;
  } catch (error) {
    console.error("❌ [Evolution] Erro ao enviar documento:", error);
    return false;
  }
}

// Helper function to send WhatsApp message via Evolution API
async function sendWhatsAppMessage(
  phoneNumber: string, 
  text: string, 
  instanceName?: string
): Promise<{ success: boolean; whatsappMessageId?: string; remoteJid?: string }> {
  // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
  const rawInstance = instanceName || EVOLUTION_CONFIG.instance;
  const instance = validateEvolutionInstance(rawInstance);
  const apiKey = getEvolutionApiKey(instance);
  
  if (!EVOLUTION_CONFIG.apiUrl || !apiKey || !instance) {
    console.error("❌ [Evolution] Credenciais não configuradas", { 
      hasUrl: !!EVOLUTION_CONFIG.apiUrl, 
      hasKey: !!apiKey, 
      instance: instance || 'undefined' 
    });
    return { success: false };
  }

  try {
    // Normalizar número do WhatsApp
    // Aceita: "5522997074180", "whatsapp_5522997074180", "5522997074180@s.whatsapp.net"
    let normalizedNumber = phoneNumber;
    
    if (phoneNumber.startsWith('whatsapp_')) {
      normalizedNumber = phoneNumber.replace('whatsapp_', '');
    } else if (phoneNumber.includes('@s.whatsapp.net')) {
      normalizedNumber = phoneNumber.split('@')[0];
    }
    
    // Ensure URL has protocol
    let baseUrl = EVOLUTION_CONFIG.apiUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    const url = `${baseUrl}/message/sendText/${instance}`;
    
    console.log(`📤 [Evolution] Enviando mensagem para ${normalizedNumber} via instância ${instance} (${url})`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: normalizedNumber,
        text: text,
        delay: 1200, // Simula digitação natural
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Evolution] Erro ao enviar mensagem (${response.status}):`, errorText);
      return { success: false };
    }

    const result = await response.json();
    console.log(`✅ [Evolution] Mensagem enviada para ${normalizedNumber} via ${instance}`, {
      messageId: result.key?.id,
      status: result.status,
    });
    return { 
      success: true,
      whatsappMessageId: result.key?.id || undefined,
      remoteJid: result.key?.remoteJid || undefined
    };
  } catch (error) {
    console.error("❌ [Evolution] Erro ao enviar mensagem:", error);
    return { success: false };
  }
}

// Helper function to delete WhatsApp message via Evolution API
async function deleteWhatsAppMessage(
  whatsappMessageId: string, 
  remoteJid: string, 
  instanceName?: string
): Promise<boolean> {
  // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
  const rawInstance = instanceName || EVOLUTION_CONFIG.instance;
  const instance = validateEvolutionInstance(rawInstance);
  const apiKey = getEvolutionApiKey(instance);
  
  if (!EVOLUTION_CONFIG.apiUrl || !apiKey || !instance) {
    console.error("❌ [Evolution] Credenciais não configuradas para deletar mensagem");
    return false;
  }

  try {
    let baseUrl = EVOLUTION_CONFIG.apiUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    const url = `${baseUrl}/chat/deleteMessageForEveryone/${instance}`;
    
    console.log(`🗑️ [Evolution] Deletando mensagem ${whatsappMessageId} via instância ${instance}`);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        id: whatsappMessageId,
        remoteJid: remoteJid,
        fromMe: true, // Mensagens enviadas pelo bot
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Evolution] Erro ao deletar mensagem (${response.status}):`, errorText);
      return false;
    }

    console.log(`✅ [Evolution] Mensagem ${whatsappMessageId} deletada com sucesso`);
    return true;
  } catch (error) {
    console.error("❌ [Evolution] Erro ao deletar mensagem:", error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ============================================================================
  // AUTHENTICATION ROUTES
  // ============================================================================

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        // 🔐 Track failed login attempt
        await trackSecurityEvent({
          type: SecurityEventType.FAILED_LOGIN,
          username,
          ipAddress: req.ip || req.headers['x-forwarded-for'] as string || undefined,
          userAgent: req.headers['user-agent'],
          timestamp: Date.now(),
          details: "Usuário não encontrado"
        });
        return res.status(401).json({ error: "Usuário ou senha inválidos" });
      }

      const isValid = await comparePasswords(password, user.password);
      if (!isValid) {
        // 🔐 Track failed login attempt
        await trackSecurityEvent({
          type: SecurityEventType.FAILED_LOGIN,
          username,
          ipAddress: req.ip || req.headers['x-forwarded-for'] as string || undefined,
          userAgent: req.headers['user-agent'],
          timestamp: Date.now(),
          details: "Senha incorreta"
        });
        return res.status(401).json({ error: "Usuário ou senha inválidos" });
      }

      // Update last login
      await storage.updateUserLastLogin(user.id);

      // 🔐 Track successful login
      await trackSecurityEvent({
        type: SecurityEventType.SUCCESSFUL_LOGIN,
        username,
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string || undefined,
        userAgent: req.headers['user-agent'],
        timestamp: Date.now(),
        details: `Login bem-sucedido: ${user.fullName}`
      });

      // 📊 Log login activity
      await storage.createActivityLog({
        userId: user.id,
        action: 'login',
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string || null,
        userAgent: req.headers['user-agent'] || null,
      });
      console.log(`✅ [Activity Log] Login registrado: ${user.fullName} (${user.id})`);

      // Generate token and set cookie
      const token = generateToken(user);
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({ user: getUserFromUser(user) });
    } catch (error) {
      console.error("❌ [Auth] Login error:", error);
      res.status(400).json({ error: "Erro ao fazer login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      
      // 📊 Calculate session duration from last login
      const lastLogin = await storage.getLastLoginLog(userId);
      let sessionDuration: number | null = null;
      
      if (lastLogin?.createdAt) {
        const now = new Date();
        sessionDuration = Math.floor((now.getTime() - lastLogin.createdAt.getTime()) / 1000); // em segundos
      }

      // 📊 Log logout activity
      await storage.createActivityLog({
        userId,
        action: 'logout',
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string || null,
        userAgent: req.headers['user-agent'] || null,
        sessionDuration,
      });
      
      const user = await storage.getUserById(userId);
      console.log(`✅ [Activity Log] Logout registrado: ${user?.fullName} (${userId}) - Duração: ${sessionDuration ? Math.floor(sessionDuration / 60) : '?'} minutos`);

      res.clearCookie("auth_token");
      res.json({ message: "Logout realizado com sucesso" });
    } catch (error) {
      console.error("❌ [Auth] Logout error:", error);
      // Still clear cookie even if logging fails
      res.clearCookie("auth_token");
      res.json({ message: "Logout realizado com sucesso" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authenticate, async (req, res) => {
    try {
      const user = await storage.getUserById(req.user!.userId);
      if (!user) {
        res.clearCookie("auth_token");
        return res.status(401).json({ error: "Usuário não encontrado" });
      }

      res.json({ user: getUserFromUser(user) });
    } catch (error) {
      console.error("❌ [Auth] Error getting current user:", error);
      res.status(500).json({ error: "Erro ao obter usuário" });
    }
  });

  // Request user registration (public)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, fullName, email } = req.body;

      // Validate required fields
      if (!username || !password || !fullName || !email) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Email inválido" });
      }

      // Validate password length
      if (password.length < 6) {
        return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
      }

      // Check if username already exists in users
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }

      // Check if there's already a pending request with this username
      const existingRequest = await storage.getRegistrationRequestByUsername(username);
      if (existingRequest && existingRequest.status === "pending") {
        return res.status(400).json({ error: "Já existe uma solicitação pendente com este usuário" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // SECURITY: Always force AGENT role for public registration requests
      // Admin/Supervisor can only be assigned by existing admins through the Users page
      const request = await storage.createRegistrationRequest({
        username,
        password: hashedPassword,
        fullName,
        email,
        requestedRole: "AGENT", // FORCED to AGENT for security
        status: "pending",
      });

      res.json({ 
        message: "Solicitação de registro enviada com sucesso",
        requestId: request.id 
      });
    } catch (error) {
      console.error("❌ [Auth] Registration request error:", error);
      res.status(400).json({ error: "Erro ao enviar solicitação de registro" });
    }
  });

  // Get all users (admin only)
  app.get("/api/users", authenticate, requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ users: users.map(getUserFromUser) });
    } catch (error) {
      console.error("❌ [Users] Error getting users:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  // Get available agents for transfer (accessible by all authenticated users)
  app.get("/api/users/available-agents", authenticate, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Retornar apenas AGENTS, SUPERVISORS e ADMINS ativos (status uppercase)
      const availableAgents = allUsers
        .filter(u => u.status === 'ACTIVE' && (u.role === 'AGENT' || u.role === 'SUPERVISOR' || u.role === 'ADMIN'))
        .map(getUserFromUser);
      res.json({ users: availableAgents });
    } catch (error) {
      console.error("❌ [Users] Error getting available agents:", error);
      res.status(500).json({ error: "Erro ao buscar agentes disponíveis" });
    }
  });

  // Get recent activity logs (admin/supervisor only)
  app.get("/api/activity-logs", authenticate, requireAnyRole("ADMIN", "SUPERVISOR"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 200;
      const logs = await storage.getRecentActivityLogs(limit);
      
      // Enriquecer logs com informações adicionais
      const enrichedLogs = await Promise.all(logs.map(async (log) => {
        const enriched: any = { ...log };
        
        // Adicionar informações da conversa (se aplicável)
        if (log.conversationId) {
          const conversation = await storage.getConversation(log.conversationId);
          if (conversation) {
            enriched.conversation = {
              id: conversation.id,
              clientName: conversation.clientName,
              chatId: conversation.chatId,
            };
          }
        }
        
        // Adicionar informações do usuário alvo (se aplicável)
        if (log.targetUserId) {
          const targetUser = await storage.getUserById(log.targetUserId);
          if (targetUser) {
            enriched.targetUser = {
              id: targetUser.id,
              fullName: targetUser.fullName,
              username: targetUser.username,
            };
          }
        }
        
        return enriched;
      }));
      
      res.json({ logs: enrichedLogs });
    } catch (error) {
      console.error("❌ [Activity Logs] Error getting logs:", error);
      res.status(500).json({ error: "Erro ao buscar logs de atividade" });
    }
  });

  // Get activity logs for a specific user
  app.get("/api/activity-logs/:userId", authenticate, async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      
      // Users can only see their own logs unless they're admin/supervisor
      if (req.user!.userId !== userId && req.user!.role !== "ADMIN" && req.user!.role !== "SUPERVISOR") {
        return res.status(403).json({ error: "Sem permissão para ver logs de outros usuários" });
      }
      
      const logs = await storage.getActivityLogsByUserId(userId, limit);
      res.json({ logs });
    } catch (error) {
      console.error("❌ [Activity Logs] Error getting user logs:", error);
      res.status(500).json({ error: "Erro ao buscar logs do usuário" });
    }
  });

  // Get active agents list (for assignment dropdown)
  app.get("/api/agents/list", authenticate, requireAdminOrSupervisor, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Filter active agents and supervisors (who can take conversations)
      const agents = allUsers
        .filter(u => u.status === "ACTIVE" && (u.role === "AGENT" || u.role === "SUPERVISOR" || u.role === "ADMIN"))
        .map(u => ({
          id: u.id,
          fullName: u.fullName,
          username: u.username,
          role: u.role,
        }));
      
      res.json({ agents });
    } catch (error) {
      console.error("❌ [Agents] Error getting agents:", error);
      res.status(500).json({ error: "Erro ao buscar atendentes" });
    }
  });

  // Create new user / Invite user (admin only)
  app.post("/api/users", authenticate, requireAdmin, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ error: "Usuário já existe" });
      }

      // Hash password
      const hashedPassword = await hashPassword(data.password);

      // Create user
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      res.json({ user: getUserFromUser(user) });
    } catch (error: any) {
      console.error("❌ [Users] Error creating user:", error);
      res.status(400).json({ error: error?.message || "Erro ao criar usuário" });
    }
  });

  // Update user (admin only)
  app.patch("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = updateUserSchema.parse(req.body);

      // If password is being updated, hash it
      if (updates.password) {
        updates.password = await hashPassword(updates.password);
      }

      const user = await storage.updateUser(id, updates);
      res.json({ user: getUserFromUser(user) });
    } catch (error: any) {
      console.error("❌ [Users] Error updating user:", error);
      res.status(400).json({ error: error?.message || "Erro ao atualizar usuário" });
    }
  });

  // Update user status (admin only)
  app.patch("/api/users/:id/status", authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({ error: "Status inválido. Use ACTIVE ou INACTIVE" });
      }

      const user = await storage.updateUserStatus(id, status);
      res.json({ user: getUserFromUser(user) });
    } catch (error) {
      console.error("❌ [Users] Error updating user status:", error);
      res.status(500).json({ error: "Erro ao atualizar status do usuário" });
    }
  });

  // Update user departments (admin/supervisor only)
  app.patch("/api/users/:id/departments", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const { departments } = req.body;

      // Validate departments array
      if (!Array.isArray(departments)) {
        return res.status(400).json({ error: "Departments deve ser um array" });
      }

      const validDepartments = ["commercial", "support", "financial", "cancellation", "general"];
      const invalidDepartments = departments.filter(d => !validDepartments.includes(d));
      
      if (invalidDepartments.length > 0) {
        return res.status(400).json({ 
          error: `Departamentos inválidos: ${invalidDepartments.join(", ")}. Use: ${validDepartments.join(", ")}` 
        });
      }

      const user = await storage.updateUser(id, { departments });
      res.json({ user: getUserFromUser(user) });
    } catch (error) {
      console.error("❌ [Users] Error updating user departments:", error);
      res.status(500).json({ error: "Erro ao atualizar departamentos do usuário" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting yourself
      if (id === req.user!.userId) {
        return res.status(400).json({ error: "Você não pode deletar sua própria conta" });
      }

      await storage.deleteUser(id);
      res.json({ message: "Usuário deletado com sucesso" });
    } catch (error) {
      console.error("❌ [Users] Error deleting user:", error);
      res.status(500).json({ error: "Erro ao deletar usuário" });
    }
  });

  // ============================================================================
  // REGISTRATION REQUESTS ROUTES
  // ============================================================================

  // Get all registration requests (admin/supervisor only)
  app.get("/api/registration-requests", authenticate, requireAdminOrSupervisor, async (_req, res) => {
    try {
      const requests = await storage.getAllRegistrationRequests();
      res.json({ requests });
    } catch (error) {
      console.error("❌ [Registration] Error getting requests:", error);
      res.status(500).json({ error: "Erro ao buscar solicitações" });
    }
  });

  // Get pending registration requests (admin/supervisor only)
  app.get("/api/registration-requests/pending", authenticate, requireAdminOrSupervisor, async (_req, res) => {
    try {
      const requests = await storage.getPendingRegistrationRequests();
      res.json({ requests });
    } catch (error) {
      console.error("❌ [Registration] Error getting pending requests:", error);
      res.status(500).json({ error: "Erro ao buscar solicitações pendentes" });
    }
  });

  // Approve registration request (admin/supervisor only)
  app.post("/api/registration-requests/:id/approve", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      // Validate role
      if (!role || !["ADMIN", "SUPERVISOR", "AGENT"].includes(role)) {
        return res.status(400).json({ error: "Função inválida. Use ADMIN, SUPERVISOR ou AGENT" });
      }
      
      // Get the registration request
      const requests = await storage.getAllRegistrationRequests();
      const request = requests.find(r => r.id === id);
      
      if (!request) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ error: "Solicitação já foi processada" });
      }

      // Create the user with the selected role
      const user = await storage.createUser({
        username: request.username,
        password: request.password, // Already hashed
        fullName: request.fullName,
        email: request.email,
        role: role, // Use the role selected by admin/supervisor
        status: "ACTIVE",
      });

      // Update registration request status
      await storage.updateRegistrationRequest(id, {
        status: "approved",
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
      });

      res.json({ 
        message: "Usuário aprovado e criado com sucesso",
        user: getUserFromUser(user) 
      });
    } catch (error: any) {
      console.error("❌ [Registration] Error approving request:", error);
      res.status(400).json({ error: error?.message || "Erro ao aprovar solicitação" });
    }
  });

  // Reject registration request (admin/supervisor only)
  app.post("/api/registration-requests/:id/reject", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Get the registration request
      const requests = await storage.getAllRegistrationRequests();
      const request = requests.find(r => r.id === id);
      
      if (!request) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ error: "Solicitação já foi processada" });
      }

      // Update registration request status
      await storage.updateRegistrationRequest(id, {
        status: "rejected",
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
        rejectionReason: reason || "Não especificado",
      });

      res.json({ message: "Solicitação rejeitada com sucesso" });
    } catch (error) {
      console.error("❌ [Registration] Error rejecting request:", error);
      res.status(400).json({ error: "Erro ao rejeitar solicitação" });
    }
  });

  // ============================================================================
  // SALES & PLANS ROUTES
  // ============================================================================

  // Get all active plans
  app.get("/api/plans", async (_req, res) => {
    try {
      const plans = await storage.getActivePlans();
      res.json({ plans });
    } catch (error) {
      console.error("❌ [Plans] Error getting plans:", error);
      res.status(500).json({ error: "Erro ao buscar planos" });
    }
  });

  // Submit site lead (from commercial assistant chat)
  app.post("/api/site-lead", async (req, res) => {
    try {
      const { insertSaleSchema } = await import("@shared/schema");
      
      // Validate request body
      const saleData = insertSaleSchema.parse({
        ...req.body,
        source: "chat", // Always mark as chat source
        status: "Aguardando Análise", // Default status
      });

      // Create sale record
      const sale = await storage.addSale(saleData);

      console.log(`✅ [Sales] Novo lead cadastrado via chat - ID: ${sale.id}, Cliente: ${sale.customerName}`);

      res.json({
        success: true,
        message: "Cadastro recebido com sucesso! Nossa equipe entrará em contato em breve.",
        leadId: sale.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ [Sales] Validation error:", error.errors);
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", "),
        });
      }

      console.error("❌ [Sales] Error creating lead:", error);
      res.status(500).json({ error: "Erro ao processar cadastro" });
    }
  });

  // ============================================================================
  // CHAT ROUTES
  // ============================================================================
  
  // Chat endpoint - Main entry point for TR Chat messages
  app.post("/api/chat/message", async (req, res) => {
    try {
      const { chatId, clientName, clientId, message, imageBase64, audioBase64, audioMimeType, forceAssistant } = req.body;

      if (!chatId || (!message && !imageBase64 && !audioBase64)) {
        return res.status(400).json({ error: "chatId and (message, imageBase64, or audioBase64) are required" });
      }
      
      // Validate forceAssistant if provided
      const validAssistants = ["apresentacao", "comercial", "suporte", "financeiro", "cancelamento", "ouvidoria"];
      if (forceAssistant && !validAssistants.includes(forceAssistant)) {
        return res.status(400).json({ error: `forceAssistant must be one of: ${validAssistants.join(', ')}` });
      }

      // Process image if provided
      let processedMessage = message || '';
      let messageImageBase64: string | undefined = undefined;
      
      if (imageBase64) {
        console.log(`📸 [Test Chat] Imagem detectada - iniciando análise com Vision...`);
        const { analyzeImageWithVision } = await import("./lib/vision");
        
        let customPrompt = 'Analise esta imagem em detalhes e extraia todas as informações relevantes.';
        if (message) {
          customPrompt += ` O cliente enviou esta imagem com a legenda: "${message}". Leve isso em consideração na análise.`;
        }
        customPrompt += ' Se for um boleto, extraia: identificador, vencimento, expiração, juros, valor original e multa. Se for um documento (RG, CNH, comprovante), extraia todos os dados visíveis incluindo CPF/CNPJ. Se for um print de tela ou conversa, transcreva o conteúdo. Se for uma foto de equipamento ou problema técnico, descreva o que vê.';
        
        const analysis = await analyzeImageWithVision(imageBase64, customPrompt);
        
        if (analysis) {
          processedMessage = message
            ? `[Imagem analisada]\nLegenda: ${message}\n\nAnálise da imagem:\n${analysis}`
            : `[Imagem analisada]\n\n${analysis}`;
          console.log(`✅ [Test Chat] Imagem processada com sucesso`);
        } else {
          processedMessage = message || '[Imagem recebida - análise não disponível]';
          console.log(`⚠️ [Test Chat] Falha na análise da imagem`);
        }
        
        // Store base64 for display (remove data URI prefix if present)
        messageImageBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
      }
      
      // Process audio if provided
      if (audioBase64) {
        console.log(`🎤 [Test Chat] Áudio detectado - iniciando transcrição com Whisper...`);
        const { transcribeAudio } = await import("./lib/audio");
        
        // Remove data URI prefix if present
        const cleanAudioBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
        
        const transcription = await transcribeAudio(cleanAudioBase64, audioMimeType);
        
        if (transcription) {
          processedMessage = message
            ? `[Áudio enviado]\n${message}\n\n🎤 Transcrição automática:\n${transcription}`
            : `[Áudio enviado]\n\n🎤 Transcrição automática:\n${transcription}`;
          console.log(`✅ [Test Chat] Áudio transcrito com sucesso`);
        } else {
          processedMessage = message || '[Áudio recebido - transcrição não disponível]';
          console.log(`⚠️ [Test Chat] Falha na transcrição do áudio`);
        }
      }

      // Get or create conversation
      let conversation = await storage.getConversationByChatId(chatId);
      let threadId = await getConversationThread(chatId);

      if (!conversation) {
        // New conversation - inicia com assistente forçado ou Recepcionista (padrão)
        const initialAssistant = forceAssistant || "apresentacao";
        console.log(`🎭 [New Conversation] Iniciando com ${initialAssistant} para ${clientName}${forceAssistant ? ' (FORÇADO)' : ''}`);
        
        // Create thread
        threadId = await createThread();
        await storeConversationThread(chatId, threadId);

        // Get assistant ID for the chosen assistant
        const { ASSISTANT_IDS, ASSISTANT_TO_DEPARTMENT } = await import("./lib/openai");
        const chosenAssistantId = ASSISTANT_IDS[initialAssistant as keyof typeof ASSISTANT_IDS];
        const department = ASSISTANT_TO_DEPARTMENT[initialAssistant] || "general";

        // Create conversation record with chosen assistant
        conversation = await storage.createConversation({
          chatId,
          clientName: clientName || "Cliente",
          clientId,
          threadId,
          assistantType: initialAssistant,  // Usa assistente forçado ou recepcionista
          department, // Departamento baseado no assistente
          status: "active",
          sentiment: "neutral",
          urgency: "normal",
          duration: 0,
          lastMessage: message,
          metadata: { 
            routing: {
              assistantType: initialAssistant,
              assistantId: chosenAssistantId,
              confidence: forceAssistant ? 1.0 : 1.0
            }
          },
        });

        // Auto-create/update contact
        try {
          const phoneNumber = clientId || chatId.split('@')[0];
          await storage.updateContactFromConversation(phoneNumber, conversation.id, {
            name: clientName || undefined,
          });
          console.log(`📇 [Contacts] Created/updated contact for ${phoneNumber}`);
        } catch (error) {
          console.error(`❌ [Contacts] Error creating/updating contact:`, error);
        }
      } else if (!threadId) {
        // Existing conversation but no thread - create one
        threadId = await createThread();
        await storeConversationThread(chatId, threadId);
        
        // Update conversation with threadId
        await storage.updateConversation(conversation.id, {
          threadId,
        });
      } else if (conversation.status === 'resolved') {
        // Reopen resolved conversation and reset to Apresentacao (fresh start)
        console.log(`🔄 [Reopen] Reabrindo conversa finalizada: ${chatId} - Resetando para Apresentação`);
        
        const updateData: any = {
          status: 'active',
          assistantType: 'apresentacao', // SEMPRE volta para apresentação em nova conversa
        };
        
        // Se estava transferida, resetar para IA voltar a responder
        if (conversation.transferredToHuman) {
          console.log(`🤖 [Reopen] Resetando transferência - IA volta a responder`);
          updateData.transferredToHuman = false;
          updateData.transferReason = null;
          updateData.transferredAt = null;
        }
        
        await storage.updateConversation(conversation.id, updateData);
        // Update local object
        Object.assign(conversation, updateData);

        // Auto-update contact on conversation reopen
        try {
          const phoneNumber = conversation.clientId || chatId.split('@')[0];
          await storage.updateContactFromConversation(phoneNumber, conversation.id, {
            name: conversation.clientName || undefined,
            document: conversation.clientDocument || undefined,
          });
          console.log(`📇 [Contacts] Updated contact on reopen for ${phoneNumber}`);
        } catch (error) {
          console.error(`❌ [Contacts] Error updating contact on reopen:`, error);
        }
      }

      // 🧠 ANÁLISE DE INTELIGÊNCIA: Sentiment, Urgência e Problemas Técnicos
      const { 
        analyzeSentiment, 
        analyzeUrgency, 
        detectTechnicalProblem,
        checkRecurrence,
        updateConversationIntelligence,
        persistClientDocument 
      } = await import("./lib/conversation-intelligence");
      
      // 🔍 Detect and store CPF/CNPJ if present in PROCESSED message (covers image/audio transcriptions)
      if (!conversation.clientDocument) {
        // Try processedMessage first (includes image/audio analysis), then fallback to raw message
        const textToScan = processedMessage || message || '';
        const cpfMatch = textToScan.match(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/);
        const cnpjMatch = textToScan.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
        const documentMatch = cpfMatch || cnpjMatch;
        
        if (documentMatch) {
          const cleanDocument = documentMatch[1].replace(/[.\-\/]/g, '');
          await persistClientDocument(conversation.id, cleanDocument);
          conversation.clientDocument = cleanDocument;
          console.log(`📝 [Test Chat] CPF/CNPJ detectado e persistido`);
        }
      }
      
      const sentimentAnalysis = analyzeSentiment(processedMessage);
      const urgencyAnalysis = analyzeUrgency(processedMessage);
      const problemAnalysis = detectTechnicalProblem(processedMessage);
      
      let recurrenceAnalysis = null;
      if (problemAnalysis.detected && conversation.clientDocument) {
        recurrenceAnalysis = await checkRecurrence(
          conversation.clientDocument,
          problemAnalysis.problemType || 'tecnico',
          30
        );
      }
      
      // Atualizar metadata com inteligência - SEMPRE atualiza (não só negative/high)
      const intelligenceUpdates: any = {
        sentiment: sentimentAnalysis.sentiment,
        urgency: urgencyAnalysis.urgency,
      };
      
      if (problemAnalysis.detected) {
        intelligenceUpdates.problemaDetectado = {
          type: problemAnalysis.problemType,
          keywords: problemAnalysis.keywords,
          detectedAt: new Date().toISOString()
        };
      }
      
      if (recurrenceAnalysis?.isRecurrent) {
        intelligenceUpdates.recorrencia = {
          isRecurrent: true,
          occurrences: recurrenceAnalysis.previousOccurrences,
          lastOccurrence: recurrenceAnalysis.lastOccurrence,
          details: recurrenceAnalysis.details
        };
      }
      
      await updateConversationIntelligence(conversation.id, intelligenceUpdates);
      console.log(`🧠 [Test Chat Intelligence] Sentiment: ${sentimentAnalysis.sentiment}, Urgency: ${urgencyAnalysis.urgency}`);
      
      // Use valores da análise real
      const sentiment = sentimentAnalysis.sentiment;
      const urgency = urgencyAnalysis.urgency;

      // Store user message
      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: processedMessage,
        assistant: null,
        imageBase64: messageImageBase64,
      });

      // Send message and get response
      if (!threadId) {
        console.error("❌ No threadId available for conversation:", { chatId, conversationId: conversation.id });
        return res.status(500).json({ error: "Thread ID not found" });
      }

      const assistantId = (conversation.metadata as any)?.routing?.assistantId;
      const result = await sendMessageAndGetResponse(threadId, assistantId, processedMessage, chatId, conversation.id);

      // Store assistant response (ensure it's always a string)
      const responseText = typeof result.response === 'string' 
        ? result.response 
        : ((result.response as any)?.response || JSON.stringify(result.response));
      
      // ⚠️ VALIDAÇÃO ANTI-MENTIRA: Detectar quando assistente diz que vai rotear mas não executa a função
      if (conversation.assistantType === "apresentacao" && !result.transferred) {
        // Normalizar resposta: remover acentos, pontuação e converter para minúsculas
        const normalizeText = (text: string) => {
          return text
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .replace(/[^\w\s]/g, " ") // Remove pontuação
            .replace(/\s+/g, " ") // Normaliza espaços
            .trim();
        };
        
        const normalizedResponse = normalizeText(responseText);
        
        // Lista expandida incluindo todas as variantes verbais possíveis
        const routingKeywords = [
          // 🚨 CRÍTICO: Detectar quando assistente escreve o código da função ao invés de executar
          "executo rotear", "executo transferir", "executo finalizar", 
          "executo abrir_ticket", "executo consultar",
          // Presente
          "encaminhando", "transferindo", "passando", "direcionando", "roteando",
          // Futuro
          "vou encaminhar", "vou transferir", "vou rotear", "vou passar", "vou direcionar",
          "irei encaminhar", "irei transferir", "irei passar", "vou direciona lo",
          "encaminharei", "transferirei", "passarei", "direcionarei",
          // Progressivo
          "estou encaminhando", "estou transferindo", "estou passando",
          // Passado (mais comum em respostas falsas!)
          "encaminhei", "transferi", "passei", "direcionei", "roteei",
          "ja encaminhei", "ja transferi", "ja passei", "acabei de encaminhar",
          // Variantes informais
          "vou passar pra", "vou mandar pra", "passando pra",
          "mandando pra", "transferindo pra", "encaminhando pra",
          "direciono agora", "passo agora", "transf erindo",
        ];
        
        const matchedKeyword = routingKeywords.find(keyword => normalizedResponse.includes(keyword));
        const isFakeRouting = !!matchedKeyword;
        
        // Log de telemetria para frases suspeitas mesmo se não houver match exato
        const suspiciousPatterns = ["para o", "pro ", "pra ", "suporte", "financeiro", "comercial", "atendimento"];
        const hasSuspiciousPattern = suspiciousPatterns.some(p => normalizedResponse.includes(p));
        
        if (!isFakeRouting && hasSuspiciousPattern && normalizedResponse.length > 50) {
          console.warn(`⚠️ [ANTI-MENTIRA] Frase suspeita NÃO detectada (pode ser nova variante):`);
          console.warn(`⚠️ [ANTI-MENTIRA] "${responseText.substring(0, 150)}"`);
        }
        
        if (isFakeRouting) {
          console.error("🚨 [ANTI-MENTIRA] CRÍTICO: Apresentação disse que ia rotear mas NÃO chamou a função!");
          console.error(`🚨 [ANTI-MENTIRA] Conversa: ${conversation.id}, Cliente: ${conversation.clientName}`);
          console.error(`🚨 [ANTI-MENTIRA] Keyword detectada: "${matchedKeyword}"`);
          console.error(`🚨 [ANTI-MENTIRA] Resposta: ${responseText.substring(0, 200)}`);
          console.error(`🚨 [ANTI-MENTIRA] result.transferred: ${result.transferred}`);
          
          // Detectar para qual assistente deveria ter roteado baseado em múltiplas fontes
          let targetAssistant = "suporte"; // fallback padrão
          
          // 1º: Verificar se já existe um problema detectado no metadata
          const metadata = conversation.metadata as any;
          if (metadata?.problemaDetectado?.type) {
            const problemType = metadata.problemaDetectado.type;
            const problemTypeMap: Record<string, string> = {
              "conectividade": "suporte",
              "velocidade": "suporte",
              "técnico": "suporte",
              "financeiro": "financeiro",
              "pagamento": "financeiro",
              "comercial": "comercial",
              "venda": "comercial",
            };
            
            if (problemTypeMap[problemType]) {
              targetAssistant = problemTypeMap[problemType];
              console.log(`🎯 [ANTI-MENTIRA] Usando problema detectado do metadata: ${problemType} → ${targetAssistant}`);
            }
          }
          
          // 2º: Se não há metadata, usar keywords da mensagem do cliente E do histórico recente
          if (targetAssistant === "suporte") {
            const problemKeywords = {
              suporte: ["internet", "conexão", "lento", "oscilando", "caiu", "não funciona", "problema técnico", "travando", "sem sinal"],
              financeiro: ["boleto", "pagamento", "fatura", "cobrança", "vencimento", "pagar", "segunda via", "comprovante"],
              comercial: ["contratar", "plano", "upgrade", "mudança de plano", "novo plano", "quanto custa", "assinar"],
            };
            
            const lastMessage = processedMessage.toLowerCase();
            const previousMessage = conversation.lastMessage?.toLowerCase() || "";
            const combinedContext = `${lastMessage} ${previousMessage}`;
            
            for (const [assistant, keywords] of Object.entries(problemKeywords)) {
              if (keywords.some(kw => combinedContext.includes(kw))) {
                targetAssistant = assistant;
                console.log(`🎯 [ANTI-MENTIRA] Detectado por keywords: ${keywords.find(kw => combinedContext.includes(kw))} → ${targetAssistant}`);
                break;
              }
            }
          }
          
          console.log(`🔧 [ANTI-MENTIRA] Forçando roteamento manual para: ${targetAssistant}`);
          
          // Forçar o roteamento manualmente
          const { ASSISTANT_IDS, ASSISTANT_TO_DEPARTMENT } = await import("./lib/openai");
          const newAssistantId = ASSISTANT_IDS[targetAssistant as keyof typeof ASSISTANT_IDS];
          const newDepartment = ASSISTANT_TO_DEPARTMENT[targetAssistant] || "general";
          
          const updatedMetadata = {
            ...(typeof conversation.metadata === 'object' && conversation.metadata !== null ? conversation.metadata : {}),
            routing: {
              assistantType: targetAssistant,
              assistantId: newAssistantId,
              confidence: 1.0,
              routedBy: "anti_mentira_system",
              routedAt: new Date().toISOString(),
              originalResponse: responseText, // Salvar resposta problemática
            },
          };
          
          await storage.updateConversation(conversation.id, {
            assistantType: targetAssistant,
            department: newDepartment,
            lastMessage: message,
            lastMessageTime: new Date(),
            duration: (conversation.duration || 0) + 30,
            sentiment,
            urgency,
            metadata: updatedMetadata,
          });
          
          // Criar ação de supervisor para rastreamento
          await storage.createSupervisorAction({
            conversationId: conversation.id,
            action: "note",
            notes: `⚠️ ANTI-MENTIRA: Sistema detectou resposta falsa e forçou roteamento para ${targetAssistant}`,
            createdBy: "Sistema Anti-Mentira",
          });
          
          console.log(`✅ [ANTI-MENTIRA] Roteamento forçado aplicado para ${targetAssistant}`);
          
          // Marcar como transferred para que o fluxo normal continue
          result.transferred = true;
          result.transferredTo = targetAssistant;
        }
      }
      
      await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: responseText,
        assistant: conversation.assistantType,
      });

      // Check if AI requested conversation resolution
      if (result.resolved) {
        console.log("✅ [AI Resolve] Processando finalização automática pela IA");
        
        // Create supervisor action
        await storage.createSupervisorAction({
          conversationId: conversation.id,
          action: "resolve",
          notes: `Finalização automática pela IA: ${result.resolveReason || 'Problema resolvido'}`,
          createdBy: "IA Assistant",
        });

        // ✅ BUG FIX: Usar método transacional atômico
        const existingMetadata = typeof conversation.metadata === 'object' && conversation.metadata !== null 
          ? conversation.metadata 
          : {};
          
        await storage.resolveConversation({
          conversationId: conversation.id,
          resolvedBy: null, // IA não tem userId, então usar null
          resolvedAt: new Date(),
          createActivityLog: false, // IA não cria activity log
          metadata: {
            ...existingMetadata,
            awaitingNPS: true,
            resolvedByAI: true, // Flag indicando que foi a IA que finalizou
            resolveReason: result.resolveReason || 'Problema resolvido',
          },
          additionalUpdates: {
            lastMessage: message,
            lastMessageTime: new Date(),
            duration: (conversation.duration || 0) + 30,
            sentiment,
            urgency,
          },
        });

        console.log(`✅ [AI Resolve] Conversa ${conversation.id} marcada como resolvida, enviando NPS...`);

        // Buscar template de NPS survey
        const npsTemplate = await storage.getMessageTemplateByKey('nps_survey');
        let npsSurveyMessage = npsTemplate?.template || 
          `Olá ${conversation.clientName}!\n\nSeu atendimento foi finalizado.\n\nPesquisa de Satisfação\n\nEm uma escala de 0 a 10, qual a satisfação com atendimento?\n\nDigite um número de 0 (muito insatisfeito) a 10 (muito satisfeito)`;
        
        // Substituir variáveis no template
        npsSurveyMessage = npsSurveyMessage.replace(/{clientName}/g, conversation.clientName || 'Cliente');
        
        try {
          const result = await sendWhatsAppMessage(chatId, npsSurveyMessage, conversation.evolutionInstance || undefined);
          if (result.success) {
            console.log(`📊 [NPS] Pesquisa enviada ao cliente ${clientName}`);
          }
        } catch (error) {
          console.error("❌ [NPS] Erro ao enviar pesquisa:", error);
        }

        return res.json({
          success: true,
          response: responseText,
          assistantType: conversation.assistantType,
          chatId,
          resolved: true,
          npsSent: true,
        });
      }

      // Check if AI requested transfer
      if (result.transferred) {
        console.log("🔀 [Transfer] Processando transferência automática da IA");
        
        // SPECIAL CASE: Se é a RECEPCIONISTA transferindo, rotear para assistente especializado
        if (conversation.assistantType === "apresentacao") {
          console.log("🎭 [Receptionist Routing] Recepcionista está roteando para assistente especializado");
          
          // Map department to assistant type
          const departmentMap: Record<string, string> = {
            "Suporte Técnico": "suporte",
            "Suporte": "suporte",
            "Técnico": "suporte",
            "Comercial": "comercial",
            "Vendas": "comercial",
            "Financeiro": "financeiro",
            "Finanças": "financeiro",
            "Pagamento": "financeiro",
            "Ouvidoria": "ouvidoria",
            "SAC": "ouvidoria",
            "Cancelamento": "cancelamento",
            "Cancelar": "cancelamento",
          };
          
          // Find matching assistant type
          const transferredTo = result.transferredTo || "";
          let newAssistantType = "suporte"; // fallback
          
          for (const [dept, type] of Object.entries(departmentMap)) {
            if (transferredTo.toLowerCase().includes(dept.toLowerCase())) {
              newAssistantType = type;
              break;
            }
          }
          
          const { ASSISTANT_IDS, ASSISTANT_TO_DEPARTMENT } = await import("./lib/openai");
          const newAssistantId = ASSISTANT_IDS[newAssistantType as keyof typeof ASSISTANT_IDS];
          const newDepartment = ASSISTANT_TO_DEPARTMENT[newAssistantType] || "general";
          
          console.log(`🔄 [Routing] Trocando de 'apresentacao' para '${newAssistantType}' (${newAssistantId}) - Departamento: ${newDepartment}`);
          
          // Update conversation to use new assistant
          const updatedMetadata = {
            ...(typeof conversation.metadata === 'object' && conversation.metadata !== null ? conversation.metadata : {}),
            routing: {
              assistantType: newAssistantType,
              assistantId: newAssistantId,
              confidence: 1.0,
              routedBy: "recepcionista",
              routedAt: new Date().toISOString(),
            },
          };
          
          await storage.updateConversation(conversation.id, {
            assistantType: newAssistantType,
            department: newDepartment, // Atualiza departamento baseado no assistente
            lastMessage: message,
            lastMessageTime: new Date(),
            duration: (conversation.duration || 0) + 30,
            sentiment,
            urgency,
            metadata: updatedMetadata,
          });
          
          // Create supervisor action for tracking
          await storage.createSupervisorAction({
            conversationId: conversation.id,
            action: "note",
            notes: `Recepcionista roteou para ${newAssistantType}`,
            createdBy: "Sistema",
          });
          
          console.log(`✅ [Routing Complete] Conversa agora será atendida por ${newAssistantType}`);
          
          // Generate welcome message from the new specialized assistant
          console.log(`👋 [Welcome Message] Gerando mensagem de boas-vindas do ${newAssistantType}...`);
          
          try {
            // Send a context message to the new assistant to generate welcome
            const welcomePrompt = `[CONTEXTO INTERNO: Cliente foi encaminhado pela recepcionista]

IMPORTANTE: Você deve RESPONDER ao cliente (não repetir ou parafrasear o que ele disse). Apresente-se brevemente como o assistente especializado responsável e mostre que está pronto para ajudar com a solicitação dele.`;
            
            const welcomeResult = await sendMessageAndGetResponse(
              threadId!,
              newAssistantId,
              welcomePrompt,
              chatId,
              conversation.id
            );
            
            const welcomeMessage = typeof welcomeResult.response === 'string' 
              ? welcomeResult.response 
              : ((welcomeResult.response as any)?.response || 'Olá! Estou aqui para ajudar.');
            
            // Store the welcome message
            await storage.createMessage({
              conversationId: conversation.id,
              role: "assistant",
              content: welcomeMessage,
              assistant: newAssistantType,
            });
            
            console.log(`✅ [Welcome Message] Mensagem gerada: ${welcomeMessage.substring(0, 100)}...`);
            
            return res.json({
              success: true,
              response: `${responseText}\n\n${welcomeMessage}`,
              assistantType: newAssistantType,
              chatId,
              routed: true,
              routedTo: newAssistantType,
            });
          } catch (error) {
            console.error(`❌ [Welcome Message] Erro ao gerar mensagem:`, error);
            
            // Fallback: return just the receptionist message
            return res.json({
              success: true,
              response: responseText,
              assistantType: newAssistantType,
              chatId,
              routed: true,
              routedTo: newAssistantType,
            });
          }
        }
        
        // NORMAL CASE: Other assistants transferring to human supervisors
        // Create supervisor action
        await storage.createSupervisorAction({
          conversationId: conversation.id,
          action: "transfer",
          notes: `Transferência automática pela IA para ${result.transferredTo}`,
          createdBy: "IA Assistant",
        });

        // Update conversation with transfer fields (for Conversas tab)
        await storage.updateConversation(conversation.id, {
          lastMessage: message,
          lastMessageTime: new Date(),
          duration: (conversation.duration || 0) + 30,
          sentiment,
          urgency,
          transferredToHuman: true,
          transferReason: `Transferência automática pela IA para ${result.transferredTo}`,
          transferredAt: new Date(),
          metadata: {
            ...(typeof conversation.metadata === 'object' && conversation.metadata !== null ? conversation.metadata : {}),
            transferred: true,
            transferredTo: result.transferredTo,
            transferredAt: new Date().toISOString(),
            transferNotes: "Transferência automática pela IA",
          },
        });

        // 🆕 ENVIAR MENSAGEM DE BOAS-VINDAS DO AGENTE HUMANO
        const metadata = conversation.metadata as any;
        if (metadata?.source === 'evolution_api' && conversation.clientId) {
          try {
            // Buscar template de boas-vindas de transferência
            const welcomeTemplate = await storage.getMessageTemplateByKey('agent_welcome');
            const departmentName = result.transferredTo || 'nossa equipe';
            
            let welcomeMessage = welcomeTemplate?.template || 
              `Olá! Sou da equipe de ${departmentName} da TR Telecom. Vi que você precisa de ajuda e já estou cuidando do seu atendimento.`;
            
            // Substituir variáveis
            welcomeMessage = welcomeMessage
              .replace(/{clientName}/g, conversation.clientName)
              .replace(/{departmentName}/g, departmentName);
            
            // 🆕 SOLICITAR CPF SE NÃO ESTIVER NO BANCO
            if (!conversation.clientDocument) {
              welcomeMessage += `\n\nPara que eu possa te ajudar da melhor forma, por favor, me informe seu CPF ou CNPJ.`;
              console.log(`📋 [Transfer Welcome] Solicitando CPF para ${conversation.clientName} (não cadastrado)`);
            } else {
              welcomeMessage += ` Como posso ajudar? 😊`;
              console.log(`📋 [Transfer Welcome] CPF já cadastrado para ${conversation.clientName}`);
            }
            
            // Enviar via WhatsApp
            const sent = await sendWhatsAppMessage(
              conversation.clientId, 
              welcomeMessage, 
              conversation.evolutionInstance || undefined
            );
            
            if (sent) {
              console.log(`✅ [Transfer Welcome] Mensagem de boas-vindas enviada para ${conversation.clientName}`);
              
              // Salvar mensagem no histórico
              await storage.createMessage({
                conversationId: conversation.id,
                role: "assistant",
                content: welcomeMessage,
                assistant: "Agente Humano",
              });
            }
          } catch (error) {
            console.error(`❌ [Transfer Welcome] Erro ao enviar boas-vindas:`, error);
            // Não bloqueia a transferência se falhar
          }
        }

        return res.json({
          success: true,
          response: responseText,
          assistantType: conversation.assistantType,
          chatId,
          transferred: true,
          transferredTo: result.transferredTo,
        });
      }

      // Normal update without transfer or resolve
      await storage.updateConversation(conversation.id, {
        lastMessage: message,
        lastMessageTime: new Date(),
        duration: (conversation.duration || 0) + 30,
        sentiment,
        urgency,
      });

      // Gerar resumo de forma assíncrona (não bloqueia a resposta)
      const conversationId = conversation.id;
      setImmediate(async () => {
        try {
          const allMessages = await storage.getMessagesByConversationId(conversationId);
          const messageCount = allMessages.length;
          const lastSummaryCount = conversation.messageCountAtLastSummary || 0;
          const messagesSinceLastSummary = messageCount - lastSummaryCount;
          
          if (messagesSinceLastSummary >= CONTEXT_CONFIG.SUMMARIZE_EVERY && messageCount > CONTEXT_CONFIG.SUMMARIZE_EVERY) {
            console.log(`📝 [Auto-Summary] Iniciando resumo em background (${messageCount} mensagens totais)`);
            
            const messagesToSummarize = allMessages.slice(lastSummaryCount, Math.max(lastSummaryCount, messageCount - CONTEXT_CONFIG.KEEP_RECENT));
            
            if (messagesToSummarize.length > 0) {
              const summaryInput = messagesToSummarize.map((m: any) => ({
                role: m.role,
                content: m.content
              }));
              
              const newSummary = await summarizeConversation(summaryInput);
              
              let finalSummary = newSummary;
              if (conversation.conversationSummary) {
                try {
                  const oldSummary = JSON.parse(conversation.conversationSummary);
                  const newSummaryObj = JSON.parse(newSummary);
                  
                  // Função auxiliar para deduplicar arrays
                  const deduplicateArray = (arr: string[]) => Array.from(new Set(arr));
                  
                  // Mesclar TODOS os campos acumulando contexto corretamente
                  const merged = {
                    // Substituir por resumo mais recente (é um resumo, não histórico)
                    summary: newSummaryObj.summary || oldSummary.summary || '',
                    
                    // Mesclar fatos-chave (novos sobrescrevem, mas mantém únicos)
                    keyFacts: {
                      ...(oldSummary.keyFacts || {}),
                      ...(newSummaryObj.keyFacts || {})
                    },
                    
                    // Sentimento mais recente
                    sentiment: newSummaryObj.sentiment || oldSummary.sentiment || 'neutral',
                    
                    // Acumula assistentes (sem duplicatas)
                    assistantHistory: deduplicateArray([
                      ...(oldSummary.assistantHistory || []),
                      ...(newSummaryObj.assistantHistory || [])
                    ]),
                    
                    // Acumula ações realizadas (SEM duplicatas)
                    actionsTaken: deduplicateArray([
                      ...(oldSummary.actionsTaken || []),
                      ...(newSummaryObj.actionsTaken || [])
                    ]),
                    
                    // Combinar ações pendentes (union de ambas, SEM duplicatas)
                    pendingActions: deduplicateArray([
                      ...(oldSummary.pendingActions || []),
                      ...(newSummaryObj.pendingActions || [])
                    ]),
                    
                    // Acumula datas importantes (sem duplicatas)
                    importantDates: deduplicateArray([
                      ...(oldSummary.importantDates || []),
                      ...(newSummaryObj.importantDates || [])
                    ])
                  };
                  
                  finalSummary = JSON.stringify(merged);
                } catch (e) {
                  console.error("❌ Erro ao mesclar resumos:", e);
                }
              }
              
              await storage.updateConversation(conversationId, {
                conversationSummary: finalSummary,
                lastSummarizedAt: new Date(),
                // CRÍTICO: marcar até onde resumimos (não incluindo KEEP_RECENT)
                // para que as mensagens "mantidas intactas" sejam resumidas no próximo ciclo
                // Edge case: garantir que não seja negativo
                messageCountAtLastSummary: Math.max(0, messageCount - CONTEXT_CONFIG.KEEP_RECENT),
              });
              
              console.log(`✅ [Auto-Summary] Resumo concluído (${messageCount} msgs resumidas)`);
            }
          }
        } catch (error) {
          console.error("❌ [Auto-Summary] Erro ao gerar resumo:", error);
        }
      });

      return res.json({
        success: true,
        response: responseText,
        userMessage: processedMessage, // Include processed message for frontend display
        assistantType: conversation.assistantType,
        chatId,
      });
    } catch (error) {
      console.error("Chat error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== EVOLUTION API WEBHOOKS ====================
  
  // 🔍 DEBUG ENDPOINT - Captura webhooks brutos
  app.post("/api/webhooks/evolution/debug", async (req, res) => {
    const timestamp = new Date().toISOString();
    const debugInfo = {
      timestamp,
      headers: req.headers,
      body: req.body,
      bodySize: JSON.stringify(req.body).length,
      hasAudioMessage: JSON.stringify(req.body).includes('audioMessage'),
      hasImageMessage: JSON.stringify(req.body).includes('imageMessage'),
      hasVideoMessage: JSON.stringify(req.body).includes('videoMessage'),
      event: req.body.event,
      instance: req.body.instance,
      messageType: req.body.data?.message ? Object.keys(req.body.data.message)[0] : 'none'
    };
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 [DEBUG WEBHOOK] ${timestamp}`);
    console.log(`${'='.repeat(80)}`);
    console.log(JSON.stringify(debugInfo, null, 2));
    console.log(`\n📦 PAYLOAD COMPLETO:`);
    console.log(JSON.stringify(req.body, null, 2));
    console.log(`${'='.repeat(80)}\n`);
    
    return res.json({ 
      success: true, 
      debug: true,
      info: debugInfo 
    });
  });
  
  // Webhook endpoint for Evolution API events
  app.post("/api/webhooks/evolution", async (req, res) => {
    const { prodLogger, logWebhookEvent } = await import("./lib/production-logger");
    
    // ⏸️ WEBHOOK PAUSE SYSTEM - Set WEBHOOK_PAUSED=true to temporarily stop processing
    if (process.env.WEBHOOK_PAUSED === 'true') {
      console.log(`⏸️  [Evolution] Webhook pausado - ignorando evento`);
      return res.json({ 
        success: true, 
        processed: false, 
        reason: "webhook_paused",
        message: "Webhook temporariamente pausado" 
      });
    }
    
    try {
      const { event: rawEvent, instance: rawInstance, data } = req.body;
      
      // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
      const instance = validateEvolutionInstance(rawInstance);

      // DEBUG: Log completo do payload recebido
      console.log(`🔍 [Evolution DEBUG] Payload completo:`, JSON.stringify(req.body, null, 2));

      // Normalize event to string (handle malformed payloads)
      let event = typeof rawEvent === 'string' ? rawEvent : '';

      if (!event) {
        prodLogger.warn('webhook', 'Webhook recebido sem tipo de evento válido', {
          instance,
          receivedEventType: typeof rawEvent,
          hasData: !!data,
        });
        webhookLogger.warning('INVALID_EVENT', 'Webhook recebido sem tipo de evento válido', { 
          instance,
          receivedEventType: typeof rawEvent,
          hasData: !!data,
          fullPayload: req.body
        });
        console.log(`⚠️  [Evolution] Webhook recebido com evento inválido:`, { rawEvent, instance });
        return res.json({ success: true, processed: false, reason: "invalid_event_type" });
      }
      
      // 🔧 CRITICAL FIX: Normalize event format
      // Evolution API sends "MESSAGES_UPDATE" (uppercase with underscore)
      // But code checks for "messages.update" (lowercase with dot)
      // Convert: MESSAGES_UPDATE → messages.update
      const normalizedEvent = event.toLowerCase().replace(/_/g, '.');
      const originalEvent = event;
      event = normalizedEvent;
      
      // Debug log for unknown events
      if (!['messages.upsert', 'messages.update', 'messages.delete', 'messages.set', 
            'chats.update', 'chats.upsert', 'contacts.update', 'contacts.upsert',
            'connection.update', 'qrcode.updated', 'send.message',
            'group.participants.update', 'group.update', 'groups.upsert'].includes(event)) {
        console.log(`⚠️  [Evolution] Evento desconhecido recebido:`, { 
          original: originalEvent, 
          normalized: event,
          instance,
          availableHandlers: ['messages.upsert', 'messages.update', 'chats.*', 'contacts.*']
        });
      }
      
      // Log evento recebido
      prodLogger.info('webhook', `Webhook event: ${event}`, { instance, event });

      webhookLogger.info('CONNECTION', `Webhook recebido: ${event}`, {
        instance,
        timestamp: new Date().toISOString(),
      });

      console.log(`📱 [Evolution Webhook] Evento recebido: ${event}`, {
        instance,
        event,
      });

      // Process MESSAGES_UPSERT event (new messages from WhatsApp)
      if (event === "messages.upsert") {
        const { key, pushName, message, messageTimestamp } = data;
        const { remoteJid, fromMe, id: messageId } = key;

        // 📊 LATENCY TRACKING: Início do pipeline
        const { createLatencyTracker, addCheckpoint, saveTrackerSnapshot } = await import("./lib/latency-tracker");
        const latencyTracker = createLatencyTracker(messageId);
        addCheckpoint(latencyTracker, 'webhook_received', { instance, remoteJid });
        
        // Ignore messages sent by us
        if (fromMe) {
          webhookLogger.info('MESSAGE_IGNORED', 'Mensagem enviada por nós - ignorada');
          console.log(`⏭️  [Evolution] Ignorando mensagem enviada por nós`);
          return res.json({ success: true, processed: false, reason: "fromMe" });
        }

        // DEBUG: Log complete message structure (ENHANCED FOR LOCATION DEBUGGING)
        console.log(`🔍 [DEBUG Webhook] Estrutura completa da mensagem:`, {
          messageType: data?.messageType, // Evolution API sends this field
          messageKeys: Object.keys(message || {}),
          hasImageMessage: !!message?.imageMessage,
          hasVideoMessage: !!message?.videoMessage,
          hasAudioMessage: !!message?.audioMessage,
          hasDocumentMessage: !!message?.documentMessage,
          hasLocationMessage: !!message?.locationMessage,
          hasContactMessage: !!message?.contactMessage,
          hasStickerMessage: !!message?.stickerMessage,
          hasConversation: !!message?.conversation,
          hasExtendedText: !!message?.extendedTextMessage,
          hasMediaUrl: !!data?.message?.mediaUrl,
          // LOCATION DEBUGGING: Check all known location payload structures
          hasMessageStubParameters: !!message?.messageStubParameters,
          hasTemplateButtonReply: !!message?.templateButtonReplyMessage,
          hasExtendedContextInfo: !!message?.extendedTextMessage?.contextInfo,
          messageStubParametersPreview: message?.messageStubParameters ? JSON.stringify(message.messageStubParameters).substring(0, 200) : null,
          templateButtonPreview: message?.templateButtonReplyMessage ? JSON.stringify(message.templateButtonReplyMessage).substring(0, 200) : null,
          extendedContextPreview: message?.extendedTextMessage?.contextInfo ? JSON.stringify(message.extendedTextMessage.contextInfo).substring(0, 200) : null,
          fullMessage: JSON.stringify(message).substring(0, 500)
        });
        
        // FULL JSON DUMP for debugging - save to file system
        const fs = await import('fs');
        const debugPath = `/tmp/webhook_debug_${Date.now()}.json`;
        await fs.promises.writeFile(debugPath, JSON.stringify({ data, message, key }, null, 2));
        console.log(`📝 [DEBUG] Full webhook saved to: ${debugPath}`);
        
        // SPECIAL DEBUG: Full dump for location messages
        if (message?.locationMessage) {
          console.log(`📍 [DEBUG LOCATION FOUND] Full locationMessage:`, JSON.stringify(message.locationMessage, null, 2));
        }

        // Extract message text content
        let messageText: string | null = null;
        let imageBase64: string | undefined = undefined;
        let imageMediaUrl: string | undefined = undefined; // URL da imagem para worker
        let pdfBase64: string | undefined = undefined;
        let pdfName: string | undefined = undefined;
        let audioUrl: string | undefined = undefined;
        let videoUrl: string | undefined = undefined;
        let videoName: string | undefined = undefined;
        let videoMimetype: string | undefined = undefined;
        let locationLatitude: string | undefined = undefined;
        let locationLongitude: string | undefined = undefined;
        
        if (message?.conversation) {
          messageText = message.conversation;
        } else if (message?.extendedTextMessage?.text) {
          messageText = message.extendedTextMessage.text;
        } else if (message?.imageMessage) {
          // Process image - download base64
          const { processWhatsAppImage } = await import("./lib/vision");
          
          // Extrair mediaUrl se disponível (S3/MinIO)
          const mediaUrl = data?.message?.mediaUrl;
          imageMediaUrl = mediaUrl; // Salvar para passar ao worker
          
          console.log(`📸 [Evolution] Imagem detectada:`, {
            url: message.imageMessage.url,
            caption: message.imageMessage.caption,
            mimetype: message.imageMessage.mimetype,
            hasMediaUrl: !!mediaUrl,
            mediaUrl: mediaUrl?.substring(0, 100) || 'não disponível'
          });
          
          const processedImage = await processWhatsAppImage(
            key,
            instance,
            message.imageMessage.caption,
            mediaUrl
          );
          
          messageText = processedImage.text;
          imageBase64 = processedImage.base64;
          
          console.log(`✅ [Evolution] Imagem processada:`, {
            messageText: messageText.substring(0, 100),
            hasBase64: !!imageBase64,
            base64Length: imageBase64?.length || 0,
            hasMediaUrl: !!imageMediaUrl
          });
        } else if (message?.documentMessage) {
          // Process document/PDF - download base64
          const { processWhatsAppDocument } = await import("./lib/vision");
          
          // Extrair mediaUrl se disponível (S3/MinIO)
          const mediaUrl = data?.message?.mediaUrl;
          
          console.log(`📄 [Evolution] Documento detectado:`, {
            url: message.documentMessage.url,
            fileName: message.documentMessage.fileName,
            mimetype: message.documentMessage.mimetype,
            hasMediaUrl: !!mediaUrl,
            mediaUrl: mediaUrl?.substring(0, 100) || 'não disponível'
          });
          
          const processedDocument = await processWhatsAppDocument(
            key,
            instance,
            message.documentMessage.fileName,
            mediaUrl
          );
          
          pdfBase64 = processedDocument.base64;
          pdfName = processedDocument.fileName || 'documento.pdf'; // SEMPRE garantir um nome
          
          // Extrair texto do PDF se for um arquivo PDF
          const isPdf = message.documentMessage.mimetype?.includes('pdf') || 
                        pdfName.toLowerCase().endsWith('.pdf');
          
          if (isPdf && pdfBase64) {
            try {
              console.log(`📝 [Evolution] Extraindo texto do PDF...`);
              const { extractPdfText, truncatePdfText, isValidPdfSize } = await import("./lib/pdf");
              
              if (!isValidPdfSize(pdfBase64)) {
                console.log(`⚠️ [Evolution] PDF muito grande (>10MB) - usando apenas nome do arquivo`);
                messageText = `[Documento PDF] ${pdfName || 'documento.pdf'}\n\n⚠️ Documento muito grande para análise automática.`;
              } else {
                const extractedText = await extractPdfText(pdfBase64);
                
                if (extractedText) {
                  // Truncar texto se for muito longo
                  const { text: finalText, wasTruncated } = truncatePdfText(extractedText);
                  
                  messageText = `[Documento PDF recebido: ${pdfName || 'documento.pdf'}]\n\n📄 Conteúdo do documento:\n${finalText}`;
                  
                  console.log(`✅ [Evolution] Texto extraído do PDF:`, {
                    fileName: pdfName,
                    textLength: extractedText.length,
                    wasTruncated,
                    preview: finalText.substring(0, 200)
                  });
                } else {
                  messageText = `[Documento PDF] ${pdfName || 'documento.pdf'}\n\n⚠️ Não foi possível extrair texto. Pode ser um PDF escaneado (imagem).`;
                  console.log(`⚠️ [Evolution] Falha ao extrair texto do PDF - possivelmente PDF escaneado`);
                }
              }
            } catch (error) {
              console.error(`❌ [Evolution] Erro ao processar PDF:`, error);
              messageText = `[Documento PDF] ${pdfName || 'documento.pdf'}`;
            }
          } else {
            // Não é PDF, apenas usar nome do arquivo
            messageText = processedDocument.text;
          }
          
          console.log(`✅ [Evolution] Documento processado:`, {
            messageText: messageText.substring(0, 100),
            hasBase64: !!pdfBase64,
            base64Length: pdfBase64?.length || 0,
            fileName: pdfName,
            isPdf
          });
        } else if (message?.videoMessage) {
          // Process video - extract URL and metadata
          const mediaUrl = data?.message?.mediaUrl;
          videoUrl = mediaUrl; // Salvar URL do vídeo
          
          console.log(`🎬 [Evolution] Vídeo detectado:`, {
            url: message.videoMessage.url,
            caption: message.videoMessage.caption,
            mimetype: message.videoMessage.mimetype,
            seconds: message.videoMessage.seconds,
            hasMediaUrl: !!mediaUrl,
            mediaUrl: mediaUrl?.substring(0, 100) || 'não disponível'
          });
          
          // Nome do vídeo (usar timestamp se não tiver)
          videoName = `video_${Date.now()}.mp4`;
          videoMimetype = message.videoMessage.mimetype || 'video/mp4';
          
          // Texto da mensagem com legenda se houver
          messageText = message.videoMessage.caption 
            ? `[Vídeo enviado]\n\n${message.videoMessage.caption}` 
            : `[Vídeo enviado]`;
          
          console.log(`✅ [Evolution] Vídeo processado:`, {
            messageText: messageText.substring(0, 100),
            hasVideoUrl: !!videoUrl,
            videoName,
            videoMimetype
          });
        } else if (message?.audioMessage) {
          // Extract mediaUrl if available (S3/MinIO)
          audioUrl = data?.message?.mediaUrl;
          
          console.log(`🎙️ [Evolution] Áudio detectado:`, {
            hasMediaUrl: !!audioUrl,
            mediaUrl: audioUrl?.substring(0, 100) || 'não disponível',
            mimetype: message.audioMessage.mimetype,
            seconds: message.audioMessage.seconds
          });
          
          // Transcrever áudio automaticamente com Whisper
          if (audioUrl) {
            try {
              console.log(`🎤 [Evolution] Baixando áudio para transcrição...`);
              
              // Baixar áudio da URL
              const audioResponse = await fetch(audioUrl);
              if (!audioResponse.ok) {
                throw new Error(`Falha ao baixar áudio: ${audioResponse.status}`);
              }
              
              const audioArrayBuffer = await audioResponse.arrayBuffer();
              const audioBuffer = Buffer.from(audioArrayBuffer);
              const audioBase64 = audioBuffer.toString('base64');
              
              console.log(`✅ [Evolution] Áudio baixado (${(audioBuffer.length / 1024).toFixed(2)}KB)`);
              
              // Transcrever com Whisper
              const { transcribeAudio, isValidAudioSize } = await import("./lib/audio");
              
              if (!isValidAudioSize(audioBase64)) {
                console.log(`⚠️ [Evolution] Áudio fora do tamanho permitido - usando apenas texto padrão`);
                messageText = `[Áudio recebido - muito grande para transcrição]`;
              } else {
                const transcription = await transcribeAudio(audioBase64, message.audioMessage.mimetype || 'audio/ogg');
                
                if (transcription) {
                  messageText = `[Áudio enviado]\n\n🎤 Transcrição automática:\n${transcription}`;
                  console.log(`✅ [Evolution] Áudio transcrito: ${transcription.substring(0, 100)}...`);
                } else {
                  messageText = `[Áudio recebido - transcrição não disponível]`;
                  console.log(`⚠️ [Evolution] Falha na transcrição do áudio`);
                }
              }
            } catch (error) {
              console.error(`❌ [Evolution] Erro ao processar áudio:`, error);
              messageText = `[Áudio recebido]`;
            }
          } else {
            messageText = `[Áudio recebido - URL não disponível]`;
          }
        } else if (message?.stickerMessage) {
          // Stickers não devem gerar resposta genérica - cliente está expressando emoção
          console.log(`✨ [Evolution] Cliente enviou sticker - interpretando como interação positiva`);
          messageText = `[Sticker recebido - cliente demonstrou reação]`;
        } else if (message?.contactMessage) {
          messageText = `[Contato compartilhado]`;
        } else if (message?.locationMessage) {
          // DEBUG: Log estrutura completa da mensagem de localização
          console.log(`🔍 [DEBUG LOCATION] Estrutura completa da locationMessage:`, JSON.stringify(message.locationMessage, null, 2));
          
          const latitude = message.locationMessage.degreesLatitude;
          const longitude = message.locationMessage.degreesLongitude;
          
          console.log(`🔍 [DEBUG LOCATION] Latitude extraída: ${latitude} (tipo: ${typeof latitude})`);
          console.log(`🔍 [DEBUG LOCATION] Longitude extraída: ${longitude} (tipo: ${typeof longitude})`);
          
          if (latitude && longitude) {
            locationLatitude = latitude.toString();
            locationLongitude = longitude.toString();
            messageText = `[Localização compartilhada]\n📍 https://www.google.com/maps?q=${latitude},${longitude}`;
            
            console.log(`✅ [Evolution] Localização válida: ${latitude}, ${longitude}`);
          } else {
            messageText = `[Localização compartilhada - coordenadas não disponíveis]`;
            console.log(`⚠️ [Evolution] Localização sem coordenadas válidas`);
          }
        } else {
          console.log(`⚠️  [Evolution] Tipo de mensagem não suportado:`, Object.keys(message || {}));
          return res.json({ success: true, processed: false, reason: "unsupported_type" });
        }

        if (!messageText) {
          return res.json({ success: true, processed: false, reason: "no_text" });
        }

        // Detect if this is a group message
        const isGroup = remoteJid.endsWith('@g.us');
        
        let phoneNumber: string;
        let chatId: string;
        let clientName: string;
        
        if (isGroup) {
          const groupId = remoteJid; // Keep full group ID (e.g., 120363123456789@g.us)
          
          console.log(`👥 [Groups] Mensagem de grupo detectada: ${groupId}`);
          
          // Get or create group
          let group = await storage.getGroupByGroupId(groupId);
          
          if (!group) {
            // Import new group automatically - fetch group info from Evolution API
            let groupName = `Grupo ${groupId.slice(0, 8)}`; // Fallback name
            
            let groupAvatar: string | null = null;
            
            try {
              // Fetch group info from Evolution API
              const apiKey = await getEvolutionApiKey(instance);
              
              if (apiKey) {
                const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolutionapi.trtelecom.net';
                const evolutionUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
                
                console.log(`🔍 [Groups] Buscando informações do grupo via API: ${groupId}`);
                
                // GET request with groupJid as query parameter
                const groupInfoResponse = await fetch(
                  `${evolutionUrl}/group/findGroupInfos/${instance}?groupJid=${encodeURIComponent(groupId)}`,
                  {
                    method: 'GET',
                    headers: {
                      'apikey': apiKey,
                    }
                  }
                );
                
                if (groupInfoResponse.ok) {
                  const groupInfo = await groupInfoResponse.json();
                  groupName = groupInfo.subject || groupName;
                  groupAvatar = groupInfo.pictureUrl || null;
                  
                  console.log(`✅ [Groups] Nome do grupo obtido: ${groupName}`);
                  if (groupAvatar) {
                    console.log(`✅ [Groups] Avatar do grupo obtido: ${groupAvatar}`);
                  }
                } else {
                  const errorText = await groupInfoResponse.text();
                  console.log(`⚠️ [Groups] Falha ao buscar info do grupo (${groupInfoResponse.status}): ${errorText} - usando nome fallback`);
                }
              } else {
                console.log(`⚠️ [Groups] API key não encontrada - usando nome fallback`);
              }
            } catch (error) {
              console.error(`❌ [Groups] Erro ao buscar info do grupo:`, error);
            }
            
            console.log(`➕ [Groups] Importando novo grupo: ${groupName}`);
            
            group = await storage.createGroup({
              groupId,
              name: groupName,
              avatar: groupAvatar,
              evolutionInstance: instance,
              aiEnabled: false, // New groups start with AI disabled by default
              lastMessageTime: new Date(),
              lastMessage: messageText.substring(0, 100),
            });
            
            console.log(`✅ [Groups] Grupo importado com sucesso: ${group.name} (ID: ${group.id})`);
          } else {
            // Update last message info
            await storage.updateGroup(group.id, {
              lastMessageTime: new Date(),
              lastMessage: messageText.substring(0, 100),
            });
          }
          
          // For groups, we'll process like a regular conversation
          // Use groupId as the "phone number" for conversation purposes
          phoneNumber = groupId;
          chatId = `whatsapp_${groupId}`;
          clientName = group.name;
          
          webhookLogger.success('MESSAGE_RECEIVED', `Mensagem de grupo: ${clientName}`, {
            groupId,
            messagePreview: messageText.substring(0, 50),
            chatId,
          });

          console.log(`💬 [Evolution] Mensagem de grupo ${clientName}: ${messageText}`);
        } else {
          // Individual conversation
          // CRITICAL FIX: Parse remoteJid to handle @lid (WhatsApp Business) and @s.whatsapp.net (regular phones)
          const parsed = parseRemoteJid(remoteJid, pushName);
          
          phoneNumber = parsed.normalizedPhone || parsed.rawId;
          chatId = parsed.chatId;
          clientName = parsed.displayName;
          
          webhookLogger.success('MESSAGE_RECEIVED', `Mensagem de ${clientName}`, {
            phoneNumber,
            messagePreview: messageText.substring(0, 50),
            chatId,
            type: parsed.type,
          });

          console.log(`💬 [Evolution] Mensagem recebida de ${clientName} (${phoneNumber}) [${parsed.type}]: ${messageText}`);
        }

        // Get or create conversation
        let conversation = await storage.getConversationByChatId(chatId);
        let threadId = await getConversationThread(chatId);

        if (!conversation) {
          // New conversation - SEMPRE inicia com a Recepcionista (Apresentação)
          console.log(`🎭 [Evolution New Conversation] Iniciando com Recepcionista para ${clientName}`);
          
          // Create thread
          threadId = await createThread();
          await storeConversationThread(chatId, threadId);

          // Create conversation record with Recepcionista
          const { ASSISTANT_IDS, ASSISTANT_TO_DEPARTMENT } = await import("./lib/openai");
          conversation = await storage.createConversation({
            chatId,
            clientName,
            clientId: phoneNumber,
            threadId,
            assistantType: "apresentacao",  // SEMPRE inicia com recepcionista
            department: ASSISTANT_TO_DEPARTMENT["apresentacao"] || "general", // Departamento baseado no assistente
            status: "active",
            sentiment: "neutral",
            urgency: "normal",
            duration: 0,
            lastMessage: messageText,
            evolutionInstance: instance, // Armazena qual instância Evolution API está usando
            metadata: { 
              routing: {
                assistantType: "apresentacao",
                assistantId: ASSISTANT_IDS.apresentacao,
                confidence: 1.0
              },
              source: 'evolution_api',
              instance,
              remoteJid,
            },
          });
          
          prodLogger.info('conversation', 'Nova conversa criada', {
            conversationId: conversation.id,
            phoneNumber,
            clientName,
            chatId,
            assistantType: 'apresentacao',
          });
        } else if (!threadId) {
          // Existing conversation but no thread - create one
          threadId = await createThread();
          await storeConversationThread(chatId, threadId);
          
          await storage.updateConversation(conversation.id, {
            threadId,
          });
        }

        // Reopen conversation if it was resolved
        if (conversation.status === 'resolved') {
          console.log(`🔄 [Conversation Reopen] Reabrindo conversa resolvida para ${clientName}`);
          
          // CRITICAL FIX: Preserve existing evolutionInstance when webhook lacks instance field
          // This prevents worker-set instances (e.g., 'Cobrança') from being overwritten to 'Leads'
          const effectiveInstance = getEffectiveEvolutionInstance(
            conversation.evolutionInstance, // Preserve existing instance
            rawInstance // Use webhook instance only if provided
          );
          
          const shouldUpdateInstance = conversation.evolutionInstance !== effectiveInstance;
          if (shouldUpdateInstance) {
            console.log(`📱 [Instance Update] Atualizando instância na reabertura: "${conversation.evolutionInstance}" → "${effectiveInstance}"`);
          }
          
          await storage.updateConversation(conversation.id, {
            status: 'active',
            resolvedAt: null,
            resolvedBy: null,
            resolutionTime: null,
            autoClosed: false,
            autoClosedReason: null,
            autoClosedAt: null,
            evolutionInstance: effectiveInstance, // PRESERVE existing instance if webhook lacks it
          });
          
          // Update local conversation object
          conversation.status = 'active';
          conversation.evolutionInstance = effectiveInstance; // Update local copy too
          
          prodLogger.info('conversation', 'Conversa reaberta', {
            conversationId: conversation.id,
            phoneNumber,
            clientName,
            chatId,
          });
        }

        // Check if this is NPS feedback BEFORE reopening conversation
        // This prevents reopening when client is just responding to NPS survey
        const metadata = conversation.metadata as any || {};
        
        // Regex RIGOROSA: aceita APENAS mensagens que são praticamente só um número
        // Aceita: "9", "10", "nota 9", "9 estrelas", "minha nota: 8"
        // Rejeita: "preciso de 2 vias", "aguardando 10 minutos", "cpf 12345"
        // Verifica se a mensagem toda tem no máximo 25 chars E é um padrão de avaliação
        const trimmed = messageText.trim();
        const npsMatch = trimmed.length <= 25 && /^\s*(minha\s+)?(nota|avaliação)?[:\s]*([0-9]|10)([.\s!]*(estrelas?|pontos?)?)?$/i.test(trimmed)
          ? trimmed.match(/\b(10|[0-9])\b/)
          : null;
        
        console.log(`🔍 [NPS Debug] Conversa ${conversation.id}:`, {
          awaitingNPS: metadata.awaitingNPS,
          messageText,
          npsMatch: npsMatch ? npsMatch[0] : null,
          status: conversation.status
        });
        
        if (metadata.awaitingNPS && npsMatch) {
          const npsScore = parseInt(npsMatch[0], 10);
          console.log(`📊 [NPS] Detectada resposta NPS: ${npsScore} de ${clientName}`);
          
          // Verificar se já existe feedback para esta conversa (evitar duplicatas)
          const existingFeedback = await storage.getSatisfactionFeedbackByConversationId(conversation.id);
          if (existingFeedback) {
            console.log(`⚠️ [NPS] Feedback duplicado ignorado para ${clientName}`);
            
            // Buscar template de feedback já registrado
            const alreadyTemplate = await storage.getMessageTemplateByKey('nps_already_submitted');
            const alreadyMessage = alreadyTemplate?.template || `Obrigado! Seu feedback já foi registrado anteriormente.`;
            
            const result = await sendWhatsAppMessage(phoneNumber, alreadyMessage, conversation.evolutionInstance || undefined);
            return res.json({ 
              success: true, 
              processed: true, 
              nps_duplicate: true 
            });
          }
          
          // Verificar se telefone corresponde ao cliente da conversa
          if (phoneNumber !== conversation.clientId) {
            console.log(`⚠️ [NPS] Tentativa de envio de telefone diferente: ${phoneNumber} vs ${conversation.clientId}`);
            return res.json({ 
              success: true, 
              processed: false, 
              error: 'Phone mismatch' 
            });
          }
          
          // Armazenar feedback NPS diretamente
          console.log(`💾 [NPS] Salvando feedback no banco:`, {
            conversationId: conversation.id,
            assistantType: conversation.assistantType,
            npsScore,
            clientName: conversation.clientName
          });
          
          const savedFeedback = await storage.createSatisfactionFeedback({
            conversationId: conversation.id,
            assistantType: conversation.assistantType,
            npsScore,
            clientName: conversation.clientName,
          });
          
          console.log(`✅ [NPS] Feedback salvo com ID:`, savedFeedback.id);
          
          // Verificar se é detrator (score 0-6) para enviar follow-up
          const isDetractor = npsScore >= 0 && npsScore <= 6;
          
          if (isDetractor) {
            // DETRATOR: Pedir feedback adicional
            console.log(`🔴 [NPS Detrator] Cliente ${clientName} deu nota ${npsScore} - solicitando feedback`);
            
            const detractorFollowupMessage = `
Agradecemos sua avaliação! 🙏

Sentimos muito que sua experiência não tenha sido a melhor.

*Poderia nos contar o que aconteceu?*

Seu feedback é fundamental para melhorarmos nosso atendimento.
            `.trim();
            
            // ✅ BUG FIX: Preservar resolved_by quando atualizar metadata de NPS
            // Marcar que está aguardando comentário do detrator
            await storage.updateConversation(conversation.id, {
              status: 'resolved',
              // NÃO alterar resolved_by - já foi definido quando conversa foi finalizada
              metadata: { 
                ...metadata, 
                awaitingNPS: false,
                awaitingNPSComment: true,
                npsScore,
                feedbackId: savedFeedback.id
              }
            });
            
            conversation = { 
              ...conversation, 
              status: 'resolved',
              metadata: { 
                ...metadata, 
                awaitingNPS: false,
                awaitingNPSComment: true,
                npsScore,
                feedbackId: savedFeedback.id
              }
            };
            
            await sendWhatsAppMessage(phoneNumber, detractorFollowupMessage, conversation.evolutionInstance || undefined);
            
            return res.json({ 
              success: true, 
              processed: true, 
              nps_received: true,
              score: npsScore,
              feedbackId: savedFeedback.id,
              detractor_followup_sent: true
            });
          } else {
            // ✅ BUG FIX: Preservar resolved_by quando atualizar metadata de NPS
            // NÃO É DETRATOR: Apenas agradecer
            await storage.updateConversation(conversation.id, {
              status: 'resolved',
              // NÃO alterar resolved_by - já foi definido quando conversa foi finalizada
              metadata: { ...metadata, awaitingNPS: false }
            });
            
            conversation = { 
              ...conversation, 
              status: 'resolved',
              metadata: { ...metadata, awaitingNPS: false }
            };
            
            console.log(`📊 [NPS] Cliente ${clientName} avaliou com nota ${npsScore} - conversa mantida como resolved`);
            
            // Mensagem personalizada baseada no score
            let thankYouMessage = '';
            if (npsScore >= 9) {
              // Promotor (9-10)
              thankYouMessage = `🌟 *Obrigado pela avaliação!*\n\nFicamos muito felizes que você tenha gostado do nosso atendimento! 😊\n\nSeu feedback é muito importante para nós! 💙`;
            } else {
              // Neutro (7-8)
              thankYouMessage = `Obrigado pela sua avaliação! 👍\n\nEstamos sempre trabalhando para melhorar nosso atendimento.\n\nQualquer coisa, estamos à disposição! 😊`;
            }
            
            await sendWhatsAppMessage(phoneNumber, thankYouMessage, conversation.evolutionInstance || undefined);
            
            return res.json({ 
              success: true, 
              processed: true, 
              nps_received: true,
              score: npsScore,
              feedbackId: savedFeedback.id 
            });
          }
        }

        // Check if awaiting NPS comment from detractor
        if (metadata.awaitingNPSComment) {
          console.log(`💬 [NPS Comment] Recebendo comentário de detrator de ${clientName}`);
          
          const feedbackId = metadata.feedbackId;
          if (feedbackId) {
            try {
              // Atualizar feedback com o comentário
              await storage.updateSatisfactionFeedback(feedbackId, {
                comment: messageText.trim()
              });
              
              console.log(`✅ [NPS Comment] Comentário salvo para feedback ${feedbackId}`);
              
              // Remover flag awaitingNPSComment
              await storage.updateConversation(conversation.id, {
                status: 'resolved',
                metadata: { 
                  ...metadata, 
                  awaitingNPSComment: false,
                  feedbackId: undefined,
                  npsScore: undefined
                }
              });
              
              conversation = { 
                ...conversation, 
                status: 'resolved',
                metadata: { 
                  ...metadata, 
                  awaitingNPSComment: false
                }
              };
              
              // Enviar mensagem de agradecimento pelo feedback detalhado
              const detractorThankYouMessage = `
🙏 *Muito obrigado pelo seu feedback!*

Sua opinião foi registrada e será analisada pela nossa equipe.

Vamos trabalhar para melhorar e esperamos poder te atender melhor da próxima vez! 💙

Qualquer coisa, estamos à disposição! 😊
              `.trim();
              
              await sendWhatsAppMessage(phoneNumber, detractorThankYouMessage, conversation.evolutionInstance || undefined);
              
              return res.json({ 
                success: true, 
                processed: true, 
                nps_comment_received: true
              });
            } catch (error) {
              console.error(`❌ [NPS Comment] Erro ao salvar comentário:`, error);
            }
          }
        }

        // If conversation is resolved and message is NOT an NPS response, reopen it
        // This handles two cases:
        // 1. Resolved conversation without awaiting NPS - reopen normally
        // 2. Resolved conversation awaiting NPS but client sent non-NPS message - clear flag and reopen
        if (conversation.status === 'resolved') {
          // CAMPAIGN CONVERSATIONS: Manter assistente original (financeiro para cobranças)
          // NORMAL CONVERSATIONS: Resetar para recepcionista
          const isCampaignConversation = conversation.conversationSource === 'whatsapp_campaign' || 
                                         conversation.conversationSource === 'voice_campaign';
          
          const targetAssistant = isCampaignConversation 
            ? conversation.assistantType // Manter assistente original (financeiro)
            : 'apresentacao';             // Resetar para recepcionista
          
          console.log(`🔄 [Evolution Reopen] Reabrindo conversa finalizada: ${chatId} (${clientName}) - Assistente: ${targetAssistant}${isCampaignConversation ? ' (campanha)' : ''}`);
          
          const updateData: any = {
            status: 'active',
            assistantType: targetAssistant,
          };
          
          // Se estava aguardando NPS mas cliente enviou outra mensagem, limpar flag
          if (metadata.awaitingNPS) {
            console.log(`🔄 [Evolution Reopen] Cliente respondeu algo diferente de NPS - limpando flag`);
            updateData.metadata = { ...metadata, awaitingNPS: false };
          }
          
          // Se estava transferida, resetar para IA voltar a responder
          if (conversation.transferredToHuman) {
            console.log(`🤖 [Evolution Reopen] Resetando transferência - IA volta a responder`);
            updateData.transferredToHuman = false;
            updateData.transferReason = null;
            updateData.transferredAt = null;
          }
          
          await storage.updateConversation(conversation.id, updateData);
          // Update local object
          Object.assign(conversation, updateData);
        }

        // Detect and store CPF/CNPJ if present in message
        if (!conversation.clientDocument) {
          // Regex para CPF (com ou sem formatação): 000.000.000-00 ou 00000000000
          const cpfMatch = messageText.match(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/);
          // Regex para CNPJ (com ou sem formatação): 00.000.000/0000-00 ou 00000000000000
          const cnpjMatch = messageText.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
          
          const documentMatch = cpfMatch || cnpjMatch;
          
          if (documentMatch) {
            // Remove formatação (pontos, traços, barras)
            const cleanDocument = documentMatch[1].replace(/[.\-\/]/g, '');
            
            // Mascara segura: CPF (11 dígitos) ou CNPJ (14 dígitos)
            const maskedDocument = cleanDocument.length === 11
              ? cleanDocument.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.***.***-**')  // CPF: ***.***.***: -**
              : cleanDocument.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '**.***.***/****-**');  // CNPJ: **.***.***/****-**
            
            console.log(`📝 [CPF/CNPJ Detected] Cliente ${clientName} forneceu documento: ${maskedDocument}`);
            
            // Usar função de persistência que salva em metadata também
            const { persistClientDocument } = await import("./lib/conversation-intelligence");
            await persistClientDocument(conversation.id, cleanDocument);
            
            // Update local conversation object
            conversation.clientDocument = cleanDocument;
          }
        }

        // 🧠 ANÁLISE DE INTELIGÊNCIA: Sentiment, Urgência e Problemas Técnicos
        const { 
          analyzeSentiment, 
          analyzeUrgency, 
          detectTechnicalProblem,
          checkRecurrence,
          updateConversationIntelligence,
          generateIntelligenceSummary 
        } = await import("./lib/conversation-intelligence");
        
        const sentimentAnalysis = analyzeSentiment(messageText);
        const urgencyAnalysis = analyzeUrgency(messageText);
        const problemAnalysis = detectTechnicalProblem(messageText);
        
        // Verificar recorrência se houver problema técnico e CPF
        let recurrenceAnalysis = null;
        if (problemAnalysis.detected && conversation.clientDocument) {
          recurrenceAnalysis = await checkRecurrence(
            conversation.clientDocument,
            problemAnalysis.problemType || 'tecnico',
            30
          );
        }
        
        // Atualizar metadata da conversa com inteligência
        const intelligenceUpdates: any = {};
        
        if (sentimentAnalysis.sentiment === 'negative') {
          intelligenceUpdates.sentiment = 'negative';
        }
        
        if (urgencyAnalysis.urgency === 'high' || urgencyAnalysis.urgency === 'critical') {
          intelligenceUpdates.urgency = urgencyAnalysis.urgency;
        }
        
        if (problemAnalysis.detected) {
          intelligenceUpdates.problemaDetectado = {
            type: problemAnalysis.problemType,
            keywords: problemAnalysis.keywords,
            detectedAt: new Date().toISOString()
          };
        }
        
        if (recurrenceAnalysis?.isRecurrent) {
          intelligenceUpdates.recorrencia = {
            isRecurrent: true,
            occurrences: recurrenceAnalysis.previousOccurrences,
            lastOccurrence: recurrenceAnalysis.lastOccurrence,
            details: recurrenceAnalysis.details
          };
        }
        
        if (Object.keys(intelligenceUpdates).length > 0) {
          await updateConversationIntelligence(conversation.id, intelligenceUpdates);
          
          // Log resumo de inteligência
          const summary = generateIntelligenceSummary({
            sentiment: sentimentAnalysis,
            urgency: urgencyAnalysis,
            problem: problemAnalysis.detected ? problemAnalysis : undefined,
            recurrence: recurrenceAnalysis?.isRecurrent ? recurrenceAnalysis : undefined
          });
          
          console.log(`🧠 [Intelligence] ${summary}`);
        }

        // Store user message
        console.log(`💾 [DEBUG] Salvando mensagem com mídia:`, {
          hasImage: !!imageBase64,
          imageLength: imageBase64?.length || 0,
          hasPdf: !!pdfBase64,
          pdfLength: pdfBase64?.length || 0,
          pdfName: pdfName || 'nenhum',
          hasAudio: !!audioUrl,
          audioUrl: audioUrl?.substring(0, 100) || 'nenhum',
          hasVideo: !!videoUrl,
          videoUrl: videoUrl?.substring(0, 100) || 'nenhum',
          videoName: videoName || 'nenhum',
          hasLocation: !!locationLatitude && !!locationLongitude,
          locationCoords: locationLatitude && locationLongitude ? `${locationLatitude},${locationLongitude}` : 'nenhum',
          messagePreview: messageText.substring(0, 100)
        });
        
        await storage.createMessage({
          conversationId: conversation.id,
          role: "user",
          content: messageText,
          assistant: null,
          imageBase64: imageBase64,
          pdfBase64: pdfBase64,
          pdfName: pdfName,
          audioUrl: audioUrl,
          videoUrl: videoUrl,
          videoName: videoName,
          videoMimetype: videoMimetype,
          locationLatitude: locationLatitude,
          locationLongitude: locationLongitude,
        });

        // ⏱️ IMPORTANTE: Atualizar lastMessageTime quando CLIENTE envia mensagem
        // Isso garante que a conversa vai ao topo da lista quando o cliente responde
        // 🔄 RESETAR VERIFICAÇÃO: Quando cliente envia nova mensagem, resetar verificação do supervisor
        await storage.updateConversation(conversation.id, {
          lastMessage: messageText,
          lastMessageTime: new Date(),
          verifiedAt: null,
          verifiedBy: null,
        });

        // If conversation is transferred to human, don't auto-respond
        if (conversation.transferredToHuman) {
          webhookLogger.warning('TRANSFER_ACTIVE', 'Conversa transferida - resposta manual necessária', {
            conversationId: conversation.id,
            clientName,
          });
          console.log(`👤 [Evolution] Conversa transferida para humano - não respondendo automaticamente`);
          return res.json({ 
            success: true, 
            processed: true, 
            transferred: true,
            conversationId: conversation.id 
          });
        }

        // Check if this is a group message with AI disabled
        const isGroupMessage = chatId.includes('@g.us');
        if (isGroupMessage) {
          const group = await storage.getGroupByGroupId(phoneNumber);
          if (group && !group.aiEnabled) {
            console.log(`🔇 [Groups] IA desativada para grupo ${group.name} - mensagem salva mas não processada`);
            return res.json({ 
              success: true, 
              processed: false, 
              reason: "group_ai_disabled",
              conversationId: conversation.id,
              groupId: group.id,
              groupName: group.name
            });
          }
        }

        // 🔄 BATCHING SYSTEM: Grupo mensagens sequenciais em janela de 3 segundos
        try {
          console.log(`\n📥 [Webhook] Iniciando processamento de mensagem:`);
          console.log(`   Cliente: ${clientName}`);
          console.log(`   ChatId: ${chatId}`);
          console.log(`   Mensagem: "${messageText.substring(0, 60)}..."`);
          console.log(`   Instância: ${instance}`);
          
          const { addToBatch } = await import("./lib/message-batching");
          const { addMessageToQueue } = await import("./lib/queue");
          
          // CRITICAL: ALWAYS use the instance from which the message CAME IN
          // If client sends message via Principal, response MUST go out via Principal
          const finalEvolutionInstance = instance; // Use current webhook instance
          
          // Update conversation's evolutionInstance if it changed
          if (conversation.evolutionInstance !== instance) {
            console.log(`📱 [Instance Update] Cliente ${clientName} mudou de instância: "${conversation.evolutionInstance}" → "${instance}"`);
            await storage.updateConversation(conversation.id, {
              evolutionInstance: instance
            });
            conversation.evolutionInstance = instance; // Update local copy
          }
          
          // Prepara dados da mensagem
          const messageData = {
            chatId,
            conversationId: conversation.id,
            message: messageText,
            fromNumber: phoneNumber,
            messageId,
            timestamp: messageTimestamp || Date.now(),
            evolutionInstance: finalEvolutionInstance,
            clientName,
            hasImage: !!imageBase64,
            imageUrl: imageMediaUrl,
            hasAudio: !!audioUrl,
            audioUrl: audioUrl,
            hasPdf: !!pdfBase64,
            pdfBase64: pdfBase64,
            pdfName: pdfName,
            locationLatitude: locationLatitude,
            locationLongitude: locationLongitude,
            receivedAt: Date.now(),
          };
          
          console.log(`🔄 [Webhook] Chamando addToBatch()...`);
          
          // Adiciona ao batch - retorna se deve processar imediatamente (fallback)
          const result = await addToBatch(chatId, messageData);
          
          console.log(`📊 [Webhook] Resultado do batching:`, { shouldProcess: result.shouldProcess, messageCount: result.messages.length });

          if (result.shouldProcess) {
            // Fallback: processar imediatamente se batching falhou
            console.log(`⚠️  [Evolution] Batching fallback - processando imediatamente`);
            
            await addMessageToQueue({
              chatId,
              conversationId: conversation.id,
              message: messageText,
              fromNumber: phoneNumber,
              messageId,
              timestamp: messageTimestamp || Date.now(),
              evolutionInstance: finalEvolutionInstance,
              clientName,
              hasImage: !!imageBase64,
              imageUrl: imageMediaUrl,
              locationLatitude: locationLatitude,
              locationLongitude: locationLongitude,
            }, 1);
            
            // 📊 LATENCY TRACKING: Mensagem enfileirada (fallback direto)
            addCheckpoint(latencyTracker, 'queue_enqueued', { batched: false, fallback: true });
            latencyTracker.conversationId = conversation.id.toString();
            await saveTrackerSnapshot(latencyTracker);

            prodLogger.info('conversation', 'Mensagem processada imediatamente (fallback)', {
              conversationId: conversation.id,
              phoneNumber,
              messagePreview: messageText.substring(0, 50),
            });

            return res.json({ 
              success: true, 
              processed: true,
              fallback: true,
              conversationId: conversation.id,
              chatId 
            });
          }
          
          // 📊 LATENCY TRACKING: Mensagem enfileirada (via batching)
          addCheckpoint(latencyTracker, 'queue_enqueued', { batched: true });
          latencyTracker.conversationId = conversation.id.toString();
          await saveTrackerSnapshot(latencyTracker);

          prodLogger.info('conversation', 'Mensagem adicionada ao batch para processamento', {
            conversationId: conversation.id,
            phoneNumber,
            messagePreview: messageText.substring(0, 50),
          });

          console.log(`📦 [Evolution] Message added to batch: ${conversation.id}`);

          return res.json({ 
            success: true, 
            processed: true,
            batched: true,
            conversationId: conversation.id,
            chatId 
          });
        } catch (queueError) {
          prodLogger.error('webhook', 'Falha ao enfileirar mensagem - usando fallback', queueError as Error, {
            conversationId: conversation.id,
            phoneNumber,
          });
          // Fallback: Process without queue if Redis not available
          console.warn(`⚠️  [Evolution] Queue unavailable, falling back to async processing:`, queueError);
          
          if (!threadId) {
            console.error("❌ [Evolution] No threadId available:", { chatId, conversationId: conversation.id });
            return res.json({ success: true, processed: false, reason: "no_thread" });
          }

          // 🎯 CRITICAL FIX: Use conversation.assistantType if set (prevents campaign conversations from being re-routed)
          const { ASSISTANT_IDS } = await import("./lib/openai");
          let assistantId = conversation.assistantType && ASSISTANT_IDS[conversation.assistantType as keyof typeof ASSISTANT_IDS]
            ? ASSISTANT_IDS[conversation.assistantType as keyof typeof ASSISTANT_IDS]
            : (conversation.metadata as any)?.routing?.assistantId;
          
          console.log(`🎯 [Assistant Selection] Using assistant: ${conversation.assistantType} (ID: ${assistantId})`);
          
          const clientPhoneNumber = phoneNumber;
          const conversationRef = conversation;
        
          // Fallback async processing (when queue not available)
          (async () => {
          try {
            if (!conversationRef) {
              console.error("❌ [Evolution] Conversation reference lost in async block");
              return;
            }
            
            // 🎯 DETECÇÃO INTELIGENTE DE CONSULTA DE BOLETO
            // Detecta se cliente está perguntando sobre boletos e enriquece contexto
            let enrichedMessage = messageText;
            const boletoKeywords = /\b(boleto|fatura|segunda via|pagamento|débito|vencimento|código.*barras|pix|mensalidade|conta)\b/i;
            
            if (boletoKeywords.test(messageText) && conversationRef.clientDocument) {
              console.log(`🔍 [Boleto Auto-Fetch] Detectada consulta de boleto - buscando dados automaticamente...`);
              
              try {
                // Buscar TODOS os boletos do cliente via API
                const response = await fetch("https://webhook.trtelecom.net/webhook/consulta_boleto", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ documento: conversationRef.clientDocument }),
                });

                if (response.ok) {
                  const boletos = await response.json();
                  console.log(`✅ [Boleto Auto-Fetch] ${boletos?.length || 0} boletos encontrados`);
                  
                  if (boletos && boletos.length > 0) {
                    // Enriquecer mensagem com TODOS os dados de boletos
                    enrichedMessage = `${messageText}\n\n[DADOS DO SISTEMA - USO INTERNO DA IA]\nBoletos disponíveis do cliente:\n${JSON.stringify(boletos, null, 2)}\n\nInstruções: Analise a pergunta do cliente e responda APENAS com os boletos relevantes ao que foi perguntado. Formate de forma natural e conversacional.`;
                    
                    console.log(`📋 [Boleto Auto-Fetch] Contexto enriquecido com ${boletos.length} boletos`);
                  } else {
                    console.log(`ℹ️ [Boleto Auto-Fetch] Nenhum boleto encontrado para o cliente`);
                  }
                } else {
                  console.error(`❌ [Boleto Auto-Fetch] Erro na API: ${response.status}`);
                }
              } catch (error) {
                console.error("❌ [Boleto Auto-Fetch] Erro ao buscar boletos:", error);
                // Continua normalmente sem enriquecimento se falhar
              }
            }

            // 🔓 DETECÇÃO INTELIGENTE DE SOLICITAÇÃO DE DESBLOQUEIO
            // Detecta se cliente está pedindo desbloqueio e enriquece contexto
            // IMPORTANTE: Só processa se clientDocument JÁ estiver armazenado (segurança)
            const desbloqueioKeywords = /\b(desbloque(ar|io)?|libera(r|ção)?|confiança|urgente|emergência|bloqueado|bloqueio|preciso.*internet|preciso.*conexão)\b/i;
            
            if (desbloqueioKeywords.test(messageText) && conversationRef.clientDocument) {
              console.log(`🔍 [Desbloqueio Auto-Fetch] Detectada solicitação de desbloqueio - processando...`);
              
              try {
                // Solicitar desbloqueio via API
                const response = await fetch("https://webhook.trtelecom.net/webhook/consulta_desbloqueio", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ documento: conversationRef.clientDocument }),
                });

                if (response.ok) {
                  const resultado = await response.json();
                  const desbloqueio = resultado[0];
                  const status = desbloqueio?.data?.[0]?.status?.[0]?.status || 'N';
                  const obs = desbloqueio?.data?.[0]?.resposta?.[0]?.obs || 'Erro ao processar';
                  
                  console.log(`✅ [Desbloqueio Auto-Fetch] Status: ${status} - Obs: ${obs}`);
                  
                  // Enriquecer mensagem com resultado do desbloqueio
                  enrichedMessage = `${messageText}\n\n[DADOS DO SISTEMA - USO INTERNO DA IA]\nResultado do desbloqueio:\n${JSON.stringify(desbloqueio, null, 2)}\n\n🔍 GUIA DE INTERPRETAÇÃO:
- Se status='S' e obs='desbloqueio realizado': SUCESSO! Informar que conexão será liberada em até 15 minutos
- Se obs='desbloqueio já efetuado esse mês': Cliente já utilizou desbloqueio mensal. Orientar sobre limite
- Se obs='CLIENTE COM MAIS DE 1 BOLETO EM ABERTO': Múltiplas faturas pendentes - orientar pagamento
- Se obs='DESBLOQUEIO NAO EFETUADO': Cliente não possui bloqueio ativo ou não é elegível
- Sempre responder de forma empática e natural`;
                  
                  console.log(`🔓 [Desbloqueio Auto-Fetch] Contexto enriquecido com resultado`);
                } else {
                  console.error(`❌ [Desbloqueio Auto-Fetch] Erro na API: ${response.status}`);
                }
              } catch (error) {
                console.error("❌ [Desbloqueio Auto-Fetch] Erro ao processar desbloqueio:", error);
                // Continua normalmente sem enriquecimento se falhar
              }
            }

            // 🔌 DETECÇÃO INTELIGENTE DE CONSULTA DE CONEXÃO/INTERNET
            // Detecta se cliente está perguntando sobre conexão e enriquece contexto
            const conexaoKeywords = /\b(internet|conexão|conex[aã]o|velocidade|lent(o|a)|desconect(ado|ou)|caindo|instável|instavel|wi-?fi|wifi|sinal|offline|online|pppoe|ip|fibra|rede)\b/i;
            
            if (conexaoKeywords.test(messageText) && conversationRef.clientDocument) {
              console.log(`🔍 [Conexão Auto-Fetch] Detectada consulta de conexão - buscando status automaticamente...`);
              
              try {
                // Buscar status de TODAS as conexões do cliente via API
                const response = await fetch("https://webhook.trtelecom.net/webhook/check_pppoe_status", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ documento: conversationRef.clientDocument }),
                });

                if (response.ok) {
                  const conexoes = await response.json();
                  console.log(`✅ [Conexão Auto-Fetch] ${conexoes?.length || 0} conexão(ões) encontrada(s)`);
                  
                  if (conexoes && conexoes.length > 0) {
                    // Enriquecer mensagem com TODOS os dados de conexão
                    enrichedMessage = `${messageText}\n\n[DADOS DO SISTEMA - USO INTERNO DA IA]\nStatus de conexão do cliente:\n${JSON.stringify(conexoes, null, 2)}\n\n🔍 GUIA DE INTERPRETAÇÃO:
1. PRIORIDADE: Verificar 'statusIP' primeiro - BLOQUEIO/SEMIBLOQUEIO = problema financeiro (não técnico)
2. Se massiva=true: Problema regional afetando vários clientes
3. Se os_aberta="TRUE": Técnico já foi acionado
4. Diagnóstico técnico:
   - statusPPPoE='ONLINE' + onu_run_state='online' + statusIP='ATIVO' = Tudo OK
   - statusPPPoE='OFFLINE' + onu_run_state='online' + statusIP='BLOQUEIO' = Bloqueio financeiro
   - Ambos OFFLINE + dying-gasp = Queda de energia no cliente
   - Ambos OFFLINE + los/LOSS/LOFI = Problema na fibra (rompimento físico)
5. Responda naturalmente, traduzindo termos técnicos para linguagem simples.`;
                    
                    console.log(`🔌 [Conexão Auto-Fetch] Contexto enriquecido com ${conexoes.length} conexão(ões)`);
                  } else {
                    console.log(`ℹ️ [Conexão Auto-Fetch] Nenhuma conexão encontrada para o cliente`);
                  }
                } else {
                  console.error(`❌ [Conexão Auto-Fetch] Erro na API: ${response.status}`);
                }
              } catch (error) {
                console.error("❌ [Conexão Auto-Fetch] Erro ao buscar status de conexão:", error);
                // Continua normalmente sem enriquecimento se falhar
              }
            }
            
            const { response: responseText, transferred, transferredTo, resolved, resolveReason, routed, assistantTarget, routingReason } = await sendMessageAndGetResponse(
              threadId!,
              assistantId,
              enrichedMessage,  // Usa mensagem enriquecida com boletos se detectado
              chatId,  // CRÍTICO: Passar chatId para processar finalizar_conversa
              conversationRef.id  // CRÍTICO: Passar conversationId para consulta_boleto_cliente
            );

            // Store assistant response
            await storage.createMessage({
              conversationId: conversationRef.id,
              role: "assistant",
              content: responseText,
              assistant: conversationRef.assistantType,
            });

            // 🎭 PRIORIDADE 1: Handle internal routing between AI assistants (NÃO marca como transferido para humano)
            if (routed && assistantTarget) {
              console.log(`🎭 [Evolution Internal Routing] IA solicitou roteamento interno para ${assistantTarget}`);
              
              // Map department to assistant type
              const departmentMap: Record<string, string> = {
                "Suporte Técnico": "suporte",
                "Suporte": "suporte",
                "Técnico": "suporte",
                "Comercial": "comercial",
                "Vendas": "comercial",
                "Financeiro": "financeiro",
                "Finanças": "financeiro",
                "Pagamento": "financeiro",
                "Boleto": "financeiro",
                "Fatura": "financeiro",
                "Ouvidoria": "ouvidoria",
                "SAC": "ouvidoria",
                "Cancelamento": "cancelamento",
                "Cancelar": "cancelamento",
              };
              
              // Find matching assistant type
              let newAssistantType = "suporte"; // fallback
              
              for (const [dept, type] of Object.entries(departmentMap)) {
                if (assistantTarget.toLowerCase().includes(dept.toLowerCase())) {
                  newAssistantType = type;
                  break;
                }
              }
              
              const { ASSISTANT_IDS, createThread } = await import("./lib/openai");
              const newAssistantId = ASSISTANT_IDS[newAssistantType as keyof typeof ASSISTANT_IDS];
              
              console.log(`🔄 [Evolution Internal Routing] Trocando de '${conversationRef.assistantType}' para '${newAssistantType}' (${newAssistantId})`);
              
              // 🔥 CRÍTICO: Criar NOVA thread para o novo assistente
              console.log(`🧵 [Evolution Routing] Criando nova thread para ${newAssistantType}...`);
              const newThreadId = await createThread();
              
              // 📋 IMPORTANTE: Injetar contexto da conversa anterior na nova thread
              console.log(`📋 [Evolution Routing] Injetando contexto da conversa anterior...`);
              const previousMessages = await storage.getMessagesByConversationId(conversationRef.id);
              
              // Criar resumo do histórico (últimas 5 mensagens ou menos)
              const recentMessages = previousMessages.slice(-5);
              const contextSummary = recentMessages
                .map(msg => `${msg.role === 'user' ? 'Cliente' : 'Assistente'}: ${msg.content}`)
                .join('\n');
              
              // Injetar contexto na nova thread
              const { sendMessageAndGetResponse } = await import("./lib/openai");
              const contextMessage = `[CONTEXTO DA CONVERSA ANTERIOR - USO INTERNO]

Você está assumindo esta conversa que foi transferida do assistente ${conversationRef.assistantType.toUpperCase()}.

HISTÓRICO RECENTE:
${contextSummary}

MOTIVO DO ROTEAMENTO: ${routingReason}

IMPORTANTE: Você deve RESPONDER diretamente ao cliente (não parafrasear ou repetir o que ele disse). Apresente-se brevemente como o novo assistente responsável e continue ajudando com base na última solicitação do cliente acima.`;
              
              await sendMessageAndGetResponse(
                newThreadId,
                newAssistantId,
                contextMessage,
                chatId,
                conversationRef.id
              );
              
              console.log(`✅ [Evolution Routing] Contexto injetado na nova thread`);
              
              // Atualizar mapeamento chatId → threadId
              await storeConversationThread(chatId, newThreadId);
              console.log(`✅ [Evolution Routing] Nova thread criada: ${newThreadId}`);
              
              // Update conversation to use new assistant (NÃO marca como transferredToHuman)
              const updatedMetadata = {
                ...(typeof conversationRef.metadata === 'object' && conversationRef.metadata !== null ? conversationRef.metadata : {}),
                routing: {
                  assistantType: newAssistantType,
                  assistantId: newAssistantId,
                  confidence: 1.0,
                  routedBy: conversationRef.assistantType,
                  routedAt: new Date().toISOString(),
                  routingReason: routingReason || 'Roteamento interno',
                  previousThreadId: threadId, // Guardar thread antiga
                  newThreadId: newThreadId,
                },
              };
              
              await storage.updateConversation(conversationRef.id, {
                assistantType: newAssistantType,
                threadId: newThreadId, // ✅ Atualizar threadId no banco
                lastMessage: responseText,
                lastMessageTime: new Date(),
                metadata: updatedMetadata,
                // ⚠️ NÃO marca transferredToHuman - IA continua respondendo
              });
              
              // Create supervisor action for tracking
              await storage.createSupervisorAction({
                conversationId: conversationRef.id,
                action: "note",
                notes: `Roteamento interno: ${conversationRef.assistantType} → ${newAssistantType}. Motivo: ${routingReason || 'Roteamento interno'}`,
                createdBy: "Sistema",
              });
              
              console.log(`✅ [Evolution Internal Routing Complete] Conversa agora será atendida por ${newAssistantType} (IA continua ativa)`);
              
              webhookLogger.success('CONVERSATION_ROUTED_INTERNAL', `Roteado internamente para ${newAssistantType}`, {
                conversationId: conversationRef.id,
                newAssistantType,
                previousAssistant: conversationRef.assistantType,
              });
              
              // Send routing message to WhatsApp
              const routingResult = await sendWhatsAppMessage(clientPhoneNumber, responseText, conversationRef.evolutionInstance || undefined);
              // Atualizar última mensagem com IDs do WhatsApp
              if (routingResult.success && (routingResult.whatsappMessageId || routingResult.remoteJid)) {
                const recentMessages = await storage.getRecentMessagesByConversationId(conversationRef.id, 1);
                if (recentMessages.length > 0 && recentMessages[0].role === 'assistant') {
                  await storage.updateMessage(recentMessages[0].id, {
                    whatsappMessageId: routingResult.whatsappMessageId,
                    remoteJid: routingResult.remoteJid,
                  });
                }
              }
              
            } // Handle conversation resolution if requested by AI
            else if (resolved) {
              console.log(`✅ [Evolution Resolve] IA finalizou conversa: ${chatId}`);
              
              // Create supervisor action for resolution
              await storage.createSupervisorAction({
                conversationId: conversationRef.id,
                action: "resolve",
                notes: `Finalização automática pela IA: ${resolveReason || 'Problema resolvido'}`,
                createdBy: "IA Assistant",
              });

              // Update conversation - mark as resolved and set awaitingNPS flag
              const existingMetadata = typeof conversationRef.metadata === 'object' && conversationRef.metadata !== null 
                ? conversationRef.metadata 
                : {};
                
              await storage.updateConversation(conversationRef.id, {
                status: 'resolved',
                lastMessage: responseText,
                lastMessageTime: new Date(),
                metadata: {
                  ...existingMetadata,
                  awaitingNPS: true,
                  resolvedBy: 'IA Assistant',
                  resolvedAt: new Date().toISOString(),
                  resolveReason: resolveReason || 'Problema resolvido',
                },
              });

              console.log(`✅ [Evolution Resolve] Conversa ${conversationRef.id} marcada como resolvida, enviando NPS...`);

              // Buscar template de NPS survey
              const npsTemplate = await storage.getMessageTemplateByKey('nps_survey');
              let npsSurveyMessage = npsTemplate?.template || 
                `Olá ${conversationRef.clientName}!\n\nSeu atendimento foi finalizado.\n\nPesquisa de Satisfação\n\nEm uma escala de 0 a 10, qual a satisfação com atendimento?\n\nDigite um número de 0 (muito insatisfeito) a 10 (muito satisfeito)`;
              
              // Substituir variáveis no template
              npsSurveyMessage = npsSurveyMessage.replace(/{clientName}/g, conversationRef.clientName || 'Cliente');
              
              try {
                const result = await sendWhatsAppMessage(clientPhoneNumber, npsSurveyMessage, conversationRef.evolutionInstance || undefined);
                if (result.success) {
                  console.log(`📊 [NPS] Pesquisa enviada ao cliente ${clientName}`);
                }
              } catch (error) {
                console.error("❌ [NPS] Erro ao enviar pesquisa:", error);
              }
              
              webhookLogger.success('CONVERSATION_RESOLVED', `Conversa finalizada automaticamente pela IA`, {
                conversationId: conversationRef.id,
                resolveReason,
                npsSent: true,
              });
            } else if (transferred) {
              // SPECIAL CASE: Se é a RECEPCIONISTA transferindo, rotear para assistente especializado
              if (conversationRef.assistantType === "apresentacao") {
                console.log("🎭 [Evolution Receptionist Routing] Recepcionista está roteando para assistente especializado");
                
                // Map department to assistant type
                const departmentMap: Record<string, string> = {
                  "Suporte Técnico": "suporte",
                  "Suporte": "suporte",
                  "Técnico": "suporte",
                  "Comercial": "comercial",
                  "Vendas": "comercial",
                  "Financeiro": "financeiro",
                  "Finanças": "financeiro",
                  "Pagamento": "financeiro",
                  "Ouvidoria": "ouvidoria",
                  "SAC": "ouvidoria",
                  "Cancelamento": "cancelamento",
                  "Cancelar": "cancelamento",
                };
                
                // Find matching assistant type
                const transferDestination = transferredTo || "";
                let newAssistantType = "suporte"; // fallback
                
                for (const [dept, type] of Object.entries(departmentMap)) {
                  if (transferDestination.toLowerCase().includes(dept.toLowerCase())) {
                    newAssistantType = type;
                    break;
                  }
                }
                
                const { ASSISTANT_IDS, ASSISTANT_TO_DEPARTMENT } = await import("./lib/openai");
                const newAssistantId = ASSISTANT_IDS[newAssistantType as keyof typeof ASSISTANT_IDS];
                const newDepartment = ASSISTANT_TO_DEPARTMENT[newAssistantType] || "general";
                
                console.log(`🔄 [Evolution Routing] Trocando de 'apresentacao' para '${newAssistantType}' (${newAssistantId}) - Departamento: ${newDepartment}`);
                
                // Update conversation to use new assistant
                const updatedMetadata = {
                  ...(typeof conversationRef.metadata === 'object' && conversationRef.metadata !== null ? conversationRef.metadata : {}),
                  routing: {
                    assistantType: newAssistantType,
                    assistantId: newAssistantId,
                    confidence: 1.0,
                    routedBy: "recepcionista",
                    routedAt: new Date().toISOString(),
                  },
                };
                
                await storage.updateConversation(conversationRef.id, {
                  assistantType: newAssistantType,
                  department: newDepartment, // Atualiza departamento baseado no assistente
                  lastMessage: responseText,
                  lastMessageTime: new Date(),
                  metadata: updatedMetadata,
                });
                
                // Create supervisor action for tracking
                await storage.createSupervisorAction({
                  conversationId: conversationRef.id,
                  action: "note",
                  notes: `Recepcionista roteou para ${newAssistantType}`,
                  createdBy: "Sistema",
                });
                
                console.log(`✅ [Evolution Routing Complete] Conversa agora será atendida por ${newAssistantType}`);
                
                webhookLogger.success('CONVERSATION_ROUTED', `Recepcionista roteou para ${newAssistantType}`, {
                  conversationId: conversationRef.id,
                  newAssistantType,
                });
                
                // Generate welcome message from the new specialized assistant
                console.log(`👋 [Evolution Welcome] Gerando mensagem de boas-vindas do ${newAssistantType}...`);
                
                try {
                  // Send a context message to the new assistant to generate welcome
                  const welcomePrompt = `[CONTEXTO INTERNO: Cliente foi encaminhado pela recepcionista]

IMPORTANTE: Você deve RESPONDER ao cliente (não repetir ou parafrasear o que ele disse). Apresente-se brevemente como o assistente especializado responsável e mostre que está pronto para ajudar com a solicitação dele.`;
                  
                  const welcomeResult = await sendMessageAndGetResponse(
                    threadId!,
                    newAssistantId,
                    welcomePrompt,
                    chatId,
                    conversationRef.id
                  );
                  
                  const welcomeMessage = typeof welcomeResult.response === 'string' 
                    ? welcomeResult.response 
                    : ((welcomeResult.response as any)?.response || 'Olá! Estou aqui para ajudar.');
                  
                  // Store the welcome message
                  const initialWelcomeMessage = await storage.createMessage({
                    conversationId: conversationRef.id,
                    role: "assistant",
                    content: welcomeMessage,
                    assistant: newAssistantType,
                  });
                  
                  console.log(`✅ [Evolution Welcome] Mensagem gerada: ${welcomeMessage.substring(0, 100)}...`);
                  
                  // Send welcome message to WhatsApp
                  const sendWelcomeResult = await sendWhatsAppMessage(clientPhoneNumber, welcomeMessage, conversationRef.evolutionInstance || undefined);
                  // Atualizar mensagem com IDs do WhatsApp
                  if (sendWelcomeResult.success && (sendWelcomeResult.whatsappMessageId || sendWelcomeResult.remoteJid)) {
                    await storage.updateMessage(initialWelcomeMessage.id, {
                      whatsappMessageId: sendWelcomeResult.whatsappMessageId,
                      remoteJid: sendWelcomeResult.remoteJid,
                    });
                  }
                  
                  webhookLogger.success('WELCOME_MESSAGE_SENT', `Mensagem de boas-vindas do ${newAssistantType} enviada`, {
                    conversationId: conversationRef.id,
                    newAssistantType,
                  });
                } catch (error) {
                  console.error(`❌ [Evolution Welcome] Erro ao gerar/enviar mensagem:`, error);
                  webhookLogger.error('WELCOME_MESSAGE_ERROR', `Erro ao enviar boas-vindas`, {
                    error: error instanceof Error ? error.message : String(error),
                    conversationId: conversationRef.id,
                  });
                }
              } else {
                // NORMAL CASE: Other assistants transferring to human supervisors
                await storage.updateConversation(conversationRef.id, {
                  status: 'queued', // Marca como na fila para atendimento humano
                  transferredToHuman: true,
                  transferReason: transferredTo || 'Transferido pela IA',
                  transferredAt: new Date(),
                  lastMessage: responseText,
                  lastMessageTime: new Date(),
                });
                console.log(`🔄 [Evolution] Conversa transferida para humano: ${transferredTo}`);
                
                webhookLogger.warning('TRANSFER_TO_HUMAN', `Conversa transferida para supervisor humano`, {
                  conversationId: conversationRef.id,
                  transferredTo,
                });
              }
            } else {
              // Normal update without transfer or resolve
              await storage.updateConversation(conversationRef.id, {
                lastMessage: responseText,
                lastMessageTime: new Date(),
              });
            }

            console.log(`✅ [Evolution] Resposta gerada: ${responseText.substring(0, 100)}...`);
            
            webhookLogger.success('AI_RESPONSE', `Resposta da IA gerada (${conversationRef.assistantType})`, {
              conversationId: conversationRef.id,
              responsePreview: responseText.substring(0, 50),
              transferred: transferred || false,
            });
            
            // Send response back to WhatsApp via Evolution API
            const sendResult = await sendWhatsAppMessage(clientPhoneNumber, responseText, conversationRef.evolutionInstance || undefined);
            if (sendResult.success) {
              webhookLogger.success('MESSAGE_SENT', `Mensagem enviada ao WhatsApp`, {
                phoneNumber: clientPhoneNumber,
                clientName,
              });
              console.log(`📤 [Evolution] Resposta enviada ao WhatsApp com sucesso`);
              // Atualizar última mensagem da IA com IDs do WhatsApp para permitir deleção
              if (sendResult.whatsappMessageId || sendResult.remoteJid) {
                const recentMessages = await storage.getRecentMessagesByConversationId(conversationRef.id, 1);
                if (recentMessages.length > 0 && recentMessages[0].role === 'assistant') {
                  await storage.updateMessage(recentMessages[0].id, {
                    whatsappMessageId: sendResult.whatsappMessageId,
                    remoteJid: sendResult.remoteJid,
                  });
                }
              }
            } else {
              webhookLogger.error('SEND_FAILED', `Falha ao enviar resposta ao WhatsApp`, {
                phoneNumber: clientPhoneNumber,
                clientName,
              });
              console.error(`⚠️  [Evolution] Falha ao enviar resposta ao WhatsApp`);
            }
            
          } catch (error) {
            webhookLogger.error('PROCESSING_ERROR', `Erro ao processar resposta`, {
              error: error instanceof Error ? error.message : String(error),
              conversationId: conversationRef?.id,
            });
            console.error("❌ [Evolution] Erro ao processar resposta:", error);
          }
        })();

        // Return success immediately (processing continues in background)
        return res.json({ 
          success: true, 
          processed: true,
          fallback: true,
          conversationId: conversation.id,
          chatId 
        });
      }
    }

      // Process MESSAGES_UPDATE event (WhatsApp status tracking)
      // Status progression: PENDING → SERVER_ACK → DELIVERY_ACK → READ → ERROR
      if (event === "messages.update") {
        try {
          const statusUpdates = Array.isArray(data) ? data : [data];
          
          for (const update of statusUpdates) {
            const { key, status } = update;
            const { remoteJid, id: whatsappMessageId, fromMe } = key;
            
            if (!status || !whatsappMessageId) {
              console.log(`⚠️ [Evolution Status] Update sem status ou messageId - ignorando`);
              continue;
            }
            
            // Only track status of messages sent by us
            if (!fromMe) {
              continue;
            }
            
            console.log(`📊 [Evolution Status] Atualização de status recebida:`, {
              whatsappMessageId,
              remoteJid,
              status,
              timestamp: new Date().toISOString()
            });
            
            // Update message status in database
            const message = await storage.getMessageByWhatsAppId(whatsappMessageId);
            
            if (message) {
              await storage.updateMessage(message.id, {
                whatsappStatus: status,
                whatsappStatusUpdatedAt: new Date(),
              });
              
              console.log(`✅ [Evolution Status] Status atualizado na mensagem ${message.id}: ${status}`);
              
              // If this message is from a campaign target, update denormalized status
              const conversation = await storage.getConversation(message.conversationId);
              
              if (conversation?.voiceCampaignTargetId) {
                await storage.updateVoiceCampaignTarget(conversation.voiceCampaignTargetId, {
                  lastWhatsappStatus: status,
                  lastWhatsappStatusAt: new Date(),
                });
                
                console.log(`✅ [Evolution Status] Status denormalizado atualizado no target ${conversation.voiceCampaignTargetId}`);
              }
            } else {
              console.log(`⚠️ [Evolution Status] Mensagem não encontrada no banco: ${whatsappMessageId}`);
            }
          }
          
          return res.json({ 
            success: true, 
            processed: true,
            eventType: 'messages.update',
            updatedCount: statusUpdates.length
          });
        } catch (error) {
          console.error(`❌ [Evolution Status] Erro ao processar atualização de status:`, error);
          return res.json({ success: true, processed: false, error: 'status_update_failed' });
        }
      }

      // Process CHATS_* events (metadata synchronization)
      if (event.startsWith("chats.")) {
        const { id, conversationTimestamp, name } = data || {};
        console.log(`💬 [Evolution] Evento de chat: ${event}`, { chatId: id, name });
        
        // Update conversation metadata if chat exists in our system
        if (id && event === "chats.upsert") {
          // CRITICAL: Use parseRemoteJid to properly handle LID (@lid) and regular phones
          // This prevents chatId malformation for WhatsApp Business accounts
          try {
            const parsed = parseRemoteJid(id, name);
            const chatId = parsed.chatId;
            const conversation = await storage.getConversationByChatId(chatId);
            
            if (conversation && name) {
              // Update client name if provided and different
              if (conversation.clientName !== name) {
                await storage.updateConversation(conversation.id, {
                  clientName: name,
                });
                console.log(`✏️  [Evolution] Nome do cliente atualizado: ${name} (chatId: ${chatId})`);
              }
            }
          } catch (error) {
            console.error(`❌ [Evolution] Erro ao processar chats.upsert:`, error);
          }
        }
        
        return res.json({ success: true, processed: true, eventType: event });
      }

      // Process CONTACTS_UPDATE event (automatic contact import from WhatsApp)
      if (event === "contacts.update") {
        try {
          const contacts = Array.isArray(data) ? data : [data];
          let imported = 0;
          let updated = 0;

          for (const contactData of contacts) {
            const { remoteJid, profilePicUrl } = contactData;
            
            if (!remoteJid) continue;

            // CRITICAL: Parse remoteJid to properly handle both regular phones and LID (@lid) Business accounts
            // WhatsApp Business uses @lid suffix, which cannot be processed like regular phones
            try {
              const contactName = contactData.pushName || contactData.name || null;
              const parsed = parseRemoteJid(remoteJid, contactName);
              
              // Skip groups and LID accounts from automatic contact sync
              // LIDs don't have traditional phone numbers and shouldn't be auto-imported as contacts
              if (parsed.type === 'group' || parsed.type === 'lid') {
                console.log(`⏭️  [Contacts Import] Skipping ${parsed.type}: ${remoteJid}`);
                continue;
              }
              
              // For regular phones, ensure we have a normalized phone number
              const phoneNumber = parsed.normalizedPhone;
              if (!phoneNumber) {
                console.warn(`⚠️ [Contacts Import] Could not normalize phone from remoteJid: ${remoteJid}`);
                continue;
              }

              console.log(`📇 [Contacts Import] Processando contato do WhatsApp:`, {
                phoneNumber,
                name: contactName,
                hasProfilePic: !!profilePicUrl
              });

              // Check if contact exists
              const existingContact = await storage.getContactByPhoneNumber(phoneNumber);

              if (!existingContact) {
                // Create new contact from WhatsApp sync
                await storage.createContact({
                  phoneNumber,
                  name: contactName,
                  document: null,
                  lastConversationId: null,
                  lastConversationDate: null,
                  totalConversations: 0,
                  hasRecurringIssues: false,
                  status: 'active',
                });
                imported++;
                console.log(`✅ [Contacts Import] Novo contato importado: ${phoneNumber} (${contactName || 'sem nome'})`);
                
                webhookLogger.success('CONTACT_IMPORTED', `Contato importado do WhatsApp`, {
                  phoneNumber,
                  name: contactName,
                  source: 'whatsapp_sync'
                });
              } else {
                // Update existing contact name if provided and different
                if (contactName && existingContact.name !== contactName) {
                  await storage.updateContact(existingContact.id, {
                    name: contactName,
                  });
                  updated++;
                  console.log(`✏️ [Contacts Import] Contato atualizado: ${phoneNumber} → ${contactName}`);
                  
                  webhookLogger.info('CONTACT_UPDATED', `Nome do contato atualizado`, {
                    phoneNumber,
                    oldName: existingContact.name,
                    newName: contactName,
                    source: 'whatsapp_sync'
                  });
                }
              }
            } catch (parseError) {
              console.error(`❌ [Contacts Import] Erro ao processar contato ${remoteJid}:`, parseError);
              // Continue processing other contacts
            }
          }

          console.log(`📊 [Contacts Import] Sincronização concluída: ${imported} novos, ${updated} atualizados`);
          
          webhookLogger.success('CONTACTS_SYNC_COMPLETED', `Sincronização de contatos concluída`, {
            imported,
            updated,
            total: contacts.length
          });

          return res.json({ 
            success: true, 
            processed: true, 
            imported, 
            updated,
            total: contacts.length 
          });
        } catch (error) {
          console.error(`❌ [Contacts Import] Erro ao importar contatos:`, error);
          webhookLogger.error('CONTACTS_IMPORT_ERROR', `Erro ao importar contatos`, {
            error: error instanceof Error ? error.message : String(error)
          });
          return res.json({ success: true, processed: false, reason: "import_error" });
        }
      }

      // Process other MESSAGES_* events
      if (event.startsWith("messages.")) {
        console.log(`📨 [Evolution] Evento de mensagem: ${event}`);
        // Store for future implementation if needed
        return res.json({ success: true, processed: true, eventType: event });
      }

      // Unknown event type
      console.log(`❓ [Evolution] Evento desconhecido: ${event}`);
      return res.json({ success: true, processed: false, reason: "unknown_event" });

    } catch (error) {
      webhookLogger.error('WEBHOOK_ERROR', 'Erro crítico no webhook', {
        error: error instanceof Error ? error.message : String(error),
      });
      console.error("❌ [Evolution Webhook] Erro:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // DEBUG: Get all conversations (including resolved) for troubleshooting
  app.get("/api/debug/all-conversations", authenticate, requireAdmin, async (req, res) => {
    try {
      const conversations = await storage.getAllConversations();
      return res.json(conversations);
    } catch (error) {
      console.error("Debug conversations error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // DEBUG: Delete conversation by chatId (for testing)
  app.delete("/api/debug/conversation/:chatId", async (req, res) => {
    try {
      await storage.deleteConversation(req.params.chatId);
      return res.json({ success: true, message: "Conversa deletada com sucesso" });
    } catch (error) {
      console.error("Delete conversation error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // DEBUG: Simular fluxo completo de conversa (criar, transferir, finalizar)
  app.post("/api/debug/simulate-conversation", authenticate, requireAdmin, async (req, res) => {
    try {
      console.log("🧪 [DEBUG] Iniciando simulação de conversa completa");
      
      const testChatId = `test_${Date.now()}`;
      const testPhone = "5511999999999";
      const testName = "Cliente Teste";
      
      // 1. Criar conversa inicial
      console.log("📝 [DEBUG] 1. Criando conversa");
      const conversation = await storage.createConversation({
        chatId: testChatId,
        clientName: testName,
        clientId: testPhone,
        status: "active",
        assistantType: "suporte",
        department: "support",
        sentiment: "neutral",
        urgency: "medium",
        lastMessage: "Olá, preciso de ajuda",
        lastMessageTime: new Date(),
        duration: 0,
      });

      // 2. Adicionar mensagens simuladas
      console.log("💬 [DEBUG] 2. Adicionando mensagens");
      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: "Olá, preciso de ajuda com meu produto",
        assistant: null,
      });

      await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: "Olá! Como posso ajudá-lo hoje?",
        assistant: "Suporte Técnico",
      });

      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: "Preciso falar com um atendente humano",
        assistant: null,
      });

      // 3. Transferir para humano
      console.log("🔀 [DEBUG] 3. Transferindo para humano");
      await storage.updateConversation(conversation.id, {
        transferredToHuman: true,
        transferReason: "Cliente solicitou atendimento humano",
        transferredAt: new Date(),
        status: "active", // Mantém ativa após transferência
      });

      await storage.createSupervisorAction({
        conversationId: conversation.id,
        action: "transfer",
        notes: "Cliente solicitou transferência para humano",
        createdBy: "Sistema de Teste",
      });

      // 4. Adicionar mensagem do supervisor
      console.log("👤 [DEBUG] 4. Supervisor respondendo");
      await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: "Olá! Sou um atendente humano. Como posso ajudar?",
        assistant: "Supervisor Manual",
      });

      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: "Obrigado, meu problema foi resolvido!",
        assistant: null,
      });

      // 5. Finalizar conversa
      console.log("✅ [DEBUG] 5. Finalizando conversa");
      await storage.updateConversation(conversation.id, {
        status: "resolved",
        lastMessage: "Obrigado, meu problema foi resolvido!",
        lastMessageTime: new Date(),
        duration: 300, // 5 minutos
      });

      // 6. Buscar conversa completa para retornar
      console.log("📊 [DEBUG] 6. Buscando dados completos");
      const finalConversation = await storage.getConversation(conversation.id);
      const messages = await storage.getMessagesByConversationId(conversation.id);
      const actions = await storage.getActionsByConversationId(conversation.id);

      console.log("✅ [DEBUG] Simulação concluída com sucesso");

      return res.json({
        success: true,
        message: "Fluxo completo simulado com sucesso",
        conversationId: conversation.id,
        chatId: testChatId,
        details: {
          conversation: finalConversation,
          messages: messages,
          actions: actions,
        },
        summary: {
          status: finalConversation?.status,
          transferredToHuman: finalConversation?.transferredToHuman,
          transferReason: finalConversation?.transferReason,
          totalMessages: messages.length,
          totalActions: actions.length,
        }
      });
    } catch (error) {
      console.error("❌ [DEBUG] Erro na simulação:", error);
      return res.status(500).json({ 
        error: "Erro na simulação", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // DEBUG: Testar API de boletos diretamente
  app.post("/api/debug/test-boletos", authenticate, requireAdmin, async (req, res) => {
    try {
      const { cpf } = req.body;
      
      if (!cpf) {
        return res.status(400).json({ error: "CPF é obrigatório" });
      }
      
      console.log(`🧪 [DEBUG] Testando API de boletos para CPF (mascarado): ${cpf.substring(0, 3)}.***.***-**`);
      
      const documentoNormalizado = cpf.replace(/\D/g, '');
      
      // Chamar API externa diretamente
      const startTime = Date.now();
      const response = await fetch("https://webhook.trtelecom.net/webhook/consulta_boleto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documento: documentoNormalizado }),
      });
      
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        console.error(`❌ [DEBUG] API retornou erro HTTP ${response.status}`);
        return res.status(response.status).json({
          success: false,
          error: `API retornou HTTP ${response.status}: ${response.statusText}`,
          duration_ms: duration
        });
      }
      
      const boletos = await response.json();
      
      console.log(`✅ [DEBUG] API respondeu em ${duration}ms com ${boletos?.length || 0} boleto(s)`);
      
      return res.json({
        success: true,
        duration_ms: duration,
        total_boletos: boletos?.length || 0,
        boletos: boletos,
        primeiros_3: boletos?.slice(0, 3).map((b: any) => ({
          nome: b.NOME,
          vencimento: b.DATA_VENCIMENTO,
          valor: b.VALOR_TOTAL,
          status: b.STATUS,
          link: b.link_carne_completo?.substring(0, 50) + '...',
          pix: b.PIX_TXT?.substring(0, 30) + '...'
        }))
      });
    } catch (error) {
      console.error("❌ [DEBUG] Erro ao testar API de boletos:", error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tipo_erro: error instanceof Error ? error.constructor.name : typeof error
      });
    }
  });

  // ADMIN: Resolver conversas transferidas em lote
  app.post("/api/admin/resolve-transferred-conversations", authenticate, requireAdmin, async (req, res) => {
    try {
      const { conversationIds, resolveAll } = req.body;

      let conversationsToResolve: Conversation[] = [];

      if (resolveAll === true) {
        // Buscar todas as conversas transferidas e ativas
        const allTransferred = await storage.getTransferredConversations();
        conversationsToResolve = allTransferred.filter(c => c.status === 'active');
      } else if (conversationIds && Array.isArray(conversationIds)) {
        // Resolver apenas IDs específicos
        conversationsToResolve = await Promise.all(
          conversationIds.map(async (id: string) => {
            const conv = await storage.getConversation(id);
            return conv;
          })
        ).then(convs => convs.filter((c): c is Conversation => c !== undefined));
      } else {
        return res.status(400).json({ 
          error: "Forneça conversationIds (array) ou resolveAll (boolean)" 
        });
      }

      if (conversationsToResolve.length === 0) {
        return res.json({
          success: true,
          message: "Nenhuma conversa para resolver",
          resolved: 0,
          conversations: []
        });
      }

      // Resolver todas as conversas
      const resolved = await Promise.all(
        conversationsToResolve.map(async (conv) => {
          await storage.updateConversation(conv.id, {
            status: "resolved",
            lastMessageTime: new Date(),
            duration: conv.duration || 0,
          });

          // Registrar ação de supervisor
          await storage.createSupervisorAction({
            conversationId: conv.id,
            action: "resolve",
            notes: "Conversa resolvida administrativamente",
            createdBy: "Admin",
          });

          return {
            id: conv.id,
            chatId: conv.chatId,
            clientName: conv.clientName,
          };
        })
      );

      return res.json({
        success: true,
        message: `${resolved.length} conversa(s) resolvida(s) com sucesso`,
        resolved: resolved.length,
        conversations: resolved,
      });
    } catch (error) {
      console.error("❌ [ADMIN] Erro ao resolver conversas:", error);
      return res.status(500).json({ 
        error: "Erro ao resolver conversas", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // ADMIN: Reprocessar mensagens travadas (sem webhook)
  app.post("/api/admin/reprocess-stuck-messages", authenticate, requireAdmin, async (req, res) => {
    try {
      const { conversationIds, assistantType, maxMinutesWaiting } = req.body;

      // Buscar todas conversas ativas
      const allConversations = await storage.getAllActiveConversations();
      
      // Filtrar conversas que estão aguardando resposta
      const stuckConversations = [];
      
      for (const conv of allConversations) {
        // Filtros básicos
        if (conv.status !== 'active') continue;
        
        if (conversationIds && Array.isArray(conversationIds)) {
          if (!conversationIds.includes(conv.id)) continue;
        }
        
        if (assistantType && conv.assistantType !== assistantType) continue;
        
        // Verificar se última mensagem foi do usuário
        const messages = await storage.getMessagesByConversationId(conv.id);
        if (messages.length === 0) continue;
        
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') continue;
        
        // Verificar tempo de espera se especificado
        if (maxMinutesWaiting && conv.lastMessageTime) {
          const minutesWaiting = (Date.now() - conv.lastMessageTime.getTime()) / (1000 * 60);
          if (minutesWaiting > maxMinutesWaiting) continue;
        }
        
        stuckConversations.push({
          conversation: conv,
          lastMessage: lastMessage,
        });
        
        // Limitar a 50 conversas
        if (stuckConversations.length >= 50) break;
      }

      if (stuckConversations.length === 0) {
        return res.json({
          success: true,
          message: "Nenhuma mensagem para reprocessar",
          enqueued: 0,
          conversations: []
        });
      }

      // Importar fila dinamicamente
      const { addMessageToQueue } = await import("./lib/queue");

      // Enfileirar cada mensagem para reprocessamento
      const enqueued = await Promise.all(
        stuckConversations.map(async ({ conversation: conv, lastMessage }) => {
          try {
            // Extrair número do chat_id
            const fromNumber = conv.chatId.replace('whatsapp_', '');

            // Enfileirar mensagem
            await addMessageToQueue({
              chatId: conv.chatId,
              conversationId: conv.id,
              fromNumber: fromNumber,
              message: lastMessage.content,
              messageId: lastMessage.id,
              timestamp: lastMessage.timestamp ? lastMessage.timestamp.getTime() : Date.now(),
              hasImage: !!lastMessage.imageBase64,
              imageUrl: lastMessage.imageBase64 || undefined,
              evolutionInstance: conv.evolutionInstance || 'Leads',
              clientName: conv.clientName || undefined,
              locationLatitude: lastMessage.locationLatitude || undefined,
              locationLongitude: lastMessage.locationLongitude || undefined,
            });

            console.log(`✅ [REPROCESS] Mensagem enfileirada: ${conv.clientName} (${conv.id})`);

            const minutesWaiting = conv.lastMessageTime 
              ? Math.round((Date.now() - conv.lastMessageTime.getTime()) / (1000 * 60))
              : 0;

            return {
              id: conv.id,
              chatId: conv.chatId,
              clientName: conv.clientName,
              assistantType: conv.assistantType,
              minutesWaiting,
            };
          } catch (error) {
            console.error(`❌ [REPROCESS] Erro ao enfileirar conversa ${conv.id}:`, error);
            return null;
          }
        })
      );

      const successfullyEnqueued = enqueued.filter((item): item is NonNullable<typeof item> => item !== null);

      return res.json({
        success: true,
        message: `${successfullyEnqueued.length} mensagem(ns) enfileirada(s) para reprocessamento`,
        enqueued: successfullyEnqueued.length,
        total: stuckConversations.length,
        conversations: successfullyEnqueued,
      });
    } catch (error) {
      console.error("❌ [ADMIN] Erro ao reprocessar mensagens:", error);
      return res.status(500).json({ 
        error: "Erro ao reprocessar mensagens", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // ADMIN: Limpar cache de instruções dos assistants (útil quando atualizar prompts no OpenAI Dashboard)
  app.post("/api/admin/clear-assistant-cache", authenticate, requireAdmin, async (req, res) => {
    try {
      console.log("🗑️ [Admin] Clearing assistant instructions cache...");
      
      // Import the assistantCache from redis-config
      const { assistantCache } = await import("./lib/redis-config");
      
      // Clear cache for all assistant types
      const assistantTypes = ['apresentacao', 'comercial', 'financeiro', 'suporte', 'ouvidoria', 'cancelamento'];
      
      for (const type of assistantTypes) {
        const cacheKey = `instructions:${type}`;
        await assistantCache.delete(cacheKey);
        console.log(`🗑️ [Admin] Cleared cache for ${type}`);
      }
      
      // Also invalidate by tags
      await assistantCache.invalidateByTag('assistant-config');
      
      console.log("✅ [Admin] Assistant instructions cache cleared successfully");
      
      res.json({ 
        success: true, 
        message: "Cache de instruções dos assistants limpo com sucesso. As novas instruções do OpenAI Dashboard serão carregadas na próxima interação.",
        clearedAssistants: assistantTypes
      });
    } catch (error) {
      console.error("❌ [Admin] Error clearing assistant cache:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erro ao limpar cache dos assistants" 
      });
    }
  });

  app.post("/api/admin/close-abandoned-conversations", authenticate, requireAdmin, async (req, res) => {
    try {
      const { minMinutesInactive = 30 } = req.body;

      // Buscar TODAS conversas não-finalizadas (todos status exceto 'resolved')
      const allConversations = await storage.getAllActiveConversations();
      
      const abandonedConversations = allConversations.filter(conv => {
        // Não fechar se já está finalizada
        if (conv.status === 'resolved') return false;
        
        // Não fechar se foi transferida para humano
        if (conv.transferredToHuman) return false;
        
        // Verificar tempo de inatividade
        const minutesInactive = conv.lastMessageTime 
          ? (Date.now() - conv.lastMessageTime.getTime()) / (1000 * 60)
          : 0;
        
        return minutesInactive > minMinutesInactive;
      });

      if (abandonedConversations.length === 0) {
        return res.json({
          success: true,
          message: "Nenhuma conversa abandonada encontrada",
          closed: 0,
          conversations: []
        });
      }

      // Importar funções de fila
      const { addNPSSurveyToQueue } = await import("./lib/queue");

      // Fechar cada conversa e enviar NPS
      const results = await Promise.all(
        abandonedConversations.map(async (conv) => {
          try {
            const minutesInactive = conv.lastMessageTime 
              ? Math.round((Date.now() - conv.lastMessageTime.getTime()) / (1000 * 60))
              : 9999; // Se não tem lastMessageTime, considerar muito tempo inativo

            // 1. Marcar conversa como resolvida (fechada)
            // Usar SQL direto para mesclar metadata corretamente no PostgreSQL
            const { db } = await import("./db");
            const { sql } = await import("drizzle-orm");
            const { conversations } = await import("@shared/schema");
            const { eq } = await import("drizzle-orm");

            const newMetadata = {
              autoClosed: true,
              autoClosedReason: 'admin_abandoned_cleanup',
              autoClosedAt: new Date().toISOString(),
              minutesInactiveWhenClosed: minutesInactive,
              npsSent: true,
              npsScheduledAt: new Date().toISOString(),
            };

            await db.update(conversations)
              .set({
                status: 'resolved',
                metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(newMetadata)}::jsonb`,
              })
              .where(eq(conversations.id, conv.id));

            // 2. Enviar mensagem de encerramento (opcional - descomente se quiser)
            // const closureMessage = `A conversa foi encerrada por inatividade. Se precisar de ajuda, é só chamar novamente! 😊`;
            // await sendWhatsAppMessage(conv.chatId, closureMessage, conv.evolutionInstance);

            // 3. Agendar envio de NPS (delay de 5 segundos para dar tempo de processar)
            await addNPSSurveyToQueue({
              conversationId: conv.id,
              chatId: conv.chatId,
              customerName: conv.clientName || 'Cliente',
              wasResolved: false, // Consideramos não resolvida pois foi abandonada
              evolutionInstance: conv.evolutionInstance ?? undefined, // 🔧 FIX: Pass instance to ensure NPS uses correct Evolution API instance
            }, 5000);

            console.log(`✅ [ADMIN] Conversa fechada: ${conv.clientName} (${minutesInactive}min inativa)`);

            return {
              id: conv.id,
              chatId: conv.chatId,
              clientName: conv.clientName,
              assistantType: conv.assistantType,
              minutesInactive,
              npsSent: true,
            };
          } catch (error) {
            console.error(`❌ [ADMIN] Erro ao fechar conversa ${conv.id}:`, error);
            return null;
          }
        })
      );

      const successfullyClosed = results.filter((item): item is NonNullable<typeof item> => item !== null);

      return res.json({
        success: true,
        message: `${successfullyClosed.length} conversa(s) fechada(s) e NPS agendado`,
        closed: successfullyClosed.length,
        total: abandonedConversations.length,
        conversations: successfullyClosed,
      });
    } catch (error) {
      console.error("❌ [ADMIN] Erro ao fechar conversas abandonadas:", error);
      return res.status(500).json({ 
        error: "Erro ao fechar conversas abandonadas", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Auto-resolve old stuck conversations (admin tool)
  app.post("/api/admin/auto-resolve-old-conversations", authenticate, requireAdmin, async (req, res) => {
    try {
      const { minDaysOld = 7, dryRun = false } = req.body;

      // Buscar conversas antigas travadas: ativas, não transferidas, criadas há mais de X dias
      const { db } = await import("./db");
      const { conversations } = await import("@shared/schema");
      const { sql, and, eq } = await import("drizzle-orm");

      const oldConversations = await db.select()
        .from(conversations)
        .where(
          and(
            eq(conversations.status, 'active'),
            eq(conversations.transferredToHuman, false),
            sql`EXTRACT(EPOCH FROM (NOW() - ${conversations.createdAt})) / 86400 > ${minDaysOld}`
          )
        )
        .limit(100); // Segurança: limitar a 100 conversas por vez

      if (oldConversations.length === 0) {
        return res.json({
          success: true,
          message: `Nenhuma conversa ativa com mais de ${minDaysOld} dias encontrada`,
          resolved: 0,
          conversations: []
        });
      }

      // Se for dry run, apenas retornar lista sem fazer mudanças
      if (dryRun) {
        return res.json({
          success: true,
          message: `[DRY RUN] ${oldConversations.length} conversas seriam resolvidas`,
          resolved: 0,
          conversations: oldConversations.map(conv => ({
            id: conv.id,
            clientName: conv.clientName,
            assistantType: conv.assistantType,
            daysOld: conv.createdAt ? Math.floor((Date.now() - conv.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
            createdAt: conv.createdAt,
            lastMessageTime: conv.lastMessageTime,
          }))
        });
      }

      // Importar funções de fila
      const { addNPSSurveyToQueue } = await import("./lib/queue");

      // Resolver cada conversa e enviar NPS
      const results = await Promise.all(
        oldConversations.map(async (conv) => {
          try {
            const daysOld = conv.createdAt ? Math.floor((Date.now() - conv.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;

            // Marcar conversa como resolvida
            const newMetadata = {
              autoClosed: true,
              autoClosedReason: 'admin_old_conversation_cleanup',
              autoClosedAt: new Date().toISOString(),
              daysOldWhenClosed: daysOld,
              npsSent: true,
              npsScheduledAt: new Date().toISOString(),
            };

            await db.update(conversations)
              .set({
                status: 'resolved',
                resolvedAt: new Date(),
                autoClosed: true,
                autoClosedReason: 'admin_old_conversation_cleanup',
                autoClosedAt: new Date(),
                metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(newMetadata)}::jsonb`,
              })
              .where(eq(conversations.id, conv.id));

            // Agendar envio de NPS
            await addNPSSurveyToQueue({
              conversationId: conv.id,
              chatId: conv.chatId,
              customerName: conv.clientName || 'Cliente',
              wasResolved: false, // Consideramos não resolvida pois foi abandonada
              evolutionInstance: conv.evolutionInstance ?? undefined,
            }, 5000);

            console.log(`✅ [ADMIN] Conversa antiga resolvida: ${conv.clientName} (${daysOld} dias)`);

            return {
              id: conv.id,
              chatId: conv.chatId,
              clientName: conv.clientName,
              assistantType: conv.assistantType,
              daysOld,
              npsSent: true,
            };
          } catch (error) {
            console.error(`❌ [ADMIN] Erro ao resolver conversa ${conv.id}:`, error);
            return null;
          }
        })
      );

      const successfullyResolved = results.filter((item): item is NonNullable<typeof item> => item !== null);

      return res.json({
        success: true,
        message: `${successfullyResolved.length} conversa(s) antiga(s) resolvida(s) e NPS agendado`,
        resolved: successfullyResolved.length,
        total: oldConversations.length,
        conversations: successfullyResolved,
      });
    } catch (error) {
      console.error("❌ [ADMIN] Erro ao resolver conversas antigas:", error);
      return res.status(500).json({ 
        error: "Erro ao resolver conversas antigas", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // ADMIN: List conversations where client sent last message but AI didn't respond
  app.get("/api/admin/unanswered-conversations", authenticate, requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      // Query conversations where last message is from user (client)
      const unansweredConvs = await db.execute(sql`
        WITH last_messages AS (
          SELECT DISTINCT ON (m.conversation_id)
            m.conversation_id,
            m.role,
            m.content,
            m.timestamp,
            m.whatsapp_status
          FROM messages m
          WHERE m.deleted_at IS NULL
          ORDER BY m.conversation_id, m.timestamp DESC
        )
        SELECT 
          c.id,
          c.chat_id,
          c.client_name,
          c.status,
          c.last_message_time,
          lm.role as last_message_role,
          LEFT(lm.content, 200) as last_message_preview,
          lm.whatsapp_status,
          EXTRACT(EPOCH FROM (NOW() - c.last_message_time))/60 AS minutes_ago
        FROM conversations c
        INNER JOIN last_messages lm ON lm.conversation_id = c.id
        WHERE 
          lm.role = 'user'
          AND c.status IN ('active', 'transferred')
          AND c.last_message_time > NOW() - INTERVAL '2 hours'
        ORDER BY c.last_message_time DESC
        LIMIT 50
      `);

      return res.json(unansweredConvs.rows || []);
    } catch (error) {
      console.error("❌ [ADMIN] Erro ao buscar conversas sem resposta:", error);
      return res.status(500).json({ 
        error: "Erro ao buscar conversas sem resposta", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // ADMIN: Reprocess a conversation by adding last client message back to queue
  app.post("/api/admin/reprocess-conversation/:id", authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const { db } = await import("./db");
      const { conversations, messages } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      // Get conversation
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      // Get last user message
      const lastUserMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(desc(messages.timestamp))
        .limit(10);

      const lastUserMessage = lastUserMessages.find(m => m.role === 'user');

      if (!lastUserMessage) {
        return res.status(404).json({ error: "Nenhuma mensagem do cliente encontrada" });
      }

      // Add message back to processing queue
      const { Queue } = await import("bullmq");
      const { redisConnection } = await import("./lib/redis-config");

      const queue = new Queue('message-processing', {
        connection: redisConnection
      });

      const job = await queue.add('process-message', {
        conversationId: conversation.id,
        fromNumber: conversation.chatId.replace('whatsapp_', ''),
        content: lastUserMessage.content,
        idempotencyKey: `reprocess_${id}_${Date.now()}`,
        evolutionInstance: conversation.evolutionInstance || 'Leads',
        hasImage: !!lastUserMessage.imageBase64,
        imageBase64: lastUserMessage.imageBase64 || undefined,
      });

      console.log(`✅ [ADMIN] Conversa ${id} (${conversation.clientName}) adicionada para reprocessamento - Job: ${job.id}`);

      return res.json({
        success: true,
        message: `Conversa de ${conversation.clientName} adicionada à fila para reprocessamento`,
        jobId: job.id,
        conversation: {
          id: conversation.id,
          clientName: conversation.clientName,
          lastMessage: lastUserMessage.content?.substring(0, 100),
        }
      });
    } catch (error) {
      console.error("❌ [ADMIN] Erro ao reprocessar conversa:", error);
      return res.status(500).json({ 
        error: "Erro ao reprocessar conversa", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Get latency metrics (P50, P95, P99) - PUBLIC ROUTE
  app.get("/api/monitor/latency", async (req, res) => {
    try {
      const { getLatencyMetrics } = await import("./lib/latency-tracker");
      const metrics = await getLatencyMetrics(1000);
      
      return res.json(metrics);
    } catch (error) {
      console.error("❌ [Latency API] Error:", error);
      return res.status(500).json({ error: "Failed to fetch latency metrics" });
    }
  });

  // Get all active conversations for monitoring (includes resolved from last 24h)
  app.get("/api/monitor/conversations", authenticateWithTracking, async (req, res) => {
    try {
      const conversations = await storage.getMonitorConversations();
      
      const conversationsWithMessages = await Promise.all(
        conversations.map(async (conv) => {
          // Optimized: Get only the last 10 messages from database (DESC order - newest first)
          const recentMessages = await storage.getRecentMessagesByConversationId(conv.id, 10);
          
          // Since messages come in DESC order, the first match is the most recent
          const lastClientMessage = recentMessages
            .filter(m => m.role === 'user')[0];
          
          const lastAIMessage = recentMessages
            .filter(m => m.role === 'assistant')[0];
          
          return {
            ...conv,
            lastClientMessage: lastClientMessage?.content || null,
            lastAIMessage: lastAIMessage?.content || null,
          };
        })
      );
      
      return res.json(conversationsWithMessages);
    } catch (error) {
      console.error("Monitor error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all conversations history (paginated - for historical review)
  app.get("/api/monitor/conversations/history/all", authenticateWithTracking, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const search = req.query.search as string | undefined;

      const { conversations, total } = await storage.getAllConversationsHistory({ 
        limit, 
        offset,
        search 
      });
      
      const conversationsWithMessages = await Promise.all(
        conversations.map(async (conv) => {
          // Optimized: Get only the last 10 messages from database (DESC order - newest first)
          const recentMessages = await storage.getRecentMessagesByConversationId(conv.id, 10);
          
          // Since messages come in DESC order, the first match is the most recent
          const lastClientMessage = recentMessages
            .filter(m => m.role === 'user')[0];
          
          const lastAIMessage = recentMessages
            .filter(m => m.role === 'assistant')[0];
          
          return {
            ...conv,
            lastClientMessage: lastClientMessage?.content || null,
            lastAIMessage: lastAIMessage?.content || null,
          };
        })
      );
      
      return res.json({
        conversations: conversationsWithMessages,
        total,
        limit,
        offset
      });
    } catch (error) {
      console.error("Monitor history error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get conversation details
  app.get("/api/monitor/conversations/:id", authenticateWithTracking, async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Suporte a paginação de mensagens
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;
      const before = req.query.before as string | undefined;
      
      const { messages, hasMore } = await storage.getMessagesPaginated(conversation.id, { limit, before });
      
      // Debug: verificar PDFs (buscar por content também para encontrar "[Documento recebido]")
      const pdfMessages = messages.filter(m => m.pdfName || m.pdfBase64 || m.content?.includes('Documento'));
      if (pdfMessages.length > 0) {
        console.log(`📄 [API Debug - BEFORE JSON] Found ${pdfMessages.length} PDF-related messages:`, 
          pdfMessages.map(m => ({ 
            id: m.id, 
            pdfName: m.pdfName, 
            hasPdfBase64: !!m.pdfBase64,
            pdfBase64Length: m.pdfBase64?.length || 0,
            contentPreview: m.content?.substring(0, 50),
            pdfBase64Preview: m.pdfBase64?.substring(0, 30)
          }))
        );
      }
      
      const alerts = await storage.getAlertsByConversationId(conversation.id);
      const actions = await storage.getActionsByConversationId(conversation.id);

      // Desabilitar cache HTTP para garantir dados sempre atualizados
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Debug: log tamanho do JSON antes de enviar
      const responseData = {
        conversation,
        messages,
        hasMore,
        alerts,
        actions,
      };
      
      const jsonString = JSON.stringify(responseData);
      const jsonSizeKB = (jsonString.length / 1024).toFixed(2);
      console.log(`📊 [API Response Size] Sending ${jsonSizeKB}KB of JSON with ${messages.length} messages`);
      
      // Debug: verificar se PDF está no JSON final
      const jsonWithPdfs = messages.filter(m => jsonString.includes(m.id) && m.pdfBase64);
      if (jsonWithPdfs.length > 0) {
        console.log(`✅ [API JSON Check] ${jsonWithPdfs.length} PDFs ARE in final JSON string`);
      }

      res.setHeader('X-Response-Size-KB', jsonSizeKB);
      return res.json(responseData);
    } catch (error) {
      console.error("Conversation details error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get active alerts
  app.get("/api/monitor/alerts", authenticateWithTracking, async (req, res) => {
    try {
      const alerts = await storage.getActiveAlerts();
      return res.json(alerts);
    } catch (error) {
      console.error("Alerts error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/monitor/context-quality - Context quality monitoring stats
  app.get("/api/monitor/context-quality", authenticateWithTracking, async (req, res) => {
    try {
      const { ContextMonitor } = await import("./lib/context-monitor");
      
      const hours = parseInt(req.query.hours as string) || 24;
      const stats = await ContextMonitor.getStats(hours);
      const recentAlerts = await ContextMonitor.getRecentAlerts(hours);
      
      return res.json({
        stats,
        recentAlerts: recentAlerts.slice(0, 50), // Limitar a 50 alertas mais recentes
        period: `${hours}h`,
      });
    } catch (error) {
      console.error("Error fetching context quality stats:", error);
      return res.status(500).json({ error: "Failed to fetch context quality stats" });
    }
  });

  // POST /api/monitor/context-quality/test - Injeta alertas de teste (apenas DEV)
  app.post("/api/monitor/context-quality/test", authenticate, requireAdminOrSupervisor, async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: "Test endpoint only available in development" });
    }
    
    try {
      const { ContextMonitor } = await import("./lib/context-monitor");
      
      // Injetar alertas de teste para cada assistente
      const testAlerts = [
        {
          conversationId: 'test-conv-1',
          alertType: 'duplicate_data_request',
          severity: 'high' as const,
          description: 'Assistente pediu CPF que cliente já forneceu anteriormente',
          detectedAt: new Date(),
          assistantType: 'financeiro',
          metadata: { requestedData: 'cpf' },
        },
        {
          conversationId: 'test-conv-2',
          alertType: 'ignored_history',
          severity: 'medium' as const,
          description: 'Assistente enviou saudação genérica ignorando 12 mensagens anteriores',
          detectedAt: new Date(Date.now() - 60000),
          assistantType: 'suporte',
          metadata: { conversationLength: 12 },
        },
        {
          conversationId: 'test-conv-3',
          alertType: 'duplicate_routing',
          severity: 'medium' as const,
          description: 'Detectados 3 roteamentos consecutivos (pode indicar confusão do assistente)',
          detectedAt: new Date(Date.now() - 120000),
          assistantType: 'apresentacao',
          metadata: { recentRoutings: ['rotear1', 'rotear2', 'rotear3'] },
        },
        {
          conversationId: 'test-conv-4',
          alertType: 'context_reset',
          severity: 'high' as const,
          description: 'Assistente alegou não ter informações apesar de 15 mensagens disponíveis',
          detectedAt: new Date(Date.now() - 180000),
          assistantType: 'comercial',
          metadata: { availableMessages: 15 },
        },
        {
          conversationId: 'test-conv-5',
          alertType: 'duplicate_data_request',
          severity: 'high' as const,
          description: 'Assistente pediu CNPJ que cliente já forneceu anteriormente',
          detectedAt: new Date(Date.now() - 240000),
          assistantType: 'ouvidoria',
          metadata: { requestedData: 'cnpj' },
        },
        {
          conversationId: 'test-conv-6',
          alertType: 'ignored_history',
          severity: 'medium' as const,
          description: 'Assistente enviou saudação genérica ignorando 8 mensagens anteriores',
          detectedAt: new Date(Date.now() - 300000),
          assistantType: 'cancelamento',
          metadata: { conversationLength: 8 },
        },
      ];
      
      // Injetar alertas diretamente no ContextMonitor
      testAlerts.forEach(alert => {
        (ContextMonitor as any).alerts.push(alert);
      });
      
      console.log(`✅ [Test] Injected ${testAlerts.length} test alerts`);
      
      return res.json({ 
        success: true, 
        injectedAlerts: testAlerts.length,
        message: 'Test alerts injected successfully' 
      });
    } catch (error) {
      console.error("Error injecting test alerts:", error);
      return res.status(500).json({ error: "Failed to inject test alerts" });
    }
  });

  // DELETE /api/monitor/context-quality/test - Limpa alertas de teste (apenas DEV)
  app.delete("/api/monitor/context-quality/test", authenticate, requireAdminOrSupervisor, async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: "Test endpoint only available in development" });
    }
    
    try {
      const { ContextMonitor } = await import("./lib/context-monitor");
      
      // Remover apenas alertas de teste (conversationId começa com 'test-conv-')
      const beforeCount = (ContextMonitor as any).alerts.length;
      (ContextMonitor as any).alerts = (ContextMonitor as any).alerts.filter(
        (alert: any) => !alert.conversationId.startsWith('test-conv-')
      );
      const afterCount = (ContextMonitor as any).alerts.length;
      const removedCount = beforeCount - afterCount;
      
      console.log(`✅ [Test] Removed ${removedCount} test alerts`);
      
      return res.json({ 
        success: true, 
        removedAlerts: removedCount,
        message: 'Test alerts cleared successfully' 
      });
    } catch (error) {
      console.error("Error clearing test alerts:", error);
      return res.status(500).json({ error: "Failed to clear test alerts" });
    }
  });

  // POST /api/monitor/context-quality/suggest-fix - Gera sugestões de correção de prompt
  app.post("/api/monitor/context-quality/suggest-fix", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { ContextMonitor } = await import("./lib/context-monitor");
      const { generatePromptSuggestions } = await import("./lib/prompt-suggestions");
      
      const { assistantType, hours } = req.body;
      
      if (!assistantType) {
        return res.status(400).json({ error: "assistantType é obrigatório" });
      }

      const period = hours || 24;
      const allAlerts = await ContextMonitor.getRecentAlerts(period);
      
      // Filtrar alertas por tipo de assistente (se disponível no metadata)
      // Por enquanto, usar todos os alertas
      const relevantAlerts = allAlerts;

      if (relevantAlerts.length === 0) {
        return res.status(200).json({
          message: "Nenhum alerta encontrado para gerar sugestões",
          suggestion: null
        });
      }

      // Buscar prompt atual do assistente
      const prompt = await storage.getPromptTemplateByAssistantType(assistantType);
      const currentPromptContent = prompt?.content;

      console.log(`🔍 [Prompt Suggestions] Gerando sugestão para ${assistantType} com ${relevantAlerts.length} alertas`);

      const suggestion = await generatePromptSuggestions(
        relevantAlerts,
        assistantType,
        currentPromptContent
      );

      return res.json({
        suggestion,
        alertsAnalyzed: relevantAlerts.length
      });

    } catch (error) {
      console.error("❌ [Prompt Suggestions] Error generating suggestions:", error);
      return res.status(500).json({ error: "Erro ao gerar sugestões de correção" });
    }
  });

  // Supervisor actions
  app.post("/api/supervisor/transfer", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { conversationId, department, notes, supervisorId } = req.body;

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "transfer",
        notes: `Transfer to ${department}: ${notes}`,
        createdBy: supervisorId || "supervisor",
      });

      const conversation = await storage.getConversation(conversationId);

      // Map department names to conversation department codes
      const departmentMapping: Record<string, string> = {
        'Suporte Técnico': 'support',
        'Suporte': 'support',
        'Comercial': 'commercial',
        'Financeiro': 'financial',
        'Financial': 'financial',
        'Ouvidoria': 'cancellation',
        'Cancelamento': 'cancellation',
        'Suporte Geral': 'support',
      };
      
      const mappedDepartment = department 
        ? (departmentMapping[department] || 'support')
        : 'support';

      // Transferência manual vai para a aba "Conversas" (transferredToHuman = true)
      // Atualiza department para que a conversa apareça corretamente na lista de transferidas
      await storage.updateConversation(conversationId, {
        status: "active",
        transferredToHuman: true,
        department: mappedDepartment,
        transferReason: `Transferência manual: ${notes}`,
        transferredAt: new Date(),
        metadata: {
          ...(typeof conversation?.metadata === 'object' && conversation?.metadata !== null ? conversation.metadata : {}),
          transferred: true,
          transferredTo: department,
          transferredAt: new Date().toISOString(),
          transferNotes: notes,
        },
      });

      console.log(`👤 [Manual Transfer] Conversa ${conversationId} transferida para humanos (aba Conversas) - departamento: ${department}`);

      // Create learning event for AI failure (transfer needed)
      if (conversation) {
        const messages = await storage.getMessagesByConversationId(conversationId);
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const lastAiMessage = messages.filter(m => m.role === 'assistant').pop();

        if (lastUserMessage && lastAiMessage) {
          await storage.createLearningEvent({
            conversationId,
            eventType: 'explicit_correction',
            assistantType: conversation.assistantType,
            userMessage: lastUserMessage.content,
            aiResponse: lastAiMessage.content,
            feedback: notes, // Supervisor notes explain why transfer was needed
            sentiment: conversation.sentiment || 'neutral',
            resolution: 'corrected',
          });
          console.log("📚 [Learning] Evento de transferência criado para", conversation.assistantType);
        }
      }

      return res.json({ success: true, action });
    } catch (error) {
      console.error("Transfer error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/supervisor/pause", authenticate, requireAdmin, async (req, res) => {
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

  app.post("/api/supervisor/note", authenticate, requireAnyRole("ADMIN", "SUPERVISOR", "AGENT"), async (req, res) => {
    try {
      const { conversationId, note, supervisorId } = req.body;
      
      // Usar informações do usuário autenticado
      const currentUser = req.user;
      const createdBy = currentUser?.fullName || currentUser?.username || supervisorId || "supervisor";

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "add_note",
        notes: note,
        createdBy,
      });

      console.log(`✅ [Notes] Nota adicionada por ${createdBy} (${currentUser?.role}) na conversa ${conversationId}`);

      return res.json({ success: true, action });
    } catch (error) {
      console.error("❌ [Notes] Error:", error);
      return res.status(500).json({ error: "Erro ao adicionar nota interna" });
    }
  });

  app.post("/api/supervisor/resolve", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { conversationId, supervisorId } = req.body;

      const action = await storage.createSupervisorAction({
        conversationId,
        action: "mark_resolved",
        notes: "Conversation marked as resolved",
        createdBy: supervisorId || "supervisor",
      });

      const conversation = await storage.getConversation(conversationId);
      
      // Preparar metadata para aguardar NPS se for WhatsApp
      const currentMetadata = conversation?.metadata as any || {};
      const isWhatsApp = currentMetadata?.source === 'evolution_api';
      
      await storage.updateConversation(conversationId, {
        status: "resolved",
        resolvedAt: new Date(),
        assignedTo: null, // Desatribuir conversa ao finalizar
        transferredToHuman: false, // Limpar flag de transferência ao finalizar
        metadata: isWhatsApp ? { ...currentMetadata, awaitingNPS: true } : currentMetadata,
      });

      // Create learning event for successful resolution
      if (conversation) {
        const messages = await storage.getMessagesByConversationId(conversationId);
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const lastAiMessage = messages.filter(m => m.role === 'assistant').pop();

        if (lastUserMessage && lastAiMessage) {
          await storage.createLearningEvent({
            conversationId,
            eventType: 'implicit_success',
            assistantType: conversation.assistantType,
            userMessage: lastUserMessage.content,
            aiResponse: lastAiMessage.content,
            sentiment: conversation.sentiment || 'positive',
            resolution: 'success',
          });
          console.log("📚 [Learning] Evento de sucesso criado para", conversation.assistantType);
        }

        // Enviar pesquisa NPS para cliente via WhatsApp
        const metadata = conversation.metadata as any;
        if (metadata?.source === 'evolution_api' && conversation.clientId) {
          const npsMessage = `Olá ${conversation.clientName}!
Seu atendimento foi finalizado.

Pesquisa de Satisfação

Em uma escala de 0 a 10, qual a satisfação com atendimento?

Digite um número de 0 (muito insatisfeito) a 10 (muito satisfeito)`;

          const sent = await sendWhatsAppMessage(conversation.clientId, npsMessage, conversation.evolutionInstance || undefined);
          if (sent) {
            console.log(`📊 [NPS] Pesquisa enviada para ${conversation.clientName} (${conversation.clientId})`);
          }
        }
      }

      return res.json({ success: true, action });
    } catch (error) {
      console.error("Resolve error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bulk resolve all active conversations
  app.post("/api/supervisor/resolve-all", authenticate, requireAdmin, async (req, res) => {
    try {
      const { supervisorId = "admin" } = req.body;

      // Buscar todas as conversas (vamos filtrar manualmente)
      const allConversations = await storage.getAllConversations();
      const activeConversations = allConversations.filter(
        c => c.status === 'active' || c.status === 'transferred' || c.status === 'assigned' || c.status === 'queued'
      );

      console.log(`🔄 [Bulk Resolve] Iniciando finalização de ${activeConversations.length} conversas...`);

      let successCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      // Resolver cada conversa
      for (const conversation of activeConversations) {
        try {
          // Criar ação de supervisor
          await storage.createSupervisorAction({
            conversationId: conversation.id,
            action: "mark_resolved",
            notes: "Bulk resolution - End of day cleanup",
            createdBy: supervisorId,
          });

          // Preparar metadata para aguardar NPS se for WhatsApp
          const currentMetadata = conversation.metadata as any || {};
          const isWhatsApp = currentMetadata?.source === 'evolution_api';

          // Atualizar status da conversa
          await storage.updateConversation(conversation.id, {
            status: "resolved",
            resolvedAt: new Date(),
            assignedTo: null,
            transferredToHuman: false,
            metadata: isWhatsApp ? { ...currentMetadata, awaitingNPS: true } : currentMetadata,
          });

          // Criar evento de aprendizado
          const messages = await storage.getMessagesByConversationId(conversation.id);
          const lastUserMessage = messages.filter(m => m.role === 'user').pop();
          const lastAiMessage = messages.filter(m => m.role === 'assistant').pop();

          if (lastUserMessage && lastAiMessage) {
            await storage.createLearningEvent({
              conversationId: conversation.id,
              eventType: 'implicit_success',
              assistantType: conversation.assistantType,
              userMessage: lastUserMessage.content,
              aiResponse: lastAiMessage.content,
              sentiment: conversation.sentiment || 'neutral',
              resolution: 'success',
            });
          }

          // Enviar pesquisa NPS para WhatsApp
          const metadata = conversation.metadata as any;
          if (metadata?.source === 'evolution_api' && conversation.clientId) {
            const npsMessage = `Olá ${conversation.clientName}!
Seu atendimento foi finalizado.

Pesquisa de Satisfação

Em uma escala de 0 a 10, qual a satisfação com atendimento?

Digite um número de 0 (muito insatisfeito) a 10 (muito satisfeito)`;

            await sendWhatsAppMessage(conversation.clientId, npsMessage, conversation.evolutionInstance || undefined);
          }

          successCount++;
          console.log(`✅ [Bulk Resolve] Conversa ${conversation.id} (${conversation.clientName}) finalizada`);
        } catch (err) {
          errorCount++;
          errors.push({
            conversationId: conversation.id,
            clientName: conversation.clientName,
            error: err instanceof Error ? err.message : String(err)
          });
          console.error(`❌ [Bulk Resolve] Erro ao finalizar ${conversation.id}:`, err);
        }
      }

      console.log(`✅ [Bulk Resolve] Finalização completa: ${successCount} sucesso, ${errorCount} erros`);

      return res.json({
        success: true,
        total: activeConversations.length,
        resolved: successCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Bulk resolve error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Knowledge base search
  app.post("/api/knowledge/search", authenticate, async (req, res) => {
    try {
      // OTIMIZAÇÃO DE CUSTO: Reduzido default topK de 20 para 5 (75% menos tokens RAG)
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

  // List all knowledge base documents (best-effort using parallel semantic searches)
  app.get("/api/knowledge/list-all", authenticate, async (req, res) => {
    try {
      const { searchKnowledge } = await import("./lib/upstash");
      
      // Queries abrangentes para cobrir diferentes categorias
      const queries = [
        "TR Telecom",
        "internet fibra",
        "pagamento boleto",
        "suporte técnico",
        "planos comercial",
        "financeiro fatura",
        "cancelamento",
        "ouvidoria",
        "instalação",
        "cliente",
        "serviço",
        "problemas",
        "cobrança",
        "velocidade",
        "conexão"
      ];
      
      // Executar todas as queries em paralelo
      const searchPromises = queries.map(query => searchKnowledge(query, 100));
      const allResults = await Promise.all(searchPromises);
      
      // Deduplicate by chunk ID
      const uniqueChunks = new Map();
      allResults.forEach(results => {
        results.forEach(result => {
          if (!uniqueChunks.has(result.chunk.id)) {
            uniqueChunks.set(result.chunk.id, result);
          }
        });
      });
      
      const documents = Array.from(uniqueChunks.values())
        .sort((a, b) => (a.chunk.name || "").localeCompare(b.chunk.name || ""));
      
      console.log(`📚 [Knowledge] Listed ${documents.length} unique documents`);
      return res.json(documents);
    } catch (error) {
      console.error("List all knowledge error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add knowledge chunks
  app.post("/api/knowledge/add", authenticate, requireAdminOrSupervisor, async (req, res) => {
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
  app.post("/api/knowledge/populate", authenticate, requireAdmin, async (req, res) => {
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
  app.post("/api/knowledge/clear", authenticate, requireAdmin, async (req, res) => {
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
  app.delete("/api/knowledge/:id", authenticate, requireAdminOrSupervisor, async (req, res) => {
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

  // ==================== RAG ANALYTICS ROUTES ====================

  // Get RAG analytics summary with date range
  app.get("/api/rag-analytics/summary", authenticate, requireAdmin, async (req, res) => {
    try {
      // Validate date parameters
      const startParam = req.query.start as string | undefined;
      const endParam = req.query.end as string | undefined;
      
      let startDate: Date;
      let endDate: Date;
      
      if (startParam) {
        startDate = new Date(startParam);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ error: "Invalid start date format" });
        }
      } else {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
      }
      
      if (endParam) {
        endDate = new Date(endParam);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ error: "Invalid end date format" });
        }
      } else {
        endDate = new Date();
      }
      
      // Validate date range
      if (startDate > endDate) {
        return res.status(400).json({ error: "Start date must be before end date" });
      }
      
      const summary = await storage.getRagAnalyticsSummary(startDate, endDate);
      return res.json(summary);
    } catch (error) {
      console.error("Get RAG analytics summary error:", error);
      return res.status(500).json({ error: "Failed to retrieve RAG analytics summary" });
    }
  });

  // Get RAG analytics by conversation (requires admin or ownership)
  app.get("/api/rag-analytics/conversation/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }
      
      // Verify user has access to this conversation
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Only ADMIN or assigned agent can view analytics
      const user = req.user!;
      if (user.role !== 'ADMIN' && conversation.assignedTo !== user.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const analytics = await storage.getRagAnalyticsByConversation(id);
      return res.json(analytics);
    } catch (error) {
      console.error("Get RAG analytics by conversation error:", error);
      return res.status(500).json({ error: "Failed to retrieve RAG analytics" });
    }
  });

  // Get all RAG analytics with date range filter (ADMIN only)
  app.get("/api/rag-analytics", authenticate, requireAdmin, async (req, res) => {
    try {
      // Validate date parameters
      const startParam = req.query.start as string | undefined;
      const endParam = req.query.end as string | undefined;
      
      let startDate: Date;
      let endDate: Date;
      
      if (startParam) {
        startDate = new Date(startParam);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ error: "Invalid start date format" });
        }
      } else {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
      }
      
      if (endParam) {
        endDate = new Date(endParam);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ error: "Invalid end date format" });
        }
      } else {
        endDate = new Date();
      }
      
      // Validate date range
      if (startDate > endDate) {
        return res.status(400).json({ error: "Start date must be before end date" });
      }
      
      const analytics = await storage.getRagAnalyticsByDateRange(startDate, endDate);
      return res.json(analytics);
    } catch (error) {
      console.error("Get RAG analytics error:", error);
      return res.status(500).json({ error: "Failed to retrieve RAG analytics" });
    }
  });

  // ==================== LEARNING SYSTEM ROUTES ====================

  // Create learning event
  app.post("/api/learning/events", authenticate, async (req, res) => {
    try {
      const validatedData = insertLearningEventSchema.parse(req.body);
      const event = await storage.createLearningEvent(validatedData);
      return res.json(event);
    } catch (error) {
      console.error("Create learning event error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get learning events by conversation
  app.get("/api/learning/events/:conversationId", authenticate, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const events = await storage.getLearningEventsByConversationId(conversationId);
      return res.json(events);
    } catch (error) {
      console.error("Get learning events error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get recent learning events for analysis
  app.get("/api/learning/events", authenticate, requireAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const events = await storage.getRecentLearningEvents(limit);
      return res.json(events);
    } catch (error) {
      console.error("Get recent learning events error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all prompt suggestions
  app.get("/api/learning/suggestions", authenticate, requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const suggestions = status 
        ? await storage.getPromptSuggestionsByStatus(status)
        : await storage.getAllPromptSuggestions();
      return res.json(suggestions);
    } catch (error) {
      console.error("Get suggestions error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single prompt suggestion
  app.get("/api/learning/suggestions/:id", authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const suggestion = await storage.getPromptSuggestion(id);
      if (!suggestion) {
        return res.status(404).json({ error: "Suggestion not found" });
      }
      return res.json(suggestion);
    } catch (error) {
      console.error("Get suggestion error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update prompt suggestion (approve/reject)
  app.put("/api/learning/suggestions/:id", authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reviewedBy, reviewNotes } = req.body;
      
      const updated = await storage.updatePromptSuggestion(id, {
        status,
        reviewedBy,
        reviewNotes,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Suggestion not found" });
      }
      
      return res.json(updated);
    } catch (error) {
      console.error("Update suggestion error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Apply prompt suggestion (update assistant)
  app.post("/api/learning/suggestions/:id/apply", authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { appliedBy } = req.body;
      
      const suggestion = await storage.getPromptSuggestion(id);
      if (!suggestion) {
        return res.status(404).json({ error: "Suggestion not found" });
      }

      // Update assistant via OpenAI API
      const { updateAssistantPrompt } = await import("./lib/openai");
      await updateAssistantPrompt(suggestion.assistantType, suggestion.suggestedPrompt);

      // Create prompt update log
      await storage.createPromptUpdate({
        suggestionId: id,
        assistantType: suggestion.assistantType,
        modificationType: "instructions",
        previousValue: suggestion.currentPrompt,
        newValue: suggestion.suggestedPrompt,
        reason: suggestion.rootCauseAnalysis,
        appliedBy,
      });

      // Update suggestion status
      await storage.updatePromptSuggestion(id, {
        status: "applied",
        reviewedBy: appliedBy,
      });

      return res.json({ success: true, message: "Prompt updated successfully" });
    } catch (error) {
      console.error("Apply suggestion error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all prompt updates (audit log)
  app.get("/api/learning/updates", authenticate, requireAdmin, async (req, res) => {
    try {
      const assistantType = req.query.assistantType as string | undefined;
      const updates = assistantType
        ? await storage.getPromptUpdatesByAssistantType(assistantType)
        : await storage.getAllPromptUpdates();
      return res.json(updates);
    } catch (error) {
      console.error("Get updates error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Trigger analysis manually
  app.post("/api/learning/analyze", authenticate, requireAdmin, async (req, res) => {
    try {
      console.log("🧠 [Analysis] Manual analysis triggered by admin");
      
      // Import and execute manual analysis
      const { triggerManualAnalysis } = await import("./lib/learning-scheduler");
      const suggestions = await triggerManualAnalysis();
      
      console.log(`✅ [Analysis] Manual analysis completed: ${suggestions.length} suggestions generated`);
      
      return res.json({ 
        success: true, 
        message: `Analysis completed successfully. ${suggestions.length} suggestions generated.`,
        suggestions 
      });
    } catch (error) {
      console.error("❌ [Analysis] Error during manual analysis:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================================================
  // TRAINING SESSIONS - Manual training system with keyword detection
  // ============================================================================

  // Get all training sessions
  app.get("/api/training/sessions", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const sessions = await storage.getAllTrainingSessions();
      return res.json(sessions);
    } catch (error) {
      console.error("Get training sessions error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get active training sessions
  app.get("/api/training/sessions/active", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const sessions = await storage.getActiveTrainingSessions();
      return res.json(sessions);
    } catch (error) {
      console.error("Get active training sessions error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single training session
  app.get("/api/training/sessions/:id", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getTrainingSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Training session not found" });
      }
      
      return res.json(session);
    } catch (error) {
      console.error("Get training session error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new training session
  app.post("/api/training/sessions", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { title, assistantType, trainingType, conversationId, content, notes } = req.body;
      
      const session = await storage.createTrainingSession({
        title,
        assistantType,
        trainingType: trainingType || 'manual',
        conversationId: conversationId || null,
        content,
        startedBy: user.id,
        notes: notes || null,
        status: 'active',
      });

      console.log(`🎓 [Training] Nova sessão criada por ${user.fullName}: ${title}`);
      return res.json(session);
    } catch (error) {
      console.error("Create training session error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update training session
  app.put("/api/training/sessions/:id", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const session = await storage.updateTrainingSession(id, updates);
      
      if (!session) {
        return res.status(404).json({ error: "Training session not found" });
      }
      
      console.log(`🎓 [Training] Sessão ${id} atualizada`);
      return res.json(session);
    } catch (error) {
      console.error("Update training session error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Complete training session
  app.post("/api/training/sessions/:id/complete", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const session = await storage.completeTrainingSession(id, user.id);
      
      if (!session) {
        return res.status(404).json({ error: "Training session not found" });
      }
      
      console.log(`🎓 [Training] Sessão ${id} completada por ${user.fullName}`);
      return res.json(session);
    } catch (error) {
      console.error("Complete training session error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Apply training session (process and improve prompts)
  app.post("/api/training/sessions/:id/apply", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const trainingSession = await storage.getTrainingSession(id);
      
      if (!trainingSession) {
        return res.status(404).json({ error: "Training session not found" });
      }

      if (!trainingSession.content || trainingSession.content.trim().length === 0) {
        return res.status(400).json({ error: "Training session has no content to process" });
      }

      // Process training content with GPT-4 to generate improved prompts
      console.log(`🎓 [Training] Processing session ${id} with GPT-4...`);
      const { processTrainingContent } = await import("./lib/openai");
      const improvedPrompt = await processTrainingContent(
        trainingSession.assistantType,
        trainingSession.content
      );
      
      // Apply the training and update the session
      const session = await storage.applyTrainingSession(id, user.id, improvedPrompt);
      
      if (!session) {
        return res.status(404).json({ error: "Training session not found" });
      }
      
      console.log(`🎓 [Training] Sessão ${id} aplicada por ${user.fullName} - prompts melhorados gerados`);
      
      // Create a prompt update record
      await storage.createPromptUpdate({
        assistantType: trainingSession.assistantType,
        modificationType: 'training_applied',
        previousValue: 'Ver sessão de treinamento',
        newValue: improvedPrompt.substring(0, 500) + (improvedPrompt.length > 500 ? '...' : ''),
        reason: `Treinamento aplicado: ${trainingSession.title}`,
        appliedBy: user.fullName,
      });
      
      return res.json(session);
    } catch (error) {
      console.error("Apply training session error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // System configuration endpoints
  app.get("/api/system/config", authenticate, requireAdmin, async (req, res) => {
    try {
      const { ASSISTANT_IDS, CONTEXT_CONFIG } = await import("./lib/openai");
      const { redis, vectorIndex } = await import("./lib/upstash");
      
      // Check API status
      let redisStatus = false;
      let vectorStatus = false;
      try {
        await redis.ping();
        redisStatus = true;
      } catch (e) {
        console.error("Redis ping failed:", e);
      }
      
      try {
        await vectorIndex.info();
        vectorStatus = true;
      } catch (e) {
        console.error("Vector ping failed:", e);
      }

      // Get statistics
      const allConversations = await storage.getAllActiveConversations();
      const allLearningEvents = await storage.getRecentLearningEvents();
      const allPromptUpdates = await storage.getAllPromptSuggestions();

      // Check Evolution API status
      let evolutionStatus = false;
      if (EVOLUTION_CONFIG.apiUrl && EVOLUTION_CONFIG.apiKey && EVOLUTION_CONFIG.instance) {
        evolutionStatus = true; // Basic config check
      }

      const config = {
        apiStatus: {
          openai: !!process.env.OPENAI_API_KEY,
          redis: redisStatus,
          vector: vectorStatus,
          evolution: evolutionStatus,
        },
        assistants: {
          cortex: !!ASSISTANT_IDS.cortex,
          suporte: !!ASSISTANT_IDS.suporte,
          comercial: !!ASSISTANT_IDS.comercial,
          financeiro: !!ASSISTANT_IDS.financeiro,
          apresentacao: !!ASSISTANT_IDS.apresentacao,
          ouvidoria: !!ASSISTANT_IDS.ouvidoria,
          cancelamento: !!ASSISTANT_IDS.cancelamento,
        },
        env: {
          openai: !!process.env.OPENAI_API_KEY,
          redis: !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN,
          vector: !!process.env.UPSTASH_VECTOR_REST_URL && !!process.env.UPSTASH_VECTOR_REST_TOKEN,
          evolution: evolutionStatus,
        },
        evolution: {
          configured: evolutionStatus,
          url: EVOLUTION_CONFIG.apiUrl || "",
          instance: EVOLUTION_CONFIG.instance || "",
          hasKey: !!EVOLUTION_CONFIG.apiKey,
        },
        learning: {
          lastAnalysis: "Em breve",
          nextAnalysis: `${process.env.ANALYSIS_INTERVAL_HOURS || 2}h`,
          analysisIntervalHours: parseInt(process.env.ANALYSIS_INTERVAL_HOURS || "2"),
        },
        stats: {
          totalConversations: allConversations.length,
          knowledgeChunks: 0, // TODO: get from vector DB
          learningEvents: allLearningEvents.length,
          promptUpdates: allPromptUpdates.length,
        },
        summarization: {
          summarizeEvery: CONTEXT_CONFIG.SUMMARIZE_EVERY,
          keepRecent: CONTEXT_CONFIG.KEEP_RECENT,
          contextWindow: CONTEXT_CONFIG.CONTEXT_WINDOW,
        },
      };

      return res.json(config);
    } catch (error) {
      console.error("Get system config error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update system configuration
  app.post("/api/system/config", authenticate, requireAdmin, async (req, res) => {
    try {
      const { summarizeEvery, keepRecent, contextWindow, analysisInterval } = req.body;
      
      // In a real app, these would be saved to a database or config file
      // For now, we just return success
      console.log("📝 [Config] Updating configuration:", { 
        summarizeEvery, 
        keepRecent, 
        contextWindow,
        analysisInterval 
      });
      
      return res.json({ 
        success: true, 
        message: "Configurações atualizadas! Reinicie o servidor para aplicar: SUMMARIZE_EVERY, KEEP_RECENT, CONTEXT_WINDOW, ANALYSIS_INTERVAL_HOURS" 
      });
    } catch (error) {
      console.error("Update system config error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update Evolution API configuration
  app.post("/api/system/evolution-config", authenticate, requireAdmin, async (req, res) => {
    try {
      const { url, apiKey, instance } = req.body;
      
      if (!url || !apiKey || !instance) {
        return res.status(400).json({ 
          error: "Todos os campos são obrigatórios (url, apiKey, instance)" 
        });
      }

      // Validar URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ 
          error: "URL inválida. Use o formato: https://sua-api.com" 
        });
      }

      // Nota: Em produção, essas variáveis seriam salvas nos Secrets do Replit
      // Por enquanto, vamos apenas validar e retornar sucesso
      console.log("🔧 [Evolution API] Configurações recebidas (não serão persistidas nesta versão):", {
        url,
        instance,
        hasApiKey: !!apiKey
      });

      // Instruções para o usuário (SEM expor a API key)
      const instructions = `
Para aplicar as configurações da Evolution API, adicione estas variáveis nos Secrets do Replit:

1. EVOLUTION_API_URL = ${url}
2. EVOLUTION_API_KEY = (use a chave que você forneceu)
3. EVOLUTION_API_INSTANCE = ${instance}

Após adicionar os Secrets, reinicie o servidor para aplicar as mudanças.
      `.trim();

      return res.json({ 
        success: true, 
        message: "Configurações validadas com sucesso!",
        instructions,
        config: {
          url,
          instance,
          hasApiKey: true
        }
      });
    } catch (error) {
      console.error("Update Evolution config error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Clear Redis cache
  app.post("/api/system/clear-cache", authenticate, requireAdmin, async (req, res) => {
    try {
      const { redis } = await import("./lib/upstash");
      
      // Get all keys
      const keys = await redis.keys("*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      
      console.log(`🗑️ [Cache] Cleared ${keys.length} keys from Redis`);
      
      return res.json({ 
        success: true, 
        message: `Cache cleared successfully (${keys.length} keys)` 
      });
    } catch (error) {
      console.error("Clear cache error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== MESSAGE TEMPLATES ENDPOINTS ====================
  
  // Get all message templates
  app.get("/api/message-templates", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const templates = await storage.getAllMessageTemplates();
      return res.json(templates);
    } catch (error) {
      console.error("Get message templates error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get message template by key
  app.get("/api/message-templates/:key", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { key } = req.params;
      const template = await storage.getMessageTemplateByKey(key);
      
      if (!template) {
        return res.status(404).json({ error: "Template não encontrado" });
      }
      
      return res.json(template);
    } catch (error) {
      console.error("Get message template error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update message template
  app.patch("/api/message-templates/:key", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { key } = req.params;
      const { template } = req.body;
      const userId = req.user?.userId;

      if (!template) {
        return res.status(400).json({ error: "Mensagem é obrigatória" });
      }

      const updated = await storage.updateMessageTemplate(key, {
        template,
        updatedBy: userId,
      });

      if (!updated) {
        return res.status(404).json({ error: "Template não encontrado" });
      }

      console.log(`📝 [Message Template] Atualizado: ${key}`);
      return res.json(updated);
    } catch (error) {
      console.error("Update message template error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get assistants metrics
  app.get("/api/assistants/metrics", authenticate, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const allConversations = await storage.getAllConversations();
      const allPromptUpdates = await storage.getAllPromptUpdates();
      const allSupervisorActions = await storage.getAllSupervisorActions();

      // Filtrar conversas por período (se fornecido)
      let filteredConversations = allConversations;
      if (startDate || endDate) {
        filteredConversations = allConversations.filter((c: Conversation) => {
          const createdAt = c.createdAt ? new Date(c.createdAt) : null;
          if (!createdAt) return false;
          
          if (startDate && endDate) {
            return createdAt >= new Date(startDate as string) && createdAt <= new Date(endDate as string);
          } else if (startDate) {
            return createdAt >= new Date(startDate as string);
          } else if (endDate) {
            return createdAt <= new Date(endDate as string);
          }
          return true;
        });
      }

      // Tipos de assistentes
      const assistantTypes = ["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento"];
      
      // Calcular métricas por assistente
      const assistantMetrics = assistantTypes.map(type => {
        const conversations = filteredConversations.filter((c: Conversation) => c.assistantType === type);
        const totalConversations = conversations.length;
        
        // ✅ CORREÇÃO: Conversas transferidas = tem data de transferência
        const transferredConversations = conversations.filter((c: Conversation) => 
          c.transferredAt != null
        ).length;
        
        // ✅ CORREÇÃO: Conversas resolvidas PELA IA = resolvidas E NUNCA transferidas
        const resolvedConversations = conversations.filter((c: Conversation) => 
          c.status === "resolved" && c.transferredAt == null
        ).length;
        
        // Taxa de sucesso da IA (resolveu sozinha, sem transferir)
        const successRate = totalConversations > 0 
          ? (resolvedConversations / totalConversations) * 100 
          : 0;
        
        // Duração média (calculada pelo tempo real entre createdAt e lastMessageTime)
        const avgDuration = totalConversations > 0
          ? conversations.reduce((sum: number, c: Conversation) => {
              if (!c.createdAt || !c.lastMessageTime) return sum;
              const durationInSeconds = Math.floor((c.lastMessageTime.getTime() - c.createdAt.getTime()) / 1000);
              return sum + durationInSeconds;
            }, 0) / totalConversations
          : 0;
        
        // Sentimento médio
        const sentiments = conversations.map((c: Conversation) => c.sentiment || "neutral");
        const positiveCount = sentiments.filter((s: string | null) => s === "positive").length;
        const negativeCount = sentiments.filter((s: string | null) => s === "negative").length;
        const avgSentiment = positiveCount > negativeCount ? "positive" 
          : negativeCount > positiveCount ? "negative" 
          : "neutral";
        
        return {
          assistantType: type,
          totalConversations,
          resolvedConversations,
          transferredConversations,
          successRate,
          avgDuration,
          avgSentiment,
        };
      });

      // Overview geral (usando conversas filtradas por período)
      const totalConversations = filteredConversations.length;
      
      // ✅ CORREÇÃO: Transferências = tem data de transferência (dados históricos completos)
      const totalTransferred = filteredConversations.filter((c: Conversation) => 
        c.transferredAt != null
      ).length;
      
      // ✅ CORREÇÃO: Resolvidas pela IA = resolvidas E NUNCA transferidas
      const totalResolved = filteredConversations.filter((c: Conversation) => 
        c.status === "resolved" && c.transferredAt == null
      ).length;
      
      const overallSuccessRate = totalConversations > 0 
        ? (totalResolved / totalConversations) * 100 
        : 0;

      // 📊 DEBUG: Log overview metrics
      console.log('📊 [Assistants Metrics] Overview:', {
        total: totalConversations,
        transferred: totalTransferred,
        resolvedByAI: totalResolved,
        successRate: overallSuccessRate.toFixed(1) + '%'
      });

      // Histórico de atualizações (últimas 10)
      const updates = allPromptUpdates
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 10)
        .map(update => ({
          assistantType: update.assistantType,
          date: update.createdAt ? new Date(update.createdAt).toLocaleDateString('pt-BR') : 'N/A',
          modificationType: update.modificationType || "Atualização de prompt",
          appliedBy: update.appliedBy,
        }));

      // Análise de transferências
      const transfersByAssistant = assistantTypes.map(type => {
        const conversations = allConversations.filter((c: Conversation) => 
          c.assistantType === type && (c.metadata as any)?.transferred === true
        );
        
        const reasons = conversations
          .map((c: Conversation) => (c.metadata as any)?.transferNotes || "Não especificado")
          .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) // Remove duplicatas
          .slice(0, 5); // Top 5 motivos

        return {
          assistantType: type,
          count: conversations.length,
          reasons,
        };
      }).filter(t => t.count > 0); // Apenas assistentes com transferências

      const response = {
        overview: {
          totalConversations,
          totalResolved,
          totalTransferred,
          overallSuccessRate,
        },
        assistants: assistantMetrics,
        updates,
        transfers: transfersByAssistant,
      };

      return res.json(response);
    } catch (error) {
      console.error("Get assistants metrics error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Submit satisfaction feedback (NPS)
  app.post("/api/feedback", async (req, res) => {
    try {
      const validatedData = insertSatisfactionFeedbackSchema.parse(req.body);
      
      // Criar feedback (category é calculado automaticamente pelo storage)
      const feedback = await storage.createSatisfactionFeedback(validatedData);
      
      // Determinar categoria para lógica adicional
      let category: string;
      if (validatedData.npsScore >= 0 && validatedData.npsScore <= 6) {
        category = "detractor";
      } else if (validatedData.npsScore >= 7 && validatedData.npsScore <= 8) {
        category = "neutral";
      } else {
        category = "promoter";
      }
      
      // Se for detractor (NPS 0-6), criar learning event negativo
      if (category === "detractor") {
        const conversation = await storage.getConversation(validatedData.conversationId);
        
        if (conversation) {
          // Buscar últimas mensagens da conversa
          const messages = await storage.getMessagesByConversationId(validatedData.conversationId);
          const lastUserMessage = messages.filter(m => m.role === "user").slice(-1)[0];
          const lastAiMessage = messages.filter(m => m.role === "assistant").slice(-1)[0];
          
          await storage.createLearningEvent({
            conversationId: validatedData.conversationId,
            eventType: "explicit_correction",
            assistantType: validatedData.assistantType,
            userMessage: lastUserMessage?.content || "N/A",
            aiResponse: lastAiMessage?.content || "N/A",
            correctResponse: null,
            feedback: `NPS Baixo (${validatedData.npsScore}): ${validatedData.comment || "Sem comentário"}`,
            sentiment: "negative",
            resolution: "corrected",
            metadata: {
              npsScore: validatedData.npsScore,
              npsComment: validatedData.comment,
              source: "nps_feedback",
            },
          });
          
          console.log(`📊 [NPS] Detractor feedback criado learning event: NPS ${validatedData.npsScore}`);
        }
      }
      
      console.log(`📊 [NPS] Feedback recebido: ${category.toUpperCase()} - Score ${validatedData.npsScore}`);
      
      return res.json({ success: true, feedback });
    } catch (error) {
      console.error("Submit feedback error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all satisfaction feedback with conversation data
  app.get("/api/satisfaction-feedback", authenticate, async (req, res) => {
    try {
      const feedbackWithConversations = await storage.getSatisfactionFeedbackWithConversations();
      return res.json(feedbackWithConversations);
    } catch (error) {
      console.error("Get satisfaction feedback error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update satisfaction feedback handling (notes and verification)
  app.put("/api/satisfaction-feedback/:id/handling", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;

      // Validate input with Zod
      const handlingUpdateSchema = z.object({
        handlingScore: z.number().int().min(1).max(5).optional(),
        handlingStatus: z.enum(["pending", "in_progress", "resolved"]).optional(),
        handlingNotes: z.string().optional()
      });

      const validationResult = handlingUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: validationResult.error.errors 
        });
      }

      const { handlingScore, handlingStatus, handlingNotes } = validationResult.data;

      const updated = await storage.updateSatisfactionFeedbackHandling(id, {
        handlingScore,
        handlingStatus,
        handlingNotes,
        handledBy: (req.user as any).id
      });

      if (!updated) {
        return res.status(404).json({ error: "Feedback not found" });
      }

      return res.json(updated);
    } catch (error) {
      console.error("Update satisfaction feedback handling error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get NPS metrics
  app.get("/api/metrics/nps", authenticate, async (req, res) => {
    try {
      const allFeedback = await storage.getAllSatisfactionFeedback();
      const allConversations = await storage.getAllConversations();
      
      // Calcular métricas gerais de NPS
      const totalFeedback = allFeedback.length;
      const promoters = allFeedback.filter(f => f.category === "promoter").length;
      const neutrals = allFeedback.filter(f => f.category === "neutral").length;
      const detractors = allFeedback.filter(f => f.category === "detractor").length;
      
      // NPS Score = (% Promoters - % Detractors)
      const npsScore = totalFeedback > 0 
        ? Math.round(((promoters - detractors) / totalFeedback) * 100) 
        : 0;
      
      // Score médio
      const avgScore = totalFeedback > 0
        ? allFeedback.reduce((sum, f) => sum + f.npsScore, 0) / totalFeedback
        : 0;
      
      // Métricas por assistente
      const assistantTypes = ["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento"];
      const byAssistant = assistantTypes.map(type => {
        const feedback = allFeedback.filter(f => f.assistantType === type);
        const total = feedback.length;
        const promo = feedback.filter(f => f.category === "promoter").length;
        const detrac = feedback.filter(f => f.category === "detractor").length;
        const score = total > 0 ? Math.round(((promo - detrac) / total) * 100) : 0;
        const avg = total > 0 ? feedback.reduce((sum, f) => sum + f.npsScore, 0) / total : 0;
        
        return {
          assistantType: type,
          totalFeedback: total,
          promoters: promo,
          neutrals: feedback.filter(f => f.category === "neutral").length,
          detractors: detrac,
          npsScore: score,
          avgScore: avg,
        };
      }).filter(m => m.totalFeedback > 0);
      
      // Feedback ao longo do tempo (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentFeedback = allFeedback.filter(f => 
        f.createdAt && new Date(f.createdAt) >= thirtyDaysAgo
      );
      
      // Agrupar por dia
      const dailyStats = recentFeedback.reduce((acc: any, f) => {
        const date = f.createdAt ? new Date(f.createdAt).toLocaleDateString('pt-BR') : 'N/A';
        if (!acc[date]) {
          acc[date] = { date, scores: [] };
        }
        acc[date].scores.push(f.npsScore);
        return acc;
      }, {});
      
      const timeline = Object.values(dailyStats).map((day: any) => ({
        date: day.date,
        avgScore: day.scores.reduce((sum: number, s: number) => sum + s, 0) / day.scores.length,
        count: day.scores.length,
      })).sort((a: any, b: any) => {
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
      });
      
      // Principais comentários (últimos 10 com comentário)
      const comments = allFeedback
        .filter(f => f.comment && f.comment.trim() !== "")
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 10)
        .map(f => ({
          score: f.npsScore,
          category: f.category,
          comment: f.comment,
          assistantType: f.assistantType,
          clientName: f.clientName,
          date: f.createdAt ? new Date(f.createdAt).toLocaleDateString('pt-BR') : 'N/A',
        }));
      
      // Taxa de resposta (feedback vs conversas finalizadas)
      const resolvedConversations = allConversations.filter(c => c.status === "resolved").length;
      const responseRate = resolvedConversations > 0 
        ? (totalFeedback / resolvedConversations) * 100 
        : 0;
      
      const response = {
        overview: {
          npsScore,
          avgScore: Math.round(avgScore * 10) / 10,
          totalFeedback,
          promoters,
          neutrals,
          detractors,
          responseRate: Math.round(responseRate),
          resolvedConversations,
        },
        byAssistant,
        timeline,
        comments,
      };
      
      return res.json(response);
    } catch (error) {
      console.error("Get NPS metrics error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get transferred conversations
  app.get("/api/conversations/transferred", authenticateWithTracking, async (req, res) => {
    try {
      const userId = req.user?.userId;
      const role = req.user?.role;
      
      const conversations = await storage.getTransferredConversations(userId, role);
      
      // Enriquecer com última mensagem do cliente
      const enriched = await Promise.all(
        conversations.map(async (conv) => {
          const messages = await storage.getRecentMessagesByConversationId(conv.id, 20);
          const lastClientMessage = messages
            .filter(m => m.role === 'user')
            .sort((a, b) => {
              const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return timeB - timeA;
            })[0];
          
          return {
            ...conv,
            lastMessage: lastClientMessage?.content || conv.lastMessage || 'Sem mensagens',
          };
        })
      );
      
      return res.json(enriched);
    } catch (error) {
      console.error("Get transferred conversations error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get assigned conversations (conversas atribuídas ao usuário atual)
  app.get("/api/conversations/assigned", authenticateWithTracking, async (req, res) => {
    try {
      const userId = req.user?.userId;
      const role = req.user?.role;
      
      // ADMIN e SUPERVISOR veem todas as conversas atribuídas
      // AGENT vê apenas suas próprias conversas atribuídas (SEM filtro por departamento)
      const isAdminOrSupervisor = role === 'ADMIN' || role === 'SUPERVISOR';
      
      const allConversations = await storage.getAllConversations();
      const assignedConversations = allConversations.filter(conv => {
        // Deve estar transferida para humano
        if (!conv.transferredToHuman) return false;
        
        // Deve estar ativa ou em fila (não resolvida)
        if (conv.status !== 'active' && conv.status !== 'queued') return false;
        
        // Deve ter alguém atribuído
        if (!conv.assignedTo) return false;
        
        // ADMIN/SUPERVISOR veem todas
        if (isAdminOrSupervisor) {
          return true;
        } else {
          // AGENT vê apenas as suas próprias atribuições
          // NOTA: Removida filtragem por departamento para conversas atribuídas
          // Se está atribuído ao agente, ele deve ver independente do departamento
          return conv.assignedTo === userId;
        }
      });
      
      // Buscar nomes de usuários atribuídos (busca em lote para evitar N+1 query)
      const uniqueAssignedIds = Array.from(new Set(assignedConversations.map(c => c.assignedTo).filter(Boolean) as string[]));
      const assignedUsersMap = new Map<string, string>();
      
      if (uniqueAssignedIds.length > 0) {
        const users = await storage.getUsersByIds(uniqueAssignedIds);
        
        users.forEach((user) => {
          if (user && user.fullName) {
            // Pegar apenas o primeiro nome
            const firstName = user.fullName.split(' ')[0];
            assignedUsersMap.set(user.id, firstName);
          }
        });
      }
      
      // Enriquecer com última mensagem do cliente e nome do usuário atribuído
      const enriched = await Promise.all(
        assignedConversations.map(async (conv) => {
          const messages = await storage.getRecentMessagesByConversationId(conv.id, 20);
          const lastClientMessage = messages
            .filter(m => m.role === 'user')
            .sort((a, b) => {
              const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return timeB - timeA;
            })[0];
          
          // Buscar nome do usuário atribuído do mapa
          const assignedToName = conv.assignedTo ? assignedUsersMap.get(conv.assignedTo) || null : null;
          
          return {
            ...conv,
            lastMessage: lastClientMessage?.content || conv.lastMessage || 'Sem mensagens',
            assignedToName,
          };
        })
      );
      
      // Ordenar por última mensagem (mais recente primeiro)
      const sorted = enriched.sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });
      
      return res.json(sorted);
    } catch (error) {
      console.error("Get assigned conversations error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/conversations/cobrancas
   * Retorna conversas relacionadas a cobranças
   * Query params: source (opcional - 'all', 'inbound', 'voice_campaign', 'whatsapp_campaign')
   * NOTA: Esta rota DEVE estar ANTES de /api/conversations/:id para evitar conflito de match
   */
  app.get("/api/conversations/cobrancas", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { source = 'all' } = req.query;
      
      console.log(`💬 [Cobranças Monitor] Fetching conversations with source filter: ${source}`);
      
      const allConversations = await storage.getAllConversations();
      
      // Filter conversations related to cobrancas
      let filteredConversations = allConversations.filter(conv => {
        // Include conversations from department=financial or assistant=cobranca
        const isCobrancaRelated = 
          conv.department === 'financial' || 
          conv.assistantType === 'cobranca' ||
          conv.conversationSource === 'voice_campaign' ||
          conv.conversationSource === 'whatsapp_campaign';
        
        if (!isCobrancaRelated) return false;
        
        // Apply source filter
        if (source === 'all') return true;
        if (source === 'inbound') return conv.conversationSource === 'inbound';
        if (source === 'voice_campaign') return conv.conversationSource === 'voice_campaign';
        if (source === 'whatsapp_campaign') return conv.conversationSource === 'whatsapp_campaign';
        
        return false;
      });
      
      // Sort by last message time (most recent first)
      filteredConversations.sort((a, b) => {
        const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return bTime - aTime;
      });
      
      console.log(`✅ [Cobranças Monitor] Returning ${filteredConversations.length} conversations (filter: ${source})`);
      
      return res.json(filteredConversations);
    } catch (error) {
      console.error("❌ [Cobranças Monitor] Error fetching conversations:", error);
      return res.status(500).json({ error: "Erro ao buscar conversas de cobrança" });
    }
  });

  // Get single conversation by ID
  // NOTA: Esta rota genérica (:id) DEVE estar DEPOIS de rotas específicas como /cobrancas
  app.get("/api/conversations/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      return res.json(conversation);
    } catch (error) {
      console.error("Get conversation error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get feedback by conversation ID
  app.get("/api/feedback/:conversationId", authenticate, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const feedback = await storage.getSatisfactionFeedbackByConversationId(conversationId);
      // Retorna 200 com null se não houver feedback (não é erro)
      return res.json({ feedback: feedback || null });
    } catch (error) {
      console.error("Get feedback error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // AI suggest response based on context
  app.post("/api/conversations/:id/suggest-response", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { supervisorName } = req.body;

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await storage.getMessagesByConversationId(id);
      
      if (!messages || messages.length === 0) {
        return res.status(400).json({ error: "Não há mensagens nesta conversa para gerar sugestão" });
      }

      // Preparar contexto da conversa
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Pegar a última mensagem (independente do role) como contexto principal
      const lastMessage = messages[messages.length - 1];
      const lastMessageContext = `${lastMessage.role === 'user' ? 'Cliente' : 'Assistente'}: ${lastMessage.content}`;

      // Usar OpenAI para sugerir resposta baseada no contexto
      const suggestionPrompt = `Você é um assistente experiente da TR Telecom. 
      
Analise o histórico da conversa abaixo e sugira a melhor resposta para dar continuidade ao atendimento.

Histórico da conversa:
${conversationHistory.map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`).join('\n')}

Baseado no contexto completo da conversa, sugira uma resposta profissional, empática e que ajude o cliente. 
A resposta deve:
- Ser direta e objetiva
- Manter tom profissional e empático
- Oferecer solução clara ou dar continuidade ao atendimento
- Se necessário, pedir informações adicionais para melhor ajudar`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: suggestionPrompt,
          },
        ],
        temperature: 0.7,
      });

      const suggestedResponse = completion.choices[0]?.message?.content || "Não foi possível gerar sugestão";

      // Salvar sugestão
      const suggestion = await storage.createSuggestedResponse({
        conversationId: id,
        messageContext: lastMessageContext,
        suggestedResponse,
        supervisorName,
        wasEdited: false,
        wasApproved: false,
      });

      console.log(`🤖 [AI Suggestion] Sugestão gerada para conversa ${id}`);

      return res.json({
        suggestionId: suggestion.id,
        suggestedResponse,
      });
    } catch (error) {
      console.error("Suggest response error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send supervisor message (approved or edited)
  app.post("/api/conversations/:id/send-message", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { content, suggestionId, wasEdited, supervisorName, imageBase64, audioBase64, audioMimeType, pdfBase64, pdfName } = req.body;

      console.log(`📬 [Supervisor] send-message endpoint called - conversationId: ${id}, supervisor: ${supervisorName}`);
      console.log(`📦 [Supervisor] Payload recebido:`, {
        hasContent: !!content,
        hasImage: !!imageBase64,
        hasAudio: !!audioBase64,
        hasPdf: !!pdfBase64,
        pdfName,
        pdfSize: pdfBase64 ? `${(pdfBase64.length / 1024).toFixed(2)} KB` : 'N/A'
      });

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        console.log(`❌ [Supervisor] Conversation not found: ${id}`);
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Validação: Se conversa está atribuída, apenas o atendente atribuído pode responder
      // (a menos que seja ADMIN ou SUPERVISOR)
      if (conversation.assignedTo) {
        const user = req.user!;
        const isAssignedAgent = user.userId === conversation.assignedTo;
        const isAdminOrSupervisor = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
        
        if (!isAssignedAgent && !isAdminOrSupervisor) {
          return res.status(403).json({ 
            error: "Apenas o atendente atribuído pode responder a esta conversa" 
          });
        }
      }

      // Process image if provided
      let processedContent = content || '';
      let imageAnalysis = null;
      let audioTranscription = null;
      
      if (imageBase64) {
        // Validação server-side: verificar tamanho (aproximado via base64 length)
        const imageSizeBytes = (imageBase64.length * 3) / 4; // Tamanho aproximado em bytes
        const maxSizeBytes = 20 * 1024 * 1024; // 20MB
        
        if (imageSizeBytes > maxSizeBytes) {
          return res.status(400).json({ 
            error: "Imagem muito grande. Tamanho máximo: 20MB" 
          });
        }

        console.log(`📸 [Supervisor] Imagem detectada (${(imageSizeBytes / 1024 / 1024).toFixed(2)}MB) - enviando sem análise`);
        
        // Não processar com IA, apenas marcar que tem imagem
        processedContent = content || '[Imagem enviada]';
      }

      // Process audio if provided
      if (audioBase64) {
        const { isValidAudioSize, isValidAudioFormat, transcribeAudio } = await import("./lib/audio");
        
        // Validar formato
        if (audioMimeType && !isValidAudioFormat(audioMimeType)) {
          return res.status(400).json({ 
            error: "Formato de áudio não suportado. Use: MP3, OGG, WAV, WebM, MP4 ou M4A" 
          });
        }

        // Validar tamanho (mín 1KB, máx 25MB para Whisper)
        if (!isValidAudioSize(audioBase64)) {
          const audioSizeBytes = (audioBase64.length * 3) / 4;
          if (audioSizeBytes < 1024) {
            return res.status(400).json({ 
              error: "Áudio muito pequeno ou inválido. Tamanho mínimo: 1KB" 
            });
          }
          return res.status(400).json({ 
            error: "Áudio muito grande. Tamanho máximo: 25MB" 
          });
        }

        const audioSizeBytes = (audioBase64.length * 3) / 4;
        console.log(`🎤 [Supervisor] Áudio detectado (${(audioSizeBytes / 1024 / 1024).toFixed(2)}MB) - transcrevendo com Whisper...`);
        
        audioTranscription = await transcribeAudio(audioBase64, audioMimeType);
        
        if (audioTranscription) {
          // Se já tem imagem processada, adicionar áudio depois
          if (processedContent && processedContent !== content) {
            processedContent += `\n\n[Áudio enviado]\n🎤 Transcrição automática:\n${audioTranscription}`;
          } else {
            processedContent = content
              ? `[Áudio enviado]\n${content}\n\n🎤 Transcrição automática:\n${audioTranscription}`
              : `[Áudio enviado]\n\n🎤 Transcrição automática:\n${audioTranscription}`;
          }
          console.log(`✅ [Supervisor] Áudio transcrito com sucesso`);
        } else {
          const audioMsg = '[Áudio enviado - transcrição não disponível]';
          processedContent = processedContent ? `${processedContent}\n\n${audioMsg}` : audioMsg;
          console.log(`⚠️ [Supervisor] Falha na transcrição do áudio`);
        }
      }

      // Process PDF if provided
      if (pdfBase64) {
        // Validar tamanho (máx 10MB)
        const pdfSizeBytes = (pdfBase64.length * 3) / 4;
        const maxSizeBytes = 10 * 1024 * 1024; // 10MB
        
        if (pdfSizeBytes > maxSizeBytes) {
          return res.status(400).json({ 
            error: "PDF muito grande. Tamanho máximo: 10MB" 
          });
        }

        console.log(`📄 [Supervisor] PDF detectado (${(pdfSizeBytes / 1024 / 1024).toFixed(2)}MB) - ${pdfName || 'documento.pdf'}`);
        
        // Adicionar nota sobre PDF enviado
        const pdfMsg = `[PDF enviado: ${pdfName || 'documento.pdf'}]`;
        if (processedContent && processedContent !== content) {
          processedContent += `\n\n${pdfMsg}`;
        } else {
          processedContent = content ? `${content}\n\n${pdfMsg}` : pdfMsg;
        }
      }

      // 🎓 DETECÇÃO DE PALAVRAS-CHAVE PARA TREINAMENTO
      const userId = req.user!.userId;
      const currentUser = await storage.getUserById(userId);
      
      if (currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR')) {
        const contentLower = processedContent.toLowerCase().trim();
        
        // Helper: detectar palavra exata com word boundaries
        const hasKeyword = (text: string, keyword: string): boolean => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(text);
        };
        
        // Detectar comando "start" para iniciar treinamento
        if (hasKeyword(contentLower, 'start')) {
          const activeSessions = await storage.getActiveTrainingSessions();
          const conversationSessions = activeSessions.filter(s => s.conversationId === id);
          
          if (conversationSessions.length === 0) {
            // Criar nova sessão de treinamento
            const validAssistantType = (conversation.assistantType && ['apresentacao', 'comercial', 'financeiro', 'suporte', 'ouvidoria', 'cancelamento'].includes(conversation.assistantType)) 
              ? conversation.assistantType as 'apresentacao' | 'comercial' | 'financeiro' | 'suporte' | 'ouvidoria' | 'cancelamento'
              : 'suporte';
            
            const trainingSession = await storage.createTrainingSession({
              title: `Treinamento: ${conversation.assistantType || 'Geral'} - ${new Date().toLocaleDateString('pt-BR')}`,
              assistantType: validAssistantType,
              trainingType: 'conversation',
              conversationId: id,
              content: '', // Será preenchido ao parar
              startedBy: currentUser.id,
              notes: `Sessão iniciada via palavra-chave "start" na conversa`,
              status: 'active',
            });
            
            console.log(`🎓 [Training] Sessão iniciada via keyword "start" por ${currentUser.fullName} - Conversa ${id}`);
            webhookLogger.info('TRAINING_SESSION_STARTED', `Treinamento iniciado via keyword`, {
              sessionId: trainingSession.id,
              conversationId: id,
              supervisorName: currentUser.fullName,
            });
          } else {
            console.log(`⚠️ [Training] Já existe sessão ativa para conversa ${id}`);
          }
        }
        
        // Detectar comando "stop" para finalizar treinamento
        if (hasKeyword(contentLower, 'stop')) {
          const activeSessions = await storage.getActiveTrainingSessions();
          const conversationSessions = activeSessions.filter(s => s.conversationId === id);
          
          if (conversationSessions.length > 0) {
            const session = conversationSessions[0];
            
            // Coletar todas as mensagens desde o início da sessão
            const messages = await storage.getMessagesByConversationId(id);
            const sessionMessages = messages.filter(m => {
              if (!m.timestamp || !session.startedAt) return false;
              return new Date(m.timestamp) >= new Date(session.startedAt);
            });
            
            // Formatar conteúdo do treinamento
            const trainingContent = sessionMessages
              .map(m => {
                const role = m.role === 'user' ? '👤 Cliente' : '🤖 Assistente';
                const assistant = m.assistant ? ` (${m.assistant})` : '';
                return `${role}${assistant}:\n${m.content}`;
              })
              .join('\n\n---\n\n');
            
            // Atualizar sessão com conteúdo
            await storage.updateTrainingSession(session.id, {
              content: trainingContent,
              notes: (session.notes || '') + `\n\nSessão finalizada via palavra-chave "stop". ${sessionMessages.length} mensagens capturadas.`,
            });
            
            // Completar sessão
            await storage.completeTrainingSession(session.id, currentUser.id);
            
            console.log(`🎓 [Training] Sessão ${session.id} finalizada via keyword "stop" por ${currentUser.fullName} - ${sessionMessages.length} mensagens capturadas`);
            webhookLogger.success('TRAINING_SESSION_COMPLETED', `Treinamento completado via keyword`, {
              sessionId: session.id,
              conversationId: id,
              supervisorName: currentUser.fullName,
              messagesCaptured: sessionMessages.length,
            });
          } else {
            console.log(`⚠️ [Training] Nenhuma sessão ativa encontrada para parar na conversa ${id}`);
          }
        }
      }

      // Criar mensagem do supervisor
      const message = await storage.createMessage({
        conversationId: id,
        role: "assistant",
        content: processedContent,
        assistant: `Supervisor: ${supervisorName}`,
        imageBase64: imageBase64 || null, // Salvar imagem para exibição no frontend
        pdfBase64: pdfBase64 || null, // Salvar PDF para download no frontend
        pdfName: pdfName || null, // Nome do arquivo PDF
      });

      // Atualizar conversa
      await storage.updateConversation(id, {
        lastMessage: processedContent,
        lastMessageTime: new Date(),
      });

      // ENVIAR MENSAGEM VIA WHATSAPP
      let whatsappSent = false;
      
      // Priorizar clientId, depois chatId (sendWhatsAppMessage normaliza automaticamente)
      const phoneNumber = conversation.clientId || conversation.chatId;
      
      if (phoneNumber) {
        try {
          // Se tem imagem, enviar como mídia ao invés de texto
          if (imageBase64) {
            console.log(`📸 [Supervisor] Enviando imagem via WhatsApp para ${phoneNumber}`);
            whatsappSent = await sendWhatsAppImage(
              phoneNumber, 
              imageBase64, 
              content || '', // Caption (mensagem do supervisor)
              conversation.evolutionInstance || undefined
            );
            
            if (whatsappSent) {
              console.log(`✅ [Supervisor] Imagem enviada ao WhatsApp: ${phoneNumber}`);
              webhookLogger.success('SUPERVISOR_IMAGE_SENT', `Supervisor enviou imagem ao cliente`, {
                conversationId: id,
                supervisorName,
                phoneNumber,
                caption: content?.substring(0, 50) || '',
              });
            }
          } else if (pdfBase64) {
            // Se tem PDF, enviar como documento
            console.log(`📄 [Supervisor] Enviando PDF via WhatsApp para ${phoneNumber}`);
            whatsappSent = await sendWhatsAppDocument(
              phoneNumber,
              pdfBase64,
              pdfName || 'documento.pdf',
              content || '', // Caption (mensagem do supervisor)
              conversation.evolutionInstance || undefined
            );
            
            if (whatsappSent) {
              console.log(`✅ [Supervisor] PDF enviado ao WhatsApp: ${phoneNumber}`);
              webhookLogger.success('SUPERVISOR_PDF_SENT', `Supervisor enviou PDF ao cliente`, {
                conversationId: id,
                supervisorName,
                phoneNumber,
                fileName: pdfName || 'documento.pdf',
                caption: content?.substring(0, 50) || '',
              });
            }
          } else if (audioBase64) {
            // Para áudio, por enquanto enviar apenas a transcrição (Evolution API pode não suportar áudio)
            const result = await sendWhatsAppMessage(phoneNumber, processedContent, conversation.evolutionInstance || undefined);
            whatsappSent = result.success;
            if (result.success) {
              console.log(`✅ [Supervisor] Transcrição de áudio enviada ao WhatsApp: ${phoneNumber}`);
              // Atualizar mensagem com IDs do WhatsApp
              if (result.whatsappMessageId || result.remoteJid) {
                await storage.updateMessage(message.id, {
                  whatsappMessageId: result.whatsappMessageId,
                  remoteJid: result.remoteJid,
                });
              }
            }
          } else {
            // Mensagem de texto normal
            const result = await sendWhatsAppMessage(phoneNumber, processedContent, conversation.evolutionInstance || undefined);
            whatsappSent = result.success;
            if (result.success) {
              console.log(`✅ [Supervisor] Mensagem enviada ao WhatsApp: ${phoneNumber}`);
              // Atualizar mensagem com IDs do WhatsApp para permitir deleção futura
              if (result.whatsappMessageId || result.remoteJid) {
                await storage.updateMessage(message.id, {
                  whatsappMessageId: result.whatsappMessageId,
                  remoteJid: result.remoteJid,
                });
              }
            }
          }
          
          if (whatsappSent) {
            webhookLogger.success('SUPERVISOR_MESSAGE_SENT', `Supervisor enviou mensagem ao cliente`, {
              conversationId: id,
              supervisorName,
              phoneNumber,
              messagePreview: content?.substring(0, 50) || '',
              hasImage: !!imageBase64,
              hasAudio: !!audioBase64,
              hasPdf: !!pdfBase64,
            });
          } else {
            webhookLogger.error('WHATSAPP_SEND_FAILED', `Falha ao enviar mensagem do supervisor`, {
              conversationId: id,
              phoneNumber,
            });
          }
        } catch (error) {
          console.error("❌ [Supervisor] Erro ao enviar mensagem ao WhatsApp:", error);
          webhookLogger.error('WHATSAPP_SEND_ERROR', `Erro ao enviar mensagem do supervisor`, {
            conversationId: id,
            phoneNumber,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        console.warn(`⚠️ [Supervisor] Sem número disponível. chatId: ${conversation.chatId}, clientId: ${conversation.clientId}`);
        webhookLogger.error('NO_PHONE_NUMBER', `Sem número disponível para envio`, {
          conversationId: id,
          chatId: conversation.chatId,
        });
      }

      // Se foi baseado em sugestão, atualizar o registro
      if (suggestionId) {
        await storage.updateSuggestedResponse(suggestionId, {
          finalResponse: processedContent,
          wasEdited: wasEdited || false,
          wasApproved: true,
        });

        // Se editou a sugestão da IA, criar learning event
        if (wasEdited) {
          const suggestion = await storage.getSuggestedResponsesByConversationId(id);
          const originalSuggestion = suggestion.find(s => s.id === suggestionId);
          
          if (originalSuggestion) {
            await storage.createLearningEvent({
              conversationId: id,
              eventType: "explicit_correction",
              assistantType: conversation.assistantType,
              userMessage: originalSuggestion.messageContext,
              aiResponse: originalSuggestion.suggestedResponse,
              correctResponse: content,
              feedback: `Supervisor editou sugestão da IA`,
              sentiment: "neutral",
              resolution: "corrected",
              metadata: {
                source: "supervised_response",
                suggestionId,
                supervisorName,
              },
            });

            console.log(`📚 [Learning] Supervisor editou sugestão - learning event criado`);
          }
        }
      }

      console.log(`✉️ [Supervisor] Mensagem salva na conversa ${id}`);

      return res.json({ 
        success: true, 
        message,
        whatsappSent,
        learningEventCreated: wasEdited,
        imageAnalyzed: !!imageAnalysis,
        audioTranscribed: !!audioTranscription,
      });
    } catch (error) {
      console.error("Send message error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Private Notes Routes
  // Get private notes for a conversation
  app.get("/api/conversations/:conversationId/private-notes", authenticate, async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      const notes = await storage.getPrivateNotesByConversationId(conversationId);
      return res.json(notes);
    } catch (error) {
      console.error("Get private notes error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a private note for a conversation
  app.post("/api/conversations/:conversationId/private-notes", authenticate, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;
      const currentUser = req.user!;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Conteúdo da nota é obrigatório" });
      }

      const note = await storage.createPrivateNote({
        conversationId,
        content: content.trim(),
        createdBy: currentUser.userId,
        createdByName: currentUser.fullName,
      });

      console.log(`📝 [Private Note] Nota criada por ${currentUser.fullName} na conversa ${conversationId}`);

      return res.json(note);
    } catch (error) {
      console.error("Create private note error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Helper function to get first name only
  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  // Assign conversation to agent (self-assignment or manual assignment) OR unassign (toggle)
  app.post("/api/conversations/:id/assign", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { agentId } = req.body;
      const currentUser = req.user!;

      // Buscar conversa
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      // Determinar o tipo de atribuição
      let targetAgentId: string;
      
      if (agentId) {
        // Atribuição manual (apenas ADMIN/SUPERVISOR)
        if (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPERVISOR') {
          return res.status(403).json({ 
            error: "Apenas ADMIN ou SUPERVISOR podem atribuir conversas a outros atendentes" 
          });
        }
        targetAgentId = agentId;
      } else {
        // Auto-atribuição (qualquer usuário autenticado)
        targetAgentId = currentUser.userId;
      }

      // TOGGLE: Se a conversa já está atribuída ao usuário atual, DESATRIBUIR
      if (conversation.assignedTo === targetAgentId) {
        await storage.updateConversation(id, {
          assignedTo: null,
        });

        // Criar ação de supervisor para desatribuição
        await storage.createSupervisorAction({
          conversationId: id,
          action: "unassign",
          notes: `Conversa desatribuída de ${currentUser.fullName || currentUser.username}`,
          createdBy: currentUser.fullName || currentUser.username,
        });

        // Criar log de atividade
        await storage.createActivityLog({
          userId: currentUser.userId,
          action: "unassign_conversation",
          conversationId: id,
          details: {
            clientName: conversation.clientName,
          },
        });

        console.log(`👤 [Unassignment] Conversa ${id} desatribuída de ${currentUser.fullName}`);

        return res.json({
          success: true,
          unassigned: true,
          message: "Conversa desatribuída com sucesso",
        });
      }

      // Validação: Prevenir roubo de conversas atribuídas a outros
      if (conversation.assignedTo) {
        const isAdminOrSupervisor = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR';
        const isSameAgent = conversation.assignedTo === targetAgentId;
        
        if (!isAdminOrSupervisor && !isSameAgent) {
          return res.status(403).json({ 
            error: "Esta conversa já está atribuída a outro atendente" 
          });
        }
      }

      // Buscar agente
      const agent = await storage.getUserById(targetAgentId);
      if (!agent) {
        return res.status(404).json({ error: "Atendente não encontrado" });
      }

      // Atualizar conversa com agente atribuído
      // Se a conversa ainda não foi transferida para humano, marcar agora
      const updateData: any = {
        assignedTo: targetAgentId,
      };
      
      if (!conversation.transferredToHuman) {
        updateData.transferredToHuman = true;
        updateData.transferredAt = new Date();
        updateData.transferReason = 'Conversa atribuída diretamente para atendente';
      }
      
      await storage.updateConversation(id, updateData);

      // Pegar apenas o primeiro nome do agente para mensagem ao cliente
      const agentFirstName = getFirstName(agent.fullName);

      // Buscar template de mensagem de boas-vindas
      const welcomeTemplate = await storage.getMessageTemplateByKey('agent_welcome');
      let welcomeMessage = welcomeTemplate?.template || 
        `Olá! Sou *${agentFirstName}*, seu atendente. Assumí esta conversa e darei continuidade ao seu atendimento.`;
      
      // Substituir variáveis no template
      welcomeMessage = welcomeMessage.replace(/{agentName}/g, agentFirstName);

      // Salvar mensagem no histórico
      const welcomeMessageRecord = await storage.createMessage({
        conversationId: id,
        role: "assistant",
        content: welcomeMessage,
        assistant: `Atendente: ${agentFirstName}`,
      });

      // Atualizar última mensagem da conversa
      await storage.updateConversation(id, {
        lastMessage: welcomeMessage,
        lastMessageTime: new Date(),
      });

      // Enviar mensagem de boas-vindas via WhatsApp
      let whatsappSent = false;
      const phoneNumber = conversation.clientId || conversation.chatId;
      
      if (phoneNumber) {
        try {
          const result = await sendWhatsAppMessage(phoneNumber, welcomeMessage, conversation.evolutionInstance || undefined);
          whatsappSent = result.success;
          // Atualizar mensagem com IDs do WhatsApp
          if (result.success && (result.whatsappMessageId || result.remoteJid)) {
            await storage.updateMessage(welcomeMessageRecord.id, {
              whatsappMessageId: result.whatsappMessageId,
              remoteJid: result.remoteJid,
            });
          }
          
          if (whatsappSent) {
            webhookLogger.success('AGENT_ASSIGNED', `Conversa atribuída a ${agent.fullName}`, {
              conversationId: id,
              agentId: agent.id,
              agentName: agent.fullName,
              phoneNumber,
            });
            console.log(`✅ [Assignment] Mensagem de boas-vindas enviada ao WhatsApp: ${phoneNumber}`);
          } else {
            webhookLogger.error('WHATSAPP_SEND_FAILED', `Falha ao enviar mensagem de atribuição`, {
              conversationId: id,
              agentId: agent.id,
              phoneNumber,
            });
          }
        } catch (error) {
          console.error("❌ [Assignment] Erro ao enviar mensagem ao WhatsApp:", error);
          webhookLogger.error('WHATSAPP_SEND_ERROR', `Erro ao enviar mensagem de atribuição`, {
            conversationId: id,
            agentId: agent.id,
            phoneNumber,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Criar ação de supervisor
      await storage.createSupervisorAction({
        conversationId: id,
        action: "assign",
        notes: `Conversa atribuída a ${agent.fullName || agent.username}`,
        createdBy: req.user!.fullName || req.user!.username,
      });

      // Criar log de atividade
      const isSelfAssign = targetAgentId === currentUser.userId;
      await storage.createActivityLog({
        userId: currentUser.userId,
        action: isSelfAssign ? "self_assign" : "assign_conversation",
        conversationId: id,
        targetUserId: isSelfAssign ? undefined : targetAgentId,
        details: {
          agentName: agent.fullName,
          clientName: conversation.clientName,
          isSelfAssign,
        },
      });

      console.log(`👤 [Assignment] Conversa ${id} atribuída a ${agent.fullName}`);

      return res.json({
        success: true,
        agent: {
          id: agent.id,
          fullName: agent.fullName,
          username: agent.username,
        },
        whatsappSent,
      });
    } catch (error) {
      console.error("Assign conversation error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Transfer conversation to another agent (ADMIN/SUPERVISOR/AGENT can transfer)
  app.post("/api/conversations/:id/transfer", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { agentId, notes, department } = req.body;
      const currentUser = req.user!;

      if (!agentId) {
        return res.status(400).json({ error: "agentId é obrigatório" });
      }

      if (!notes || notes.trim().length === 0) {
        return res.status(400).json({ error: "Motivo da transferência (notes) é obrigatório" });
      }

      // Buscar conversa
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      // Verificar permissão: AGENT só pode transferir conversas atribuídas a ele
      const isAdminOrSupervisor = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR';
      if (!isAdminOrSupervisor) {
        // AGENT: verificar se a conversa está atribuída a ele
        if (conversation.assignedTo !== currentUser.userId) {
          return res.status(403).json({ 
            error: "Você só pode transferir conversas atribuídas a você" 
          });
        }
      }

      // Buscar agente de destino
      const targetAgent = await storage.getUserById(agentId);
      if (!targetAgent) {
        return res.status(404).json({ error: "Agente não encontrado" });
      }

      // Buscar agente atual (se houver) e usar nome completo para logs
      let fromAgentFullName = "Sistema";
      let fromAgentFirstName = "Sistema";
      if (conversation.assignedTo) {
        const fromAgent = await storage.getUserById(conversation.assignedTo);
        if (fromAgent) {
          fromAgentFullName = fromAgent.fullName;
          fromAgentFirstName = getFirstName(fromAgent.fullName);
        }
      }

      // Atualizar conversa com novo agente e departamento (se fornecido)
      const updateData: any = {
        assignedTo: agentId,
      };
      
      // Se departamento foi fornecido pelo supervisor, atualizar
      if (department && ['commercial', 'support', 'financial', 'cancellation', 'general'].includes(department)) {
        updateData.department = department;
        
        // Mapear departamento para assistantType correspondente
        const departmentToAssistant: Record<string, string> = {
          'commercial': 'comercial',
          'support': 'suporte',
          'financial': 'financeiro',
          'cancellation': 'cancelamento',
          'general': 'apresentacao',
        };
        updateData.assistantType = departmentToAssistant[department];
      }
      
      await storage.updateConversation(id, updateData);

      // Pegar apenas o primeiro nome do novo agente para mensagem ao cliente
      const targetAgentFirstName = getFirstName(targetAgent.fullName);

      // Buscar template de mensagem de transferência
      const transferTemplate = await storage.getMessageTemplateByKey('agent_transfer');
      let transferMessage = transferTemplate?.template || 
        `Olá! Sou *${targetAgentFirstName}*, seu novo atendente. Esta conversa foi transferida de *${fromAgentFirstName}* para mim${notes ? `. Motivo: ${notes}` : ''}. Estou aqui para continuar ajudando você!`;
      
      // Substituir variáveis no template
      transferMessage = transferMessage
        .replace(/{agentName}/g, targetAgentFirstName)
        .replace(/{fromAgent}/g, fromAgentFirstName)
        .replace(/{notes}/g, notes || '');

      // Salvar mensagem no histórico
      const transferMessageRecord = await storage.createMessage({
        conversationId: id,
        role: "assistant",
        content: transferMessage,
        assistant: `Atendente: ${targetAgentFirstName}`,
      });

      // Atualizar última mensagem da conversa
      await storage.updateConversation(id, {
        lastMessage: transferMessage,
        lastMessageTime: new Date(),
      });

      // Enviar mensagem de transferência via WhatsApp
      let whatsappSent = false;
      const phoneNumber = conversation.clientId || conversation.chatId;
      
      if (phoneNumber) {
        try {
          const result = await sendWhatsAppMessage(phoneNumber, transferMessage, conversation.evolutionInstance || undefined);
          whatsappSent = result.success;
          // Atualizar mensagem com IDs do WhatsApp
          if (result.success && (result.whatsappMessageId || result.remoteJid)) {
            await storage.updateMessage(transferMessageRecord.id, {
              whatsappMessageId: result.whatsappMessageId,
              remoteJid: result.remoteJid,
            });
          }
          
          if (whatsappSent) {
            webhookLogger.success('CONVERSATION_TRANSFERRED', `Conversa transferida para ${targetAgent.fullName}`, {
              conversationId: id,
              fromAgent: fromAgentFullName,
              toAgent: targetAgent.fullName,
              phoneNumber,
            });
            console.log(`✅ [Transfer] Mensagem de transferência enviada ao WhatsApp: ${phoneNumber}`);
          } else {
            webhookLogger.error('WHATSAPP_SEND_FAILED', `Falha ao enviar mensagem de transferência`, {
              conversationId: id,
              toAgent: targetAgent.fullName,
              phoneNumber,
            });
          }
        } catch (error) {
          console.error("❌ [Transfer] Erro ao enviar mensagem ao WhatsApp:", error);
          webhookLogger.error('WHATSAPP_SEND_ERROR', `Erro ao enviar mensagem de transferência`, {
            conversationId: id,
            toAgent: targetAgent.fullName,
            phoneNumber,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Criar ação de supervisor
      await storage.createSupervisorAction({
        conversationId: id,
        action: "transfer",
        notes: `Conversa transferida de ${fromAgentFullName || 'IA'} para ${targetAgent.fullName || targetAgent.username}${notes ? `. Motivo: ${notes}` : ''}`,
        createdBy: currentUser.fullName || currentUser.username,
      });

      // Criar log de atividade
      await storage.createActivityLog({
        userId: currentUser.userId,
        action: "transfer_conversation",
        conversationId: id,
        targetUserId: agentId,
        details: {
          fromAgent: fromAgentFullName,
          toAgent: targetAgent.fullName,
          notes: notes,
          clientName: conversation.clientName,
        },
      });

      console.log(`🔄 [Transfer] Conversa ${id} transferida de ${fromAgentFullName} para ${targetAgent.fullName}`);

      return res.json({
        success: true,
        agent: {
          id: targetAgent.id,
          fullName: targetAgent.fullName,
          username: targetAgent.username,
        },
        whatsappSent,
      });
    } catch (error) {
      console.error("Transfer conversation error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete message (DB + WhatsApp)
  app.delete("/api/messages/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      // Buscar mensagem
      const message = await storage.getMessage(id);
      if (!message) {
        return res.status(404).json({ error: "Mensagem não encontrada" });
      }

      // Buscar conversa para verificar permissões
      const conversation = await storage.getConversation(message.conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      // Verificar permissões
      const isAdminOrSupervisor = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR';
      const isAssignedAgent = conversation.assignedTo === currentUser.userId;

      if (!isAdminOrSupervisor && !isAssignedAgent) {
        return res.status(403).json({ 
          error: "Você não tem permissão para deletar esta mensagem" 
        });
      }

      // Verificar se mensagem é do assistente (não permitir deletar mensagens do usuário)
      if (message.role !== 'assistant') {
        return res.status(400).json({ 
          error: "Não é possível deletar mensagens do cliente" 
        });
      }

      let whatsappDeleted = false;

      // Deletar do WhatsApp se tiver whatsappMessageId
      if (message.whatsappMessageId && message.remoteJid) {
        try {
          whatsappDeleted = await deleteWhatsAppMessage(
            message.whatsappMessageId,
            message.remoteJid,
            conversation.evolutionInstance || undefined
          );

          if (whatsappDeleted) {
            console.log(`✅ [Delete] Mensagem deletada do WhatsApp: ${message.whatsappMessageId}`);
            webhookLogger.success('MESSAGE_DELETED_WHATSAPP', `Mensagem deletada do WhatsApp`, {
              messageId: id,
              conversationId: conversation.id,
              deletedBy: currentUser.fullName,
            });
          } else {
            console.warn(`⚠️ [Delete] Falha ao deletar do WhatsApp (limite de tempo ou erro)`);
          }
        } catch (error) {
          console.error("❌ [Delete] Erro ao deletar do WhatsApp:", error);
        }
      }

      // Marcar como deletada (soft delete) ao invés de remover do banco
      await storage.updateMessage(id, {
        deletedAt: new Date(),
        deletedBy: currentUser.fullName || currentUser.username,
      });

      console.log(`🗑️ [Delete] Mensagem ${id} marcada como deletada por ${currentUser.fullName}`);

      return res.json({ 
        success: true, 
        whatsappDeleted,
        message: whatsappDeleted 
          ? "Mensagem deletada do WhatsApp e marcada como excluída no sistema" 
          : "Mensagem marcada como excluída no sistema (não foi possível deletar do WhatsApp)"
      });
    } catch (error) {
      console.error("Delete message error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Resolve conversation (agent can only resolve their own assigned conversations)
  app.post("/api/conversations/:id/resolve", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      // Buscar conversa
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      // ✅ BUG FIX: Prevenir logs duplicados - checar se já está finalizada
      if (conversation.status === 'resolved') {
        console.warn(`⚠️ [Resolve] Conversa ${id} já está finalizada. Ignorando duplicata.`);
        return res.status(400).json({ 
          error: "Esta conversa já foi finalizada",
          alreadyResolvedBy: conversation.resolvedBy,
          resolvedAt: conversation.resolvedAt
        });
      }

      // Validação de permissão
      const isAdminOrSupervisor = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR';
      const isAssignedAgent = conversation.assignedTo === currentUser.userId;

      if (!isAdminOrSupervisor && !isAssignedAgent) {
        return res.status(403).json({ 
          error: "Você só pode finalizar conversas atribuídas a você" 
        });
      }

      // ✅ BUG FIX: Usar método transacional atômico para garantir consistência
      // Preparar metadata para aguardar NPS se for WhatsApp
      const currentMetadata = conversation?.metadata as any || {};
      const isWhatsApp = currentMetadata?.source === 'evolution_api';
      
      // Usar método atômico que faz update + activity log em uma transação
      await storage.resolveConversation({
        conversationId: id,
        resolvedBy: currentUser.userId,
        resolvedAt: new Date(),
        createActivityLog: true, // Criar log de atividade para agente
        activityLogDetails: {
          clientName: conversation.clientName,
          assistantType: conversation.assistantType,
        },
        additionalUpdates: {
          assignedTo: null, // Desatribuir conversa ao finalizar
          transferredToHuman: false, // Limpar flag de transferência ao finalizar
        },
        metadata: isWhatsApp ? { ...currentMetadata, awaitingNPS: true } : currentMetadata,
      });

      // Criar ação de supervisor (após resolução bem-sucedida)
      await storage.createSupervisorAction({
        conversationId: id,
        action: "mark_resolved",
        notes: `Conversa finalizada por ${currentUser.fullName || currentUser.username}`,
        createdBy: currentUser.fullName || currentUser.username,
      });

      // Create learning event for successful resolution
      const messages = await storage.getMessagesByConversationId(id);
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      const lastAiMessage = messages.filter(m => m.role === 'assistant').pop();

      if (lastUserMessage && lastAiMessage) {
        await storage.createLearningEvent({
          conversationId: id,
          eventType: 'implicit_success',
          assistantType: conversation.assistantType,
          userMessage: lastUserMessage.content,
          aiResponse: lastAiMessage.content,
          sentiment: conversation.sentiment || 'positive',
          resolution: 'success',
        });
        console.log("📚 [Learning] Evento de sucesso criado para", conversation.assistantType);
      }

      // Enviar pesquisa NPS para cliente via WhatsApp
      const metadata = conversation.metadata as any;
      console.log(`🔍 [NPS Debug] Checando condições para envio de NPS:`, {
        hasEvolutionMetadata: metadata?.source === 'evolution_api',
        hasClientId: !!conversation.clientId,
        clientId: conversation.clientId,
        chatId: conversation.chatId,
        evolutionInstance: conversation.evolutionInstance
      });
      
      if (metadata?.source === 'evolution_api' && conversation.clientId) {
        // Buscar template de NPS
        const npsTemplate = await storage.getMessageTemplateByKey('nps_survey');
        let npsMessage = npsTemplate?.template || 
          `Olá ${conversation.clientName}!\n\nSeu atendimento foi finalizado.\n\n*Pesquisa de Satisfação*\n\nEm uma escala de 0 a 10, qual sua satisfação com o atendimento?\n\nDigite um número de *0* (muito insatisfeito) a *10* (muito satisfeito).`;
        
        // Substituir variáveis
        npsMessage = npsMessage.replace(/{clientName}/g, conversation.clientName);

        console.log(`📤 [NPS] Enviando pesquisa NPS para ${conversation.clientName} (${conversation.clientId})`);
        const sent = await sendWhatsAppMessage(conversation.clientId, npsMessage, conversation.evolutionInstance || undefined);
        
        if (sent.success) {
          console.log(`✅ [NPS] Pesquisa enviada com sucesso para ${conversation.clientName}`);
        } else {
          console.error(`❌ [NPS] Falha ao enviar pesquisa - sem sucesso`);
        }
      } else {
        console.warn(`⚠️  [NPS] Pesquisa NPS NÃO enviada - Condições não atendidas`);
      }

      console.log(`✅ [Resolve] Conversa ${id} finalizada por ${currentUser.fullName}`);

      return res.json({ 
        success: true,
        resolvedBy: currentUser.fullName,
      });
    } catch (error) {
      console.error("Resolve conversation error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reset OpenAI thread context (clear AI history while keeping messages in DB)
  app.post("/api/conversations/:id/reset-thread", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      // Buscar conversa
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      console.log(`🔄 [Reset Thread] Iniciando reset do contexto OpenAI para conversa ${id} por ${currentUser.fullName}`);

      // Criar nova thread OpenAI (contexto vazio)
      const newThreadId = await createThread();
      
      console.log(`✅ [Reset Thread] Nova thread criada: ${newThreadId}`);

      // Atualizar threadId no banco de dados
      await storage.updateConversation(id, {
        threadId: newThreadId,
      });

      // Atualizar no Redis também
      if (conversation.chatId) {
        await storeConversationThread(conversation.chatId, newThreadId);
        console.log(`✅ [Reset Thread] Thread atualizada no Redis para chatId ${conversation.chatId}`);
      }

      // Registrar ação de supervisor
      await storage.createSupervisorAction({
        conversationId: id,
        action: "reset_thread",
        notes: `Contexto OpenAI resetado por ${currentUser.fullName}. Nova thread: ${newThreadId}`,
        createdBy: currentUser.fullName || currentUser.username,
      });

      // Buscar contagem de mensagens mantidas
      const messages = await storage.getMessagesByConversationId(id);
      const messageCount = messages.length;

      console.log(`✅ [Reset Thread] Contexto resetado com sucesso! ${messageCount} mensagens mantidas no banco.`);

      return res.json({ 
        success: true,
        message: "Contexto OpenAI resetado com sucesso",
        newThreadId,
        messagesKept: messageCount,
        resetBy: currentUser.fullName,
      });
    } catch (error) {
      console.error("❌ [Reset Thread] Erro ao resetar contexto:", error);
      return res.status(500).json({ error: "Erro ao resetar contexto OpenAI" });
    }
  });

  // Mark conversation as verified by supervisor
  app.post("/api/conversations/:id/verify", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      // Buscar conversa
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      // Atualizar conversa com informações de verificação
      await storage.updateConversation(id, {
        verifiedAt: new Date(),
        verifiedBy: currentUser.userId,
      });

      // Registrar ação de supervisor
      await storage.createSupervisorAction({
        conversationId: id,
        action: "verify_conversation",
        notes: `Conversa verificada por ${currentUser.fullName || currentUser.username}`,
        createdBy: currentUser.fullName || currentUser.username,
      });

      // Criar log de atividade
      await storage.createActivityLog({
        userId: currentUser.userId,
        action: "verify_conversation",
        conversationId: id,
        details: {
          clientName: conversation.clientName,
        },
      });

      console.log(`✅ [Verify] Conversa ${id} verificada por ${currentUser.fullName}`);

      return res.json({ 
        success: true,
        verifiedAt: new Date(),
        verifiedBy: currentUser.fullName,
      });
    } catch (error) {
      console.error("❌ [Verify] Erro ao verificar conversa:", error);
      return res.status(500).json({ error: "Erro ao verificar conversa" });
    }
  });

  // Reopen conversation (reactivate closed/resolved conversation)
  app.post("/api/conversations/:id/reopen", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      // Verificar se conversa já está ativa
      if (conversation.status === 'active') {
        return res.status(400).json({ error: "Conversa já está ativa" });
      }

      // Reativar conversa
      await storage.updateConversation(id, {
        status: 'active',
        lastMessageTime: new Date(),
        verifiedAt: null,
        verifiedBy: null,
      });

      // Registrar ação de supervisor
      await storage.createSupervisorAction({
        conversationId: id,
        action: "reopen_conversation",
        notes: `Conversa reaberta por ${currentUser.fullName || currentUser.username}`,
        createdBy: currentUser.fullName || currentUser.username,
      });

      // Criar log de atividade
      await storage.createActivityLog({
        userId: currentUser.userId,
        action: "reopen_conversation",
        conversationId: id,
        details: {
          clientName: conversation.clientName,
          previousStatus: conversation.status,
        },
      });

      console.log(`✅ [Reopen] Conversa ${id} reaberta por ${currentUser.fullName}`);

      return res.json({ 
        success: true,
        message: "Conversa reaberta com sucesso",
        reopenedBy: currentUser.fullName,
      });
    } catch (error) {
      console.error("❌ [Reopen] Erro ao reabrir conversa:", error);
      return res.status(500).json({ error: "Erro ao reabrir conversa" });
    }
  });

  const httpServer = createServer(app);

  // Setup unified WebSocket server for real-time logs (webhook + agent reasoning)
  setupWebSockets(httpServer);

  // Endpoint to get webhook logs
  app.get("/api/webhook-logs", authenticate, requireAdmin, (req, res) => {
    const logs = webhookLogger.getLogs();
    return res.json({ logs });
  });

  // Endpoint to get webhook stats
  app.get("/api/webhook-logs/stats", authenticate, requireAdmin, (req, res) => {
    const stats = webhookLogger.getStats();
    return res.json(stats);
  });

  // Endpoint to clear webhook logs
  app.post("/api/webhook-logs/clear", authenticate, requireAdmin, (req, res) => {
    webhookLogger.clearLogs();
    return res.json({ success: true, message: "Logs cleared" });
  });

  // Endpoint to get agent reasoning logs
  app.get("/api/agent-logs", authenticate, requireAdmin, (req, res) => {
    const logs = agentLogger.getLogs();
    return res.json({ logs });
  });

  // Endpoint to get agent logs stats
  app.get("/api/agent-logs/stats", authenticate, requireAdmin, (req, res) => {
    const stats = agentLogger.getStats();
    return res.json(stats);
  });

  // Endpoint to clear agent logs
  app.post("/api/agent-logs/clear", authenticate, requireAdmin, (req, res) => {
    agentLogger.clearLogs();
    return res.json({ success: true, message: "Agent logs cleared" });
  });

  // ============================================================================
  // SYSTEM HEALTH & DIAGNOSTICS
  // ============================================================================
  
  // Health check com diagnóstico de assistants e Evolution API
  app.get("/api/health", async (req, res) => {
    const { ASSISTANT_ENV_STATUS, ASSISTANT_IDS } = await import("./lib/openai");
    
    const assistantStatus: Record<string, { configured: boolean; id?: string }> = {};
    
    for (const [key, value] of Object.entries(ASSISTANT_IDS)) {
      assistantStatus[key] = {
        configured: !!value,
        id: value ? `${value.substring(0, 8)}...` : undefined,
      };
    }
    
    // Validate Evolution API configuration (use normalized URL that the code actually uses)
    const evolutionUrl = EVOLUTION_CONFIG.apiUrl; // Already normalized with protocol
    const evolutionApiKey = EVOLUTION_CONFIG.apiKey;
    const evolutionInstance = EVOLUTION_CONFIG.instance;
    
    let evolutionUrlStatus = 'not_configured';
    let evolutionUrlDetails = '';
    
    if (evolutionUrl) {
      if (!evolutionUrl.startsWith('http://') && !evolutionUrl.startsWith('https://')) {
        evolutionUrlStatus = 'missing_protocol';
        evolutionUrlDetails = `URL sem protocolo. Use: https://${evolutionUrl}`;
      } else {
        evolutionUrlStatus = 'ok';
        evolutionUrlDetails = `${evolutionUrl.substring(0, 50)}...`;
      }
    }
    
    return res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      openai: {
        apiKeyConfigured: !!process.env.OPENAI_API_KEY,
        assistantsConfigured: ASSISTANT_ENV_STATUS.configured,
        assistantsMissing: ASSISTANT_ENV_STATUS.missing,
        isValid: ASSISTANT_ENV_STATUS.isValid,
        details: assistantStatus,
      },
      evolution: {
        urlConfigured: !!evolutionUrl,
        urlStatus: evolutionUrlStatus,
        urlDetails: evolutionUrlDetails,
        apiKeyConfigured: !!evolutionApiKey,
        instanceConfigured: !!evolutionInstance,
        isValid: evolutionUrlStatus === 'ok' && !!evolutionApiKey && !!evolutionInstance,
      },
      redis: {
        configured: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
      },
      database: {
        configured: !!process.env.DATABASE_URL,
      },
    });
  });
  
  // ============================================================================
  // PRODUCTION LOGS ROUTES - Debug em Produção
  // ============================================================================
  
  const { prodLogger } = await import("./lib/production-logger");
  
  // Obter logs de produção (com filtros)
  app.get("/api/production-logs", authenticate, requireAdminOrSupervisor, (req, res) => {
    const { level, category, conversationId, phoneNumber, limit } = req.query;
    
    const filters: any = {};
    if (level) filters.level = level;
    if (category) filters.category = category;
    if (conversationId) filters.conversationId = conversationId;
    if (phoneNumber) filters.phoneNumber = phoneNumber;
    if (limit) filters.limit = parseInt(limit as string);
    
    const logs = prodLogger.search(filters);
    const stats = prodLogger.getStats();
    
    return res.json({ logs, stats });
  });
  
  // Obter apenas erros
  app.get("/api/production-logs/errors", authenticate, requireAdminOrSupervisor, (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const errors = prodLogger.getErrors(limit);
    return res.json({ errors, count: errors.length });
  });
  
  // Obter logs por conversação
  app.get("/api/production-logs/conversation/:id", authenticate, requireAdminOrSupervisor, (req, res) => {
    const conversationId = req.params.id;
    const logs = prodLogger.search({ conversationId, limit: 100 });
    return res.json({ logs, conversationId });
  });
  
  // Limpar logs
  app.post("/api/production-logs/clear", authenticate, requireAdmin, (req, res) => {
    prodLogger.clear();
    return res.json({ success: true, message: "Production logs cleared" });
  });

  // ============================================================================
  // DASHBOARD METRICS ROUTES
  // ============================================================================

  // Agent Dashboard Metrics
  app.get("/api/dashboard/agent", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { period = 'today' } = req.query;
      
      const metrics = await storage.getAgentMetrics(userId, period as 'today' | 'week' | 'month');
      return res.json(metrics);
    } catch (error) {
      console.error("❌ [Dashboard] Error getting agent metrics:", error);
      return res.status(500).json({ error: "Error fetching agent metrics" });
    }
  });

  // Supervisor Dashboard Metrics
  const dashboardCache = new RedisCache('dashboard');
  app.get("/api/dashboard/supervisor", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      // Try cache first (30s TTL - dashboards auto-refresh every 30s anyway)
      const cacheKey = 'supervisor-metrics';
      const cached = await dashboardCache.get(cacheKey);
      if (cached) {
        console.log(`💾 [Cache] Dashboard metrics HIT`);
        return res.json(cached);
      }
      
      const metrics = await storage.getSupervisorMetrics();
      
      // Cache for 30 seconds
      await dashboardCache.set(cacheKey, metrics, { ttl: 30 });
      console.log(`💾 [Cache] Dashboard metrics MISS - cached for 30s`);
      
      return res.json(metrics);
    } catch (error) {
      console.error("❌ [Dashboard] Error getting supervisor metrics:", error);
      return res.status(500).json({ error: "Error fetching supervisor metrics" });
    }
  });

  // AI Performance Metrics
  app.get("/api/dashboard/ai-performance", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Converter strings para Date se fornecidos
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const metrics = await storage.getAIPerformanceMetrics(start, end);
      return res.json(metrics);
    } catch (error) {
      console.error("❌ [Dashboard] Error getting AI performance metrics:", error);
      return res.status(500).json({ error: "Error fetching AI performance metrics" });
    }
  });

  // Admin Dashboard Metrics
  app.get("/api/dashboard/admin", authenticate, requireAdmin, async (req, res) => {
    try {
      const metrics = await storage.getAdminMetrics();
      return res.json(metrics);
    } catch (error) {
      console.error("❌ [Dashboard] Error getting admin metrics:", error);
      return res.status(500).json({ error: "Error fetching admin metrics" });
    }
  });

  // ============================================================================
  // AGENTS STATUS MONITOR
  // ============================================================================

  // Get all agents list (for dropdowns and filters)
  app.get("/api/agents/list", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const agents = allUsers.filter(u => u.role === "AGENT" || u.role === "SUPERVISOR");
      return res.json(agents);
    } catch (error) {
      console.error("❌ [Agents] Error getting agents list:", error);
      return res.status(500).json({ error: "Error fetching agents list" });
    }
  });

  // Get all agents status (online/idle/offline) with metrics
  app.get("/api/agents/status", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Parse dates if provided
      let dateFilter: { startDate?: Date; endDate?: Date } = {};
      if (startDate) {
        dateFilter.startDate = new Date(startDate as string);
        if (isNaN(dateFilter.startDate.getTime())) {
          return res.status(400).json({ error: "Invalid startDate format" });
        }
      }
      if (endDate) {
        dateFilter.endDate = new Date(endDate as string);
        if (isNaN(dateFilter.endDate.getTime())) {
          return res.status(400).json({ error: "Invalid endDate format" });
        }
      }

      const agentsStatus = await storage.getAgentsStatus(dateFilter);
      return res.json(agentsStatus);
    } catch (error) {
      console.error("❌ [Agents Status] Error getting agents status:", error);
      return res.status(500).json({ error: "Error fetching agents status" });
    }
  });

  // ============================================================================
  // AGENT REPORTS
  // ============================================================================

  // Get historical agent performance reports
  app.get("/api/reports/agents", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { startDate, endDate, agentId, groupBy = 'day' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const reports = await storage.getAgentReports({
        startDate: start,
        endDate: end,
        agentId: agentId as string | undefined,
        groupBy: groupBy as 'day' | 'week' | 'month'
      });

      return res.json(reports);
    } catch (error) {
      console.error("❌ [Reports] Error getting agent reports:", error);
      return res.status(500).json({ error: "Error fetching agent reports" });
    }
  });

  // ============================================================================
  // COMPLAINTS (OUVIDORIA)
  // ============================================================================

  // Create a new complaint
  app.post("/api/complaints", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { conversationId, complaintType, description, severity } = insertComplaintSchema.parse(req.body);
      
      const complaint = await storage.createComplaint({
        conversationId,
        complaintType,
        description,
        severity,
        status: 'novo',
      });

      console.log(`✅ [Complaints] Complaint created: ${complaint.id}`);
      return res.json(complaint);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid complaint data", details: error.errors });
      }
      console.error("❌ [Complaints] Error creating complaint:", error);
      return res.status(500).json({ error: "Error creating complaint" });
    }
  });

  // Get all complaints
  app.get("/api/complaints", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { status, severity, conversationId } = req.query;

      let complaints;
      if (conversationId) {
        complaints = await storage.getComplaintsByConversationId(conversationId as string);
      } else if (status) {
        complaints = await storage.getComplaintsByStatus(status as string);
      } else if (severity) {
        complaints = await storage.getComplaintsBySeverity(severity as string);
      } else {
        complaints = await storage.getAllComplaints();
      }

      return res.json(complaints);
    } catch (error) {
      console.error("❌ [Complaints] Error fetching complaints:", error);
      return res.status(500).json({ error: "Error fetching complaints" });
    }
  });

  // Get a specific complaint
  app.get("/api/complaints/:id", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const complaint = await storage.getComplaint(req.params.id);
      
      if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      return res.json(complaint);
    } catch (error) {
      console.error("❌ [Complaints] Error fetching complaint:", error);
      return res.status(500).json({ error: "Error fetching complaint" });
    }
  });

  // Update a complaint
  app.patch("/api/complaints/:id", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const updates = updateComplaintSchema.parse(req.body);
      const updated = await storage.updateComplaint(req.params.id, updates);

      if (!updated) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      console.log(`✅ [Complaints] Complaint updated: ${updated.id}`);
      return res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      console.error("❌ [Complaints] Error updating complaint:", error);
      return res.status(500).json({ error: "Error updating complaint" });
    }
  });

  // ==================== CONTACTS ROUTES ====================
  
  // Get all contacts with optional filters
  app.get("/api/contacts", authenticate, async (req, res) => {
    try {
      const { search, status, hasRecurringIssues } = req.query;

      const contacts = await storage.getContactsWithFilters({
        search: search as string | undefined,
        status: status as string | undefined,
        hasRecurringIssues: hasRecurringIssues === 'true' ? true : hasRecurringIssues === 'false' ? false : undefined,
      });

      console.log(`✅ [Contacts] Retrieved ${contacts.length} contacts`);
      return res.json(contacts);
    } catch (error) {
      console.error("❌ [Contacts] Error fetching contacts:", error);
      return res.status(500).json({ error: "Error fetching contacts" });
    }
  });

  // Get contact by ID with conversation history
  app.get("/api/contacts/:id", authenticate, async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id);

      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Get all conversations for this contact (by phone number)
      const allConversations = await storage.getAllConversations();
      const contactConversations = allConversations.filter(
        conv => conv.chatId.includes(contact.phoneNumber)
      );

      return res.json({
        ...contact,
        conversations: contactConversations,
      });
    } catch (error) {
      console.error("❌ [Contacts] Error fetching contact:", error);
      return res.status(500).json({ error: "Error fetching contact" });
    }
  });

  // Update contact information (name, document/CPF/CNPJ, phoneNumber, etc)
  app.patch("/api/contacts/:id", authenticate, async (req, res) => {
    try {
      const contactId = req.params.id;
      
      // Validate request body using updateContactSchema
      const updateSchema = z.object({
        name: z.string().optional(),
        document: z.string().optional(),
        phoneNumber: z.string().optional(),
        status: z.enum(['active', 'inactive']).optional(),
        hasRecurringIssues: z.boolean().optional(),
      });

      const validation = updateSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid update data",
          details: validation.error.errors 
        });
      }

      // Check if contact exists
      const existingContact = await storage.getContact(contactId);
      
      if (!existingContact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // SAFETY CHECK: If trying to change phoneNumber, verify contact has no conversation history
      if (validation.data.phoneNumber && validation.data.phoneNumber !== existingContact.phoneNumber) {
        // Check if contact has any conversations
        const allConversations = await storage.getAllConversations();
        const hasConversations = allConversations.some(
          conv => conv.chatId.includes(existingContact.phoneNumber)
        );

        if (hasConversations) {
          return res.status(400).json({ 
            error: "Não é possível alterar o número de telefone de um contato que já possui histórico de conversas. Para alterar o número, entre em contato com o suporte técnico.",
            code: "PHONE_CHANGE_NOT_ALLOWED"
          });
        }
      }

      // Update contact
      const updatedContact = await storage.updateContact(contactId, validation.data);

      if (!updatedContact) {
        return res.status(500).json({ error: "Failed to update contact" });
      }

      // Sync contact changes to all related conversations
      try {
        const syncUpdates: { name?: string; document?: string } = {};
        if (validation.data.name !== undefined) {
          syncUpdates.name = validation.data.name;
        }
        if (validation.data.document !== undefined) {
          syncUpdates.document = validation.data.document;
        }
        
        if (Object.keys(syncUpdates).length > 0) {
          const conversationsUpdated = await storage.syncContactToConversations(
            updatedContact.phoneNumber,
            syncUpdates
          );
          console.log(`🔄 [Contacts] Synced contact updates to ${conversationsUpdated} conversations`);
        }
      } catch (syncError) {
        console.error("⚠️ [Contacts] Error syncing contact to conversations:", syncError);
        // Don't fail the whole request if sync fails
      }

      console.log(`✅ [Contacts] Contact ${contactId} updated successfully`);
      return res.json(updatedContact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      console.error("❌ [Contacts] Error updating contact:", error);
      return res.status(500).json({ error: "Error updating contact" });
    }
  });

  // Create new contact with conversation and assignment
  app.post("/api/contacts/create", authenticate, async (req, res) => {
    try {
      // Validate request body
      const createContactSchema = z.object({
        phoneNumber: z.string().min(10, "Phone number must have at least 10 digits"),
        name: z.string().optional(),
        document: z.string().optional(),
        message: z.string().optional(),
        assignedTo: z.string().optional(),
        department: z.string().optional(),
        evolutionInstance: z.string().optional(),
      });

      const validation = createContactSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: validation.error.errors 
        });
      }

      const { phoneNumber, name, document, message, assignedTo, department, evolutionInstance } = validation.data;

      // CRITICAL: Normalize phone number to canonical format (55XXXXXXXXXXX)
      // This ensures consistent chatId creation for both regular and Business WhatsApp accounts
      const normalizedPhone = normalizePhone(phoneNumber);
      
      if (!normalizedPhone) {
        return res.status(400).json({ error: "Invalid phone number - unable to normalize" });
      }

      // Check if contact already exists (using normalized phone)
      const existingContact = await storage.getContactByPhoneNumber(normalizedPhone);
      
      if (existingContact) {
        return res.status(400).json({ error: "Contact with this phone number already exists" });
      }

      // Create contact with normalized phone
      const contact = await storage.createContact({
        phoneNumber: normalizedPhone,
        name: name || null,
        document: document || null,
        status: 'active',
        totalConversations: 0,
        hasRecurringIssues: false,
      });

      console.log(`✅ [Contacts] Created new contact ${normalizedPhone}`);

      // Create conversation (not assigned - goes to "Transferidas" for manual follow-up)
      // Map department to assistantType
      const departmentToAssistant: Record<string, string> = {
        'commercial': 'comercial',
        'support': 'suporte',
        'financial': 'financeiro',
        'cancellation': 'cancelamento',
        'general': 'apresentacao',
      };
      
      // CRITICAL: Use buildWhatsAppChatId to create properly formatted chatId
      // This prevents chatId malformation and ensures compatibility with WhatsApp Business (@lid)
      const chatId = buildWhatsAppChatId(normalizedPhone);
      const conversation = await storage.createConversation({
        chatId,
        clientName: name || normalizedPhone,
        clientId: normalizedPhone,
        clientDocument: document || undefined,
        assistantType: department ? (departmentToAssistant[department] || 'cortex') : 'cortex',
        department: department || 'general',
        status: 'active',
        transferredToHuman: true,
        transferReason: 'Novo contato criado via painel - aguardando mensagem manual do atendente',
        transferredAt: new Date(),
        assignedTo: assignedTo === 'none' || !assignedTo ? null : assignedTo, // null = "Transferidas", specific ID = "Atribuídas"
        evolutionInstance: evolutionInstance || 'Leads', // Default to Leads if not provided
        metadata: { 
          createdFromContact: true, 
          createdBy: req.user?.userId,
          createdByName: req.user?.fullName,
          createdAt: new Date() 
        },
      });

      console.log(`✅ [Contacts] Created conversation and moved to ${assignedTo && assignedTo !== 'none' ? 'Atribuídas' : 'Transferidas'}: ${conversation.id}`);

      // Update contact with conversation info
      await storage.updateContact(contact.id, {
        lastConversationId: conversation.id,
        lastConversationDate: new Date(),
        totalConversations: 1,
      });

      if (assignedTo && assignedTo !== 'none') {
        console.log(`✅ [Contacts] Conversation assigned to agent ${assignedTo}`);
      } else {
        console.log(`✅ [Contacts] Conversation moved to Transferidas - Agent can send message manually`);
      }

      return res.json({ 
        success: true, 
        message: assignedTo && assignedTo !== 'none' 
          ? "Contato criado e atribuído. Você pode enviar mensagens agora."
          : "Contato criado e movido para 'Transferidas'. Você pode enviar mensagens agora.",
        contact,
        conversation,
      });
    } catch (error) {
      console.error("❌ [Contacts] Error creating contact:", error);
      return res.status(500).json({ error: "Error creating contact" });
    }
  });

  // Reopen conversation with a contact (just reactivate - no message sent)
  app.post("/api/contacts/reopen", authenticate, async (req, res) => {
    try {
      console.log(`🔵 [Contacts] Reopen conversation request received`);
      
      const { contactId } = req.body;

      if (!contactId) {
        console.log(`❌ [Contacts] No contact ID provided`);
        return res.status(400).json({ error: "Contact ID is required" });
      }

      const contact = await storage.getContact(contactId);

      if (!contact) {
        console.log(`❌ [Contacts] Contact not found: ${contactId}`);
        return res.status(404).json({ error: "Contact not found" });
      }

      // CRITICAL: Use buildWhatsAppChatId to create properly formatted chatId
      // contact.phoneNumber is already normalized (55XXXXXXXXXXX) from contact creation
      // This ensures compatibility with WhatsApp Business (@lid) and prevents malformation
      const chatId = buildWhatsAppChatId(contact.phoneNumber);
      
      console.log(`📞 [Contacts] Reopening conversation for ${contact.name} (${contact.phoneNumber})`);

      // Create or reactivate conversation and transfer to human
      let conversation = await storage.getConversationByChatId(chatId);

      if (!conversation) {
        // Determine evolutionInstance and department: use last conversation's values or defaults
        let evolutionInstance = 'Leads'; // Default instance (supported: Leads, Cobranca, Principal)
        let department = 'support'; // Default: support instead of general (so it appears in Transferidas)
        let assistantType = 'suporte'; // Default: suporte assistant
        
        if (contact.lastConversationId) {
          try {
            const lastConversation = await storage.getConversation(contact.lastConversationId);
            if (lastConversation) {
              if (lastConversation.evolutionInstance) {
                evolutionInstance = lastConversation.evolutionInstance;
                console.log(`📞 [Contacts] Reusing evolutionInstance from last conversation: ${evolutionInstance}`);
              }
              // Preserve department and assistantType from last conversation (even if general)
              if (lastConversation.department) {
                department = lastConversation.department === 'general' ? 'support' : lastConversation.department;
                assistantType = lastConversation.assistantType;
                console.log(`📞 [Contacts] Preserving department=${department} and assistantType=${assistantType} from last conversation`);
              }
            }
          } catch (error) {
            console.warn(`⚠️ [Contacts] Could not fetch last conversation, using defaults`);
          }
        }

        // Create new conversation transferred to human (not assigned - goes to "Transferidas")
        conversation = await storage.createConversation({
          chatId,
          clientName: contact.name || contact.phoneNumber,
          clientId: contact.phoneNumber,
          clientDocument: contact.document || undefined,
          assistantType,
          department,
          status: 'active',
          transferredToHuman: true,
          transferReason: 'Conversa reaberta pelo atendente via painel de Contatos',
          transferredAt: new Date(),
          assignedTo: null, // Not assigned - available for any agent in "Transferidas"
          evolutionInstance, // Preserve instance from last conversation or use default
          metadata: { 
            reopened: true, 
            reopenedBy: req.user?.userId, 
            reopenedAt: new Date() 
          },
        });

        console.log(`✅ [Contacts] Created new conversation with evolutionInstance=${evolutionInstance}, department=${department} and moved to Transferidas: ${conversation.id}`);
      } else {
        // Reactivate existing conversation and transfer to human (not assigned - goes to "Transferidas")
        // IMPORTANT: Preserve evolutionInstance from original conversation
        await storage.updateConversation(conversation.id, {
          status: 'active',
          transferredToHuman: true,
          transferReason: 'Conversa reaberta pelo atendente via painel de Contatos',
          transferredAt: new Date(),
          assignedTo: null, // Not assigned - available for any agent in "Transferidas"
          lastMessageTime: new Date(),
          // DO NOT update evolutionInstance - preserve original instance
          metadata: { 
            ...conversation.metadata as any, 
            reopened: true, 
            reopenedBy: req.user?.userId, 
            reopenedAt: new Date() 
          },
        });

        console.log(`✅ [Contacts] Reactivated existing conversation (preserving evolutionInstance=${conversation.evolutionInstance}) and moved to Transferidas: ${conversation.id}`);
      }

      // Update contact's last conversation
      await storage.updateContact(contact.id, {
        lastConversationId: conversation.id,
        lastConversationDate: new Date(),
      });

      console.log(`✅ [Contacts] Conversation reopened and moved to Transferidas - Agent can now send messages`);
      
      return res.json({ 
        success: true, 
        message: "Conversa reaberta e transferida para você. Escreva e envie sua mensagem quando quiser.",
        conversation,
      });
    } catch (error) {
      console.error("❌ [Contacts] Error reopening conversation:", error);
      return res.status(500).json({ error: "Error reopening conversation" });
    }
  });

  // ==== GROUPS ENDPOINTS ====

  // Get all groups with filters
  app.get("/api/groups", authenticate, async (req, res) => {
    try {
      const { search, aiEnabled } = req.query;

      const groups = await storage.getGroupsWithFilters({
        search: search as string | undefined,
        aiEnabled: aiEnabled === 'true' ? true : aiEnabled === 'false' ? false : undefined,
      });

      console.log(`✅ [Groups] Retrieved ${groups.length} groups`);
      return res.json(groups);
    } catch (error) {
      console.error("❌ [Groups] Error fetching groups:", error);
      return res.status(500).json({ error: "Error fetching groups" });
    }
  });

  // Get group by ID
  app.get("/api/groups/:id", authenticate, async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      return res.json(group);
    } catch (error) {
      console.error("❌ [Groups] Error fetching group:", error);
      return res.status(500).json({ error: "Error fetching group" });
    }
  });

  // Toggle AI for a group
  app.put("/api/groups/:id/toggle-ai", authenticate, async (req, res) => {
    try {
      const { aiEnabled } = req.body;

      if (typeof aiEnabled !== 'boolean') {
        return res.status(400).json({ error: "aiEnabled must be a boolean" });
      }

      const group = await storage.toggleGroupAi(req.params.id, aiEnabled);

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      console.log(`✅ [Groups] Toggled AI for group ${group.name}: ${aiEnabled ? 'ON' : 'OFF'}`);
      return res.json(group);
    } catch (error) {
      console.error("❌ [Groups] Error toggling AI:", error);
      return res.status(500).json({ error: "Error toggling AI" });
    }
  });

  // Get group messages (chat history) with pagination
  app.get("/api/groups/:id/messages", authenticate, async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Build chatId for the group
      const chatId = `whatsapp_${group.groupId}`;

      // Find conversation for this group
      const conversation = await storage.getConversationByChatId(chatId);

      if (!conversation) {
        // No messages yet
        return res.json({ messages: [], hasMore: false });
      }

      // Parse pagination parameters
      const before = req.query.before as string | undefined;
      const limit = parseInt(req.query.limit as string) || 15;

      // Get paginated messages
      const result = await storage.getMessagesPaginated(conversation.id, { 
        before, 
        limit 
      });

      console.log(`✅ [Groups] Retrieved ${result.messages.length} messages for group ${group.name} (hasMore: ${result.hasMore})`);
      return res.json(result);
    } catch (error) {
      console.error("❌ [Groups] Error fetching group messages:", error);
      return res.status(500).json({ error: "Error fetching group messages" });
    }
  });

  // Send message to group
  app.post("/api/groups/:id/send", authenticate, async (req, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      const group = await storage.getGroup(req.params.id);

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Get Evolution API configuration
      const evolutionUrl = process.env.EVOLUTION_API_URL;
      // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
      const instance = validateEvolutionInstance(group.evolutionInstance || 'Leads');

      if (!evolutionUrl) {
        return res.status(500).json({ error: "Evolution API not configured" });
      }

      // Get API key for this instance
      const apiKey = await getEvolutionApiKey(instance);

      if (!apiKey) {
        return res.status(500).json({ error: `API key not found for instance ${instance}` });
      }

      // Ensure URL has protocol
      const finalUrl = evolutionUrl.startsWith('http') 
        ? evolutionUrl 
        : `https://${evolutionUrl}`;

      // Send message via Evolution API
      const sendUrl = `${finalUrl}/message/sendText/${instance}`;
      
      console.log(`📤 [Groups] Sending message to group ${group.name} via ${sendUrl}`);

      const response = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify({
          number: group.groupId, // Group ID (ex: 120899938475839@g.us)
          text: message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Groups] Error sending message to Evolution API:`, errorText);
        return res.status(500).json({ error: "Failed to send message to WhatsApp" });
      }

      const result = await response.json();

      // Save message to database
      const chatId = `whatsapp_${group.groupId}`;
      let conversation = await storage.getConversationByChatId(chatId);

      // Create conversation if it doesn't exist
      if (!conversation) {
        const { createThread } = await import("./lib/openai");
        const { storeConversationThread } = await import("./lib/upstash");
        const { ASSISTANT_IDS, ASSISTANT_TO_DEPARTMENT } = await import("./lib/openai");
        
        const threadId = await createThread();
        await storeConversationThread(chatId, threadId);

        conversation = await storage.createConversation({
          chatId,
          clientName: group.name,
          clientId: group.groupId,
          threadId,
          assistantType: "apresentacao",
          department: ASSISTANT_TO_DEPARTMENT["apresentacao"] || "general",
          status: "active",
          sentiment: "neutral",
          urgency: "normal",
          duration: 0,
          lastMessage: message,
          evolutionInstance: instance,
          metadata: { 
            source: 'supervisor_group_message',
            groupId: group.id,
          },
        });
      }

      // Save the message
      const messageRecord = await storage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: message,
        sendBy: 'supervisor',
        assistant: 'supervisor',
      });

      // Update conversation last message
      await storage.updateConversation(conversation.id, {
        lastMessage: message,
        lastMessageTime: new Date(),
      });

      // Update group last message
      await storage.updateGroup(group.id, {
        lastMessage: message.substring(0, 100),
        lastMessageTime: new Date(),
      });

      console.log(`✅ [Groups] Message sent successfully to group ${group.name}`);
      return res.json({ 
        success: true, 
        message: messageRecord,
        evolutionResponse: result 
      });
    } catch (error) {
      console.error("❌ [Groups] Error sending message:", error);
      return res.status(500).json({ error: "Error sending message to group" });
    }
  });

  // Send media to group (images, documents, audio)
  app.post("/api/groups/:id/send-media", authenticate, async (req, res) => {
    try {
      const { mediaBase64, mediaType, caption, fileName } = req.body;

      if (!mediaBase64 || typeof mediaBase64 !== 'string') {
        return res.status(400).json({ error: "Media base64 is required" });
      }

      if (!mediaType || !['image', 'document', 'audio'].includes(mediaType)) {
        return res.status(400).json({ error: "Invalid media type. Must be 'image', 'document', or 'audio'" });
      }

      const group = await storage.getGroup(req.params.id);

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Validate and normalize Evolution instance (Leads, Cobranca, or Principal)
      const instance = validateEvolutionInstance(group.evolutionInstance || 'Leads');

      console.log(`📤 [Groups] Sending ${mediaType} to group ${group.name}`);

      // Import sendWhatsAppMedia from workers
      const { sendWhatsAppMedia } = await import("./workers");

      // Send media via Evolution API
      const result = await sendWhatsAppMedia(
        group.groupId, // Group ID (ex: 120899938475839@g.us)
        mediaBase64,
        mediaType as 'image' | 'document' | 'audio',
        caption,
        fileName,
        instance
      );

      if (!result.success) {
        console.error(`❌ [Groups] Failed to send ${mediaType} to group ${group.name}`);
        return res.status(500).json({ error: `Failed to send ${mediaType} to WhatsApp` });
      }

      // Save media message to database
      const chatId = `whatsapp_${group.groupId}`;
      let conversation = await storage.getConversationByChatId(chatId);

      // Create conversation if it doesn't exist
      if (!conversation) {
        const { createThread } = await import("./lib/openai");
        const { storeConversationThread } = await import("./lib/upstash");
        const { ASSISTANT_IDS, ASSISTANT_TO_DEPARTMENT } = await import("./lib/openai");
        
        const threadId = await createThread();
        await storeConversationThread(chatId, threadId);

        conversation = await storage.createConversation({
          chatId,
          clientName: group.name,
          clientId: group.groupId,
          threadId,
          assistantType: "apresentacao",
          department: ASSISTANT_TO_DEPARTMENT["apresentacao"] || "general",
          status: "active",
          sentiment: "neutral",
          urgency: "normal",
          duration: 0,
          lastMessage: caption || `[${mediaType}]`,
          evolutionInstance: instance,
          metadata: { 
            source: 'supervisor_group_media',
            groupId: group.id,
          },
        });
      }

      // Save the media message
      const messageContent = caption || `[${mediaType.toUpperCase()}]`;
      const messageRecord = await storage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: messageContent,
        sendBy: 'supervisor',
        assistant: 'supervisor',
        imageBase64: mediaType === 'image' ? mediaBase64 : undefined,
        pdfBase64: mediaType === 'document' ? mediaBase64 : undefined,
        pdfName: mediaType === 'document' ? (fileName || 'document.pdf') : undefined,
        audioBase64: mediaType === 'audio' ? mediaBase64 : undefined,
      });

      // Update conversation last message
      await storage.updateConversation(conversation.id, {
        lastMessage: messageContent,
        lastMessageTime: new Date(),
      });

      // Update group last message
      await storage.updateGroup(group.id, {
        lastMessage: messageContent.substring(0, 100),
        lastMessageTime: new Date(),
      });

      console.log(`✅ [Groups] ${mediaType} sent successfully to group ${group.name}`);
      return res.json({ 
        success: true, 
        message: messageRecord,
        mediaType,
      });
    } catch (error) {
      console.error("❌ [Groups] Error sending media:", error);
      return res.status(500).json({ error: "Error sending media to group" });
    }
  });

  // AI suggest response for group based on context
  app.post("/api/groups/:id/suggest-response", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { supervisorName } = req.body;

      const group = await storage.getGroup(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Build chatId for the group
      const chatId = `whatsapp_${group.groupId}`;

      // Find conversation for this group
      const conversation = await storage.getConversationByChatId(chatId);

      if (!conversation) {
        return res.status(400).json({ error: "Não há mensagens neste grupo para gerar sugestão" });
      }

      const messages = await storage.getMessagesByConversationId(conversation.id);
      
      if (!messages || messages.length === 0) {
        return res.status(400).json({ error: "Não há mensagens neste grupo para gerar sugestão" });
      }

      // Preparar contexto da conversa
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Pegar a última mensagem (independente do role) como contexto principal
      const lastMessage = messages[messages.length - 1];
      const lastMessageContext = `${lastMessage.role === 'user' ? 'Cliente' : 'Assistente'}: ${lastMessage.content}`;

      // Usar OpenAI para sugerir resposta baseada no contexto
      const suggestionPrompt = `Você é um assistente experiente da TR Telecom. 
      
Analise o histórico da conversa do grupo WhatsApp abaixo e sugira a melhor resposta para dar continuidade ao atendimento.

Histórico da conversa:
${conversationHistory.map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`).join('\n')}

Baseado no contexto completo da conversa, sugira uma resposta profissional, empática e que ajude o cliente. 
A resposta deve:
- Ser direta e objetiva
- Manter tom profissional e empático
- Oferecer solução clara ou dar continuidade ao atendimento
- Se necessário, pedir informações adicionais para melhor ajudar`;

      const { openai } = await import("./lib/openai");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: suggestionPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const suggestedResponse = completion.choices[0]?.message?.content || "Não foi possível gerar uma sugestão";
      
      // Gerar um ID único para esta sugestão (para tracking)
      const suggestionId = `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`✅ [Groups] Generated AI suggestion for group ${group.name} by ${supervisorName || 'unknown'}`);

      return res.json({
        suggestedResponse,
        suggestionId,
        context: lastMessageContext,
        supervisorName: supervisorName || req.user?.fullName,
      });
    } catch (error) {
      console.error("❌ [Groups] Error generating AI suggestion:", error);
      return res.status(500).json({ error: "Error generating AI suggestion" });
    }
  });

  // ==================== VENDAS/COMERCIAL ROUTES ====================
  
  // GET /api/plans - Retorna todos os planos ativos (público)
  app.get("/api/plans", async (req, res) => {
    try {
      const plans = await storage.getActivePlans();
      
      // Formatar planos para exibição
      const plansFormatted = plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        type: plan.type,
        downloadSpeed: plan.downloadSpeed,
        uploadSpeed: plan.uploadSpeed,
        price: plan.price / 100, // Converter centavos para reais
        description: plan.description,
        features: plan.features,
        isActive: plan.isActive
      }));
      
      return res.json(plansFormatted);
    } catch (error) {
      console.error("❌ [Plans] Error fetching plans:", error);
      return res.status(500).json({ error: "Erro ao buscar planos" });
    }
  });

  // GET /api/plans/all - Retorna TODOS os planos (ativos e inativos) - ADMIN/SUPERVISOR
  app.get("/api/plans/all", authenticate, requireSalesAccess, async (req, res) => {
    try {
      const plans = await storage.getAllPlans();
      
      // Formatar planos
      const plansFormatted = plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        type: plan.type,
        downloadSpeed: plan.downloadSpeed,
        uploadSpeed: plan.uploadSpeed,
        price: plan.price / 100,
        description: plan.description,
        features: plan.features,
        isActive: plan.isActive,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      }));
      
      return res.json(plansFormatted);
    } catch (error) {
      console.error("❌ [Plans] Error fetching all plans:", error);
      return res.status(500).json({ error: "Erro ao buscar planos" });
    }
  });

  // GET /api/plans/:id - Retorna um plano específico - ADMIN/SUPERVISOR
  app.get("/api/plans/:id", authenticate, requireSalesAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const plan = await storage.getPlan(id);
      
      if (!plan) {
        return res.status(404).json({ error: "Plano não encontrado" });
      }
      
      return res.json({
        ...plan,
        price: plan.price / 100
      });
    } catch (error) {
      console.error("❌ [Plans] Error fetching plan:", error);
      return res.status(500).json({ error: "Erro ao buscar plano" });
    }
  });

  // POST /api/plans - Cria um novo plano - ADMIN/SUPERVISOR
  app.post("/api/plans", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const planData = insertPlanSchema.parse({
        id: req.body.id,
        name: req.body.name,
        type: req.body.type,
        downloadSpeed: parseInt(req.body.downloadSpeed) || 0,
        uploadSpeed: parseInt(req.body.uploadSpeed) || 0,
        price: Math.round(parseFloat(req.body.price) * 100), // Converter reais para centavos
        description: req.body.description,
        features: req.body.features || [],
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
      });

      const plan = await storage.addPlan(planData);
      
      console.log(`✅ [Plans] Novo plano criado - ID: ${plan.id}, Nome: ${plan.name}`);
      
      return res.status(201).json({
        ...plan,
        price: plan.price / 100
      });
    } catch (error) {
      console.error("❌ [Plans] Error creating plan:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.errors
        });
      }
      
      return res.status(500).json({ error: "Erro ao criar plano" });
    }
  });

  // PUT /api/plans/:id - Atualiza um plano - ADMIN/SUPERVISOR
  app.put("/api/plans/:id", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar se o plano existe
      const existingPlan = await storage.getPlan(id);
      if (!existingPlan) {
        return res.status(404).json({ error: "Plano não encontrado" });
      }

      const updates = updatePlanSchema.parse({
        name: req.body.name,
        type: req.body.type,
        downloadSpeed: req.body.downloadSpeed !== undefined ? parseInt(req.body.downloadSpeed) : undefined,
        uploadSpeed: req.body.uploadSpeed !== undefined ? parseInt(req.body.uploadSpeed) : undefined,
        price: req.body.price !== undefined ? Math.round(parseFloat(req.body.price) * 100) : undefined,
        description: req.body.description,
        features: req.body.features,
        isActive: req.body.isActive
      });

      const updated = await storage.updatePlan(id, updates);
      
      console.log(`✅ [Plans] Plano atualizado - ID: ${id}`);
      
      return res.json({
        ...updated,
        price: updated.price / 100
      });
    } catch (error) {
      console.error("❌ [Plans] Error updating plan:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.errors
        });
      }
      
      return res.status(500).json({ error: "Erro ao atualizar plano" });
    }
  });

  // POST /api/plans/:id/toggle-status - Ativa/desativa um plano - ADMIN/SUPERVISOR
  app.post("/api/plans/:id/toggle-status", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.togglePlanStatus(id);
      
      console.log(`✅ [Plans] Status do plano alterado - ID: ${id}, Ativo: ${updated.isActive}`);
      
      return res.json({
        ...updated,
        price: updated.price / 100
      });
    } catch (error) {
      console.error("❌ [Plans] Error toggling plan status:", error);
      return res.status(500).json({ error: "Erro ao alterar status do plano" });
    }
  });

  // GET /api/sales - Retorna todas as vendas/leads
  app.get("/api/sales", authenticate, requireSalesAccess, async (req, res) => {
    try {
      const sales = await storage.getAllSales();
      
      // Buscar planos para enriquecer dados
      const plans = await storage.getActivePlans();
      const plansMap = new Map(plans.map((p: any) => [p.id, p]));
      
      // Formatar vendas com dados do plano
      const salesFormatted = sales.map((sale: any) => {
        const plan = plansMap.get(sale.planId);
        return {
          id: sale.id,
          customerName: sale.customerName,
          phone: sale.phone,
          email: sale.email,
          cpfCnpj: sale.cpfCnpj,
          type: sale.type,
          status: sale.status,
          source: sale.source,
          plan: plan ? {
            id: plan.id,
            name: plan.name,
            type: plan.type,
            price: plan.price / 100
          } : null,
          city: sale.city,
          state: sale.state,
          observations: sale.observations,
          notes: sale.notes,
          conversationId: sale.conversationId,
          createdAt: sale.createdAt,
          updatedAt: sale.updatedAt
        };
      });
      
      return res.json(salesFormatted);
    } catch (error) {
      console.error("❌ [Sales] Error fetching sales:", error);
      return res.status(500).json({ error: "Erro ao buscar vendas" });
    }
  });

  // PATCH /api/sales/:id/status - Atualiza status de uma venda
  app.patch("/api/sales/:id/status", authenticate, requireSalesAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, observations } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status é obrigatório" });
      }

      const updated = await storage.updateSaleStatus(id, status, observations);

      console.log(`✅ [Sales] Status atualizado - ID: ${id}, Status: ${status}`);

      return res.json(updated);
    } catch (error) {
      console.error("❌ [Sales] Error updating sale status:", error);
      return res.status(500).json({ error: "Erro ao atualizar status da venda" });
    }
  });

  // PATCH /api/sales/:id/notes - Atualiza notas de uma venda
  app.patch("/api/sales/:id/notes", authenticate, requireSalesAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const updated = await storage.updateSaleNotes(id, notes || "");

      console.log(`✅ [Sales] Notas atualizadas - ID: ${id}`);

      return res.json(updated);
    } catch (error) {
      console.error("❌ [Sales] Error updating sale notes:", error);
      return res.status(500).json({ error: "Erro ao atualizar notas da venda" });
    }
  });

  // POST /api/site-lead - Recebe cadastro de venda do site ou chat
  app.post("/api/site-lead", async (req, res) => {
    try {
      // Validar dados com Zod
      const saleData = insertSaleSchema.parse({
        type: req.body.type,
        customerName: req.body.customerName,
        cpfCnpj: req.body.cpfCnpj,
        email: req.body.email,
        phone: req.body.phone,
        phone2: req.body.phone2,
        motherName: req.body.motherName,
        birthDate: req.body.birthDate,
        rg: req.body.rg,
        sex: req.body.sex,
        address: req.body.address,
        planId: req.body.planId,
        billingDay: req.body.billingDay,
        paymentMethod: req.body.paymentMethod,
        observations: req.body.observations,
        source: req.body.source || "site",
        status: "Aguardando Análise",
        conversationId: req.body.conversationId
      });

      // Salvar no banco
      const sale = await storage.addSale(saleData);

      console.log(`✅ [Sales] Nova venda registrada - ID: ${sale.id}, Cliente: ${saleData.customerName}`);

      return res.status(201).json({
        success: true,
        saleId: sale.id,
        message: "Cadastro registrado com sucesso! Nossa equipe entrará em contato em breve."
      });
    } catch (error) {
      console.error("❌ [Sales] Error creating sale:", error);
      
      // Tratamento de erro do Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.errors
        });
      }
      
      return res.status(500).json({ error: "Erro ao processar cadastro de venda" });
    }
  });

  // ==================== MASSIVE FAILURES MODULE ====================

  // GET /api/failures - Listar todas as falhas
  app.get("/api/failures", authenticate, async (req, res) => {
    try {
      const failures = await storage.getAllMassiveFailures();
      return res.json(failures);
    } catch (error) {
      console.error("❌ [Failures] Error fetching failures:", error);
      return res.status(500).json({ error: "Erro ao buscar falhas" });
    }
  });

  // GET /api/failures/active - Listar falhas ativas
  app.get("/api/failures/active", authenticate, async (req, res) => {
    try {
      const failures = await storage.getActiveMassiveFailures();
      return res.json(failures);
    } catch (error) {
      console.error("❌ [Failures] Error fetching active failures:", error);
      return res.status(500).json({ error: "Erro ao buscar falhas ativas" });
    }
  });

  // GET /api/failures/scheduled - Listar falhas agendadas
  app.get("/api/failures/scheduled", authenticate, async (req, res) => {
    try {
      const failures = await storage.getScheduledMassiveFailures();
      return res.json(failures);
    } catch (error) {
      console.error("❌ [Failures] Error fetching scheduled failures:", error);
      return res.status(500).json({ error: "Erro ao buscar falhas agendadas" });
    }
  });

  // GET /api/failures/:id - Obter uma falha específica
  app.get("/api/failures/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const failure = await storage.getMassiveFailure(id);
      
      if (!failure) {
        return res.status(404).json({ error: "Falha não encontrada" });
      }

      return res.json(failure);
    } catch (error) {
      console.error("❌ [Failures] Error fetching failure:", error);
      return res.status(500).json({ error: "Erro ao buscar falha" });
    }
  });

  // POST /api/failures - Criar nova falha
  app.post("/api/failures", authenticate, async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      // Converter timestamps de string para Date
      const failureData = {
        ...req.body,
        createdBy: userId,
        startTime: req.body.startTime ? new Date(req.body.startTime) : new Date(),
        resolutionTime: req.body.resolutionTime ? new Date(req.body.resolutionTime) : null,
      };

      const failure = await storage.addMassiveFailure(failureData);

      console.log(`✅ [Failures] Nova falha criada - ID: ${failure.id}, Nome: ${failure.name}, Status: ${failure.status}`);

      return res.status(201).json(failure);
    } catch (error) {
      console.error("❌ [Failures] Error creating failure:", error);
      return res.status(500).json({ error: "Erro ao criar falha" });
    }
  });

  // PATCH /api/failures/:id - Atualizar falha
  app.patch("/api/failures/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Converter timestamps de string para Date
      const updates = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
        estimatedResolution: req.body.estimatedResolution ? new Date(req.body.estimatedResolution) : undefined,
        updatedAt: new Date(), // Sempre atualizar timestamp de modificação
      };

      const failure = await storage.updateMassiveFailure(id, updates);

      console.log(`✅ [Failures] Falha atualizada - ID: ${id}`);

      return res.json(failure);
    } catch (error) {
      console.error("❌ [Failures] Error updating failure:", error);
      return res.status(500).json({ error: "Erro ao atualizar falha" });
    }
  });

  // PATCH /api/failures/:id/status - Atualizar status
  app.patch("/api/failures/:id/status", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status é obrigatório" });
      }

      const failure = await storage.updateMassiveFailureStatus(id, status);

      console.log(`✅ [Failures] Status atualizado - ID: ${id}, Status: ${status}`);

      return res.json(failure);
    } catch (error) {
      console.error("❌ [Failures] Error updating failure status:", error);
      return res.status(500).json({ error: "Erro ao atualizar status da falha" });
    }
  });

  // POST /api/failures/:id/resolve - Resolver falha (com mensagem opcional)
  app.post("/api/failures/:id/resolve", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { resolutionMessage } = req.body;

      const failure = await storage.resolveMassiveFailure(id, resolutionMessage);

      console.log(`✅ [Failures] Falha resolvida - ID: ${id}`);

      // 🚀 NOTIFICAR CLIENTES EM BACKGROUND (não bloquear resposta HTTP)
      setImmediate(async () => {
        try {
          // Buscar todas as notificações de 'failure' (clientes que foram notificados sobre a falha)
          const notifications = await storage.getFailureNotificationsByFailureId(id);
          const failureNotifications = notifications.filter((n: any) => n.notificationType === 'failure');
          
          if (failureNotifications.length > 0) {
            console.log(`📢 [Failures] Enviando notificação de resolução para ${failureNotifications.length} cliente(s)...`);
            
            // Preparar mensagem de resolução
            const messageText = resolutionMessage || failure.resolutionMessage || 
              `✅ *Boa notícia!* A falha massiva foi normalizada. Seu serviço já está funcionando normalmente. 🎉`;
            
            // Enviar mensagem para cada cliente (em paralelo)
            const sendPromises = failureNotifications.map(async (notification: any) => {
              try {
                // Buscar conversa para pegar a instância Evolution
                const conversation = notification.conversationId 
                  ? await storage.getConversation(notification.conversationId)
                  : null;
                
                const evolutionInstance = conversation?.evolutionInstance || 'Leads';
                
                // Enviar mensagem via WhatsApp
                await sendWhatsAppMessage(notification.clientPhone, messageText, evolutionInstance);
                
                // Registrar notificação de resolução
                await storage.addFailureNotification({
                  failureId: id,
                  contactId: notification.contactId,
                  conversationId: notification.conversationId,
                  clientPhone: notification.clientPhone,
                  notificationType: 'resolution' as const,
                  messageSent: messageText
                });
                
                console.log(`✅ [Failures] Notificação de resolução enviada para ${notification.clientPhone}`);
                return { success: true, phone: notification.clientPhone };
              } catch (error) {
                console.error(`❌ [Failures] Erro ao enviar notificação para ${notification.clientPhone}:`, error);
                return { success: false, phone: notification.clientPhone, error };
              }
            });
            
            const results = await Promise.allSettled(sendPromises);
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            
            console.log(`✅ [Failures] ${successful}/${failureNotifications.length} notificações de resolução enviadas com sucesso`);
          } else {
            console.log(`ℹ️ [Failures] Nenhum cliente para notificar sobre resolução`);
          }
        } catch (notificationError) {
          console.error(`⚠️ [Failures] Erro ao enviar notificações de resolução em background:`, notificationError);
        }
      });

      // Retornar imediatamente (notificações serão enviadas em background)
      return res.json(failure);
    } catch (error) {
      console.error("❌ [Failures] Error resolving failure:", error);
      return res.status(500).json({ error: "Erro ao resolver falha" });
    }
  });

  // DELETE /api/failures/:id - Deletar falha
  app.delete("/api/failures/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      await storage.deleteMassiveFailure(id);

      console.log(`✅ [Failures] Falha deletada - ID: ${id}`);

      return res.json({ success: true });
    } catch (error) {
      console.error("❌ [Failures] Error deleting failure:", error);
      return res.status(500).json({ error: "Erro ao deletar falha" });
    }
  });

  // GET /api/failures/:id/notifications - Obter notificações de uma falha
  app.get("/api/failures/:id/notifications", authenticate, async (req, res) => {
    try {
      const { id} = req.params;
      const notifications = await storage.getFailureNotificationsByFailureId(id);

      return res.json(notifications);
    } catch (error) {
      console.error("❌ [Failures] Error fetching notifications:", error);
      return res.status(500).json({ error: "Erro ao buscar notificações" });
    }
  });

  // ==================== ANNOUNCEMENTS ROUTES ====================

  // GET /api/announcements - Listar todos os anúncios
  app.get("/api/announcements", authenticate, async (req, res) => {
    try {
      const announcements = await storage.getAllAnnouncements();
      return res.json(announcements);
    } catch (error) {
      console.error("❌ [Announcements] Error fetching announcements:", error);
      return res.status(500).json({ error: "Erro ao buscar anúncios" });
    }
  });

  // GET /api/announcements/active - Listar apenas anúncios ativos
  app.get("/api/announcements/active", authenticate, async (req, res) => {
    try {
      const announcements = await storage.getActiveAnnouncements();
      return res.json(announcements);
    } catch (error) {
      console.error("❌ [Announcements] Error fetching active announcements:", error);
      return res.status(500).json({ error: "Erro ao buscar anúncios ativos" });
    }
  });

  // POST /api/announcements - Criar novo anúncio
  app.post("/api/announcements", authenticate, async (req, res) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const data = {
        ...req.body,
        createdBy: req.user.userId,
        startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      };

      const announcement = await storage.addAnnouncement(data);

      console.log(`✅ [Announcements] Novo anúncio criado - ID: ${announcement.id}, Título: ${announcement.title}`);

      return res.status(201).json(announcement);
    } catch (error) {
      console.error("❌ [Announcements] Error creating announcement:", error);
      return res.status(500).json({ error: "Erro ao criar anúncio" });
    }
  });

  // PATCH /api/announcements/:id - Atualizar anúncio
  app.patch("/api/announcements/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      const updates = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      };

      const announcement = await storage.updateAnnouncement(id, updates);

      console.log(`✅ [Announcements] Anúncio atualizado - ID: ${id}`);

      return res.json(announcement);
    } catch (error) {
      console.error("❌ [Announcements] Error updating announcement:", error);
      return res.status(500).json({ error: "Erro ao atualizar anúncio" });
    }
  });

  // DELETE /api/announcements/:id - Deletar anúncio
  app.delete("/api/announcements/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      await storage.deleteAnnouncement(id);

      console.log(`✅ [Announcements] Anúncio deletado - ID: ${id}`);

      return res.json({ success: true });
    } catch (error) {
      console.error("❌ [Announcements] Error deleting announcement:", error);
      return res.status(500).json({ error: "Erro ao deletar anúncio" });
    }
  });

  // GET /api/regions - Listar todas as regiões
  app.get("/api/regions", authenticate, async (req, res) => {
    try {
      const { state, city, neighborhood } = req.query;
      
      const filters: any = {};
      if (state) filters.state = String(state);
      if (city) filters.city = String(city);
      if (neighborhood) filters.neighborhood = String(neighborhood);

      const regions = await storage.getRegionsByFilters(filters);
      return res.json(regions);
    } catch (error) {
      console.error("❌ [Regions] Error fetching regions:", error);
      return res.status(500).json({ error: "Erro ao buscar regiões" });
    }
  });

  // POST /api/regions - Criar nova região
  app.post("/api/regions", authenticate, async (req, res) => {
    try {
      const { state, city, neighborhood } = req.body;

      if (!state || !city || !neighborhood) {
        return res.status(400).json({ error: "Estado, cidade e bairro são obrigatórios" });
      }

      const region = await storage.addRegion({ state, city, neighborhood });

      console.log(`✅ [Regions] Nova região criada - ${state}/${city}/${neighborhood}`);

      return res.status(201).json(region);
    } catch (error) {
      console.error("❌ [Regions] Error creating region:", error);
      return res.status(500).json({ error: "Erro ao criar região" });
    }
  });

  // GET /api/regions/cities - Listar todas as cidades com contagem de bairros
  app.get("/api/regions/cities", authenticate, async (req, res) => {
    try {
      const cities = await storage.getCities();
      return res.json(cities);
    } catch (error) {
      console.error("❌ [Regions] Error fetching cities:", error);
      return res.status(500).json({ error: "Erro ao buscar cidades" });
    }
  });

  // GET /api/regions/neighborhoods/:city/:state - Listar bairros de uma cidade
  app.get("/api/regions/neighborhoods/:city/:state", authenticate, async (req, res) => {
    try {
      const { city, state } = req.params;
      const neighborhoods = await storage.getNeighborhoodsByCity(city, state);
      return res.json(neighborhoods);
    } catch (error) {
      console.error("❌ [Regions] Error fetching neighborhoods:", error);
      return res.status(500).json({ error: "Erro ao buscar bairros" });
    }
  });

  // PATCH /api/regions/:id - Atualizar região
  app.patch("/api/regions/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { state, city, neighborhood } = req.body;

      const updates: any = {};
      if (state) updates.state = state;
      if (city) updates.city = city;
      if (neighborhood) updates.neighborhood = neighborhood;

      const updated = await storage.updateRegion(id, updates);

      console.log(`✅ [Regions] Região atualizada - ID: ${id}`);

      return res.json(updated);
    } catch (error) {
      console.error("❌ [Regions] Error updating region:", error);
      return res.status(500).json({ error: "Erro ao atualizar região" });
    }
  });

  // DELETE /api/regions/:id - Deletar região
  app.delete("/api/regions/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      await storage.deleteRegion(id);

      console.log(`✅ [Regions] Região deletada - ID: ${id}`);

      return res.json({ success: true });
    } catch (error) {
      console.error("❌ [Regions] Error deleting region:", error);
      return res.status(500).json({ error: "Erro ao deletar região" });
    }
  });

  // ===================================
  // PROMPT MANAGEMENT SYSTEM ENDPOINTS
  // ===================================

  // POST /api/prompts/initialize - Initialize prompt templates from OpenAI
  app.post("/api/prompts/initialize", authenticate, requireAdmin, async (req, res) => {
    try {
      const { ASSISTANT_IDS } = await import("./lib/openai");
      const assistantTypes = [
        "apresentacao",
        "comercial",
        "financeiro",
        "suporte",
        "ouvidoria",
        "cancelamento",
      ] as const;

      const initializedPrompts = [];

      for (const assistantType of assistantTypes) {
        const assistantId = ASSISTANT_IDS[assistantType];
        
        // Check if already exists
        const existing = await storage.getPromptTemplateByAssistantType(assistantType);
        if (existing) {
          console.log(`⏭️  [Prompts Init] Skipping ${assistantType} - already exists`);
          continue;
        }

        // Fetch current instructions from OpenAI
        const assistant = await openai.beta.assistants.retrieve(assistantId);
        const instructions = assistant.instructions || "";

        // Create template
        const template = await storage.createPromptTemplate({
          assistantType,
          assistantId,
          title: `Prompt do Assistente ${assistantType.charAt(0).toUpperCase() + assistantType.slice(1)}`,
          content: instructions,
          status: "active",
          version: "1.0.0",
          createdBy: req.user!.userId,
        });

        // Create initial version
        await storage.createPromptVersion({
          promptId: template.id,
          version: "1.0.0",
          content: instructions,
          createdBy: req.user!.userId,
          tokenCount: 0,
        });

        console.log(`✅ [Prompts Init] Created template for ${assistantType}`);
        initializedPrompts.push(template);
      }

      return res.json({
        success: true,
        initialized: initializedPrompts.length,
        templates: initializedPrompts,
      });
    } catch (error) {
      console.error("❌ [Prompts Init] Error initializing prompts:", error);
      return res.status(500).json({ error: "Erro ao inicializar prompts" });
    }
  });

  // GET /api/prompts - List all prompt templates
  app.get("/api/prompts", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const templates = await storage.getAllPromptTemplates();
      
      // Include draft status and pending evolutions count for each template
      const templatesWithDrafts = await Promise.all(
        templates.map(async (template) => {
          const draft = await storage.getPromptDraft(template.id);
          const pendingEvolutions = await storage.getPromptSuggestionsByAssistantType(template.assistantType, "pending");
          return {
            ...template,
            hasDraft: !!draft,
            draftLastEditedAt: draft?.lastEditedAt,
            draftLastEditedBy: draft?.lastEditedBy,
            pendingEvolutionsCount: pendingEvolutions.length,
          };
        })
      );

      return res.json(templatesWithDrafts);
    } catch (error) {
      console.error("❌ [Prompts] Error fetching prompt templates:", error);
      return res.status(500).json({ error: "Erro ao buscar prompts" });
    }
  });

  // GET /api/prompts/:assistantType - Get prompt by assistant type
  app.get("/api/prompts/:assistantType", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { assistantType } = req.params;
      
      const template = await storage.getPromptTemplateByAssistantType(assistantType);
      
      if (!template) {
        return res.status(404).json({ error: "Prompt não encontrado para este assistente" });
      }

      // Get draft if exists
      const draft = await storage.getPromptDraft(template.id);
      
      // Get version history
      const versions = await storage.getPromptVersionsByPromptId(template.id);

      // Get pending evolutions count
      const pendingEvolutions = await storage.getPromptSuggestionsByAssistantType(template.assistantType, "pending");

      return res.json({
        ...template,
        draft,
        versions,
        pendingEvolutionsCount: pendingEvolutions.length,
      });
    } catch (error) {
      console.error("❌ [Prompts] Error fetching prompt:", error);
      return res.status(500).json({ error: "Erro ao buscar prompt" });
    }
  });

  // POST /api/prompts/:id/draft - Create or update draft
  app.post("/api/prompts/:id/draft", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const { draftContent } = req.body;
      const userId = req.user!.userId;

      if (!draftContent) {
        return res.status(400).json({ error: "draftContent é obrigatório" });
      }

      // Check if template exists
      const template = await storage.getPromptTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Prompt template não encontrado" });
      }

      // Check if draft already exists
      const existingDraft = await storage.getPromptDraft(id);
      
      let draft;
      if (existingDraft) {
        // Update existing draft
        draft = await storage.updatePromptDraft(id, {
          draftContent,
          lastEditedBy: userId,
        });
      } else {
        // Create new draft
        draft = await storage.createPromptDraft({
          promptId: id,
          draftContent,
          lastEditedBy: userId,
          tokenCount: 0, // TODO: Calculate token count
        });
      }

      console.log(`✅ [Prompts] Draft ${existingDraft ? 'updated' : 'created'} for prompt ${id}`);
      
      return res.json(draft);
    } catch (error) {
      console.error("❌ [Prompts] Error saving draft:", error);
      return res.status(500).json({ error: "Erro ao salvar rascunho" });
    }
  });

  // POST /api/prompts/:id/ai-review - Request AI suggestions for draft
  app.post("/api/prompts/:id/ai-review", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const { context } = req.body; // Optional context from user (e.g., "Cliente reclama de promessas vazias")

      // Get template and draft
      const template = await storage.getPromptTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Prompt template não encontrado" });
      }

      const draft = await storage.getPromptDraft(id);
      if (!draft) {
        return res.status(404).json({ error: "Rascunho não encontrado. Crie um rascunho primeiro." });
      }

      console.log(`🤖 [Prompts] Starting AI analysis for ${template.assistantType}...`);

      // Call AI service to analyze and suggest improvements
      const { analyzePrompt } = await import("./lib/openai");
      const suggestions = await analyzePrompt(
        template.content,
        draft.draftContent,
        template.assistantType,
        context
      );

      // Update draft with AI suggestions
      const updatedDraft = await storage.updatePromptDraft(id, {
        aiSuggestions: suggestions,
      });

      console.log(`✅ [Prompts] AI review completed for ${template.assistantType} (score: ${suggestions.score}/100)`);
      
      return res.json({
        draft: updatedDraft,
        suggestions,
      });
    } catch (error) {
      console.error("❌ [Prompts] Error requesting AI review:", error);
      return res.status(500).json({ error: "Erro ao solicitar análise da IA" });
    }
  });

  // POST /api/prompts/:id/publish - Publish draft as new version and sync to OpenAI
  app.post("/api/prompts/:id/publish", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const { versionNotes, versionBump = "patch" } = req.body; // versionBump: 'major' | 'minor' | 'patch'
      const userId = req.user!.userId;

      // Get template and draft
      const template = await storage.getPromptTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Prompt template não encontrado" });
      }

      const draft = await storage.getPromptDraft(id);
      if (!draft) {
        return res.status(404).json({ error: "Nenhum rascunho para publicar" });
      }

      // Calculate new version number
      const currentVersion = template.version.split('.').map(Number);
      let newVersion: string;
      
      if (versionBump === 'major') {
        newVersion = `${currentVersion[0] + 1}.0.0`;
      } else if (versionBump === 'minor') {
        newVersion = `${currentVersion[0]}.${currentVersion[1] + 1}.0`;
      } else {
        newVersion = `${currentVersion[0]}.${currentVersion[1]}.${currentVersion[2] + 1}`;
      }

      // 1. Create version snapshot
      await storage.createPromptVersion({
        promptId: id,
        content: draft.draftContent,
        version: newVersion,
        versionNotes,
        tokenCount: draft.tokenCount,
        aiSuggestions: draft.aiSuggestions as any,
        createdBy: userId,
      });

      // 2. Update template with new content
      const updatedTemplate = await storage.updatePromptTemplate(id, {
        content: draft.draftContent,
        version: newVersion,
        tokenCount: draft.tokenCount,
        updatedBy: userId,
        lastSyncedAt: new Date(),
      });

      // 3. Sync to OpenAI Assistants API
      console.log(`🔄 [Prompts] Syncing ${template.assistantType} to OpenAI...`);
      let syncError: string | null = null;
      try {
        const { updateAssistantPrompt } = await import("./lib/openai");
        await updateAssistantPrompt(template.assistantType, draft.draftContent);
        console.log(`✅ [Prompts] Successfully synced ${template.assistantType} to OpenAI`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        syncError = errorMessage;
        console.error(`⚠️ [Prompts] Failed to sync to OpenAI (continuing anyway):`, error);
        // Don't fail the publish if OpenAI sync fails - the version is already created
        // Save error for UI display
        await storage.updatePromptTemplate(id, {
          lastSyncError: errorMessage,
        });
      }
      
      // If sync succeeded, clear any previous error
      if (!syncError) {
        await storage.updatePromptTemplate(id, {
          lastSyncError: null,
        });
      }

      // 4. Clear assistant cache to force reload
      const { assistantCache } = await import("./lib/redis-config");
      const cacheKey = `instructions:${template.assistantType}`;
      await assistantCache.delete(cacheKey);
      await assistantCache.invalidateByTag('assistant-config');

      // 5. Delete draft
      await storage.deletePromptDraft(id);

      console.log(`✅ [Prompts] Published version ${newVersion} for prompt ${id}`);
      
      return res.json({
        success: true,
        message: `Versão ${newVersion} publicada com sucesso`,
        template: updatedTemplate,
        version: newVersion,
      });
    } catch (error) {
      console.error("❌ [Prompts] Error publishing prompt:", error);
      return res.status(500).json({ error: "Erro ao publicar prompt" });
    }
  });

  // GET /api/prompts/:id/versions - Get version history
  app.get("/api/prompts/:id/versions", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      
      const versions = await storage.getPromptVersionsByPromptId(id);
      
      return res.json(versions);
    } catch (error) {
      console.error("❌ [Prompts] Error fetching versions:", error);
      return res.status(500).json({ error: "Erro ao buscar histórico de versões" });
    }
  });

  // POST /api/prompts/:id/restore/:versionId - Restore a previous version
  app.post("/api/prompts/:id/restore/:versionId", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id, versionId } = req.params;
      const userId = req.user!.userId;

      // Get the version to restore
      const version = await storage.getPromptVersion(versionId);
      if (!version || version.promptId !== id) {
        return res.status(404).json({ error: "Versão não encontrada" });
      }

      // Get current template
      const template = await storage.getPromptTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Prompt template não encontrado" });
      }

      // Create or update draft with version content
      const existingDraft = await storage.getPromptDraft(id);
      
      if (existingDraft) {
        await storage.updatePromptDraft(id, {
          draftContent: version.content,
          lastEditedBy: userId,
          aiSuggestions: version.aiSuggestions as any,
          tokenCount: version.tokenCount,
        });
      } else {
        await storage.createPromptDraft({
          promptId: id,
          draftContent: version.content,
          lastEditedBy: userId,
          aiSuggestions: version.aiSuggestions as any,
          tokenCount: version.tokenCount,
        });
      }

      console.log(`✅ [Prompts] Restored version ${version.version} to draft for prompt ${id}`);
      
      return res.json({
        success: true,
        message: `Versão ${version.version} restaurada como rascunho`,
        version,
      });
    } catch (error) {
      console.error("❌ [Prompts] Error restoring version:", error);
      return res.status(500).json({ error: "Erro ao restaurar versão" });
    }
  });

  // POST /api/prompts/:id/consolidate-evolutions - Consolidate pending evolution suggestions
  app.post("/api/prompts/:id/consolidate-evolutions", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      // Get template
      const template = await storage.getPromptTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Prompt template não encontrado" });
      }

      // Get pending evolution suggestions for this assistant type
      const pendingSuggestions = await storage.getPromptSuggestionsByAssistantType(
        template.assistantType,
        "pending"
      );

      if (!pendingSuggestions || pendingSuggestions.length === 0) {
        return res.status(400).json({ 
          error: "Nenhuma sugestão de evolução pendente encontrada para este assistente" 
        });
      }

      console.log(`🔄 [Consolidation] Starting for ${template.assistantType} with ${pendingSuggestions.length} suggestions`);

      // STEP 1: Deduplicate suggestions first
      const { deduplicateEvolutions } = await import("./lib/evolution-deduplicator");
      
      const mappedSuggestions = pendingSuggestions.map((s: any) => ({
        id: s.id,
        problemIdentified: s.problemIdentified,
        rootCauseAnalysis: s.rootCauseAnalysis,
        currentPrompt: s.currentPrompt,
        suggestedPrompt: s.suggestedPrompt,
        confidenceScore: s.confidenceScore,
      }));

      const deduplicationResult = await deduplicateEvolutions(mappedSuggestions);
      
      console.log(`🧹 [Deduplication] Results:`);
      console.log(`   - Original: ${deduplicationResult.statistics.total} evoluções`);
      console.log(`   - Únicas: ${deduplicationResult.statistics.unique} evoluções`);
      console.log(`   - Duplicadas: ${deduplicationResult.statistics.duplicates} (${deduplicationResult.statistics.duplicatePercentage}%)`);

      // STEP 2: Consolidate only unique suggestions
      const { consolidateEvolutionSuggestions } = await import("./lib/openai");
      const consolidationResult = await consolidateEvolutionSuggestions(
        template.content,
        deduplicationResult.uniqueSuggestions,
        template.assistantType
      );

      // STEP 3: Ensure summary exists (defense against incomplete OpenAI responses)
      if (!consolidationResult.summary) {
        console.warn("⚠️  [Consolidation] Summary missing from OpenAI response, creating default");
        consolidationResult.summary = {
          totalSuggestions: deduplicationResult.statistics.total,
          appliedCount: 0,
          duplicatesCount: deduplicationResult.statistics.duplicates,
          conflictsCount: 0,
        };
      }

      // STEP 4: Merge deduplication groups with consolidation result
      consolidationResult.duplicateGroups = [
        ...(consolidationResult.duplicateGroups || []),
        ...deduplicationResult.duplicateGroups,
      ];

      // STEP 5: Update statistics to reflect deduplication
      consolidationResult.summary.totalSuggestions = deduplicationResult.statistics.total;
      consolidationResult.summary.duplicatesCount = (consolidationResult.summary.duplicatesCount || 0) + deduplicationResult.statistics.duplicates;

      // Create or update draft with consolidated prompt
      const existingDraft = await storage.getPromptDraft(id);
      
      // Save pre-consolidation content for diff highlighting
      const preConsolidationContent = existingDraft?.draftContent || template.content;
      
      console.log(`📝 [Consolidation] Existing draft: ${existingDraft ? 'YES' : 'NO'}`);
      console.log(`📝 [Consolidation] Pre-consolidation length: ${preConsolidationContent.length}`);
      console.log(`📝 [Consolidation] New content length: ${consolidationResult.updatedPrompt.length}`);
      
      let draft;
      if (existingDraft) {
        draft = await storage.updatePromptDraft(id, {
          draftContent: consolidationResult.updatedPrompt,
          lastEditedBy: userId,
          preConsolidationContent, // Save content before consolidation
        });
        console.log(`📝 [Consolidation] Updated draft: ${draft.id}`);
      } else {
        draft = await storage.createPromptDraft({
          promptId: id,
          draftContent: consolidationResult.updatedPrompt,
          lastEditedBy: userId,
          tokenCount: 0,
          preConsolidationContent, // Save content before consolidation
        });
        console.log(`📝 [Consolidation] Created draft: ${draft.id}`);
      }

      console.log(`✅ [Consolidation] Created draft with ${consolidationResult.summary.appliedCount} suggestions applied`);
      
      // STEP 6: Mark ALL processed suggestions as "consolidated" immediately
      // This includes: applied, rejected/ignored, and duplicates
      // This prevents them from reappearing as "pending" in subsequent consolidations
      
      console.log(`🏷️  [Consolidation] Marking ALL ${pendingSuggestions.length} processed suggestions as consolidated...`);
      
      // Mark ALL pending suggestions that were processed as "consolidated"
      // This ensures the counter goes to zero, regardless of applied/rejected status
      for (const suggestion of pendingSuggestions) {
        await storage.updatePromptSuggestion(suggestion.id, {
          status: "consolidated",
        });
      }
      
      // Additionally, mark duplicate suggestions with linkage information
      const duplicateGroups = consolidationResult.duplicateGroups || [];
      if (duplicateGroups.length > 0) {
        console.log(`🔗 [Consolidation] Linking ${duplicateGroups.length} duplicate groups...`);
        
        for (const group of duplicateGroups) {
          for (const duplicateId of group.duplicateIds) {
            await storage.updatePromptSuggestion(duplicateId, {
              status: "consolidated",
              consolidatedWith: [group.mainSuggestionId, ...group.duplicateIds.filter((id: string) => id !== duplicateId)],
            });
          }
        }
      }
      
      console.log(`✅ [Consolidation] All ${pendingSuggestions.length} suggestions marked as consolidated (counter will now be zero)`);
      
      return res.json({
        draft,
        consolidation: consolidationResult,
      });
    } catch (error) {
      console.error("❌ [Consolidation] Error consolidating evolution suggestions:", error);
      return res.status(500).json({ error: "Erro ao consolidar sugestões de evolução" });
    }
  });

  // POST /api/prompts/:id/mark-evolutions-applied - Mark evolution suggestions as applied
  app.post("/api/prompts/:id/mark-evolutions-applied", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { id } = req.params;
      const { version, appliedSuggestionIds, duplicateGroups } = req.body;

      if (!version || !appliedSuggestionIds || !Array.isArray(appliedSuggestionIds)) {
        return res.status(400).json({ 
          error: "version e appliedSuggestionIds são obrigatórios" 
        });
      }

      const template = await storage.getPromptTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Prompt template não encontrado" });
      }

      // Mark applied suggestions
      for (const suggestionId of appliedSuggestionIds) {
        await storage.updatePromptSuggestion(suggestionId, {
          status: "applied",
          appliedInVersion: version,
        });
      }

      // Mark duplicate suggestions as consolidated
      if (duplicateGroups && Array.isArray(duplicateGroups)) {
        for (const group of duplicateGroups) {
          for (const duplicateId of group.duplicateIds) {
            await storage.updatePromptSuggestion(duplicateId, {
              status: "consolidated",
              consolidatedWith: [group.mainSuggestionId, ...group.duplicateIds.filter((id: string) => id !== duplicateId)],
              appliedInVersion: version,
            });
          }
        }
      }

      console.log(`✅ [Consolidation] Marked ${appliedSuggestionIds.length} suggestions as applied in version ${version}`);

      return res.json({
        success: true,
        message: `Sugestões marcadas como aplicadas na versão ${version}`,
      });
    } catch (error) {
      console.error("❌ [Consolidation] Error marking suggestions as applied:", error);
      return res.status(500).json({ error: "Erro ao marcar sugestões como aplicadas" });
    }
  });

  // GET /api/prompts/:assistantType/context-suggestions - Get Context Quality Monitor suggestions for specific assistant
  app.get("/api/prompts/:assistantType/context-suggestions", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { assistantType } = req.params;
      const { hours = 168 } = req.query; // Default: last 7 days (168 hours)

      console.log(`📊 [Context Suggestions] Fetching alerts for assistant: ${assistantType} (last ${hours}h)`);

      // Get recent alerts filtered by assistant type
      const allAlerts = await storage.getRecentContextQualityAlerts(Number(hours));
      const assistantAlerts = allAlerts.filter(alert => alert.assistantType === assistantType);

      console.log(`📊 [Context Suggestions] Found ${assistantAlerts.length} alerts for ${assistantType}`);

      // Group alerts by type
      const alertsByType: Record<string, typeof assistantAlerts> = {};
      assistantAlerts.forEach(alert => {
        if (!alertsByType[alert.alertType]) {
          alertsByType[alert.alertType] = [];
        }
        alertsByType[alert.alertType].push(alert);
      });

      // Generate suggestions for each alert type using the prompt-suggestions library
      const { generatePromptSuggestions } = await import("./lib/prompt-suggestions");
      const template = await storage.getPromptTemplateByAssistantType(assistantType);
      
      const suggestions = await Promise.all(
        Object.entries(alertsByType).map(async ([alertType, alerts]) => {
          const suggestion = await generatePromptSuggestions(
            alerts.map(a => ({
              alertType: a.alertType,
              severity: a.severity,
              description: a.description,
              conversationId: a.conversationId || '',
              metadata: a.metadata || {},
            })),
            assistantType,
            template?.content
          );
          
          return {
            ...suggestion,
            alertType,
            count: alerts.length,
            recentAlerts: alerts.slice(0, 5).map(a => ({
              id: a.id,
              description: a.description,
              severity: a.severity,
              detectedAt: a.detectedAt,
              conversationId: a.conversationId,
            })),
          };
        })
      );

      // Sort by priority (high > medium > low) and count
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      suggestions.sort((a, b) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.count - a.count;
      });

      return res.json({
        assistantType,
        totalAlerts: assistantAlerts.length,
        suggestions,
        period: `${hours}h`,
      });
    } catch (error) {
      console.error("❌ [Context Suggestions] Error fetching suggestions:", error);
      return res.status(500).json({ error: "Erro ao buscar sugestões de contexto" });
    }
  });

  // POST /api/prompts/:assistantType/consolidate-context-suggestions - Consolidate context suggestions intelligently
  app.post("/api/prompts/:assistantType/consolidate-context-suggestions", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { assistantType } = req.params;
      const userId = req.user!.userId;
      const { hours = 168 } = req.body; // Default: last 7 days

      console.log(`🔄 [Context Consolidation] Starting for ${assistantType}`);

      // Get template
      const template = await storage.getPromptTemplateByAssistantType(assistantType);
      if (!template) {
        return res.status(404).json({ error: "Prompt template não encontrado" });
      }

      // Get context suggestions
      const allAlerts = await storage.getRecentContextQualityAlerts(Number(hours));
      const assistantAlerts = allAlerts.filter(alert => alert.assistantType === assistantType);

      if (assistantAlerts.length === 0) {
        return res.status(400).json({ 
          error: "Nenhuma sugestão de contexto encontrada para consolidar" 
        });
      }

      // Group alerts by type and generate suggestions
      const alertsByType: Record<string, typeof assistantAlerts> = {};
      assistantAlerts.forEach(alert => {
        if (!alertsByType[alert.alertType]) {
          alertsByType[alert.alertType] = [];
        }
        alertsByType[alert.alertType].push(alert);
      });

      const { generatePromptSuggestions } = await import("./lib/prompt-suggestions");
      const suggestions = await Promise.all(
        Object.entries(alertsByType).map(async ([alertType, alerts]) => {
          const suggestion = await generatePromptSuggestions(
            alerts.map(a => ({
              alertType: a.alertType,
              severity: a.severity,
              description: a.description,
              conversationId: a.conversationId || '',
              metadata: a.metadata || {},
            })),
            assistantType,
            template?.content
          );
          
          return {
            problemSummary: suggestion.problemSummary,
            rootCause: suggestion.rootCause,
            suggestedFix: suggestion.suggestedFix,
            priority: suggestion.priority,
            count: alerts.length,
          };
        })
      );

      console.log(`🔄 [Context Consolidation] Generated ${suggestions.length} suggestions for ${assistantType}`);

      // Call consolidation service
      const { consolidateContextSuggestions } = await import("./lib/openai");
      const consolidationResult = await consolidateContextSuggestions(
        template.content,
        suggestions,
        assistantType
      );

      // Create or update draft with consolidated prompt
      const existingDraft = await storage.getPromptDraft(template.id);
      
      // Save current content as preConsolidationContent for diff highlighting
      const currentContent = existingDraft?.draftContent || template.content;
      
      let draft;
      if (existingDraft) {
        draft = await storage.updatePromptDraft(template.id, {
          draftContent: consolidationResult.updatedPrompt,
          preConsolidationContent: currentContent,
          lastEditedBy: userId,
        });
      } else {
        draft = await storage.createPromptDraft({
          promptId: template.id,
          draftContent: consolidationResult.updatedPrompt,
          preConsolidationContent: currentContent,
          lastEditedBy: userId,
        });
      }

      console.log(`✅ [Context Consolidation] Draft updated for ${assistantType}`);

      // Mark all alerts as resolved
      const timeAgo = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);
      await storage.markContextQualityAlertsAsResolved(assistantType, timeAgo);

      console.log(`✅ [Context Consolidation] Alerts marked as resolved for ${assistantType}`);

      return res.json({
        success: true,
        summary: consolidationResult.summary,
        draftId: draft.id,
        message: `${suggestions.length} sugestões de contexto consolidadas com sucesso no rascunho`,
      });
    } catch (error) {
      console.error("❌ [Context Consolidation] Error:", error);
      return res.status(500).json({ error: "Erro ao consolidar sugestões de contexto" });
    }
  });

  // ===================================
  // GAMIFICATION ROUTES
  // ===================================

  /**
   * GET /api/gamification/ranking
   * Retorna o ranking de gamificação do período
   * Query params: period (opcional, formato YYYY-MM, default: mês atual)
   */
  app.get("/api/gamification/ranking", authenticate, async (req, res) => {
    try {
      const { period } = req.query;
      
      console.log(`🎮 [Gamification] Fetching ranking for period: ${period || 'current month'}`);
      
      const ranking = await storage.getGamificationRanking(period as string | undefined);
      
      return res.json(ranking);
    } catch (error) {
      console.error("❌ [Gamification] Error fetching ranking:", error);
      return res.status(500).json({ error: "Erro ao buscar ranking de gamificação" });
    }
  });

  /**
   * POST /api/gamification/calculate
   * Calcula pontuações e badges para um período
   * Body: { period: "YYYY-MM" }
   * Requer permissão ADMIN ou SUPERVISOR
   */
  app.post("/api/gamification/calculate", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      const { period } = req.body;
      
      if (!period || !/^\d{4}-\d{2}$/.test(period)) {
        return res.status(400).json({ error: "Período inválido. Use formato YYYY-MM" });
      }
      
      console.log(`🎮 [Gamification] Calculating scores and badges for period: ${period}`);
      
      // Calcula pontuações
      await storage.calculateGamificationScores(period);
      
      // Atribui badges
      await storage.awardBadges(period);
      
      // Salva histórico Top 5
      await storage.saveTop5History(period);
      
      console.log(`✅ [Gamification] Calculation completed for period: ${period}`);
      
      return res.json({ 
        success: true, 
        message: `Gamificação calculada com sucesso para ${period}` 
      });
    } catch (error) {
      console.error("❌ [Gamification] Error calculating gamification:", error);
      return res.status(500).json({ error: "Erro ao calcular gamificação" });
    }
  });

  /**
   * GET /api/gamification/stats
   * Retorna estatísticas gerais de gamificação
   * Query params: period (opcional, formato YYYY-MM, default: mês atual)
   */
  app.get("/api/gamification/stats", authenticate, async (req, res) => {
    try {
      const { period } = req.query;
      
      console.log(`🎮 [Gamification] Fetching stats for period: ${period || 'current month'}`);
      
      const stats = await storage.getGamificationStats(period as string | undefined);
      
      return res.json(stats);
    } catch (error) {
      console.error("❌ [Gamification] Error fetching stats:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas de gamificação" });
    }
  });

  /**
   * GET /api/gamification/agent/:agentId
   * Retorna o histórico de gamificação de um agente específico
   * Query params: limit (opcional, default: 12 meses)
   */
  app.get("/api/gamification/agent/:agentId", authenticate, async (req, res) => {
    try {
      const { agentId } = req.params;
      const { limit = 12 } = req.query;
      
      console.log(`🎮 [Gamification] Fetching history for agent: ${agentId} (limit: ${limit})`);
      
      const history = await storage.getAgentGamificationHistory(agentId, Number(limit));
      
      return res.json(history);
    } catch (error) {
      console.error("❌ [Gamification] Error fetching agent history:", error);
      return res.status(500).json({ error: "Erro ao buscar histórico do agente" });
    }
  });

  /**
   * GET /api/gamification/settings
   * Retorna as configurações globais de gamificação
   * Acessível para todos usuários autenticados
   */
  app.get("/api/gamification/settings", authenticate, async (req, res) => {
    try {
      console.log(`⚙️ [Gamification Settings] Fetching settings`);
      
      const settings = await storage.getGamificationSettings();
      
      return res.json(settings);
    } catch (error) {
      console.error("❌ [Gamification Settings] Error fetching settings:", error);
      return res.status(500).json({ error: "Erro ao buscar configurações de gamificação" });
    }
  });

  /**
   * PUT /api/gamification/settings
   * Atualiza as configurações globais de gamificação
   * Requer: ADMIN ou SUPERVISOR
   */
  app.put("/api/gamification/settings", authenticate, requireAdminOrSupervisor, async (req, res) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      console.log(`⚙️ [Gamification Settings] Updating settings by user: ${req.user.userId}`);
      
      // Valida os dados com Zod schema
      const validationResult = updateGamificationSettingsSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.error("❌ [Gamification Settings] Validation error:", validationResult.error.errors);
        return res.status(400).json({ 
          error: "Dados inválidos",
          details: validationResult.error.errors
        });
      }
      
      const updatedSettings = await storage.updateGamificationSettings(
        validationResult.data,
        req.user.userId
      );
      
      console.log(`✅ [Gamification Settings] Settings updated successfully`);
      
      return res.json(updatedSettings);
    } catch (error) {
      console.error("❌ [Gamification Settings] Error updating settings:", error);
      return res.status(500).json({ error: "Erro ao atualizar configurações de gamificação" });
    }
  });

  // ============================================================================
  // COBRANÇAS - Módulo de Cobrança Ativa por Telefone
  // ============================================================================
  const voiceRouter = await import('./modules/voice/router');
  app.use('/api/voice', voiceRouter.default);
  console.log('📞 [COBRANÇAS] Rotas do módulo voice registradas em /api/voice');
  
  // Admin routes para gerenciar targets de cobrança com erro
  const cobrancaAdminRouter = await import('./modules/voice/cobranca-admin-router');
  app.use('/api/admin/cobranca', cobrancaAdminRouter.default);
  console.log('⚙️  [COBRANÇAS ADMIN] Rotas administrativas registradas em /api/admin/cobranca');

  // ============================================================================
  // TESTE DE TIMEZONE - Endpoint temporário para verificar configuração
  // ============================================================================
  app.get("/api/test/timezone", async (req, res) => {
    try {
      const now = new Date();
      const hours = now.getHours();
      const day = now.getDay();
      
      // Função de verificação de horário comercial
      const isWithinBusinessHours = () => {
        if (day === 0 || day === 6) return false;
        return hours >= 8 && hours < 20;
      };
      
      // Nomes dos dias da semana
      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      
      const response = {
        success: true,
        timezone: {
          configured: process.env.TZ || 'Not set',
          current: now.toString(),
          utc: now.toUTCString(),
          iso: now.toISOString(),
          timestamp: now.getTime(),
        },
        brasilia: {
          date: now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          time: now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          hour: hours,
          dayOfWeek: day,
          dayName: dayNames[day],
        },
        businessHours: {
          isBusinessDay: day !== 0 && day !== 6,
          isBusinessHour: hours >= 8 && hours < 20,
          isWithinBusinessHours: isWithinBusinessHours(),
          schedule: 'Segunda a Sexta, 8h às 20h',
        },
        server: {
          nodeVersion: process.version,
          platform: process.platform,
        }
      };
      
      console.log('🕐 [Timezone Test] Response:', JSON.stringify(response, null, 2));
      
      return res.json(response);
    } catch (error) {
      console.error("❌ [Timezone Test] Error:", error);
      return res.status(500).json({ error: "Erro ao verificar timezone" });
    }
  });

  return httpServer;
}
