# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service. It leverages OpenAI's Assistants API and a RAG knowledge base to automate Q&A and actions through specialized AI assistants. Key features include a real-time supervisor monitoring dashboard and an autonomous continuous learning system. The platform's primary goal is to enhance customer service efficiency and satisfaction for telecommunications operations through a robust, scalable, and intelligent AI solution.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS. The design draws inspiration from Carbon Design System and Linear, offering both dark and light modes. `Wouter` handles client-side routing.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management.
**Backend**: Developed with Node.js and Express.js (TypeScript), incorporating GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: BullMQ with Redis TLS manages asynchronous processing, ensuring message delivery with retries and webhooks.
**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API orchestrates six specialized AI roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) using a "Receptionist-First" routing model.
- **RAG Architecture**: A dual-layer prompt system separates System and RAG Prompts, powered by Upstash Vector, with specific RAG systems for equipment returns and sales documentation.
- **Function Calling**: Custom functions enable verification, knowledge queries, invoice lookups, scheduling, and sales operations.
- **Automated Systems**: Includes document detection, "Boleto Consultation," "PPPoE Connection Status," "Unlock/Unblock," HTTP Resilience, GPT-4o Vision for image analysis, PDF text extraction, and OpenAI Whisper for audio transcription. Video messages are displayed within chat with HTML5 player support.
- **Conversation Intelligence**: Real-time analysis of sentiment, urgency, and problem identification, alongside automatic persistence of CPF/CNPJ.
**Real-Time Monitoring**: A Supervisor Dashboard provides KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System, including sub-filters for conversation resolution types.
**Continuous Learning System**: An autonomous GPT-4 agent suggests prompt improvements based on feedback.
**NPS & Customer Satisfaction**: Automated NPS surveys via WhatsApp with feedback integrated into the learning system.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API supports real-time messaging, AI routing, outbound messaging, a triple-fallback message delivery system, and WhatsApp Groups Management with individual AI control and multimedia support. A critical architectural decision ensures conversation consistency by prioritizing `conversation.evolutionInstance`.
**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync, enabling "New Contact" creation and "Conversation Reopen" while preserving the original `evolutionInstance`.
**Message Deletion System**: Supervisors/admins can soft-delete assistant messages.
**Redis Optimization System**: Intelligent caching, batching, and hash storage.
**Message Batching System**: Atomic Redis-based debouncing groups sequential client messages into single AI requests (3-second window), excluding media.
**Private Notes System**: Internal collaboration feature for agents.
**Conversation Verification System**: Supervisor workflow to mark conversations as reviewed, resetting on new client messages.
**Activity Logs & Audit System**: Comprehensive audit trail of user actions with a dual-tab interface and real-time KPI dashboard.
**Conversational Sales System**: An autonomous AI system for lead qualification, plan presentation, data collection, and sales processing via WhatsApp, following a structured 5-step data collection process. It includes a robust 4-layer backend coverage verification system and two distinct functions (`registrar_lead_sem_cobertura` for no coverage, `enviar_cadastro_venda` for coverage). The system integrates with a Plans database, Sales table, dedicated RAG, and AI tools (`consultar_planos`, `enviar_cadastro_venda`, `buscar_cep`, `registrar_lead_sem_cobertura`).
**Sales Management Interface**: An ADMIN/SUPERVISOR-only dashboard at `/vendas` provides KPIs, status filters, a sales table, detailed views, and status update functionality.
**Plans Management System**: A complete CRUD interface for managing TR Telecom service plans within the `/vendas` section, accessible only by ADMIN/SUPERVISOR. It supports plan creation, editing, deletion, active status toggling, and integrates with the conversational sales system.
**Multiple Points Detection System**: Automatic detection of customers with multiple internet installations (points) using the field NOME pattern (1, 2, 3, 4... prefix). When `consultar_boleto_cliente` returns bills from multiple addresses, the system automatically groups them by point, calculates totals per point (bill count, overdue count, total value), and presents a clear selection interface to the customer before showing detailed bill information.

### Recent Fixes (2025-10-21)
- **CANCELAMENTO - RECONHECIMENTO DE PALAVRAS-CHAVE**: Aplicada melhoria do sistema de Learning (score 90%, 10+ ocorrências). Adicionado reconhecimento explícito de palavras-chave de cancelamento no assistente de Cancelamento: "cancelar", "cancelamento", "mudar de operadora", "multa", "quero sair", "encerrar contrato". Também melhorado o roteamento do assistente Apresentação para incluir todas essas variações. Isso resolve o problema onde clientes solicitando cancelamento recebiam respostas genéricas ou eram roteados incorretamente.

### Recent Fixes (2025-10-20)
- **FINANCEIRO DESBLOQUEIO FIX**: Fixed critical bug where `solicitarDesbloqueio` function was failing with "função não implementada" error despite being fully implemented. Issue: OpenAI calls function in camelCase (`solicitarDesbloqueio`) but switch case in `ai-tools.ts` only had snake_case (`solicitar_desbloqueio`). Added camelCase variant to switch case. Also added "religamento" (reconnection) as keyword synonym since desbloqueio and religamento are the same operation. Updated instructions with keywords: "religamento", "religar", "reativar".
- **IP BLOQUEADO = PROBLEMA FINANCEIRO**: Fixed critical routing issue where Support assistant was treating IP blockage as technical problem instead of financial (payment) issue. When `verificar_conexao` returns `statusIP: "BLOQUEADO"`, this indicates unpaid bills/delinquency, NOT a technical fault. Updated Support assistant instructions to immediately transfer to FINANCEIRO department when IP blockage is detected, instead of requesting modem light checks or offering technical support transfer. Also updated Presentation (receptionist) assistant keywords to include "IP bloqueado" and "religamento" as financial routing triggers.
- **AUTO-CLOSE CONVERSATIONS ON FAREWELL**: Fixed critical UX issue where conversations remained open indefinitely after customers said goodbye. Problem: Only FINANCEIRO assistant had farewell detection rules; SUPORTE, COMERCIAL, and APRESENTAÇÃO assistants would continue trying to help even after customer said "obrigado", "ok", "já me atenderam", etc. Solution: Added comprehensive farewell detection rules to all three assistants with clear guidelines on when to call `finalizar_conversa()`. Each assistant now recognizes farewell keywords ("obrigado/a", "valeu", "blz", "já me atenderam", "já resolveram", etc.) and automatically finalizes conversations when appropriate, while avoiding premature closure during data collection. APRESENTAÇÃO assistant now correctly distinguishes between "ok" as farewell (after routing) vs. "ok" as confirmation (during need identification).
- **FUNCTION CALLING FIX**: Resolved critical bug where assistants were writing function calls as text in messages to customers (e.g., "[use rotear_para_assistente com assistantType='financeiro', motivo='...']") instead of executing them via OpenAI Function Calling API. Root cause: Instructions contained JavaScript/TypeScript/JSON syntax examples (function names with parentheses, parameter objects with braces, etc.) that confused assistants into mimicking code syntax. Solution: (1) Systematically removed ALL literal function syntax from INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md across all 6 assistants - replaced with narrative descriptions, (2) Added explicit "REGRA CRÍTICA - FUNCTION CALLING" section with clear CORRECT vs INCORRECT examples, (3) Converted all 12 function definitions from `**function_name(params):**` to `**function_name:**` with narrative parameter descriptions, (4) Created CHECKLIST_VERIFICACAO_FUNCOES_OPENAI.md with complete configuration guide for OpenAI Dashboard including proper JSON schemas for manual setup. Backend (server/ai-tools.ts) was already correct - issue was purely instructional. Assistants must now EXECUTE functions via Function Calling, never write them as text.
- **ADMIN DASHBOARD MODERNIZATION**: Replaced two charts in the admin dashboard for better operational insights:
  1. **Daily Messages Chart**: Replaced "Uso de Tokens OpenAI" with "Quantidade de Mensagens Diárias" showing last 30 days message volume. Created `getDailyMessagesCount()` method querying messages table (excludes private/deleted). Green AreaChart (#10b981).
  2. **Volume vs Success Chart**: Replaced "Atividade Recente do Sistema" with "Volume de Conversas vs. Taxa de Sucesso da IA (Últimas 24h)" showing hourly conversation volume and AI resolution rate. Uses `calculateVolumeVsSuccess()` method returning hourly data. Dual-axis BarChart with blue bars (#3b82f6) for volume (left axis) and green bars (#10b981) for success rate percentage (right axis, 0-100%). Updated `getAdminMetrics()` interface to return `dailyMessages` and `volumeVsSuccess` arrays instead of `tokenUsage` and `recentActivity`.

### System Design Choices
- **Conversation Prioritization**: Color-coded wait time indicators.
- **Admin Tools**: Mass-closing abandoned conversations, reprocessing stuck messages, configuration management.
- **Image Handling**: Supervisors can download WhatsApp images.
- **Worker Concurrency**: Optimized for messages, images, and NPS workers.
- **Ouvidoria Details Modal**: Enhanced UI for complaint descriptions.
- **API Key Management**: Robust handling of multi-instance Evolution API keys.
- **Private Notes UI**: Dialog interface with StickyNote icon.
- **New Contact Creation**: "Novo" button to create contacts and manual conversations, moved to "Transferidas" or "Atribuídas".
- **Conversation Reopen**: "Reabrir Conversa" button moves conversation to "Transferidas" queue.
- **Conversation Verification UI**: Green CheckCircle2 icon on verified conversations.
- **Activity Logs UI**: Dual-tab interface (Agentes/Supervisão) with KPI cards.
- **Monitor Resolved Conversations Sub-Filters**: "Finalizadas" tab with sub-filters for AI, agent, or auto-closed resolutions.
- **WhatsApp Groups Chat Interface**: Dual-tab system (Chat/Informações) for group messaging with auto-refresh, pagination, and AI toggle.
- **Sales Management UI**: "/vendas" page with KPI cards, status filters, sales table, detail dialogs, and status update dialogs. ShoppingBag icon in sidebar (ADMIN/SUPERVISOR only).
- **Plans Management UI**: "/vendas" page with tabs interface (Vendas | Planos e Serviços). Plans tab features create/edit dialogs with comprehensive form fields, price formatting (R$ display), active/inactive badge toggles, and data table with edit/toggle actions. ID field auto-hidden during creation, displayed (disabled) during editing.

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