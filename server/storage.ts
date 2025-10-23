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
  type InsertActivityLog,
  type Complaint,
  type InsertComplaint,
  type UpdateComplaint,
  type TrainingSession,
  type InsertTrainingSession,
  type UpdateTrainingSession,
  type RagAnalytics,
  type InsertRagAnalytics,
  type Contact,
  type InsertContact,
  type UpdateContact,
  type Group,
  type InsertGroup,
  type UpdateGroup,
  type PrivateNote,
  type InsertPrivateNote
} from "@shared/schema";
import { randomUUID } from "crypto";
import { localCache } from "./lib/redis-cache";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUsersByIds(ids: string[]): Promise<User[]>;
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
  getMonitorConversations(): Promise<Conversation[]>; // Ativas + Resolvidas (12h)
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
  getMessage(id: string): Promise<Message | undefined>;
  updateMessage(id: string, updates: Partial<Message>): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  
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
  updateSatisfactionFeedback(id: string, updates: Partial<SatisfactionFeedback>): Promise<SatisfactionFeedback | undefined>;
  updateSatisfactionFeedbackHandling(id: string, updates: {
    handlingScore?: number;
    handlingStatus?: string;
    handlingNotes?: string;
    handledBy?: string;
  }): Promise<SatisfactionFeedback | undefined>;
  
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
  
  getAIPerformanceMetrics(): Promise<Array<{
    assistantType: string;
    assistantName: string;
    totalConversations: number;
    resolvedByAI: number;
    transferredToHuman: number;
    successRate: number;
    avgSentiment: number;
    avgNPS: number;
  }>>;
  
  getAdminMetrics(): Promise<{
    systemStatus: { api: boolean; database: boolean; workers: boolean };
    estimatedCost: { total: number; openai: number; upstash: number };
    activeUsers: { total: number; admins: number; supervisors: number; agents: number };
    securityEvents: { total: number; failedLogins: number };
    dailyMessages: Array<{ date: string; messages: number }>;
    volumeVsSuccess: Array<{ hour: string; volume: number; successRate: number }>;
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

  // Complaints (Ouvidoria)
  createComplaint(complaint: InsertComplaint): Promise<Complaint>;
  getComplaint(id: string): Promise<Complaint | undefined>;
  getComplaintsByConversationId(conversationId: string): Promise<Complaint[]>;
  getAllComplaints(): Promise<Complaint[]>;
  getComplaintsByStatus(status: string): Promise<Complaint[]>;
  getComplaintsBySeverity(severity: string): Promise<Complaint[]>;
  updateComplaint(id: string, updates: UpdateComplaint): Promise<Complaint | undefined>;

  // Training Sessions
  createTrainingSession(session: InsertTrainingSession): Promise<TrainingSession>;
  getTrainingSession(id: string): Promise<TrainingSession | undefined>;
  getAllTrainingSessions(): Promise<TrainingSession[]>;
  getActiveTrainingSessions(): Promise<TrainingSession[]>;
  getTrainingSessionsByStatus(status: string): Promise<TrainingSession[]>;
  getTrainingSessionsByAssistant(assistantType: string): Promise<TrainingSession[]>;
  updateTrainingSession(id: string, updates: UpdateTrainingSession): Promise<TrainingSession | undefined>;
  completeTrainingSession(id: string, completedBy: string): Promise<TrainingSession | undefined>;
  applyTrainingSession(id: string, appliedBy: string, improvedPrompt: string): Promise<TrainingSession | undefined>;

  // RAG Analytics
  createRagAnalytics(analytics: InsertRagAnalytics): Promise<RagAnalytics>;
  getRagAnalyticsByConversation(conversationId: string): Promise<RagAnalytics[]>;
  getRagAnalyticsByDateRange(startDate: Date, endDate: Date): Promise<RagAnalytics[]>;
  getRagAnalyticsSummary(startDate: Date, endDate: Date): Promise<{
    totalQueries: number;
    successRate: number;
    byAssistant: { assistantType: string; count: number; successRate: number }[];
    topQueries: { query: string; count: number }[];
  }>;

  // Contacts
  createContact(contact: InsertContact): Promise<Contact>;
  getContact(id: string): Promise<Contact | undefined>;
  getContactByPhoneNumber(phoneNumber: string): Promise<Contact | undefined>;
  getAllContacts(): Promise<Contact[]>;
  getContactsWithFilters(params: {
    search?: string;
    status?: string;
    hasRecurringIssues?: boolean;
  }): Promise<Contact[]>;
  updateContact(id: string, updates: UpdateContact): Promise<Contact | undefined>;
  updateContactFromConversation(phoneNumber: string, conversationId: string, conversationData: {
    name?: string;
    document?: string;
    hasRecurringIssues?: boolean;
  }): Promise<Contact>;
  syncContactToConversations(phoneNumber: string, updates: { name?: string; document?: string }): Promise<number>;
  deleteContact(id: string): Promise<void>;
  
  // Groups
  createGroup(group: InsertGroup): Promise<Group>;
  getGroup(id: string): Promise<Group | undefined>;
  getGroupByGroupId(groupId: string): Promise<Group | undefined>;
  getAllGroups(): Promise<Group[]>;
  getGroupsWithFilters(params: {
    search?: string;
    aiEnabled?: boolean;
  }): Promise<Group[]>;
  updateGroup(id: string, updates: UpdateGroup): Promise<Group | undefined>;
  toggleGroupAi(id: string, aiEnabled: boolean): Promise<Group | undefined>;
  deleteGroup(id: string): Promise<void>;

  // Private Notes
  createPrivateNote(note: InsertPrivateNote): Promise<PrivateNote>;
  getPrivateNotesByConversationId(conversationId: string): Promise<PrivateNote[]>;

  // Plans & Sales
  getAllPlans(): Promise<any[]>; // Returns all plans (active and inactive)
  getActivePlans(): Promise<any[]>; // Returns all active plans
  getPlan(id: string): Promise<any | undefined>; // Returns a specific plan
  addPlan(plan: any): Promise<any>; // Creates a new plan
  updatePlan(id: string, updates: any): Promise<any>; // Updates a plan
  togglePlanStatus(id: string): Promise<any>; // Toggles plan active status
  getAllSales(): Promise<any[]>; // Returns all sales/leads
  addSale(sale: any): Promise<any>; // Creates a new sale/lead
  updateSaleStatus(id: string, status: string, observations?: string): Promise<any>; // Updates sale status
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
  private complaints: Map<string, Complaint>;
  private trainingSessions: Map<string, TrainingSession>;
  private contacts: Map<string, Contact>;
  private groups: Map<string, Group>;

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
    this.contacts = new Map();
    this.groups = new Map();
    this.activityLogs = new Map();
    this.complaints = new Map();
    this.trainingSessions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    return ids.map(id => this.users.get(id)).filter(Boolean) as User[];
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
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    
    return Array.from(this.conversations.values()).filter((conv) => {
      // Show active conversations OR resolved conversations from last 12h
      if (conv.status === 'active') return true;
      if (conv.status === 'resolved' && conv.lastMessageTime && conv.lastMessageTime >= twelveHoursAgo) return true;
      
      return false;
    }).sort((a, b) => (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0));
  }

  async getTransferredConversations(userId?: string, role?: string): Promise<Conversation[]> {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    
    return Array.from(this.conversations.values()).filter((conv) => {
      if (conv.transferredToHuman !== true) return false;
      
      // Apenas conversas NÃO atribuídas (disponíveis para atribuição)
      if (conv.assignedTo !== null) return false;
      
      // Show active, queued conversations OR resolved conversations from last 12h
      const isValidStatus = (
        conv.status === 'active' || 
        conv.status === 'queued' ||
        (conv.status === 'resolved' && conv.lastMessageTime && conv.lastMessageTime >= twelveHoursAgo)
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
      clientDocument: insertConv.clientDocument ?? null,
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
      evolutionInstance: insertConv.evolutionInstance ?? null,
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

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<void> {
    const message = this.messages.get(id);
    if (message) {
      this.messages.set(id, { ...message, ...updates });
    }
  }

  async deleteMessage(id: string): Promise<void> {
    this.messages.delete(id);
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

  async updateSatisfactionFeedback(id: string, updates: Partial<SatisfactionFeedback>): Promise<SatisfactionFeedback | undefined> {
    const feedback = this.satisfactionFeedback.get(id);
    if (!feedback) return undefined;
    
    const updated = { ...feedback, ...updates };
    this.satisfactionFeedback.set(id, updated);
    return updated;
  }

  async updateSatisfactionFeedbackHandling(
    id: string, 
    updates: {
      handlingScore?: number;
      handlingStatus?: string;
      handlingNotes?: string;
      handledBy?: string;
    }
  ): Promise<SatisfactionFeedback | undefined> {
    const feedback = this.satisfactionFeedback.get(id);
    if (!feedback) return undefined;
    
    const updated = {
      ...feedback,
      ...updates,
      handledAt: new Date()
    };
    this.satisfactionFeedback.set(id, updated);
    return updated;
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
      status: insertRequest.status || 'pending',
      requestedRole: insertRequest.requestedRole || 'AGENT',
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
      description: template.description ?? null,
      variables: template.variables || [],
      updatedAt: new Date(),
      updatedBy: template.updatedBy || null,
    };
  }

  // Complaints (stub implementation for MemStorage)
  async createComplaint(insertComplaint: InsertComplaint): Promise<Complaint> {
    const id = randomUUID();
    const complaint: Complaint = {
      id,
      ...insertComplaint,
      severity: insertComplaint.severity || 'media',
      status: insertComplaint.status || 'novo',
      assignedTo: insertComplaint.assignedTo || null,
      resolution: null,
      resolutionNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
      metadata: insertComplaint.metadata || null,
    };
    this.complaints.set(id, complaint);
    return complaint;
  }

  async getComplaint(id: string): Promise<Complaint | undefined> {
    return this.complaints.get(id);
  }

  async getComplaintsByConversationId(conversationId: string): Promise<Complaint[]> {
    return Array.from(this.complaints.values())
      .filter(c => c.conversationId === conversationId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getAllComplaints(): Promise<Complaint[]> {
    return Array.from(this.complaints.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getComplaintsByStatus(status: string): Promise<Complaint[]> {
    return Array.from(this.complaints.values())
      .filter(c => c.status === status)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getComplaintsBySeverity(severity: string): Promise<Complaint[]> {
    return Array.from(this.complaints.values())
      .filter(c => c.severity === severity)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async updateComplaint(id: string, updates: UpdateComplaint): Promise<Complaint | undefined> {
    const existing = this.complaints.get(id);
    if (!existing) return undefined;

    const updated: Complaint = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
      resolvedAt: (updates.status === 'resolvido' || updates.status === 'fechado') && !existing.resolvedAt
        ? new Date()
        : existing.resolvedAt,
    };
    
    this.complaints.set(id, updated);
    return updated;
  }

  // Training Sessions
  async createTrainingSession(insertSession: InsertTrainingSession): Promise<TrainingSession> {
    const id = randomUUID();
    const session: TrainingSession = {
      id,
      ...insertSession,
      status: insertSession.status || 'active',
      conversationId: insertSession.conversationId || null,
      completedBy: null,
      appliedBy: null,
      startedAt: new Date(),
      completedAt: null,
      appliedAt: null,
      notes: insertSession.notes || null,
      improvedPrompt: null,
      metadata: insertSession.metadata || null,
    };
    this.trainingSessions.set(id, session);
    return session;
  }

  async getTrainingSession(id: string): Promise<TrainingSession | undefined> {
    return this.trainingSessions.get(id);
  }

  async getAllTrainingSessions(): Promise<TrainingSession[]> {
    return Array.from(this.trainingSessions.values())
      .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0));
  }

  async getActiveTrainingSessions(): Promise<TrainingSession[]> {
    return Array.from(this.trainingSessions.values())
      .filter(s => s.status === 'active')
      .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0));
  }

  async getTrainingSessionsByStatus(status: string): Promise<TrainingSession[]> {
    return Array.from(this.trainingSessions.values())
      .filter(s => s.status === status)
      .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0));
  }

  async getTrainingSessionsByAssistant(assistantType: string): Promise<TrainingSession[]> {
    return Array.from(this.trainingSessions.values())
      .filter(s => s.assistantType === assistantType)
      .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0));
  }

  async updateTrainingSession(id: string, updates: UpdateTrainingSession): Promise<TrainingSession | undefined> {
    const existing = this.trainingSessions.get(id);
    if (!existing) return undefined;

    const updated: TrainingSession = {
      ...existing,
      ...updates,
    };
    
    this.trainingSessions.set(id, updated);
    return updated;
  }

  async completeTrainingSession(id: string, completedBy: string): Promise<TrainingSession | undefined> {
    const existing = this.trainingSessions.get(id);
    if (!existing) return undefined;

    const updated: TrainingSession = {
      ...existing,
      status: 'completed',
      completedAt: new Date(),
      completedBy,
    };
    
    this.trainingSessions.set(id, updated);
    return updated;
  }

  async applyTrainingSession(id: string, appliedBy: string, improvedPrompt: string): Promise<TrainingSession | undefined> {
    const existing = this.trainingSessions.get(id);
    if (!existing) return undefined;

    const updated: TrainingSession = {
      ...existing,
      status: 'applied',
      appliedAt: new Date(),
      appliedBy,
      improvedPrompt,
    };
    
    this.trainingSessions.set(id, updated);
    return updated;
  }

  // RAG Analytics (stub implementation - not used in MemStorage)
  async createRagAnalytics(analytics: InsertRagAnalytics): Promise<RagAnalytics> {
    const id = randomUUID();
    const ragAnalytic: RagAnalytics = {
      id,
      ...analytics,
      sources: analytics.sources || [],
      executionTime: analytics.executionTime || null,
      createdAt: new Date(),
    };
    return ragAnalytic;
  }

  async getRagAnalyticsByConversation(conversationId: string): Promise<RagAnalytics[]> {
    return [];
  }

  async getRagAnalyticsByDateRange(startDate: Date, endDate: Date): Promise<RagAnalytics[]> {
    return [];
  }

  async getRagAnalyticsSummary(startDate: Date, endDate: Date) {
    return {
      totalQueries: 0,
      successRate: 0,
      byAssistant: [],
      topQueries: []
    };
  }

  // Contacts
  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const now = new Date();
    const contact: Contact = {
      id,
      ...insertContact,
      phoneNumber: insertContact.phoneNumber,
      name: insertContact.name || null,
      document: insertContact.document || null,
      lastConversationId: insertContact.lastConversationId || null,
      lastConversationDate: insertContact.lastConversationDate || null,
      totalConversations: insertContact.totalConversations || 0,
      hasRecurringIssues: insertContact.hasRecurringIssues || false,
      status: insertContact.status || 'active',
      metadata: insertContact.metadata || null,
      createdAt: now,
      updatedAt: now,
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async getContactByPhoneNumber(phoneNumber: string): Promise<Contact | undefined> {
    return Array.from(this.contacts.values()).find(
      (contact) => contact.phoneNumber === phoneNumber
    );
  }

  async getAllContacts(): Promise<Contact[]> {
    return Array.from(this.contacts.values())
      .sort((a, b) => (b.lastConversationDate?.getTime() || 0) - (a.lastConversationDate?.getTime() || 0));
  }

  async getContactsWithFilters(params: {
    search?: string;
    status?: string;
    hasRecurringIssues?: boolean;
  }): Promise<Contact[]> {
    let contacts = Array.from(this.contacts.values());

    if (params.search) {
      const searchLower = params.search.toLowerCase();
      contacts = contacts.filter((c) =>
        c.name?.toLowerCase().includes(searchLower) ||
        c.phoneNumber.includes(params.search!) ||
        c.document?.includes(params.search!)
      );
    }

    if (params.status) {
      contacts = contacts.filter((c) => c.status === params.status);
    }

    if (params.hasRecurringIssues !== undefined) {
      contacts = contacts.filter((c) => c.hasRecurringIssues === params.hasRecurringIssues);
    }

    return contacts.sort((a, b) => (b.lastConversationDate?.getTime() || 0) - (a.lastConversationDate?.getTime() || 0));
  }

  async updateContact(id: string, updates: UpdateContact): Promise<Contact | undefined> {
    const existing = this.contacts.get(id);
    if (!existing) return undefined;

    const updated: Contact = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.contacts.set(id, updated);
    return updated;
  }

  async updateContactFromConversation(
    phoneNumber: string,
    conversationId: string,
    conversationData: {
      name?: string;
      document?: string;
      hasRecurringIssues?: boolean;
    }
  ): Promise<Contact> {
    let contact = await this.getContactByPhoneNumber(phoneNumber);

    if (!contact) {
      // Create new contact
      contact = await this.createContact({
        phoneNumber,
        name: conversationData.name || null,
        document: conversationData.document || null,
        lastConversationId: conversationId,
        lastConversationDate: new Date(),
        totalConversations: 1,
        hasRecurringIssues: conversationData.hasRecurringIssues || false,
        status: 'active',
      });
    } else {
      // Update existing contact
      const updated = await this.updateContact(contact.id, {
        name: conversationData.name || contact.name,
        document: conversationData.document || contact.document,
        lastConversationId: conversationId,
        lastConversationDate: new Date(),
        totalConversations: contact.totalConversations + 1,
        hasRecurringIssues: conversationData.hasRecurringIssues || contact.hasRecurringIssues,
        status: 'active',
      });
      contact = updated!;
    }

    return contact;
  }

  async syncContactToConversations(phoneNumber: string, updates: { name?: string; document?: string }): Promise<number> {
    const conversations = Array.from(this.conversations.values()).filter(
      conv => conv.chatId.includes(phoneNumber)
    );
    
    let updatedCount = 0;
    for (const conv of conversations) {
      const conversationUpdates: any = {};
      if (updates.name !== undefined) {
        conversationUpdates.clientName = updates.name;
      }
      if (updates.document !== undefined) {
        conversationUpdates.clientDocument = updates.document;
      }
      
      if (Object.keys(conversationUpdates).length > 0) {
        this.conversations.set(conv.id, { ...conv, ...conversationUpdates });
        updatedCount++;
      }
    }
    
    return updatedCount;
  }

  async deleteContact(id: string): Promise<void> {
    this.contacts.delete(id);
  }

  // Groups
  async createGroup(insertGroup: InsertGroup): Promise<Group> {
    const id = randomUUID();
    const now = new Date();
    const group: Group = {
      id,
      ...insertGroup,
      groupId: insertGroup.groupId,
      name: insertGroup.name,
      avatar: insertGroup.avatar || null,
      aiEnabled: insertGroup.aiEnabled ?? false,
      lastMessageTime: insertGroup.lastMessageTime || null,
      lastMessage: insertGroup.lastMessage || null,
      participantsCount: insertGroup.participantsCount || 0,
      metadata: insertGroup.metadata || null,
      createdAt: now,
      updatedAt: now,
    };
    this.groups.set(id, group);
    return group;
  }

  async getGroup(id: string): Promise<Group | undefined> {
    return this.groups.get(id);
  }

  async getGroupByGroupId(groupId: string): Promise<Group | undefined> {
    return Array.from(this.groups.values()).find(
      (group) => group.groupId === groupId
    );
  }

  async getAllGroups(): Promise<Group[]> {
    return Array.from(this.groups.values())
      .sort((a, b) => (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0));
  }

  async getGroupsWithFilters(params: {
    search?: string;
    aiEnabled?: boolean;
  }): Promise<Group[]> {
    let groups = Array.from(this.groups.values());

    if (params.search) {
      const searchLower = params.search.toLowerCase();
      groups = groups.filter((g) =>
        g.name?.toLowerCase().includes(searchLower) ||
        g.groupId?.toLowerCase().includes(searchLower)
      );
    }

    if (params.aiEnabled !== undefined) {
      groups = groups.filter((g) => g.aiEnabled === params.aiEnabled);
    }

    return groups.sort((a, b) => (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0));
  }

  async updateGroup(id: string, updates: UpdateGroup): Promise<Group | undefined> {
    const group = this.groups.get(id);
    if (!group) return undefined;

    const updated = {
      ...group,
      ...updates,
      updatedAt: new Date(),
    };
    this.groups.set(id, updated);
    return updated;
  }

  async toggleGroupAi(id: string, aiEnabled: boolean): Promise<Group | undefined> {
    const group = this.groups.get(id);
    if (!group) return undefined;

    const updated = {
      ...group,
      aiEnabled,
      updatedAt: new Date(),
    };
    this.groups.set(id, updated);
    return updated;
  }

  async deleteGroup(id: string): Promise<void> {
    this.groups.delete(id);
  }

  // Plans & Sales
  async getAllPlans(): Promise<any[]> {
    // MemStorage stub - return empty array
    return [];
  }

  async getActivePlans(): Promise<any[]> {
    // MemStorage stub - return empty array
    return [];
  }

  async getPlan(id: string): Promise<any | undefined> {
    // MemStorage stub - return undefined
    return undefined;
  }

  async addPlan(plan: any): Promise<any> {
    // MemStorage stub - just return the plan with an ID
    return { ...plan, id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), isActive: true };
  }

  async updatePlan(id: string, updates: any): Promise<any> {
    // MemStorage stub - just return the updates with id
    return { ...updates, id, updatedAt: new Date() };
  }

  async togglePlanStatus(id: string): Promise<any> {
    // MemStorage stub - just return the plan
    return { id, isActive: true };
  }

  async getAllSales(): Promise<any[]> {
    // MemStorage stub - return empty array
    return [];
  }

  async addSale(sale: any): Promise<any> {
    // MemStorage stub - just return the sale with an ID
    return { ...sale, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
  }

  async updateSaleStatus(id: string, status: string, observations?: string): Promise<any> {
    // MemStorage stub - just return the sale
    return { id, status, observations };
  }
}

import { db } from "./db";
import { eq, desc, and, or, gte, lte, lt, isNotNull, isNull, not, sql, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import { trainingSessions } from "@shared/schema";

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

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const users = await db.select().from(schema.users).where(inArray(schema.users.id, ids));
    return users;
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
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
    const results = await db.select({
      conversation: schema.conversations,
      resolvedByUser: schema.users
    })
      .from(schema.conversations)
      .leftJoin(schema.users, eq(schema.conversations.resolvedBy, schema.users.id))
      .where(
        or(
          // All active conversations (including those in transfer queue, being handled by AI, or assigned to agents)
          eq(schema.conversations.status, 'active'),
          // Resolved conversations from last 12h (by AI, agent, or auto-close)
          and(
            eq(schema.conversations.status, 'resolved'),
            isNotNull(schema.conversations.lastMessageTime),
            gte(schema.conversations.lastMessageTime, twelveHoursAgo)
          )
        )
      )
      .orderBy(desc(schema.conversations.lastMessageTime));
    
    return results.map(r => ({
      ...r.conversation,
      resolvedByName: r.resolvedByUser?.fullName || null
    })) as any;
  }

  async getTransferredConversations(userId?: string, role?: string): Promise<Conversation[]> {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
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
          gte(schema.conversations.lastMessageTime, twelveHoursAgo)
        )
      )
    ];
    
    // Get all matching conversations
    let conversations = await db.select().from(schema.conversations)
      .where(and(...conditions))
      .orderBy(desc(schema.conversations.transferredAt));
    
    // FILTER OUT "general" department conversations (still being handled by AI receptionist)
    // Keep conversations without department (null) for backward compatibility
    conversations = conversations.filter(conv => conv.department !== 'general');
    
    // DEPARTMENT-BASED FILTER: AGENTs see only their department's conversations
    if (role === 'AGENT' && userId) {
      const user = await this.getUser(userId);
      const userDepartments = user?.departments || [];
      
      // If agent has no departments configured, show all conversations (backward compatibility)
      if (userDepartments.length === 0) {
        return conversations;
      }
      
      // Filter conversations by department
      return conversations.filter(conv => {
        // If conversation has no department (legacy data), show it to all agents (backward compatibility)
        if (!conv.department) return true;
        // Show only if conversation department matches one of agent's departments
        return userDepartments.includes(conv.department);
      });
    }
    
    // ADMIN/SUPERVISOR see all conversations (except "general")
    return conversations;
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
    
    // Selecionar EXPLICITAMENTE todos os campos, incluindo vídeo
    let query = db.select({
      id: schema.messages.id,
      conversationId: schema.messages.conversationId,
      role: schema.messages.role,
      content: schema.messages.content,
      timestamp: schema.messages.timestamp,
      functionCall: schema.messages.functionCall,
      assistant: schema.messages.assistant,
      imageBase64: schema.messages.imageBase64,
      pdfBase64: schema.messages.pdfBase64,
      pdfName: schema.messages.pdfName,
      audioUrl: schema.messages.audioUrl,
      videoUrl: schema.messages.videoUrl,
      videoName: schema.messages.videoName,
      videoMimetype: schema.messages.videoMimetype,
      whatsappMessageId: schema.messages.whatsappMessageId,
      remoteJid: schema.messages.remoteJid,
      isPrivate: schema.messages.isPrivate,
      sendBy: schema.messages.sendBy,
      deletedAt: schema.messages.deletedAt,
      deletedBy: schema.messages.deletedBy,
    }).from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .$dynamic();
    
    if (options.before) {
      // Buscar a mensagem "before" para pegar seu timestamp
      const beforeMessage = await db.select({
        id: schema.messages.id,
        timestamp: schema.messages.timestamp,
      }).from(schema.messages)
        .where(eq(schema.messages.id, options.before))
        .limit(1);
      
      if (beforeMessage.length === 0 || !beforeMessage[0].timestamp) {
        return { messages: [], hasMore: false };
      }
      
      // Buscar mensagens com timestamp menor que o before
      query = query.where(
        and(
          eq(schema.messages.conversationId, conversationId),
          lt(schema.messages.timestamp, beforeMessage[0].timestamp as Date)
        )
      );
    }
    
    // Ordenar DESC e pegar limit + 1 para saber se há mais
    const messages = await query
      .orderBy(desc(schema.messages.timestamp))
      .limit(limit + 1);
    
    // Debug PDFs
    const pdfMsgs = messages.filter(m => m.pdfName);
    if (pdfMsgs.length > 0) {
      console.log(`📄 [Storage Debug] Found ${pdfMsgs.length} messages with pdfName in DB result:`, 
        pdfMsgs.map(m => ({
          id: m.id,
          pdfName: m.pdfName,
          hasPdfBase64: !!m.pdfBase64,
          pdfBase64Length: m.pdfBase64?.length || 0,
          pdfBase64Type: typeof m.pdfBase64
        }))
      );
    }
    
    const hasMore = messages.length > limit;
    const result = hasMore ? messages.slice(0, limit) : messages;
    
    // Retornar em ordem ASC (mais antigas primeiro)
    return { messages: result.reverse(), hasMore };
  }

  async createMessage(insertMsg: InsertMessage): Promise<Message> {
    const [message] = await db.insert(schema.messages).values(insertMsg).returning();
    return message;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(schema.messages)
      .where(eq(schema.messages.id, id));
    return message;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<void> {
    await db.update(schema.messages)
      .set(updates)
      .where(eq(schema.messages.id, id));
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(schema.messages).where(eq(schema.messages.id, id));
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

  async updateSatisfactionFeedback(id: string, updates: Partial<SatisfactionFeedback>): Promise<SatisfactionFeedback | undefined> {
    const [updated] = await db.update(schema.satisfactionFeedback)
      .set(updates)
      .where(eq(schema.satisfactionFeedback.id, id))
      .returning();
    return updated;
  }

  async updateSatisfactionFeedbackHandling(
    id: string, 
    updates: {
      handlingScore?: number;
      handlingStatus?: string;
      handlingNotes?: string;
      handledBy?: string;
    }
  ): Promise<SatisfactionFeedback | undefined> {
    const [updated] = await db.update(schema.satisfactionFeedback)
      .set({
        ...updates,
        handledAt: new Date()
      })
      .where(eq(schema.satisfactionFeedback.id, id))
      .returning();
    return updated;
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
      // ✅ Conta conversas com status 'active' E 'queued' para manter consistência com a página de Conversas
      // Ambos os status representam conversas em andamento atribuídas ao agente
      const activeConvs = await db.select().from(schema.conversations)
        .where(and(
          eq(schema.conversations.assignedTo, agent.id),
          inArray(schema.conversations.status, ['active', 'queued'])
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

  async getAIPerformanceMetrics(startDate?: Date, endDate?: Date) {
    // Se não fornecido, usa hoje como padrão
    const defaultStart = new Date();
    defaultStart.setHours(0, 0, 0, 0);
    
    const start = startDate || defaultStart;
    const end = endDate || new Date();

    const assistantTypes = ['apresentacao', 'comercial', 'financeiro', 'suporte', 'ouvidoria', 'cancelamento'];
    const assistantNames = {
      'apresentacao': 'LIA Apresentação',
      'comercial': 'LIA Comercial',
      'financeiro': 'LIA Financeiro',
      'suporte': 'LIA Suporte',
      'ouvidoria': 'LIA Ouvidoria',
      'cancelamento': 'LIA Cancelamento'
    };

    const metrics = await Promise.all(assistantTypes.map(async (assistantType) => {
      // Total de conversas deste assistente no período
      const allConversations = await db.select().from(schema.conversations)
        .where(and(
          eq(schema.conversations.assistantType, assistantType),
          gte(schema.conversations.createdAt, start),
          lte(schema.conversations.createdAt, end)
        ));

      const totalConversations = allConversations.length;

      // ✅ Transferências = conversas que têm data de transferência (dados históricos completos)
      const transferredToHuman = allConversations.filter(c => 
        c.transferredAt != null
      ).length;

      // ✅ Resolvidas pela IA = conversas resolvidas que NUNCA foram transferidas
      const resolvedByAI = allConversations.filter(c => 
        c.status === 'resolved' && c.transferredAt == null
      ).length;

      // 🔍 DEBUG: Log para verificar cálculos
      console.log(`📊 [AI Metrics] ${assistantType}:`, {
        total: totalConversations,
        transferred: transferredToHuman,
        resolvedByAI,
        pending: totalConversations - transferredToHuman - resolvedByAI
      });

      // Taxa de sucesso da IA (conversas que resolveu sozinha SEM transferir)
      const successRate = totalConversations > 0 
        ? Math.round((resolvedByAI / totalConversations) * 100)
        : 0;

      // Sentimento médio (apenas das resolvidas)
      const resolvedConversations = allConversations.filter(c => c.status === 'resolved');
      const conversationsWithSentiment = resolvedConversations.filter(c => c.sentiment);
      const sentimentScore = conversationsWithSentiment.reduce((sum, c) => {
        if (c.sentiment === 'positive') return sum + 1;
        if (c.sentiment === 'negative') return sum - 1;
        return sum;
      }, 0);
      const avgSentiment = conversationsWithSentiment.length > 0
        ? sentimentScore / conversationsWithSentiment.length
        : 0;

      // NPS médio deste assistente
      const feedbacks = await db.select().from(schema.satisfactionFeedback)
        .where(eq(schema.satisfactionFeedback.assistantType, assistantType));
      
      const avgNPS = feedbacks.length > 0
        ? Math.round(feedbacks.reduce((sum, f) => sum + (f.npsScore || 0), 0) / feedbacks.length)
        : 0;

      return {
        assistantType,
        assistantName: assistantNames[assistantType as keyof typeof assistantNames],
        totalConversations,
        resolvedByAI,
        transferredToHuman,
        successRate,
        avgSentiment,
        avgNPS
      };
    }));

    return metrics;
  }

  async getAdminMetrics() {
    // ✅ CACHE INTELIGENTE - Cacheia métricas por 60 segundos
    const cacheKey = 'admin:metrics:v1';
    const cached = localCache.get<any>(cacheKey, 60 * 1000); // 60 segundos
    
    if (cached) {
      console.log('📦 [Cache] Admin metrics HIT - returning cached data');
      return cached;
    }
    
    console.log('🔄 [Cache] Admin metrics MISS - calculating fresh data');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ DADOS REAIS - Status do sistema
    const { checkWorkersHealth } = await import('./lib/workers-health');
    const workersHealth = await checkWorkersHealth();
    
    const systemStatus = {
      api: true, // API está respondendo se chegou aqui
      database: true, // Database está conectado se chegou aqui
      workers: workersHealth.allHealthy
    };

    // ✅ DADOS REAIS - Custos calculados com base no uso real de tokens
    const { getUsageMetrics, getUpstashCost } = await import('./lib/openai-usage');
    const usageMetrics = await getUsageMetrics();
    const upstashCost = await getUpstashCost();
    
    const estimatedCost = {
      total: usageMetrics.total30Days.cost + upstashCost,
      openai: usageMetrics.total30Days.cost,
      upstash: upstashCost
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

    // ✅ DADOS REAIS - Eventos de segurança rastreados
    const { getSecurityStats } = await import('./lib/security-events');
    const securityStats = await getSecurityStats(30); // últimos 30 dias
    
    const securityEvents = {
      total: securityStats.total,
      failedLogins: securityStats.failedLogins
    };

    // ✅ DADOS REAIS - Mensagens diárias dos últimos 30 dias
    const dailyMessages = await this.getDailyMessagesCount();

    // ✅ DADOS REAIS - Volume vs Taxa de Sucesso (últimas 24h)
    const volumeVsSuccess = await this.calculateVolumeVsSuccess();

    const metrics = {
      systemStatus,
      estimatedCost,
      activeUsers,
      securityEvents,
      dailyMessages,
      volumeVsSuccess
    };

    // ✅ Armazena no cache por 60 segundos
    localCache.set(cacheKey, metrics, 60 * 1000); // 60 segundos em ms
    console.log('💾 [Cache] Admin metrics cached for 60s');

    return metrics;
  }

  private async getDailyMessagesCount() {
    const dailyMessages = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dateStr = date.toISOString().split('T')[0];
      
      // Buscar todas as mensagens do dia (excluindo privadas e deletadas)
      // Nota: isPrivate pode ser null (default), então tratamos null como false (pública)
      const messages = await db.select().from(schema.messages)
        .where(and(
          gte(schema.messages.timestamp, date),
          lt(schema.messages.timestamp, nextDate),
          or(
            eq(schema.messages.isPrivate, false),
            isNull(schema.messages.isPrivate)
          ),
          isNull(schema.messages.deletedAt)
        ));
      
      dailyMessages.push({
        date: dateStr,
        messages: messages.length
      });
    }
    
    return dailyMessages;
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

  // ⚠️ MOCK DATA GENERATOR - Dashboard Admin Metrics Only
  // Este método gera dados fictícios de uso de tokens para visualização no dashboard
  // NÃO afeta funcionalidades principais do sistema
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

      // Resolved conversations today - usando resolved_by para dados reais
      const resolvedToday = await db.select().from(schema.conversations)
        .where(and(
          eq(schema.conversations.resolvedBy, agent.id),
          eq(schema.conversations.status, 'resolved'),
          gte(schema.conversations.resolvedAt, today)
        ));

      // Calculate success rate baseado em conversas efetivamente resolvidas pelo agente
      const totalResolved = await db.select().from(schema.conversations)
        .where(and(
          eq(schema.conversations.resolvedBy, agent.id),
          eq(schema.conversations.status, 'resolved')
        ));
      
      const successfullyResolved = totalResolved.filter(c => 
        c.sentiment === 'positive' || c.sentiment === 'neutral'
      );
      const successRate = totalResolved.length > 0 
        ? Math.round((successfullyResolved.length / totalResolved.length) * 100)
        : 0;

      // Calculate average sentiment - baseado em conversas que o agente efetivamente resolveu
      const conversationsWithSentiment = totalResolved.filter(c => c.sentiment);
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
      // Conta conversas resolvidas: status 'resolved' OU 'awaiting_nps' OU com resolvedBy preenchido
      const resolvedConversations = convs.filter(c => 
        c.status === 'resolved' || 
        c.status === 'awaiting_nps' || 
        c.resolvedBy !== null
      ).length;
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

  // Complaints (Ouvidoria)
  async createComplaint(insertComplaint: InsertComplaint): Promise<Complaint> {
    const [complaint] = await db.insert(schema.complaints)
      .values(insertComplaint)
      .returning();
    return complaint;
  }

  async getComplaint(id: string): Promise<Complaint | undefined> {
    const [result] = await db.select({
      complaint: schema.complaints,
      clientName: schema.conversations.clientName,
      chatId: schema.conversations.chatId,
    })
      .from(schema.complaints)
      .leftJoin(schema.conversations, eq(schema.complaints.conversationId, schema.conversations.id))
      .where(eq(schema.complaints.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.complaint,
      clientName: result.clientName,
      chatId: result.chatId,
    } as Complaint;
  }

  async getComplaintsByConversationId(conversationId: string): Promise<Complaint[]> {
    const results = await db.select({
      complaint: schema.complaints,
      clientName: schema.conversations.clientName,
      chatId: schema.conversations.chatId,
    })
      .from(schema.complaints)
      .leftJoin(schema.conversations, eq(schema.complaints.conversationId, schema.conversations.id))
      .where(eq(schema.complaints.conversationId, conversationId))
      .orderBy(desc(schema.complaints.createdAt));
    
    return results.map(r => ({
      ...r.complaint,
      clientName: r.clientName,
      chatId: r.chatId,
    })) as Complaint[];
  }

  async getAllComplaints(): Promise<Complaint[]> {
    const results = await db.select({
      complaint: schema.complaints,
      clientName: schema.conversations.clientName,
      chatId: schema.conversations.chatId,
    })
      .from(schema.complaints)
      .leftJoin(schema.conversations, eq(schema.complaints.conversationId, schema.conversations.id))
      .orderBy(desc(schema.complaints.createdAt));
    
    return results.map(r => ({
      ...r.complaint,
      clientName: r.clientName,
      chatId: r.chatId,
    })) as Complaint[];
  }

  async getComplaintsByStatus(status: string): Promise<Complaint[]> {
    const results = await db.select({
      complaint: schema.complaints,
      clientName: schema.conversations.clientName,
      chatId: schema.conversations.chatId,
    })
      .from(schema.complaints)
      .leftJoin(schema.conversations, eq(schema.complaints.conversationId, schema.conversations.id))
      .where(eq(schema.complaints.status, status))
      .orderBy(desc(schema.complaints.createdAt));
    
    return results.map(r => ({
      ...r.complaint,
      clientName: r.clientName,
      chatId: r.chatId,
    })) as Complaint[];
  }

  async getComplaintsBySeverity(severity: string): Promise<Complaint[]> {
    const results = await db.select({
      complaint: schema.complaints,
      clientName: schema.conversations.clientName,
      chatId: schema.conversations.chatId,
    })
      .from(schema.complaints)
      .leftJoin(schema.conversations, eq(schema.complaints.conversationId, schema.conversations.id))
      .where(eq(schema.complaints.severity, severity))
      .orderBy(desc(schema.complaints.createdAt));
    
    return results.map(r => ({
      ...r.complaint,
      clientName: r.clientName,
      chatId: r.chatId,
    })) as Complaint[];
  }

  async updateComplaint(id: string, updates: UpdateComplaint): Promise<Complaint | undefined> {
    const autoUpdates: Partial<Complaint> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Auto-set resolvedAt when status changes to resolved or closed
    if (updates.status === 'resolvido' || updates.status === 'fechado') {
      const existing = await this.getComplaint(id);
      if (existing && !existing.resolvedAt) {
        autoUpdates.resolvedAt = new Date();
      }
    }

    const [updated] = await db.update(schema.complaints)
      .set(autoUpdates)
      .where(eq(schema.complaints.id, id))
      .returning();
    return updated;
  }

  // Training Sessions
  async createTrainingSession(insertSession: InsertTrainingSession): Promise<TrainingSession> {
    const [session] = await db.insert(trainingSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getTrainingSession(id: string): Promise<TrainingSession | undefined> {
    const [session] = await db.select()
      .from(trainingSessions)
      .where(eq(trainingSessions.id, id));
    return session;
  }

  async getAllTrainingSessions(): Promise<TrainingSession[]> {
    return await db.select()
      .from(trainingSessions)
      .orderBy(desc(trainingSessions.startedAt));
  }

  async getActiveTrainingSessions(): Promise<TrainingSession[]> {
    return await db.select()
      .from(trainingSessions)
      .where(eq(trainingSessions.status, 'active'))
      .orderBy(desc(trainingSessions.startedAt));
  }

  async getTrainingSessionsByStatus(status: string): Promise<TrainingSession[]> {
    return await db.select()
      .from(trainingSessions)
      .where(eq(trainingSessions.status, status))
      .orderBy(desc(trainingSessions.startedAt));
  }

  async getTrainingSessionsByAssistant(assistantType: string): Promise<TrainingSession[]> {
    return await db.select()
      .from(trainingSessions)
      .where(eq(trainingSessions.assistantType, assistantType))
      .orderBy(desc(trainingSessions.startedAt));
  }

  async updateTrainingSession(id: string, updates: UpdateTrainingSession): Promise<TrainingSession | undefined> {
    const [updated] = await db.update(trainingSessions)
      .set(updates)
      .where(eq(trainingSessions.id, id))
      .returning();
    return updated;
  }

  async completeTrainingSession(id: string, completedBy: string): Promise<TrainingSession | undefined> {
    const [updated] = await db.update(trainingSessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedBy,
      })
      .where(eq(trainingSessions.id, id))
      .returning();
    return updated;
  }

  async applyTrainingSession(id: string, appliedBy: string, improvedPrompt: string): Promise<TrainingSession | undefined> {
    const [updated] = await db.update(trainingSessions)
      .set({
        status: 'applied',
        appliedAt: new Date(),
        appliedBy,
        improvedPrompt,
      })
      .where(eq(trainingSessions.id, id))
      .returning();
    return updated;
  }

  // RAG Analytics
  async createRagAnalytics(insertAnalytics: InsertRagAnalytics): Promise<RagAnalytics> {
    const [analytics] = await db.insert(schema.ragAnalytics)
      .values(insertAnalytics)
      .returning();
    return analytics;
  }

  async getRagAnalyticsByConversation(conversationId: string): Promise<RagAnalytics[]> {
    return await db.select()
      .from(schema.ragAnalytics)
      .where(eq(schema.ragAnalytics.conversationId, conversationId))
      .orderBy(desc(schema.ragAnalytics.createdAt));
  }

  async getRagAnalyticsByDateRange(startDate: Date, endDate: Date): Promise<RagAnalytics[]> {
    return await db.select()
      .from(schema.ragAnalytics)
      .where(
        and(
          gte(schema.ragAnalytics.createdAt, startDate),
          lte(schema.ragAnalytics.createdAt, endDate)
        )
      )
      .orderBy(desc(schema.ragAnalytics.createdAt));
  }

  async getRagAnalyticsSummary(startDate: Date, endDate: Date) {
    const analytics = await this.getRagAnalyticsByDateRange(startDate, endDate);
    
    const totalQueries = analytics.length;
    const successfulQueries = analytics.filter(a => a.resultsFound).length;
    const successRate = totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0;

    // Group by assistant
    const byAssistantMap = new Map<string, { count: number; successful: number }>();
    analytics.forEach(a => {
      const existing = byAssistantMap.get(a.assistantType) || { count: 0, successful: 0 };
      byAssistantMap.set(a.assistantType, {
        count: existing.count + 1,
        successful: existing.successful + (a.resultsFound ? 1 : 0)
      });
    });

    const byAssistant = Array.from(byAssistantMap.entries()).map(([assistantType, data]) => ({
      assistantType,
      count: data.count,
      successRate: (data.successful / data.count) * 100
    }));

    // Top queries
    const queryCountMap = new Map<string, number>();
    analytics.forEach(a => {
      queryCountMap.set(a.query, (queryCountMap.get(a.query) || 0) + 1);
    });

    const topQueries = Array.from(queryCountMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalQueries,
      successRate,
      byAssistant,
      topQueries
    };
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Contacts
  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(schema.contacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, id));
    return contact;
  }

  async getContactByPhoneNumber(phoneNumber: string): Promise<Contact | undefined> {
    const [contact] = await db.select()
      .from(schema.contacts)
      .where(eq(schema.contacts.phoneNumber, phoneNumber));
    return contact;
  }

  async getAllContacts(): Promise<Contact[]> {
    return await db.select()
      .from(schema.contacts)
      .orderBy(desc(schema.contacts.lastConversationDate));
  }

  async getContactsWithFilters(params: {
    search?: string;
    status?: string;
    hasRecurringIssues?: boolean;
  }): Promise<Contact[]> {
    const conditions = [];

    if (params.status) {
      conditions.push(eq(schema.contacts.status, params.status));
    }

    if (params.hasRecurringIssues !== undefined) {
      conditions.push(eq(schema.contacts.hasRecurringIssues, params.hasRecurringIssues));
    }

    if (params.search) {
      const searchConditions = or(
        sql`LOWER(${schema.contacts.name}) LIKE ${`%${params.search.toLowerCase()}%`}`,
        sql`${schema.contacts.phoneNumber} LIKE ${`%${params.search}%`}`,
        sql`${schema.contacts.document} LIKE ${`%${params.search}%`}`
      );
      if (searchConditions) {
        conditions.push(searchConditions);
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await db.select()
      .from(schema.contacts)
      .where(whereClause)
      .orderBy(desc(schema.contacts.lastConversationDate));
  }

  async updateContact(id: string, updates: UpdateContact): Promise<Contact | undefined> {
    const [updated] = await db.update(schema.contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.contacts.id, id))
      .returning();
    return updated;
  }

  async updateContactFromConversation(
    phoneNumber: string,
    conversationId: string,
    conversationData: {
      name?: string;
      document?: string;
      hasRecurringIssues?: boolean;
    }
  ): Promise<Contact> {
    let contact = await this.getContactByPhoneNumber(phoneNumber);

    if (!contact) {
      // Create new contact
      contact = await this.createContact({
        phoneNumber,
        name: conversationData.name || null,
        document: conversationData.document || null,
        lastConversationId: conversationId,
        lastConversationDate: new Date(),
        totalConversations: 1,
        hasRecurringIssues: conversationData.hasRecurringIssues || false,
        status: 'active',
      });
    } else {
      // Update existing contact - increment totalConversations
      const updated = await db.update(schema.contacts)
        .set({
          name: conversationData.name || contact.name,
          document: conversationData.document || contact.document,
          lastConversationId: conversationId,
          lastConversationDate: new Date(),
          totalConversations: sql`${schema.contacts.totalConversations} + 1`,
          hasRecurringIssues: conversationData.hasRecurringIssues || contact.hasRecurringIssues,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(schema.contacts.id, contact.id))
        .returning();
      
      contact = updated[0];
    }

    return contact;
  }

  async syncContactToConversations(phoneNumber: string, updates: { name?: string; document?: string }): Promise<number> {
    const conversationUpdates: any = {};
    
    if (updates.name !== undefined) {
      conversationUpdates.clientName = updates.name;
    }
    if (updates.document !== undefined) {
      conversationUpdates.clientDocument = updates.document;
    }
    
    if (Object.keys(conversationUpdates).length === 0) {
      return 0;
    }
    
    // Update all conversations that contain this phone number
    const result = await db.update(schema.conversations)
      .set(conversationUpdates)
      .where(sql`${schema.conversations.chatId} LIKE ${'%' + phoneNumber + '%'}`)
      .returning();
    
    return result.length;
  }

  async deleteContact(id: string): Promise<void> {
    await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  }

  // Groups
  async createGroup(insertGroup: InsertGroup): Promise<Group> {
    const [group] = await db.insert(schema.groups)
      .values(insertGroup)
      .returning();
    return group;
  }

  async getGroup(id: string): Promise<Group | undefined> {
    const [group] = await db.select()
      .from(schema.groups)
      .where(eq(schema.groups.id, id));
    return group;
  }

  async getGroupByGroupId(groupId: string): Promise<Group | undefined> {
    const [group] = await db.select()
      .from(schema.groups)
      .where(eq(schema.groups.groupId, groupId));
    return group;
  }

  async getAllGroups(): Promise<Group[]> {
    return await db.select()
      .from(schema.groups)
      .orderBy(desc(schema.groups.lastMessageTime));
  }

  async getGroupsWithFilters(params: {
    search?: string;
    aiEnabled?: boolean;
  }): Promise<Group[]> {
    const conditions = [];

    if (params.aiEnabled !== undefined) {
      conditions.push(eq(schema.groups.aiEnabled, params.aiEnabled));
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          sql`${schema.groups.name} ILIKE ${searchPattern}`,
          sql`${schema.groups.groupId} ILIKE ${searchPattern}`
        )
      );
    }

    const query = conditions.length > 0
      ? db.select().from(schema.groups).where(and(...conditions))
      : db.select().from(schema.groups);

    return await query.orderBy(desc(schema.groups.lastMessageTime));
  }

  async updateGroup(id: string, updates: UpdateGroup): Promise<Group | undefined> {
    const autoUpdates: Partial<Group> = {
      ...updates,
      updatedAt: new Date(),
    };

    const [updated] = await db.update(schema.groups)
      .set(autoUpdates)
      .where(eq(schema.groups.id, id))
      .returning();
    return updated;
  }

  async toggleGroupAi(id: string, aiEnabled: boolean): Promise<Group | undefined> {
    const [updated] = await db.update(schema.groups)
      .set({
        aiEnabled,
        updatedAt: new Date(),
      })
      .where(eq(schema.groups.id, id))
      .returning();
    return updated;
  }

  async deleteGroup(id: string): Promise<void> {
    await db.delete(schema.groups).where(eq(schema.groups.id, id));
  }

  // Private Notes
  async createPrivateNote(insertNote: InsertPrivateNote): Promise<PrivateNote> {
    const [note] = await db.insert(schema.privateNotes).values(insertNote).returning();
    return note;
  }

  async getPrivateNotesByConversationId(conversationId: string): Promise<PrivateNote[]> {
    return await db.select()
      .from(schema.privateNotes)
      .where(eq(schema.privateNotes.conversationId, conversationId))
      .orderBy(desc(schema.privateNotes.createdAt));
  }

  // Plans & Sales
  async getAllPlans(): Promise<any[]> {
    return await db.select()
      .from(schema.plans)
      .orderBy(schema.plans.id);
  }

  async getActivePlans(): Promise<any[]> {
    return await db.select()
      .from(schema.plans)
      .where(eq(schema.plans.isActive, true))
      .orderBy(schema.plans.id);
  }

  async getPlan(id: string): Promise<any | undefined> {
    const [plan] = await db.select()
      .from(schema.plans)
      .where(eq(schema.plans.id, id));
    return plan;
  }

  async addPlan(plan: any): Promise<any> {
    const [created] = await db.insert(schema.plans).values({
      ...plan,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updatePlan(id: string, updates: any): Promise<any> {
    const [updated] = await db.update(schema.plans)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.plans.id, id))
      .returning();
    return updated;
  }

  async togglePlanStatus(id: string): Promise<any> {
    // Get current plan
    const plan = await this.getPlan(id);
    if (!plan) {
      throw new Error('Plan not found');
    }
    
    // Toggle status
    const [updated] = await db.update(schema.plans)
      .set({
        isActive: !plan.isActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.plans.id, id))
      .returning();
    
    return updated;
  }

  async addSale(sale: any): Promise<any> {
    const [created] = await db.insert(schema.sales).values(sale).returning();
    return created;
  }

  async getAllSales(): Promise<any[]> {
    return await db.select()
      .from(schema.sales)
      .orderBy(desc(schema.sales.createdAt));
  }

  async updateSaleStatus(id: string, status: string, observations?: string): Promise<any> {
    const updates: any = {
      status,
      updatedAt: new Date(),
    };
    
    if (observations !== undefined) {
      updates.observations = observations;
    }
    
    const [updated] = await db.update(schema.sales)
      .set(updates)
      .where(eq(schema.sales.id, id))
      .returning();
    
    return updated;
  }
}

export const storage = new DbStorage();
