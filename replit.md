# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service. It automates Q&A and actions using specialized AI assistants powered by OpenAI's Assistants API and a RAG knowledge base. The platform features a real-time supervisor monitoring dashboard and an autonomous continuous learning system, aiming to enhance customer service efficiency and satisfaction in the telecommunications sector through advanced AI orchestration.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend uses React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, inspired by Carbon Design System and Linear, with dark/light mode support. Features include color-coded wait times, enhanced complaint descriptions, private note dialogs, new contact creation, conversation reopening, and activity logs. Sales and plans management offer dashboards with KPIs and CRUD interfaces. The chat interface includes message pagination, auto-scroll, auto-focus, and inline PDF viewing. The agent conversation interface provides flexible layout modes (single-box for focus, dual-box for multitasking), with preferences persisted in `localStorage`.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management.
**Backend**: Node.js and Express.js (TypeScript) integrating GPT-5 for routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: Employs BullMQ with Redis TLS for asynchronous processing.
**AI & Knowledge Management**: Orchestrates six AI roles using OpenAI Assistants API and a "Receptionist-First" routing model. A dual-layer RAG architecture with Upstash Vector supports specific knowledge bases. Custom function calling enables verification, knowledge queries, invoice lookups, scheduling, sales operations, automated CRM ticket creation, and service order (OS) status checks. Automated systems include document detection, "Boleto Consultation," "PPPoE Connection Status," "Unlock/Unblock," "Service Order Status," HTTP Resilience, GPT-4o Vision, PDF text extraction, and OpenAI Whisper. Conversation intelligence provides real-time sentiment analysis, urgency detection, problem identification, and automatic persistence of CPF/CNPJ. The system preserves full context during assistant routing and automatically creates CRM tickets. It handles multiple installation points by discretely asking "Which address has the problem?" and using `selecionar_ponto_instalacao`. The knowledge base automatically loads all documents on mount using parallel semantic queries.
**AI-to-AI Routing** (Nov 2025): Specialized assistants (Suporte, Comercial, Financeiro, Cancelamento, Ouvidoria) now use `rotear_para_assistente` to route out-of-scope requests to peer AI assistants, reserving `transferir_para_humano` exclusively for explicit human requests or manual-only actions. This eliminates unnecessary human transfers when AI can handle cross-domain requests. Implementation: Updated all assistant instructions in `INSTRUCOES_ASSISTENTES_OPENAI.md` with routing policies and tool definitions in `FUNCAO_ROTEAR_ASSISTENTE.md`.
**Prompt Management System**: AI-powered prompt editor with version control. Features include a draft workflow, semantic versioning with diff comparison, GPT-4o AI analysis for scores and recommendations, real-time token counter, automatic OpenAI Assistants API synchronization, cache invalidation, version restoration, and integration with Context Quality Monitor for AI-generated prompt fixes.
**Context Quality Monitoring System**: Automated real-time monitoring of AI conversation context quality with a visual dashboard. Features include four automated detectors (duplicate data requests, ignored history, duplicate routing, context reset), alert severity classification, in-memory alert cache, real-time statistics aggregation, and AI-powered automatic prompt correction suggestions.
**Gamification System**: Automated performance ranking with a V2 configuration system for dynamic customization of scoring parameters (e.g., NPS, Volume, Resolution Rate, Response Time). Includes a configurable badge system, visual dashboard, monthly calculation, and API endpoints for settings, rankings, and statistics.
**Real-Time Monitoring**: Supervisor Dashboard offers KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System with a 6-state view including "Histórico Completo" for auditing. It displays `active`, `queued`, and recently `resolved` conversations.
**Agent Dashboard Enhancements** (Nov 2025): The agent dashboard now supports period-based filtering (daily/weekly/monthly) for performance metrics. Features include accurate TMA (Tempo Médio de Atendimento) calculation, period-aware metrics aggregation, and reactive UI with filter buttons. The TMA is calculated by averaging the time difference (in seconds) between conversation creation and resolution for all conversations resolved within the selected period. API endpoint `/api/dashboard/agent` accepts optional `period` query parameter (today|week|month) with intelligent date range calculation.
**Continuous Learning System**: A GPT-4 agent suggests prompt improvements.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API supporting 3 WhatsApp instances (Leads, Cobranca, Principal) with end-to-end instance routing.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync.
**Announcements/Communications System**: Centralized system for company-wide announcements with priority-based rotation and CRUD admin interface.
**LIA VOICE - Outbound Debt Collection Module** (Nov 2025): Complete production-ready backend implementation for proactive voice calls using Twilio + OpenAI Realtime API. Features include:
- **5 BullMQ Workers**: campaign-ingest, scheduling, dialer, post-call, promise-monitor for autonomous operations
- **Twilio Integration**: Uses Replit's native Twilio integration for improved security and credential management (via `twilioIntegration.ts` module). Includes secure webhook signature verification (HMAC), call recording, status tracking, and `/api/voice/test-twilio` endpoint for connection validation
- **OpenAI Realtime API**: WebSocket bridge at `/api/voice/webhook/stream` for bidirectional audio streaming (Twilio Media Stream ↔ OpenAI)
- **Audio Protocol**: Adaptive batching (every 10 chunks), inactivity timer (250ms auto-commit), final flush on disconnect, correct `input_audio_buffer.commit` and `response.output_audio_buffer.commit` with `response_id`
- **Session Security**: Redis-based one-time credential caching with TTL, credentials deleted after use
- **Compliance**: ANATEL regulations enforced (08:00-20:00 hours only, max 3 attempts/client)
- **Graceful Degradation**: Workers skip without consuming attempts if credentials missing
- **Feature Flag**: `voice_outbound_enabled` ensures zero impact on WhatsApp flows
- **Campaign Management**: Full CRUD for campaigns, targets, promises with admin/supervisor UI
- **Statistics Auto-Recalculation**: Automatic campaign statistics update on target import, counting only successful contacts (`outcome='success'`)
- **Target**: 200 clients/day with 3 attempts each, integrated with CRM via API

### System Design Choices
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, auto-resolving old stuck conversations (+7 days), conversation assignment bug fixes, and configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Security & Compliance**: LGPD/GDPR-compliant logging, protected debug endpoints, and structured error handling.
- **Failure Detection**: Enhanced massive failure detection supporting city-wide outages.
- **Massive Failure Notification**: Automatically notifies clients ONCE via WhatsApp about active failures without blocking conversation flow.
- **Massive Failure Resolution**: Asynchronously notifies all affected customers via WhatsApp upon resolution.
- **Conversation Reopening**: Automatically reopens resolved conversations when a client sends a new message.
- **Intelligent Farewell Detection & Auto-Resolution** (Nov 2025): The inactivity follow-up worker now detects when both client and AI exchange farewells (e.g., "obg"/"tenha um ótimo dia") and automatically resolves the conversation, sending NPS survey instead of follow-up messages. This prevents inappropriate "continuity" messages after natural conversation endings, improving UX when AI forgets to call `finalizar_conversa`.
- **Payment Proof Auto-Resolution** (Nov 2025): The system now automatically resolves conversations when a client sends payment proof (e.g., Pix receipt), a CRM ticket is created, and the client doesn't respond to the continuity question ("Deseja continuar o atendimento?"). This prevents abandoned conversations from remaining open indefinitely after payment confirmation is received.
- **Comprehensive Auto-Closure System** (Nov 2025): Complete redesign of inactivity management to prevent stuck conversations. The system now schedules inactivity follow-ups after EVERY AI response (not just client messages), ensuring conversations are always tracked for auto-closure. If client doesn't respond within 10 minutes, sends follow-up message. If still no response after 20 more minutes, auto-resolves and sends NPS survey. Administrative endpoint `/api/admin/auto-resolve-old-conversations` provides manual cleanup for edge cases (conversations stuck for 7+ days), with dry-run support and batch limit of 100 conversations per execution for safety.
- **Conversation Assignment Bug Fix** (Nov 2025): Fixed critical bug where conversations assigned to agents via `/api/conversations/:id/assign` endpoint were not marking `transferred_to_human=true`, causing them to incorrectly appear in "IA Atendendo" tab instead of "Em Atendimento". The fix ensures that when a conversation is assigned (either self-assignment or manual assignment by supervisor), it automatically marks `transferred_to_human=true` and `transferredAt` if not already set. Retroactively corrected 14+ affected conversations in production database.

## Scalability & Performance

**Scaling Plan** (November 2025): Comprehensive scalability analysis and roadmap documented in `ESCALABILIDADE.md`. The plan addresses scaling to 160,000 messages at peak with 15,000 concurrent conversations through:
- **Queue optimization**: Partitioned BullMQ queues per assistant domain
- **Worker scaling**: Horizontal pod autoscaling (12-20 message processing pods)
- **Database optimization**: PostgreSQL connection pooling (PgBouncer), composite indexes, weekly partitioning
- **OpenAI optimization**: Embedding cache, intelligent model selection, batch RAG queries
- **Infrastructure**: Multi-tier roadmap (Phases 0-4) spanning 6 months with progressive capacity increases from 50 msg/s (current) to 200+ msg/s (target)
- **Observability**: Prometheus + Grafana dashboards for queue health, database performance, OpenAI metrics, and conversation throughput
- **Cost projection**: $2,130/month (current) to $11,750/month (fully scaled) with detailed ROI analysis

See `ESCALABILIDADE.md` for complete technical specifications, implementation roadmap, and cost breakdown.

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
- `js-tiktoken`: Token counting for OpenAI models.