import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, index, serial } from "drizzle-orm/pg-core";
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

// Department enum
export const Department = {
  COMMERCIAL: "commercial",
  SUPPORT: "support",
  FINANCIAL: "financial",
  CANCELLATION: "cancellation",
  GENERAL: "general",
} as const;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").unique(), // Added for user invites
  role: text("role").notNull().default("AGENT"), // 'ADMIN', 'SUPERVISOR', or 'AGENT'
  status: text("status").notNull().default("ACTIVE"), // 'ACTIVE' or 'INACTIVE'
  departments: text("departments").array().default(sql`'{general}'::text[]`), // Departamentos do atendente: 'commercial', 'support', 'financial', 'cancellation', 'general'
  participatesInGamification: boolean("participates_in_gamification").default(true), // Se o usuário participa do ranking de gamificação
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
  department: text("department").default("general"), // Departamento responsável: 'commercial', 'support', 'financial', 'cancellation', 'general'
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
  resolvedBy: varchar("resolved_by"), // User ID of who resolved the conversation
  resolvedAt: timestamp("resolved_at"),
  resolutionTime: integer("resolution_time"), // Time in seconds from transfer to resolution
  evolutionInstance: text("evolution_instance"), // Nome da instância Evolution API (para multi-instância)
  autoClosed: boolean("auto_closed").default(false), // Se a conversa foi encerrada automaticamente por inatividade
  autoClosedReason: text("auto_closed_reason"), // Motivo do encerramento automático (ex: 'inactivity')
  autoClosedAt: timestamp("auto_closed_at"), // Quando a conversa foi encerrada automaticamente
  verifiedAt: timestamp("verified_at"), // Quando a conversa foi verificada pelo supervisor
  verifiedBy: varchar("verified_by"), // ID do supervisor que verificou
  lastCoverageCheck: jsonb("last_coverage_check"), // Resultado da última verificação de cobertura via buscar_cep (para validação de vendas)
  conversationSource: text("conversation_source").default("inbound"), // Origem da conversa: 'inbound' (recebida), 'voice_campaign' (voz ativa), 'whatsapp_campaign' (WhatsApp ativo)
  voiceCampaignTargetId: varchar("voice_campaign_target_id"), // ID do target de campanha de cobrança (se aplicável)
}, (table) => ({
  // Índices para performance em queries de dashboard e monitor
  lastMessageTimeIdx: index("conversations_last_message_time_idx").on(table.lastMessageTime),
  statusIdx: index("conversations_status_idx").on(table.status),
  statusLastMessageIdx: index("conversations_status_last_message_idx").on(table.status, table.lastMessageTime),
  assignedToIdx: index("conversations_assigned_to_idx").on(table.assignedTo),
  transferredToHumanIdx: index("conversations_transferred_idx").on(table.transferredToHuman),
  departmentIdx: index("conversations_department_idx").on(table.department),
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
  pdfBase64: text("pdf_base64"), // PDF em base64 (para download)
  pdfName: text("pdf_name"), // Nome do arquivo PDF
  audioUrl: text("audio_url"), // URL do áudio original (WhatsApp/Evolution API)
  audioBase64: text("audio_base64"), // Áudio em base64 (para envio via API)
  videoUrl: text("video_url"), // URL do vídeo original (WhatsApp/Evolution API)
  videoName: text("video_name"), // Nome do arquivo de vídeo
  videoMimetype: text("video_mimetype"), // Tipo MIME do vídeo (video/mp4, etc.)
  whatsappMessageId: text("whatsapp_message_id"), // ID da mensagem no WhatsApp (para deletar)
  remoteJid: text("remote_jid"), // JID do chat WhatsApp (necessário para deletar)
  isPrivate: boolean("is_private").default(false), // Mensagens privadas (notas internas, não enviadas ao cliente)
  sendBy: text("send_by"), // Identificador de quem enviou (supervisor, agent, ai, client)
  deletedAt: timestamp("deleted_at"), // Quando a mensagem foi deletada (soft delete)
  deletedBy: text("deleted_by"), // Quem deletou a mensagem
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
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'applied', 'consolidated'
  reviewedBy: text("reviewed_by"),
  reviewNotes: text("review_notes"),
  appliedInVersion: varchar("applied_in_version"), // Versão do prompt em que foi aplicada (ex: "1.4.0")
  consolidatedWith: text("consolidated_with").array(), // IDs de outras sugestões consolidadas junto com esta
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
  handlingScore: integer("handling_score"), // 1-5 (nota da tratativa)
  handlingStatus: text("handling_status").default("pending"), // 'pending', 'in_progress', 'resolved'
  handlingNotes: text("handling_notes"), // Observações sobre a tratativa
  handledBy: varchar("handled_by"), // User ID de quem tratou
  handledAt: timestamp("handled_at"), // Quando foi tratado
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
  action: text("action").notNull(), // 'login', 'logout', 'transfer_conversation', 'resolve_conversation', 'assign_conversation', 'verify_conversation', 'self_assign'
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionDuration: integer("session_duration"), // Duração da sessão em segundos (apenas para logout)
  conversationId: varchar("conversation_id"), // ID da conversa relacionada (quando aplicável)
  targetUserId: varchar("target_user_id"), // ID do usuário alvo (ex: para quem transferiu)
  details: jsonb("details"), // Detalhes adicionais da ação (motivo de transferência, etc)
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
  departments: z.array(z.string()).optional(),
  participatesInGamification: z.boolean().optional(),
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
  handlingScore: true, // Handling fields are managed separately via update API
  handlingStatus: true,
  handlingNotes: true,
  handledBy: true,
  handledAt: true,
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
  assistantType: z.enum(["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento", "cobranca"]),
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
export type Complaint = typeof complaints.$inferSelect & {
  clientName?: string | null; // Nome do cliente da conversa relacionada
  chatId?: string | null; // Chat ID (contém telefone) da conversa relacionada
};
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type UpdateComplaint = z.infer<typeof updateComplaintSchema>;
export type TrainingSession = typeof trainingSessions.$inferSelect;
export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;
export type UpdateTrainingSession = z.infer<typeof updateTrainingSessionSchema>;

// RAG Analytics Table
export const ragAnalytics = pgTable("rag_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  assistantType: text("assistant_type").notNull(), // Qual assistant usou RAG
  query: text("query").notNull(), // Query enviada para busca
  resultsCount: integer("results_count").notNull(), // Quantos chunks foram retornados
  resultsFound: boolean("results_found").notNull(), // Se encontrou resultados ou não
  sources: jsonb("sources"), // Array de sources dos chunks retornados
  executionTime: integer("execution_time"), // Tempo de execução em ms (opcional)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  conversationIdIdx: index("rag_analytics_conversation_id_idx").on(table.conversationId),
  assistantTypeIdx: index("rag_analytics_assistant_type_idx").on(table.assistantType),
  createdAtIdx: index("rag_analytics_created_at_idx").on(table.createdAt),
}));

export const insertRagAnalyticsSchema = createInsertSchema(ragAnalytics).omit({
  id: true,
  createdAt: true,
});

export type RagAnalytics = typeof ragAnalytics.$inferSelect;
export type InsertRagAnalytics = z.infer<typeof insertRagAnalyticsSchema>;

// Contacts Table - Customer/Client Management
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull().unique(), // WhatsApp number (chatId without @s.whatsapp.net)
  name: text("name"), // Client name (when identified)
  document: text("document"), // CPF or CNPJ (when verified)
  lastConversationId: varchar("last_conversation_id"), // Reference to last conversation
  lastConversationDate: timestamp("last_conversation_date"), // When last interacted
  totalConversations: integer("total_conversations").notNull().default(0),
  hasRecurringIssues: boolean("has_recurring_issues").notNull().default(false),
  status: text("status").notNull().default("active"), // 'active' or 'inactive'
  metadata: jsonb("metadata"), // Extra information (problems history, notes, etc)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  phoneNumberIdx: index("contacts_phone_number_idx").on(table.phoneNumber),
  documentIdx: index("contacts_document_idx").on(table.document),
  statusIdx: index("contacts_status_idx").on(table.status),
  lastConversationDateIdx: index("contacts_last_conversation_date_idx").on(table.lastConversationDate),
}));

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateContactSchema = insertContactSchema.partial();

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;

// Groups Table - WhatsApp Groups Management
export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: text("group_id").notNull().unique(), // WhatsApp Group ID (ex: 1234567890@g.us)
  name: text("name").notNull(), // Group name
  avatar: text("avatar"), // Group avatar/photo URL
  aiEnabled: boolean("ai_enabled").notNull().default(false), // IA ativa/inativa no grupo
  evolutionInstance: text("evolution_instance"), // Evolution API instance name
  lastMessageTime: timestamp("last_message_time"), // Última mensagem recebida
  lastMessage: text("last_message"), // Última mensagem recebida (preview)
  participantsCount: integer("participants_count").default(0), // Número de participantes
  metadata: jsonb("metadata"), // Informações extras (descrição, admin, etc)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  groupIdIdx: index("groups_group_id_idx").on(table.groupId),
  aiEnabledIdx: index("groups_ai_enabled_idx").on(table.aiEnabled),
  lastMessageTimeIdx: index("groups_last_message_time_idx").on(table.lastMessageTime),
}));

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateGroupSchema = insertGroupSchema.partial();

export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type UpdateGroup = z.infer<typeof updateGroupSchema>;

// Private Notes Table - Internal notes for agents about conversations
export const privateNotes = pgTable("private_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(), // Conversation this note belongs to
  content: text("content").notNull(), // Note content
  createdBy: varchar("created_by").notNull(), // User ID who created the note
  createdByName: text("created_by_name"), // User's full name (for display)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  conversationIdIdx: index("private_notes_conversation_id_idx").on(table.conversationId),
  createdAtIdx: index("private_notes_created_at_idx").on(table.createdAt),
}));

export const insertPrivateNoteSchema = createInsertSchema(privateNotes).omit({
  id: true,
  createdAt: true,
});

export type PrivateNote = typeof privateNotes.$inferSelect;
export type InsertPrivateNote = z.infer<typeof insertPrivateNoteSchema>;

// Plans Table - Internet/Combo Plans
export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), // UUID gerado automaticamente
  name: text("name").notNull(), // Ex: "50 Mega", "650 Mega", "1 Giga"
  type: text("type").notNull(), // "internet" ou "combo"
  downloadSpeed: integer("download_speed").notNull(), // Velocidade de download em Mbps (50, 650, 1000)
  uploadSpeed: integer("upload_speed").notNull(), // Velocidade de upload em Mbps (25, 300, 500)
  price: integer("price").notNull(), // Preço em centavos (6990, 10990, 14990)
  description: text("description"), // Descrição do plano
  features: text("features").array().default(sql`'{}'::text[]`), // Benefícios/features do plano
  isActive: boolean("is_active").notNull().default(true), // Se está disponível para venda
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  isActiveIdx: index("plans_is_active_idx").on(table.isActive),
}));

// Sales Table - Customer Sales/Leads
export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // "PF" (Pessoa Física) ou "PJ" (Pessoa Jurídica)
  
  // Customer Data - Pessoa Física
  customerName: text("customer_name"), // Nome completo (PF) ou Razão Social (PJ)
  cpfCnpj: text("cpf_cnpj"), // CPF ou CNPJ
  email: text("email"),
  phone: text("phone").notNull(), // Telefone principal
  phone2: text("phone2"), // Telefone secundário
  
  // Dados complementares PF
  motherName: text("mother_name"), // Nome da mãe
  birthDate: text("birth_date"), // Data de nascimento (YYYY-MM-DD)
  rg: text("rg"), // RG
  sex: text("sex"), // "M" ou "F"
  civilStatus: text("civil_status"), // "S", "C", "V", "O"
  
  // Dados complementares PJ
  companyName: text("company_name"), // Nome fantasia
  stateRegistration: text("state_registration"), // Inscrição estadual
  cityRegistration: text("city_registration"), // Inscrição municipal
  
  // Address
  cep: text("cep"),
  address: text("address"), // Logradouro
  number: text("number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"), // UF
  reference: text("reference"), // Ponto de referência
  
  // Service
  planId: varchar("plan_id"), // Referência ao plano (opcional para leads de prospecção)
  billingDay: integer("billing_day"), // Dia de vencimento (5, 10 ou 15)
  preferredInstallDate: text("preferred_install_date"), // Data preferida instalação
  availability: text("availability"), // "Manhã", "Tarde", "Comercial"
  
  // Lead/Sale Management
  status: text("status").notNull().default("Aguardando Análise"), 
  // "Prospecção", "Aguardando Análise", "Aprovado", "Agendado para Instalação", 
  // "Instalado", "Cancelado", "Inadimplente"
  source: text("source").notNull().default("chat"), // "chat", "site", "manual"
  seller: text("seller").default("Site"), // Nome do vendedor ou "Site"
  conversationId: varchar("conversation_id"), // Referência à conversa de origem
  howDidYouKnow: text("how_did_you_know"), // Como conheceu a TR Telecom (indicação, google, facebook, etc)
  
  // Tracking
  pendingItems: text("pending_items").array().default(sql`'{}'::text[]`), // Itens pendentes
  observations: text("observations"), // Observações especiais
  notes: text("notes"), // Notas internas da equipe comercial
  
  // UTM Parameters (para rastreamento de origem)
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  
  // Metadata
  metadata: jsonb("metadata"), // Dados adicionais flexíveis
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("sales_status_idx").on(table.status),
  planIdIdx: index("sales_plan_id_idx").on(table.planId),
  phoneIdx: index("sales_phone_idx").on(table.phone),
  cpfCnpjIdx: index("sales_cpf_cnpj_idx").on(table.cpfCnpj),
  conversationIdIdx: index("sales_conversation_id_idx").on(table.conversationId),
  createdAtIdx: index("sales_created_at_idx").on(table.createdAt),
}));

export const insertPlanSchema = createInsertSchema(plans).omit({
  createdAt: true,
  updatedAt: true,
});

export const updatePlanSchema = insertPlanSchema.partial();

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  type: z.enum(["PF", "PJ"]),
  status: z.enum([
    "Prospecção",
    "Aguardando Análise",
    "Aprovado",
    "Agendado para Instalação",
    "Instalado",
    "Cancelado",
    "Inadimplente"
  ]).default("Aguardando Análise"),
  source: z.enum(["chat", "site", "manual"]).default("chat"),
});

export const updateSaleSchema = insertSaleSchema.partial();

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type UpdatePlan = z.infer<typeof updatePlanSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type UpdateSale = z.infer<typeof updateSaleSchema>;

// ==================== MÓDULO DE FALHA MASSIVA ====================

// Tabela de Regiões (Estados, Cidades, Bairros)
export const regions = pgTable("regions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  state: text("state").notNull(), // Estado (ex: "RJ")
  city: text("city").notNull(), // Cidade (ex: "TRES RIOS")
  neighborhood: text("neighborhood").notNull(), // Bairro (ex: "CANTAGALO")
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Índices para busca rápida por localização
  stateIdx: index("regions_state_idx").on(table.state),
  cityIdx: index("regions_city_idx").on(table.city),
  neighborhoodIdx: index("regions_neighborhood_idx").on(table.neighborhood),
  // Índice composto para busca completa
  locationIdx: index("regions_location_idx").on(table.state, table.city, table.neighborhood),
}));

// Tabela de Falhas Massivas
export const massiveFailures = pgTable("massive_failures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Nome interno da falha
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'active', 'resolved', 'cancelled'
  severity: text("severity").notNull().default("medium"), // 'low', 'medium', 'high', 'critical'
  
  notificationMessage: text("notification_message").notNull(), // Mensagem enviada ao cliente
  resolutionMessage: text("resolution_message"), // Mensagem opcional de resolução
  
  // Regiões afetadas: Array de IDs de regions OU estrutura JSON livre para regiões customizadas
  // Formato JSON: { type: 'predefined' | 'custom', regionIds?: string[], custom?: [{city, neighborhoods[]}] }
  // NOTA: neighborhoods[] pode estar VAZIO para indicar falha que afeta CIDADE INTEIRA (não apenas bairros específicos)
  // Exemplos:
  //   - Falha específica: {city: "Chiador", neighborhoods: ["CENTRO", "PENHA LONGA"]}
  //   - Falha geral: {city: "Chiador", neighborhoods: []} (afeta TODA a cidade)
  affectedRegions: jsonb("affected_regions").notNull(),
  
  estimatedResolution: timestamp("estimated_resolution"), // Previsão de normalização
  autoResolve: boolean("auto_resolve").default(false), // Resolver automaticamente após estimatedResolution
  
  startTime: timestamp("start_time").notNull(), // Quando a falha começa/começou
  endTime: timestamp("end_time"), // Quando a falha foi resolvida
  
  createdBy: varchar("created_by").notNull(), // ID do usuário que criou
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Índices para queries de falhas ativas e histórico
  statusIdx: index("massive_failures_status_idx").on(table.status),
  startTimeIdx: index("massive_failures_start_time_idx").on(table.startTime),
  createdByIdx: index("massive_failures_created_by_idx").on(table.createdBy),
}));

// Tabela de Notificações de Falha (rastreamento de quem foi notificado)
export const failureNotifications = pgTable("failure_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  failureId: varchar("failure_id").notNull(), // Referência à falha
  contactId: varchar("contact_id"), // ID do contato (se disponível)
  conversationId: varchar("conversation_id"), // ID da conversa
  clientPhone: text("client_phone").notNull(), // Telefone do cliente notificado
  
  notificationType: text("notification_type").notNull(), // 'failure' ou 'resolution'
  messageSent: text("message_sent").notNull(), // Conteúdo da mensagem enviada
  
  sentAt: timestamp("sent_at").defaultNow(),
  wasRead: boolean("was_read").default(false), // Se o cliente leu/respondeu
  clientResponse: text("client_response"), // Primeira resposta do cliente após notificação
  respondedAt: timestamp("responded_at"), // Quando o cliente respondeu
}, (table) => ({
  // Índices para rastreamento e relatórios
  failureIdIdx: index("failure_notifications_failure_id_idx").on(table.failureId),
  contactIdIdx: index("failure_notifications_contact_id_idx").on(table.contactId),
  conversationIdIdx: index("failure_notifications_conversation_id_idx").on(table.conversationId),
  clientPhoneIdx: index("failure_notifications_client_phone_idx").on(table.clientPhone),
  sentAtIdx: index("failure_notifications_sent_at_idx").on(table.sentAt),
}));

// ==================== MÓDULO DE ANÚNCIOS/COMUNICADOS ====================

// Tabela de Anúncios da Empresa
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(), // Título do anúncio
  message: text("message").notNull(), // Mensagem completa
  type: text("type").notNull().default("info"), // 'info', 'warning', 'alert', 'success'
  priority: integer("priority").notNull().default(0), // Prioridade (maior = mais importante)
  active: boolean("active").notNull().default(true), // Se está ativo
  
  startDate: timestamp("start_date").defaultNow(), // Quando começa a exibir
  endDate: timestamp("end_date"), // Quando para de exibir (opcional)
  
  createdBy: varchar("created_by").notNull(), // ID do usuário que criou
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  activeIdx: index("announcements_active_idx").on(table.active),
  priorityIdx: index("announcements_priority_idx").on(table.priority),
  startDateIdx: index("announcements_start_date_idx").on(table.startDate),
}));

// Zod Schemas
export const insertRegionSchema = createInsertSchema(regions).omit({
  id: true,
  createdAt: true,
});

export const insertMassiveFailureSchema = createInsertSchema(massiveFailures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["scheduled", "active", "resolved", "cancelled"]).default("scheduled"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  affectedRegions: z.any(), // Validação customizada no backend
});

export const updateMassiveFailureSchema = insertMassiveFailureSchema.partial();

export const insertFailureNotificationSchema = createInsertSchema(failureNotifications).omit({
  id: true,
  sentAt: true,
  wasRead: true,
  respondedAt: true,
}).extend({
  notificationType: z.enum(["failure", "resolution"]),
});

// Types
export type Region = typeof regions.$inferSelect;
export type InsertRegion = z.infer<typeof insertRegionSchema>;

export type MassiveFailure = typeof massiveFailures.$inferSelect;
export type InsertMassiveFailure = z.infer<typeof insertMassiveFailureSchema>;
export type UpdateMassiveFailure = z.infer<typeof updateMassiveFailureSchema>;

export type FailureNotification = typeof failureNotifications.$inferSelect;
export type InsertFailureNotification = z.infer<typeof insertFailureNotificationSchema>;

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  type: z.enum(["info", "warning", "alert", "success"]).default("info"),
  priority: z.number().int().min(0).default(0),
});

export const updateAnnouncementSchema = insertAnnouncementSchema.partial();

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type UpdateAnnouncement = z.infer<typeof updateAnnouncementSchema>;

// ========================
// PROMPT MANAGEMENT SYSTEM
// ========================

// Assistant Type enum (matches the 6 assistants)
export const AssistantType = {
  APRESENTACAO: "apresentacao",
  COMERCIAL: "comercial",
  SUPORTE: "suporte",
  FINANCEIRO: "financeiro",
  OUVIDORIA: "ouvidoria",
  CANCELAMENTO: "cancelamento",
} as const;

// Prompt Status enum
export const PromptStatus = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

// Prompt Templates - Main table storing current prompts for each assistant
export const promptTemplates = pgTable("prompt_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assistantId: text("assistant_id").notNull().unique(), // OpenAI Assistant ID (ex: asst_oY50Ec5BKQzIzWcnYEo2meFc)
  assistantType: text("assistant_type").notNull(), // 'apresentacao', 'comercial', etc
  title: text("title").notNull(), // Ex: "Prompt do Assistente de Suporte"
  content: text("content").notNull(), // O prompt completo
  status: text("status").notNull().default("active"), // 'active' or 'archived'
  version: text("version").notNull().default("1.0.0"), // Semantic versioning (major.minor.patch)
  tokenCount: integer("token_count").default(0), // Contagem de tokens (para validação)
  lastSyncedAt: timestamp("last_synced_at"), // Última vez que foi sincronizado com OpenAI
  lastSyncError: text("last_sync_error"), // Último erro de sincronização (null se sucesso)
  createdBy: varchar("created_by").notNull(), // User ID who created
  updatedBy: varchar("updated_by"), // User ID who last updated
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  assistantTypeIdx: index("prompt_templates_assistant_type_idx").on(table.assistantType),
  statusIdx: index("prompt_templates_status_idx").on(table.status),
}));

// Prompt Versions - Immutable version history (snapshot-based)
export const promptVersions = pgTable("prompt_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promptId: varchar("prompt_id").notNull(), // Reference to promptTemplates.id
  content: text("content").notNull(), // Snapshot do prompt nesta versão
  version: text("version").notNull(), // Semantic versioning (ex: 2.3.1)
  versionNotes: text("version_notes"), // Notas da versão (ex: "Melhorou tom de voz")
  tokenCount: integer("token_count").default(0),
  aiSuggestions: jsonb("ai_suggestions"), // Sugestões da IA que geraram esta versão
  createdBy: varchar("created_by").notNull(), // User ID who created this version
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  promptIdIdx: index("prompt_versions_prompt_id_idx").on(table.promptId),
  createdAtIdx: index("prompt_versions_created_at_idx").on(table.createdAt),
}));

// Prompt Drafts - Work-in-progress edits (not yet published)
export const promptDrafts = pgTable("prompt_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promptId: varchar("prompt_id").notNull().unique(), // One draft per prompt
  draftContent: text("draft_content").notNull(), // O rascunho sendo editado
  aiSuggestions: jsonb("ai_suggestions"), // Últimas sugestões da IA
  tokenCount: integer("token_count").default(0),
  preConsolidationContent: text("pre_consolidation_content"), // Conteúdo antes da última consolidação (para highlight de mudanças)
  lastEditedBy: varchar("last_edited_by").notNull(), // User ID who last edited
  lastEditedAt: timestamp("last_edited_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  promptIdIdx: index("prompt_drafts_prompt_id_idx").on(table.promptId),
}));

// Context Quality Alerts - Monitoring de qualidade de contexto das conversas
export const contextQualityAlerts = pgTable("context_quality_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  alertType: text("alert_type").notNull(), // 'duplicate_data_request', 'ignored_history', 'duplicate_routing', 'context_reset'
  severity: text("severity").notNull(), // 'low', 'medium', 'high'
  description: text("description").notNull(),
  assistantType: text("assistant_type"), // Tipo do assistente que gerou o alerta
  metadata: jsonb("metadata"), // Dados adicionais do alerta
  detectedAt: timestamp("detected_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"), // Quando o alerta foi consolidado/resolvido
}, (table) => ({
  conversationIdIdx: index("context_quality_alerts_conversation_id_idx").on(table.conversationId),
  detectedAtIdx: index("context_quality_alerts_detected_at_idx").on(table.detectedAt),
  assistantTypeIdx: index("context_quality_alerts_assistant_type_idx").on(table.assistantType),
  alertTypeIdx: index("context_quality_alerts_alert_type_idx").on(table.alertType),
}));

// Insert Schemas
export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  assistantType: z.enum(["apresentacao", "comercial", "suporte", "financeiro", "ouvidoria", "cancelamento", "cobranca"]),
  status: z.enum(["active", "archived"]).default("active"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default("1.0.0"), // Semantic version pattern
});

export const updatePromptTemplateSchema = insertPromptTemplateSchema.partial();

export const insertPromptVersionSchema = createInsertSchema(promptVersions).omit({
  id: true,
  createdAt: true,
}).extend({
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semantic version pattern
});

export const insertPromptDraftSchema = createInsertSchema(promptDrafts).omit({
  id: true,
  createdAt: true,
  lastEditedAt: true,
});

export const updatePromptDraftSchema = insertPromptDraftSchema.partial();

// Types
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
export type UpdatePromptTemplate = z.infer<typeof updatePromptTemplateSchema>;

export type PromptVersion = typeof promptVersions.$inferSelect;
export type InsertPromptVersion = z.infer<typeof insertPromptVersionSchema>;

export type PromptDraft = typeof promptDrafts.$inferSelect;
export type InsertPromptDraft = z.infer<typeof insertPromptDraftSchema>;
export type UpdatePromptDraft = z.infer<typeof updatePromptDraftSchema>;

// Context Quality Alerts Schemas
export const insertContextQualityAlertSchema = createInsertSchema(contextQualityAlerts).omit({
  id: true,
  detectedAt: true,
}).extend({
  alertType: z.enum(["duplicate_data_request", "ignored_history", "duplicate_routing", "context_reset"]),
  severity: z.enum(["low", "medium", "high"]),
});

export type ContextQualityAlert = typeof contextQualityAlerts.$inferSelect;
export type InsertContextQualityAlert = z.infer<typeof insertContextQualityAlertSchema>;

// ========================
// GAMIFICATION SYSTEM
// ========================

// Badge Type enum
export const BadgeType = {
  SOLUCIONADOR: "solucionador", // Alto NPS + alta taxa de resolução
  VELOCISTA: "velocista", // Tempo médio de resposta rápido mantendo NPS >7
  CAMPEAO_VOLUME: "campeao_volume", // Maior número de atendimentos finalizados
} as const;

// Gamification Scores - Pontuação mensal dos atendentes
export const gamificationScores = pgTable("gamification_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull(), // User ID do atendente
  period: text("period").notNull(), // Período no formato YYYY-MM (ex: "2025-01")
  totalConversations: integer("total_conversations").default(0), // Total de conversas resolvidas
  avgNps: integer("avg_nps").default(0), // NPS médio (0-10)
  successRate: integer("success_rate").default(0), // Taxa de sucesso baseada em sentimento (0-100)
  avgResponseTime: integer("avg_response_time").default(0), // Tempo médio de resposta em segundos
  volumeScore: integer("volume_score").default(0), // Pontuação de volume (normalizada 0-100)
  npsScore: integer("nps_score").default(0), // Pontuação de NPS (normalizada 0-100)
  resolutionScore: integer("resolution_score").default(0), // Pontuação de resolução (0-100)
  timeScore: integer("time_score").default(0), // Pontuação de tempo (0-100)
  totalScore: integer("total_score").default(0), // Pontuação total ponderada (40% NPS + 30% Volume + 20% Resolução + 10% Tempo)
  ranking: integer("ranking"), // Posição no ranking (1-N)
  calculatedAt: timestamp("calculated_at").defaultNow(), // Quando foi calculado
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  agentPeriodIdx: index("gamification_scores_agent_period_idx").on(table.agentId, table.period),
  periodIdx: index("gamification_scores_period_idx").on(table.period),
  totalScoreIdx: index("gamification_scores_total_score_idx").on(table.totalScore),
}));

// Gamification Badges - Badges conquistados pelos atendentes
export const gamificationBadges = pgTable("gamification_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull(), // User ID do atendente
  badgeType: text("badge_type").notNull(), // 'solucionador', 'velocista', 'campeao_volume'
  period: text("period").notNull(), // Período no formato YYYY-MM (ex: "2025-01")
  metric: integer("metric"), // Valor da métrica que conquistou o badge
  awardedAt: timestamp("awarded_at").defaultNow(),
}, (table) => ({
  agentIdIdx: index("gamification_badges_agent_id_idx").on(table.agentId),
  periodIdx: index("gamification_badges_period_idx").on(table.period),
  badgeTypeIdx: index("gamification_badges_badge_type_idx").on(table.badgeType),
}));

// Gamification History - Histórico de vencedores mensais (Top 5)
export const gamificationHistory = pgTable("gamification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  period: text("period").notNull(), // Período no formato YYYY-MM (ex: "2025-01")
  agentId: varchar("agent_id").notNull(), // User ID do vencedor
  ranking: integer("ranking").notNull(), // Posição no Top 5 (1-5)
  totalScore: integer("total_score").notNull(), // Pontuação final
  metrics: jsonb("metrics"), // Snapshot das métricas (volume, NPS, resolução, tempo)
  badges: text("badges").array(), // Badges conquistados naquele mês
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  periodIdx: index("gamification_history_period_idx").on(table.period),
  agentIdIdx: index("gamification_history_agent_id_idx").on(table.agentId),
  rankingIdx: index("gamification_history_ranking_idx").on(table.ranking),
}));

// Insert Schemas
export const insertGamificationScoreSchema = createInsertSchema(gamificationScores).omit({
  id: true,
  createdAt: true,
  calculatedAt: true,
});

export const insertGamificationBadgeSchema = createInsertSchema(gamificationBadges).omit({
  id: true,
  awardedAt: true,
}).extend({
  badgeType: z.enum(["solucionador", "velocista", "campeao_volume"]),
});

export const insertGamificationHistorySchema = createInsertSchema(gamificationHistory).omit({
  id: true,
  createdAt: true,
});

// Gamification Settings - Configurações globais do sistema (singleton - apenas 1 registro)
export const gamificationSettings = pgTable("gamification_settings", {
  id: serial("id").primaryKey(), // Sempre id=1 (singleton)
  
  // Pesos da Fórmula de Pontuação (devem somar 100)
  npsWeight: integer("nps_weight").notNull().default(40), // Peso do NPS (padrão: 40%)
  volumeWeight: integer("volume_weight").notNull().default(30), // Peso do volume (padrão: 30%)
  resolutionWeight: integer("resolution_weight").notNull().default(20), // Peso da resolução (padrão: 20%)
  responseTimeWeight: integer("response_time_weight").notNull().default(10), // Peso do tempo (padrão: 10%)
  
  // Critérios dos Badges
  solucionadorNpsMin: integer("solucionador_nps_min").notNull().default(7), // NPS mínimo para Solucionador
  solucionadorResolutionMin: integer("solucionador_resolution_min").notNull().default(70), // % resolução mínima
  velocistaNpsMin: integer("velocista_nps_min").notNull().default(7), // NPS mínimo para Velocista
  velocistaTopN: integer("velocista_top_n").notNull().default(1), // Quantos ganham badge Velocista (Top N)
  campeaoVolumeTopN: integer("campeao_volume_top_n").notNull().default(1), // Quantos ganham badge Campeão (Top N)
  
  // Metas Mensais
  targetNps: integer("target_nps").default(8), // Meta de NPS médio da equipe
  targetResolution: integer("target_resolution").default(85), // Meta de % de resolução
  targetResponseTime: integer("target_response_time").default(120), // Meta de tempo médio em segundos
  targetVolume: integer("target_volume").default(500), // Meta de volume total de conversas
  
  // Período de Cálculo
  calculationPeriod: text("calculation_period").notNull().default("monthly"), // 'weekly', 'monthly', 'quarterly', 'custom'
  
  // Automação
  autoCalculate: boolean("auto_calculate").notNull().default(false), // Se o cálculo é automático
  calculationFrequency: text("calculation_frequency").default("monthly"), // 'daily', 'weekly', 'monthly', 'custom'
  calculationDayOfMonth: integer("calculation_day_of_month").default(1), // Dia do mês para calcular (1-31)
  calculationDayOfWeek: integer("calculation_day_of_week").default(1), // Dia da semana (1=segunda, 7=domingo)
  calculationTime: text("calculation_time").default("00:00"), // Horário do cálculo (HH:MM)
  
  // Auditoria
  updatedBy: varchar("updated_by"), // User ID que fez a última alteração
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert/Update Schema para configurações
export const updateGamificationSettingsSchema = createInsertSchema(gamificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  calculationPeriod: z.enum(["weekly", "monthly", "quarterly", "custom"]).default("monthly"),
  calculationFrequency: z.enum(["daily", "weekly", "monthly", "custom"]).default("monthly"),
  autoCalculate: z.boolean().default(false),
  // Validação: pesos devem somar 100
  npsWeight: z.number().int().min(0).max(100),
  volumeWeight: z.number().int().min(0).max(100),
  resolutionWeight: z.number().int().min(0).max(100),
  responseTimeWeight: z.number().int().min(0).max(100),
}).refine(
  (data) => data.npsWeight + data.volumeWeight + data.resolutionWeight + data.responseTimeWeight === 100,
  { message: "A soma dos pesos deve ser exatamente 100%" }
);

// Types
export type GamificationScore = typeof gamificationScores.$inferSelect;
export type InsertGamificationScore = z.infer<typeof insertGamificationScoreSchema>;

export type GamificationBadge = typeof gamificationBadges.$inferSelect;
export type InsertGamificationBadge = z.infer<typeof insertGamificationBadgeSchema>;

export type GamificationHistory = typeof gamificationHistory.$inferSelect;
export type InsertGamificationHistory = z.infer<typeof insertGamificationHistorySchema>;

export type GamificationSettings = typeof gamificationSettings.$inferSelect;
export type UpdateGamificationSettings = z.infer<typeof updateGamificationSettingsSchema>;

// ============================================================================
// COBRANÇAS - Módulo de Cobrança Ativa por Telefone
// ============================================================================

// Feature Flags - Sistema de controle de features
export const voiceFeatureFlags = pgTable("voice_feature_flags", {
  key: text("key").primaryKey(), // 'voice_outbound_enabled', 'voice_scheduler_enabled', etc.
  isEnabled: boolean("is_enabled").notNull().default(false),
  metadata: jsonb("metadata"), // Configurações adicionais da feature
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Voice Campaigns - Campanhas de cobrança ativa
export const voiceCampaigns = pgTable("voice_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Nome da campanha
  description: text("description"), // Descrição/objetivo
  status: text("status").notNull().default("draft"), // 'draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'
  strategy: text("strategy").notNull().default("sequential"), // 'sequential', 'priority', 'random'
  
  // Configurações de tentativas
  maxAttempts: integer("max_attempts").notNull().default(3), // Máximo de tentativas por cliente
  attemptSpacingMinutes: integer("attempt_spacing_minutes").notNull().default(120), // Intervalo mínimo entre tentativas (2 horas)
  
  // Horários permitidos (compliance ANATEL)
  activeHours: jsonb("active_hours").notNull().default({
    start: "08:00",
    end: "20:00",
    timezone: "America/Sao_Paulo",
    daysOfWeek: [1, 2, 3, 4, 5, 6] // 1=segunda, 7=domingo
  }),
  
  // Período da campanha
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  
  // Estatísticas
  totalTargets: integer("total_targets").default(0),
  contactedTargets: integer("contacted_targets").default(0),
  successfulContacts: integer("successful_contacts").default(0), // Conversas completadas
  promisesMade: integer("promises_made").default(0), // Promessas de pagamento
  promisesFulfilled: integer("promises_fulfilled").default(0), // Promessas cumpridas
  
  // Configuração de métodos de contato (override da configuração global)
  allowedMethods: text("allowed_methods").array(), // ['voice', 'whatsapp'] ou null para usar config global
  fallbackOrder: text("fallback_order").array(), // ['voice', 'whatsapp'] ordem de fallback ou null para usar config global
  
  // Auditoria
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  startedAt: timestamp("started_at"), // Quando a campanha iniciou execução
  completedAt: timestamp("completed_at"), // Quando a campanha finalizou
}, (table) => ({
  statusIdx: index("voice_campaigns_status_idx").on(table.status),
  createdByIdx: index("voice_campaigns_created_by_idx").on(table.createdBy),
}));

// Voice Campaign Targets - Alvos/clientes de cada campanha
export const voiceCampaignTargets = pgTable("voice_campaign_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => voiceCampaigns.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").references(() => contacts.id), // FK para contacts (cliente)
  
  // Dados do devedor (pode vir do CRM)
  phoneNumber: text("phone_number").notNull(), // Telefone principal
  alternativePhones: text("alternative_phones").array(), // Telefones alternativos
  contactMethod: text("contact_method").notNull().default("voice"), // 'whatsapp' | 'voice' - Método de contato preferencial
  debtorName: text("debtor_name").notNull(),
  debtorDocument: text("debtor_document"), // CPF/CNPJ
  debtAmount: integer("debt_amount"), // Valor da dívida em centavos
  dueDate: timestamp("due_date"), // Data de vencimento
  debtorMetadata: jsonb("debtor_metadata"), // Outros dados do CRM (endereço, contrato, etc.)
  
  // Estado da campanha para este alvo
  state: text("state").notNull().default("pending"), // 'pending', 'scheduled', 'calling', 'completed', 'failed', 'skipped'
  priority: integer("priority").default(0), // Prioridade (maior = mais urgente)
  attemptCount: integer("attempt_count").default(0), // Tentativas realizadas
  lastAttemptAt: timestamp("last_attempt_at"), // Última tentativa
  nextAttemptAt: timestamp("next_attempt_at"), // Próxima tentativa agendada
  
  // Janela preferencial de contato
  preferredTimeWindow: jsonb("preferred_time_window"), // { start: "14:00", end: "18:00" }
  
  // Resultado
  outcome: text("outcome"), // 'promise_made', 'paid', 'refused', 'no_answer', 'invalid_number', 'do_not_call'
  outcomeDetails: text("outcome_details"), // Detalhes adicionais do resultado
  completedAt: timestamp("completed_at"),
  
  // Vínculo com conversa (se enviada via WhatsApp)
  conversationId: varchar("conversation_id"), // ID da conversa criada (para mensagens via WhatsApp)
  
  // Auditoria
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  campaignIdIdx: index("voice_targets_campaign_id_idx").on(table.campaignId),
  stateIdx: index("voice_targets_state_idx").on(table.state),
  nextAttemptIdx: index("voice_targets_next_attempt_idx").on(table.nextAttemptAt),
  contactIdIdx: index("voice_targets_contact_id_idx").on(table.contactId),
}));

// Voice Call Attempts - Tentativas de ligação
export const voiceCallAttempts = pgTable("voice_call_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetId: varchar("target_id").notNull().references(() => voiceCampaignTargets.id, { onDelete: "cascade" }),
  campaignId: varchar("campaign_id").notNull().references(() => voiceCampaigns.id),
  
  // Detalhes da tentativa
  attemptNumber: integer("attempt_number").notNull(), // 1, 2, 3
  phoneNumber: text("phone_number").notNull(), // Telefone utilizado
  scheduledFor: timestamp("scheduled_for"), // Quando foi agendada
  dialedAt: timestamp("dialed_at"), // Quando a ligação foi iniciada
  
  // Integração Twilio
  callSid: text("call_sid"), // Twilio Call SID
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'queued', 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer', 'cancelled'
  
  // Detecção de secretária eletrônica (AMD - Answering Machine Detection)
  amdResult: text("amd_result"), // 'human', 'machine', 'unknown'
  
  // Duração e gravação
  durationSeconds: integer("duration_seconds"), // Duração em segundos
  recordingUrl: text("recording_url"), // URL da gravação no Twilio
  transcriptUrl: text("transcript_url"), // URL da transcrição
  transcript: text("transcript"), // Transcrição completa da conversa
  
  // Análise da IA
  aiSummary: text("ai_summary"), // Resumo gerado pela IA
  sentiment: text("sentiment"), // 'positive', 'neutral', 'negative'
  detectedIntent: text("detected_intent"), // 'will_pay', 'negotiating', 'refusing', 'callback_requested'
  
  // Erro
  errorCode: text("error_code"), // Código de erro Twilio
  errorMessage: text("error_message"), // Mensagem de erro
  
  // Auditoria
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  targetIdIdx: index("voice_attempts_target_id_idx").on(table.targetId),
  campaignIdIdx: index("voice_attempts_campaign_id_idx").on(table.campaignId),
  statusIdx: index("voice_attempts_status_idx").on(table.status),
  scheduledForIdx: index("voice_attempts_scheduled_for_idx").on(table.scheduledFor),
}));

// Voice Promises - Promessas de pagamento
export const voicePromises = pgTable("voice_promises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => voiceCampaigns.id),
  targetId: varchar("target_id").references(() => voiceCampaignTargets.id),
  callAttemptId: varchar("call_attempt_id").references(() => voiceCallAttempts.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  
  // Dados da promessa
  contactName: text("contact_name").notNull(),
  contactDocument: text("contact_document"),
  phoneNumber: text("phone_number").notNull(),
  promisedAmount: integer("promised_amount"), // Valor prometido em centavos
  dueDate: timestamp("due_date"), // Data prometida de pagamento
  paymentMethod: text("payment_method"), // 'boleto', 'pix', 'cartao', 'outro'
  
  // Status da promessa
  status: text("status").notNull().default("pending"), // 'pending', 'fulfilled', 'broken', 'renegotiated'
  fulfilledAt: timestamp("fulfilled_at"),
  brokenAt: timestamp("broken_at"), // Quando a promessa foi quebrada (não cumprida)
  
  // Sistema de Lembretes
  reminderSent: boolean("reminder_sent").default(false), // Se lembrete foi enviado
  reminderSentAt: timestamp("reminder_sent_at"), // Quando o lembrete foi enviado
  
  // Detalhes
  notes: text("notes"), // Observações da conversa
  crmReference: text("crm_reference"), // Referência no CRM (ticket, protocolo, etc.)
  
  // Gravação relacionada
  recordingUrl: text("recording_url"),
  
  // Auditoria
  recordedAt: timestamp("recorded_at").defaultNow(), // Quando a promessa foi feita
  recordedBy: text("recorded_by").default("ai"), // 'ai' ou user ID se foi humano
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  campaignIdIdx: index("voice_promises_campaign_id_idx").on(table.campaignId),
  statusIdx: index("voice_promises_status_idx").on(table.status),
  dueDateIdx: index("voice_promises_due_date_idx").on(table.dueDate),
  contactIdIdx: index("voice_promises_contact_id_idx").on(table.contactId),
}));

// Voice Configs - Configurações do módulo
export const voiceConfigs = pgTable("voice_configs", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Voice Messaging Settings - Configuração global de métodos de envio de mensagens
export const voiceMessagingSettings = pgTable("voice_messaging_settings", {
  id: serial("id").primaryKey(),
  voiceEnabled: boolean("voice_enabled").notNull().default(true), // Habilitar ligações por voz
  whatsappEnabled: boolean("whatsapp_enabled").notNull().default(true), // Habilitar WhatsApp
  defaultMethod: text("default_method").notNull().default("voice"), // 'voice' | 'whatsapp' | 'hybrid'
  fallbackOrder: text("fallback_order").array().notNull().default(sql`ARRAY['voice', 'whatsapp']::text[]`), // Ordem de fallback
  description: text("description"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert Schemas - COBRANÇAS
export const insertVoiceFeatureFlagSchema = createInsertSchema(voiceFeatureFlags).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertVoiceCampaignSchema = createInsertSchema(voiceCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
  totalTargets: true,
  contactedTargets: true,
  successfulContacts: true,
  promisesMade: true,
  promisesFulfilled: true,
}).extend({
  status: z.enum(["draft", "scheduled", "active", "paused", "completed", "cancelled"]).default("draft"),
  strategy: z.enum(["sequential", "priority", "random"]).default("sequential"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const insertVoiceCampaignTargetSchema = createInsertSchema(voiceCampaignTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  state: z.enum(["pending", "scheduled", "calling", "completed", "failed", "skipped"]).default("pending"),
});

export const insertVoiceCallAttemptSchema = createInsertSchema(voiceCallAttempts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["scheduled", "queued", "ringing", "in-progress", "completed", "failed", "busy", "no-answer", "cancelled"]).default("scheduled"),
});

export const insertVoicePromiseSchema = createInsertSchema(voicePromises).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  recordedAt: true,
  fulfilledAt: true,
}).extend({
  status: z.enum(["pending", "fulfilled", "broken", "renegotiated"]).default("pending"),
  paymentMethod: z.enum(["boleto", "pix", "cartao", "outro"]).optional(),
});

export const insertVoiceConfigSchema = createInsertSchema(voiceConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoiceMessagingSettingsSchema = createInsertSchema(voiceMessagingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  defaultMethod: z.enum(["voice", "whatsapp", "hybrid"]).default("voice"),
});

export const updateVoiceMessagingSettingsSchema = insertVoiceMessagingSettingsSchema.partial();

// Types - COBRANÇAS
export type VoiceFeatureFlag = typeof voiceFeatureFlags.$inferSelect;
export type InsertVoiceFeatureFlag = z.infer<typeof insertVoiceFeatureFlagSchema>;

export type VoiceCampaign = typeof voiceCampaigns.$inferSelect;
export type InsertVoiceCampaign = z.infer<typeof insertVoiceCampaignSchema>;

export type VoiceCampaignTarget = typeof voiceCampaignTargets.$inferSelect;
export type InsertVoiceCampaignTarget = z.infer<typeof insertVoiceCampaignTargetSchema>;

export type VoiceCallAttempt = typeof voiceCallAttempts.$inferSelect;
export type InsertVoiceCallAttempt = z.infer<typeof insertVoiceCallAttemptSchema>;

export type VoicePromise = typeof voicePromises.$inferSelect;
export type InsertVoicePromise = z.infer<typeof insertVoicePromiseSchema>;

export type VoiceConfig = typeof voiceConfigs.$inferSelect;
export type InsertVoiceConfig = z.infer<typeof insertVoiceConfigSchema>;

export type VoiceMessagingSettings = typeof voiceMessagingSettings.$inferSelect;
export type InsertVoiceMessagingSettings = z.infer<typeof insertVoiceMessagingSettingsSchema>;
export type UpdateVoiceMessagingSettings = z.infer<typeof updateVoiceMessagingSettingsSchema>;
