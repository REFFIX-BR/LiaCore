import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, index } from "drizzle-orm/pg-core";
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
  clientDocument: text("client_document"), // CPF ou CNPJ do cliente (para validação de segurança)
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
  evolutionInstance: text("evolution_instance"), // Nome da instância Evolution API (para multi-instância)
}, (table) => ({
  // Índices para performance em queries de dashboard e monitor
  lastMessageTimeIdx: index("conversations_last_message_time_idx").on(table.lastMessageTime),
  statusIdx: index("conversations_status_idx").on(table.status),
  statusLastMessageIdx: index("conversations_status_last_message_idx").on(table.status, table.lastMessageTime),
  assignedToIdx: index("conversations_assigned_to_idx").on(table.assignedTo),
  transferredToHumanIdx: index("conversations_transferred_idx").on(table.transferredToHuman),
}));

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  functionCall: jsonb("function_call"),
  assistant: text("assistant"),
  imageBase64: text("image_base64"), // Imagem em base64 (para exibição no chat)
}, (table) => ({
  // Índices para queries rápidas de mensagens e paginação
  conversationIdIdx: index("messages_conversation_id_idx").on(table.conversationId),
  conversationTimestampIdx: index("messages_conversation_timestamp_idx").on(table.conversationId, table.timestamp),
}));

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

export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // Identificador único da mensagem (ex: 'agent_welcome', 'nps_survey', etc)
  name: text("name").notNull(), // Nome amigável da mensagem
  description: text("description"), // Descrição do que é a mensagem
  template: text("template").notNull(), // Texto da mensagem com variáveis (ex: "Olá! Sou *{agentName}*, seu atendente")
  variables: text("variables").array().default(sql`'{}'::text[]`), // Lista de variáveis disponíveis (ex: ['agentName', 'clientName'])
  category: text("category").notNull(), // Categoria da mensagem (ex: 'assignment', 'nps', 'system')
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"), // User ID de quem fez a última atualização
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(), // 'login', 'logout'
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionDuration: integer("session_duration"), // Duração da sessão em segundos (apenas para logout)
  createdAt: timestamp("created_at").defaultNow(),
});

export const complaints = pgTable("complaints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(), // Referência à conversa da Ouvidoria
  complaintType: text("complaint_type").notNull(), // 'atendimento', 'produto', 'tecnico', 'comercial', 'financeiro', 'outro'
  severity: text("severity").notNull().default("media"), // 'baixa', 'media', 'alta', 'critica'
  description: text("description").notNull(), // Descrição completa da reclamação
  status: text("status").notNull().default("novo"), // 'novo', 'em_investigacao', 'resolvido', 'fechado'
  assignedTo: varchar("assigned_to"), // User ID do responsável pela investigação
  resolution: text("resolution"), // Resolução/resposta final
  resolutionNotes: text("resolution_notes"), // Notas adicionais sobre a resolução
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  metadata: jsonb("metadata"), // Dados adicionais (contexto, tags, etc)
});

export const trainingSessions = pgTable("training_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(), // Título da sessão de treinamento
  assistantType: text("assistant_type").notNull(), // Tipo de assistente sendo treinado
  trainingType: text("training_type").notNull(), // 'manual' (interface) ou 'conversation' (durante conversa)
  conversationId: varchar("conversation_id"), // ID da conversa (se foi durante uma conversa)
  content: text("content").notNull(), // Conteúdo do treinamento (instruções do supervisor)
  status: text("status").notNull().default("active"), // 'active' (em andamento), 'completed', 'applied'
  startedBy: varchar("started_by").notNull(), // User ID de quem iniciou
  completedBy: varchar("completed_by"), // User ID de quem finalizou
  appliedBy: varchar("applied_by"), // User ID de quem aplicou ao sistema
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  appliedAt: timestamp("applied_at"),
  notes: text("notes"), // Notas adicionais
  improvedPrompt: text("improved_prompt"), // Prompt melhorado gerado pela IA
  metadata: jsonb("metadata"), // Dados adicionais
}, (table) => ({
  statusIdx: index("training_sessions_status_idx").on(table.status),
  assistantTypeIdx: index("training_sessions_assistant_type_idx").on(table.assistantType),
}));

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

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  updatedAt: true,
});

export const updateMessageTemplateSchema = z.object({
  template: z.string().min(1, "Mensagem não pode estar vazia"),
  updatedBy: z.string().optional(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertComplaintSchema = createInsertSchema(complaints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
}).extend({
  complaintType: z.enum(["atendimento", "produto", "tecnico", "comercial", "financeiro", "outro"]),
  severity: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
  status: z.enum(["novo", "em_investigacao", "resolvido", "fechado"]).default("novo"),
});

export const updateComplaintSchema = z.object({
  complaintType: z.enum(["atendimento", "produto", "tecnico", "comercial", "financeiro", "outro"]).optional(),
  severity: z.enum(["baixa", "media", "alta", "critica"]).optional(),
  description: z.string().optional(),
  status: z.enum(["novo", "em_investigacao", "resolvido", "fechado"]).optional(),
  assignedTo: z.string().optional(),
  resolution: z.string().optional(),
  resolutionNotes: z.string().optional(),
  resolvedAt: z.date().optional(),
  updatedAt: z.date().optional(),
  metadata: z.any().optional(),
});

export const insertTrainingSessionSchema = createInsertSchema(trainingSessions).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  appliedAt: true,
  completedBy: true,
  appliedBy: true,
  improvedPrompt: true,
}).extend({
  assistantType: z.enum(["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento"]),
  trainingType: z.enum(["manual", "conversation"]),
  status: z.enum(["active", "completed", "applied"]).default("active"),
});

export const updateTrainingSessionSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  status: z.enum(["active", "completed", "applied"]).optional(),
  completedBy: z.string().optional(),
  appliedBy: z.string().optional(),
  completedAt: z.date().optional(),
  appliedAt: z.date().optional(),
  notes: z.string().optional(),
  improvedPrompt: z.string().optional(),
  metadata: z.any().optional(),
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
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type UpdateMessageTemplate = z.infer<typeof updateMessageTemplateSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type UpdateComplaint = z.infer<typeof updateComplaintSchema>;
export type TrainingSession = typeof trainingSessions.$inferSelect;
export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;
export type UpdateTrainingSession = z.infer<typeof updateTrainingSessionSchema>;
