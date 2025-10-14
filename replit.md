# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service. It intelligently routes and coordinates specialized AI assistants, leveraging OpenAI's Assistants API and a RAG knowledge base. The platform automates Q&A, executes actions like boleto consultation and PPPoE diagnosis, and features a real-time supervisor monitoring dashboard for human intervention. It also includes an autonomous continuous learning system that evolves AI assistant prompts, aiming to significantly enhance customer service efficiency and satisfaction.

## Recent Changes (2025-10-14)
**Added: Bulk Conversation Resolution System**
- ✅ **NEW FEATURE**: Admins can now finalize all active conversations at once
  - Problem: Needed efficient way to close multiple conversations at end of day
  - Solution: New endpoint `/api/supervisor/resolve-all` (POST)
  - Batch processes all active/transferred/assigned/queued conversations
  - Automatically sends NPS surveys to WhatsApp clients
  - Creates learning events for each resolved conversation
  - Logs all actions in supervisor_actions table
  - Permissions: Admin only (via `requireAdmin` middleware)
  - Location: `server/routes.ts` (line ~3102)
  - Usage: Successfully finalized 72 conversations (54 active + 18 queued)

**Added: Thread Context Reset Functionality**
- ✅ **NEW FEATURE**: Supervisors can now reset OpenAI thread context while keeping messages in database
  - Problem: Stuck conversations with problematic AI history needed fresh context without losing audit trail
  - Solution: New endpoint `/api/conversations/:id/reset-thread` (POST)
  - Creates new OpenAI thread, updates threadId in PostgreSQL and Redis
  - Preserves all messages in database for compliance/audit
  - Logs action in supervisor_actions table for accountability
  - UI: New "Resetar Contexto OpenAI" button in Monitor → Ações tab
  - Permissions: Admin and Supervisor only (via `requireAdminOrSupervisor` middleware)
  - Location: `server/routes.ts` (line ~5273), `client/src/pages/Monitor.tsx`, `client/src/components/ConversationDetails.tsx`
- ✅ **CRITICAL BUG FIX**: Fixed function name mismatch in AI tools
  - Problem: OpenAI called `consultar_boleto_cliente` (with 'r') but code had `consulta_boleto_cliente` (without 'r')
  - Root cause: Case statement never matched, function never executed
  - Solution: Standardized all function names to `consultar_*` pattern (with 'r')
  - Affected: `consultar_boleto_cliente`, normalized in `server/ai-tools.ts`
  - Result: Financeiro assistant now successfully queries real boletos from TR Telecom API
- ✅ **FEATURE ENHANCEMENT**: Boleto responses now include payment link
  - Enhancement: Added `link_pagamento` field to boleto responses
  - Benefit: Clients can now pay directly via link without typing código de barras
  - Implementation: Response formatting in `server/lib/openai.ts` (line ~841)
  - Assistant instructions updated in `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md`
  - Location: Financeiro assistant now sends formatted boletos with link, código de barras, and PIX

**Previous Changes (2025-10-13)**
- ✅ Automatic CPF/CNPJ detection from client messages
- ✅ Normalized document comparison in security validations
- ✅ Financial assistant boleto queries without re-asking for CPF
- ✅ Conversation reopen fix - resets to Apresentação assistant
- ✅ All logs mask sensitive information (CPF/CNPJ)

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS. Its design is influenced by Carbon Design System and Linear, optimizing for data-dense enterprise interfaces, and it supports both dark and light modes. Client-side routing is handled by Wouter.

### Technical Implementations
**Frontend**: Uses TanStack Query for server state management and includes pages such as Dashboard, Monitor, Test Chat, Conversations, Knowledge, Assistants, Agent Evolution, Metrics, Feedbacks NPS, and Settings.

**Backend**: Built with Node.js and Express.js (TypeScript). It utilizes GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM for data persistence. Session management is based on OpenAI thread-based conversations stored in Redis.

**Queue System**: Employs BullMQ with Redis TLS for asynchronous message processing across six queues (message-processing, ai-response, image-analysis, nps-survey, learning-tasks, inactivity-followup). It includes automatic retry mechanisms and webhook fallback to ensure zero message loss and supports high conversation volumes. A Redis-based distributed lock prevents concurrency issues with OpenAI threads. **Message Concurrency Control**: Implements chat-level locking (60s TTL) to ensure sequential processing of messages from the same chat, preventing out-of-order responses and context confusion.

**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API.
- **Specialized Assistants**: Six roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) with a "Receptionist-First" routing model. The "Receptionist" assistant routes to specialized assistants but cannot transfer to humans; only specialized assistants can. **Silent Routing**: When LIA Apresentação routes to a specialist, only the specialist's welcome message is sent to avoid duplicate/confusing messages.
- **Conversation Management**: Robust logic for conversation finalization, proper NPS survey delivery, and asynchronous conversation summarization.
- **RAG Architecture**: Features a dual-layer prompt system separating System Prompts (behavioral rules) from RAG Prompts (context-specific information) using Upstash Vector for semantic search.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, and scheduling, with secure internal-only tool execution. The `consultar_fatura` tool (used by Financeiro assistant) redirects to `consulta_boleto_cliente` for real API calls instead of returning mock data.
- **Automated Systems**: Includes automated document detection (CPF/CNPJ), "Boleto Consultation", "PPPoE Connection Status", and "Unlock/Unblock" systems with integrated security. An HTTP Resilience System centralizes retry logic with exponential backoff and timeouts for all external API calls to TR Telecom webhooks.
- **Vision System**: GPT-4o Vision for automatic WhatsApp image analysis with a dual download strategy.
- **PDF Text Extraction System**: Automatic text extraction from PDF documents for AI analysis, supporting various formats and handling size limits.
- **Audio Processing System**: Handles WhatsApp audio messages with automatic transcription via OpenAI Whisper API.
- **Conversation Intelligence System**: Provides real-time analysis including sentiment, urgency classification, technical problem detection, recurrence detection, and automatic persistence of CPF/CNPJ.

**Real-Time Monitoring**: A Supervisor Dashboard provides KPIs, live conversation queues, alerts, transcripts, and human intervention controls. This includes a Live Logs System for real-time event monitoring and an Agent Reasoning Logs system visualizing AI assistant decision-making.

**Continuous Learning System**: An autonomous GPT-4 agent suggests prompt improvements based on supervisor interventions and feedback.

**NPS & Customer Satisfaction**: Automated NPS surveys via WhatsApp post-conversation, with feedback integrated into the learning system. Features rigorous regex validation for NPS responses and an auto-send system after conversation resolution.

**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with real-time counters and AI-assisted agent responses. Includes an Agent Welcome Message System and an Inactivity Follow-up System for re-engagement.

**WhatsApp Integration**: Native integration with Evolution API for real-time message processing, AI routing, and outbound messaging. Supports multi-instance Evolution API operation with dynamic API key lookup.

**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions and user management.

**Personalized Dashboards**: Role-specific dashboards offer relevant KPIs and data, including system health and cost analysis for Admin.

**Contact Management System**: Centralized client database for tracking conversation history, enabling proactive service, and includes automatic WhatsApp contact synchronization.

**Message Deletion System**: Supervisors and agents can delete assistant messages from the database and WhatsApp (within WhatsApp's 2-day window), allowing correction of AI errors and removal of sensitive information.

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