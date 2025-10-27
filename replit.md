# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service. It leverages OpenAI's Assistants API and a RAG knowledge base to automate Q&A and actions through specialized AI assistants. The platform includes a real-time supervisor monitoring dashboard and an autonomous continuous learning system, aiming to significantly enhance customer service efficiency and satisfaction within the telecommunications sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, drawing inspiration from Carbon Design System and Linear for a modern aesthetic with dark/light mode support. `Wouter` manages client-side routing. Key UI features include color-coded wait time indicators, an enhanced complaint description interface, dialogs for private notes, dedicated UIs for new contact creation, conversation reopening, and activity logs. Sales and plans management systems provide dashboards with KPIs, tables, and CRUD interfaces. The chat interface supports message pagination with intelligent auto-scroll, auto-focus textarea, and inline PDF visualization.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management.
**Backend**: Powered by Node.js and Express.js (TypeScript), integrating GPT-5 for routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for managing conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: Employs BullMQ with Redis TLS for asynchronous processing, retries, and webhooks.
**AI & Knowledge Management**: Orchestrates six AI roles using OpenAI Assistants API and a "Receptionist-First" routing model. A dual-layer RAG architecture with Upstash Vector supports specific knowledge bases. Custom function calling enables verification, knowledge queries, invoice lookups, scheduling, sales operations, and automated ticket creation in CRM. Automated systems include document detection, "Boleto Consultation," "PPPoE Connection Status," "Unlock/Unblock," HTTP Resilience, GPT-4o Vision, PDF text extraction, and OpenAI Whisper. Conversation intelligence provides real-time sentiment analysis, urgency detection, problem identification, and automatic persistence of CPF/CNPJ. The system intelligently preserves full context during assistant routing and automatically creates CRM tickets for payment receipts or service requests, with robust validation and LGPD-compliant logging.
**Real-Time Monitoring**: The Supervisor Dashboard offers KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System with a 6-state view mode, including a "Histórico Completo" for long-term audit and regulatory compliance.
**Continuous Learning System**: A GPT-4 agent is used to suggest prompt improvements.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API for messaging, AI routing, outbound messages, triple-fallback delivery, and group management.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions and department-based access control.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync and bidirectional synchronization with conversations.
**Announcements/Communications System**: Centralized system for company-wide announcements with priority-based rotation display, full CRUD admin interface, and visual banners.

### System Design Choices
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Security & Compliance**: LGPD/GDPR-compliant logging, protected debug endpoints, and structured error handling to prevent sensitive data exposure.

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

## Recent Updates (Oct 27, 2025)

### Assistant Instructions Improvements
**Bug #2 - Function Simulation Fix**: ✅ RESOLVED - Critical bug where assistants wrote function calls as literal text visible to customers (e.g., `*[EXECUTO: rotear_para_assistente(...)]*`) instead of executing via OpenAI Function Calling. Added comprehensive anti-simulation rules to Apresentação and Suporte assistants. Files: `COPIAR_COLAR_APRESENTACAO_OPENAI.md`, `COPIAR_COLAR_SUPORTE_OPENAI.md`.

**Suporte Technical Messaging Simplification**: Removed technical jargon ("IP está ativo, sem bloqueios financeiros") from customer-facing messages. Now uses simple language: "Vejo que sua conexão está offline. Já tentou reiniciar o modem?".

**Suporte Multiple Points Fix**: Fixed premature conversation finalization when customers with multiple installation points select an address. Assistant now ALWAYS verifies connection after selection before providing diagnosis. Real case: Monica (whatsapp_5524992949880).

**Suporte Massive Failure Detection**: ✅ NEW - Added mandatory 5-step verification sequence: (1) statusIP check → Financeiro, (2) **massiva check → inform regional outage**, (3) os_aberta check → acknowledge existing ticket, (4) individual diagnosis, (5) advanced troubleshooting. When `massiva: true` detected, assistant informs customer about regional problem and stops individual troubleshooting.