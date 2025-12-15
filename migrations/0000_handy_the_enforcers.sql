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
CREATE TABLE "announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"start_date" timestamp DEFAULT now(),
	"end_date" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "context_quality_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"assistant_type" text,
	"metadata" jsonb,
	"detected_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "conversation_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"thread_id" text NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"preserved_message_ids" text[],
	"created_at" timestamp DEFAULT now(),
	"closed_at" timestamp,
	"closed_reason" text
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" text NOT NULL,
	"client_name" text NOT NULL,
	"client_id" text,
	"client_document" text,
	"client_document_type" text,
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
	"first_resolved_by" varchar,
	"first_resolved_at" timestamp,
	"resolution_time" integer,
	"evolution_instance" text,
	"auto_closed" boolean DEFAULT false,
	"auto_closed_reason" text,
	"auto_closed_at" timestamp,
	"verified_at" timestamp,
	"verified_by" varchar,
	"last_coverage_check" jsonb,
	"conversation_source" text DEFAULT 'inbound',
	"voice_campaign_target_id" varchar,
	CONSTRAINT "conversations_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "crm_sync_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"api_url" text NOT NULL,
	"api_key" text,
	"date_range_type" text DEFAULT 'relative' NOT NULL,
	"date_range_days" integer DEFAULT 30,
	"date_range_from" timestamp,
	"date_range_to" timestamp,
	"min_debt_amount" integer DEFAULT 0,
	"max_debt_amount" integer,
	"sync_schedule" text DEFAULT 'daily' NOT NULL,
	"sync_time" text DEFAULT '08:00',
	"sync_time_zone" text DEFAULT 'America/Sao_Paulo',
	"deduplicate_by" text DEFAULT 'document' NOT NULL,
	"update_existing" boolean DEFAULT false,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"last_sync_imported" integer DEFAULT 0,
	"last_sync_skipped" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "crm_sync_configs_campaign_id_unique" UNIQUE("campaign_id")
);
--> statement-breakpoint
CREATE TABLE "failure_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"failure_id" varchar NOT NULL,
	"contact_id" varchar,
	"conversation_id" varchar,
	"client_phone" text NOT NULL,
	"notification_type" text NOT NULL,
	"message_sent" text NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"was_read" boolean DEFAULT false,
	"client_response" text,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "gamification_badges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"badge_type" text NOT NULL,
	"period" text NOT NULL,
	"metric" integer,
	"awarded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gamification_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" text NOT NULL,
	"agent_id" varchar NOT NULL,
	"ranking" integer NOT NULL,
	"total_score" integer NOT NULL,
	"metrics" jsonb,
	"badges" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gamification_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"period" text NOT NULL,
	"total_conversations" integer DEFAULT 0,
	"avg_nps" integer DEFAULT 0,
	"success_rate" integer DEFAULT 0,
	"avg_response_time" integer DEFAULT 0,
	"volume_score" integer DEFAULT 0,
	"nps_score" integer DEFAULT 0,
	"resolution_score" integer DEFAULT 0,
	"time_score" integer DEFAULT 0,
	"total_score" integer DEFAULT 0,
	"ranking" integer,
	"calculated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gamification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"nps_weight" integer DEFAULT 40 NOT NULL,
	"volume_weight" integer DEFAULT 30 NOT NULL,
	"resolution_weight" integer DEFAULT 20 NOT NULL,
	"response_time_weight" integer DEFAULT 10 NOT NULL,
	"solucionador_nps_min" integer DEFAULT 7 NOT NULL,
	"solucionador_resolution_min" integer DEFAULT 70 NOT NULL,
	"velocista_nps_min" integer DEFAULT 7 NOT NULL,
	"velocista_top_n" integer DEFAULT 1 NOT NULL,
	"campeao_volume_top_n" integer DEFAULT 1 NOT NULL,
	"target_nps" integer DEFAULT 8,
	"target_resolution" integer DEFAULT 85,
	"target_response_time" integer DEFAULT 120,
	"target_volume" integer DEFAULT 500,
	"calculation_period" text DEFAULT 'monthly' NOT NULL,
	"auto_calculate" boolean DEFAULT false NOT NULL,
	"calculation_frequency" text DEFAULT 'monthly',
	"calculation_day_of_month" integer DEFAULT 1,
	"calculation_day_of_week" integer DEFAULT 1,
	"calculation_time" text DEFAULT '00:00',
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "massive_failures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"notification_message" text NOT NULL,
	"resolution_message" text,
	"affected_regions" jsonb NOT NULL,
	"estimated_resolution" timestamp,
	"auto_resolve" boolean DEFAULT false,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"audio_base64" text,
	"video_url" text,
	"video_name" text,
	"video_mimetype" text,
	"location_latitude" text,
	"location_longitude" text,
	"whatsapp_message_id" text,
	"remote_jid" text,
	"whatsapp_status" text,
	"whatsapp_status_updated_at" timestamp,
	"whatsapp_retry_count" integer DEFAULT 0,
	"whatsapp_last_retry_at" timestamp,
	"whatsapp_template_metadata" jsonb,
	"is_private" boolean DEFAULT false,
	"send_by" text,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "pending_comercial_sync" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"sale_id" varchar,
	"conversation_id" varchar,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error" text,
	"last_attempt_at" timestamp,
	"next_retry_at" timestamp,
	"comercial_api_response" jsonb,
	"comercial_sale_id" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
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
CREATE TABLE "prompt_drafts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" varchar NOT NULL,
	"draft_content" text NOT NULL,
	"ai_suggestions" jsonb,
	"token_count" integer DEFAULT 0,
	"pre_consolidation_content" text,
	"last_edited_by" varchar NOT NULL,
	"last_edited_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "prompt_drafts_prompt_id_unique" UNIQUE("prompt_id")
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
	"applied_in_version" varchar,
	"consolidated_with" text[],
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_id" text NOT NULL,
	"assistant_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"token_count" integer DEFAULT 0,
	"last_synced_at" timestamp,
	"last_sync_error" text,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "prompt_templates_assistant_id_unique" UNIQUE("assistant_id")
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
CREATE TABLE "prompt_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" varchar NOT NULL,
	"content" text NOT NULL,
	"version" text NOT NULL,
	"version_notes" text,
	"token_count" integer DEFAULT 0,
	"ai_suggestions" jsonb,
	"created_by" varchar NOT NULL,
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
CREATE TABLE "regions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"city" text NOT NULL,
	"neighborhood" text NOT NULL,
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
	"plan_id" varchar,
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
	"notes" text,
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
	"participates_in_gamification" boolean DEFAULT true,
	"last_login_at" timestamp,
	"last_activity_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "validation_violations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar,
	"chat_id" text,
	"assistant_type" text,
	"rule" text NOT NULL,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"message" text NOT NULL,
	"original_response" text,
	"corrected_response" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_call_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" varchar NOT NULL,
	"campaign_id" varchar NOT NULL,
	"attempt_number" integer NOT NULL,
	"phone_number" text NOT NULL,
	"scheduled_for" timestamp,
	"dialed_at" timestamp,
	"call_sid" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"amd_result" text,
	"duration_seconds" integer,
	"recording_url" text,
	"transcript_url" text,
	"transcript" text,
	"ai_summary" text,
	"sentiment" text,
	"detected_intent" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_campaign_targets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"contact_id" varchar,
	"phone_number" text NOT NULL,
	"alternative_phones" text[],
	"contact_method" text DEFAULT 'voice' NOT NULL,
	"debtor_name" text NOT NULL,
	"debtor_document" text,
	"debtor_document_type" text,
	"debt_amount" integer,
	"due_date" timestamp,
	"debtor_metadata" jsonb,
	"state" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0,
	"attempt_count" integer DEFAULT 0,
	"last_attempt_at" timestamp,
	"next_attempt_at" timestamp,
	"payment_status" text,
	"payment_checked_at" timestamp,
	"crm_sync_state" text DEFAULT 'synced',
	"crm_last_sync_at" timestamp,
	"preferred_time_window" jsonb,
	"outcome" text,
	"outcome_details" text,
	"completed_at" timestamp,
	"conversation_id" varchar,
	"last_whatsapp_status" text,
	"last_whatsapp_status_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"strategy" text DEFAULT 'sequential' NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"attempt_spacing_minutes" integer DEFAULT 120 NOT NULL,
	"active_hours" jsonb DEFAULT '{"start":"08:00","end":"20:00","timezone":"America/Sao_Paulo","daysOfWeek":[1,2,3,4,5,6]}'::jsonb NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"total_targets" integer DEFAULT 0,
	"contacted_targets" integer DEFAULT 0,
	"successful_contacts" integer DEFAULT 0,
	"promises_made" integer DEFAULT 0,
	"promises_fulfilled" integer DEFAULT 0,
	"allowed_methods" text[],
	"fallback_order" text[],
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "voice_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "voice_configs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "voice_feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_messaging_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"voice_enabled" boolean DEFAULT true NOT NULL,
	"whatsapp_enabled" boolean DEFAULT true NOT NULL,
	"default_method" text DEFAULT 'voice' NOT NULL,
	"fallback_order" text[] DEFAULT ARRAY['voice', 'whatsapp']::text[] NOT NULL,
	"description" text,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_promises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"target_id" varchar,
	"contact_id" varchar,
	"call_attempt_id" varchar,
	"contact_name" text NOT NULL,
	"contact_document" text,
	"phone_number" text NOT NULL,
	"promised_amount" integer,
	"due_date" timestamp,
	"payment_method" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"fulfilled_at" timestamp,
	"broken_at" timestamp,
	"reminder_sent" boolean DEFAULT false,
	"reminder_sent_at" timestamp,
	"notes" text,
	"crm_reference" text,
	"recording_url" text,
	"recorded_at" timestamp DEFAULT now(),
	"recorded_by" text DEFAULT 'ai',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "crm_sync_configs" ADD CONSTRAINT "crm_sync_configs_campaign_id_voice_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."voice_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_call_attempts" ADD CONSTRAINT "voice_call_attempts_target_id_voice_campaign_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."voice_campaign_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_call_attempts" ADD CONSTRAINT "voice_call_attempts_campaign_id_voice_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."voice_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_campaign_targets" ADD CONSTRAINT "voice_campaign_targets_campaign_id_voice_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."voice_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_campaign_targets" ADD CONSTRAINT "voice_campaign_targets_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_promises" ADD CONSTRAINT "voice_promises_campaign_id_voice_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."voice_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_promises" ADD CONSTRAINT "voice_promises_target_id_voice_campaign_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."voice_campaign_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_promises" ADD CONSTRAINT "voice_promises_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_promises" ADD CONSTRAINT "voice_promises_call_attempt_id_voice_call_attempts_id_fk" FOREIGN KEY ("call_attempt_id") REFERENCES "public"."voice_call_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_active_idx" ON "announcements" USING btree ("active");--> statement-breakpoint
CREATE INDEX "announcements_priority_idx" ON "announcements" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "announcements_start_date_idx" ON "announcements" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "contacts_phone_number_idx" ON "contacts" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "contacts_document_idx" ON "contacts" USING btree ("document");--> statement-breakpoint
CREATE INDEX "contacts_status_idx" ON "contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contacts_last_conversation_date_idx" ON "contacts" USING btree ("last_conversation_date");--> statement-breakpoint
CREATE INDEX "context_quality_alerts_conversation_id_idx" ON "context_quality_alerts" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "context_quality_alerts_detected_at_idx" ON "context_quality_alerts" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "context_quality_alerts_assistant_type_idx" ON "context_quality_alerts" USING btree ("assistant_type");--> statement-breakpoint
CREATE INDEX "context_quality_alerts_alert_type_idx" ON "context_quality_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "conversation_threads_conversation_id_idx" ON "conversation_threads" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_threads_thread_id_idx" ON "conversation_threads" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "conversation_threads_active_idx" ON "conversation_threads" USING btree ("conversation_id","closed_at");--> statement-breakpoint
CREATE INDEX "conversations_last_message_time_idx" ON "conversations" USING btree ("last_message_time");--> statement-breakpoint
CREATE INDEX "conversations_status_idx" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conversations_status_last_message_idx" ON "conversations" USING btree ("status","last_message_time");--> statement-breakpoint
CREATE INDEX "conversations_assigned_to_idx" ON "conversations" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "conversations_transferred_idx" ON "conversations" USING btree ("transferred_to_human");--> statement-breakpoint
CREATE INDEX "conversations_department_idx" ON "conversations" USING btree ("department");--> statement-breakpoint
CREATE INDEX "conversations_first_resolved_by_idx" ON "conversations" USING btree ("first_resolved_by");--> statement-breakpoint
CREATE INDEX "conversations_first_resolved_at_idx" ON "conversations" USING btree ("first_resolved_at");--> statement-breakpoint
CREATE INDEX "crm_sync_campaign_id_idx" ON "crm_sync_configs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "crm_sync_enabled_idx" ON "crm_sync_configs" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "failure_notifications_failure_id_idx" ON "failure_notifications" USING btree ("failure_id");--> statement-breakpoint
CREATE INDEX "failure_notifications_contact_id_idx" ON "failure_notifications" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "failure_notifications_conversation_id_idx" ON "failure_notifications" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "failure_notifications_client_phone_idx" ON "failure_notifications" USING btree ("client_phone");--> statement-breakpoint
CREATE INDEX "failure_notifications_sent_at_idx" ON "failure_notifications" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "gamification_badges_agent_id_idx" ON "gamification_badges" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "gamification_badges_period_idx" ON "gamification_badges" USING btree ("period");--> statement-breakpoint
CREATE INDEX "gamification_badges_badge_type_idx" ON "gamification_badges" USING btree ("badge_type");--> statement-breakpoint
CREATE INDEX "gamification_history_period_idx" ON "gamification_history" USING btree ("period");--> statement-breakpoint
CREATE INDEX "gamification_history_agent_id_idx" ON "gamification_history" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "gamification_history_ranking_idx" ON "gamification_history" USING btree ("ranking");--> statement-breakpoint
CREATE INDEX "gamification_scores_agent_period_idx" ON "gamification_scores" USING btree ("agent_id","period");--> statement-breakpoint
CREATE INDEX "gamification_scores_period_idx" ON "gamification_scores" USING btree ("period");--> statement-breakpoint
CREATE INDEX "gamification_scores_total_score_idx" ON "gamification_scores" USING btree ("total_score");--> statement-breakpoint
CREATE INDEX "groups_group_id_idx" ON "groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "groups_ai_enabled_idx" ON "groups" USING btree ("ai_enabled");--> statement-breakpoint
CREATE INDEX "groups_last_message_time_idx" ON "groups" USING btree ("last_message_time");--> statement-breakpoint
CREATE INDEX "massive_failures_status_idx" ON "massive_failures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "massive_failures_start_time_idx" ON "massive_failures" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "massive_failures_created_by_idx" ON "massive_failures" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_timestamp_idx" ON "messages" USING btree ("conversation_id","timestamp");--> statement-breakpoint
CREATE INDEX "messages_whatsapp_status_idx" ON "messages" USING btree ("whatsapp_status","whatsapp_status_updated_at");--> statement-breakpoint
CREATE INDEX "messages_whatsapp_message_id_idx" ON "messages" USING btree ("whatsapp_message_id");--> statement-breakpoint
CREATE INDEX "pending_comercial_sync_status_idx" ON "pending_comercial_sync" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_comercial_sync_next_retry_idx" ON "pending_comercial_sync" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "pending_comercial_sync_sale_id_idx" ON "pending_comercial_sync" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "plans_is_active_idx" ON "plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "private_notes_conversation_id_idx" ON "private_notes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "private_notes_created_at_idx" ON "private_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "prompt_drafts_prompt_id_idx" ON "prompt_drafts" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "prompt_templates_assistant_type_idx" ON "prompt_templates" USING btree ("assistant_type");--> statement-breakpoint
CREATE INDEX "prompt_templates_status_idx" ON "prompt_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prompt_versions_prompt_id_idx" ON "prompt_versions" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "prompt_versions_created_at_idx" ON "prompt_versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rag_analytics_conversation_id_idx" ON "rag_analytics" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "rag_analytics_assistant_type_idx" ON "rag_analytics" USING btree ("assistant_type");--> statement-breakpoint
CREATE INDEX "rag_analytics_created_at_idx" ON "rag_analytics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "regions_state_idx" ON "regions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "regions_city_idx" ON "regions" USING btree ("city");--> statement-breakpoint
CREATE INDEX "regions_neighborhood_idx" ON "regions" USING btree ("neighborhood");--> statement-breakpoint
CREATE INDEX "regions_location_idx" ON "regions" USING btree ("state","city","neighborhood");--> statement-breakpoint
CREATE INDEX "sales_status_idx" ON "sales" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_plan_id_idx" ON "sales" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "sales_phone_idx" ON "sales" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "sales_cpf_cnpj_idx" ON "sales" USING btree ("cpf_cnpj");--> statement-breakpoint
CREATE INDEX "sales_conversation_id_idx" ON "sales" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "sales_created_at_idx" ON "sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "training_sessions_status_idx" ON "training_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "training_sessions_assistant_type_idx" ON "training_sessions" USING btree ("assistant_type");--> statement-breakpoint
CREATE INDEX "validation_violations_rule_idx" ON "validation_violations" USING btree ("rule");--> statement-breakpoint
CREATE INDEX "validation_violations_severity_idx" ON "validation_violations" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "validation_violations_assistant_type_idx" ON "validation_violations" USING btree ("assistant_type");--> statement-breakpoint
CREATE INDEX "validation_violations_created_at_idx" ON "validation_violations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "voice_attempts_campaign_id_idx" ON "voice_call_attempts" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "voice_attempts_scheduled_for_idx" ON "voice_call_attempts" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "voice_attempts_status_idx" ON "voice_call_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_attempts_target_id_idx" ON "voice_call_attempts" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "voice_targets_campaign_id_idx" ON "voice_campaign_targets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "voice_targets_state_idx" ON "voice_campaign_targets" USING btree ("state");--> statement-breakpoint
CREATE INDEX "voice_targets_next_attempt_idx" ON "voice_campaign_targets" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "voice_targets_contact_id_idx" ON "voice_campaign_targets" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "voice_targets_payment_status_idx" ON "voice_campaign_targets" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "voice_campaigns_status_idx" ON "voice_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_campaigns_created_by_idx" ON "voice_campaigns" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "voice_promises_campaign_id_idx" ON "voice_promises" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "voice_promises_status_idx" ON "voice_promises" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_promises_due_date_idx" ON "voice_promises" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "voice_promises_contact_id_idx" ON "voice_promises" USING btree ("contact_id");