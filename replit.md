# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service. It orchestrates specialized AI assistants using OpenAI's Assistants API and a RAG knowledge base to automate Q&A and actions like boleto consultation and PPPoE diagnosis. The platform features a real-time supervisor monitoring dashboard for human intervention and an autonomous continuous learning system that evolves AI assistant prompts, aiming to enhance customer service efficiency and satisfaction. Its business vision is to provide a robust, scalable, and intelligent AI solution that significantly improves customer interaction and operational efficiency for telecommunications.

## Recent Changes (2025-10-14)

**✅ IMPLEMENTED: Image Download Feature for Supervisors**
- Feature: Supervisors can now download WhatsApp images directly from chat interface
- UI: Replaced inline image display with "Baixar Imagem" button in message bubbles
- Smart detection: Auto-detects image format (PNG, JPEG, GIF, WebP) from base64 signature
- File naming: Downloads with timestamp `imagem_whatsapp_YYYYMMDD_HHmmss.extension`
- Benefits: Cleaner UI, on-demand image access for verification without cluttering interface
- Location: `client/src/components/ChatMessage.tsx` (lines 79-121, 198-214)

**✅ FIXED: Vision Image Analysis - Complete Fix (3 Critical Issues)**
- **Problem 1**: Images saved but not analyzed - Vision disabled in webhook
- **Root cause 1**: `processWhatsAppImage()` had Vision analysis commented out/disabled
- **Solution 1**: Re-enabled Vision analysis in webhook processing (lines 236-253)
- **Problem 2**: Vision failing with "unsupported image format" error
- **Root cause 2**: Hardcoded `jpeg` format in 2 locations (vision.ts line 135, workers.ts line 338)
- **Solution 2**: Implemented auto-detection via base64 signature (PNG: iVBORw, JPEG: /9j/, GIF: R0lGOD, WebP: UklGR)
- **Problem 3**: Worker fallback to database didn't detect format
- **Solution 3**: Added same detection logic to worker's DB fallback
- **Final flow**: Webhook downloads → Vision analyzes (auto-format) → Worker processes (DB fallback with auto-format)
- **Result**: ✅ All images (PNG, JPEG, GIF, WebP) now analyzed successfully
- **Location**: `server/lib/vision.ts` (lines 136-154, 236-253), `server/workers.ts` (lines 340-361)

**✅ OTIMIZADO: Worker Concurrency - Performance 4x Maior**
- Problem: Workers sobrecarregados - mensagens demorando para processar (5 workers, 10 msg/s)
- Solution: Implementada configuração balanceada (Opção 1 - Moderado)
- New config: 20 message workers (50 msg/s), 8 image workers, 8 NPS workers
- Performance gain: 4x faster processing, 20 simultaneous conversations (vs 5 original)
- Safe limits: Balanced to avoid Redis/OpenAI rate limits, optimized for cost-efficiency
- Location: `server/workers.ts` (lines 545-548, 597, 655, 917-921)

**✅ ENHANCED: Ouvidoria Details Modal**
- Problem: Users unable to view full complaint descriptions (truncated in table)
- Solution: Added "Ver Detalhes" button with modal dialog showing complete information
- Modal displays: Protocol ID, formatted date/time, status/type/severity badges, full description, resolution notes
- UI: Eye icon button + shadcn Dialog component with responsive max-width (2xl) and scrollable content
- Location: `client/src/pages/Ouvidoria.tsx`

**✅ FIXED: Ouvidoria Complaint Registration - Missing Tool**
- Problem: 3 conversations routed to Ouvidoria but 0 complaints registered in database
- Root cause: `registrar_reclamacao_ouvidoria` tool implemented but NOT enabled for the assistant
- Solution: Added tool to enabled list in `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md`
- Updated instructions: Clear guidance on when/how to use (after collecting name, CPF, context)
- Updated flow: Register complaint → inform protocol → transfer to human
- Historical import: Created 2 retroactive complaints from existing conversations (Helena Dias, Geova de Lima)
- ⚠️ **ACTION REQUIRED**: Enable `registrar_reclamacao_ouvidoria` in OpenAI Dashboard for Ouvidoria assistant
- Location: `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md` (lines 752-756, 674-678, 718-720)

**✅ FIXED: Multi-Instance Evolution API Key Management - Case Sensitivity Bug**
- Problem: All WhatsApp messages failing with "Unauthorized" despite correct API keys configured
- Root cause: Environment variables are uppercase (EVOLUTION_API_KEY_COBRANCA, EVOLUTION_API_KEY_LEADS, EVOLUTION_API_KEY_PRINCIPAL) but code was searching for mixed case
- Solution: Added `.toUpperCase()` conversion when building environment variable names
- Updated functions: `getEvolutionApiKey()` in `server/routes.ts` and `sendWhatsAppMessage()` in `server/workers.ts`
- Test result: ✅ Messages now sent successfully to all 3 instances (Cobranca, Leads, Principal)
- Active instances: Cobranca (billing), Leads (sales/support), Principal (Facebook integration)
- Location: `server/routes.ts` (line 37), `server/workers.ts` (lines 58, 62)

**✅ IMPLEMENTED: Two-Stage Automatic Conversation Closure System**
- Feature: Automated conversation closure for inactive AI conversations to improve resource management
- Architecture: Two-stage process with inactivity follow-up (10min) → automatic closure (20min additional)
- Stage 1: After 10 minutes of client inactivity, send follow-up message via `inactivity_followup` template
- Stage 2: If no client response within 20 more minutes (30min total), auto-close conversation with farewell message
- Smart cancellation: Both stages cancelled when client responds, preventing premature closure
- Queue system: New `AUTO_CLOSURE` queue (concurrency: 2) with `AutoClosureJob` interface
- Worker implementation: `autoClosureWorker` checks conversation state, handles edge cases (transferred, already closed)
- Message templates: `inactivity_followup` and `auto_closure` stored in database, customizable via Settings page
- Metadata tracking: Conversations marked with `autoClosed: true`, `autoClosedReason: 'inactivity'`, `autoClosedAt` timestamp
- Integration: Cancellation logic added to message processing worker (2 locations) to prevent race conditions
- Location: `server/workers.ts`, `server/lib/queue.ts`, `shared/schema.ts`

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend, built with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS, is inspired by Carbon Design System and Linear for data-dense enterprise interfaces, supporting both dark and light modes. Wouter handles client-side routing.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management across pages like Dashboard, Monitor, Test Chat, Conversations, Knowledge, Assistants, Agent Evolution, Metrics, Feedbacks NPS, and Settings.

**Backend**: Developed with Node.js and Express.js (TypeScript). It leverages GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM for data persistence. Session management uses OpenAI thread-based conversations stored in Redis.

**Queue System**: Employs BullMQ with Redis TLS for asynchronous processing across seven queues (message-processing, ai-response, image-analysis, nps-survey, learning-tasks, inactivity-followup, auto-closure), ensuring message delivery with retries and webhook fallbacks. A Redis-based distributed lock and chat-level locking (60s TTL) prevent concurrency issues and ensure sequential message processing. Two-stage automatic closure system (10min follow-up → 20min auto-close) manages inactive conversations with smart cancellation when clients respond.

**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API.
- **Specialized Assistants**: Six roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) operating with a "Receptionist-First" routing model. "Receptionist" routes to specialists, while only specialists can transfer to humans. Routing is "silent," sending only the specialist's welcome message.
- **Conversation Management**: Handles conversation finalization, NPS survey delivery, and asynchronous conversation summarization.
- **RAG Architecture**: Features a dual-layer prompt system separating System Prompts (behavioral rules) from RAG Prompts (context-specific information) using Upstash Vector for semantic search.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, and scheduling, with secure internal-only tool execution. Tools like `consultar_boleto_cliente` make real API calls.
- **Automated Systems**: Includes automated document detection (CPF/CNPJ), "Boleto Consultation", "PPPoE Connection Status", and "Unlock/Unblock" systems with integrated security. An HTTP Resilience System centralizes retry logic for external API calls to TR Telecom webhooks. Automated CPF reuse is implemented for seamless transitions between assistants.
- **Vision System**: GPT-4o Vision for automatic WhatsApp image analysis.
- **PDF Text Extraction System**: Extracts text from PDF documents for AI analysis.
- **Audio Processing System**: Transcribes WhatsApp audio messages via OpenAI Whisper API.
- **Conversation Intelligence System**: Provides real-time analysis of sentiment, urgency, technical problems, recurrence, and automatic persistence of CPF/CNPJ. Enhanced regex detects partially formatted CPF/CNPJ.

**Real-Time Monitoring**: The Supervisor Dashboard offers KPIs, live conversation queues, alerts, transcripts, human intervention controls, a Live Logs System, and an Agent Reasoning Logs system.

**Continuous Learning System**: An autonomous GPT-4 agent suggests prompt improvements based on supervisor feedback.

**NPS & Customer Satisfaction**: Automated NPS surveys via WhatsApp post-conversation, with feedback integrated into the learning system and rigorous regex validation for responses.

**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with real-time counters, AI-assisted agent responses, a Welcome Message System, an Inactivity Follow-up System, and automatic conversation closure after extended inactivity (30min total: 10min follow-up + 20min grace period).

**WhatsApp Integration**: Native integration with Evolution API for real-time messaging, AI routing, and outbound messaging, supporting multi-instance operations with dynamic API key lookup.

**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.

**Personalized Dashboards**: Role-specific dashboards provide relevant KPIs, including system health and cost analysis for Admins.

**Contact Management System**: Centralized client database for conversation history and proactive service, with automatic WhatsApp contact synchronization.

**Message Deletion System**: Allows supervisors and agents to delete assistant messages from the database and WhatsApp.

**Redis Optimization System**: Implements intelligent caching, batching, multi-get operations, batch updates, and hash storage to reduce Redis requests and costs.

## External Dependencies

**Third-Party Services**:
- **OpenAI**: AI Assistants API.
- **Upstash Vector**: Serverless vector database for RAG.
- **Upstash Redis**: Serverless Redis for conversation threads and caching.
- **Neon Database**: Serverless PostgreSQL for primary data persistence.
- **Evolution API**: WhatsApp integration.

**Key NPM Packages**:
- `@radix-ui/*`: Headless UI components.
- `@tanstack/react-query`: Server state management.
- `drizzle-orm`: Type-safe ORM.
- `express`: Web server framework.
- `react-hook-form`, `zod`: Form handling and validation.
- `tailwindcss`: CSS framework.