# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service, acting as an intelligent router and coordinator for specialized AI assistants. Utilizing OpenAI's Assistants API and a RAG knowledge base, it automates Q&A and executes actions like boleto consultation and PPPoE diagnosis. The platform features a real-time supervisor monitoring dashboard for human intervention and an autonomous continuous learning system that evolves AI assistant prompts based on feedback, aiming to significantly enhance customer service efficiency and satisfaction.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS, inspired by Carbon Design System and Linear for data-dense enterprise interfaces, supporting dark/light modes. Client-side routing is managed by Wouter.

### Technical Implementations
**Frontend**: Uses TanStack Query for server state and includes key pages like Dashboard, Monitor, Test Chat, Conversations, Knowledge, Assistants, Agent Evolution, Metrics, Feedbacks NPS, and Settings.

**Backend**: Node.js with Express.js (TypeScript). Core technologies include GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM for data persistence. Session management uses OpenAI thread-based conversations stored in Redis.

**Queue System**: Utilizes BullMQ with Redis TLS for asynchronous message processing across five active queues (message-processing, ai-response, image-analysis, nps-survey, learning-tasks) with automatic retry mechanisms and webhook fallback for zero message loss, supporting 1,000-1,500 conversations/day.

**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API.
- **Specialized Assistants**: Six roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) with a "Receptionist-First" routing model.
- **Conversation Finalization Logic**: Proper closure system ensuring NPS surveys are sent correctly. SUPPORT/FINANCIAL/COMERCIAL can autonomously finalize when problem is resolved; CANCELAMENTO/OUVIDORIA/APRESENTAÇÃO always transfer to humans (never finalize). Based on kb-geral-002 knowledge base rules.
- **Conversation Summarization**: Asynchronous summarization.
- **RAG**: Knowledge base using Upstash Vector.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, and scheduling, with secure internal-only tool execution.
- **Automated Document Detection**: Regex-based CPF/CNPJ detection and mandatory verification before sensitive operations.
- **Automated Systems**: "Boleto Consultation", "PPPoE Connection Status", and "Unlock/Unblock" systems with integrated security.
- **Vision System**: GPT-4o Vision for automatic WhatsApp image analysis (boletos, documents, screenshots, technical photos), with a dual download strategy and graceful fallback.
- **Supervisor/Agent Media Upload**: Allows supervisors/agents to upload images (analyzed by GPT-4o Vision) and audio files (transcribed by OpenAI Whisper) within the Conversations panel.
- **Test Chat Media Upload**: Provides a testing interface for image and audio processing features.

**Real-Time Monitoring**: Supervisor Dashboard offers KPIs, live conversation queues, alerts, transcripts, and human intervention controls. The Monitor page displays concurrent conversations.

**Continuous Learning System**:
- **Autonomous Learning**: GPT-4 agent suggests prompt improvements based on supervisor interventions and feedback.
- **Feedback**: Incorporates implicit (resolutions) and explicit (supervisor corrections, NPS) feedback.
- **Hybrid Training System**: Supervisors can mark training segments or manually create training sessions. GPT-5 processes this content to generate improved prompts, which ADMIN/SUPERVISOR roles can apply to update assistants via the OpenAI API.

**NPS & Customer Satisfaction**: Automated NPS surveys post-conversation via WhatsApp, with feedback processed for learning.

**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with real-time counters and AI-assisted agent responses.

**WhatsApp Integration**: Native integration with Evolution API for real-time message processing, AI routing, and outbound messaging.

**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions, role-based navigation, and ADMIN interface for user management.

**Personalized Dashboards**: Role-specific dashboards (Admin, Supervisor, Agent) provide relevant KPIs and data, with the Admin Dashboard featuring system health, cost analysis, and activity logs.

**Agent Reports System**: Provides historical analysis of agent performance with metrics and filtering.

**Activity Logs System**: Comprehensive session tracking for auditing and user status validation.

**Conversation Assignment System**: Supports self-assignment by agents and manual assignment by supervisors/admins, including automated welcome messages.

**Conversation Transfer System**: Allows ADMIN/SUPERVISOR to transfer any conversation and AGENTs to transfer their assigned conversations, updating `assignedTo` and notifying the client via WhatsApp.

**Configurable Message Templates System**: Admin-managed templates for automated communications with dynamic variable substitution.

**Message Pagination & Auto-Scroll System**: Optimized loading of conversation messages with cursor-based pagination, smart auto-scroll, and state preservation.

**Ouvidoria (Ombudsman) System**: Dedicated sections for filtering and managing customer complaints, with AI tool `registrar_reclamacao_ouvidoria` for automatic record creation and role-based security.

**Conversation Intelligence System**: Advanced real-time analysis of customer messages with automated context persistence and problem detection:
- **Sentiment Analysis**: Detects customer satisfaction (positive/neutral/negative) using keyword patterns including frustration indicators (sacanagem, absurdo, demora, segunda vez).
- **4-Level Urgency Classification**: Automatically classifies urgency as critical, high, medium, or low based on contextual keywords (urgente, importante, quando possível, etc).
- **Technical Problem Detection**: Identifies and categorizes technical issues (internet outages, connection problems, equipment failures) for appropriate routing.
- **Recurrence Detection**: Tracks problem history by CPF/CNPJ, auto-detects recurring issues (2+ occurrences in 30 days), and escalates to priority technical support.
- **CPF/CNPJ Auto-Persistence**: Automatically detects and stores customer documents in both `conversation.clientDocument` and `metadata.clientDocument` to prevent context loss across conversation resumptions.
- **Intelligent Metadata Updates**: Conversation metadata persistently updated with sentiment, urgency, detected problems, and recurrence status for supervisor visibility and analytics.
- **Priority Technical Support Function**: New AI function call `priorizar_atendimento_tecnico` schedules urgent technician visits for recurring issues WITHOUT offering financial compensation (policy-compliant).
- **Multi-Modal Intelligence**: Intelligence analysis applies to text, image transcriptions (Vision API), and audio transcriptions (Whisper) across both Evolution webhook and Test Chat flows.

**Redis Optimization System**: Cost reduction framework achieving 60-80% fewer Redis requests through intelligent caching and batching:
- **Local Cache Layer**: In-memory cache with configurable per-entry TTL (5min-1h), eliminating redundant Redis calls for frequently accessed data (assistants, static config).
- **Pipeline Operations**: Batch multiple Redis commands (thread + metadata saves) into single requests, reducing latency and costs.
- **Multi-Get Optimization**: Fetch multiple conversation threads in one operation instead of N individual requests.
- **Batch Updates**: Accumulate counter increments locally and flush periodically (60s intervals), reducing write operations by 90%.
- **Hash Storage**: Store related data (conversation metadata) as Redis hashes instead of multiple keys, improving efficiency and atomicity.
- **Automated Testing**: Comprehensive test suite validates all optimizations with measurable metrics (server/test-redis-optimization.ts).
- **Economic Impact**: Reduces estimated 10,000 daily Redis requests to ~3,000 (-70%), with proportional cost savings for scaling applications.

## External Dependencies

**Third-Party Services**:
- **OpenAI**: AI Assistants API.
- **Upstash Vector**: Serverless vector database for RAG.
- **Upstash Redis**: Serverless Redis for conversation threads and caching.
- **Neon Database**: Serverless PostgreSQL for primary data persistence.
- **Evolution API**: WhatsApp integration.

**Key NPM Packages**:
- `@radix-ui/*`: Headless UI components.
- `@tanstack/react-query`: Server state management.
- `drizzle-orm`: Type-safe ORM.
- `express`: Web server framework.
- `react-hook-form`, `zod`: Form handling and validation.
- `tailwindcss`: CSS framework.