# LIA CORTEX - AI Orchestration Platform

## Overview

LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service, acting as an intelligent router and coordinator for specialized AI assistants powered by OpenAI's Assistants API. It integrates a RAG knowledge base using Upstash Vector for dynamic Q&A and action execution via structured APIs. The platform features a real-time supervisor monitoring dashboard for human intervention and an autonomous continuous learning system that evolves assistant prompts based on feedback. The business vision is to significantly enhance customer service efficiency and satisfaction through intelligent automation and continuous AI improvement.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend uses React with TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS. The design is inspired by Carbon Design System and Linear, optimized for data-dense enterprise interfaces, supporting dark/light modes. Wouter handles client-side routing.

### Technical Implementations

**Frontend**:
- **State Management**: TanStack Query for server state (5-second polling).
- **Key Pages**: Dashboard, Monitor, Test Chat, Conversations, Knowledge, Assistants, Agent Evolution, Metrics, Feedbacks NPS, Settings.
- **Header**: Theme toggle and logout.

**Backend**:
- **Runtime**: Node.js with Express.js (TypeScript).
- **API**: RESTful, under `/api`.
- **Core**: GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads.
- **Session Management**: OpenAI thread-based conversations (7-day expiry) in Redis.
- **Data Persistence**: PostgreSQL via Drizzle ORM.

**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API.
- **Specialized Assistants**: Six roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) with specific instructions, WhatsApp formatting, and domain-specific function calling. All use "text" response format.
- **Receptionist-First Routing**: `APRESENTACAO_ASSISTANT_ID` triages and routes to specialists, seamlessly updating assistant types.
- **Conversation Summarization**: Asynchronous summarization every 12 messages into structured JSON.
- **RAG**: Knowledge base in Upstash Vector via `consultar_base_de_conhecimento`.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, and scheduling.
- **Secure AI Tools System** (`server/ai-tools.ts`):
  - Internal-only functions (no HTTP endpoints) for OpenAI assistant function calling
  - Mandatory conversation context validation against database
  - Document authorization using database-stored `clientDocument` field
  - PII-free logging (CPF/CNPJ masked in all logs)
  - Functions: `consulta_boleto_cliente` (boleto queries with security validation)
  - Security layers: Context required → DB conversation exists → Document matches DB record

**Real-Time Monitoring**:
- **Supervisor Dashboard**: KPIs, live conversation queue (urgency/sentiment), alerts, transcripts, human intervention controls.
- **Monitor Page**: High-density display of concurrent conversations with responsive grid and floating dialogs.

**Continuous Learning System**:
- **Autonomous Learning**: GPT-4 agent identifies patterns from supervisor interventions and feedback.
- **Feedback**: Implicit (resolutions, transfers) and explicit (supervisor corrections, NPS).
- **Prompt Evolution**: Supervisor-approved suggestions update OpenAI assistant instructions.

**NPS & Customer Satisfaction**:
- **WhatsApp Feedback**: Automated NPS surveys post-conversation.
- **Feedback Processing**: Extracts scores, saves to DB, feeds detractors into learning.
- **Feedbacks NPS Page**: Supervisors view and filter NPS feedback linked to conversations.

**Hybrid Supervised Mode (Conversations Tab)**:
- **Transferred Conversation Queue**: Manages human-escalated conversations.
- **AI-Assisted Responses**: Supervisors get AI suggestions, can approve or edit, creating learning events.

**WhatsApp Integration**:
- **Evolution API**: Native integration for real-time message processing via webhooks.
- **Message Processing**: Handles various message types, client identification, AI routing, thread management, and response generation.
- **Outbound Messaging**: AI responses sent via Evolution API with typing simulation.

**Role-Based Access Control (RBAC)**:
- **3-Tier System**: ADMIN, SUPERVISOR, AGENT.
- **User Management**: ADMIN CRUD interface at `/users`.
- **Granular Permissions**: Middleware for route protection.
- **Navigation**: Sidebar with role-based visibility and category state persistence.

**User Registration System**:
- **Public Registration**: Self-service form for new users requesting AGENT role.
- **Approval Workflow**: Admin/Supervisor approval required for account creation.
- **Management Interface**: `/registration-requests` page for viewing and acting on requests.

**Personalized Dashboards by Role**:
- **Agent**: Personal KPIs, sentiment, recent feedback.
- **Supervisor**: Global KPIs, AI performance, team status.
- **Admin**: System KPIs, token usage, activity log.
- **API Endpoints**: Role-specific `/api/dashboard/*` endpoints with refresh.

**Agent Reports System**:
- **Historical Analysis**: Temporal tracking with filtering (daily/weekly/monthly, custom ranges).
- **Metrics**: Total conversations, success rate, NPS, transfers, sentiment.
- **Visualization**: Recharts-powered charts, summary cards, detailed tables.
- **Filtering**: Period presets, custom dates, agent selection.

**Conversation Assignment System**:
- **Self-Assignment (Agent)**: Agents claim conversations with an "Atribuir" button.
- **Manual Assignment (Supervisor/Admin)**: Assign to specific agents via dropdown.
- **Welcome Messages**: Automated WhatsApp messages sent upon assignment.
- **Permissions**: Only assigned agent can respond (ADMIN/SUPERVISOR override).
- **Role-Based Visibility**:
  - **AGENT**: Sees conversations assigned to them OR unassigned conversations (for self-assignment)
  - **SUPERVISOR/ADMIN**: See all transferred conversations regardless of assignment
  - **Filter Logic**: `WHERE (assignedTo = userId OR assignedTo IS NULL)` for agents

**Configurable Message Templates System**:
- **Admin Configuration**: Admins edit automated messages via Settings → Mensagens tab.
- **Template Storage**: Database-backed `message_templates` table.
- **Variable Substitution**: Templates support dynamic variables (`{agentName}`, `{clientName}`).
- **Categories**: Messages organized by category (assignment, nps, welcome).
- **Resilience**: Automated flows use templates with hard-coded fallbacks.
- **API Endpoints**: CRUD for `/api/message-templates`.

**Message Pagination & Auto-Scroll System**:
- **Optimized Loading**: Only 15 most recent messages loaded initially per conversation to reduce bandwidth and improve client-side performance.
- **Cursor-Based Pagination**: Backend uses `before` cursor (message ID) for efficient historical message retrieval without offset issues.
- **Load More UI**: "Carregar mensagens anteriores" button appears at top of chat when older messages exist (`hasMore` flag).
- **Smart Auto-Scroll**: 
  - Automatically scrolls to bottom when conversation opens
  - Scrolls to bottom on new messages only if user is near bottom (<100px from end)
  - Preserves scroll position when loading older messages to avoid interrupting user
- **State Preservation**: Previously loaded messages persist across automatic 3-second refetches (not overwritten by polling).
- **hasMore Management**: Uses `hasLoadedOlder` flag to prevent refetch from resetting pagination state after manual loads.
- **API Endpoint**: `GET /api/monitor/conversations/:id?limit=15&before={messageId}` returns `{messages, hasMore, conversation, alerts, actions}`.
- **Storage Method**: `getMessagesPaginated(conversationId, {limit, before})` optimized for both MemStorage and DbStorage.

## External Dependencies

**Third-Party Services**:
- **OpenAI**: Assistants API.
- **Upstash Vector**: Serverless vector database.
- **Upstash Redis**: Serverless Redis.
- **Neon Database**: Serverless PostgreSQL.
- **Evolution API**: WhatsApp integration.

**Key NPM Packages**:
- `@radix-ui/*`: Headless UI.
- `@tanstack/react-query`: Server state management.
- `drizzle-orm`: Type-safe ORM.
- `express`: Web server.
- `react-hook-form`, `zod`: Form handling and validation.
- `tailwindcss`: CSS framework.