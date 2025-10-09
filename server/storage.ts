import { 
  type User, 
  type InsertUser,
  type UpdateUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Alert,
  type InsertAlert,
  type SupervisorAction,
  type InsertSupervisorAction,
  type LearningEvent,
  type InsertLearningEvent,
  type PromptSuggestion,
  type InsertPromptSuggestion,
  type PromptUpdate,
  type InsertPromptUpdate,
  type SatisfactionFeedback,
  type InsertSatisfactionFeedback,
  type SuggestedResponse,
  type InsertSuggestedResponse,
  type RegistrationRequest,
  type InsertRegistrationRequest,
  type MessageTemplate,
  type InsertMessageTemplate,
  type UpdateMessageTemplate,
  type ActivityLog,
  type InsertActivityLog
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User>;
  updateUserLastLogin(id: string): Promise<void>;
  updateUserStatus(id: string, status: string): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
  // Conversations
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByChatId(chatId: string): Promise<Conversation | undefined>;
  getAllActiveConversations(): Promise<Conversation[]>;
  getMonitorConversations(): Promise<Conversation[]>; // Ativas + Resolvidas (24h)
  getAllConversations(): Promise<Conversation[]>;
  getTransferredConversations(userId?: string, role?: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(chatId: string): Promise<void>;
  
  // Messages
  getMessagesByConversationId(conversationId: string): Promise<Message[]>;
  getRecentMessagesByConversationId(conversationId: string, limit: number): Promise<Message[]>;
  getMessagesPaginated(conversationId: string, options: { limit?: number; before?: string }): Promise<{ messages: Message[]; hasMore: boolean }>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Alerts
  getActiveAlerts(): Promise<Alert[]>;
  getAlertsByConversationId(conversationId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  resolveAlert(id: string): Promise<void>;
  
  // Supervisor Actions
  createSupervisorAction(action: InsertSupervisorAction): Promise<SupervisorAction>;
  getActionsByConversationId(conversationId: string): Promise<SupervisorAction[]>;
  getAllSupervisorActions(): Promise<SupervisorAction[]>;
  
  // Learning Events
  createLearningEvent(event: InsertLearningEvent): Promise<LearningEvent>;
  getLearningEventsByConversationId(conversationId: string): Promise<LearningEvent[]>;
  getLearningEventsByAssistantType(assistantType: string): Promise<LearningEvent[]>;
  getRecentLearningEvents(limit?: number): Promise<LearningEvent[]>;
  
  // Prompt Suggestions
  createPromptSuggestion(suggestion: InsertPromptSuggestion): Promise<PromptSuggestion>;
  getAllPromptSuggestions(): Promise<PromptSuggestion[]>;
  getPromptSuggestionsByStatus(status: string): Promise<PromptSuggestion[]>;
  getPromptSuggestion(id: string): Promise<PromptSuggestion | undefined>;
  updatePromptSuggestion(id: string, updates: Partial<PromptSuggestion>): Promise<PromptSuggestion | undefined>;
  
  // Prompt Updates
  createPromptUpdate(update: InsertPromptUpdate): Promise<PromptUpdate>;
  getAllPromptUpdates(): Promise<PromptUpdate[]>;
  getPromptUpdatesByAssistantType(assistantType: string): Promise<PromptUpdate[]>;
  
  // Satisfaction Feedback
  createSatisfactionFeedback(feedback: InsertSatisfactionFeedback): Promise<SatisfactionFeedback>;
  getAllSatisfactionFeedback(): Promise<SatisfactionFeedback[]>;
  getSatisfactionFeedbackByConversationId(conversationId: string): Promise<SatisfactionFeedback | undefined>;
  getSatisfactionFeedbackByAssistantType(assistantType: string): Promise<SatisfactionFeedback[]>;
  getSatisfactionFeedbackWithConversations(): Promise<Array<SatisfactionFeedback & { conversation?: Conversation }>>;
  
  // Suggested Responses
  createSuggestedResponse(response: InsertSuggestedResponse): Promise<SuggestedResponse>;
  getSuggestedResponsesByConversationId(conversationId: string): Promise<SuggestedResponse[]>;
  updateSuggestedResponse(id: string, updates: Partial<SuggestedResponse>): Promise<SuggestedResponse | undefined>;
  
  // Dashboard Metrics
  getAgentMetrics(userId: string): Promise<{
    conversationsInQueue: number;
    conversationsFinishedToday: number;
    avgResponseTime: number;
    personalNPS: number;
    sentimentTrend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
    recentFeedbacks: Array<{ score: number; comment: string; createdAt: Date | null }>;
  }>;
  
  getSupervisorMetrics(): Promise<{
    activeConversations: number;
    queuedForTransfer: number;
    avgResponseTime: number;
    globalNPS: number;
    volumeVsSuccess: Array<{ hour: string; volume: number; successRate: number }>;
    teamStatus: Array<{ userId: string; userName: string; status: string; activeConversations: number; finishedToday: number; avgTime: number; nps: number }>;
  }>;
  
  getAdminMetrics(): Promise<{
    systemStatus: { api: boolean; database: boolean; workers: boolean };
    estimatedCost: { total: number; openai: number; upstash: number };
    activeUsers: { total: number; admins: number; supervisors: number; agents: number };
    securityEvents: { total: number; failedLogins: number };
    tokenUsage: Array<{ date: string; tokens: number }>;
    recentActivity: Array<{ type: string; message: string; timestamp: Date | null }>;
  }>;

  // Agent Status Monitor
  getAgentsStatus(): Promise<Array<{
    id: string;
    fullName: string;
    role: string;
    status: 'online' | 'idle' | 'offline';
    activeConversations: number;
    resolvedToday: number;
    avgResponseTime: number;
    successRate: number;
    sentimentAverage: string;
    lastActivity: Date | null;
  }>>;
  
  updateUserActivity(userId: string): Promise<void>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByUserId(userId: string, limit?: number): Promise<ActivityLog[]>;
  getRecentActivityLogs(limit?: number): Promise<Array<ActivityLog & { user?: User }>>;
  getLastLoginLog(userId: string): Promise<ActivityLog | undefined>;

  // Agent Reports
  getAgentReports(params: {
    startDate: Date;
    endDate: Date;
    agentId?: string;
    groupBy: 'day' | 'week' | 'month';
  }): Promise<Array<{
    period: string;
    agentId?: string;
    agentName?: string;
    totalConversations: number;
    resolvedConversations: number;
    successRate: number;
    avgResponseTime: number;
    avgSentiment: number;
    npsScore: number;
    transfersToHuman: number;
  }>>;

  // Registration Requests
  createRegistrationRequest(request: InsertRegistrationRequest): Promise<RegistrationRequest>;
  getRegistrationRequestByUsername(username: string): Promise<RegistrationRequest | undefined>;
  getAllRegistrationRequests(): Promise<RegistrationRequest[]>;
  getPendingRegistrationRequests(): Promise<RegistrationRequest[]>;
  updateRegistrationRequest(id: string, updates: Partial<RegistrationRequest>): Promise<RegistrationRequest | undefined>;
  deleteRegistrationRequest(id: string): Promise<void>;
  
  // Message Templates
  getAllMessageTemplates(): Promise<MessageTemplate[]>;
  getMessageTemplateByKey(key: string): Promise<MessageTemplate | undefined>;
  getMessageTemplatesByCategory(category: string): Promise<MessageTemplate[]>;
  updateMessageTemplate(key: string, updates: UpdateMessageTemplate): Promise<MessageTemplate | undefined>;
  createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private alerts: Map<string, Alert>;
  private supervisorActions: Map<string, SupervisorAction>;
  private learningEvents: Map<string, LearningEvent>;
  private promptSuggestions: Map<string, PromptSuggestion>;
  private promptUpdates: Map<string, PromptUpdate>;
  private satisfactionFeedback: Map<string, SatisfactionFeedback>;
  private suggestedResponses: Map<string, SuggestedResponse>;
  private registrationRequests: Map<string, RegistrationRequest>;
  private activityLogs: Map<string, ActivityLog>;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.alerts = new Map();
    this.supervisorActions = new Map();
    this.learningEvents = new Map();
    this.promptSuggestions = new Map();
    this.promptUpdates = new Map();
    this.satisfactionFeedback = new Map();
    this.suggestedResponses = new Map();
    this.registrationRequests = new Map();
    this.activityLogs = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values())
      .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || "AGENT",
      status: insertUser.status || "ACTIVE",
      email: insertUser.email || null,
      createdAt: new Date(),
      lastLoginAt: null,
      lastActivityAt: null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      const updated = { ...user, lastLoginAt: new Date() };
      this.users.set(id, updated);
    }
  }

  async updateUserStatus(id: string, status: string): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    
    const updated = { ...user, status };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationByChatId(chatId: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(
      (conv) => conv.chatId === chatId
    );
  }

  async getAllActiveConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(
      (conv) => conv.status === 'active'
    );
  }

  async getMonitorConversations(): Promise<Conversation[]> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return Array.from(this.conversations.values()).filter((conv) => {
      // Show active conversations OR resolved conversations from last 24h
      if (conv.status === 'active') return true;
      if (conv.status === 'resolved' && conv.lastMessageTime && conv.lastMessageTime >= twentyFourHoursAgo) return true;
      
      return false;
    }).sort((a, b) => (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0));
  }

  async getTransferredConversations(userId?: string, role?: string): Promise<Conversation[]> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return Array.from(this.conversations.values()).filter((conv) => {
      if (conv.transferredToHuman !== true) return false;
      
      // Apenas conversas NÃO atribuídas (disponíveis para atribuição)
      if (conv.assignedTo !== null) return false;
      
      // Show active, queued conversations OR resolved conversations from last 24h
      const isValidStatus = (
        conv.status === 'active' || 
        conv.status === 'queued' ||
        (conv.status === 'resolved' && conv.lastMessageTime && conv.lastMessageTime >= twentyFourHoursAgo)
      );
      
      return isValidStatus;
    }).sort((a, b) => (b.transferredAt?.getTime() || 0) - (a.transferredAt?.getTime() || 0));
  }

  async getAllConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createConversation(insertConv: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      ...insertConv,
      id,
      status: insertConv.status || "active",
      clientId: insertConv.clientId || null,
      threadId: insertConv.threadId || null,
      sentiment: insertConv.sentiment || null,
      urgency: insertConv.urgency || null,
      lastMessage: insertConv.lastMessage || null,
      duration: insertConv.duration ?? null,
      conversationSummary: insertConv.conversationSummary ?? null,
      lastSummarizedAt: insertConv.lastSummarizedAt ?? null,
      messageCountAtLastSummary: insertConv.messageCountAtLastSummary ?? null,
      transferredToHuman: insertConv.transferredToHuman ?? null,
      transferReason: insertConv.transferReason ?? null,
      transferredAt: insertConv.transferredAt ?? null,
      assignedTo: insertConv.assignedTo ?? null,
      resolvedAt: insertConv.resolvedAt ?? null,
      resolutionTime: insertConv.resolutionTime ?? null,
      createdAt: new Date(),
      lastMessageTime: new Date(),
      metadata: insertConv.metadata || null,
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    
    const updated = { ...conversation, ...updates };
    this.conversations.set(id, updated);
    return updated;
  }

  async deleteConversation(chatId: string): Promise<void> {
    const conversation = await this.getConversationByChatId(chatId);
    if (!conversation) return;

    // Delete all related data
    const conversationId = conversation.id;
    
    // Delete messages
    for (const [id, msg] of Array.from(this.messages.entries())) {
      if (msg.conversationId === conversationId) {
        this.messages.delete(id);
      }
    }
    
    // Delete alerts
    for (const [id, alert] of Array.from(this.alerts.entries())) {
      if (alert.conversationId === conversationId) {
        this.alerts.delete(id);
      }
    }
    
    // Delete supervisor actions
    for (const [id, action] of Array.from(this.supervisorActions.entries())) {
      if (action.conversationId === conversationId) {
        this.supervisorActions.delete(id);
      }
    }
    
    // Delete learning events
    for (const [id, event] of Array.from(this.learningEvents.entries())) {
      if (event.conversationId === conversationId) {
        this.learningEvents.delete(id);
      }
    }
    
    // Delete satisfaction feedback
    for (const [id, feedback] of Array.from(this.satisfactionFeedback.entries())) {
      if (feedback.conversationId === conversationId) {
        this.satisfactionFeedback.delete(id);
      }
    }
    
    // Delete suggested responses
    for (const [id, response] of Array.from(this.suggestedResponses.entries())) {
      if (response.conversationId === conversationId) {
        this.suggestedResponses.delete(id);
      }
    }
    
    // Finally delete the conversation
    this.conversations.delete(conversationId);
  }

  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      (msg) => msg.conversationId === conversationId
    ).sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0));
  }

  async getRecentMessagesByConversationId(conversationId: string, limit: number): Promise<Message[]> {
    const allMessages = await this.getMessagesByConversationId(conversationId);
    return allMessages.slice(-limit).reverse();
  }

  async getMessagesPaginated(conversationId: string, options: { limit?: number; before?: string }): Promise<{ messages: Message[]; hasMore: boolean }> {
    const limit = options.limit || 15;
    const allMessages = await this.getMessagesByConversationId(conversationId);
    
    if (!options.before) {
      // Retornar as mais recentes
      const messages = allMessages.slice(-limit);
      const hasMore = allMessages.length > limit;
      return { messages, hasMore };
    }
    
    // Encontrar o índice da mensagem "before"
    const beforeIndex = allMessages.findIndex(msg => msg.id === options.before);
    if (beforeIndex === -1) {
      return { messages: [], hasMore: false };
    }
    
    // Pegar as mensagens antes desse índice
    const startIndex = Math.max(0, beforeIndex - limit);
    const messages = allMessages.slice(startIndex, beforeIndex);
    const hasMore = startIndex > 0;
    
    return { messages, hasMore };
  }

  async createMessage(insertMsg: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMsg,
      id,
      timestamp: new Date(),
      functionCall: insertMsg.functionCall || null,
      assistant: insertMsg.assistant || null,
    };
    this.messages.set(id, message);
    return message;
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(
      (alert) => !alert.resolved
    ).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getAlertsByConversationId(conversationId: string): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(
      (alert) => alert.conversationId === conversationId
    );
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = randomUUID();
    const alert: Alert = {
      ...insertAlert,
      id,
      resolved: false,
      createdAt: new Date(),
    };
    this.alerts.set(id, alert);
    return alert;
  }

  async resolveAlert(id: string): Promise<void> {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.resolved = true;
      this.alerts.set(id, alert);
    }
  }

  async createSupervisorAction(insertAction: InsertSupervisorAction): Promise<SupervisorAction> {
    const id = randomUUID();
    const action: SupervisorAction = {
      ...insertAction,
      id,
      notes: insertAction.notes || null,
      createdAt: new Date(),
    };
    this.supervisorActions.set(id, action);
    return action;
  }

  async getActionsByConversationId(conversationId: string): Promise<SupervisorAction[]> {
    return Array.from(this.supervisorActions.values()).filter(
      (action) => action.conversationId === conversationId
    ).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getAllSupervisorActions(): Promise<SupervisorAction[]> {
    return Array.from(this.supervisorActions.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  // Learning Events
  async createLearningEvent(insertEvent: InsertLearningEvent): Promise<LearningEvent> {
    const id = randomUUID();
    const event: LearningEvent = {
      ...insertEvent,
      id,
      correctResponse: insertEvent.correctResponse || null,
      feedback: insertEvent.feedback || null,
      sentiment: insertEvent.sentiment || null,
      resolution: insertEvent.resolution || null,
      metadata: insertEvent.metadata || null,
      createdAt: new Date(),
    };
    this.learningEvents.set(id, event);
    return event;
  }

  async getLearningEventsByConversationId(conversationId: string): Promise<LearningEvent[]> {
    return Array.from(this.learningEvents.values()).filter(
      (event) => event.conversationId === conversationId
    ).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getLearningEventsByAssistantType(assistantType: string): Promise<LearningEvent[]> {
    return Array.from(this.learningEvents.values()).filter(
      (event) => event.assistantType === assistantType
    ).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getRecentLearningEvents(limit: number = 100): Promise<LearningEvent[]> {
    return Array.from(this.learningEvents.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  // Prompt Suggestions
  async createPromptSuggestion(insertSuggestion: InsertPromptSuggestion): Promise<PromptSuggestion> {
    const id = randomUUID();
    const suggestion: PromptSuggestion = {
      ...insertSuggestion,
      id,
      status: insertSuggestion.status || "pending",
      affectedConversations: insertSuggestion.affectedConversations || null,
      reviewedBy: insertSuggestion.reviewedBy || null,
      reviewNotes: insertSuggestion.reviewNotes || null,
      createdAt: new Date(),
      reviewedAt: null,
    };
    this.promptSuggestions.set(id, suggestion);
    return suggestion;
  }

  async getAllPromptSuggestions(): Promise<PromptSuggestion[]> {
    return Array.from(this.promptSuggestions.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getPromptSuggestionsByStatus(status: string): Promise<PromptSuggestion[]> {
    return Array.from(this.promptSuggestions.values()).filter(
      (suggestion) => suggestion.status === status
    ).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getPromptSuggestion(id: string): Promise<PromptSuggestion | undefined> {
    return this.promptSuggestions.get(id);
  }

  async updatePromptSuggestion(id: string, updates: Partial<PromptSuggestion>): Promise<PromptSuggestion | undefined> {
    const suggestion = this.promptSuggestions.get(id);
    if (!suggestion) return undefined;
    
    const updated = { ...suggestion, ...updates };
    if (updates.status && updates.status !== 'pending') {
      updated.reviewedAt = new Date();
    }
    this.promptSuggestions.set(id, updated);
    return updated;
  }

  // Prompt Updates
  async createPromptUpdate(insertUpdate: InsertPromptUpdate): Promise<PromptUpdate> {
    const id = randomUUID();
    const update: PromptUpdate = {
      ...insertUpdate,
      id,
      suggestionId: insertUpdate.suggestionId || null,
      createdAt: new Date(),
    };
    this.promptUpdates.set(id, update);
    return update;
  }

  async getAllPromptUpdates(): Promise<PromptUpdate[]> {
    return Array.from(this.promptUpdates.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getPromptUpdatesByAssistantType(assistantType: string): Promise<PromptUpdate[]> {
    return Array.from(this.promptUpdates.values()).filter(
      (update) => update.assistantType === assistantType
    ).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  // Satisfaction Feedback
  async createSatisfactionFeedback(insertFeedback: InsertSatisfactionFeedback): Promise<SatisfactionFeedback> {
    const id = randomUUID();
    
    // Calculate category based on NPS score
    let category: string;
    if (insertFeedback.npsScore >= 0 && insertFeedback.npsScore <= 6) {
      category = 'detractor';
    } else if (insertFeedback.npsScore >= 7 && insertFeedback.npsScore <= 8) {
      category = 'neutral';
    } else {
      category = 'promoter';
    }
    
    const feedback: SatisfactionFeedback = {
      ...insertFeedback,
      id,
      category,
      comment: insertFeedback.comment || null,
      clientName: insertFeedback.clientName || null,
      createdAt: new Date(),
    };
    this.satisfactionFeedback.set(id, feedback);
    return feedback;
  }

  async getAllSatisfactionFeedback(): Promise<SatisfactionFeedback[]> {
    return Array.from(this.satisfactionFeedback.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getSatisfactionFeedbackByConversationId(conversationId: string): Promise<SatisfactionFeedback | undefined> {
    return Array.from(this.satisfactionFeedback.values()).find(
      (feedback) => feedback.conversationId === conversationId
    );
  }

  async getSatisfactionFeedbackByAssistantType(assistantType: string): Promise<SatisfactionFeedback[]> {
    return Array.from(this.satisfactionFeedback.values()).filter(
      (feedback) => feedback.assistantType === assistantType
    ).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getSatisfactionFeedbackWithConversations(): Promise<Array<SatisfactionFeedback & { conversation?: Conversation }>> {
    const feedbacks = await this.getAllSatisfactionFeedback();
    return feedbacks.map(feedback => ({
      ...feedback,
      conversation: this.conversations.get(feedback.conversationId)
    }));
  }

  // Suggested Responses
  async createSuggestedResponse(insertResponse: InsertSuggestedResponse): Promise<SuggestedResponse> {
    const id = randomUUID();
    const response: SuggestedResponse = {
      ...insertResponse,
      id,
      finalResponse: insertResponse.finalResponse || null,
      wasEdited: insertResponse.wasEdited ?? null,
      wasApproved: insertResponse.wasApproved ?? null,
      approvedAt: null,
      createdAt: new Date(),
    };
    this.suggestedResponses.set(id, response);
    return response;
  }

  async getSuggestedResponsesByConversationId(conversationId: string): Promise<SuggestedResponse[]> {
    return Array.from(this.suggestedResponses.values()).filter(
      (response) => response.conversationId === conversationId
    ).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async updateSuggestedResponse(id: string, updates: Partial<SuggestedResponse>): Promise<SuggestedResponse | undefined> {
    const response = this.suggestedResponses.get(id);
    if (!response) return undefined;
    
    const updated = { ...response, ...updates };
    if (updates.wasApproved) {
      updated.approvedAt = new Date();
    }
    this.suggestedResponses.set(id, updated);
    return updated;
  }

  // Registration Requests
  async createRegistrationRequest(insertRequest: InsertRegistrationRequest): Promise<RegistrationRequest> {
    const id = randomUUID();
    const request: RegistrationRequest = {
      ...insertRequest,
      id,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
    };
    this.registrationRequests.set(id, request);
    return request;
  }

  async getRegistrationRequestByUsername(username: string): Promise<RegistrationRequest | undefined> {
    return Array.from(this.registrationRequests.values()).find(
      (request) => request.username === username
    );
  }

  async getAllRegistrationRequests(): Promise<RegistrationRequest[]> {
    return Array.from(this.registrationRequests.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getPendingRegistrationRequests(): Promise<RegistrationRequest[]> {
    return Array.from(this.registrationRequests.values())
      .filter(request => request.status === 'pending')
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async updateRegistrationRequest(id: string, updates: Partial<RegistrationRequest>): Promise<RegistrationRequest | undefined> {
    const request = this.registrationRequests.get(id);
    if (!request) return undefined;
    
    const updated = { ...request, ...updates };
    this.registrationRequests.set(id, updated);
    return updated;
  }

  async deleteRegistrationRequest(id: string): Promise<void> {
    this.registrationRequests.delete(id);
  }

  // Activity Logs (stub implementation for MemStorage)
  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    const log: ActivityLog = {
      ...insertLog,
      id,
      ipAddress: insertLog.ipAddress || null,
      userAgent: insertLog.userAgent || null,
      sessionDuration: insertLog.sessionDuration || null,
      createdAt: new Date(),
    };
    this.activityLogs.set(id, log);
    return log;
  }

  async getActivityLogsByUserId(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async getRecentActivityLogs(limit: number = 50): Promise<Array<ActivityLog & { user?: User }>> {
    const logs = Array.from(this.activityLogs.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
    
    return logs.map(log => ({
      ...log,
      user: this.users.get(log.userId)
    }));
  }

  async getLastLoginLog(userId: string): Promise<ActivityLog | undefined> {
    return Array.from(this.activityLogs.values())
      .filter(log => log.userId === userId && log.action === 'login')
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0];
  }

  async updateUserActivity(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      const updated = { ...user, lastActivityAt: new Date() };
      this.users.set(userId, updated);
    }
  }

  // Message Templates (stub implementation for MemStorage)
  async getAllMessageTemplates(): Promise<MessageTemplate[]> {
    return [];
  }

  async getMessageTemplateByKey(key: string): Promise<MessageTemplate | undefined> {
    return undefined;
  }

  async getMessageTemplatesByCategory(category: string): Promise<MessageTemplate[]> {
    return [];
  }

  async updateMessageTemplate(key: string, updates: UpdateMessageTemplate): Promise<MessageTemplate | undefined> {
    return undefined;
  }

  async createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate> {
    const id = randomUUID();
    return {
      id,
      ...template,
      variables: template.variables || [],
      updatedAt: new Date(),
      updatedBy: template.updatedBy || null,
    };
  }
}

import { db } from "./db";
import { eq, desc, and, or, gte, lte, lt, isNotNull, isNull, sql } from "drizzle-orm";
import * as schema from "@shared/schema";

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users).orderBy(schema.users.fullName);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User> {
    const [updated] = await db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, id))
      .returning();
    return updated;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db.update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, id));
  }

  async updateUserStatus(id: string, status: string): Promise<User> {
    const [updated] = await db.update(schema.users)
      .set({ status })
      .where(eq(schema.users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(schema.users)
      .where(eq(schema.users.id, id));
  }

  // Conversations
  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, id));
    return conversation;
  }

  async getConversationByChatId(chatId: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.chatId, chatId));
    return conversation;
  }

  async getAllActiveConversations(): Promise<Conversation[]> {
    return await db.select().from(schema.conversations).where(eq(schema.conversations.status, 'active'));
  }

  async getMonitorConversations(): Promise<Conversation[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return await db.select().from(schema.conversations)
      .where(
        or(
          eq(schema.conversations.status, 'active'),
          and(
            eq(schema.conversations.status, 'resolved'),
            isNotNull(schema.conversations.lastMessageTime),
            gte(schema.conversations.lastMessageTime, twentyFourHoursAgo)
          )
        )
      )
      .orderBy(desc(schema.conversations.lastMessageTime));
  }

  async getTransferredConversations(userId?: string, role?: string): Promise<Conversation[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const conditions = [
      eq(schema.conversations.transferredToHuman, true),
      // Apenas conversas NÃO atribuídas (disponíveis para atribuição)
      isNull(schema.conversations.assignedTo),
      or(
        eq(schema.conversations.status, 'active'),
        eq(schema.conversations.status, 'queued'),
        and(
          eq(schema.conversations.status, 'resolved'),
          isNotNull(schema.conversations.lastMessageTime),
          gte(schema.conversations.lastMessageTime, twentyFourHoursAgo)
        )
      )
    ];
    
    return await db.select().from(schema.conversations)
      .where(and(...conditions))
      .orderBy(desc(schema.conversations.transferredAt));
  }

  async getAllConversations(): Promise<Conversation[]> {
    return await db.select().from(schema.conversations).orderBy(desc(schema.conversations.createdAt));
  }

  async createConversation(insertConv: InsertConversation): Promise<Conversation> {
    const [conversation] = await db.insert(schema.conversations).values(insertConv).returning();
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const [updated] = await db.update(schema.conversations)
      .set(updates)
      .where(eq(schema.conversations.id, id))
      .returning();
    return updated;
  }

  async deleteConversation(chatId: string): Promise<void> {
    const conversation = await this.getConversationByChatId(chatId);
    if (!conversation) return;

    const conversationId = conversation.id;

    // Delete all related data (Postgres will handle cascade if set up, but we'll be explicit)
    await db.delete(schema.messages).where(eq(schema.messages.conversationId, conversationId));
    await db.delete(schema.alerts).where(eq(schema.alerts.conversationId, conversationId));
    await db.delete(schema.supervisorActions).where(eq(schema.supervisorActions.conversationId, conversationId));
    await db.delete(schema.learningEvents).where(eq(schema.learningEvents.conversationId, conversationId));
    await db.delete(schema.satisfactionFeedback).where(eq(schema.satisfactionFeedback.conversationId, conversationId));
    await db.delete(schema.suggestedResponses).where(eq(schema.suggestedResponses.conversationId, conversationId));
    
    // Finally delete the conversation
    await db.delete(schema.conversations).where(eq(schema.conversations.id, conversationId));
  }

  // Messages
  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    return await db.select().from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(schema.messages.timestamp);
  }

  async getRecentMessagesByConversationId(conversationId: string, limit: number): Promise<Message[]> {
    return await db.select().from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.timestamp))
      .limit(limit);
  }

  async getMessagesPaginated(conversationId: string, options: { limit?: number; before?: string }): Promise<{ messages: Message[]; hasMore: boolean }> {
    const limit = options.limit || 15;
    
    let query = db.select().from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .$dynamic();
    
    if (options.before) {
      // Buscar a mensagem "before" para pegar seu timestamp
      const beforeMessage = await db.select().from(schema.messages)
        .where(eq(schema.messages.id, options.before))
        .limit(1);
      
      if (beforeMessage.length === 0) {
        return { messages: [], hasMore: false };
      }
      
      // Buscar mensagens com timestamp menor que o before
      query = query.where(
        and(
          eq(schema.messages.conversationId, conversationId),
          lt(schema.messages.timestamp, beforeMessage[0].timestamp)
        )
      );
    }
    
    // Ordenar DESC e pegar limit + 1 para saber se há mais
    const messages = await query
      .orderBy(desc(schema.messages.timestamp))
      .limit(limit + 1);
    
    const hasMore = messages.length > limit;
    const result = hasMore ? messages.slice(0, limit) : messages;
    
    // Retornar em ordem ASC (mais antigas primeiro)
    return { messages: result.reverse(), hasMore };
  }

  async createMessage(insertMsg: InsertMessage): Promise<Message> {
    const [message] = await db.insert(schema.messages).values(insertMsg).returning();
    return message;
  }

  // Alerts
  async getActiveAlerts(): Promise<Alert[]> {
    return await db.select().from(schema.alerts)
      .where(eq(schema.alerts.resolved, false))
      .orderBy(desc(schema.alerts.createdAt));
  }

  async getAlertsByConversationId(conversationId: string): Promise<Alert[]> {
    return await db.select().from(schema.alerts)
      .where(eq(schema.alerts.conversationId, conversationId));
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const [alert] = await db.insert(schema.alerts).values(insertAlert).returning();
    return alert;
  }

  async resolveAlert(id: string): Promise<void> {
    await db.update(schema.alerts)
      .set({ resolved: true })
      .where(eq(schema.alerts.id, id));
  }

  // Supervisor Actions
  async createSupervisorAction(insertAction: InsertSupervisorAction): Promise<SupervisorAction> {
    const [action] = await db.insert(schema.supervisorActions).values(insertAction).returning();
    return action;
  }

  async getActionsByConversationId(conversationId: string): Promise<SupervisorAction[]> {
    return await db.select().from(schema.supervisorActions)
      .where(eq(schema.supervisorActions.conversationId, conversationId))
      .orderBy(desc(schema.supervisorActions.createdAt));
  }

  async getAllSupervisorActions(): Promise<SupervisorAction[]> {
    return await db.select().from(schema.supervisorActions)
      .orderBy(desc(schema.supervisorActions.createdAt));
  }

  // Learning Events
  async createLearningEvent(insertEvent: InsertLearningEvent): Promise<LearningEvent> {
    const [event] = await db.insert(schema.learningEvents).values(insertEvent).returning();
    return event;
  }

  async getLearningEventsByConversationId(conversationId: string): Promise<LearningEvent[]> {
    return await db.select().from(schema.learningEvents)
      .where(eq(schema.learningEvents.conversationId, conversationId))
      .orderBy(desc(schema.learningEvents.createdAt));
  }

  async getLearningEventsByAssistantType(assistantType: string): Promise<LearningEvent[]> {
    return await db.select().from(schema.learningEvents)
      .where(eq(schema.learningEvents.assistantType, assistantType))
      .orderBy(desc(schema.learningEvents.createdAt));
  }

  async getRecentLearningEvents(limit: number = 100): Promise<LearningEvent[]> {
    return await db.select().from(schema.learningEvents)
      .orderBy(desc(schema.learningEvents.createdAt))
      .limit(limit);
  }

  // Prompt Suggestions
  async createPromptSuggestion(insertSuggestion: InsertPromptSuggestion): Promise<PromptSuggestion> {
    const [suggestion] = await db.insert(schema.promptSuggestions).values(insertSuggestion).returning();
    return suggestion;
  }

  async getAllPromptSuggestions(): Promise<PromptSuggestion[]> {
    return await db.select().from(schema.promptSuggestions)
      .orderBy(desc(schema.promptSuggestions.createdAt));
  }

  async getPromptSuggestionsByStatus(status: string): Promise<PromptSuggestion[]> {
    return await db.select().from(schema.promptSuggestions)
      .where(eq(schema.promptSuggestions.status, status))
      .orderBy(desc(schema.promptSuggestions.createdAt));
  }

  async getPromptSuggestion(id: string): Promise<PromptSuggestion | undefined> {
    const [suggestion] = await db.select().from(schema.promptSuggestions)
      .where(eq(schema.promptSuggestions.id, id));
    return suggestion;
  }

  async updatePromptSuggestion(id: string, updates: Partial<PromptSuggestion>): Promise<PromptSuggestion | undefined> {
    const updateData = { ...updates };
    if (updates.status && updates.status !== 'pending') {
      updateData.reviewedAt = new Date();
    }
    const [updated] = await db.update(schema.promptSuggestions)
      .set(updateData)
      .where(eq(schema.promptSuggestions.id, id))
      .returning();
    return updated;
  }

  // Prompt Updates
  async createPromptUpdate(insertUpdate: InsertPromptUpdate): Promise<PromptUpdate> {
    const [update] = await db.insert(schema.promptUpdates).values(insertUpdate).returning();
    return update;
  }

  async getAllPromptUpdates(): Promise<PromptUpdate[]> {
    return await db.select().from(schema.promptUpdates)
      .orderBy(desc(schema.promptUpdates.createdAt));
  }

  async getPromptUpdatesByAssistantType(assistantType: string): Promise<PromptUpdate[]> {
    return await db.select().from(schema.promptUpdates)
      .where(eq(schema.promptUpdates.assistantType, assistantType))
      .orderBy(desc(schema.promptUpdates.createdAt));
  }

  // Satisfaction Feedback
  async createSatisfactionFeedback(insertFeedback: InsertSatisfactionFeedback): Promise<SatisfactionFeedback> {
    // Calculate category based on NPS score
    let category: string;
    if (insertFeedback.npsScore >= 0 && insertFeedback.npsScore <= 6) {
      category = 'detractor';
    } else if (insertFeedback.npsScore >= 7 && insertFeedback.npsScore <= 8) {
      category = 'neutral';
    } else {
      category = 'promoter';
    }
    
    const [feedback] = await db.insert(schema.satisfactionFeedback).values({
      ...insertFeedback,
      category
    }).returning();
    return feedback;
  }

  async getAllSatisfactionFeedback(): Promise<SatisfactionFeedback[]> {
    return await db.select().from(schema.satisfactionFeedback)
      .orderBy(desc(schema.satisfactionFeedback.createdAt));
  }

  async getSatisfactionFeedbackByConversationId(conversationId: string): Promise<SatisfactionFeedback | undefined> {
    const [feedback] = await db.select().from(schema.satisfactionFeedback)
      .where(eq(schema.satisfactionFeedback.conversationId, conversationId));
    return feedback;
  }

  async getSatisfactionFeedbackByAssistantType(assistantType: string): Promise<SatisfactionFeedback[]> {
    return await db.select().from(schema.satisfactionFeedback)
      .where(eq(schema.satisfactionFeedback.assistantType, assistantType))
      .orderBy(desc(schema.satisfactionFeedback.createdAt));
  }

  async getSatisfactionFeedbackWithConversations(): Promise<Array<SatisfactionFeedback & { conversation?: Conversation }>> {
    const feedbacks = await db.select().from(schema.satisfactionFeedback)
      .orderBy(desc(schema.satisfactionFeedback.createdAt));
    
    const results = [];
    for (const feedback of feedbacks) {
      const [conversation] = await db.select().from(schema.conversations)
        .where(eq(schema.conversations.id, feedback.conversationId));
      
      results.push({
        ...feedback,
        conversation
      });
    }
    
    return results;
  }

  // Suggested Responses
  async createSuggestedResponse(insertResponse: InsertSuggestedResponse): Promise<SuggestedResponse> {
    const [response] = await db.insert(schema.suggestedResponses).values(insertResponse).returning();
    return response;
  }

  async getSuggestedResponsesByConversationId(conversationId: string): Promise<SuggestedResponse[]> {
    return await db.select().from(schema.suggestedResponses)
      .where(eq(schema.suggestedResponses.conversationId, conversationId))
      .orderBy(desc(schema.suggestedResponses.createdAt));
  }

  async updateSuggestedResponse(id: string, updates: Partial<SuggestedResponse>): Promise<SuggestedResponse | undefined> {
    const [updated] = await db.update(schema.suggestedResponses)
      .set(updates)
      .where(eq(schema.suggestedResponses.id, id))
      .returning();
    return updated;
  }

  // Dashboard Metrics
  async getAgentMetrics(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Conversas atribuídas ao agente (em fila)
    const queuedConversations = await db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.assignedTo, userId),
        eq(schema.conversations.status, 'active')
      ));

    // Conversas finalizadas hoje
    const finishedToday = await db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.assignedTo, userId),
        eq(schema.conversations.status, 'resolved'),
        gte(schema.conversations.resolvedAt, today)
      ));

    // NPS pessoal (últimas 30 conversas)
    const personalFeedbacks = await db.select().from(schema.satisfactionFeedback)
      .innerJoin(schema.conversations, eq(schema.satisfactionFeedback.conversationId, schema.conversations.id))
      .where(eq(schema.conversations.assignedTo, userId))
      .limit(30);

    const avgNPS = personalFeedbacks.length > 0
      ? personalFeedbacks.reduce((sum, f) => sum + f.satisfaction_feedback.npsScore, 0) / personalFeedbacks.length
      : 0;

    // Tendência de sentimento (últimos 7 dias)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sentimentData = await db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.assignedTo, userId),
        gte(schema.conversations.createdAt, sevenDaysAgo)
      ));

    const sentimentTrend = this.calculateSentimentTrend(sentimentData);

    // Feedbacks recentes
    const recentFeedbacks = personalFeedbacks.slice(0, 4).map(f => ({
      score: f.satisfaction_feedback.npsScore,
      comment: f.satisfaction_feedback.comment || '',
      createdAt: f.satisfaction_feedback.createdAt
    }));

    return {
      conversationsInQueue: queuedConversations.length,
      conversationsFinishedToday: finishedToday.length,
      avgResponseTime: 0, // TODO: Implementar cálculo de TMA
      personalNPS: Math.round(avgNPS),
      sentimentTrend,
      recentFeedbacks
    };
  }

  async getSupervisorMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Conversas ativas
    const activeConversations = await db.select().from(schema.conversations)
      .where(eq(schema.conversations.status, 'active'));

    // Conversas na fila de transferência
    const queuedForTransfer = await db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.status, 'active'),
        eq(schema.conversations.transferredToHuman, true)
      ));

    // NPS global
    const allFeedbacks = await db.select().from(schema.satisfactionFeedback);
    const globalNPS = allFeedbacks.length > 0
      ? allFeedbacks.reduce((sum, f) => sum + f.npsScore, 0) / allFeedbacks.length
      : 0;

    // Volume vs Sucesso (últimas 24h por hora)
    const volumeVsSuccess = await this.calculateVolumeVsSuccess();

    // Status da equipe
    const agents = await db.select().from(schema.users)
      .where(eq(schema.users.role, 'AGENT'));

    const teamStatus = await Promise.all(agents.map(async (agent) => {
      const activeConvs = await db.select().from(schema.conversations)
        .where(and(
          eq(schema.conversations.assignedTo, agent.id),
          eq(schema.conversations.status, 'active')
        ));

      const finishedToday = await db.select().from(schema.conversations)
        .where(and(
          eq(schema.conversations.assignedTo, agent.id),
          eq(schema.conversations.status, 'resolved'),
          gte(schema.conversations.resolvedAt, today)
        ));

      return {
        userId: agent.id,
        userName: agent.fullName,
        status: agent.lastLoginAt && new Date(agent.lastLoginAt) > new Date(Date.now() - 15 * 60 * 1000) ? 'Online' : 'Offline',
        activeConversations: activeConvs.length,
        finishedToday: finishedToday.length,
        avgTime: 0, // TODO
        nps: 0 // TODO
      };
    }));

    return {
      activeConversations: activeConversations.length,
      queuedForTransfer: queuedForTransfer.length,
      avgResponseTime: 0, // TODO
      globalNPS: Math.round(globalNPS),
      volumeVsSuccess,
      teamStatus
    };
  }

  async getAdminMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // System status (simplificado)
    const systemStatus = {
      api: true,
      database: true,
      workers: true
    };

    // Custo estimado (mock por enquanto)
    const estimatedCost = {
      total: 123.45,
      openai: 80.10,
      upstash: 43.35
    };

    // Usuários ativos
    const allUsers = await db.select().from(schema.users);
    const activeToday = allUsers.filter(u => 
      u.lastLoginAt && new Date(u.lastLoginAt) > today
    );

    const activeUsers = {
      total: activeToday.length,
      admins: activeToday.filter(u => u.role === 'ADMIN').length,
      supervisors: activeToday.filter(u => u.role === 'SUPERVISOR').length,
      agents: activeToday.filter(u => u.role === 'AGENT').length
    };

    // Eventos de segurança (mock)
    const securityEvents = {
      total: 0,
      failedLogins: 0
    };

    // Token usage (últimos 30 dias - mock)
    const tokenUsage = this.generateMockTokenUsage();

    // Atividade recente
    const recentActions = await db.select().from(schema.supervisorActions)
      .orderBy(desc(schema.supervisorActions.createdAt))
      .limit(10);

    const recentActivity = recentActions.map(action => ({
      type: action.action,
      message: `Ação: ${action.action} na conversa`,
      timestamp: action.createdAt
    }));

    return {
      systemStatus,
      estimatedCost,
      activeUsers,
      securityEvents,
      tokenUsage,
      recentActivity
    };
  }

  private calculateSentimentTrend(conversations: Conversation[]) {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayConvs = conversations.filter(c => 
        c.createdAt && c.createdAt.toISOString().split('T')[0] === dateStr
      );

      last7Days.push({
        date: dateStr,
        positive: dayConvs.filter(c => c.sentiment === 'positive').length,
        neutral: dayConvs.filter(c => c.sentiment === 'neutral').length,
        negative: dayConvs.filter(c => c.sentiment === 'negative').length
      });
    }
    return last7Days;
  }

  private async calculateVolumeVsSuccess() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const conversations = await db.select().from(schema.conversations)
      .where(gte(schema.conversations.createdAt, last24Hours));

    const hourlyData = [];
    for (let i = 0; i < 24; i++) {
      const hour = new Date(last24Hours);
      hour.setHours(hour.getHours() + i);
      const hourStr = `${hour.getHours()}:00`;

      const hourConvs = conversations.filter(c => {
        if (!c.createdAt) return false;
        const convHour = new Date(c.createdAt).getHours();
        return convHour === hour.getHours();
      });

      const resolved = hourConvs.filter(c => c.status === 'resolved').length;
      const successRate = hourConvs.length > 0 ? (resolved / hourConvs.length) * 100 : 0;

      hourlyData.push({
        hour: hourStr,
        volume: hourConvs.length,
        successRate: Math.round(successRate)
      });
    }

    return hourlyData;
  }

  private generateMockTokenUsage() {
    const usage = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      usage.push({
        date: date.toISOString().split('T')[0],
        tokens: Math.floor(Math.random() * 50000) + 10000
      });
    }
    return usage;
  }

  async getAgentsStatus() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all human agents (AGENT and SUPERVISOR roles)
    const agents = await db.select().from(schema.users)
      .where(or(
        eq(schema.users.role, 'AGENT'),
        eq(schema.users.role, 'SUPERVISOR')
      ));

    const agentsStatus = await Promise.all(agents.map(async (agent) => {
      // Determine status based on lastActivityAt
      let status: 'online' | 'idle' | 'offline' = 'offline';
      if (agent.lastActivityAt) {
        const lastActivity = new Date(agent.lastActivityAt);
        if (lastActivity > fiveMinutesAgo) {
          status = 'online';
        } else if (lastActivity > new Date(now.getTime() - 30 * 60 * 1000)) {
          status = 'idle';
        }
      }

      // Active conversations assigned to this agent
      const activeConversations = await db.select().from(schema.conversations)
        .where(and(
          eq(schema.conversations.assignedTo, agent.id),
          or(
            eq(schema.conversations.status, 'active'),
            eq(schema.conversations.status, 'transferred')
          )
        ));

      // Resolved conversations today
      const resolvedToday = await db.select().from(schema.conversations)
        .where(and(
          eq(schema.conversations.assignedTo, agent.id),
          eq(schema.conversations.status, 'resolved'),
          gte(schema.conversations.resolvedAt, today)
        ));

      // Calculate success rate (resolved without escalation)
      const totalAssigned = await db.select().from(schema.conversations)
        .where(eq(schema.conversations.assignedTo, agent.id));
      
      const successfullyResolved = totalAssigned.filter(c => 
        c.status === 'resolved' && !c.transferredToHuman
      );
      const successRate = totalAssigned.length > 0 
        ? Math.round((successfullyResolved.length / totalAssigned.length) * 100)
        : 0;

      // Calculate average sentiment
      const conversationsWithSentiment = totalAssigned.filter(c => c.sentiment);
      const sentimentScore = conversationsWithSentiment.reduce((sum, c) => {
        if (c.sentiment === 'positive') return sum + 1;
        if (c.sentiment === 'negative') return sum - 1;
        return sum;
      }, 0);
      const sentimentAverage = conversationsWithSentiment.length > 0
        ? sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral'
        : 'neutral';

      return {
        id: agent.id,
        fullName: agent.fullName,
        role: agent.role,
        status,
        activeConversations: activeConversations.length,
        resolvedToday: resolvedToday.length,
        avgResponseTime: 0, // TODO: Calculate from message timestamps
        successRate,
        sentimentAverage,
        lastActivity: agent.lastActivityAt
      };
    }));

    return agentsStatus;
  }

  async updateUserActivity(userId: string) {
    await db.update(schema.users)
      .set({ lastActivityAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  // Activity Logs
  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db.insert(schema.activityLogs).values(insertLog).returning();
    return log;
  }

  async getActivityLogsByUserId(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    return await db.select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.userId, userId))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit);
  }

  async getRecentActivityLogs(limit: number = 50): Promise<Array<ActivityLog & { user?: User }>> {
    const logs = await db.select()
      .from(schema.activityLogs)
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit);
    
    // Join with users
    const logsWithUsers = await Promise.all(logs.map(async (log) => {
      const [user] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, log.userId))
        .limit(1);
      return { ...log, user };
    }));
    
    return logsWithUsers;
  }

  async getLastLoginLog(userId: string): Promise<ActivityLog | undefined> {
    const [log] = await db.select()
      .from(schema.activityLogs)
      .where(
        and(
          eq(schema.activityLogs.userId, userId),
          eq(schema.activityLogs.action, 'login')
        )
      )
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(1);
    return log;
  }

  async getAgentReports(params: {
    startDate: Date;
    endDate: Date;
    agentId?: string;
    groupBy: 'day' | 'week' | 'month';
  }) {
    const { startDate, endDate, agentId, groupBy } = params;

    // Get all conversations in the period
    let conversationsQuery = db.select({
      conversation: schema.conversations,
      agent: schema.users
    })
      .from(schema.conversations)
      .leftJoin(schema.users, eq(schema.conversations.assignedTo, schema.users.id))
      .where(and(
        gte(schema.conversations.createdAt, startDate),
        lte(schema.conversations.createdAt, endDate),
        agentId ? eq(schema.conversations.assignedTo, agentId) : sql`1=1`
      ));

    const conversations = await conversationsQuery;

    // Get NPS feedbacks for the period
    const feedbacks = await db.select()
      .from(schema.satisfactionFeedback)
      .where(and(
        gte(schema.satisfactionFeedback.createdAt, startDate),
        lte(schema.satisfactionFeedback.createdAt, endDate)
      ));

    // Group conversations by period
    const groupedData = new Map<string, {
      agentId?: string;
      agentName?: string;
      conversations: typeof conversations;
      feedbacks: typeof feedbacks;
    }>();

    conversations.forEach(({ conversation, agent }) => {
      if (!conversation.createdAt) return;

      const date = new Date(conversation.createdAt);
      let periodKey = '';

      switch (groupBy) {
        case 'day':
          periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          const weekNum = this.getWeekNumber(date);
          periodKey = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
          break;
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      // If filtering by agent, use single key; otherwise use agent-specific keys
      const key = agentId ? periodKey : `${periodKey}-${conversation.assignedTo || 'unassigned'}`;

      if (!groupedData.has(key)) {
        groupedData.set(key, {
          agentId: conversation.assignedTo || undefined,
          agentName: agent?.fullName || 'Não Atribuído',
          conversations: [],
          feedbacks: []
        });
      }

      groupedData.get(key)!.conversations.push({ conversation, agent });
    });

    // Add feedbacks to grouped data
    feedbacks.forEach(feedback => {
      if (!feedback.createdAt) return;

      const date = new Date(feedback.createdAt);
      let periodKey = '';

      switch (groupBy) {
        case 'day':
          periodKey = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekNum = this.getWeekNumber(date);
          periodKey = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
          break;
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      // Find the conversation to get agent
      const conv = conversations.find(c => c.conversation.id === feedback.conversationId);
      const key = agentId ? periodKey : `${periodKey}-${conv?.conversation.assignedTo || 'unassigned'}`;

      if (groupedData.has(key)) {
        groupedData.get(key)!.feedbacks.push(feedback);
      }
    });

    // Calculate metrics for each period
    const reports = Array.from(groupedData.entries()).map(([key, data]) => {
      const period = agentId ? key : key.split('-').slice(0, groupBy === 'week' ? 2 : groupBy === 'day' ? 3 : 2).join('-');
      const convs = data.conversations.map(c => c.conversation);
      
      const totalConversations = convs.length;
      const resolvedConversations = convs.filter(c => c.status === 'resolved').length;
      const successRate = totalConversations > 0 
        ? Math.round((resolvedConversations / totalConversations) * 100)
        : 0;

      // Calculate average sentiment
      const convsWithSentiment = convs.filter(c => c.sentiment);
      const sentimentScore = convsWithSentiment.reduce((sum, c) => {
        if (c.sentiment === 'positive') return sum + 1;
        if (c.sentiment === 'negative') return sum - 1;
        return sum;
      }, 0);
      const avgSentiment = convsWithSentiment.length > 0
        ? Math.round((sentimentScore / convsWithSentiment.length) * 100) / 100
        : 0;

      // Calculate NPS
      const npsScore = data.feedbacks.length > 0
        ? Math.round(data.feedbacks.reduce((sum, f) => sum + (f.npsScore || 0), 0) / data.feedbacks.length)
        : 0;

      // Count transfers to human
      const transfersToHuman = convs.filter(c => c.transferredToHuman).length;

      return {
        period,
        agentId: data.agentId,
        agentName: data.agentName,
        totalConversations,
        resolvedConversations,
        successRate,
        avgResponseTime: 0, // TODO: Calculate from message timestamps
        avgSentiment,
        npsScore,
        transfersToHuman
      };
    });

    // Sort by period
    return reports.sort((a, b) => a.period.localeCompare(b.period));
  }

  // Registration Requests
  async createRegistrationRequest(insertRequest: InsertRegistrationRequest): Promise<RegistrationRequest> {
    const [request] = await db.insert(schema.registrationRequests)
      .values(insertRequest)
      .returning();
    return request;
  }

  async getRegistrationRequestByUsername(username: string): Promise<RegistrationRequest | undefined> {
    const [request] = await db.select()
      .from(schema.registrationRequests)
      .where(eq(schema.registrationRequests.username, username));
    return request;
  }

  async getAllRegistrationRequests(): Promise<RegistrationRequest[]> {
    return await db.select()
      .from(schema.registrationRequests)
      .orderBy(desc(schema.registrationRequests.createdAt));
  }

  async getPendingRegistrationRequests(): Promise<RegistrationRequest[]> {
    return await db.select()
      .from(schema.registrationRequests)
      .where(eq(schema.registrationRequests.status, 'pending'))
      .orderBy(desc(schema.registrationRequests.createdAt));
  }

  async updateRegistrationRequest(id: string, updates: Partial<RegistrationRequest>): Promise<RegistrationRequest | undefined> {
    const [updated] = await db.update(schema.registrationRequests)
      .set(updates)
      .where(eq(schema.registrationRequests.id, id))
      .returning();
    return updated;
  }

  async deleteRegistrationRequest(id: string): Promise<void> {
    await db.delete(schema.registrationRequests)
      .where(eq(schema.registrationRequests.id, id));
  }

  // Message Templates
  async getAllMessageTemplates(): Promise<MessageTemplate[]> {
    return await db.select()
      .from(schema.messageTemplates)
      .orderBy(schema.messageTemplates.category, schema.messageTemplates.name);
  }

  async getMessageTemplateByKey(key: string): Promise<MessageTemplate | undefined> {
    const [template] = await db.select()
      .from(schema.messageTemplates)
      .where(eq(schema.messageTemplates.key, key));
    return template;
  }

  async getMessageTemplatesByCategory(category: string): Promise<MessageTemplate[]> {
    return await db.select()
      .from(schema.messageTemplates)
      .where(eq(schema.messageTemplates.category, category))
      .orderBy(schema.messageTemplates.name);
  }

  async updateMessageTemplate(key: string, updates: UpdateMessageTemplate): Promise<MessageTemplate | undefined> {
    const [updated] = await db.update(schema.messageTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.messageTemplates.key, key))
      .returning();
    return updated;
  }

  async createMessageTemplate(insertTemplate: InsertMessageTemplate): Promise<MessageTemplate> {
    const [template] = await db.insert(schema.messageTemplates)
      .values(insertTemplate)
      .returning();
    return template;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

export const storage = new DbStorage();
