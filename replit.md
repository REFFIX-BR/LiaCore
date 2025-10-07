# LIA CORTEX - AI Orchestration Platform

## Overview

LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom customer service operations. It acts as an intelligent router and coordinator for multiple specialized AI assistants (e.g., Support, Sales, Technical, Financial) powered by OpenAI's Assistants API. The platform integrates a RAG (Retrieval-Augmented Generation) knowledge base using Upstash Vector for dynamic, document-based responses, enabling assistants to perform actions via structured APIs and answer open-ended questions from company documentation.

A real-time supervisor monitoring dashboard provides visibility into customer interactions, allowing human supervisors to track sentiment, detect issues, and intervene. The platform also includes a fully autonomous continuous learning system that evolves assistant prompts based on supervisor interventions and customer feedback (NPS).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite.
**UI Components**: shadcn/ui based on Radix UI, styled with Tailwind CSS.
**Design System**: Custom design guidelines inspired by Carbon Design System and Linear's interface, optimized for enterprise data-dense interfaces with dark and light mode support.
**State Management**: TanStack Query for server state management and data fetching with 5-second polling intervals.
**Routing**: Wouter for client-side routing.
**Key Pages**: Dashboard, Monitor, Test Chat, Conversations, Knowledge, Assistants, Agent Evolution, Metrics, Settings.

### Backend Architecture

**Runtime**: Node.js with Express.js.
**Language**: TypeScript with ES modules.
**API Design**: RESTful API endpoints under `/api`.
**Core Modules**:
- **Router Module**: Analyzes incoming messages using GPT-5 to route to appropriate specialized assistant.
- **OpenAI Integration**: Manages threads and message exchanges with OpenAI Assistants API.
- **Upstash Integration**: Handles vector search for RAG knowledge base and Redis for conversation thread storage.
**Session Management**: OpenAI thread-based conversations with 7-day expiry stored in Redis.
**Storage Layer**: In-memory storage with an interface (`IStorage`) designed for database migration.

### Database & Data Storage

**Primary Database**: PostgreSQL (via Neon serverless).
**ORM**: Drizzle ORM.
**Schema Entities**: Users, Conversations (including `conversationSummary`), Messages, Alerts, Supervisor Actions, Learning Events, Prompt Suggestions, Prompt Updates, Satisfaction Feedback.
**Vector Database**: Upstash Vector for semantic search in knowledge base.
**Cache Layer**: Upstash Redis for session data and conversation threads.

### AI & Knowledge Management

**AI Provider**: OpenAI, with separate assistant IDs for each specialized role.

**Assistant Configuration**: All 6 specialized assistants (Suporte, Comercial, Financeiro, Cancelamento, Ouvidoria, Apresentação) have detailed instructions documented in `INSTRUCOES_ASSISTENTES_OPENAI.md`. Each assistant is configured to:
- Respond in natural conversational Portuguese (never JSON)
- Use WhatsApp-friendly formatting (short messages, emojis, ≤500 chars)
- Transfer to human agents using `transferir_para_humano` function when appropriate
- Access specialized tools for their domain (e.g., `consultar_pppoe_status` for Support, `consultar_boleto_cliente` for Finance)

**Critical Configuration**: All assistants MUST have Response Format set to "text" (NOT "json_object") in OpenAI platform to ensure conversational responses.

**Assistant IDs**:
- Support: `asst_CDkh1oE8YvKLtJYs3WY4rJX8` (verified correct)
- Routing: Uses GPT-5 for intent classification (separate from conversational assistants)

**Routing Logic**: GPT-5 based intent classification using conversation summaries and recent messages for context-aware routing.

**Automatic Conversation Summarization**:
- Triggered every 12 messages, processed asynchronously.
- Generates structured JSON summaries (summary text, key facts, sentiment, actions, etc.).
- Maintains context with last 5 messages, accumulates summaries to prevent context loss.
- Configurable parameters: `SUMMARIZE_EVERY=12`, `KEEP_RECENT=5`, `CONTEXT_WINDOW=7`.

**RAG Implementation**: Knowledge chunks in Upstash Vector with embeddings; assistants can call `consultar_base_de_conhecimento` for dynamic knowledge retrieval.

**Function Calling**: Assistants are equipped with custom functions for tasks like connection verification, knowledge base queries, invoice lookups, and visit scheduling.

### Real-Time Monitoring

**Supervisor Dashboard**: Displays KPI metrics, live conversation queue with urgency/sentiment, critical alerts, full transcripts, and human intervention controls.
**Update Mechanism**: Client-side polling with React Query at 3-5 second intervals.

### Continuous Learning System

**Overview**: Autonomous system for evolving assistant prompts based on supervisor interventions and feedback.
**Core Components**: LIA Cortex Analysis Agent (GPT-4 powered), Learning Scheduler (automated periodic analysis), Feedback Capture.
**Learning Pipeline**:
1. **Feedback Collection**: Implicit (resolved conversations, transfers), Explicit (supervisor corrections), NPS-based (detractors).
2. **Automated Analysis**: Groups learning events, identifies patterns, generates improvement suggestions.
3. **Supervision Workflow**: Supervisor reviews/approves suggestions via the Agent Evolution dashboard; approved changes update OpenAI assistant instructions.
**Deduplication & Idempotency**: Prevents duplicate suggestions.

### Settings & System Management

**Settings Page**: Centralized configuration with tabs for Assistants (status monitoring), Resumos (summarization config), APIs (connection status), Aprendizado (learning config), and Ferramentas (system tools like cache clear, re-indexing).

### NPS & Customer Satisfaction System

**Overview**: Integrated post-conversation feedback system capturing NPS and feeding detractor feedback into the continuous learning pipeline.
**Feedback Flow**: NPS dialog appears after conversation resolution; client/supervisor rates 0-10 + comment. Detractor scores (0-6) automatically create learning events.
**Metrics Dashboard**: Displays NPS score, distribution, per-assistant NPS, timeline, and recent comments.

### Hybrid Supervised Mode (Conversas Tab)

**Overview**: Advanced supervision interface where human supervisors handle conversations transferred from AI assistants, with intelligent AI assistance for response suggestions.
**Core Features**:
- **Transferred Conversation Queue**: Displays all conversations escalated to human supervisors with transfer reasons and timestamps.
- **AI-Assisted Response System**: 
  - Supervisor requests AI suggestion using "Pedir Sugestão da IA" button
  - GPT-4 analyzes full conversation context and generates contextually appropriate response
  - Supervisor can either approve suggestion as-is or edit before sending
  - Edited responses automatically create explicit learning events for continuous improvement
- **Learning Integration**: 
  - Approved suggestions (unchanged) → sent directly, no learning event
  - Edited suggestions → creates learning event with `eventType: "explicit_correction"`
  - Learning events include: original AI suggestion, final approved response, full context
  - Feeds directly into autonomous learning pipeline for prompt improvements
- **Manual Resolution**: Supervisors can manually resolve conversations, triggering same NPS feedback flow as Monitor page
- **Schema**: `suggestedResponses` table tracks AI suggestions vs final approved responses with edit flags and supervisor metadata

### WhatsApp Integration (Evolution API)

**Overview**: Native integration with Evolution API for receiving and processing WhatsApp messages in real-time through webhooks.

**Webhook Endpoint**: `POST /api/webhooks/evolution` - Receives events from Evolution API external WhatsApp system.

**Supported Events**:
- `messages.upsert` - New incoming/outgoing messages (primary event for customer messages)
- `messages.update` - Message status updates (logged)
- `messages.delete` - Message deletions (logged)
- `chats.upsert` - Chat creation/updates (synchronizes client name metadata)
- `chats.update` - Chat modifications (logged)
- `chats.delete` - Chat deletions (logged)

**Message Processing Flow**:
1. **Webhook Reception**: Evolution API sends `messages.upsert` event with message payload
2. **Message Extraction**: System extracts text from various message types (conversation, extendedTextMessage, image captions, etc.)
3. **Client Identification**: Phone number extracted from `remoteJid` (format: `5511999999999@s.whatsapp.net`)
4. **Chat ID Assignment**: Prefixed with `whatsapp_` for WhatsApp conversations
5. **AI Routing**: Message routed to appropriate assistant (Suporte, Comercial, etc.)
6. **Thread Management**: OpenAI thread created/retrieved for conversation continuity
7. **Response Generation**: AI assistant processes message and generates contextual response
8. **Background Processing**: AI response stored asynchronously, conversation updated
9. **Transfer Handling**: If `transferir_para_humano` function called, conversation marked as transferred

**Message Types Supported**:
- **Text**: `conversation`, `extendedTextMessage`
- **Media**: Image (with/without caption), Video (with/without caption), Audio, Document, Sticker
- **Location & Contact**: Contact sharing, Location sharing
- **Auto-ignore**: Messages with `fromMe: true` (sent by business)

**Conversation Metadata**:
- Source: Tagged as `evolution_api` in conversation metadata
- Instance: Evolution API instance name stored
- Remote JID: Original WhatsApp identifier preserved
- Client tracking: Phone number used as `clientId`

**Implementation Status**: ✅ Complete
- All WhatsApp message types supported (text, media with/without captions, stickers, contacts, locations)
- CHATS_UPSERT synchronizes client names with conversation metadata
- Messages automatically routed to appropriate assistants and responses generated
- **Outbound messaging fully implemented**: AI responses sent back to WhatsApp automatically via Evolution API

**Outbound Messaging Details**:
- **Endpoint**: `POST https://{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_API_INSTANCE}`
- **Authentication**: Uses `EVOLUTION_API_KEY` in `apikey` header
- **Configuration**: Requires 3 environment variables (URL, API key, instance name)
- **Flow**: Webhook receives message → AI processes → Response automatically sent to WhatsApp
- **Delay**: 1200ms typing simulation for natural conversation feel
- **Error Handling**: Graceful fallback with detailed logging if Evolution API unavailable

**Future Enhancements**:
- **Extended CHATS_* Handling**: Enrich metadata sync beyond name if needed
- **Media Support**: Add outbound support for images, audio, documents
- **Automated Testing**: Add e2e tests for webhook verification with real WhatsApp numbers

## External Dependencies

**Third-Party Services**:
- **OpenAI**: Assistants API (conversational AI), GPT-5 (routing).
- **Upstash Vector**: Serverless vector database for RAG.
- **Upstash Redis**: Serverless Redis for session and thread storage.
- **Neon Database**: Serverless PostgreSQL for persistent data.

**Key NPM Packages**:
- `@radix-ui/*`: Headless UI components.
- `@tanstack/react-query`: Server state management.
- `drizzle-orm`: Type-safe database ORM.
- `express`: Web server framework.
- `react-hook-form` + `zod`: Form handling and validation.
- `date-fns`: Date manipulation.
- `tailwindcss`: Utility-first CSS framework.

**Development Tools**:
- Vite with React plugin.
- TypeScript.
- ESLint and Prettier.