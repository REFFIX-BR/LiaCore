import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Role enum
export const UserRole = {
  ADMIN: "ADMIN",
  SUPERVISOR: "SUPERVISOR",
  AGENT: "AGENT",
} as const;

// User Status enum
export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").unique(), // Added for user invites
  role: text("role").notNull().default("AGENT"), // 'ADMIN', 'SUPERVISOR', or 'AGENT'
  status: text("status").notNull().default("ACTIVE"), // 'ACTIVE' or 'INACTIVE'
  lastLoginAt: timestamp("last_login_at"),
  lastActivityAt: timestamp("last_activity_at"), // Track real-time activity for status
  createdAt: timestamp("created_at").defaultNow(),
});

export const registrationRequests = pgTable("registration_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  password: text("password").notNull(), // Hashed password
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  requestedRole: text("requested_role").notNull().default("AGENT"),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected'
  reviewedBy: varchar("reviewed_by"), // User ID of admin/supervisor who reviewed
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: text("chat_id").notNull().unique(),
  clientName: text("client_name").notNull(),
  clientId: text("client_id"),
  threadId: text("thread_id"),
  assistantType: text("assistant_type").notNull(),
  status: text("status").notNull().default("active"), // 'active', 'transferred', 'resolved'
  sentiment: text("sentiment").default("neutral"),
  urgency: text("urgency").default("normal"),
  duration: integer("duration").default(0),
  lastMessage: text("last_message"),
  lastMessageTime: timestamp("last_message_time").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"),
  conversationSummary: text("conversation_summary"),
  lastSummarizedAt: timestamp("last_summarized_at"),
  messageCountAtLastSummary: integer("message_count_at_last_summary").default(0),
  transferredToHuman: boolean("transferred_to_human").default(false),
  transferReason: text("transfer_reason"),
  transferredAt: timestamp("transferred_at"),
  assignedTo: varchar("assigned_to"), // User ID of the agent assigned
  resolvedAt: timestamp("resolved_at"),
  resolutionTime: integer("resolution_time"), // Time in seconds from transfer to resolution
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  functionCall: jsonb("function_call"),
  assistant: text("assistant"),
});

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supervisorActions = pgTable("supervisor_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  action: text("action").notNull(),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const learningEvents = pgTable("learning_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  eventType: text("event_type").notNull(), // 'explicit_correction', 'implicit_success', 'implicit_failure'
  assistantType: text("assistant_type").notNull(),
  userMessage: text("user_message").notNull(),
  aiResponse: text("ai_response").notNull(),
  correctResponse: text("correct_response"), // If supervisor corrected
  feedback: text("feedback"), // Supervisor notes
  sentiment: text("sentiment"),
  resolution: text("resolution"), // 'success', 'abandoned', 'corrected'
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"),
});

export const promptSuggestions = pgTable("prompt_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assistantType: text("assistant_type").notNull(),
  problemIdentified: text("problem_identified").notNull(),
  rootCauseAnalysis: text("root_cause_analysis").notNull(),
  currentPrompt: text("current_prompt").notNull(),
  suggestedPrompt: text("suggested_prompt").notNull(),
  confidenceScore: integer("confidence_score").notNull(), // 0-100
  affectedConversations: text("affected_conversations").array(),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'applied'
  reviewedBy: text("reviewed_by"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const promptUpdates = pgTable("prompt_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  suggestionId: varchar("suggestion_id"),
  assistantType: text("assistant_type").notNull(),
  modificationType: text("modification_type").notNull(), // 'instructions', 'function_added', 'function_removed'
  previousValue: text("previous_value").notNull(),
  newValue: text("new_value").notNull(),
  reason: text("reason").notNull(),
  appliedBy: text("applied_by").notNull(), // 'Supervisor Name' or 'Automatic'
  createdAt: timestamp("created_at").defaultNow(),
});

export const satisfactionFeedback = pgTable("satisfaction_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  assistantType: text("assistant_type").notNull(),
  npsScore: integer("nps_score").notNull(), // 0-10
  category: text("category").notNull(), // 'detractor' (0-6), 'neutral' (7-8), 'promoter' (9-10)
  comment: text("comment"),
  clientName: text("client_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suggestedResponses = pgTable("suggested_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  messageContext: text("message_context").notNull(), // User's last message
  suggestedResponse: text("suggested_response").notNull(), // AI suggested response
  finalResponse: text("final_response"), // What was actually sent (if edited)
  wasEdited: boolean("was_edited").default(false),
  wasApproved: boolean("was_approved").default(false),
  supervisorName: text("supervisor_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
}).extend({
  role: z.enum(["ADMIN", "SUPERVISOR", "AGENT"]).default("AGENT"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  email: z.string().email("Email inválido").nullable().optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email("Email inválido").optional(),
  role: z.enum(["ADMIN", "SUPERVISOR", "AGENT"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
});

export const loginSchema = z.object({
  username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres"),
  password: z.string().min(4, "Senha deve ter no mínimo 4 caracteres"),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
});

export const insertSupervisorActionSchema = createInsertSchema(supervisorActions).omit({
  id: true,
  createdAt: true,
});

export const insertLearningEventSchema = createInsertSchema(learningEvents).omit({
  id: true,
  createdAt: true,
});

export const insertPromptSuggestionSchema = createInsertSchema(promptSuggestions).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});

export const insertPromptUpdateSchema = createInsertSchema(promptUpdates).omit({
  id: true,
  createdAt: true,
});

export const insertSatisfactionFeedbackSchema = createInsertSchema(satisfactionFeedback).omit({
  id: true,
  createdAt: true,
  category: true, // Category is calculated by backend based on npsScore
});

export const insertSuggestedResponseSchema = createInsertSchema(suggestedResponses).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
});

export const insertRegistrationRequestSchema = createInsertSchema(registrationRequests).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  reviewedBy: true,
  rejectionReason: true,
});

// Evolution API Configuration Schema
export const evolutionConfigSchema = z.object({
  url: z.string()
    .url({ message: "URL inválida. Use o formato: https://sua-api.com" })
    .min(1, { message: "URL é obrigatória" }),
  apiKey: z.string()
    .min(1, { message: "API Key é obrigatória" }),
  instance: z.string()
    .min(1, { message: "Nome da instância é obrigatório" }),
});

export type EvolutionConfig = z.infer<typeof evolutionConfigSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type SupervisorAction = typeof supervisorActions.$inferSelect;
export type InsertSupervisorAction = z.infer<typeof insertSupervisorActionSchema>;
export type LearningEvent = typeof learningEvents.$inferSelect;
export type InsertLearningEvent = z.infer<typeof insertLearningEventSchema>;
export type PromptSuggestion = typeof promptSuggestions.$inferSelect;
export type InsertPromptSuggestion = z.infer<typeof insertPromptSuggestionSchema>;
export type PromptUpdate = typeof promptUpdates.$inferSelect;
export type InsertPromptUpdate = z.infer<typeof insertPromptUpdateSchema>;
export type SatisfactionFeedback = typeof satisfactionFeedback.$inferSelect;
export type InsertSatisfactionFeedback = z.infer<typeof insertSatisfactionFeedbackSchema>;
export type SuggestedResponse = typeof suggestedResponses.$inferSelect;
export type InsertSuggestedResponse = z.infer<typeof insertSuggestedResponseSchema>;
export type RegistrationRequest = typeof registrationRequests.$inferSelect;
export type InsertRegistrationRequest = z.infer<typeof insertRegistrationRequestSchema>;
