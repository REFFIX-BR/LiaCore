# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service. It automates Q&A and actions using specialized AI assistants powered by OpenAI's Assistants API and a RAG knowledge base. The platform features a real-time supervisor monitoring dashboard and an autonomous continuous learning system, aiming to enhance customer service efficiency and satisfaction in the telecommunications sector through advanced AI orchestration.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, drawing inspiration from Carbon Design System and Linear, supporting both dark and light modes. Key features include color-coded wait times, enhanced complaint descriptions, private note dialogs, new contact creation, conversation reopening, and activity logs. Sales and plans management offer dashboards with KPIs and CRUD interfaces. The chat interface includes message pagination, auto-scroll, auto-focus textarea, and inline PDF viewing. The agent conversation interface provides flexible layout modes (single-box for focus, dual-box for multitasking), with preferences persisted in `localStorage`.

**Navigation Structure**: The sidebar menu is organized into 8 logical sections: (1) Visão Geral (Dashboard, Dashboard de Atendentes, Assistentes), (2) Conversas (Conversas, Monitor Supervisor, Grupos WhatsApp, Contatos), (3) Qualidade (Ouvidoria, Feedbacks NPS, Análises, Métricas), (4) Vendas (Gestão de Vendas), (5) Operações (Falhas Massivas, Regiões), (6) Conhecimento & IA (Base de Conhecimento, Gerenciamento de Prompts, Evolução dos Agentes), (7) Ferramentas (Anúncios, Relatórios, Logs, Monitor Webhook, Test Chat), and (8) Administração (Usuários, Solicitações de Registro, Configurações).

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management.
**Backend**: Developed with Node.js and Express.js (TypeScript), integrating GPT-5 for routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: Employs BullMQ with Redis TLS for asynchronous processing, retries, and webhooks.
**AI & Knowledge Management**: Orchestrates six AI roles using OpenAI Assistants API and a "Receptionist-First" routing model. A dual-layer RAG architecture with Upstash Vector supports specific knowledge bases. Custom function calling enables verification, knowledge queries, invoice lookups, scheduling, sales operations, and automated CRM ticket creation. Automated systems include document detection, "Boleto Consultation," "PPPoE Connection Status," "Unlock/Unblock," HTTP Resilience, GPT-4o Vision, PDF text extraction, and OpenAI Whisper. Conversation intelligence provides real-time sentiment analysis, urgency detection, problem identification, and automatic persistence of CPF/CNPJ. The system preserves full context during assistant routing and automatically creates CRM tickets for payments or service requests, with robust validation and LGPD compliance.
**Prompt Management System**: AI-powered prompt editor with version control for managing assistant instructions. Features include: (1) Draft workflow - edit → save draft → AI review → publish, (2) Semantic versioning (major.minor.patch) with immutable version history, (3) Side-by-side diff comparison (production vs. draft), (4) AI-assisted prompt optimization suggestions (placeholder for GPT-4 integration), (5) Automatic cache invalidation on publish, (6) Version restoration capability, (7) RBAC protection (ADMIN/SUPERVISOR only). Supports all 6 assistants with pre-populated initial prompts.
**Real-Time Monitoring**: The Supervisor Dashboard offers KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System with a 6-state view, including a "Histórico Completo" for auditing.
**Continuous Learning System**: A GPT-4 agent suggests prompt improvements.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API for messaging, AI routing, outbound messages, triple-fallback delivery, and group management.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions and department-based access.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync and bidirectional synchronization with conversations.
**Announcements/Communications System**: Centralized system for company-wide announcements with priority-based rotation, full CRUD admin interface, and visual banners.

### System Design Choices
- **Admin Tools**: Includes features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing capabilities.
- **Security & Compliance**: Implements LGPD/GDPR-compliant logging, protected debug endpoints, and structured error handling.
- **Failure Detection**: Enhanced massive failure detection supports city-wide outages in addition to neighborhood-specific incidents.

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