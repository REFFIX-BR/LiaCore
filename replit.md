# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed to automate Q&A and actions for TR Telecom's customer service. It leverages specialized AI assistants powered by OpenAI's Assistants API and a RAG knowledge base. The platform includes real-time supervisor monitoring and an autonomous continuous learning system, aiming to significantly enhance customer service efficiency and satisfaction within the telecommunications sector. Its business vision is to provide a scalable, intelligent, and cost-effective solution for managing customer interactions, improving agent productivity, and offering a superior customer experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend, built with React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, draws inspiration from Carbon Design System and Linear, supporting both dark and light modes. Key features include color-coded wait times, enhanced complaint descriptions, private note dialogs, new contact creation, conversation reopening, and comprehensive activity logs. Dashboards provide KPIs and CRUD interfaces for sales and plans management. The chat interface supports message pagination, auto-scroll, auto-focus, and inline PDF viewing. The agent conversation interface offers flexible layout modes, with preferences persisted locally.

### Technical Implementations
The platform uses TanStack Query for frontend server state management. The backend, built with Node.js and Express.js (TypeScript), integrates GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM. Asynchronous processing is managed by BullMQ with Redis TLS. A persistent message batching system combines sequential messages to reduce token costs and API calls. A Thread Rotation System optimizes context windows for long conversations.

AI and knowledge management orchestrate seven specialized AI assistants using a "Receptionist-First" routing model, supported by a dual-layer RAG architecture. Custom function calling enables various operations like verification, knowledge queries, invoice lookups, scheduling, sales operations, CRM ticket creation, service order status checks, payment promise registration, document persistence, and payment clearance verification. It handles flexible client identification, preserves full context during assistant routing, and supports AI-to-AI routing.

A Prompt Management System offers an AI-powered editor with version control, draft workflows, semantic versioning, GPT-4o analysis, real-time token counting, and automatic OpenAI Assistants API synchronization. A Context Quality Monitoring System provides automated real-time context monitoring with detectors for issues and offers AI-powered prompt correction suggestions. The commercial assistant (Lia Comercial) is optimized for direct, efficient sales conversations.

The platform includes a Gamification System, a Supervisor Dashboard for real-time monitoring and intervention controls, and an Agent Dashboard for performance metrics. A Continuous Learning System with a GPT-4 agent suggests prompt improvements. A Fair Resolution Metrics System prevents agents from losing credit when conversations are reopened.

Hybrid Supervised Mode manages "Transferred" and "Assigned" conversations with AI-assisted agent responses. Native WhatsApp integration with Evolution API supports four WhatsApp instances (Principal, Leads, Cobranca, Abertura) with end-to-end routing. The "Abertura" instance is dedicated for conversation reopenings and WhatsApp groups. Role-Based Access Control (RBAC) is implemented with ADMIN, SUPERVISOR, and AGENT tiers. A centralized Contact Management System with automatic WhatsApp contact sync and an Announcements/Communications System are also present.

The COBRANÇAS - Autonomous Debt Collection Module is a WhatsApp-based system with a dedicated AI Cobrança assistant for debt negotiation, payment promise registration, and compliance, utilizing Meta-approved templates. It features dedicated monitoring, a Messaging Control Center for flexible contact method management, and campaign conversation tracking. It integrates with CRM for proactive debt collection, including configurable sync schedules, data transformation, smart deduplication, and error handling. A comprehensive phone normalization utility ensures canonical format for WhatsApp integration. A Selective Target Activation System allows bulk management of collection volumes.

Advanced features include an automatic retry and rate limiting system for WhatsApp messages using a Redis-based token bucket, and an enhanced idempotency architecture for BullMQ workers. Chat lock optimization reduces concurrency lock timeouts for faster message recovery. Full support for WhatsApp Business accounts is implemented, with a centralized `chatId` creation fix. A Campaign Job Persistence System ensures automatic recovery of BullMQ campaign jobs after server restarts.

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
- **Fidelity Compliance Rule**: All TR Telecom plans require mandatory 12-month fidelity. The commercial assistant prompt explicitly prohibits stating no-commitment offers and enforces accurate fidelity disclosure.
- **LGPD CPF Compliance**: CPF is no longer stored in the database. The system now requests CPF from the customer for each API query (e.g., for boleto) without persisting it, using Redis with 5-minute TTL for temporary storage during multi-point selection flows only.
- **Message Archiving System**: A two-table architecture automatically archives messages older than 30 days to `messages_archive` while remaining fully queryable, optimizing performance for the main `messages` table.
- **Webhook Replay Protection System**: Dual-layer protection against Evolution API webhook replays: (1) Redis-based deduplication by WhatsApp messageId with 24h TTL, marking as processed only AFTER successful enqueue to prevent retry loss; (2) Stale message flagging for messages >1 hour old (logged but not rejected) with `isStaleMessage` flag to prevent lastMessageTime corruption from historical replays.
- **Admin Bulk Close Protection System**: Four-layer protection for administratively closed conversations:
  1. **Storage Layer Protection (DEFINITIVE)**: `storage.updateConversation` blocks any status change to `active`/`queued` for conversations with `admin_bulk_close` flag - this is the final guard that cannot be bypassed
  2. **Worker Protection**: BullMQ message processing jobs check `metadata.npsSkipReason` before sending AI responses - if it starts with `admin_bulk_close`, the job is aborted
  3. **Main Webhook Protection**: Evolution API webhook handler blocks reopening for resolved conversations with admin_bulk_close flag
  4. **Alternate Webhook Protection**: Secondary reopen path also protected against admin-closed conversations
  - All blocked attempts are logged to activity_logs with action `blocked_reopen_admin_closed` for audit trail
  - Flag format: `admin_bulk_close_<reason>` (e.g., `admin_bulk_close_10min`, `admin_bulk_close_30min`)

## External Dependencies
- **OpenAI**: AI Assistants API.
- **Upstash Vector**: Serverless vector database.
- **Upstash Redis**: Serverless Redis.
- **Neon Database**: Serverless PostgreSQL.
- **Evolution API**: WhatsApp integration.