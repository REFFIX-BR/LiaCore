# LIA CORTEX - AI Orchestration Platform

## Overview

LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service. It functions as an intelligent router and coordinator for specialized AI assistants, powered by OpenAI's Assistants API. The platform integrates a RAG knowledge base for dynamic Q&A and action execution via structured APIs, including automated boleto consultation, PPPoE connection diagnosis, and customer unlock/unblock requests. It features a real-time supervisor monitoring dashboard for human intervention and an autonomous continuous learning system that evolves AI assistant prompts based on feedback. The primary goal is to significantly enhance customer service efficiency and satisfaction through intelligent automation and continuous AI improvement.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend is built with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS, drawing inspiration from Carbon Design System and Linear for data-dense enterprise interfaces, supporting dark/light modes. Client-side routing is managed by Wouter.

### Technical Implementations

**Frontend**:
- **State Management**: TanStack Query for server state.
- **Key Pages**: Dashboard, Monitor, Test Chat, Conversations, Knowledge, Assistants, Agent Evolution, Metrics, Feedbacks NPS, Settings.

**Backend**:
- **Runtime**: Node.js with Express.js (TypeScript).
- **Core**: GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM for data persistence.
- **Session Management**: OpenAI thread-based conversations stored in Redis.
- **Queue System** (`server/lib/queue.ts`, `server/workers.ts`, `QUEUE_SETUP.md`):
  - BullMQ with Redis TLS for asynchronous message processing
  - 10 parallel workers (5 message processing, 2 image analysis, 3 NPS survey)
  - 5 active queues: message-processing, ai-response, image-analysis, nps-survey, learning-tasks
  - Automatic retry (3x exponential backoff), job persistence, and error propagation
  - Webhook fallback to async processing if Redis unavailable (zero message loss)
  - Capacity: 1,000-1,500 conversations/day (2x increase from 500-800)

**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API.
- **Specialized Assistants**: Six roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) with specific instructions and function calling capabilities. A "Receptionist-First" routing model triages and routes to specialists.
- **Conversation Summarization**: Asynchronous summarization of conversations.
- **RAG**: Knowledge base implemented using Upstash Vector.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, and scheduling, with a secure internal-only system for tool execution.
- **Automated Document Detection**: Regex-based CPF/CNPJ detection and storage in conversation context.
- **Mandatory CPF Verification**: All specialized assistants require CPF/CNPJ verification before proceeding with sensitive operations.
- **Automated Systems**: Includes "Boleto Consultation", "PPPoE Connection Status", and "Unlock/Unblock" systems with integrated security and AI interpretation.
- **Vision System** (`server/lib/vision.ts`, `VISION_SETUP.md`):
  - GPT-4o Vision integration for automatic WhatsApp image analysis
  - Downloads images via Evolution API `/chat/getBase64FromMediaMessage` endpoint
  - Intelligent extraction: boletos (ID, due date, amount, fees), documents (CPF/CNPJ, RG), screenshots (transcription), technical photos (description)
  - Context-aware analysis considering client captions and conversation history
  - Performance: 3-8 seconds per image, ~$0.002 cost per analysis
  - Supports JPEG, PNG, WebP, GIF (non-animated), up to 20MB
  - Graceful fallback if analysis fails, conversation continues normally

**Real-Time Monitoring**:
- **Supervisor Dashboard**: Provides KPIs, live conversation queues, alerts, transcripts, and human intervention controls.
- **Monitor Page**: Displays concurrent conversations for supervisors.

**Continuous Learning System**:
- **Autonomous Learning**: GPT-4 agent identifies patterns from supervisor interventions and feedback to suggest prompt improvements.
- **Feedback**: Incorporates both implicit (resolutions, transfers) and explicit (supervisor corrections, NPS) feedback.

**NPS & Customer Satisfaction**:
- **WhatsApp Feedback**: Automated NPS surveys post-conversation, with feedback processing for learning.

**Hybrid Supervised Mode**:
- **Conversation Management**: Tabbed interface for "Transferred" (unassigned) and "Assigned" conversations, with real-time counters and AI-assisted agent responses.

**WhatsApp Integration**:
- **Evolution API**: Native integration for real-time message processing, AI routing, and outbound messaging.

**Role-Based Access Control (RBAC)**:
- **3-Tier System**: ADMIN, SUPERVISOR, AGENT with granular permissions and role-based navigation.
- **User Management**: ADMIN interface for user creation and approval workflow for new AGENT role requests.

**Personalized Dashboards**:
- **Admin Dashboard** (`client/src/components/dashboards/AdminDashboard.tsx`): Reconstruído com design moderno inspirado em Carbon/Linear
  - System Health: Status em tempo real de API, Database e Workers
  - KPIs: Custo total mensal, usuários ativos, eventos de segurança, logins falhados (com indicadores de tendência)
  - Analytics: Breakdown detalhado de custos (OpenAI/Upstash) e distribuição de usuários por role (com progress bars)
  - Gráfico de área: Uso de tokens OpenAI nos últimos 30 dias
  - Log de atividades: Últimas 10 ações do sistema com badges de tipo
  - Auto-refresh: 30 segundos
  - TypeScript completo: Interface AdminMetrics com guards de divisão por zero
  - Responsivo e suporta dark/light mode
- Role-specific dashboards (Agent, Supervisor, Admin) with relevant KPIs and data.

**Agent Reports System**:
- Historical analysis of agent performance with metrics, charts, and filtering capabilities.

**Activity Logs System**:
- Comprehensive session tracking (login/logout, IP, user agent, duration) for auditing and validating user status.

**Conversation Assignment System**:
- Supports self-assignment by agents and manual assignment by supervisors/admins, with automated welcome messages and role-based access to conversations.

**Configurable Message Templates System**:
- Admin-managed message templates for automated communications, supporting dynamic variable substitution and categorized storage.

**Message Pagination & Auto-Scroll System**:
- Optimized loading of conversation messages with cursor-based pagination for historical data, smart auto-scroll, and state preservation during refetches.

**Ouvidoria (Ombudsman) System**:
- Dedicated tab in Monitor page for filtering and viewing all customer complaints handled by Ouvidoria assistant.
- Dedicated `/ouvidoria` page with comprehensive complaint management interface (ADMIN/SUPERVISOR only).
- Complaint tracking database with fields for type, severity, status, assigned investigator, and resolution.
- Complaint types: atendimento, produto, técnico, comercial, financeiro, outro.
- Status tracking: novo, em_investigação, resolvido, fechado.
- Severity levels: baixa, média, alta, crítica.
- **AI Tool**: `registrar_reclamacao_ouvidoria` - Ouvidoria assistant function to automatically create complaint records during conversations.
- **Three-dimensional filtering**: Filter complaints by type, severity, and status.
- **Inline editing**: Change type, severity, and status directly in the complaints table.
- **Role-based security**: AdminSupervisorRoute + component-level role verification ensures only ADMIN/SUPERVISOR can access Ouvidoria management.

## External Dependencies

**Third-Party Services**:
- **OpenAI**: For AI Assistants API.
- **Upstash Vector**: Serverless vector database for RAG.
- **Upstash Redis**: Serverless Redis for conversation threads and caching.
- **Neon Database**: Serverless PostgreSQL for primary data persistence.
- **Evolution API**: For WhatsApp integration.

**Key NPM Packages**:
- `@radix-ui/*`: Headless UI components.
- `@tanstack/react-query`: Server state management.
- `drizzle-orm`: Type-safe ORM for database interactions.
- `express`: Web server framework.
- `react-hook-form`, `zod`: Form handling and validation.
- `tailwindcss`: CSS framework.