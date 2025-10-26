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
- **RAG Architecture**: A dual-layer prompt system with Upstash Vector, including specific RAG for equipment returns, sales documentation, and TR Telecom Câmeras (security cameras service).
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
**Ephemeral Installation Point Selection System (Boletos)**: **NEW ARCHITECTURE (Oct 2025)** - Customers with multiple installation points receive a menu for EVERY boleto query, ensuring complete freedom to select different addresses each time. Uses Redis ephemeral storage (5min TTL) with NLU mapping ("3", "terceiro", "amazonas" → point number). Worker intercepts responses BEFORE AI processing, filters boletos by selected point, and bypasses AI entirely. No database persistence - selection is temporary. Prevents cross-contamination between queries and eliminates stuck selections. Supports ordinal numbers (primeiro, segundo), direct numbers (1, 2, 3), and address keywords (cidade, bairro, rua).
**Regional Massive Failure System**: Automated detection and notification system for service outages affecting specific neighborhoods. Includes visual region selector for creating failures, automatic client notification via WhatsApp when affected by outages, intelligent region matching that normalizes city/neighborhood names (handles extra spaces and accents) from CRM API to database records, and **multiple installation points support** - when customers have multiple service addresses, the system automatically detects this, injects context into the AI thread asking which address has the issue, and provides the AI tool `selecionar_ponto_instalacao` for customer selection. The selected point is used for precise massive failure verification. Serves 7 cities with 145 neighborhoods total.

### Monitor de Atendimento - Real-Time Supervision Dashboard

The Monitor de Atendimento (Service Monitor) is the real-time supervision center where supervisors track all active conversations. It provides comprehensive visibility into AI and human interactions through a **5-state view mode system**.

#### View Mode System (5 Estados)

The Monitor features a primary view mode selector that controls all conversation filtering:

**🌐 Todas (All Conversations - Default)**
- Shows all active and resolved conversations
- Excludes only the transfer queue (conversations waiting for assignment)
- **Use Case**: Complete overview of all system activity

**🤖 IA Atendendo (AI Handling)**
- Shows **only** conversations actively being handled by AI assistants
- Filters: `status = 'active' AND transferredToHuman = false`
- Excludes all transferred conversations (queue and assigned)
- **Use Case**: Monitor AI performance and automated resolutions

**⏳ Aguardando (Waiting in Queue)**
- Shows **only** conversations transferred to humans but not yet assigned
- Filters: `status = 'active' AND transferredToHuman = true AND assignedTo = null`
- This is the transfer queue waiting for agent assignment
- **Use Case**: See which conversations need agent attention

**👤 Em Atendimento (Being Handled by Agents)**
- Shows **only** conversations assigned to and being handled by human agents
- Filters: `status = 'active' AND transferredToHuman = true AND assignedTo != null`
- Excludes AI conversations and unassigned queue
- **Use Case**: Monitor agent performance and workload

**📋 Finalizadas (Resolved Conversations)**
- Shows **only** resolved conversations from the last 12 hours
- Filters: `status = 'resolved'`
- **Sub-filters** (displayed when Finalizadas is selected):
  - "Todas": All resolved conversations
  - "🤖 Pela IA": Only AI-resolved conversations
  - "👤 Por Atendentes": Only agent-resolved conversations
  - "⏰ Auto-fechadas": Only auto-closed due to inactivity
- **Use Case**: Quality review, audit trail, performance analysis

**Filtering Precedence**: View Mode → Department Filter → Search → Resolved Sub-filter (if Finalizadas)

#### Department Tabs

After selecting a view mode, conversations can be further filtered by department:

**Available Departments:**
- **Todos**: All departments (default)
- **Apresentação**: Initial reception/routing
- **Financeiro**: Billing and payments
- **Suporte Técnico**: Internet/technical issues
- **Comercial**: Sales and plans
- **Ouvidoria**: Formal complaints
- **Cancelamento**: Cancellation requests

**Department Filtering Notes:**
- Applies within the selected view mode
- Agents see only conversations from their assigned departments in "Aguardando" mode (transfer queue)
- Supervisors/admins see all conversations across all departments
- Conversations are automatically tagged with departments based on the AI assistant that handled them

#### Conversation Lifecycle Flow
```
1. CLIENT SENDS MESSAGE
   ↓ Visible in "🤖 IA Atendendo" mode

2. AI DETECTS NEED FOR HUMAN
   ↓ Visible in "⏳ Aguardando" mode (waiting for assignment)

3. AGENT ASSUMES CONVERSATION
   ↓ Visible in "👤 Em Atendimento" mode

4. AGENT RESOLVES CONVERSATION
   ↓ Visible in "📋 Finalizadas" mode (12-hour retention)

Note: "🌐 Todas" mode shows all conversations except those in "Aguardando" queue
```

#### Technical Implementation
- **Backend**: `getMonitorConversations()` returns all active + resolved (12h) conversations
- **Frontend**: Client-side filtering by tab logic in `Monitor.tsx`
- **Real-time Updates**: 5-second polling interval for conversation list, 3-second for alerts
- **Performance**: Optimized queries with pagination, last 10 messages cached per conversation

### System Design Choices
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Worker Concurrency**: Optimized for messages, images, and NPS workers.
- **API Key Management**: Robust handling of multi-instance Evolution API keys.

## OpenAI Assistant Tool Configuration

**NEW TOOL PENDING REGISTRATION**: The `selecionar_ponto_instalacao` tool is implemented in code but needs to be registered with the OpenAI Assistants via the OpenAI dashboard or API.

**Tool Definition for Registration**:
```json
{
  "type": "function",
  "function": {
    "name": "selecionar_ponto_instalacao",
    "description": "Registra qual ponto de instalação (endereço) o cliente está reportando problema técnico. Use quando o cliente tiver múltiplos pontos de instalação e confirmar qual deles tem o problema.",
    "parameters": {
      "type": "object",
      "properties": {
        "numeroPonto": {
          "type": "number",
          "description": "Número do ponto de instalação escolhido pelo cliente (1, 2, 3, etc). Corresponde ao número mostrado na lista de endereços apresentada ao cliente."
        }
      },
      "required": ["numeroPonto"]
    }
  }
}
```

**Registration Steps**:
1. Access OpenAI Platform → Assistants → Select assistant (Suporte, Apresentação, etc.)
2. In "Tools" section, click "Add Tool" → "Function"
3. Paste the JSON definition above
4. Save changes
5. Test with a customer that has multiple installation points (e.g., CPF 10441834701)

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