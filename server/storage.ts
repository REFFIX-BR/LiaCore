import { 
  type User, 
  type InsertUser,
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
  type InsertPromptUpdate
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Conversations
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByChatId(chatId: string): Promise<Conversation | undefined>;
  getAllActiveConversations(): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  
  // Messages
  getMessagesByConversationId(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Alerts
  getActiveAlerts(): Promise<Alert[]>;
  getAlertsByConversationId(conversationId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  resolveAlert(id: string): Promise<void>;
  
  // Supervisor Actions
  createSupervisorAction(action: InsertSupervisorAction): Promise<SupervisorAction>;
  getActionsByConversationId(conversationId: string): Promise<SupervisorAction[]>;
  
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

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.alerts = new Map();
    this.supervisorActions = new Map();
    this.learningEvents = new Map();
    this.promptSuggestions = new Map();
    this.promptUpdates = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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

  async createConversation(insertConv: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      ...insertConv,
      id,
      clientId: insertConv.clientId || null,
      threadId: insertConv.threadId || null,
      sentiment: insertConv.sentiment || null,
      urgency: insertConv.urgency || null,
      lastMessage: insertConv.lastMessage || null,
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

  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      (msg) => msg.conversationId === conversationId
    ).sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0));
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
}

export const storage = new MemStorage();
