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
  - **Image Storage**: WhatsApp images stored in `messages.imageBase64` field for agent viewing regardless of Vision analysis success/failure
  - Graceful fallback if analysis fails, conversation continues normally with image available for viewing
- **Supervisor/Agent Image Upload** (`client/src/components/ChatPanel.tsx`):
  - Allows supervisors/agents to upload images when replying to customers in Conversations page
  - Frontend validates image type (JPEG, PNG, WebP, GIF) and size (max 20MB)
  - Images converted to base64 and analyzed via GPT-4o Vision
  - Backend endpoint: POST `/api/conversations/:id/send-message` accepts `imageBase64`
  - Server-side validation enforces 20MB limit
  - Analysis appended to message: `[Imagem enviada]\n{content}\n\n📎 Análise automática da imagem:\n{analysis}`
  - ChatMessage component displays images with badge "📸 Imagem enviada" and analysis in styled box
  - Image preview with remove option before sending
  - Toast notification confirms successful analysis
- **Supervisor/Agent Audio Upload & Transcription** (`server/lib/audio.ts`, `client/src/components/ChatPanel.tsx`):
  - Allows supervisors/agents to upload audio files when replying to customers in Conversations page
  - Frontend validates audio type (MP3, OGG, WAV, WebM, MP4, M4A) and size (1KB-25MB)
  - Audio converted to base64 and transcribed via OpenAI Whisper API (Portuguese)
  - Backend endpoint: POST `/api/conversations/:id/send-message` accepts `audioBase64` and `audioMimeType`
  - Server-side validation enforces format and size limits (min 1KB, max 25MB)
  - Transcription appended to message: `[Áudio enviado]\n{content}\n\n🎤 Transcrição automática:\n{transcription}`
  - ChatMessage component displays audio with badge "🎤 Áudio enviado" and transcription in styled box
  - Audio preview with filename and remove option before sending
  - Toast notification confirms successful transcription
  - Performance: 2-5 seconds per audio, ~$0.006/minute cost
- **Test Chat Media Upload** (`client/src/pages/TestChat.tsx`):
  - Comprehensive testing interface for image and audio processing features
  - Image upload: JPEG, PNG, WebP, GIF (max 20MB) with instant preview
  - Audio upload: MP3, OGG, WAV, WebM, MP4, M4A (1KB-25MB) with filename display
  - Backend processes media through GPT-4o Vision and Whisper APIs
  - Audio base64 sanitization: Strips `data:audio/*;base64,` prefix before Whisper transcription
  - Returns `userMessage` field with processed content (analysis/transcription) for proper UI display
  - Prevents empty message bubbles when sending media-only messages
  - Client and server-side validation for file types and sizes

**Real-Time Monitoring**:
- **Supervisor Dashboard**: Provides KPIs, live conversation queues, alerts, transcripts, and human intervention controls.
- **Monitor Page**: Displays concurrent conversations for supervisors.

**Continuous Learning System**:
- **Autonomous Learning**: GPT-4 agent identifies patterns from supervisor interventions and feedback to suggest prompt improvements.
- **Feedback**: Incorporates both implicit (resolutions, transfers) and explicit (supervisor corrections, NPS) feedback.
- **Hybrid Training System** (`shared/schema.ts`: `training_sessions`, `server/lib/openai.ts`: `processTrainingContent`):
  - **Keyword-Based Capture**: Supervisors can mark training segments during live conversations using "start" and "stop" keywords (word-boundary regex prevents false positives)
  - **Manual Creation**: Dedicated "Treinamento Manual" tab in Agent Evolution page for creating training sessions via UI
  - **Training Sessions Database**: Stores conversationId, assistantType, title, content, status (active/completed/applied), timestamps, and user IDs
  - **GPT-5 Processing**: `processTrainingContent` function analyzes training content alongside current assistant instructions to generate improved prompts
  - **Apply Workflow**: ADMIN/SUPERVISOR can apply sessions → GPT-5 generates enhanced instructions → updates assistant via OpenAI API → creates PromptUpdate audit log
  - **7 REST Endpoints**: GET all sessions, GET by ID, POST create, POST complete, POST apply, POST delete, with role-based access (ADMIN/SUPERVISOR only)
  - **UI Features**: Active/completed/applied lists, session creation dialog, management actions (complete, apply, delete), real-time status updates
  - **Integration**: Circuit breaker protection, instruction caching, comprehensive error handling and logging

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

**Conversation Transfer System** (`client/src/components/ChatPanel.tsx`, `server/routes.ts`):
- **Transfer Button**: Visible in chat header (Users icon next to resolve button)
  - ADMIN/SUPERVISOR: Always visible
  - AGENT: Visible only for conversations assigned to them
- **Transfer Dialog**: Modal with agent selection dropdown and optional transfer notes
- **Agent Filtering**: Automatically excludes current assigned agent from available options
- **Backend Endpoints**:
  - POST `/api/conversations/:id/transfer`: Transfer conversations with role-based permissions
    - ADMIN/SUPERVISOR: Can transfer any conversation
    - AGENT: Can only transfer conversations assigned to them
  - GET `/api/users/available-agents`: Returns list of active AGENTS/SUPERVISORS/ADMINS (accessible by all authenticated users)
- **Transfer Workflow**: 
  - Updates `assignedTo` field to new agent
  - Creates transfer message in conversation history
  - Sends WhatsApp notification to client with new agent details
  - Logs transfer action in `supervisor_actions` table with notes
  - Supports optional transfer reason/notes for context
- **Message Templates**: Uses `agent_transfer` template or default transfer message with variables: `{agentName}`, `{fromAgent}`, `{notes}`
- **Real-time Updates**: Invalidates conversation queries to refresh UI across all views

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