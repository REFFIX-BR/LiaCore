# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service. It automates Q&A and actions using specialized AI assistants powered by OpenAI's Assistants API and a RAG knowledge base. The platform features real-time supervisor monitoring and an autonomous continuous learning system, aiming to enhance customer service efficiency and satisfaction in the telecommunications sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend, built with React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, is inspired by Carbon Design System and Linear, supporting dark/light modes. It includes features like color-coded wait times, enhanced complaint descriptions, private note dialogs, new contact creation, conversation reopening, activity logs, and dashboards for sales and plans management with KPIs and CRUD interfaces. The chat interface offers message pagination, auto-scroll, auto-focus, and inline PDF viewing. The agent conversation interface supports flexible layout modes (single-box for focus, dual-box for multitasking), with preferences persisted locally.

### Technical Implementations
**Frontend**: Uses TanStack Query for server state management.
**Backend**: Node.js and Express.js (TypeScript) integrate GPT-5 for routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM. BullMQ with Redis TLS handles asynchronous processing.
**Message Batching System**: A persistent batching system using Redis BullMQ combines sequential messages from the same client within a 3-second window to reduce token costs and API calls.
**AI & Knowledge Management**: Orchestrates seven specialized AI assistants using a "Receptionist-First" routing model. A dual-layer RAG architecture with Upstash Vector supports specific knowledge bases. Custom function calling enables verification, knowledge queries, invoice lookups, scheduling, sales operations, automated CRM ticket creation, service order (OS) status checks, payment promise registration, document persistence, and payment clearance verification. It supports flexible client identification, preserves full context during assistant routing, automatically creates CRM tickets, handles multiple installation points, and supports AI-to-AI routing.
**Prompt Management System**: Features an AI-powered prompt editor with version control, draft workflows, semantic versioning, GPT-4o AI analysis, real-time token counting, and automatic OpenAI Assistants API synchronization.
**Context Quality Monitoring System**: Provides automated real-time monitoring of AI conversation context with detectors for issues like duplicate data requests and ignored history, offering AI-powered prompt correction suggestions.
**Gamification System**: Includes automated performance ranking with a configurable V2 system for scoring and a badge system.
**Real-Time Monitoring**: The Supervisor Dashboard offers KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System.
**Agent Dashboard Enhancements**: Supports period-based filtering for performance metrics, including accurate TMA calculation.
**Continuous Learning System**: A GPT-4 agent suggests prompt improvements.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API supporting 3 WhatsApp instances with end-to-end instance routing.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync.
**Announcements/Communications System**: Centralized system for company-wide announcements with priority-based rotation.
**COBRANÇAS - Autonomous Debt Collection Module**: A WhatsApp-based collection module with a dedicated AI Cobrança assistant for debt negotiation, payment promise registration, and compliance, using Meta-approved templates via Evolution API.
**Payment Promise System**: Manages the lifecycle of payment promises, enforcing a single active promise per client, automated registration, and automatic breach detection.
**Dedicated Cobranças Monitoring**: Conversations from collection campaigns are monitored via a dedicated interface, providing unified metrics and transfer capabilities.
**Messaging Control Center**: A professional control panel for flexible contact method management with global and per-campaign configuration.
**Campaign Conversation Tracking**: Integrates WhatsApp collection campaigns with cobranças monitoring, linking conversations to campaign targets.
**WhatsApp-Only Architecture**: The collection system has been simplified to a WhatsApp-only flow, removing Twilio voice infrastructure.
**Automated CRM Synchronization**: Infrastructure for proactive debt collection, importing overdue clients from CRM API with configurable sync schedules, data transformation, smart deduplication, and error handling. Includes a CRM Import UI.
**Meta-Approved WhatsApp Templates**: Uses Meta-approved templates for compliance, supporting named and positional variables.
**evolutionInstance Normalization**: Ensures consistent handling of WhatsApp instance names and prevents incorrect routing.
**AI Cobrança Prompt Fix**: Corrected a critical prompt issue to ensure accurate and positive responses from the AI during boleto consultation.
**Phone Normalization System**: A comprehensive phone number normalization utility ensures a canonical format (55XXXXXXXXXXX) for WhatsApp integration, preventing common messaging defects and handling CRM data corruption.
**Selective Target Activation System**: Provides bulk enable/disable controls for managing collection volume in campaigns, with UI support for multi-selection and status display.
**WhatsApp Retry & Rate Limiting System**: An automatic retry system for stuck WhatsApp messages with intelligent rate limiting using a Redis-based token bucket. It tracks message status, persists template metadata, and employs exponential backoff for retries with intelligent error classification.
**Idempotency Architecture Fix (Nov 2024)**: Redesigned BullMQ worker idempotency handling to prevent dirty keys from blocking retries. Reduced idempotency TTL from 24h to 5 minutes (300s), moved `markJobProcessed()` to execute ONLY after complete success (OpenAI + WhatsApp delivery), and added cleanup logic in catch blocks to delete dirty keys on failure. Applied consistently across all 5 workers (message processing, image analysis, NPS survey, inactivity follow-up, auto-closure). Fixed installation-point selection branches that previously bypassed idempotency marking. **CRITICAL FIX**: Corrected message recovery scheduler to generate unique `messageId` per retry attempt (`recovery_${conv.id}_${Date.now()}`) instead of reusing database UUID (`lastMessage.id`), preventing infinite blocking from stale Redis keys. Ensures reliable message recovery via 2-minute scheduler without 24h blocking periods.
**Chat Lock Optimization (Nov 2024)**: Reduced chat-level concurrency lock timeout from 30s to 10s for faster message recovery. Messages waiting for lock acquisition now fail faster and enter retry queue sooner, reducing client wait time from potential 30s delays to 10s maximum.
**WhatsApp Business (@lid) Support (Nov 2024)**: Full support for WhatsApp Business accounts which use special @lid identifiers instead of phone numbers. Evolution API webhook uses `parseRemoteJid()` helper to correctly parse `remoteJid` ending in `@lid`, storing conversations as `whatsapp_lid_<id>` format with `rawId` prefixed as `lid_<number>`. The `extractNumberFromChatId()` helper uses **EXPLICIT prefix detection only** (no heuristics) - LIDs MUST have `lid_` or `whatsapp_lid_` prefix to be detected, preventing misclassification of international phones (15+ digits) as Business accounts. All message sending paths (`sendWhatsAppMessage`, `sendWhatsAppMedia`, `sendWhatsAppImage`, `sendWhatsAppDocument`) use static imports of the centralized helper for optimal performance. Migrated 601 existing Business account conversations from malformed format (`XXX@lid`) to standardized format (`lid_XXX`) via automated scripts. Prevents Evolution API "Bad Request" errors for Business accounts through end-to-end format consistency while safely supporting international phone numbers.
**chatId Creation Centralization Fix (Nov 2024)**: Architectural correction to prevent recurring chatId malformation by enforcing centralized helper usage across ALL conversation creation paths. Previously, 3 critical code paths created chatIds using legacy string concatenation instead of `parseRemoteJid()` and `buildWhatsAppChatId()` helpers, allowing new malformed LID chatIds to bypass normalization. **Fixed paths:** (1) Metadata sync (`chats.upsert` webhook) now uses `parseRemoteJid()` to detect @lid accounts; (2) Manual contact creation uses `normalizePhone()` + `buildWhatsAppChatId()` for consistent formatting; (3) Conversation reopening uses `buildWhatsAppChatId()` on stored normalized phones. This prevents new malformed chatIds (`whatsapp_XXX@lid`) from being created, eliminating the root cause of Evolution API "Bad Request" errors for WhatsApp Business accounts. Combined with existing migration scripts for historical data, ensures 100% chatId format consistency going forward.

### System Design Choices
- **Chat Simulator (Test Chat)**: A professional testing tool for validating assistant behaviors, isolated from the production database.
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **System Health Dashboard (Nov 2024)**: Real-time monitoring page for conversations without AI response. Detects conversations where client sent last message but AI failed to respond (due to chatId malformation, Evolution API errors, or worker failures). Provides one-click reprocessing that re-adds messages to BullMQ queue with unique idempotency keys. Accessible at `/system-health` for ADMIN/SUPERVISOR roles. Includes severity badges (Recente <5min, Atenção 5-15min, Crítico >15min) and auto-refresh capabilities.
- **LID chatId Malformation Fix (Nov 2024)**: Corrected malformed WhatsApp Business chatIds that caused Evolution API "Bad Request" errors. Found 6 conversations with format `whatsapp_222805941596261@lid` (incorrect) instead of `whatsapp_lid_222805941596261` (correct). Created intelligent migration script (`fix-active-malformed-lid-chatids.ts`) that automatically resolves conflicts with old resolved conversations, renaming them to free up correct chatId format for active conversations. Fixed 2 active conversations (Alvaro, Rachel) and ensured backward compatibility with legacy formats (`XXX@lid@s.whatsapp.net`).
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Security & Compliance**: LGPD/GDPR-compliant logging, protected debug endpoints, and structured error handling. **IMPORTANT (Nov 2024)**: Cross-CPF query restrictions removed to allow family members to check each other's accounts (boletos, connection status, OS, payment status, desbloqueio). All cross-CPF operations are audit-logged with conversation ID and masked CPF digits for compliance tracking.
- **Failure Detection**: Enhanced massive failure detection supporting city-wide outages and automatic client notification via WhatsApp.
- **Conversation Reopening**: Automatically reopens resolved conversations upon new client messages.
- **Intelligent Farewell Detection & Auto-Resolution**: An inactivity follow-up worker detects farewells, auto-resolves conversations, and sends NPS surveys.
- **Payment Proof Auto-Resolution**: Automatically resolves conversations upon receipt of payment proof, CRM ticket creation, and no further client response.
- **Comprehensive Auto-Closure System**: Redesigned inactivity management with scheduled follow-ups and auto-resolution after inactivity.
- **Conversation Assignment Fix**: Ensures correct marking of assigned conversations for accurate tab display.
- **Thread ID Protection System**: Implemented defensive persistence guards to prevent conversation threadId from being overwritten, preserving OpenAI context.
- **Date/Time Awareness**: All new OpenAI threads automatically receive current date/time context in Brazilian Portuguese (pt-BR) format for accurate temporal awareness.

### Scalability & Performance
A roadmap outlines plans to handle 160,000 messages at peak with 15,000 concurrent conversations through queue optimization, worker scaling, database optimization, OpenAI optimization, multi-tier infrastructure, and extensive observability with Prometheus + Grafana.

**End-to-End Latency Instrumentation (Nov 2024)**: Comprehensive latency tracking system measures response time across the entire message pipeline with 6 checkpoints: (1) webhook_received, (2) queue_enqueued, (3) worker_started, (4) openai_request, (5) openai_response, (6) whatsapp_sent. Uses Redis circular list (LPUSH+LTRIM) to maintain last 1000 measurements without bias, enabling accurate percentile calculations (P50, P95, P99). System automatically alerts when P95 > 30s. Latency data persists in Redis with automatic cleanup, surviving crashes and worker restarts. API endpoints provide current measurements (/api/latency/current), aggregated reports (/api/latency/report), historical data (/api/latency/history), and active alerts (/api/latency/alerts). Performance target: ≤30 seconds end-to-end (P95). Current baseline: 20-36s P95, with OpenAI Assistants API (8-25s) as primary bottleneck, followed by batching (0-3s), queue wait (up to 5s), and WhatsApp send (1-3s).

## External Dependencies
- **OpenAI**: AI Assistants API.
- **Upstash Vector**: Serverless vector database.
- **Upstash Redis**: Serverless Redis.
- **Neon Database**: Serverless PostgreSQL.
- **Evolution API**: WhatsApp integration.