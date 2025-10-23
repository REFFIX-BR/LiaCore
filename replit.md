# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service. It leverages OpenAI's Assistants API and a RAG knowledge base to automate Q&A and actions through specialized AI assistants. The platform includes a real-time supervisor monitoring dashboard and an autonomous continuous learning system. Its primary goal is to enhance customer service efficiency and satisfaction in telecommunications by providing a robust, scalable, and intelligent AI solution, aligning with business vision, market potential, and project ambitions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS, drawing inspiration from Carbon Design System and Linear, supporting both dark and light modes. `Wouter` handles client-side routing. Key UI components include color-coded wait time indicators, enhanced complaint description UI, a dialog for private notes, dedicated UIs for new contact creation, conversation reopening, and activity logs. Sales and plans management systems feature dashboards with KPIs, tables, and CRUD interfaces. The chat interface supports message pagination with intelligent auto-scroll, auto-focus textarea, and inline PDF visualization.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management.
**Backend**: Developed with Node.js and Express.js (TypeScript), integrating GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: BullMQ with Redis TLS manages asynchronous processing with retries and webhooks.
**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API orchestrates six specialized AI roles using a "Receptionist-First" routing model.
- **RAG Architecture**: A dual-layer prompt system with Upstash Vector, including specific RAG for equipment returns and sales documentation.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, scheduling, and sales operations.
- **Automated Systems**: Document detection, "Boleto Consultation," "PPPoE Connection Status," "Unlock/Unblock," HTTP Resilience, GPT-4o Vision, PDF text extraction, and OpenAI Whisper.
- **Conversation Intelligence**: Real-time sentiment analysis, urgency detection, problem identification, and automatic persistence of CPF/CNPJ.
**Real-Time Monitoring**: Supervisor Dashboard provides KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System.
**Continuous Learning System**: GPT-4 agent suggests prompt improvements based on feedback.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API for real-time messaging, AI routing, outbound messaging, triple-fallback delivery, and WhatsApp Groups Management.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Department-Based Access Control**: Agents can be assigned to multiple departments (general, commercial, financial, support, cancellation). Conversations are automatically tagged with departments based on the AI assistant that handled them. Department filtering applies only to **transferred** conversations (not assigned to anyone) - agents see only conversations from their departments in the "Transferred" queue. For **assigned** conversations, agents see all conversations explicitly assigned to them regardless of department. Supervisors/admins can optionally select department when manually transferring or creating contacts. Agents with "commercial" department have access to the Sales page (/vendas). Supervisors and admins see all conversations and pages. Backward-compatible with legacy data (conversations without departments are visible to all agents during migration).
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync and bidirectional synchronization with conversations (contact updates automatically propagate to all related conversations).
**Message Deletion System**: Supervisors/admins can soft-delete assistant messages.
**Redis Optimization System**: Intelligent caching, batching, and hash storage.
**Message Batching System**: Atomic Redis-based debouncing groups sequential client messages into single AI requests.
**Private Notes System**: Internal collaboration feature.
**Conversation Verification System**: Supervisor workflow to mark conversations as reviewed.
**Activity Logs & Audit System**: Comprehensive audit trail with a dual-tab interface and KPI dashboard.
**Conversational Sales System**: Autonomous AI for lead qualification, plan presentation, data collection, and sales processing via WhatsApp, including coverage verification and integration with Plans database.
**Multiple Points Detection System**: Automatically detects customers with multiple internet installations by grouping bills and presenting selection options.
**Lead Capture System**: Comprehensive system for capturing and managing incomplete sales prospects via manual functions, automatic backup, and updated lead statuses.

### System Design Choices
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
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