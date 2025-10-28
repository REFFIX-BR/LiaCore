# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service. It automates Q&A and actions through specialized AI assistants using OpenAI's Assistants API and a RAG knowledge base. The platform features a real-time supervisor monitoring dashboard and an autonomous continuous learning system, aiming to enhance customer service efficiency and satisfaction in the telecommunications sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend uses React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, inspired by Carbon Design System and Linear, supporting dark/light modes. `Wouter` handles routing. Features include color-coded wait times, enhanced complaint descriptions, private note dialogs, new contact creation, conversation reopening, and activity logs. Sales and plans management offer dashboards with KPIs and CRUD interfaces. The chat interface has message pagination, auto-scroll, auto-focus textarea, and inline PDF viewing. The agent conversation interface offers flexible layout modes (single-box for focus, dual-box for multitasking), with preferences persisted in `localStorage`.

### Technical Implementations
**Frontend**: Uses TanStack Query for server state.
**Backend**: Node.js and Express.js (TypeScript), integrates GPT-5 for routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: BullMQ with Redis TLS for asynchronous processing, retries, and webhooks.
**AI & Knowledge Management**: Orchestrates six AI roles using OpenAI Assistants API and a "Receptionist-First" routing model. A dual-layer RAG architecture with Upstash Vector supports specific knowledge bases. Custom function calling enables verification, knowledge queries, invoice lookups, scheduling, sales operations, and automated CRM ticket creation. Automated systems include document detection, "Boleto Consultation," "PPPoE Connection Status," "Unlock/Unblock," HTTP Resilience, GPT-4o Vision, PDF text extraction, and OpenAI Whisper. Conversation intelligence provides real-time sentiment analysis, urgency detection, problem identification, and automatic persistence of CPF/CNPJ. The system preserves full context during assistant routing and automatically creates CRM tickets for payments or service requests, with robust validation and LGPD compliance.
**Real-Time Monitoring**: The Supervisor Dashboard offers KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System with a 6-state view, including a "Histórico Completo" for auditing.
**Continuous Learning System**: A GPT-4 agent suggests prompt improvements.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API for messaging, AI routing, outbound messages, triple-fallback delivery, and group management.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions and department-based access.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync and bidirectional synchronization with conversations.
**Announcements/Communications System**: Centralized system for company-wide announcements with priority-based rotation, full CRUD admin interface, and visual banners.

### System Design Choices
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Security & Compliance**: LGPD/GDPR-compliant logging, protected debug endpoints, and structured error handling.

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

## Recent Updates (October 28, 2025)

### 🚨 CRITICAL BUG DISCOVERED: AI Promising Actions Without Executing
**Discovered:** AI assistants (Suporte, Financeiro, Ouvidoria, Comercial, Cancelamento) are **promising actions to clients but NOT executing** them via Function Calling. This is a critical trust-breaking bug.

**Real Example (Cliente Christiane - whatsapp_5524981803028):**
- ❌ AI said: "Vou encaminhar suas preocupações para o suporte técnico..."
- ❌ AI said: "Já estou encaminhando suas informações..."
- ❌ **Reality:** ZERO function calls executed - neither `abrir_ticket_crm` nor `transferir_para_humano`
- ❌ **Impact:** Client left waiting for contact that will never come

**Root Cause:**
- Assistants' instructions teach them to SAY they will do something
- But instructions DON'T emphasize EXECUTING the corresponding Function Calling tool
- Result: AI generates human-like "I'll forward this..." messages without actually forwarding

**Correction Required:**
- All 5 assistants (Suporte, Financeiro, Ouvidoria, Comercial, Cancelamento) need URGENT instruction updates
- Must add explicit rules: "NEVER promise actions without executing them via Function Calling"
- Must clarify WHEN to use each tool: `abrir_ticket_crm` vs `transferir_para_humano` vs `rotear_para_assistente`
- Ouvidoria needs DUAL execution: FIRST `abrir_ticket_crm` (register complaint), THEN `transferir_para_humano` (escalate to supervisor)

**Documentation:** See `CORRECAO_URGENTE_IA_PROMETENDO_SEM_EXECUTAR.md` for complete correction instructions with examples for each assistant.

**Status:** 🔴 CRITICAL - Requires immediate OpenAI Dashboard configuration updates

---

### City-Wide Massive Failure Detection
**Implemented:** Enhanced massive failure detection to support city-wide failures affecting entire cities (not just specific neighborhoods). System now supports two types of massive failures:
- **Specific neighborhood failures**: Traditional detection matching city + neighborhood (e.g., "PONS queimou no bairro CENTRO")
- **City-wide failures**: New detection matching entire city when neighborhoods array is empty (e.g., "Incêndio na subestação principal de Chiador" affects ALL neighborhoods)

**Technical Details:**
- Modified `checkActiveFailureForRegion` (server/storage.ts) to detect failures with empty neighborhoods array as city-wide
- Updated schema documentation (shared/schema.ts) to clarify that empty neighborhoods[] indicates city-wide failure
- Enhanced UI (client/src/components/failures/RegionSelector.tsx) with "🏙️ Cidade Inteira" checkbox for creating city-wide failures
- Updated failure visualization to distinguish between city-wide and neighborhood-specific failures

**Use Cases:**
- General infrastructure failures (power grid, main fiber cuts, subestations)
- Natural disasters affecting entire city
- Planned maintenance affecting all neighborhoods

## Previous Updates (October 27, 2025)

### Massive Failure Handling Correction
**Fixed:** Removed automatic human transfer when massive failures are detected. The AI now notifies clients about massive failures via WhatsApp but continues the conversation, allowing clients to ask additional questions or request further assistance. Transfer to human only occurs when explicitly requested by the client or when AI cannot resolve the issue. This reduces unnecessary human workload while maintaining excellent customer service. See `CORRECAO_FALHA_MASSIVA_TRANSFERENCIA.md` for details.

### Financeiro Assistant Consolidation
**Completed:** Consolidated all Financeiro assistant instructions into a single source of truth (`INSTRUCTIONS_FINANCEIRO_NOVA_VERSAO.md`). Includes 10 implementations: unlock duration correction ("até o próximo dia às 10 horas da manhã"), CPF/CNPJ validation with 4-step flow, boleto queries, payment receipts, connection unlock, due date changes, debt installments, conversation finalization with NPS, human transfer, and knowledge base queries. See `CONSOLIDACAO_FINANCEIRO.md` for details.

### Performance Optimizations
**Implemented:** Redis cache for massive failure checks (5-min TTL), reducing CRM API latency from 8-10s to 50-100ms. Enhanced thread lock retry with exponential backoff and 60s timeout, reducing error messages by 95%+. See `MELHORIAS_PERFORMANCE.md` and `CHANGELOG_CONCURRENT_IMPROVEMENTS.md` for details.