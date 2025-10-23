CREATE TABLE "activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"session_duration" integer,
	"conversation_id" varchar,
	"target_user_id" varchar,
	"details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"resolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"complaint_type" text NOT NULL,
	"severity" text DEFAULT 'media' NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'novo' NOT NULL,
	"assigned_to" varchar,
	"resolution" text,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"name" text,
	"document" text,
	"last_conversation_id" varchar,
	"last_conversation_date" timestamp,
	"total_conversations" integer DEFAULT 0 NOT NULL,
	"has_recurring_issues" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contacts_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" text NOT NULL,
	"client_name" text NOT NULL,
	"client_id" text,
	"client_document" text,
	"thread_id" text,
	"assistant_type" text NOT NULL,
	"department" text DEFAULT 'general',
	"status" text DEFAULT 'active' NOT NULL,
	"sentiment" text DEFAULT 'neutral',
	"urgency" text DEFAULT 'normal',
	"duration" integer DEFAULT 0,
	"last_message" text,
	"last_message_time" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	"conversation_summary" text,
	"last_summarized_at" timestamp,
	"message_count_at_last_summary" integer DEFAULT 0,
	"transferred_to_human" boolean DEFAULT false,
	"transfer_reason" text,
	"transferred_at" timestamp,
	"assigned_to" varchar,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"resolution_time" integer,
	"evolution_instance" text,
	"auto_closed" boolean DEFAULT false,
	"auto_closed_reason" text,
	"auto_closed_at" timestamp,
	"verified_at" timestamp,
	"verified_by" varchar,
	"last_coverage_check" jsonb,
	CONSTRAINT "conversations_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"evolution_instance" text,
	"last_message_time" timestamp,
	"last_message" text,
	"participants_count" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "groups_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
CREATE TABLE "learning_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"assistant_type" text NOT NULL,
	"user_message" text NOT NULL,
	"ai_response" text NOT NULL,
	"correct_response" text,
	"feedback" text,
	"sentiment" text,
	"resolution" text,
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"template" text NOT NULL,
	"variables" text[] DEFAULT '{}'::text[],
	"category" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	CONSTRAINT "message_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"function_call" jsonb,
	"assistant" text,
	"image_base64" text,
	"pdf_base64" text,
	"pdf_name" text,
	"audio_url" text,
	"video_url" text,
	"video_name" text,
	"video_mimetype" text,
	"whatsapp_message_id" text,
	"remote_jid" text,
	"is_private" boolean DEFAULT false,
	"send_by" text,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"download_speed" integer NOT NULL,
	"upload_speed" integer NOT NULL,
	"price" integer NOT NULL,
	"description" text,
	"features" text[] DEFAULT '{}'::text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "private_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_by_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prompt_suggestions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_type" text NOT NULL,
	"problem_identified" text NOT NULL,
	"root_cause_analysis" text NOT NULL,
	"current_prompt" text NOT NULL,
	"suggested_prompt" text NOT NULL,
	"confidence_score" integer NOT NULL,
	"affected_conversations" text[],
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"review_notes" text,
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "prompt_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suggestion_id" varchar,
	"assistant_type" text NOT NULL,
	"modification_type" text NOT NULL,
	"previous_value" text NOT NULL,
	"new_value" text NOT NULL,
	"reason" text NOT NULL,
	"applied_by" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rag_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"assistant_type" text NOT NULL,
	"query" text NOT NULL,
	"results_count" integer NOT NULL,
	"results_found" boolean NOT NULL,
	"sources" jsonb,
	"execution_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "registration_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"requested_role" text DEFAULT 'AGENT' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"customer_name" text,
	"cpf_cnpj" text,
	"email" text,
	"phone" text NOT NULL,
	"phone2" text,
	"mother_name" text,
	"birth_date" text,
	"rg" text,
	"sex" text,
	"civil_status" text,
	"company_name" text,
	"state_registration" text,
	"city_registration" text,
	"cep" text,
	"address" text,
	"number" text,
	"complement" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"reference" text,
	"plan_id" varchar NOT NULL,
	"billing_day" integer,
	"preferred_install_date" text,
	"availability" text,
	"status" text DEFAULT 'Aguardando Análise' NOT NULL,
	"source" text DEFAULT 'chat' NOT NULL,
	"seller" text DEFAULT 'Site',
	"conversation_id" varchar,
	"how_did_you_know" text,
	"pending_items" text[] DEFAULT '{}'::text[],
	"observations" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "satisfaction_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"assistant_type" text NOT NULL,
	"nps_score" integer NOT NULL,
	"category" text NOT NULL,
	"comment" text,
	"client_name" text,
	"created_at" timestamp DEFAULT now(),
	"handling_score" integer,
	"handling_status" text DEFAULT 'pending',
	"handling_notes" text,
	"handled_by" varchar,
	"handled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "suggested_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"message_context" text NOT NULL,
	"suggested_response" text NOT NULL,
	"final_response" text,
	"was_edited" boolean DEFAULT false,
	"was_approved" boolean DEFAULT false,
	"supervisor_name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "supervisor_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"action" text NOT NULL,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"assistant_type" text NOT NULL,
	"training_type" text NOT NULL,
	"conversation_id" varchar,
	"content" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_by" varchar NOT NULL,
	"completed_by" varchar,
	"applied_by" varchar,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"applied_at" timestamp,
	"notes" text,
	"improved_prompt" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"role" text DEFAULT 'AGENT' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"departments" text[] DEFAULT '{general}'::text[],
	"last_login_at" timestamp,
	"last_activity_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "contacts_phone_number_idx" ON "contacts" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "contacts_document_idx" ON "contacts" USING btree ("document");--> statement-breakpoint
CREATE INDEX "contacts_status_idx" ON "contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contacts_last_conversation_date_idx" ON "contacts" USING btree ("last_conversation_date");--> statement-breakpoint
CREATE INDEX "conversations_last_message_time_idx" ON "conversations" USING btree ("last_message_time");--> statement-breakpoint
CREATE INDEX "conversations_status_idx" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conversations_status_last_message_idx" ON "conversations" USING btree ("status","last_message_time");--> statement-breakpoint
CREATE INDEX "conversations_assigned_to_idx" ON "conversations" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "conversations_transferred_idx" ON "conversations" USING btree ("transferred_to_human");--> statement-breakpoint
CREATE INDEX "conversations_department_idx" ON "conversations" USING btree ("department");--> statement-breakpoint
CREATE INDEX "groups_group_id_idx" ON "groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "groups_ai_enabled_idx" ON "groups" USING btree ("ai_enabled");--> statement-breakpoint
CREATE INDEX "groups_last_message_time_idx" ON "groups" USING btree ("last_message_time");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_timestamp_idx" ON "messages" USING btree ("conversation_id","timestamp");--> statement-breakpoint
CREATE INDEX "plans_is_active_idx" ON "plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "private_notes_conversation_id_idx" ON "private_notes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "private_notes_created_at_idx" ON "private_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rag_analytics_conversation_id_idx" ON "rag_analytics" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "rag_analytics_assistant_type_idx" ON "rag_analytics" USING btree ("assistant_type");--> statement-breakpoint
CREATE INDEX "rag_analytics_created_at_idx" ON "rag_analytics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sales_status_idx" ON "sales" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_plan_id_idx" ON "sales" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "sales_phone_idx" ON "sales" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "sales_cpf_cnpj_idx" ON "sales" USING btree ("cpf_cnpj");--> statement-breakpoint
CREATE INDEX "sales_conversation_id_idx" ON "sales" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "sales_created_at_idx" ON "sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "training_sessions_status_idx" ON "training_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "training_sessions_assistant_type_idx" ON "training_sessions" USING btree ("assistant_type");