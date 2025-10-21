# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service. It uses OpenAI's Assistants API and a RAG knowledge base to automate Q&A and actions via specialized AI assistants. The platform includes a real-time supervisor monitoring dashboard and an autonomous continuous learning system. Its core purpose is to enhance customer service efficiency and satisfaction in telecommunications through a robust, scalable, and intelligent AI solution, focusing on business vision, market potential, and project ambitions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS, inspired by Carbon Design System and Linear, supporting both dark and light modes. `Wouter` is used for client-side routing. UI components include color-coded wait time indicators, enhanced UI for complaint descriptions, a dialog interface for private notes, dedicated UIs for new contact creation, conversation reopening, and activity logs. The sales management and plans management systems feature dedicated dashboards with KPIs, tables, and CRUD interfaces.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management.
**Backend**: Developed with Node.js and Express.js (TypeScript), incorporating GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: BullMQ with Redis TLS manages asynchronous processing with retries and webhooks.
**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API orchestrates six specialized AI roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) using a "Receptionist-First" routing model.
- **RAG Architecture**: A dual-layer prompt system with Upstash Vector, including specific RAG systems for equipment returns and sales documentation.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, scheduling, and sales operations.
- **Automated Systems**: Document detection, "Boleto Consultation," "PPPoE Connection Status," "Unlock/Unblock," HTTP Resilience, GPT-4o Vision, PDF text extraction, and OpenAI Whisper.
- **Conversation Intelligence**: Real-time sentiment analysis, urgency detection, problem identification, and automatic persistence of CPF/CNPJ.
**Real-Time Monitoring**: Supervisor Dashboard provides KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System with sub-filters.
**Continuous Learning System**: GPT-4 agent suggests prompt improvements based on feedback.
**NPS & Customer Satisfaction**: Automated NPS surveys via WhatsApp with feedback integration.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API for real-time messaging, AI routing, outbound messaging, triple-fallback delivery, and WhatsApp Groups Management with individual AI control and multimedia support.
**Role-Based Access Control (RBAC)**: 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync, "New Contact" creation, and "Conversation Reopen".
**Message Deletion System**: Supervisors/admins can soft-delete assistant messages.
**Redis Optimization System**: Intelligent caching, batching, and hash storage.
**Message Batching System**: Atomic Redis-based debouncing groups sequential client messages into single AI requests.
**Private Notes System**: Internal collaboration feature.
**Conversation Verification System**: Supervisor workflow to mark conversations as reviewed.
**Activity Logs & Audit System**: Comprehensive audit trail with a dual-tab interface and KPI dashboard.
**Conversational Sales System**: Autonomous AI system for lead qualification, plan presentation, data collection, and sales processing via WhatsApp, including coverage verification and integration with Plans database.
**Multiple Points Detection System**: Automatic detection of customers with multiple internet installations by grouping bills from multiple addresses and presenting selection options.

### System Design Choices
- **Admin Tools**: Mass-closing abandoned conversations, reprocessing stuck messages, configuration management.
- **Image Handling**: Supervisors can download WhatsApp images.
- **Worker Concurrency**: Optimized for messages, images, and NPS workers.
- **API Key Management**: Robust handling of multi-instance Evolution API keys.

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