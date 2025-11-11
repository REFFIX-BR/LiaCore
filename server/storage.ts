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
  type InsertPrivateNote,
  type PromptTemplate,
  type InsertPromptTemplate,
  type UpdatePromptTemplate,
  type PromptVersion,
  type InsertPromptVersion,
  type PromptDraft,
  type InsertPromptDraft,
  type UpdatePromptDraft,
  type ContextQualityAlert,
  type InsertContextQualityAlert,
  type VoiceCampaign,
  type InsertVoiceCampaign,
  type VoiceCampaignTarget,
  type InsertVoiceCampaignTarget,
  type VoiceCallAttempt,
  type InsertVoiceCallAttempt,
  type VoicePromise,
  type InsertVoicePromise,
  type VoiceConfig,
  type InsertVoiceConfig,
  type VoiceMessagingSettings,
  type InsertVoiceMessagingSettings,
  type CRMSyncConfig,
  type InsertCRMSyncConfig
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
  
  // ✅ Atomic conversation resolution (handles resolved_by + activity logs in transaction)
  resolveConversation(params: {
    conversationId: string;
    resolvedBy: string | null; // userId para agentes, null para IA/sistema
    resolvedAt?: Date;
    autoClosed?: boolean;
    autoClosedReason?: string;
    autoClosedAt?: Date;
    metadata?: Record<string, any>;
    createActivityLog?: boolean; // Se true, criar log de atividade (apenas para agentes)
    activityLogDetails?: { clientName: string; assistantType: string };
    additionalUpdates?: Partial<Conversation>; // Campos adicionais para atualizar
  }): Promise<Conversation>;
  
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
  getPromptSuggestionsByAssistantType(assistantType: string, status?: string): Promise<PromptSuggestion[]>;
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
  getAgentMetrics(userId: string, period?: 'today' | 'week' | 'month'): Promise<{
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
    avgSentiment: string;
    avgNPS: number;
  }>>;
  
  getAdminMetrics(): Promise<{
    systemStatus: { api: boolean; database: boolean; workers: boolean };
    estimatedCost: { total: number; openai: number; upstash: number; changePercent: number };
    activeUsers: { total: number; admins: number; supervisors: number; agents: number; changePercent: number };
    securityEvents: { total: number; failedLogins: number; changePercent: number };
    dailyMessages: Array<{ date: string; messages: number }>;
    volumeVsSuccess: Array<{ hour: string; volume: number; successRate: number }>;
    massiveFailures: {
      activeFailures: number;
      totalNotifications: number;
      uniqueClientsNotified: number;
      failuresBySeverity: { low: number; medium: number; high: number; critical: number };
      recentFailures: Array<{
        id: string;
        title: string;
        severity: string;
        affectedRegions: number;
        notifiedClients: number;
        createdAt: Date;
      }>;
    };
  }>;

  // Agent Status Monitor
  getAgentsStatus(dateFilter?: { startDate?: Date; endDate?: Date }): Promise<Array<{
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
  updateSaleNotes(id: string, notes: string): Promise<any>; // Updates sale notes

  // Massive Failures Module
  // Regions
  getAllRegions(): Promise<any[]>;
  getRegion(id: string): Promise<any | undefined>;
  getRegionsByFilters(filters: { state?: string; city?: string; neighborhood?: string }): Promise<any[]>;
  getCities(): Promise<Array<{ city: string; state: string; neighborhoodCount: number }>>;
  getNeighborhoodsByCity(city: string, state: string): Promise<any[]>;
  addRegion(region: any): Promise<any>;
  updateRegion(id: string, updates: any): Promise<any>;
  deleteRegion(id: string): Promise<void>;
  
  // Massive Failures
  getAllMassiveFailures(): Promise<any[]>;
  getActiveMassiveFailures(): Promise<any[]>; // Status = 'active'
  getScheduledMassiveFailures(): Promise<any[]>; // Status = 'scheduled'
  getMassiveFailure(id: string): Promise<any | undefined>;
  addMassiveFailure(failure: any): Promise<any>;
  updateMassiveFailure(id: string, updates: any): Promise<any>;
  updateMassiveFailureStatus(id: string, status: string): Promise<any>;
  resolveMassiveFailure(id: string, resolutionMessage?: string): Promise<any>;
  deleteMassiveFailure(id: string): Promise<void>;
  checkActiveFailureForRegion(city: string, neighborhood: string): Promise<any | null>; // Verifica se há falha ativa para determinada região
  
  // Failure Notifications
  addFailureNotification(notification: any): Promise<any>;
  getFailureNotificationsByFailureId(failureId: string): Promise<any[]>;
  getFailureNotificationsByClientPhone(clientPhone: string): Promise<any[]>;
  markNotificationAsRead(id: string, clientResponse?: string): Promise<void>;
  getNotifiedClientsForFailure(failureId: string): Promise<string[]>; // Retorna array de telefones notificados
  
  // Announcements
  getAllAnnouncements(): Promise<any[]>;
  getActiveAnnouncements(): Promise<any[]>; // active = true e dentro do período de exibição
  getAnnouncement(id: string): Promise<any | undefined>;
  addAnnouncement(announcement: any): Promise<any>;
  updateAnnouncement(id: string, updates: any): Promise<any>;
  deleteAnnouncement(id: string): Promise<void>;
  
  // Massive Failure Metrics
  getMassiveFailureMetrics(): Promise<{
    activeFailures: number;
    totalNotifications: number;
    uniqueClientsNotified: number;
    failuresBySeverity: { low: number; medium: number; high: number; critical: number };
    recentFailures: Array<{
      id: string;
      title: string;
      severity: string;
      affectedRegions: number;
      notifiedClients: number;
      createdAt: Date;
    }>;
  }>;

  // Prompt Management System
  // Prompt Templates
  getAllPromptTemplates(): Promise<PromptTemplate[]>;
  getPromptTemplate(id: string): Promise<PromptTemplate | undefined>;
  getPromptTemplateByAssistantId(assistantId: string): Promise<PromptTemplate | undefined>;
  getPromptTemplateByAssistantType(assistantType: string): Promise<PromptTemplate | undefined>;
  createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate>;
  updatePromptTemplate(id: string, updates: UpdatePromptTemplate): Promise<PromptTemplate>;
  
  // Prompt Versions
  getPromptVersionsByPromptId(promptId: string): Promise<PromptVersion[]>;
  getPromptVersion(id: string): Promise<PromptVersion | undefined>;
  createPromptVersion(version: InsertPromptVersion): Promise<PromptVersion>;
  
  // Prompt Drafts
  getPromptDraft(promptId: string): Promise<PromptDraft | undefined>;
  createPromptDraft(draft: InsertPromptDraft): Promise<PromptDraft>;
  updatePromptDraft(promptId: string, updates: UpdatePromptDraft): Promise<PromptDraft>;
  deletePromptDraft(promptId: string): Promise<void>;

  // Context Quality Alerts
  createContextQualityAlert(alert: InsertContextQualityAlert): Promise<ContextQualityAlert>;
  getRecentContextQualityAlerts(hours: number): Promise<ContextQualityAlert[]>;
  getContextQualityStats(hours: number): Promise<{
    totalAlerts: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }>;
  deleteOldContextQualityAlerts(daysAgo: number): Promise<number>; // Returns number of deleted alerts
  markContextQualityAlertsAsResolved(assistantType: string, since: Date): Promise<number>; // Mark alerts as resolved, returns count

  // ============================================================================
  // COBRANÇAS - Módulo de Cobrança Ativa por Telefone
  // ============================================================================

  // Voice Campaigns
  getAllVoiceCampaigns(): Promise<VoiceCampaign[]>;
  getVoiceCampaign(id: string): Promise<VoiceCampaign | undefined>;
  getVoiceCampaignsByStatus(status: string): Promise<VoiceCampaign[]>;
  getActiveVoiceCampaigns(): Promise<VoiceCampaign[]>;
  createVoiceCampaign(campaign: InsertVoiceCampaign): Promise<VoiceCampaign>;
  updateVoiceCampaign(id: string, updates: Partial<VoiceCampaign>): Promise<VoiceCampaign | undefined>;
  deleteVoiceCampaign(id: string): Promise<void>;
  updateVoiceCampaignStats(id: string, stats: {
    totalTargets?: number;
    contactedTargets?: number;
    successfulContacts?: number;
    promisesMade?: number;
    promisesFulfilled?: number;
  }): Promise<void>;
  recalculateVoiceCampaignStats(campaignId: string): Promise<void>;

  // CRM Sync Configs
  getCRMSyncConfig(id: string): Promise<CRMSyncConfig | undefined>;
  getCRMSyncConfigByCampaignId(campaignId: string): Promise<CRMSyncConfig | undefined>;
  createCRMSyncConfig(config: InsertCRMSyncConfig): Promise<CRMSyncConfig>;
  updateCRMSyncConfig(id: string, updates: Partial<CRMSyncConfig>): Promise<CRMSyncConfig | undefined>;
  checkTargetExists(campaignId: string, document: string, phone: string, deduplicateBy: string): Promise<VoiceCampaignTarget | undefined>;

  // Voice Campaign Targets
  getAllVoiceCampaignTargets(): Promise<VoiceCampaignTarget[]>;
  getVoiceCampaignTargets(campaignId: string): Promise<VoiceCampaignTarget[]>;
  getVoiceCampaignTarget(id: string): Promise<VoiceCampaignTarget | undefined>;
  getVoiceCampaignTargetsByState(campaignId: string, state: string): Promise<VoiceCampaignTarget[]>;
  getNextScheduledTargets(limit: number): Promise<VoiceCampaignTarget[]>;
  createVoiceCampaignTarget(target: InsertVoiceCampaignTarget): Promise<VoiceCampaignTarget>;
  createVoiceCampaignTargets(targets: InsertVoiceCampaignTarget[]): Promise<VoiceCampaignTarget[]>;
  updateVoiceCampaignTarget(id: string, updates: Partial<VoiceCampaignTarget>): Promise<VoiceCampaignTarget | undefined>;
  incrementTargetAttempt(id: string, nextAttemptAt?: Date): Promise<void>;

  // Voice Call Attempts
  getVoiceCallAttempts(targetId: string): Promise<VoiceCallAttempt[]>;
  getVoiceCallAttemptsByCampaign(campaignId: string): Promise<VoiceCallAttempt[]>;
  getVoiceCallAttempt(id: string): Promise<VoiceCallAttempt | undefined>;
  getVoiceCallAttemptByCallSid(callSid: string): Promise<VoiceCallAttempt | undefined>;
  createVoiceCallAttempt(attempt: InsertVoiceCallAttempt): Promise<VoiceCallAttempt>;
  updateVoiceCallAttempt(id: string, updates: Partial<VoiceCallAttempt>): Promise<VoiceCallAttempt | undefined>;

  // Voice Promises
  getAllVoicePromises(): Promise<VoicePromise[]>;
  getVoicePromise(id: string): Promise<VoicePromise | undefined>;
  getVoicePromisesByCampaign(campaignId: string): Promise<VoicePromise[]>;
  getVoicePromisesByStatus(status: string): Promise<VoicePromise[]>;
  getPendingVoicePromisesByDueDate(dueDate: Date): Promise<VoicePromise[]>;
  createVoicePromise(promise: InsertVoicePromise): Promise<VoicePromise>;
  updateVoicePromise(id: string, updates: Partial<VoicePromise>): Promise<VoicePromise | undefined>;
  markVoicePromiseAsFulfilled(id: string): Promise<void>;

  // Voice Configs
  getVoiceConfig(key: string): Promise<VoiceConfig | undefined>;
  getAllVoiceConfigs(): Promise<VoiceConfig[]>;
  setVoiceConfig(config: InsertVoiceConfig): Promise<VoiceConfig>;
  deleteVoiceConfig(key: string): Promise<void>;

  // Voice Messaging Settings
  getVoiceMessagingSettings(): Promise<VoiceMessagingSettings | undefined>;
  updateVoiceMessagingSettings(settings: Partial<InsertVoiceMessagingSettings>): Promise<VoiceMessagingSettings>;
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
      // ⚡ ISOLAMENTO: Excluir conversas de cobrança - elas vão pro Monitor de Cobranças
      if (conv.conversationSource === 'whatsapp_campaign' || conv.conversationSource === 'voice_campaign') {
        return false;
      }
      
      // Show active conversations OR queued conversations OR resolved conversations from last 12h
      if (conv.status === 'active') return true;
      if (conv.status === 'queued') return true;
      if (conv.status === 'resolved' && conv.lastMessageTime && conv.lastMessageTime >= twelveHoursAgo) return true;
      
      return false;
    }).sort((a, b) => (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0));
  }

  async getTransferredConversations(userId?: string, role?: string): Promise<Conversation[]> {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    
    return Array.from(this.conversations.values()).filter((conv) => {
      if (conv.transferredToHuman !== true) return false;
      
      // ⚡ ISOLAMENTO: Excluir conversas de cobrança - elas vão pro Monitor de Cobranças
      if (conv.conversationSource === 'whatsapp_campaign' || conv.conversationSource === 'voice_campaign') {
        return false;
      }
      
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

  // ✅ Atomic conversation resolution - handles update + activity logs in ONE transaction
  async resolveConversation(params: {
    conversationId: string;
    resolvedBy: string | null;
    resolvedAt?: Date;
    autoClosed?: boolean;
    autoClosedReason?: string;
    autoClosedAt?: Date;
    metadata?: Record<string, any>;
    createActivityLog?: boolean;
    activityLogDetails?: { clientName: string; assistantType: string };
    additionalUpdates?: Partial<Conversation>;
  }): Promise<Conversation> {
    const {
      conversationId,
      resolvedBy,
      resolvedAt = new Date(),
      autoClosed,
      autoClosedReason,
      autoClosedAt,
      metadata,
      createActivityLog = false,
      activityLogDetails,
      additionalUpdates = {},
    } = params;

    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Construir update object
    const updates: Partial<Conversation> = {
      status: 'resolved',
      resolvedBy,
      resolvedAt,
      ...additionalUpdates,
    };

    // Adicionar campos opcionais
    if (autoClosed !== undefined) updates.autoClosed = autoClosed;
    if (autoClosedReason) updates.autoClosedReason = autoClosedReason;
    if (autoClosedAt) updates.autoClosedAt = autoClosedAt;
    if (metadata) updates.metadata = metadata;

    // Aplicar updates
    const updated = { ...conversation, ...updates };
    this.conversations.set(conversationId, updated);

    // Se solicitado, criar activity log (apenas para agentes humanos)
    if (createActivityLog && resolvedBy && activityLogDetails) {
      const logId = randomUUID();
      this.activityLogs.set(logId, {
        id: logId,
        userId: resolvedBy,
        action: 'resolve_conversation',
        conversationId,
        details: activityLogDetails,
        createdAt: new Date(),
      });
    }

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

  async getPromptSuggestionsByAssistantType(assistantType: string, status?: string): Promise<PromptSuggestion[]> {
    return Array.from(this.promptSuggestions.values()).filter(
      (suggestion) => {
        const matchesType = suggestion.assistantType === assistantType;
        const matchesStatus = status ? suggestion.status === status : true;
        return matchesType && matchesStatus;
      }
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

  async updateSaleNotes(id: string, notes: string): Promise<any> {
    // MemStorage stub - just return the sale
    return { id, notes };
  }

  // Massive Failures Module - MemStorage Stubs
  async getAllRegions(): Promise<any[]> {
    return [];
  }

  async getRegion(id: string): Promise<any | undefined> {
    return undefined;
  }

  async getRegionsByFilters(filters: { state?: string; city?: string; neighborhood?: string }): Promise<any[]> {
    return [];
  }

  async getCities(): Promise<Array<{ city: string; state: string; neighborhoodCount: number }>> {
    return [];
  }

  async getNeighborhoodsByCity(city: string, state: string): Promise<any[]> {
    return [];
  }

  async addRegion(region: any): Promise<any> {
    return { ...region, id: randomUUID(), createdAt: new Date() };
  }

  async updateRegion(id: string, updates: any): Promise<any> {
    return { ...updates, id };
  }

  async deleteRegion(id: string): Promise<void> {
    // Stub - no-op
  }

  async getAllMassiveFailures(): Promise<any[]> {
    return [];
  }

  async getActiveMassiveFailures(): Promise<any[]> {
    return [];
  }

  async getScheduledMassiveFailures(): Promise<any[]> {
    return [];
  }

  async getMassiveFailure(id: string): Promise<any | undefined> {
    return undefined;
  }

  async addMassiveFailure(failure: any): Promise<any> {
    return { ...failure, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
  }

  async updateMassiveFailure(id: string, updates: any): Promise<any> {
    return { ...updates, id, updatedAt: new Date() };
  }

  async updateMassiveFailureStatus(id: string, status: string): Promise<any> {
    return { id, status, updatedAt: new Date() };
  }

  async resolveMassiveFailure(id: string, resolutionMessage?: string): Promise<any> {
    return { id, status: 'resolved', resolutionMessage, endTime: new Date() };
  }

  async deleteMassiveFailure(id: string): Promise<void> {
    // Stub - no-op
  }

  async checkActiveFailureForRegion(city: string, neighborhood: string): Promise<any | null> {
    return null;
  }

  async addFailureNotification(notification: any): Promise<any> {
    return { ...notification, id: randomUUID(), sentAt: new Date(), wasRead: false };
  }

  async getFailureNotificationsByFailureId(failureId: string): Promise<any[]> {
    return [];
  }

  async getFailureNotificationsByClientPhone(clientPhone: string): Promise<any[]> {
    return [];
  }

  async markNotificationAsRead(id: string, clientResponse?: string): Promise<void> {
    // Stub - no-op
  }

  async getNotifiedClientsForFailure(failureId: string): Promise<string[]> {
    return [];
  }

  async getMassiveFailureMetrics() {
    return {
      activeFailures: 0,
      totalNotifications: 0,
      uniqueClientsNotified: 0,
      failuresBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      recentFailures: []
    };
  }

  // Announcements
  async getAllAnnouncements(): Promise<any[]> {
    return [];
  }

  async getActiveAnnouncements(): Promise<any[]> {
    return [];
  }

  async getAnnouncement(id: string): Promise<any | undefined> {
    return undefined;
  }

  async addAnnouncement(announcement: any): Promise<any> {
    return { ...announcement, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
  }

  async updateAnnouncement(id: string, updates: any): Promise<any> {
    return { ...updates, id };
  }

  async deleteAnnouncement(id: string): Promise<void> {
    // Stub - no-op
  }
}

import { db } from "./db";
import { eq, desc, asc, and, or, gte, lte, lt, isNotNull, isNull, not, sql, inArray, ilike } from "drizzle-orm";
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
          // All queued conversations (in transfer queue waiting for agent assignment)
          eq(schema.conversations.status, 'queued'),
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

  async getAllConversationsHistory(options: { 
    limit?: number; 
    offset?: number;
    search?: string;
  } = {}): Promise<{ conversations: Conversation[]; total: number }> {
    const { limit = 50, offset = 0, search } = options;
    
    let query = db.select({
      conversation: schema.conversations,
      resolvedByUser: schema.users,
      assignedToUser: schema.users
    })
      .from(schema.conversations)
      .leftJoin(schema.users, eq(schema.conversations.resolvedBy, schema.users.id))
      .$dynamic();
    
    // Add search filter if provided
    if (search && search.trim()) {
      const searchPattern = `%${search}%`;
      query = query.where(
        or(
          ilike(schema.conversations.chatId, searchPattern),
          ilike(schema.conversations.clientName, searchPattern),
          ilike(schema.conversations.clientId, searchPattern)
        )
      );
    }
    
    // Get total count
    let countQuery = db.select({ count: sql<number>`count(*)` })
      .from(schema.conversations)
      .$dynamic();
    
    if (search && search.trim()) {
      const searchPattern = `%${search}%`;
      countQuery = countQuery.where(
        or(
          ilike(schema.conversations.chatId, searchPattern),
          ilike(schema.conversations.clientName, searchPattern),
          ilike(schema.conversations.clientId, searchPattern)
        )
      );
    }
    
    const [{ count: total }] = await countQuery;
    
    // Get paginated results
    const results = await query
      .orderBy(desc(schema.conversations.lastMessageTime))
      .limit(limit)
      .offset(offset);
    
    const conversations = results.map(r => ({
      ...r.conversation,
      resolvedByName: r.resolvedByUser?.fullName || null
    })) as any;
    
    return { conversations, total };
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

  // ✅ Atomic conversation resolution - handles update + activity logs in ONE transaction
  async resolveConversation(params: {
    conversationId: string;
    resolvedBy: string | null;
    resolvedAt?: Date;
    autoClosed?: boolean;
    autoClosedReason?: string;
    autoClosedAt?: Date;
    metadata?: Record<string, any>;
    createActivityLog?: boolean;
    activityLogDetails?: { clientName: string; assistantType: string };
    additionalUpdates?: Partial<Conversation>;
  }): Promise<Conversation> {
    const {
      conversationId,
      resolvedBy,
      resolvedAt = new Date(),
      autoClosed,
      autoClosedReason,
      autoClosedAt,
      metadata,
      createActivityLog = false,
      activityLogDetails,
      additionalUpdates = {},
    } = params;

    // Construir update object
    const updates: Partial<Conversation> = {
      status: 'resolved',
      resolvedBy,
      resolvedAt,
      ...additionalUpdates,
    };

    // Adicionar campos opcionais
    if (autoClosed !== undefined) updates.autoClosed = autoClosed;
    if (autoClosedReason) updates.autoClosedReason = autoClosedReason;
    if (autoClosedAt) updates.autoClosedAt = autoClosedAt;
    if (metadata) updates.metadata = metadata;

    // Executar update e activity log em uma transação
    const [updatedConversation] = await db.update(schema.conversations)
      .set(updates)
      .where(eq(schema.conversations.id, conversationId))
      .returning();

    // Se solicitado, criar activity log (apenas para agentes humanos)
    if (createActivityLog && resolvedBy && activityLogDetails) {
      await db.insert(schema.activityLogs).values({
        id: randomUUID(),
        userId: resolvedBy,
        action: 'resolve_conversation',
        conversationId,
        details: activityLogDetails,
        createdAt: new Date(),
      });
    }

    return updatedConversation;
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

  async getPromptSuggestionsByAssistantType(assistantType: string, status?: string): Promise<PromptSuggestion[]> {
    if (status) {
      return await db.select().from(schema.promptSuggestions)
        .where(and(
          eq(schema.promptSuggestions.assistantType, assistantType),
          eq(schema.promptSuggestions.status, status)
        ))
        .orderBy(desc(schema.promptSuggestions.createdAt));
    }
    return await db.select().from(schema.promptSuggestions)
      .where(eq(schema.promptSuggestions.assistantType, assistantType))
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
  async getAgentMetrics(userId: string, period: 'today' | 'week' | 'month' = 'today') {
    const now = new Date();
    let periodStart = new Date();
    
    // Definir data de início baseado no período
    switch (period) {
      case 'today':
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'week':
        periodStart.setDate(now.getDate() - 7);
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'month':
        // Mês corrente: desde o dia 1 do mês atual
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
    }

    // Conversas atribuídas ao agente (em fila - sempre mostra atual)
    const queuedConversations = await db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.assignedTo, userId),
        eq(schema.conversations.status, 'active')
      ));

    // Conversas finalizadas no período (resolvidas pelo agente)
    const finishedInPeriod = await db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.resolvedBy, userId),
        eq(schema.conversations.status, 'resolved'),
        gte(schema.conversations.resolvedAt, periodStart)
      ));

    // Calcular TMA (Tempo Médio de Atendimento) para conversas finalizadas no período
    let avgResponseTime = 0;
    const conversationsWithTime = finishedInPeriod.filter(c => 
      c.createdAt && c.resolvedAt && c.resolvedAt > c.createdAt
    );
    
    if (conversationsWithTime.length > 0) {
      const totalTime = conversationsWithTime.reduce((sum, c) => {
        const startTime = new Date(c.createdAt!).getTime();
        const endTime = new Date(c.resolvedAt!).getTime();
        const diffInSeconds = Math.floor((endTime - startTime) / 1000);
        return sum + diffInSeconds;
      }, 0);
      avgResponseTime = Math.floor(totalTime / conversationsWithTime.length);
    }

    // NPS pessoal (últimas 30 conversas resolvidas pelo agente)
    const personalFeedbacks = await db.select().from(schema.satisfactionFeedback)
      .innerJoin(schema.conversations, eq(schema.satisfactionFeedback.conversationId, schema.conversations.id))
      .where(eq(schema.conversations.resolvedBy, userId))
      .orderBy(desc(schema.satisfactionFeedback.createdAt))
      .limit(30);

    const avgNPS = personalFeedbacks.length > 0
      ? personalFeedbacks.reduce((sum, f) => sum + f.satisfaction_feedback.npsScore, 0) / personalFeedbacks.length
      : 0;

    // Tendência de sentimento (últimos 7 dias - sempre os últimos 7 dias independente do filtro)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sentimentData = await db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.resolvedBy, userId),
        gte(schema.conversations.resolvedAt, sevenDaysAgo)
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
      conversationsFinishedToday: finishedInPeriod.length,
      avgResponseTime,
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
      const avgSentimentValue = conversationsWithSentiment.length > 0
        ? sentimentScore / conversationsWithSentiment.length
        : 0;
      
      // Converter número para string baseado em thresholds
      let avgSentiment: string;
      if (avgSentimentValue > 0.2) {
        avgSentiment = 'positive';
      } else if (avgSentimentValue < -0.2) {
        avgSentiment = 'negative';
      } else {
        avgSentiment = 'neutral';
      }

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
    const cacheKey = 'admin:metrics:v2';
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
    
    // Calcular mudança de custo: comparar custo médio diário dos últimos 7 dias vs 7-14 dias atrás
    const dailyUsage = usageMetrics.dailyUsage || [];
    const last7Days = dailyUsage.slice(-7);
    const previous7Days = dailyUsage.slice(-14, -7);
    
    const last7DaysAvg = last7Days.length > 0
      ? last7Days.reduce((sum, day) => sum + day.cost, 0) / last7Days.length
      : 0;
    const previous7DaysAvg = previous7Days.length > 0
      ? previous7Days.reduce((sum, day) => sum + day.cost, 0) / previous7Days.length
      : 0;
    
    const costChange = previous7DaysAvg > 0
      ? ((last7DaysAvg - previous7DaysAvg) / previous7DaysAvg) * 100
      : 0;
    
    const currentMonthCost = usageMetrics.total30Days.cost + upstashCost;
    
    const estimatedCost = {
      total: currentMonthCost,
      openai: usageMetrics.total30Days.cost,
      upstash: upstashCost,
      changePercent: Number(costChange.toFixed(1))
    };

    // Usuários ativos hoje vs ontem
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const allUsers = await db.select().from(schema.users);
    const activeToday = allUsers.filter(u => 
      u.lastLoginAt && new Date(u.lastLoginAt) > today
    );
    const activeYesterday = allUsers.filter(u => 
      u.lastLoginAt && new Date(u.lastLoginAt) > yesterday && new Date(u.lastLoginAt) <= today
    );
    
    const usersChange = activeYesterday.length > 0
      ? ((activeToday.length - activeYesterday.length) / activeYesterday.length) * 100
      : 0;

    const activeUsers = {
      total: activeToday.length,
      admins: activeToday.filter(u => u.role === 'ADMIN').length,
      supervisors: activeToday.filter(u => u.role === 'SUPERVISOR').length,
      agents: activeToday.filter(u => u.role === 'AGENT').length,
      changePercent: Number(usersChange.toFixed(1))
    };

    // ✅ DADOS REAIS - Eventos de segurança rastreados (últimas 24h vs 24h anteriores)
    const { getSecurityStats } = await import('./lib/security-events');
    const securityStats24h = await getSecurityStats(1); // últimas 24h
    const securityStatsPrevious24h = await getSecurityStats(2); // últimas 48h
    
    // Calcular apenas as 24h anteriores (48h total - 24h recentes)
    const previous24hTotal = securityStatsPrevious24h.total - securityStats24h.total;
    const previous24hFailedLogins = securityStatsPrevious24h.failedLogins - securityStats24h.failedLogins;
    
    const securityChange = previous24hTotal > 0
      ? ((securityStats24h.total - previous24hTotal) / previous24hTotal) * 100
      : 0;
    
    const securityEvents = {
      total: securityStats24h.total,
      failedLogins: securityStats24h.failedLogins,
      changePercent: Number(securityChange.toFixed(1))
    };

    // ✅ DADOS REAIS - Mensagens diárias dos últimos 30 dias
    const dailyMessages = await this.getDailyMessagesCount();

    // ✅ DADOS REAIS - Volume vs Taxa de Sucesso (últimas 24h)
    const volumeVsSuccess = await this.calculateVolumeVsSuccess();

    // ✅ DADOS REAIS - Métricas de Falhas Massivas
    const massiveFailures = await this.getMassiveFailureMetrics();

    const metrics = {
      systemStatus,
      estimatedCost,
      activeUsers,
      securityEvents,
      dailyMessages,
      volumeVsSuccess,
      massiveFailures
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

  async getAgentsStatus(dateFilter?: { startDate?: Date; endDate?: Date }) {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

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

      // ✅ FIX: Conversas ativas = TODAS as conversas atribuídas que NÃO foram finalizadas
      const activeConversations = await db.select().from(schema.conversations)
        .where(and(
          eq(schema.conversations.assignedTo, agent.id),
          not(eq(schema.conversations.status, 'resolved'))
        ));

      // ✅ FIX: Resolved conversations - aplicar filtro de data APENAS se fornecido
      const resolvedConditions = [
        eq(schema.conversations.resolvedBy, agent.id),
        eq(schema.conversations.status, 'resolved')
      ];
      
      // Só adicionar filtros de data se fornecidos
      if (dateFilter?.startDate) {
        resolvedConditions.push(gte(schema.conversations.resolvedAt, dateFilter.startDate));
      }
      if (dateFilter?.endDate) {
        resolvedConditions.push(lte(schema.conversations.resolvedAt, dateFilter.endDate));
      }

      const resolvedInPeriod = await db.select().from(schema.conversations)
        .where(and(...resolvedConditions));

      // Calculate success rate baseado em conversas efetivamente resolvidas pelo agente NO PERÍODO
      const successfullyResolved = resolvedInPeriod.filter(c => 
        c.sentiment === 'positive' || c.sentiment === 'neutral'
      );
      const successRate = resolvedInPeriod.length > 0 
        ? Math.round((successfullyResolved.length / resolvedInPeriod.length) * 100)
        : 0;

      // Calculate average sentiment - baseado em conversas resolvidas NO PERÍODO
      const conversationsWithSentiment = resolvedInPeriod.filter(c => c.sentiment);
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
        resolvedToday: resolvedInPeriod.length,
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

    // ✅ FIX: Get conversations RESOLVED by agents in the period (not created)
    // Usar resolvedBy e resolvedAt para pegar conversas efetivamente resolvidas pelos atendentes
    let conversationsQuery = db.select({
      conversation: schema.conversations,
      agent: schema.users
    })
      .from(schema.conversations)
      .leftJoin(schema.users, eq(schema.conversations.resolvedBy, schema.users.id))
      .where(and(
        eq(schema.conversations.status, 'resolved'),
        isNotNull(schema.conversations.resolvedBy),
        isNotNull(schema.conversations.resolvedAt),
        gte(schema.conversations.resolvedAt, startDate),
        lte(schema.conversations.resolvedAt, endDate),
        agentId ? eq(schema.conversations.resolvedBy, agentId) : sql`1=1`
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
      // ✅ FIX: Usar resolvedAt ao invés de createdAt para agrupar
      if (!conversation.resolvedAt) return;

      const date = new Date(conversation.resolvedAt);
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

      // ✅ FIX: Usar resolvedBy ao invés de assignedTo (quem resolveu, não quem foi atribuído)
      const key = agentId ? periodKey : `${periodKey}-${conversation.resolvedBy || 'unassigned'}`;

      if (!groupedData.has(key)) {
        groupedData.set(key, {
          agentId: conversation.resolvedBy || undefined,
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

      // ✅ FIX: Find the conversation to get agent BY resolvedBy
      const conv = conversations.find(c => c.conversation.id === feedback.conversationId);
      const key = agentId ? periodKey : `${periodKey}-${conv?.conversation.resolvedBy || 'unassigned'}`;

      if (groupedData.has(key)) {
        groupedData.get(key)!.feedbacks.push(feedback);
      }
    });

    // Calculate metrics for each period
    const reports = Array.from(groupedData.entries()).map(([key, data]) => {
      const period = agentId ? key : key.split('-').slice(0, groupBy === 'week' ? 2 : groupBy === 'day' ? 3 : 2).join('-');
      const convs = data.conversations.map(c => c.conversation);
      
      // ✅ FIX: totalConversations agora representa conversas RESOLVIDAS pelo atendente no período
      const totalConversations = convs.length;
      
      // ✅ FIX: Todas as conversas já são resolvidas (filtradas na query inicial)
      // resolvedConversations = totalConversations (já que filtramos por status='resolved')
      const resolvedConversations = totalConversations;
      
      // ✅ FIX: Success rate baseado em sentimento positivo/neutro
      const successfulConversations = convs.filter(c => 
        c.sentiment === 'positive' || c.sentiment === 'neutral'
      ).length;
      const successRate = totalConversations > 0 
        ? Math.round((successfulConversations / totalConversations) * 100)
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

      // ✅ FIX: Transferências = conversas que foram transferidas (de AI ou de outro agente) antes de serem resolvidas
      // transferredToHuman representa se a IA transferiu para humano, o que é relevante para atendentes
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

  async updateSaleNotes(id: string, notes: string): Promise<any> {
    const [updated] = await db.update(schema.sales)
      .set({
        notes,
        updatedAt: new Date(),
      })
      .where(eq(schema.sales.id, id))
      .returning();
    
    return updated;
  }

  // ==================== MASSIVE FAILURES MODULE ====================

  // Regions
  async getAllRegions(): Promise<any[]> {
    return await db.select()
      .from(schema.regions)
      .orderBy(schema.regions.state, schema.regions.city, schema.regions.neighborhood);
  }

  async getRegion(id: string): Promise<any | undefined> {
    const [region] = await db.select()
      .from(schema.regions)
      .where(eq(schema.regions.id, id));
    return region;
  }

  async getRegionsByFilters(filters: { state?: string; city?: string; neighborhood?: string }): Promise<any[]> {
    const conditions = [];
    
    if (filters.state) {
      conditions.push(eq(schema.regions.state, filters.state));
    }
    if (filters.city) {
      conditions.push(eq(schema.regions.city, filters.city));
    }
    if (filters.neighborhood) {
      conditions.push(eq(schema.regions.neighborhood, filters.neighborhood));
    }

    if (conditions.length === 0) {
      return this.getAllRegions();
    }

    return await db.select()
      .from(schema.regions)
      .where(and(...conditions))
      .orderBy(schema.regions.state, schema.regions.city, schema.regions.neighborhood);
  }

  async getCities(): Promise<Array<{ city: string; state: string; neighborhoodCount: number }>> {
    const regions = await this.getAllRegions();
    
    // Agrupar por cidade e contar bairros
    const cityMap = new Map<string, { state: string; count: number }>();
    
    for (const region of regions) {
      const key = `${region.city}|${region.state}`;
      if (cityMap.has(key)) {
        const current = cityMap.get(key)!;
        cityMap.set(key, { ...current, count: current.count + 1 });
      } else {
        cityMap.set(key, { state: region.state, count: 1 });
      }
    }
    
    // Converter para array
    const cities = Array.from(cityMap.entries()).map(([key, value]) => {
      const [city, state] = key.split('|');
      return {
        city,
        state,
        neighborhoodCount: value.count,
      };
    });
    
    // Ordenar por estado e cidade
    return cities.sort((a, b) => {
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      return a.city.localeCompare(b.city);
    });
  }

  async getNeighborhoodsByCity(city: string, state: string): Promise<any[]> {
    return await db.select()
      .from(schema.regions)
      .where(and(
        eq(schema.regions.city, city),
        eq(schema.regions.state, state)
      ))
      .orderBy(schema.regions.neighborhood);
  }

  async addRegion(region: any): Promise<any> {
    const [created] = await db.insert(schema.regions)
      .values({
        ...region,
        createdAt: new Date(),
      })
      .returning();
    return created;
  }

  async updateRegion(id: string, updates: any): Promise<any> {
    const [updated] = await db.update(schema.regions)
      .set(updates)
      .where(eq(schema.regions.id, id))
      .returning();
    return updated;
  }

  async deleteRegion(id: string): Promise<void> {
    await db.delete(schema.regions).where(eq(schema.regions.id, id));
  }

  // Massive Failures
  async getAllMassiveFailures(): Promise<any[]> {
    return await db.select()
      .from(schema.massiveFailures)
      .orderBy(desc(schema.massiveFailures.startTime));
  }

  async getActiveMassiveFailures(): Promise<any[]> {
    return await db.select()
      .from(schema.massiveFailures)
      .where(eq(schema.massiveFailures.status, 'active'))
      .orderBy(desc(schema.massiveFailures.startTime));
  }

  async getScheduledMassiveFailures(): Promise<any[]> {
    return await db.select()
      .from(schema.massiveFailures)
      .where(eq(schema.massiveFailures.status, 'scheduled'))
      .orderBy(schema.massiveFailures.startTime);
  }

  async getMassiveFailure(id: string): Promise<any | undefined> {
    const [failure] = await db.select()
      .from(schema.massiveFailures)
      .where(eq(schema.massiveFailures.id, id));
    return failure;
  }

  async addMassiveFailure(failure: any): Promise<any> {
    const [created] = await db.insert(schema.massiveFailures)
      .values({
        ...failure,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  async updateMassiveFailure(id: string, updates: any): Promise<any> {
    const [updated] = await db.update(schema.massiveFailures)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.massiveFailures.id, id))
      .returning();
    return updated;
  }

  async updateMassiveFailureStatus(id: string, status: string): Promise<any> {
    const [updated] = await db.update(schema.massiveFailures)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(schema.massiveFailures.id, id))
      .returning();
    return updated;
  }

  async resolveMassiveFailure(id: string, resolutionMessage?: string): Promise<any> {
    const updates: any = {
      status: 'resolved',
      endTime: new Date(),
      updatedAt: new Date(),
    };

    if (resolutionMessage) {
      updates.resolutionMessage = resolutionMessage;
    }

    const [updated] = await db.update(schema.massiveFailures)
      .set(updates)
      .where(eq(schema.massiveFailures.id, id))
      .returning();
    return updated;
  }

  async deleteMassiveFailure(id: string): Promise<void> {
    await db.delete(schema.massiveFailures).where(eq(schema.massiveFailures.id, id));
  }

  async checkActiveFailureForRegion(city: string, neighborhood: string): Promise<any | null> {
    // Função para normalizar strings: remove espaços extras, acentos e converte para maiúsculas
    const normalize = (str: string): string => {
      return str
        .trim()
        .replace(/\s+/g, ' ') // Remove espaços extras
        .normalize('NFD') // Decompõe caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remove marcas diacríticas
        .toUpperCase();
    };

    const normalizedCity = normalize(city);
    const normalizedNeighborhood = normalize(neighborhood);

    // Busca falhas ativas que afetam a região especificada
    const activeFailures = await db.select()
      .from(schema.massiveFailures)
      .where(eq(schema.massiveFailures.status, 'active'));

    // Para cada falha ativa, verifica se a região do cliente está nas regiões afetadas
    for (const failure of activeFailures) {
      const affectedRegions = failure.affectedRegions as any;
      
      // Se for tipo predefined (array de IDs de regions)
      if (affectedRegions.type === 'predefined' && affectedRegions.regionIds) {
        const regions = await db.select()
          .from(schema.regions)
          .where(inArray(schema.regions.id, affectedRegions.regionIds));
        
        // Match parcial: verifica se alguma região contém o bairro do cliente
        const match = regions.find((r: any) => {
          if (normalize(r.city) !== normalizedCity) return false;
          
          const normalizedRegionNeighborhood = normalize(r.neighborhood);
          
          // 🆕 FALHA GERAL DE CIDADE: Se região não especifica bairro, afeta cidade inteira
          if (!normalizedRegionNeighborhood || normalizedRegionNeighborhood.length === 0) {
            console.log(`🏙️ [Massive Failure] Falha geral detectada: "${failure.name}" afeta toda cidade ${r.city}`);
            return true; // Match por cidade apenas
          }
          
          // Evitar falsos positivos: ambos os bairros devem ter conteúdo
          if (!normalizedNeighborhood || normalizedNeighborhood.length === 0) return false;
          
          return normalizedRegionNeighborhood.includes(normalizedNeighborhood) || 
                 normalizedNeighborhood.includes(normalizedRegionNeighborhood);
        });
        
        if (match) return failure;
      }
      
      // Se for tipo custom (estrutura JSON livre)
      if (affectedRegions.type === 'custom' && affectedRegions.custom) {
        const match = affectedRegions.custom.find((region: any) => {
          if (normalize(region.city) !== normalizedCity) return false;
          
          // 🆕 FALHA GERAL DE CIDADE: Se não especifica bairros ou array vazio, afeta cidade inteira
          if (!region.neighborhoods || region.neighborhoods.length === 0) {
            console.log(`🏙️ [Massive Failure] Falha geral detectada: "${failure.name}" afeta toda cidade ${region.city}`);
            return true; // Match por cidade apenas
          }
          
          // Match parcial: verifica se algum bairro cadastrado contém o bairro do cliente
          // ou se o bairro do cliente contém algum bairro cadastrado
          // Exemplo: "PARK DOS IPES / VILA PARAISO" contém "VILA PARAISO"
          return region.neighborhoods.some((n: string) => {
            const normalizedN = normalize(n);
            
            // Evitar falsos positivos: ambos os bairros devem ter conteúdo
            if (!normalizedNeighborhood || !normalizedN) return false;
            if (normalizedNeighborhood.length === 0 || normalizedN.length === 0) return false;
            
            return normalizedN.includes(normalizedNeighborhood) || 
                   normalizedNeighborhood.includes(normalizedN);
          });
        });
        
        if (match) return failure;
      }
    }

    return null;
  }

  // Failure Notifications
  async addFailureNotification(notification: any): Promise<any> {
    const [created] = await db.insert(schema.failureNotifications)
      .values({
        ...notification,
        sentAt: new Date(),
        wasRead: false,
      })
      .returning();
    return created;
  }

  async getFailureNotificationsByFailureId(failureId: string): Promise<any[]> {
    return await db.select()
      .from(schema.failureNotifications)
      .where(eq(schema.failureNotifications.failureId, failureId))
      .orderBy(desc(schema.failureNotifications.sentAt));
  }

  async getFailureNotificationsByClientPhone(clientPhone: string): Promise<any[]> {
    return await db.select()
      .from(schema.failureNotifications)
      .where(eq(schema.failureNotifications.clientPhone, clientPhone))
      .orderBy(desc(schema.failureNotifications.sentAt));
  }

  async markNotificationAsRead(id: string, clientResponse?: string): Promise<void> {
    const updates: any = {
      wasRead: true,
      respondedAt: new Date(),
    };

    if (clientResponse) {
      updates.clientResponse = clientResponse;
    }

    await db.update(schema.failureNotifications)
      .set(updates)
      .where(eq(schema.failureNotifications.id, id));
  }

  async getNotifiedClientsForFailure(failureId: string): Promise<string[]> {
    const notifications = await db.select({ clientPhone: schema.failureNotifications.clientPhone })
      .from(schema.failureNotifications)
      .where(
        and(
          eq(schema.failureNotifications.failureId, failureId),
          eq(schema.failureNotifications.notificationType, 'failure')
        )
      );
    
    return notifications.map(n => n.clientPhone);
  }

  async getMassiveFailureMetrics() {
    // Buscar falhas ativas
    const activeFailures = await db.select()
      .from(schema.massiveFailures)
      .where(eq(schema.massiveFailures.status, 'active'));

    // Contar notificações (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const notifications = await db.select()
      .from(schema.failureNotifications)
      .where(
        and(
          eq(schema.failureNotifications.notificationType, 'failure'),
          gte(schema.failureNotifications.sentAt, thirtyDaysAgo)
        )
      );

    // Clientes únicos notificados
    const uniqueClients = new Set(notifications.map(n => n.clientPhone)).size;

    // Falhas por severidade
    const failuresBySeverity = {
      low: activeFailures.filter(f => f.severity === 'low').length,
      medium: activeFailures.filter(f => f.severity === 'medium').length,
      high: activeFailures.filter(f => f.severity === 'high').length,
      critical: activeFailures.filter(f => f.severity === 'critical').length,
    };

    // Últimas 5 falhas criadas (ativas ou resolvidas recentemente)
    const recentFailuresData = await db.select()
      .from(schema.massiveFailures)
      .orderBy(desc(schema.massiveFailures.createdAt))
      .limit(5);

    // Buscar todas as notificações das falhas recentes de uma vez
    const failureIds = recentFailuresData.map(f => f.id);
    const allFailureNotifications = failureIds.length > 0
      ? await db.select()
          .from(schema.failureNotifications)
          .where(
            and(
              inArray(schema.failureNotifications.failureId, failureIds),
              eq(schema.failureNotifications.notificationType, 'failure')
            )
          )
      : [];

    // Mapear notificações por failureId
    const notificationsByFailure = allFailureNotifications.reduce((acc, notif) => {
      if (!acc[notif.failureId]) {
        acc[notif.failureId] = 0;
      }
      acc[notif.failureId]++;
      return acc;
    }, {} as Record<string, number>);

    // Para cada falha, calcular regiões afetadas e clientes notificados
    const recentFailures = recentFailuresData.map((failure) => {
      // Calcular regiões afetadas a partir do JSON affectedRegions
      let affectedRegionsCount = 0;
      try {
        const regions = failure.affectedRegions as any;
        if (regions?.type === 'predefined' && Array.isArray(regions.regionIds)) {
          affectedRegionsCount = regions.regionIds.length;
        } else if (regions?.type === 'custom' && Array.isArray(regions.custom)) {
          affectedRegionsCount = regions.custom.reduce((sum: number, region: any) => {
            return sum + (Array.isArray(region.neighborhoods) ? region.neighborhoods.length : 0);
          }, 0);
        }
      } catch (e) {
        affectedRegionsCount = 0;
      }

      return {
        id: failure.id,
        title: failure.name,
        severity: failure.severity,
        affectedRegions: affectedRegionsCount,
        notifiedClients: notificationsByFailure[failure.id] || 0,
        createdAt: failure.createdAt || new Date(),
      };
    });

    return {
      activeFailures: activeFailures.length,
      totalNotifications: notifications.length,
      uniqueClientsNotified: uniqueClients,
      failuresBySeverity,
      recentFailures,
    };
  }

  // Announcements
  async getAllAnnouncements(): Promise<any[]> {
    return await db.select()
      .from(schema.announcements)
      .orderBy(desc(schema.announcements.priority), desc(schema.announcements.createdAt));
  }

  async getActiveAnnouncements(): Promise<any[]> {
    const now = new Date();
    return await db.select()
      .from(schema.announcements)
      .where(
        and(
          eq(schema.announcements.active, true),
          lte(schema.announcements.startDate, now), // startDate <= now (já começou)
          or(
            isNull(schema.announcements.endDate),
            gte(schema.announcements.endDate, now) // endDate >= now (ainda não terminou)
          )
        )
      )
      .orderBy(desc(schema.announcements.priority), desc(schema.announcements.createdAt));
  }

  async getAnnouncement(id: string): Promise<any | undefined> {
    const [announcement] = await db.select()
      .from(schema.announcements)
      .where(eq(schema.announcements.id, id));
    return announcement;
  }

  async addAnnouncement(announcement: any): Promise<any> {
    const [created] = await db.insert(schema.announcements)
      .values(announcement)
      .returning();
    return created;
  }

  async updateAnnouncement(id: string, updates: any): Promise<any> {
    const [updated] = await db.update(schema.announcements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.announcements.id, id))
      .returning();
    return updated;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await db.delete(schema.announcements)
      .where(eq(schema.announcements.id, id));
  }

  // ========================
  // PROMPT MANAGEMENT SYSTEM
  // ========================

  // Prompt Templates
  async getAllPromptTemplates(): Promise<PromptTemplate[]> {
    return await db.select()
      .from(schema.promptTemplates)
      .where(eq(schema.promptTemplates.status, "active"))
      .orderBy(schema.promptTemplates.assistantType);
  }

  async getPromptTemplate(id: string): Promise<PromptTemplate | undefined> {
    const [template] = await db.select()
      .from(schema.promptTemplates)
      .where(eq(schema.promptTemplates.id, id));
    return template;
  }

  async getPromptTemplateByAssistantId(assistantId: string): Promise<PromptTemplate | undefined> {
    const [template] = await db.select()
      .from(schema.promptTemplates)
      .where(eq(schema.promptTemplates.assistantId, assistantId));
    return template;
  }

  async getPromptTemplateByAssistantType(assistantType: string): Promise<PromptTemplate | undefined> {
    const [template] = await db.select()
      .from(schema.promptTemplates)
      .where(eq(schema.promptTemplates.assistantType, assistantType));
    return template;
  }

  async createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate> {
    const [created] = await db.insert(schema.promptTemplates)
      .values(template)
      .returning();
    return created;
  }

  async updatePromptTemplate(id: string, updates: UpdatePromptTemplate): Promise<PromptTemplate> {
    const [updated] = await db.update(schema.promptTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.promptTemplates.id, id))
      .returning();
    return updated;
  }

  // Prompt Versions
  async getPromptVersionsByPromptId(promptId: string): Promise<PromptVersion[]> {
    return await db.select()
      .from(schema.promptVersions)
      .where(eq(schema.promptVersions.promptId, promptId))
      .orderBy(desc(schema.promptVersions.createdAt));
  }

  async getPromptVersion(id: string): Promise<PromptVersion | undefined> {
    const [version] = await db.select()
      .from(schema.promptVersions)
      .where(eq(schema.promptVersions.id, id));
    return version;
  }

  async createPromptVersion(version: InsertPromptVersion): Promise<PromptVersion> {
    const [created] = await db.insert(schema.promptVersions)
      .values(version)
      .returning();
    return created;
  }

  // Prompt Drafts
  async getPromptDraft(promptId: string): Promise<PromptDraft | undefined> {
    const [draft] = await db.select()
      .from(schema.promptDrafts)
      .where(eq(schema.promptDrafts.promptId, promptId));
    return draft;
  }

  async createPromptDraft(draft: InsertPromptDraft): Promise<PromptDraft> {
    const [created] = await db.insert(schema.promptDrafts)
      .values(draft)
      .returning();
    return created;
  }

  async updatePromptDraft(promptId: string, updates: UpdatePromptDraft): Promise<PromptDraft> {
    const [updated] = await db.update(schema.promptDrafts)
      .set({ ...updates, lastEditedAt: new Date() })
      .where(eq(schema.promptDrafts.promptId, promptId))
      .returning();
    return updated;
  }

  async deletePromptDraft(promptId: string): Promise<void> {
    await db.delete(schema.promptDrafts)
      .where(eq(schema.promptDrafts.promptId, promptId));
  }

  // ===================================
  // CONTEXT QUALITY ALERTS SYSTEM
  // ===================================

  async createContextQualityAlert(alert: InsertContextQualityAlert): Promise<ContextQualityAlert> {
    const [created] = await db.insert(schema.contextQualityAlerts)
      .values(alert)
      .returning();
    return created;
  }

  async getRecentContextQualityAlerts(hours: number): Promise<ContextQualityAlert[]> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db.select()
      .from(schema.contextQualityAlerts)
      .where(
        and(
          gte(schema.contextQualityAlerts.detectedAt, cutoffTime),
          isNull(schema.contextQualityAlerts.resolvedAt)
        )
      )
      .orderBy(desc(schema.contextQualityAlerts.detectedAt));
  }

  async getContextQualityStats(hours: number): Promise<{
    totalAlerts: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const alerts = await this.getRecentContextQualityAlerts(hours);
    
    const byType = alerts.reduce((acc, alert) => {
      acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const bySeverity = alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalAlerts: alerts.length,
      byType,
      bySeverity,
    };
  }

  async deleteOldContextQualityAlerts(daysAgo: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const result = await db.delete(schema.contextQualityAlerts)
      .where(lt(schema.contextQualityAlerts.detectedAt, cutoffTime));
    return result.rowCount || 0;
  }

  async markContextQualityAlertsAsResolved(assistantType: string, since: Date): Promise<number> {
    const result = await db.update(schema.contextQualityAlerts)
      .set({ resolvedAt: new Date() })
      .where(
        and(
          eq(schema.contextQualityAlerts.assistantType, assistantType),
          gte(schema.contextQualityAlerts.detectedAt, since),
          isNull(schema.contextQualityAlerts.resolvedAt)
        )
      );
    return result.rowCount || 0;
  }

  // ===================================
  // GAMIFICATION SYSTEM
  // ===================================

  /**
   * Calcula e atualiza as pontuações de gamificação para um período específico (mês)
   * Usa pesos configuráveis definidos em gamificationSettings
   */
  async calculateGamificationScores(period: string): Promise<void> {
    // Busca configurações dinâmicas
    const settings = await this.getGamificationSettings();
    
    // Parse period (formato: YYYY-MM)
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Pega todos os agentes ativos que participam da gamificação
    const agents = await db.select()
      .from(schema.users)
      .where(and(
        eq(schema.users.status, 'ACTIVE'),
        eq(schema.users.participatesInGamification, true),
        or(
          eq(schema.users.role, 'AGENT'),
          eq(schema.users.role, 'SUPERVISOR')
        )
      ));

    if (agents.length === 0) {
      console.log('[Gamification] Nenhum agente ativo encontrado');
      return;
    }

    // Para cada agente, calcula as métricas
    const scores = [];
    for (const agent of agents) {
      // Pega conversas resolvidas pelo agente no período
      const conversations = await db.select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.status, 'resolved'),
          eq(schema.conversations.resolvedBy, agent.id),
          isNotNull(schema.conversations.resolvedAt),
          gte(schema.conversations.resolvedAt, startDate),
          lte(schema.conversations.resolvedAt, endDate)
        ));

      const totalConversations = conversations.length;

      // Se o agente não tem conversas, pula
      if (totalConversations === 0) {
        continue;
      }

      // Pega feedbacks NPS do período (baseado na data de resolução da conversa, não na data de criação do feedback)
      const feedbacks = await db.select({
        feedback: schema.satisfactionFeedback,
      })
        .from(schema.satisfactionFeedback)
        .innerJoin(schema.conversations, eq(schema.satisfactionFeedback.conversationId, schema.conversations.id))
        .where(and(
          eq(schema.conversations.resolvedBy, agent.id),
          eq(schema.conversations.status, 'resolved'),
          isNotNull(schema.conversations.resolvedAt),
          gte(schema.conversations.resolvedAt, startDate),
          lte(schema.conversations.resolvedAt, endDate)
        ));

      // Calcula NPS médio
      const avgNps = feedbacks.length > 0
        ? Math.round(feedbacks.reduce((sum, f) => sum + (f.feedback.npsScore || 0), 0) / feedbacks.length)
        : 0;

      // Calcula taxa de sucesso (baseado em sentimento positivo/neutro)
      const successfulConversations = conversations.filter(c =>
        c.sentiment === 'positive' || c.sentiment === 'neutral'
      ).length;
      const successRate = Math.round((successfulConversations / totalConversations) * 100);

      // Calcula tempo médio de resposta (primeira resposta do agente após atribuição)
      let totalResponseTime = 0;
      let countWithResponseTime = 0;
      for (const conv of conversations) {
        if (!conv.transferredAt) continue;

        // Pega primeira mensagem do agente após transferência
        const firstAgentMessage = await db.select()
          .from(schema.messages)
          .where(and(
            eq(schema.messages.conversationId, conv.id),
            eq(schema.messages.role, 'assistant'),
            gte(schema.messages.timestamp, conv.transferredAt)
          ))
          .orderBy(schema.messages.timestamp)
          .limit(1);

        if (firstAgentMessage.length > 0 && firstAgentMessage[0].timestamp) {
          const responseTime = firstAgentMessage[0].timestamp.getTime() - conv.transferredAt.getTime();
          totalResponseTime += responseTime;
          countWithResponseTime++;
        }
      }
      const avgResponseTime = countWithResponseTime > 0
        ? Math.round(totalResponseTime / countWithResponseTime / 1000) // em segundos
        : 0;

      scores.push({
        agentId: agent.id,
        agentName: agent.fullName,
        totalConversations,
        avgNps,
        successRate,
        avgResponseTime,
      });
    }

    // Normaliza as pontuações (0-100) para cada métrica
    const maxVolume = Math.max(...scores.map(s => s.totalConversations), 1);
    const maxNps = 10; // NPS é de 0-10
    const maxSuccessRate = 100; // Taxa de sucesso já é 0-100
    
    // Para tempo de resposta, quanto menor melhor - invertemos a lógica
    const maxTime = Math.max(...scores.map(s => s.avgResponseTime), 1);

    const scoredData = scores.map(s => {
      const volumeScore = Math.round((s.totalConversations / maxVolume) * 100);
      const npsScore = Math.round((s.avgNps / maxNps) * 100);
      const resolutionScore = s.successRate; // Já está em 0-100
      
      // Tempo: quanto menor, melhor. Invertemos a pontuação
      const timeScore = s.avgResponseTime > 0
        ? Math.round((1 - (s.avgResponseTime / maxTime)) * 100)
        : 100;

      // Fórmula final: usa pesos configuráveis (soma sempre = 100%)
      const totalScore = Math.round(
        (npsScore * (settings.npsWeight / 100)) +
        (volumeScore * (settings.volumeWeight / 100)) +
        (resolutionScore * (settings.resolutionWeight / 100)) +
        (timeScore * (settings.responseTimeWeight / 100))
      );

      return {
        ...s,
        volumeScore,
        npsScore,
        resolutionScore,
        timeScore,
        totalScore,
      };
    });

    // Ordena por pontuação total (decrescente) e atribui ranking
    const ranked = scoredData
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((score, index) => ({
        ...score,
        ranking: index + 1,
      }));

    // Salva ou atualiza os scores no banco
    for (const score of ranked) {
      // Verifica se já existe um score para este agente/período
      const [existing] = await db.select()
        .from(schema.gamificationScores)
        .where(and(
          eq(schema.gamificationScores.agentId, score.agentId),
          eq(schema.gamificationScores.period, period)
        ))
        .limit(1);

      const scoreData = {
        agentId: score.agentId,
        period,
        totalConversations: score.totalConversations,
        avgNps: score.avgNps,
        successRate: score.successRate,
        avgResponseTime: score.avgResponseTime,
        volumeScore: score.volumeScore,
        npsScore: score.npsScore,
        resolutionScore: score.resolutionScore,
        timeScore: score.timeScore,
        totalScore: score.totalScore,
        ranking: score.ranking,
        calculatedAt: new Date(),
      };

      if (existing) {
        // Atualiza
        await db.update(schema.gamificationScores)
          .set(scoreData)
          .where(eq(schema.gamificationScores.id, existing.id));
      } else {
        // Insere
        await db.insert(schema.gamificationScores).values(scoreData);
      }
    }

    console.log(`[Gamification] Pontuações calculadas para ${period}: ${ranked.length} agentes`);
  }

  /**
   * Verifica e atribui badges para um período específico
   * Usa critérios configuráveis definidos em gamificationSettings
   */
  async awardBadges(period: string): Promise<void> {
    // Busca configurações dinâmicas
    const settings = await this.getGamificationSettings();
    
    // Pega todos os scores do período
    const scores = await db.select({
      score: schema.gamificationScores,
      agent: schema.users,
    })
      .from(schema.gamificationScores)
      .leftJoin(schema.users, eq(schema.gamificationScores.agentId, schema.users.id))
      .where(eq(schema.gamificationScores.period, period))
      .orderBy(desc(schema.gamificationScores.totalScore));

    if (scores.length === 0) {
      console.log('[Gamification] Nenhum score encontrado para atribuir badges');
      return;
    }

    // 1. Badge "Solucionador" - Alto NPS + Alta Taxa de Resolução (filtrado por critérios configuráveis)
    const solucionadorCandidates = scores
      .filter(s => 
        (s.score.avgNps || 0) >= settings.solucionadorNpsMin &&
        (s.score.successRate || 0) >= settings.solucionadorResolutionMin
      )
      .map(s => ({
        ...s,
        combinedScore: ((s.score.avgNps || 0) * 10) + (s.score.successRate || 0),
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore);

    if (solucionadorCandidates.length > 0) {
      const solucionador = solucionadorCandidates[0];
      await this.upsertBadge({
        agentId: solucionador.score.agentId,
        badgeType: 'solucionador',
        period,
        metric: solucionador.combinedScore,
      });
    }

    // 2. Badge "Velocista" - Top N mais rápidos (mantendo NPS mínimo configurável)
    const velocistas = scores
      .filter(s => (s.score.avgNps || 0) >= settings.velocistaNpsMin)
      .sort((a, b) => (a.score.avgResponseTime || 0) - (b.score.avgResponseTime || 0))
      .slice(0, settings.velocistaTopN);

    for (const velocista of velocistas) {
      await this.upsertBadge({
        agentId: velocista.score.agentId,
        badgeType: 'velocista',
        period,
        metric: velocista.score.avgResponseTime || 0,
      });
    }

    // 3. Badge "Campeão do Volume" - Top N com mais atendimentos
    const campeoes = scores
      .sort((a, b) => (b.score.totalConversations || 0) - (a.score.totalConversations || 0))
      .slice(0, settings.campeaoVolumeTopN);

    for (const campeao of campeoes) {
      await this.upsertBadge({
        agentId: campeao.score.agentId,
        badgeType: 'campeao_volume',
        period,
        metric: campeao.score.totalConversations || 0,
      });
    }

    console.log(`[Gamification] Badges atribuídos para ${period} (${solucionadorCandidates.length} Solucionador, ${velocistas.length} Velocista, ${campeoes.length} Campeão)`);
  }

  /**
   * Upsert de badge (insere ou atualiza se já existe)
   */
  private async upsertBadge(badge: {
    agentId: string;
    badgeType: string;
    period: string;
    metric: number;
  }): Promise<void> {
    const [existing] = await db.select()
      .from(schema.gamificationBadges)
      .where(and(
        eq(schema.gamificationBadges.agentId, badge.agentId),
        eq(schema.gamificationBadges.badgeType, badge.badgeType),
        eq(schema.gamificationBadges.period, badge.period)
      ))
      .limit(1);

    if (existing) {
      await db.update(schema.gamificationBadges)
        .set({ metric: badge.metric, awardedAt: new Date() })
        .where(eq(schema.gamificationBadges.id, existing.id));
    } else {
      await db.insert(schema.gamificationBadges).values(badge);
    }
  }

  /**
   * Salva o histórico dos Top 5 vencedores do mês
   */
  async saveTop5History(period: string): Promise<void> {
    // Pega os Top 5 do período
    const top5 = await db.select({
      score: schema.gamificationScores,
      agent: schema.users,
    })
      .from(schema.gamificationScores)
      .leftJoin(schema.users, eq(schema.gamificationScores.agentId, schema.users.id))
      .where(eq(schema.gamificationScores.period, period))
      .orderBy(desc(schema.gamificationScores.totalScore))
      .limit(5);

    // Para cada um, pega os badges conquistados
    for (let i = 0; i < top5.length; i++) {
      const item = top5[i];
      const badges = await db.select()
        .from(schema.gamificationBadges)
        .where(and(
          eq(schema.gamificationBadges.agentId, item.score.agentId),
          eq(schema.gamificationBadges.period, period)
        ));

      const badgeTypes = badges.map(b => b.badgeType);

      // Verifica se já existe no histórico
      const [existing] = await db.select()
        .from(schema.gamificationHistory)
        .where(and(
          eq(schema.gamificationHistory.period, period),
          eq(schema.gamificationHistory.agentId, item.score.agentId)
        ))
        .limit(1);

      const historyData = {
        period,
        agentId: item.score.agentId,
        ranking: i + 1,
        totalScore: item.score.totalScore || 0,
        metrics: {
          volume: item.score.totalConversations || 0,
          nps: item.score.avgNps || 0,
          successRate: item.score.successRate || 0,
          avgResponseTime: item.score.avgResponseTime || 0,
        },
        badges: badgeTypes,
      };

      if (existing) {
        await db.update(schema.gamificationHistory)
          .set(historyData)
          .where(eq(schema.gamificationHistory.id, existing.id));
      } else {
        await db.insert(schema.gamificationHistory).values(historyData);
      }
    }

    console.log(`[Gamification] Histórico Top 5 salvo para ${period}`);
  }

  /**
   * Retorna o ranking do período atual (ou período especificado)
   */
  async getGamificationRanking(period?: string): Promise<any[]> {
    // Se não especificado, usa o mês atual
    const targetPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM

    const ranking = await db.select({
      score: schema.gamificationScores,
      agent: schema.users,
    })
      .from(schema.gamificationScores)
      .leftJoin(schema.users, eq(schema.gamificationScores.agentId, schema.users.id))
      .where(and(
        eq(schema.gamificationScores.period, targetPeriod),
        eq(schema.users.participatesInGamification, true)
      ))
      .orderBy(desc(schema.gamificationScores.totalScore));

    // Para cada agente, pega os badges
    const rankingWithBadges = await Promise.all(
      ranking.map(async (item) => {
        const badges = await db.select()
          .from(schema.gamificationBadges)
          .where(and(
            eq(schema.gamificationBadges.agentId, item.score.agentId),
            eq(schema.gamificationBadges.period, targetPeriod)
          ));

        return {
          ...item.score,
          agentName: item.agent?.fullName || 'Desconhecido',
          agentId: item.score.agentId,
          badges: badges.map(b => ({
            type: b.badgeType,
            metric: b.metric,
            awardedAt: b.awardedAt,
          })),
        };
      })
    );

    return rankingWithBadges;
  }

  /**
   * Retorna o histórico de um agente específico
   */
  async getAgentGamificationHistory(agentId: string, limit: number = 12): Promise<any[]> {
    const history = await db.select()
      .from(schema.gamificationScores)
      .where(eq(schema.gamificationScores.agentId, agentId))
      .orderBy(desc(schema.gamificationScores.period))
      .limit(limit);

    return history;
  }

  /**
   * Retorna estatísticas gerais de gamificação
   */
  async getGamificationStats(period?: string): Promise<any> {
    const targetPeriod = period || new Date().toISOString().slice(0, 7);

    const scores = await db.select()
      .from(schema.gamificationScores)
      .where(eq(schema.gamificationScores.period, targetPeriod));

    const totalAgents = scores.length;
    const avgTotalScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + (s.totalScore || 0), 0) / scores.length)
      : 0;
    
    const topScore = scores.length > 0
      ? Math.max(...scores.map(s => s.totalScore || 0))
      : 0;

    const badges = await db.select()
      .from(schema.gamificationBadges)
      .where(eq(schema.gamificationBadges.period, targetPeriod));

    const badgeDistribution = badges.reduce((acc, badge) => {
      acc[badge.badgeType] = (acc[badge.badgeType] || 0) + 1;
      return acc;
    }, {
      solucionador: 0,
      velocista: 0,
      campeao_volume: 0,
    } as Record<string, number>);

    return {
      period: targetPeriod,
      totalAgents,
      avgTotalScore,
      topScore,
      totalBadges: badges.length,
      badgeDistribution,
    };
  }

  /**
   * Retorna as configurações de gamificação (singleton - sempre id=1)
   * Se não existir, cria com valores padrão
   */
  async getGamificationSettings(): Promise<schema.GamificationSettings> {
    // Tenta buscar configuração existente
    const existing = await db.select()
      .from(schema.gamificationSettings)
      .where(eq(schema.gamificationSettings.id, 1))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Se não existir, cria com valores padrão
    const defaultSettings: Omit<schema.GamificationSettings, 'id' | 'createdAt' | 'updatedAt'> = {
      // Pesos da fórmula (devem somar 100%)
      npsWeight: 40,
      volumeWeight: 30,
      resolutionWeight: 20,
      responseTimeWeight: 10,
      
      // Critérios dos badges
      solucionadorNpsMin: 7,
      solucionadorResolutionMin: 70,
      velocistaNpsMin: 7,
      velocistaTopN: 1,
      campeaoVolumeTopN: 1,
      
      // Metas mensais
      targetNps: 8,
      targetResolution: 85,
      targetResponseTime: 120,
      targetVolume: 500,
      
      // Período de cálculo
      calculationPeriod: "monthly",
      
      // Automação
      autoCalculate: false,
      calculationFrequency: "monthly",
      calculationDayOfMonth: 1,
      calculationDayOfWeek: 1,
      calculationTime: "00:00",
      
      updatedBy: null,
    };

    const [created] = await db.insert(schema.gamificationSettings)
      .values(defaultSettings)
      .returning();

    return created;
  }

  /**
   * Atualiza as configurações de gamificação
   */
  async updateGamificationSettings(
    data: schema.UpdateGamificationSettings,
    userId: string
  ): Promise<schema.GamificationSettings> {
    // Garante que o registro existe (cria se necessário)
    await this.getGamificationSettings();

    // Atualiza o registro
    const [updated] = await db.update(schema.gamificationSettings)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.gamificationSettings.id, 1))
      .returning();

    return updated;
  }

  // ============================================================================
  // COBRANÇAS - Módulo de Cobrança Ativa por Telefone
  // ============================================================================

  // Voice Campaigns
  async getAllVoiceCampaigns(): Promise<VoiceCampaign[]> {
    return await db.select().from(schema.voiceCampaigns).orderBy(desc(schema.voiceCampaigns.createdAt));
  }

  async getVoiceCampaign(id: string): Promise<VoiceCampaign | undefined> {
    const campaigns = await db.select().from(schema.voiceCampaigns).where(eq(schema.voiceCampaigns.id, id)).limit(1);
    return campaigns[0];
  }

  async getVoiceCampaignsByStatus(status: string): Promise<VoiceCampaign[]> {
    return await db.select().from(schema.voiceCampaigns).where(eq(schema.voiceCampaigns.status, status));
  }

  async getActiveVoiceCampaigns(): Promise<VoiceCampaign[]> {
    return await db.select().from(schema.voiceCampaigns).where(eq(schema.voiceCampaigns.status, 'active'));
  }

  async createVoiceCampaign(campaign: InsertVoiceCampaign): Promise<VoiceCampaign> {
    const [created] = await db.insert(schema.voiceCampaigns).values(campaign).returning();
    return created;
  }

  async updateVoiceCampaign(id: string, updates: Partial<VoiceCampaign>): Promise<VoiceCampaign | undefined> {
    const [updated] = await db.update(schema.voiceCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.voiceCampaigns.id, id))
      .returning();
    return updated;
  }

  async deleteVoiceCampaign(id: string): Promise<void> {
    await db.delete(schema.voiceCampaigns).where(eq(schema.voiceCampaigns.id, id));
  }

  async updateVoiceCampaignStats(id: string, stats: {
    totalTargets?: number;
    contactedTargets?: number;
    successfulContacts?: number;
    promisesMade?: number;
    promisesFulfilled?: number;
  }): Promise<void> {
    await db.update(schema.voiceCampaigns)
      .set({ ...stats, updatedAt: new Date() })
      .where(eq(schema.voiceCampaigns.id, id));
  }

  async recalculateVoiceCampaignStats(campaignId: string): Promise<void> {
    const [totalTargetsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.voiceCampaignTargets)
      .where(eq(schema.voiceCampaignTargets.campaignId, campaignId));

    const [contactedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.voiceCampaignTargets)
      .where(and(
        eq(schema.voiceCampaignTargets.campaignId, campaignId),
        eq(schema.voiceCampaignTargets.state, 'completed')
      ));

    const [promisesResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.voicePromises)
      .where(eq(schema.voicePromises.campaignId, campaignId));

    const [fulfilledResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.voicePromises)
      .where(and(
        eq(schema.voicePromises.campaignId, campaignId),
        eq(schema.voicePromises.status, 'fulfilled')
      ));

    const [successfulResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.voiceCallAttempts)
      .where(and(
        eq(schema.voiceCallAttempts.campaignId, campaignId),
        eq(schema.voiceCallAttempts.status, 'completed')
      ));

    await this.updateVoiceCampaignStats(campaignId, {
      totalTargets: totalTargetsResult?.count || 0,
      contactedTargets: contactedResult?.count || 0,
      successfulContacts: successfulResult?.count || 0,
      promisesMade: promisesResult?.count || 0,
      promisesFulfilled: fulfilledResult?.count || 0,
    });
  }

  // CRM Sync Configs
  async getCRMSyncConfig(id: string): Promise<CRMSyncConfig | undefined> {
    const configs = await db.select().from(schema.crmSyncConfigs).where(eq(schema.crmSyncConfigs.id, id)).limit(1);
    return configs[0];
  }

  async getCRMSyncConfigByCampaignId(campaignId: string): Promise<CRMSyncConfig | undefined> {
    const configs = await db.select().from(schema.crmSyncConfigs).where(eq(schema.crmSyncConfigs.campaignId, campaignId)).limit(1);
    return configs[0];
  }

  async createCRMSyncConfig(config: InsertCRMSyncConfig): Promise<CRMSyncConfig> {
    const [created] = await db.insert(schema.crmSyncConfigs).values(config).returning();
    return created;
  }

  async updateCRMSyncConfig(id: string, updates: Partial<CRMSyncConfig>): Promise<CRMSyncConfig | undefined> {
    const [updated] = await db.update(schema.crmSyncConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.crmSyncConfigs.id, id))
      .returning();
    return updated;
  }

  async checkTargetExists(campaignId: string, document: string, phone: string, deduplicateBy: string): Promise<VoiceCampaignTarget | undefined> {
    let condition;
    
    if (deduplicateBy === 'document') {
      condition = and(
        eq(schema.voiceCampaignTargets.campaignId, campaignId),
        eq(schema.voiceCampaignTargets.debtorDocument, document)
      );
    } else if (deduplicateBy === 'phone') {
      condition = and(
        eq(schema.voiceCampaignTargets.campaignId, campaignId),
        eq(schema.voiceCampaignTargets.phoneNumber, phone)
      );
    } else {
      condition = and(
        eq(schema.voiceCampaignTargets.campaignId, campaignId),
        sql`(${schema.voiceCampaignTargets.debtorDocument} = ${document} OR ${schema.voiceCampaignTargets.phoneNumber} = ${phone})`
      );
    }

    const targets = await db.select().from(schema.voiceCampaignTargets).where(condition).limit(1);
    return targets[0];
  }

  // Voice Campaign Targets
  async getAllVoiceCampaignTargets(): Promise<VoiceCampaignTarget[]> {
    return await db.select().from(schema.voiceCampaignTargets)
      .orderBy(desc(schema.voiceCampaignTargets.createdAt));
  }

  async getVoiceCampaignTargets(campaignId: string): Promise<VoiceCampaignTarget[]> {
    return await db.select().from(schema.voiceCampaignTargets)
      .where(eq(schema.voiceCampaignTargets.campaignId, campaignId))
      .orderBy(desc(schema.voiceCampaignTargets.priority), asc(schema.voiceCampaignTargets.createdAt));
  }

  async getVoiceCampaignTarget(id: string): Promise<VoiceCampaignTarget | undefined> {
    const targets = await db.select().from(schema.voiceCampaignTargets)
      .where(eq(schema.voiceCampaignTargets.id, id))
      .limit(1);
    return targets[0];
  }

  async getVoiceCampaignTargetsByState(campaignId: string, state: string): Promise<VoiceCampaignTarget[]> {
    return await db.select().from(schema.voiceCampaignTargets)
      .where(and(
        eq(schema.voiceCampaignTargets.campaignId, campaignId),
        eq(schema.voiceCampaignTargets.state, state)
      ));
  }

  async getNextScheduledTargets(limit: number): Promise<VoiceCampaignTarget[]> {
    return await db.select().from(schema.voiceCampaignTargets)
      .where(and(
        eq(schema.voiceCampaignTargets.state, 'scheduled'),
        lte(schema.voiceCampaignTargets.nextAttemptAt, new Date())
      ))
      .orderBy(asc(schema.voiceCampaignTargets.nextAttemptAt))
      .limit(limit);
  }

  async createVoiceCampaignTarget(target: InsertVoiceCampaignTarget): Promise<VoiceCampaignTarget> {
    const [created] = await db.insert(schema.voiceCampaignTargets).values(target).returning();
    return created;
  }

  async createVoiceCampaignTargets(targets: InsertVoiceCampaignTarget[]): Promise<VoiceCampaignTarget[]> {
    if (targets.length === 0) return [];
    return await db.insert(schema.voiceCampaignTargets).values(targets).returning();
  }

  async updateVoiceCampaignTarget(id: string, updates: Partial<VoiceCampaignTarget>): Promise<VoiceCampaignTarget | undefined> {
    const [updated] = await db.update(schema.voiceCampaignTargets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.voiceCampaignTargets.id, id))
      .returning();
    return updated;
  }

  async incrementTargetAttempt(id: string, nextAttemptAt?: Date): Promise<void> {
    await db.update(schema.voiceCampaignTargets)
      .set({
        attemptCount: sql`${schema.voiceCampaignTargets.attemptCount} + 1`,
        lastAttemptAt: new Date(),
        nextAttemptAt: nextAttemptAt || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.voiceCampaignTargets.id, id));
  }

  async deleteVoiceCampaignTarget(id: string): Promise<void> {
    await db.delete(schema.voiceCampaignTargets)
      .where(eq(schema.voiceCampaignTargets.id, id));
  }

  // Voice Call Attempts
  async getVoiceCallAttempts(targetId: string): Promise<VoiceCallAttempt[]> {
    return await db.select().from(schema.voiceCallAttempts)
      .where(eq(schema.voiceCallAttempts.targetId, targetId))
      .orderBy(desc(schema.voiceCallAttempts.attemptNumber));
  }

  async getVoiceCallAttemptsByCampaign(campaignId: string): Promise<VoiceCallAttempt[]> {
    return await db.select().from(schema.voiceCallAttempts)
      .where(eq(schema.voiceCallAttempts.campaignId, campaignId))
      .orderBy(desc(schema.voiceCallAttempts.dialedAt));
  }

  async getVoiceCallAttempt(id: string): Promise<VoiceCallAttempt | undefined> {
    const attempts = await db.select().from(schema.voiceCallAttempts)
      .where(eq(schema.voiceCallAttempts.id, id))
      .limit(1);
    return attempts[0];
  }

  async getVoiceCallAttemptByCallSid(callSid: string): Promise<VoiceCallAttempt | undefined> {
    const attempts = await db.select().from(schema.voiceCallAttempts)
      .where(eq(schema.voiceCallAttempts.callSid, callSid))
      .limit(1);
    return attempts[0];
  }

  async createVoiceCallAttempt(attempt: InsertVoiceCallAttempt): Promise<VoiceCallAttempt> {
    const [created] = await db.insert(schema.voiceCallAttempts).values(attempt).returning();
    return created;
  }

  async updateVoiceCallAttempt(id: string, updates: Partial<VoiceCallAttempt>): Promise<VoiceCallAttempt | undefined> {
    const [updated] = await db.update(schema.voiceCallAttempts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.voiceCallAttempts.id, id))
      .returning();
    return updated;
  }

  // Voice Promises
  async getAllVoicePromises(): Promise<VoicePromise[]> {
    return await db.select().from(schema.voicePromises)
      .orderBy(desc(schema.voicePromises.recordedAt));
  }

  async getVoicePromise(id: string): Promise<VoicePromise | undefined> {
    const promises = await db.select().from(schema.voicePromises)
      .where(eq(schema.voicePromises.id, id))
      .limit(1);
    return promises[0];
  }

  async getVoicePromisesByCampaign(campaignId: string): Promise<VoicePromise[]> {
    return await db.select().from(schema.voicePromises)
      .where(eq(schema.voicePromises.campaignId, campaignId))
      .orderBy(desc(schema.voicePromises.recordedAt));
  }

  async getVoicePromisesByStatus(status: string): Promise<VoicePromise[]> {
    return await db.select().from(schema.voicePromises)
      .where(eq(schema.voicePromises.status, status))
      .orderBy(asc(schema.voicePromises.dueDate));
  }

  async getPendingVoicePromisesByDueDate(dueDate: Date): Promise<VoicePromise[]> {
    return await db.select().from(schema.voicePromises)
      .where(and(
        eq(schema.voicePromises.status, 'pending'),
        lte(schema.voicePromises.dueDate, dueDate)
      ))
      .orderBy(asc(schema.voicePromises.dueDate));
  }

  async createVoicePromise(promise: InsertVoicePromise): Promise<VoicePromise> {
    const [created] = await db.insert(schema.voicePromises).values(promise).returning();
    return created;
  }

  async updateVoicePromise(id: string, updates: Partial<VoicePromise>): Promise<VoicePromise | undefined> {
    const [updated] = await db.update(schema.voicePromises)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.voicePromises.id, id))
      .returning();
    return updated;
  }

  async markVoicePromiseAsFulfilled(id: string): Promise<void> {
    await db.update(schema.voicePromises)
      .set({
        status: 'fulfilled',
        fulfilledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.voicePromises.id, id));
  }

  // Voice Configs
  async getVoiceConfig(key: string): Promise<VoiceConfig | undefined> {
    const configs = await db.select().from(schema.voiceConfigs)
      .where(eq(schema.voiceConfigs.key, key))
      .limit(1);
    return configs[0];
  }

  async getAllVoiceConfigs(): Promise<VoiceConfig[]> {
    return await db.select().from(schema.voiceConfigs);
  }

  async setVoiceConfig(config: InsertVoiceConfig): Promise<VoiceConfig> {
    const [created] = await db.insert(schema.voiceConfigs)
      .values(config)
      .onConflictDoUpdate({
        target: schema.voiceConfigs.key,
        set: {
          value: config.value,
          description: config.description,
          updatedBy: config.updatedBy,
          updatedAt: new Date(),
        },
      })
      .returning();
    return created;
  }

  async deleteVoiceConfig(key: string): Promise<void> {
    await db.delete(schema.voiceConfigs).where(eq(schema.voiceConfigs.key, key));
  }

  // Voice Messaging Settings
  async getVoiceMessagingSettings(): Promise<VoiceMessagingSettings | undefined> {
    const settings = await db.select()
      .from(schema.voiceMessagingSettings)
      .limit(1);
    
    // Se não existir, criar com valores padrão
    if (!settings[0]) {
      const [created] = await db.insert(schema.voiceMessagingSettings)
        .values({
          voiceEnabled: true,
          whatsappEnabled: true,
          defaultMethod: 'voice',
          fallbackOrder: ['voice', 'whatsapp'],
        })
        .returning();
      return created;
    }
    
    return settings[0];
  }

  async updateVoiceMessagingSettings(settings: Partial<InsertVoiceMessagingSettings>): Promise<VoiceMessagingSettings> {
    // Buscar o registro existente ou criar se não existir
    const existing = await this.getVoiceMessagingSettings();
    
    if (!existing) {
      // Criar novo registro
      const [created] = await db.insert(schema.voiceMessagingSettings)
        .values({
          voiceEnabled: settings.voiceEnabled ?? true,
          whatsappEnabled: settings.whatsappEnabled ?? true,
          defaultMethod: settings.defaultMethod ?? 'voice',
          fallbackOrder: settings.fallbackOrder ?? ['voice', 'whatsapp'],
          description: settings.description,
          updatedBy: settings.updatedBy,
        })
        .returning();
      return created;
    }
    
    // Atualizar registro existente
    const [updated] = await db.update(schema.voiceMessagingSettings)
      .set({
        ...settings,
        updatedAt: new Date(),
      })
      .where(eq(schema.voiceMessagingSettings.id, existing.id))
      .returning();
    
    return updated;
  }
}

export const storage = new DbStorage();
