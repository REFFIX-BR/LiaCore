# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service. It orchestrates specialized AI assistants using OpenAI's Assistants API and a RAG knowledge base to automate Q&A and actions like boleto consultation and PPPoE diagnosis. The platform features a real-time supervisor monitoring dashboard for human intervention and an autonomous continuous learning system that evolves AI assistant prompts. Its core purpose is to enhance customer service efficiency and satisfaction, providing a robust, scalable, and intelligent AI solution for telecommunications.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS. Its design is inspired by Carbon Design System and Linear for data-dense enterprise interfaces, supporting both dark and light modes. `Wouter` is used for client-side routing.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management.

**Backend**: Developed with Node.js and Express.js (TypeScript). It leverages GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM for data persistence.

**Queue System**: Employs BullMQ with Redis TLS for asynchronous processing across multiple queues (e.g., message-processing, AI-response, NPS-survey, learning-tasks, auto-closure). It ensures message delivery with retries, webhook fallbacks, and uses Redis-based distributed locks. A two-stage automatic conversation closure system manages inactive conversations.

**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API.
- **Specialized Assistants**: Six roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) operating with a "Receptionist-First" routing model. Ouvidoria assistant has reinforced instructions to ALWAYS collect complete complaint details and register with protocol BEFORE transferring, even for technical issues.
- **RAG Architecture**: Features a dual-layer prompt system separating System Prompts from RAG Prompts using Upstash Vector for semantic search. Includes a RAG system for equipment return information, automatically recommending the nearest return point based on client location.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, and scheduling, with secure internal-only tool execution.
- **Automated Systems**: Includes automated document detection (CPF/CNPJ), "Boleto Consultation", "PPPoE Connection Status", and "Unlock/Unblock" systems with integrated security. An HTTP Resilience System centralizes retry logic for external API calls.
- **Vision System**: GPT-4o Vision for automatic WhatsApp image analysis.
- **PDF Text Extraction System**: Extracts text from PDF documents for AI analysis.
- **Audio Processing System**: Transcribes WhatsApp audio messages via OpenAI Whisper API.
- **Video Processing System**: Displays WhatsApp video messages in chat interface with HTML5 player, caption support, and metadata storage (videoUrl, videoName, videoMimetype). Video fields are explicitly selected in `getMessagesPaginated` query to ensure proper serialization in API responses. Videos stored as URLs (like audio), not base64 (like images/PDFs).
- **Conversation Intelligence System**: Provides real-time analysis of sentiment, urgency, and technical problems, with automatic persistence of CPF/CNPJ.

**Real-Time Monitoring**: The Supervisor Dashboard offers KPIs, live conversation queues, alerts, transcripts, human intervention controls, and a Live Logs System. The "Finalizadas" (Resolved) tab features sub-filters to distinguish between conversations resolved by AI, by human agents, or auto-closed due to inactivity, with visual badges on conversation cards.

**Continuous Learning System**: An autonomous GPT-4 agent suggests prompt improvements based on supervisor feedback.

**NPS & Customer Satisfaction**: Automated NPS surveys via WhatsApp post-conversation, with feedback integrated into the learning system.

**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with real-time counters, AI-assisted agent responses, and automatic conversation closure after extended inactivity.

**WhatsApp Integration**: Native integration with Evolution API for real-time messaging, AI routing, and outbound messaging, supporting multi-instance operations with dynamic API key lookup. Implements triple-fallback message delivery system (instance → ENV → 'Principal') to prevent silent failures when `evolution_instance` is NULL. All outbound messages return `{success, whatsappMessageId, remoteJid}` for future deletion/reconciliation workflows. Includes a WhatsApp Groups Management System with individual AI control per group and complete chat interface for group messaging. Supports multimedia messages including images, audio/voice notes, PDFs, and videos with automatic detection, storage, and visualization in the chat interface.

**Evolution Instance Consistency**: Critical architectural decision ensuring message routing integrity. When a conversation is created via a specific Evolution API instance (Principal, Leads, Cobranca), ALL subsequent messages (AI responses, agent responses, automated messages) MUST use that same instance, regardless of which instance the client's webhook messages arrive through. The webhook (server/routes.ts) implements `finalEvolutionInstance` logic that prioritizes `conversation.evolutionInstance` over the incoming webhook's `instance` parameter. Warning logs alert when a client sends messages via a different instance than their conversation's original, enabling monitoring of cross-instance anomalies without breaking message flow. This ensures clients always receive responses through the correct WhatsApp number/instance they initiated contact with.

**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.

**Contact Management System**: Centralized client database for conversation history and proactive service, with automatic WhatsApp contact synchronization. Includes a **"New Contact"** feature allowing supervisors to manually create contacts and conversations without automatic message sending - conversations are moved to "Transferidas" queue (or assigned to specific agent) for manual agent response. **Conversation Reopen** feature enables agents to reopen closed conversations by moving them to "Transferidas" queue without sending automatic messages, allowing manual follow-up responses. The reopen system preserves the Evolution API instance from the contact's last conversation, ensuring messages are sent to the correct WhatsApp instance (Principal, Leads, Cobranca, etc.).

**Message Deletion System**: Allows supervisors and admins to soft-delete assistant messages, with visual indicators and WhatsApp integration for deletion.

**Redis Optimization System**: Implements intelligent caching, batching, and hash storage to reduce Redis requests and costs.

**Message Batching System**: Atomic Redis-based debouncing system preventing multiple AI responses to sequential client messages. Uses 3-second window to group consecutive text messages into a single AI request with RPUSH/LRANGE atomic operations and Lua script for race-free batch processing. Timer verification prevents premature processing when new messages arrive. Media messages (images/audio/PDF) bypass batching and process immediately to preserve all attachments. Legacy batches with media are detected and processed individually via safeguard mechanism. Implemented in `server/lib/message-batching.ts` with webhook integration.

**Private Notes System**: Internal collaboration feature allowing agents to leave private notes on conversations for team visibility. Notes are conversation-specific, timestamped, and show author information. Accessible via dialog interface with button in chat controls.

**Conversation Verification System**: Supervisor workflow tracking system to prevent duplicate conversation reviews across shifts. Supervisors can mark conversations as verified (with timestamp and supervisor ID stored). Visual indicators (green CheckCircle2) appear on verified conversations in all views. Verification automatically resets when client sends new message, ensuring supervisors re-review conversations after new customer input. Verification button available only for admins/supervisors in ChatPanel.

**Activity Logs & Audit System**: Comprehensive audit trail system tracking all user actions and supervisor operations. Automatically logs LOGIN/LOGOUT events with session duration, IP address, and browser information. Records all supervisory actions including conversation transfers, assignments, resolutions, and verifications with full context (client info, target agents, timestamps). Features dual-tab interface separating agent activity from supervision actions, with real-time KPI dashboard showing daily logins, active sessions, supervision actions, and average session duration. All logs enriched with user, conversation, and target user details for complete audit trail.

### System Design Choices
- **Conversation Prioritization**: Color-coded wait time indicators and sorting by timestamp.
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and managing system configurations.
- **Image Handling**: Supervisors can download WhatsApp images directly from the chat interface.
- **Worker Concurrency**: Optimized worker configuration (20 message workers, 8 image workers, 8 NPS workers).
- **Ouvidoria Details Modal**: Enhanced UI for viewing complete complaint descriptions.
- **API Key Management**: Robust handling of multi-instance Evolution API keys.
- **Private Notes UI**: Dialog-based interface with StickyNote icon button in chat controls. Shows badge count when notes exist. Dialog displays creation form and scrollable list of existing notes with author and timestamp.
- **New Contact Creation**: "Novo" button in Contacts page allows creating new contacts with phone number, name, CPF/CNPJ, and optional agent assignment. Creates conversation without sending WhatsApp message - conversation moved to "Transferidas" (if not assigned) or "Atribuídas" (if assigned to specific agent) for manual agent response. Simplified UX with informational blue panel explaining manual follow-up approach. No Evolution API integration during creation.
- **Conversation Reopen**: "Reabrir Conversa" button in contact details moves conversation to "Transferidas" queue without automatic message sending. Creates/reactivates conversation with `transferredToHuman=true` and `assignedTo=null`, making it available for any agent to claim and respond manually. Preserves `evolutionInstance` from contact's last conversation to ensure outbound messages use the correct WhatsApp instance. Falls back to 'Principal' only for contacts with no prior conversation history. Simplified UX with informational blue panel explaining manual follow-up approach.
- **Conversation Verification UI**: Visual indicators (green CheckCircle2 icon) show verified conversations in ConversationCard and Conversations page. Verify button in ChatPanel (supervisor/admin only) disabled when already verified, with automatic cache invalidation across all conversation views.
- **Activity Logs UI**: Dual-tab interface (Agentes/Supervisão) in Monitoramento menu showing comprehensive audit trail. Agents tab displays LOGIN/LOGOUT events with session duration, IP, and browser info. Supervision tab shows all supervisory actions (transfer, assign, resolve, verify) with enriched data including client names, target agents, and action details. Four KPI cards track daily logins, active sessions, supervision actions, and average session duration. Real-time updates every 10 seconds.
- **Monitor Resolved Conversations Sub-Filters**: The "Finalizadas" tab in Monitor features sub-filters to distinguish resolution types: "🤖 Pela IA" (AI-resolved, never transferred to human), "👤 Por Atendentes" (agent-resolved after human transfer), and "⏰ Auto-fechadas" (auto-closed due to inactivity). Each sub-filter has live counters and conversation cards display color-coded badges (blue for AI, green for agents, orange for auto-closed) indicating who resolved the conversation.
- **WhatsApp Groups Chat Interface**: Dual-tab system (Chat/Informações) in Groups page. Chat tab displays message history with auto-refresh (5s), lazy loading pagination (15 messages per page with "Carregar mensagens anteriores" button), scroll position preservation when loading older messages, field for sending messages to group, auto-scroll to latest messages, and Enter-to-send shortcut. Informações tab shows group details, AI toggle, participant count, Evolution instance, and statistics. Messages stored in conversations table using chatId pattern `whatsapp_{groupId}`. Supervisors can respond to group messages directly through Evolution API. Pagination uses `getMessagesPaginated` with `before` and `limit` parameters.

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