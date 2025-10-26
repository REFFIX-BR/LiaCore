# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service. It automates Q&A and actions using OpenAI's Assistants API and a RAG knowledge base through specialized AI assistants. The platform features a real-time supervisor monitoring dashboard and an autonomous continuous learning system, aiming to enhance customer service efficiency and satisfaction in telecommunications.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend uses React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, inspired by Carbon Design System and Linear, supporting dark/light modes. `Wouter` handles routing. Key UI features include color-coded wait time indicators, enhanced complaint description UI, dialogs for private notes, dedicated UIs for new contact creation, conversation reopening, and activity logs. Sales and plans management systems offer dashboards with KPIs, tables, and CRUD interfaces. The chat interface provides message pagination with intelligent auto-scroll, auto-focus textarea, and inline PDF visualization.

### Technical Implementations
**Frontend**: TanStack Query for server state management.
**Backend**: Node.js and Express.js (TypeScript) integrating GPT-5 for routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: BullMQ with Redis TLS for asynchronous processing, retries, and webhooks.
**AI & Knowledge Management**: OpenAI Assistants API orchestrates six AI roles using a "Receptionist-First" routing model. A dual-layer RAG architecture with Upstash Vector supports specific knowledge bases. Custom function calling enables verification, knowledge queries, invoice lookups, scheduling, and sales operations. Automated systems include document detection, "Boleto Consultation," "PPPoE Connection Status," "Unlock/Unblock," HTTP Resilience, GPT-4o Vision, PDF text extraction, and OpenAI Whisper. Conversation intelligence provides real-time sentiment analysis, urgency detection, problem identification, and automatic persistence of CPF/CNPJ.
**Real-Time Monitoring**: Supervisor Dashboard offers KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System. The Monitor features a 6-state view mode system: (1) Todas (all active + resolved), (2) IA Atendendo (AI-only conversations), (3) Aguardando (transfer queue), (4) Em Atendimento (agent-assigned), (5) Finalizadas (resolved, 12h retention), and **NEW** (6) Histórico Completo (ALL conversations from database with pagination, independent search, 50 per page, no time limit - for long-term audit and regulatory compliance).
**Continuous Learning System**: A GPT-4 agent suggests prompt improvements.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API for messaging, AI routing, outbound messages, triple-fallback delivery, and group management.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions and department-based access control.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync and bidirectional synchronization with conversations.
**Message Deletion System**: Supervisors/admins can soft-delete assistant messages.
**Redis Optimization System**: Intelligent caching, batching, and hash storage.
**Message Batching System**: Atomic Redis-based debouncing groups sequential client messages.
**Private Notes System**: Internal collaboration feature.
**Conversation Verification System**: Supervisor workflow to mark conversations as reviewed.
**Activity Logs & Audit System**: Comprehensive audit trail with a dual-tab interface and KPI dashboard.
**Conversational Sales System**: Autonomous AI for lead qualification, plan presentation, data collection, and sales processing via WhatsApp.
**Multiple Points Detection System**: Automatically detects customers with multiple internet installations.
**Lead Capture System**: Comprehensive system for capturing and managing incomplete sales prospects.
**Ephemeral Installation Point Selection System (Boletos)**: Uses Redis ephemeral storage to allow customers with multiple installation points to select an address for each boleto query, bypassing AI processing.
**Regional Massive Failure System**: Automated detection and notification system for service outages, including visual region selection, automatic client notification via WhatsApp, and intelligent region matching. Supports multiple installation points by injecting context into AI threads and providing a tool for customer selection.

### System Design Choices
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Worker Concurrency**: Optimized for messages, images, and NPS workers.
- **API Key Management**: Robust handling of multi-instance Evolution API keys.
- **Security & Compliance**: LGPD/GDPR-compliant logging ensures no personal/financial data in logs, only aggregate metrics. Debug endpoints are protected, and structured error handling prevents sensitive data exposure to AI assistants.

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