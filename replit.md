# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed to automate Q&A and actions for TR Telecom's customer service. It leverages specialized AI assistants powered by OpenAI's Assistants API and a RAG knowledge base. The platform includes real-time supervisor monitoring and an autonomous continuous learning system, aiming to significantly enhance customer service efficiency and satisfaction within the telecommunications sector. Its business vision is to provide a scalable, intelligent, and cost-effective solution for managing customer interactions, improving agent productivity, and offering a superior customer experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend, built with React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, draws inspiration from Carbon Design System and Linear, supporting both dark and light modes. Key features include color-coded wait times, enhanced complaint descriptions, private note dialogs, new contact creation, conversation reopening, and comprehensive activity logs. Dashboards provide KPIs and CRUD interfaces for sales and plans management. The chat interface supports message pagination, auto-scroll, auto-focus, and inline PDF viewing. The agent conversation interface offers flexible layout modes (single-box for focus, dual-box for multitasking), with preferences persisted locally.

### Technical Implementations
The platform uses TanStack Query for frontend server state management. The backend, built with Node.js and Express.js (TypeScript), integrates GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM. Asynchronous processing is managed by BullMQ with Redis TLS. A persistent message batching system uses Redis BullMQ to combine sequential messages, reducing token costs and API calls.

**Thread Rotation System** (Nov 2025): Automated context window optimization to reduce OpenAI processing latency. When conversations exceed 55 messages, the system automatically rotates to a new OpenAI thread, preserving critical context through AI-generated summaries (GPT-4o-mini) and critical message preservation. Features include: real-time message counting, concurrency protection via per-conversation locks, graceful failure handling, and support for legacy conversations. Expected to reduce OpenAI processing time by ~40% for long conversations, addressing the main latency bottleneck (69% of total response time).

AI and knowledge management orchestrate seven specialized AI assistants using a "Receptionist-First" routing model, supported by a dual-layer RAG architecture. Custom function calling enables verification, knowledge queries, invoice lookups, scheduling, sales operations, automated CRM ticket creation, service order status checks, payment promise registration, document persistence, and payment clearance verification. It handles flexible client identification, preserves full context during assistant routing, and supports AI-to-AI routing.

A Prompt Management System offers an AI-powered editor with version control, draft workflows, semantic versioning, GPT-4o analysis, real-time token counting, and automatic OpenAI Assistants API synchronization. A Context Quality Monitoring System provides automated real-time context monitoring with detectors for issues like duplicate data requests and ignored history, offering AI-powered prompt correction suggestions.

**Commercial Assistant Optimization** (Nov 2025): The commercial assistant (Lia Comercial) was optimized for direct, efficient sales conversations. The assistant now presents all available plans immediately when asked, allowing customers to choose directly instead of going through lengthy discovery questions. Discovery questions (number of users, usage type, mobile data needs) are now asked only if the customer explicitly requests help choosing a plan. This reduces conversation length by up to 40% while maintaining consultative support when needed.

**Massive Failures Real-Time Metrics** (Nov 2025): The Massive Failures dashboard metrics ("Notificações Enviadas" and "Clientes Notificados") were corrected to show real-time data from active failures only. Previously counted notifications from the last 30 days (including resolved failures). Now counts only notifications from currently active failures, automatically resetting to zero when all failures are resolved. Historical data remains accessible in the "Últimas Falhas Registradas" table.

The platform includes a Gamification System for performance ranking and badges, and a Supervisor Dashboard for real-time monitoring, KPIs, live queues, alerts, transcripts, human intervention controls, and live logs. An Agent Dashboard supports period-based filtering for performance metrics. A Continuous Learning System with a GPT-4 agent suggests prompt improvements.

Hybrid Supervised Mode manages "Transferred" and "Assigned" conversations with AI-assisted agent responses. Native WhatsApp integration with Evolution API supports three WhatsApp instances with end-to-end routing. Role-Based Access Control (RBAC) is implemented with ADMIN, SUPERVISOR, and AGENT tiers. A centralized Contact Management System with automatic WhatsApp contact sync and an Announcements/Communications System are also present.

The COBRANÇAS - Autonomous Debt Collection Module is a WhatsApp-based system with a dedicated AI Cobrança assistant for debt negotiation, payment promise registration, and compliance, utilizing Meta-approved templates. It features dedicated monitoring, a Messaging Control Center for flexible contact method management, and campaign conversation tracking. The collection system is WhatsApp-only, integrating with CRM for proactive debt collection, including configurable sync schedules, data transformation, smart deduplication, and error handling. A comprehensive phone normalization utility ensures canonical format for WhatsApp integration. A Selective Target Activation System allows bulk management of collection volumes.

Advanced features include an automatic retry and rate limiting system for WhatsApp messages using a Redis-based token bucket, and an enhanced idempotency architecture for BullMQ workers to ensure reliable message processing. Chat lock optimization reduces concurrency lock timeouts for faster message recovery. Full support for WhatsApp Business accounts (@lid) is implemented, with a centralized `chatId` creation fix to prevent malformation and ensure consistent formatting across all conversation creation paths.

**Campaign Job Persistence System** (Nov 2025): Automatic recovery mechanism for BullMQ campaign jobs after server restarts. When the server starts, the system automatically scans all active campaigns and re-enqueues pending targets (state=pending/scheduled with attemptCount=0). Features include: batch processing (100 targets at a time) for efficiency, idempotent enqueuing using targetId-based jobIds to prevent duplicates, progress logging, and graceful error handling. The 2-minute rate limiter between messages is preserved. This ensures that server restarts never lose campaign progress - all 1000+ targets are automatically recovered and processed in order.

### System Design Choices
- **Chat Simulator (Test Chat)**: A professional tool for validating assistant behaviors, isolated from the production database.
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **System Health Dashboard**: Real-time monitoring for conversations without AI response, offering one-click reprocessing.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Security & Compliance**: LGPD/GDPR-compliant logging, protected debug endpoints, and structured error handling, including audit logging for cross-CPF operations.
- **Failure Detection**: Enhanced massive failure detection supporting city-wide outages and automatic client notification via WhatsApp.
- **Conversation Management**: Includes automatic reopening of resolved conversations, intelligent farewell detection with auto-resolution and NPS surveys, payment proof auto-resolution, and a comprehensive auto-closure system.
- **Thread ID Protection System**: Defensive persistence guards prevent conversation `threadId` from being overwritten.
- **Date/Time Awareness**: All new OpenAI threads automatically receive current date/time context in Brazilian Portuguese (pt-BR).
- **LID chatId Malformation Fix**: Includes migration scripts and architectural corrections to resolve and prevent malformed WhatsApp Business chatIds.
- **Message Recovery LID Bug Fix** (Nov 2025): Critical fix for Message Recovery Scheduler that was causing ~20% failure rate for WhatsApp Business accounts. The scheduler now correctly prioritizes `conversation.clientId` (which preserves `lid_` prefix) instead of manually parsing `chatId`. This ensures proper format conversion (`lid_123` → `123@lid`) for Evolution API, resolving all LID-related message delivery failures.
- **Multi-Point Installation Address Fix** (Dec 2025): Fixed issue where customers with multiple installation points showed the same address for all points. Changed from `/infoscontrato` API (returns billing address) to `/check_pppoe_status` API (returns actual installation address per login). This enables AI to correctly identify and support customers at different locations under the same CPF/CNPJ.
- **LGPD CPF Compliance** (Dec 2025): **CRITICAL ARCHITECTURAL CHANGE** - CPF is no longer stored in the database. When a customer requests a boleto (invoice), the system now ALWAYS asks for the CPF/CNPJ at that moment and uses it directly for the API query without persisting. This ensures full LGPD compliance by:
  - Removing all stored CPF data from `conversations.clientDocument` and `contacts.document`
  - Modifying `persistir_documento`, `consultar_boleto_cliente`, and `consultar_fatura` functions to require CPF in arguments
  - Using Redis with 5-minute TTL for temporary CPF storage during multi-point selection flows only
  - The assistant prompts and function calls now always request CPF from the customer for each boleto query

**Message Archiving System** (Nov 2025): Two-table architecture for message storage optimization. Messages older than 30 days are automatically archived to `messages_archive` table while remaining fully queryable. Features include:
- Separate `messages_archive` table with identical structure to `messages`
- API endpoints for archived message retrieval (`/api/conversations/:id/messages/archived`, `/api/conversations/:id/messages/all`, `/api/messages/archive/search`, `/api/messages/archive/stats`)
- Search by conversation, date range, text content, or client name
- Performance optimization: main `messages` table stays lean (~250k records) while archive preserves historical data (~100k records)
- Transparent access: opening old conversations automatically fetches archived messages when needed

### Scalability & Performance
The roadmap targets handling 160,000 messages at peak with 15,000 concurrent conversations through queue optimization, worker scaling, database optimization, OpenAI optimization, multi-tier infrastructure, and extensive observability with Prometheus + Grafana. A comprehensive end-to-end latency tracking system measures response time across the message pipeline, with alerts for P95 latency exceeding 30 seconds.

### Future Roadmap
**Hybrid Button System** (Planned): Integration of Meta's interactive buttons with existing AI system for improved triaging and cost reduction. Proposed system would send WhatsApp button menus on first contact, routing simple requests (like invoice retrieval) to 100% automated flows without AI involvement, while complex cases route to existing AI assistants. Expected benefits: 40% faster response for simple requests, ~R$ 300/month savings on OpenAI tokens for automated invoice flows. Full technical specification available in `docs/HYBRID_BUTTON_SYSTEM.md`.

## Operational Documentation
- **Database Export & Replication**: Complete guide for backup, disaster recovery, and platform replication for new clients. Includes schema-only exports, selective data exports with LGPD compliance, automated backup scripts with encryption, full migration checklists, and deployment templates. RTO: 2 hours, RPO: 24 hours. Full documentation available in `docs/DATABASE_EXPORT_AND_REPLICATION.md`.
- **Hybrid Button System**: Technical specification for future implementation of Meta's interactive WhatsApp buttons integrated with AI routing. See `docs/HYBRID_BUTTON_SYSTEM.md`.

## External Dependencies
- **OpenAI**: AI Assistants API.
- **Upstash Vector**: Serverless vector database.
- **Upstash Redis**: Serverless Redis.
- **Neon Database**: Serverless PostgreSQL.
- **Evolution API**: WhatsApp integration.