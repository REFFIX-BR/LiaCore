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
  type InsertPromptUpdate,
  type SatisfactionFeedback,
  type InsertSatisfactionFeedback,
  type SuggestedResponse,
  type InsertSuggestedResponse
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
  getMonitorConversations(): Promise<Conversation[]>; // Ativas + Resolvidas (24h)
  getAllConversations(): Promise<Conversation[]>;
  getTransferredConversations(): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(chatId: string): Promise<void>;
  
  // Messages
  getMessagesByConversationId(conversationId: string): Promise<Message[]>;
  getRecentMessagesByConversationId(conversationId: string, limit: number): Promise<Message[]>;
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

  async getTransferredConversations(): Promise<Conversation[]> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return Array.from(this.conversations.values()).filter((conv) => {
      if (conv.transferredToHuman !== true) return false;
      
      // Show active conversations OR resolved conversations from last 24h
      if (conv.status === 'active') return true;
      if (conv.status === 'resolved' && conv.lastMessageTime && conv.lastMessageTime >= twentyFourHoursAgo) return true;
      
      return false;
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
}

import { db } from "./db";
import { eq, desc, and, or, gte, isNotNull, sql } from "drizzle-orm";
import * as schema from "@shared/schema";

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
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

  async getTransferredConversations(): Promise<Conversation[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return await db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.transferredToHuman, true),
        or(
          eq(schema.conversations.status, 'active'),
          and(
            eq(schema.conversations.status, 'resolved'),
            isNotNull(schema.conversations.lastMessageTime),
            gte(schema.conversations.lastMessageTime, twentyFourHoursAgo)
          )
        )
      ))
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
}

export const storage = new DbStorage();
