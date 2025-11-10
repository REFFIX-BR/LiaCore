# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service. It automates Q&A and actions using specialized AI assistants powered by OpenAI's Assistants API and a RAG knowledge base. The platform includes real-time supervisor monitoring and an autonomous continuous learning system, aiming to significantly improve customer service efficiency and satisfaction in the telecommunications sector through advanced AI orchestration. Key ambitions include improving customer service efficiency, driving customer satisfaction, and leveraging advanced AI for telecommunications support.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend, built with React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, draws inspiration from Carbon Design System and Linear, supporting dark/light modes. Features include color-coded wait times, enhanced complaint descriptions, private note dialogs, new contact creation, conversation reopening, and activity logs. Sales and plans management offer dashboards with KPIs and CRUD interfaces. The chat interface provides message pagination, auto-scroll, auto-focus, and inline PDF viewing. The agent conversation interface offers flexible layout modes (single-box for focus, dual-box for multitasking), with preferences persisted locally.

### Technical Implementations
**Frontend**: Uses TanStack Query for server state management.
**Backend**: Node.js and Express.js (TypeScript) integrate GPT-5 for routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM. BullMQ with Redis TLS handles asynchronous processing.
**AI & Knowledge Management**: Orchestrates seven specialized AI assistants using a "Receptionist-First" routing model (Cortex, Apresentação, Comercial, Financeiro, Suporte, Ouvidoria, Cancelamento, Cobrança). A dual-layer RAG architecture with Upstash Vector supports specific knowledge bases including Central do Assinante documentation. Custom function calling enables verification, knowledge queries, invoice lookups, scheduling, sales operations, automated CRM ticket creation, service order (OS) status checks, payment promise registration, **document persistence**, and **payment clearance verification**. **CPF/CNPJ Persistence (IA Cobrança Fix)**: Implemented `persistir_documento()` function that validates, normalizes, and persists client CPF/CNPJ to `conversation.clientDocument` before any financial operations. IA Cobrança assistant (v2.2.0, 8 tools) is instructed to ALWAYS call `persistir_documento()` immediately after CPF capture and BEFORE calling `consultar_faturas()`, preventing "technical error" failures. Handler includes format normalization (removes punctuation), validation via `validarCpfCnpj()`, masked logging for security, and structured success/error responses.. **72h Payment Clearance Verification (Ionara Freitas Resolution)**: Implemented `verificar_status_pagamento()` with dual detection strategy (conversation metadata primary source, CRM tickets fallback) to detect (1) pending payment proofs within 72-hour bank clearance window (`pendingWithProof: true`) and (2) trust-based unlocks (`unlockInTrust: true`), preventing inappropriate "non-payment" accusations when clients have submitted proof. Function returns `{ pendingWithProof, unlockInTrust, deadlineEta, ticketProtocolo?, ticketCreatedAt? }` and automatically persists unlock metadata after successful `solicitarDesbloqueio` operations. Financeiro assistant (v2.4.0) and Suporte assistant (v2.1.0) both instructed to ALWAYS call `verificar_status_pagamento()` before diagnosing connection problems or mentioning non-payment, explaining 72h clearance period empathetically with protocol and deadline information. Suporte routes inadimplent clients without pending proof to Financeiro via `rotear_para_assistente`. Automated systems include document detection, "Boleto Consultation," "PPPoE Connection Status," "Unlock/Unblock," "Service Order Status," HTTP Resilience, GPT-4o Vision, PDF text extraction, and OpenAI Whisper. Conversation intelligence provides real-time sentiment analysis, urgency detection, problem identification, and automatic persistence of CPF/CNPJ. The system preserves full context during assistant routing, automatically creates CRM tickets, and handles multiple installation points using `selecionar_ponto_instalacao`. AI-to-AI routing is supported via `rotear_para_assistente`.
**Prompt Management System**: AI-powered prompt editor with version control, draft workflows, semantic versioning, GPT-4o AI analysis, real-time token counting, and automatic OpenAI Assistants API synchronization. Intelligent deduplication (Jaccard similarity) is used before GPT-4o processing.
**Context Quality Monitoring System**: Automated real-time monitoring of AI conversation context with detectors for duplicate data requests, ignored history, duplicate routing, and context reset, providing AI-powered prompt correction suggestions.
**Gamification System**: Automated performance ranking with a configurable V2 system for scoring parameters and a badge system.
**Real-Time Monitoring**: The Supervisor Dashboard offers KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System with a 6-state view.
**Agent Dashboard Enhancements**: Supports period-based filtering for performance metrics, including accurate TMA calculation and period-aware metrics aggregation.
**Continuous Learning System**: A GPT-4 agent suggests prompt improvements.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API supporting 3 WhatsApp instances with end-to-end instance routing.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync.
**Announcements/Communications System**: Centralized system for company-wide announcements with priority-based rotation.
**COBRANÇAS - Autonomous Debt Collection Module**: Production-ready module with a dedicated IA Cobrança assistant specialized in empathetic debt negotiation, payment promise registration, and compliance. Supports proactive voice calls (Twilio + OpenAI Realtime API) and automated WhatsApp messaging (Evolution API). Features include BullMQ workers, a hybrid routing system, dual pre-send verification for WhatsApp messages, Twilio integration, OpenAI Realtime API via WebSocket, campaign management, and a humanized conversation flow including automatic invoice query.
**Payment Promise System**: Manages the complete lifecycle of payment promises, enforcing a single active promise per client, automated registration via IA Cobrança, multi-layer protection during collection attempts, a Unified Promise Monitor Worker for scheduled checks and reminders, automatic breach detection, and defined promise states (pending, reminderSent, fulfilled, broken). The AI can autonomously update campaign target status using `atualizar_status_cobranca`.
**Dedicated Cobranças Monitoring**: Conversations from collection campaigns are excluded from the Supervisor Dashboard and monitored via a dedicated `/voice/monitor` interface, providing unified metrics, conversation tables with source filtering, and transfer capabilities. The Supervisor Dashboard displays a real-time badge for pending payment promises.
**Messaging Control Center**: Professional control panel for flexible contact method management with global and per-campaign configuration, backend validation, and method-specific statistics API. Unified Metrics API aggregates total calls, WhatsApp messages, pending/fulfilled promises, and conversion rates.
**Campaign Conversation Tracking**: Complete integration between voice campaigns and cobranças monitoring, including `conversationSource` and `voiceCampaignTargetId` fields. The routing system automatically directs campaign-sourced conversations to the IA Cobrança assistant. WhatsApp collection worker creates or updates conversations, linking to campaign targets.

### System Design Choices
- **Chat Simulator (Test Chat)**: Professional testing tool at `/test-chat` for validating assistant behaviors, isolated from the production database.
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Security & Compliance**: LGPD/GDPR-compliant logging, protected debug endpoints, and structured error handling.
- **Failure Detection**: Enhanced massive failure detection supporting city-wide outages and automatic client notification via WhatsApp.
- **Conversation Reopening**: Automatically reopens resolved conversations upon new client messages.
- **Intelligent Farewell Detection & Auto-Resolution**: Inactivity follow-up worker detects farewells, auto-resolves conversations, and sends NPS surveys.
- **Payment Proof Auto-Resolution**: Automatically resolves conversations upon receipt of payment proof, CRM ticket creation, and no further client response.
- **Comprehensive Auto-Closure System**: Redesigned inactivity management with scheduled follow-ups and auto-resolution after inactivity, including an administrative cleanup endpoint.
- **Conversation Assignment Fix**: Ensures correct marking of assigned conversations for accurate tab display.

### Scalability & Performance
A comprehensive scaling plan in `ESCALABILIDADE.md` details a roadmap to handle 160,000 messages at peak with 15,000 concurrent conversations, involving queue optimization, worker scaling, database optimization, OpenAI optimization, multi-tier infrastructure roadmap, and extensive observability with Prometheus + Grafana.

## External Dependencies
- **OpenAI**: AI Assistants API.
- **Upstash Vector**: Serverless vector database.
- **Upstash Redis**: Serverless Redis.
- **Neon Database**: Serverless PostgreSQL.
- **Evolution API**: WhatsApp integration.
- **Twilio**: Voice calls (for Cobrança module).