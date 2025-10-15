# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service. It orchestrates specialized AI assistants using OpenAI's Assistants API and a RAG knowledge base to automate Q&A and actions like boleto consultation and PPPoE diagnosis. The platform features a real-time supervisor monitoring dashboard for human intervention and an autonomous continuous learning system that evolves AI assistant prompts. Its core purpose is to enhance customer service efficiency and satisfaction, providing a robust, scalable, and intelligent AI solution for telecommunications.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (2025-10-15)

**✅ IMPLEMENTED: Chat Layout Optimization + Bold Text Formatting**
- Feature: Layout reorganizado para maximizar área de digitação - textarea ocupa largura total com botão enviar à direita
- Attachment buttons: Ícones de anexo (negrito, imagem, áudio, PDF) movidos para linha horizontal abaixo do textarea
- Bold formatting: Botão de formatação em negrito usando sintaxe WhatsApp (`*texto*`) com suporte a seleção de texto no textarea
- User experience: Mais espaço para conversas e ferramentas de formatação integradas
- Location: `client/src/components/ChatPanel.tsx` (handleBoldText function, layout structure)

**✅ IMPLEMENTED: WhatsApp Chat ID Display + Copy Functionality**
- Feature: Cabeçalho do chat exibe o ID completo do WhatsApp ao lado do nome (ex: whatsapp_5524993054210)
- Copy functionality: Botão para copiar ID completo para área de transferência
- Location: `client/src/components/ChatHeader.tsx`, `client/src/components/ChatPanel.tsx`

**✅ IMPLEMENTED: Assigned User Name Display (Optimized)**
- Feature: Badge "Atribuído" agora exibe "Atribuído por [Nome]" para identificação fácil do agente responsável
- Backend: Endpoint `/api/conversations/assigned` enriquecido com campo `assignedToName` contendo primeiro nome do usuário
- Performance: Implementado método `getUsersByIds` para busca em lote (elimina N+1 query pattern)
- Frontend: Badge exibe "Atribuído por João" ao invés de apenas "Atribuído" para facilitar verificação visual
- Fallback: Se nome não disponível, exibe apenas "Atribuído"
- Location: `server/routes.ts` (lines 4703-4717), `server/storage.ts` (getUsersByIds method), `client/src/pages/Conversations.tsx` (line 258)

**✅ IMPLEMENTED: Last Client Message Display + Real-time Sorting**
- Feature: Conversas Transferidas/Atribuídas agora exibem a última mensagem do cliente (ao invés de "Transferência manual: .")
- Backend enhancement: Endpoints `/api/conversations/transferred` e `/api/conversations/assigned` enriquecem resposta com última mensagem do usuário
- Real-time sorting: Conversas com mensagens novas aparecem automaticamente no topo (atualização a cada 5 segundos)
- Implementation: Busca últimas 20 mensagens, filtra por role='user', ordena por timestamp DESC
- Location: `server/routes.ts` (lines 4648-4662, 4699-4712)

**✅ IMPLEMENTED: Admin Mass-Close Abandoned Conversations + NPS (Enhanced)**
- Feature: Endpoint POST `/api/admin/close-abandoned-conversations` fecha conversas de TODOS os status (active, waiting, assigned, etc.)
- Enhanced: Anteriormente fechava apenas status "active", agora fecha qualquer status exceto "resolved" e transferidas para humano
- UI: Botão "Fechar Conversas Abandonadas (+30min) + Enviar NPS" no Admin Dashboard
- Use case: Permite fechar conversas travadas de ouvidoria e outros status intermediários que não conseguem ser finalizadas normalmente
- Metadata: Usa SQL JSONB merge (|| operator) para preservar campos existentes e adicionar npsSent, npsScheduledAt
- Location: `server/routes.ts` (lines 3044-3145), `client/src/components/dashboards/AdminDashboard.tsx`

**✅ IMPLEMENTED: Message Editing & Deletion System**
- **Edit Feature**: Supervisores e admins podem editar mensagens do assistente através de botão de edição (ícone de lápis)
  - Backend: Endpoint PUT `/api/messages/:id` permite editar conteúdo de mensagens do assistente (role='assistant')
  - Important: Edição é feita APENAS no banco de dados LIA CORTEX - mensagem original permanece inalterada no WhatsApp do cliente
  - Reason: Evolution API não suporta edição nativa de mensagens
  - User Flow: Click edit → conteúdo carregado no textarea → modificar texto → salvar → mensagem atualizada no sistema
- **Delete Feature**: Supervisores e admins podem excluir mensagens do assistente através de botão de exclusão (ícone de lixeira)
  - Backend: Endpoint DELETE `/api/messages/:id` deleta mensagem do banco e do WhatsApp (quando possível)
  - User Flow: Click delete → confirmação → mensagem removida do sistema e do WhatsApp
- **Permissions**: Apenas ADMIN, SUPERVISOR ou agente atribuído à conversa pode editar/deletar mensagens
- **UI Components**: Botões de edição e exclusão visíveis em ChatMessage, indicador visual "Editando mensagem" no ChatPanel, botão cancelar edição
- Location: `server/routes.ts` (PUT/DELETE /api/messages/:id), `client/src/components/ChatPanel.tsx`, `client/src/components/ChatMessage.tsx`

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS. Its design is inspired by Carbon Design System and Linear for data-dense enterprise interfaces, supporting both dark and light modes. `Wouter` is used for client-side routing.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management across various dashboards and functional pages.

**Backend**: Developed with Node.js and Express.js (TypeScript). It leverages GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM for data persistence.

**Queue System**: Employs BullMQ with Redis TLS for asynchronous processing across multiple queues (e.g., message-processing, AI-response, image-analysis, NPS-survey, learning-tasks, auto-closure). It ensures message delivery with retries, webhook fallbacks, and uses Redis-based distributed locks to prevent concurrency issues. A two-stage automatic conversation closure system manages inactive conversations.

**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API.
- **Specialized Assistants**: Six roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) operating with a "Receptionist-First" routing model.
- **RAG Architecture**: Features a dual-layer prompt system separating System Prompts from RAG Prompts using Upstash Vector for semantic search.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, and scheduling, with secure internal-only tool execution.
- **Automated Systems**: Includes automated document detection (CPF/CNPJ), "Boleto Consultation", "PPPoE Connection Status", and "Unlock/Unblock" systems with integrated security. An HTTP Resilience System centralizes retry logic for external API calls.
- **Vision System**: GPT-4o Vision for automatic WhatsApp image analysis, supporting multiple image formats (PNG, JPEG, GIF, WebP).
- **PDF Text Extraction System**: Extracts text from PDF documents for AI analysis.
- **Audio Processing System**: Transcribes WhatsApp audio messages via OpenAI Whisper API.
- **Conversation Intelligence System**: Provides real-time analysis of sentiment, urgency, and technical problems, with automatic persistence of CPF/CNPJ.

**Real-Time Monitoring**: The Supervisor Dashboard offers KPIs, live conversation queues, alerts, transcripts, human intervention controls, and a Live Logs System.

**Continuous Learning System**: An autonomous GPT-4 agent suggests prompt improvements based on supervisor feedback.

**NPS & Customer Satisfaction**: Automated NPS surveys via WhatsApp post-conversation, with feedback integrated into the learning system.

**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with real-time counters, AI-assisted agent responses, and automatic conversation closure after extended inactivity.

**WhatsApp Integration**: Native integration with Evolution API for real-time messaging, AI routing, and outbound messaging, supporting multi-instance operations with dynamic API key lookup.

**Role-Based Access Control (RBAC)**: A 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.

**Contact Management System**: Centralized client database for conversation history and proactive service, with automatic WhatsApp contact synchronization.

**Message Deletion System**: Allows supervisors and agents to delete assistant messages.

**Redis Optimization System**: Implements intelligent caching, batching, and hash storage to reduce Redis requests and costs.

### System Design Choices
- **Conversation Prioritization**: Color-coded wait time indicators (Green, Yellow, Red) and sorting by timestamp enable supervisors to quickly identify urgent conversations.
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and managing system configurations.
- **Image Handling**: Supervisors can download WhatsApp images directly from the chat interface, with smart detection of image formats.
- **Worker Concurrency**: Optimized worker configuration (20 message workers, 8 image workers, 8 NPS workers) to improve processing speed and handle higher message volumes efficiently.
- **Ouvidoria Details Modal**: Enhanced UI for viewing complete complaint descriptions.
- **API Key Management**: Robust handling of multi-instance Evolution API keys, including case sensitivity fixes.

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