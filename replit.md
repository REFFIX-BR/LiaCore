# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service. It orchestrates specialized AI assistants using OpenAI's Assistants API and a RAG knowledge base to automate Q&A and actions. The platform features a real-time supervisor monitoring dashboard and an autonomous continuous learning system. Its core purpose is to enhance customer service efficiency and satisfaction through a robust, scalable, and intelligent AI solution for telecommunications.

## Recent Critical Fixes
**Date: 2025-10-20**
- **CRITICAL CRASH BUG FIX**: Fixed TypeError crash in `server/lib/openai.ts:524` when OpenAI returns empty content array after processing routing/transfer functions. System was attempting to access `content[0].type` without verifying array existence or length, causing complete message processing failure. Implemented robust verification with `Array.isArray()` check and intelligent fallback system that returns appropriate confirmation messages for routing, transfer, or resolve actions. This fix eliminates crashes affecting multiple customer conversations (Layla Silva, Joseane Andrade, and others) and ensures graceful handling of all OpenAI response scenarios.
- **NPS SYSTEM ENHANCEMENT**: Improved NPS survey message with more engaging copy emphasizing quick/simple response. Implemented automated follow-up system for detractors (scores 0-6) that automatically requests detailed feedback comments. System uses `awaitingNPSComment` metadata flag to track state and persists comments via new `updateSatisfactionFeedback()` storage function. Includes personalized thank-you messages by category (promoters, neutrals, detractors).
- **FINANCEIRO ASSISTANT BUG FIX**: Updated instructions to fix critical issue where boleto data wasn't being sent to customers. Assistant was only mentioning STATUS instead of providing complete boleto details (vencimento, valor, código de barras, link de pagamento, PIX). New instructions include explicit formatting template and absolute rules requiring ALL data to be sent immediately when function returns results. User must update OpenAI Assistant instructions manually.
- **RECEPCIONISTA ROUTING BUG FIX**: Updated instructions to fix critical issue where "desbloqueio em confiança" (unblock in trust) requests were not being routed to Financeiro assistant. Added explicit keywords and examples (cortou, bloqueou, desbloquear, liberar, em confiança) to ensure proper routing. System has automated unblocking capability with monthly limits and multi-bill policies. User must update OpenAI Assistant instructions manually.
- **FINANCEIRO UX IMPROVEMENT**: Added conversation closure flow to prevent conversations from staying "pendurada" (hanging) after boleto delivery. Assistant now asks if customer needs anything else after sending boleto data, and uses `finalizar_conversa()` when customer confirms/thanks. Reduces active conversation queue and improves customer experience. User must update OpenAI Assistant instructions manually.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend uses React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS. The design is inspired by Carbon Design System and Linear, supporting dark/light modes. `Wouter` is used for client-side routing.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management.
**Backend**: Node.js and Express.js (TypeScript) with GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: BullMQ with Redis TLS for asynchronous processing, ensuring message delivery with retries and webhooks.
**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API.
- **Specialized Assistants**: Six roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) with a "Receptionist-First" routing model.
- **RAG Architecture**: Dual-layer prompt system separating System and RAG Prompts using Upstash Vector. Includes specific RAG systems for equipment returns and sales documentation (92 semantic chunks).
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, scheduling, and sales operations (`consultar_planos`, `enviar_cadastro_venda`).
- **Automated Systems**: Document detection, "Boleto Consultation", "PPPoE Connection Status", "Unlock/Unblock", HTTP Resilience System, GPT-4o Vision for image analysis, PDF text extraction, and OpenAI Whisper for audio transcription.
- **Video Processing**: Displays WhatsApp video messages in chat with HTML5 player, captions, and metadata.
- **Conversation Intelligence**: Real-time sentiment, urgency, and problem analysis; automatic persistence of CPF/CNPJ.
**Real-Time Monitoring**: Supervisor Dashboard with KPIs, live queues, alerts, transcripts, human intervention controls, and Live Logs System. Includes sub-filters for conversation resolution types (AI, human, auto-closed).
**Continuous Learning System**: Autonomous GPT-4 agent suggests prompt improvements based on feedback.
**NPS & Customer Satisfaction**: Automated NPS surveys via WhatsApp; feedback integrated into learning.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API for real-time messaging, AI routing, and outbound messaging. Features a triple-fallback message delivery system and a WhatsApp Groups Management System with individual AI control. Supports multimedia messages.
**Evolution Instance Consistency**: Critical architectural decision ensuring all messages in a conversation use the same Evolution API instance, prioritizing `conversation.evolutionInstance`.
**Role-Based Access Control (RBAC)**: 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Contact Management System**: Centralized client database, automatic WhatsApp contact sync. Features "New Contact" creation (manual conversations for agents) and "Conversation Reopen" preserving the original `evolutionInstance`.
**Message Deletion System**: Soft-deletion of assistant messages by supervisors/admins.
**Redis Optimization System**: Intelligent caching, batching, and hash storage.
**Message Batching System**: Atomic Redis-based debouncing to group sequential client messages into single AI requests (3-second window). Media messages bypass batching.
**Private Notes System**: Internal collaboration feature for agents to add notes to conversations.
**Conversation Verification System**: Supervisor workflow tracking to mark conversations as reviewed. Verification resets on new client messages.
**Activity Logs & Audit System**: Comprehensive audit trail of user actions (LOGIN/LOGOUT, supervisor operations) with dual-tab interface and real-time KPI dashboard.
**Conversational Sales System**: Autonomous AI system for lead qualification, plan presentation, data collection, and sales processing via WhatsApp following a structured 5-step data collection process. **Data Collection Workflow**: (1) Document type selection (PF/PJ), (2) Basic personal data (name, CPF, email, phone), (3) Complementary data for PF (mother's name, birthdate, RG, sex, civil status), (4) Complete address via `buscar_cep` with validation and reference point, (5) Service data (billing day, preferred installation date, availability). **Coverage Verification System**: Robust 4-layer backend validation enforcing coverage rules independent of AI behavior. When `buscar_cep()` is called, results (including `tem_cobertura`, city, state, CEP, timestamp) are persisted in `conversations.lastCoverageCheck` (jsonb field). Before processing any sale via `enviar_cadastro_venda()`, system validates: (1) Coverage check exists, (2) `tem_cobertura === true`, (3) CEP in sale payload matches verified CEP (normalized comparison), (4) Check is fresh (<5 min TTL). If any validation fails, sale is BLOCKED and AI is instructed to use `registrar_lead_sem_cobertura()` instead. Coverage cities (normalized): Três Rios RJ, Comendador Levy Gasparian RJ, Santana do Deserto MG, Simão Pereira MG, Paraíba do Sul RJ, Chiador MG, Areal RJ. Two distinct functions based on coverage: (1) NO COVERAGE: `registrar_lead_sem_cobertura()` collects minimal data (name, phone, city, email) with field validation and creates "Lead Sem Cobertura" status; (2) WITH COVERAGE: `enviar_cadastro_venda()` validates all required fields and creates "Aguardando Análise" status. Includes Plans database (10 TR Telecom plans), Sales table with comprehensive fields, dedicated RAG knowledge base (92 semantic chunks), AI tools (`consultar_planos`, `enviar_cadastro_venda`, `buscar_cep`, `registrar_lead_sem_cobertura`), and specific API endpoints (`/api/plans`, `/api/site-lead`, `/api/sales`). **Required Fields for Sales**: tipo_pessoa, nome_cliente, cpf_cnpj, telefone_cliente, email_cliente, plano_id, endereco (with referencia), nome_mae, data_nascimento, rg, sexo, estado_civil, dia_vencimento, data_instalacao_preferida, disponibilidade. OpenAI function schema validated with "name" field for Dashboard compatibility.
**Sales Management Interface**: ADMIN/SUPERVISOR-only dashboard at `/vendas` with KPIs (total, aguardando, aprovados, instalados), status filters, sales table with pagination, detailed view dialogs, and status update functionality with observations. Features real-time updates via TanStack Query mutations and secure endpoints (`authenticate + requireAdminOrSupervisor`).
**Plans Management System**: Complete CRUD interface for managing TR Telecom service plans within `/vendas` section. ADMIN/SUPERVISOR-only access with dedicated "Planos e Serviços" tab. Features include: create/edit/delete plans, toggle active status, auto-generated UUID primary keys, price conversion (centavos ↔ reais), plan type categorization (internet/combo/mobile), speed configuration, rich text descriptions, and feature lists. Fully integrated with conversational sales system's `consultar_planos` function.

### System Design Choices
- **Conversation Prioritization**: Color-coded wait time indicators.
- **Admin Tools**: Mass-closing abandoned conversations, reprocessing stuck messages, configuration management.
- **Image Handling**: Supervisors can download WhatsApp images.
- **Worker Concurrency**: Optimized configuration (20 message, 8 image, 8 NPS workers).
- **Ouvidoria Details Modal**: Enhanced UI for complaint descriptions.
- **API Key Management**: Robust handling of multi-instance Evolution API keys.
- **Private Notes UI**: Dialog interface with StickyNote icon.
- **New Contact Creation**: "Novo" button to create contacts and manual conversations, moved to "Transferidas" or "Atribuídas".
- **Conversation Reopen**: "Reabrir Conversa" button moves conversation to "Transferidas" queue.
- **Conversation Verification UI**: Green CheckCircle2 icon on verified conversations.
- **Activity Logs UI**: Dual-tab interface (Agentes/Supervisão) with KPI cards.
- **Monitor Resolved Conversations Sub-Filters**: "Finalizadas" tab with sub-filters for AI, agent, or auto-closed resolutions.
- **WhatsApp Groups Chat Interface**: Dual-tab system (Chat/Informações) for group messaging with auto-refresh, pagination, and AI toggle.
- **Sales Management UI**: "/vendas" page with KPI cards, status filters, sales table, detail dialogs, and status update dialogs. ShoppingBag icon in sidebar (ADMIN/SUPERVISOR only).
- **Plans Management UI**: "/vendas" page with tabs interface (Vendas | Planos e Serviços). Plans tab features create/edit dialogs with comprehensive form fields, price formatting (R$ display), active/inactive badge toggles, and data table with edit/toggle actions. ID field auto-hidden during creation, displayed (disabled) during editing.

## External Dependencies

**Third-Party Services**:
- **OpenAI**: AI Assistants API.
- **Upstash Vector**: Serverless vector database.
- **Upstash Redis**: Serverless Redis.
- **Neon Database**: Serverless PostgreSQL.
- **Evolution API**: WhatsApp integration.

**Key NPM Packages**:
- `@radix-ui/*`: Headless UI components.
- `@tanstack/react-query`: Server state management.
- `drizzle-orm`: Type-safe ORM.
- `express`: Web server framework.
- `react-hook-form`, `zod`: Form handling and validation.
- `tailwindcss`: CSS framework.