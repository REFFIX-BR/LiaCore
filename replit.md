# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service. It orchestrates specialized AI assistants using OpenAI's Assistants API and a RAG knowledge base to automate Q&A and actions. The platform features a real-time supervisor monitoring dashboard and an autonomous continuous learning system. Its core purpose is to enhance customer service efficiency and satisfaction through a robust, scalable, and intelligent AI solution for telecommunications.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend uses React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS. The design is inspired by Carbon Design System and Linear, supporting dark/light modes. `Wouter` is used for client-side routing.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management.
**Backend**: Node.js and Express.js (TypeScript) with GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: BullMQ with Redis TLS for asynchronous processing, ensuring message delivery with retries and webhooks.
**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API.
- **Specialized Assistants**: Six roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) with a "Receptionist-First" routing model.
- **RAG Architecture**: Dual-layer prompt system separating System and RAG Prompts using Upstash Vector. Includes specific RAG systems for equipment returns and sales documentation (92 semantic chunks).
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, scheduling, and sales operations (`consultar_planos`, `enviar_cadastro_venda`).
- **Automated Systems**: Document detection, "Boleto Consultation", "PPPoE Connection Status", "Unlock/Unblock", HTTP Resilience System, GPT-4o Vision for image analysis, PDF text extraction, and OpenAI Whisper for audio transcription.
- **Video Processing**: Displays WhatsApp video messages in chat with HTML5 player, captions, and metadata.
- **Conversation Intelligence**: Real-time sentiment, urgency, and problem analysis; automatic persistence of CPF/CNPJ.
**Real-Time Monitoring**: Supervisor Dashboard with KPIs, live queues, alerts, transcripts, human intervention controls, and Live Logs System. Includes sub-filters for conversation resolution types (AI, human, auto-closed).
**Continuous Learning System**: Autonomous GPT-4 agent suggests prompt improvements based on feedback.
**NPS & Customer Satisfaction**: Automated NPS surveys via WhatsApp; feedback integrated into learning.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API for real-time messaging, AI routing, and outbound messaging. Features a triple-fallback message delivery system and a WhatsApp Groups Management System with individual AI control. Supports multimedia messages.
**Evolution Instance Consistency**: Critical architectural decision ensuring all messages in a conversation use the same Evolution API instance, prioritizing `conversation.evolutionInstance`.
**Role-Based Access Control (RBAC)**: 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Contact Management System**: Centralized client database, automatic WhatsApp contact sync. Features "New Contact" creation (manual conversations for agents) and "Conversation Reopen" preserving the original `evolutionInstance`.
**Message Deletion System**: Soft-deletion of assistant messages by supervisors/admins.
**Redis Optimization System**: Intelligent caching, batching, and hash storage.
**Message Batching System**: Atomic Redis-based debouncing to group sequential client messages into single AI requests (3-second window). Media messages bypass batching.
**Private Notes System**: Internal collaboration feature for agents to add notes to conversations.
**Conversation Verification System**: Supervisor workflow tracking to mark conversations as reviewed. Verification resets on new client messages.
**Activity Logs & Audit System**: Comprehensive audit trail of user actions (LOGIN/LOGOUT, supervisor operations) with dual-tab interface and real-time KPI dashboard.
**Conversational Sales System**: Autonomous AI system for lead qualification, plan presentation, data collection, and sales processing via WhatsApp. Includes a Plans database, Sales table, dedicated RAG knowledge base, AI tools (`consultar_planos`, `enviar_cadastro_venda`), and specific API endpoints (`/api/plans`, `/api/site-lead`).

### System Design Choices
- **Conversation Prioritization**: Color-coded wait time indicators.
- **Admin Tools**: Mass-closing abandoned conversations, reprocessing stuck messages, configuration management.
- **Image Handling**: Supervisors can download WhatsApp images.
- **Worker Concurrency**: Optimized configuration (20 message, 8 image, 8 NPS workers).
- **Ouvidoria Details Modal**: Enhanced UI for complaint descriptions.
- **API Key Management**: Robust handling of multi-instance Evolution API keys.
- **Private Notes UI**: Dialog interface with StickyNote icon.
- **New Contact Creation**: "Novo" button to create contacts and manual conversations, moved to "Transferidas" or "Atribuídas".
- **Conversation Reopen**: "Reabrir Conversa" button moves conversation to "Transferidas" queue.
- **Conversation Verification UI**: Green CheckCircle2 icon on verified conversations.
- **Activity Logs UI**: Dual-tab interface (Agentes/Supervisão) with KPI cards.
- **Monitor Resolved Conversations Sub-Filters**: "Finalizadas" tab with sub-filters for AI, agent, or auto-closed resolutions.
- **WhatsApp Groups Chat Interface**: Dual-tab system (Chat/Informações) for group messaging with auto-refresh, pagination, and AI toggle.

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