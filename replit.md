# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service. It automates Q&A and actions using specialized AI assistants powered by OpenAI's Assistants API and a RAG knowledge base. The platform features real-time supervisor monitoring and an autonomous continuous learning system. Its primary goal is to significantly enhance customer service efficiency and satisfaction in the telecommunications sector through advanced AI orchestration.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend, built with React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, draws inspiration from Carbon Design System and Linear, supporting dark/light modes. Key features include color-coded wait times, enhanced complaint descriptions, private note dialogs, new contact creation, conversation reopening, and activity logs. Dashboards for sales and plans management offer KPIs and CRUD interfaces. The chat interface provides message pagination, auto-scroll, auto-focus, and inline PDF viewing. The agent conversation interface supports flexible layout modes (single-box for focus, dual-box for multitasking), with preferences persisted locally.

### Technical Implementations
**Frontend**: Uses TanStack Query for server state management.
**Backend**: Node.js and Express.js (TypeScript) integrate GPT-5 for routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM. BullMQ with Redis TLS handles asynchronous processing.
**AI & Knowledge Management**: Orchestrates seven specialized AI assistants using a "Receptionist-First" routing model. A dual-layer RAG architecture with Upstash Vector supports specific knowledge bases. Custom function calling enables verification, knowledge queries, invoice lookups, scheduling, sales operations, automated CRM ticket creation, service order (OS) status checks, payment promise registration, document persistence, and payment clearance verification. Flexible client identification (CPF/CNPJ/CLIENT_CODE) is implemented. The system preserves full context during assistant routing, automatically creates CRM tickets, and handles multiple installation points. AI-to-AI routing is supported.
**Prompt Management System**: AI-powered prompt editor with version control, draft workflows, semantic versioning, GPT-4o AI analysis, real-time token counting, and automatic OpenAI Assistants API synchronization.
**Context Quality Monitoring System**: Automated real-time monitoring of AI conversation context with detectors for duplicate data requests, ignored history, duplicate routing, and context reset, providing AI-powered prompt correction suggestions.
**Gamification System**: Automated performance ranking with a configurable V2 system for scoring parameters and a badge system.
**Real-Time Monitoring**: The Supervisor Dashboard offers KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System.
**Agent Dashboard Enhancements**: Supports period-based filtering for performance metrics, including accurate TMA calculation.
**Continuous Learning System**: A GPT-4 agent suggests prompt improvements.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API supporting 3 WhatsApp instances with end-to-end instance routing.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync.
**Announcements/Communications System**: Centralized system for company-wide announcements with priority-based rotation.
**COBRANÇAS - Autonomous Debt Collection Module**: Production-ready module with a dedicated IA Cobrança assistant specialized in empathetic debt negotiation, payment promise registration, and compliance. Supports proactive voice calls (Twilio + OpenAI Realtime API) and automated WhatsApp messaging (Evolution API).
**Payment Promise System**: Manages the complete lifecycle of payment promises, enforcing a single active promise per client, automated registration, multi-layer protection during collection attempts, and automatic breach detection.
**Dedicated Cobranças Monitoring**: Conversations from collection campaigns are monitored via a dedicated `/voice/monitor` interface, providing unified metrics and transfer capabilities.
**Messaging Control Center**: Professional control panel for flexible contact method management with global and per-campaign configuration, backend validation, and method-specific statistics API.
**Campaign Conversation Tracking**: Complete integration between voice campaigns and cobranças monitoring, linking conversations to campaign targets.
**Automated CRM Synchronization**: Production-ready infrastructure for proactive debt collection, importing overdue clients from CRM API. Features include configurable sync schedules, data transformation, smart deduplication, accurate campaign statistics tracking, and comprehensive error handling. Includes a CRM Import UI for managing sync configurations and manual triggers.
**Meta-Approved WhatsApp Templates**: Collections module migrated to Meta-approved WhatsApp templates for regulatory compliance and prevention of number banning. Template "financeiro_em_atraso" (English language) used for initial contact with dynamic client first name parameter. Centralized sendWhatsAppTemplate() function in server/lib/whatsapp.ts handles template delivery via Evolution API.
**evolutionInstance Normalization**: Accent-insensitive validation ensures "Cobrança" and "Cobranca" are treated identically throughout the system. getEffectiveEvolutionInstance() helper preserves existing conversation instances when webhooks lack instance data, preventing incorrect routing overrides.

### System Design Choices
- **Chat Simulator (Test Chat)**: Professional testing tool at `/test-chat` for validating assistant behaviors, isolated from the production database.
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Security & Compliance**: LGPD/GDPR-compliant logging, protected debug endpoints, and structured error handling.
- **Failure Detection**: Enhanced massive failure detection supporting city-wide outages and automatic client notification via WhatsApp.
- **Conversation Reopening**: Automatically reopens resolved conversations upon new client messages.
- **Intelligent Farewell Detection & Auto-Resolution**: Inactivity follow-up worker detects farewells, auto-resolves conversations, and sends NPS surveys.
- **Payment Proof Auto-Resolution**: Automatically resolves conversations upon receipt of payment proof, CRM ticket creation, and no further client response.
- **Comprehensive Auto-Closure System**: Redesigned inactivity management with scheduled follow-ups and auto-resolution after inactivity.
- **Conversation Assignment Fix**: Ensures correct marking of assigned conversations for accurate tab display.
- **Thread ID Protection System**: Implemented defensive persistence guards to prevent conversation threadId from being overwritten with null/undefined, preserving OpenAI context.
- **Date/Time Awareness**: All new OpenAI threads automatically receive current date/time context in Brazilian Portuguese (pt-BR) format, ensuring AI assistants have accurate temporal awareness for scheduling, payment promises, and time-sensitive interactions.

### Scalability & Performance
A comprehensive scaling plan details a roadmap to handle 160,000 messages at peak with 15,000 concurrent conversations, involving queue optimization, worker scaling, database optimization, OpenAI optimization, multi-tier infrastructure roadmap, and extensive observability with Prometheus + Grafana.

## External Dependencies
- **OpenAI**: AI Assistants API.
- **Upstash Vector**: Serverless vector database.
- **Upstash Redis**: Serverless Redis.
- **Neon Database**: Serverless PostgreSQL.
- **Evolution API**: WhatsApp integration.
- **Twilio**: Voice calls (for Cobrança module).