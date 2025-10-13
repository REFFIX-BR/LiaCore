# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service. It functions as an intelligent router and coordinator for specialized AI assistants, leveraging OpenAI's Assistants API and a RAG knowledge base. The platform automates Q&A, executes actions like boleto consultation and PPPoE diagnosis, and features a real-time supervisor monitoring dashboard for human intervention. It also includes an autonomous continuous learning system that evolves AI assistant prompts based on feedback, aiming to significantly enhance customer service efficiency and satisfaction.

## User Preferences
Preferred communication style: Simple, everyday language.

## Development Environment Configuration

⚠️ **IMPORTANT - Production Database in Development** (Updated 2024-10-12):
- Development environment is configured to use **production PostgreSQL database** via `DATABASE_URL` secret
- **Why**: Local development receives WhatsApp webhooks from production Evolution API instance
- **Impact**: All development changes affect production data directly
- **Benefit**: Allows real-time testing with live WhatsApp messages and eliminates "conversation not found" errors
- **Risk**: Developer must be cautious - any database operations or testing affects real customer data
- **Recommendation**: Consider setting up separate Evolution API instance for development or use staging database for safer testing

## System Architecture

### UI/UX Decisions
The frontend is developed with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS. Its design is influenced by Carbon Design System and Linear, optimizing for data-dense enterprise interfaces, and it supports both dark and light modes. Client-side routing is handled by Wouter.

### Technical Implementations
**Frontend**: Uses TanStack Query for server state management and includes pages such as Dashboard, Monitor, Test Chat, Conversations, Knowledge, Assistants, Agent Evolution, Metrics, Feedbacks NPS, and Settings.

**Backend**: Built with Node.js and Express.js (TypeScript). It utilizes GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM for data persistence. Session management is based on OpenAI thread-based conversations stored in Redis.

**Queue System**: Employs BullMQ with Redis TLS for asynchronous message processing across six queues (message-processing, ai-response, image-analysis, nps-survey, learning-tasks, inactivity-followup). It includes automatic retry mechanisms and webhook fallback to ensure zero message loss, supporting high conversation volumes.
- **Worker Recovery System** (Implemented 2024-10-12): Automatic fallback mechanism that recovers conversations by chatId when primary ID lookup fails. Prevents message loss from audio transcriptions and ensures AI responses even when conversation references become stale, with detailed logging for production diagnostics.
- **OpenAI Thread Concurrency Lock** (Implemented 2024-10-13): Redis-based distributed lock system prevents "Can't add messages to thread while a run active" errors during concurrent message processing. Uses unique lock tokens (timestamp+random), 120s TTL (exceeds 90s circuit breaker), and atomic Lua script for safe release ensuring only lock owner can delete. Implements retry logic with 30s timeout and finally block guarantees cleanup even on errors.

**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API.
- **Specialized Assistants**: Six roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) with a "Receptionist-First" routing model.
- **AI Routing Architecture** (Critical 2024-10-13): APRESENTAÇÃO (Receptionist) assistant uses **ONLY** `rotear_para_assistente` function to route to specialized AI assistants (Support, Commercial, Finance, etc.). It does NOT have access to `transferir_para_humano` - only specialized assistants can transfer to human agents. This ensures proper AI-first workflow where receptionist routes to specialists, and specialists handle human escalation when needed.
- **Conversation Finalization Logic**: A robust system ensures proper conversation closure and correct NPS survey delivery, with specific rules for assistant roles regarding autonomous finalization or mandatory human transfer.
- **Conversation Summarization**: Asynchronous summarization of conversations.
- **RAG Architecture**: Features a dual-layer prompt system separating System Prompts (absolute behavioral rules embedded in OpenAI Assistant instructions) from RAG Prompts (structured context-specific prompts for grounded generation). Utilizes Upstash Vector for semantic search.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, and scheduling, with secure internal-only tool execution.
- **Automated Document Detection**: Regex-based CPF/CNPJ detection and mandatory verification before sensitive operations.
- **Automated Systems**: Includes "Boleto Consultation", "PPPoE Connection Status", and "Unlock/Unblock" systems with integrated security.
- **Vision System**: GPT-4o Vision for automatic WhatsApp image analysis (boletos, documents, screenshots, technical photos), with a dual download strategy and graceful fallback.
- **PDF Text Extraction System** (Implemented 2024-10-12): Automatic text extraction from PDF documents for AI analysis:
  - **Library**: pdf-parse for native PDF text extraction
  - **Webhook Integration**: Automatically extracts text from PDFs received via WhatsApp
  - **Validation**: Format detection (mimetype/extension), size limit (10MB max)
  - **Text Processing**: Extracts full document text, truncates if >15k chars (~3,750 tokens) to prevent token limits
  - **AI Integration**: Formats message with document name + full extracted text for contextual AI responses
  - **Fallback Handling**: Detects scanned PDFs (no extractable text), oversized documents, extraction errors
  - **Storage**: Original PDF base64 + fileName stored in database for supervisor download
  - **Benefits**: AI can read and respond to PDF content (contracts, invoices, technical documents) while supervisors retain original files
- **Audio Processing System**: Handles WhatsApp audio messages with automatic transcription via OpenAI Whisper API and provides supervisor playback within the UI.
- **Conversation Intelligence System**: Provides real-time analysis of customer messages including sentiment analysis, 4-level urgency classification, technical problem detection, recurrence detection (tracking by CPF/CNPJ), and automatic persistence of CPF/CNPJ. It also includes an AI function for prioritizing technical support.

**Real-Time Monitoring**: A Supervisor Dashboard provides KPIs, live conversation queues, alerts, transcripts, and human intervention controls.
- **Live Logs System** (Implemented 2024-10-12): WebSocket-powered real-time event monitoring page (`/live-logs`) displaying all system events with intelligent filters (Routing, Messages, Errors), live statistics, pause/resume controls, and detailed JSON inspection. Tracks MESSAGE_RECEIVED, AI_RESPONSE, CONVERSATION_ROUTED, TRANSFER_TO_HUMAN, and 10+ critical events for operational visibility. Uses WebSocket endpoint `/ws/webhook-logs`.
- **Agent Reasoning Logs** (Implemented 2024-10-12): Dedicated real-time monitoring system (`/agent-logs`) that visualizes AI assistant decision-making, routing logic, and function calls. WebSocket-based interface displays reasoning (🧠), routing decisions (🔀), function calls (🛠️), decisions (🎯), and errors (❌) with full context, allowing supervisors to understand what AI assistants are "thinking" during conversations. Integrated at 4 critical points in OpenAI processing: routing decisions, function calls, inter-assistant routing, and conversation finalization. Uses WebSocket endpoint `/ws/reasoning`.

**Continuous Learning System**: An autonomous GPT-4 agent suggests prompt improvements based on supervisor interventions and feedback (implicit and explicit). A hybrid training system allows supervisors to mark training segments or create sessions for prompt generation.

**NPS & Customer Satisfaction**: Automated NPS surveys via WhatsApp post-conversation, with feedback integrated into the learning system.
- **NPS Detection System** (Fixed 2024-10-12): Rigorous regex validation ensures only genuine rating responses (0-10) are processed as NPS feedback. Messages like "preciso de 2 vias" or "aguardando 10 minutos" are correctly identified as regular messages, preventing false NPS detection and ensuring proper conversation reopening after finalization.
- **NPS Auto-Send System** (Enhanced 2024-10-13): Automatic NPS survey delivery after conversation resolution by both AI assistants and human agents. System validates WhatsApp metadata, sends formatted survey with scale explanation, and logs delivery status with detailed debug information for troubleshooting.

**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with real-time counters and AI-assisted agent responses.
- **Agent Welcome Message System** (Implemented 2024-10-12): Automatic welcome message sent via WhatsApp when AI transfers conversation to human agent. Message intelligently requests CPF/CNPJ if not already in database, or proceeds with standard greeting if customer is already registered. Template-based system allows customization per department.
- **Inactivity Follow-up System** (Implemented 2024-10-13): Automatic re-engagement system that detects client inactivity during active AI conversations. After 10 minutes without client response, the system sends a personalized follow-up message ("Olá [nome], você está aí? Podemos dar continuidade no atendimento?"). Features intelligent cancellation when client responds before timeout, database-managed customizable message templates, and automatic skip for transferred or resolved conversations. Uses BullMQ delayed jobs for scalable scheduling.

**WhatsApp Integration**: Native integration with Evolution API for real-time message processing, AI routing, and outbound messaging.
- **Multi-Instance Evolution API Support** (Implemented 2024-10-13): Dynamic API key lookup supporting multiple WhatsApp instances with per-instance secrets. System tries instance-specific key first (EVOLUTION_API_KEY_{instance}), falls back to global EVOLUTION_API_KEY. Enables simultaneous operation of multiple Evolution API instances (Leads, testecortex1, Cobranca) with automatic key resolution in message sending and media downloads.

**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions, role-based navigation, and an ADMIN interface for user management.

**Personalized Dashboards**: Role-specific dashboards offer relevant KPIs and data, with the Admin Dashboard providing system health, cost analysis, and activity logs.

**Contact Management System**: Centralized client database for tracking conversation history, and enabling proactive service by creating/updating contacts, reopening conversations, and providing a frontend page for search and detailed views.
- **WhatsApp Contact Sync** (Implemented 2024-10-12): Automatic contact import via Evolution API `contacts.update` webhook. When contacts are added/updated in WhatsApp, they're automatically imported to the system with phone number, name, and profile picture URL. System processes bulk sync, creates new contacts, updates existing names, and logs all operations via WebSocket for real-time monitoring.

**Message Deletion System** (Implemented 2024-10-12): Supervisors and agents can delete assistant messages from both database and WhatsApp via Evolution API:
  - **Backend**: DELETE `/api/messages/:id` endpoint with role-based permissions (ADMIN/SUPERVISOR or assigned AGENT)
  - **WhatsApp Integration**: Calls Evolution API `/chat/deleteMessageForEveryone` endpoint (2-day deletion window applies)
  - **Metadata Capture**: System captures `whatsappMessageId` and `remoteJid` when AI/supervisor messages are sent via `sendWhatsAppMessage()`
  - **Storage**: Added `getMessage()`, `updateMessage()`, `deleteMessage()` methods to storage interface
  - **Frontend UI**: Hover-reveal delete button (Trash2 icon) for assistant messages in Monitor conversation details
  - **Fallback Handling**: Graceful degradation - deletes from database even if WhatsApp deletion fails (e.g., time limit exceeded)
  - **Benefits**: Allows correction of AI errors, removal of sensitive information, and message management within WhatsApp's deletion policies

**Redis Optimization System**: Implements a cost reduction framework through intelligent caching, batching of Redis commands, multi-get operations, batch updates, and hash storage, significantly reducing Redis requests and costs.

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