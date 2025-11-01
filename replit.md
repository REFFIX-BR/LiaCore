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
**Prompt Management System**: AI-powered prompt editor with version control. Features include a draft workflow, semantic versioning with diff comparison, GPT-4o AI analysis for scores and recommendations, real-time token counter, automatic OpenAI Assistants API synchronization, cache invalidation, version restoration, and integration with Context Quality Monitor for AI-generated prompt fixes.
**Context Quality Monitoring System**: Automated real-time monitoring of AI conversation context quality with a visual dashboard. Features include four automated detectors (duplicate data requests, ignored history, duplicate routing, context reset), alert severity classification, in-memory alert cache, real-time statistics aggregation, and AI-powered automatic prompt correction suggestions.
**Gamification System**: Automated performance ranking with a V2 configuration system for dynamic customization of scoring parameters (e.g., NPS, Volume, Resolution Rate, Response Time). Includes a configurable badge system, visual dashboard, monthly calculation, and API endpoints for settings, rankings, and statistics.
**Real-Time Monitoring**: Supervisor Dashboard offers KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System with a 6-state view including "Histórico Completo" for auditing. It displays `active`, `queued`, and recently `resolved` conversations.
**Continuous Learning System**: A GPT-4 agent suggests prompt improvements.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API supporting 3 WhatsApp instances (Leads, Cobranca, Principal) with end-to-end instance routing.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync.
**Announcements/Communications System**: Centralized system for company-wide announcements with priority-based rotation and CRUD admin interface.

### System Design Choices
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Security & Compliance**: LGPD/GDPR-compliant logging, protected debug endpoints, and structured error handling.
- **Failure Detection**: Enhanced massive failure detection supporting city-wide outages.
- **Massive Failure Notification**: Automatically notifies clients ONCE via WhatsApp about active failures without blocking conversation flow.
- **Massive Failure Resolution**: Asynchronously notifies all affected customers via WhatsApp upon resolution.
- **Conversation Reopening**: Automatically reopens resolved conversations when a client sends a new message.

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