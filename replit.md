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

**✅ IMPLEMENTED: Message Deletion System (Soft Delete with Visual Indicator)**
- **Delete Feature**: Supervisores e admins podem excluir mensagens do assistente através de botão de exclusão (ícone de lixeira)
  - Backend: Endpoint DELETE `/api/messages/:id` implementa soft delete - marca mensagem com `deletedAt` e `deletedBy` ao invés de remover do banco
  - WhatsApp Integration: Deleta mensagem do WhatsApp do cliente quando possível (via Evolution API)
  - User Flow: Click delete → mensagem deletada do WhatsApp → badge "🗑️ Mensagem excluída" aparece no sistema
  - Visual Indicator: Mensagens deletadas exibem badge vermelha "Mensagem excluída" mas mantêm conteúdo visível para auditoria
  - Permissions: Apenas ADMIN, SUPERVISOR ou agente atribuído à conversa pode deletar mensagens
  - Schema: Campos `deletedAt` (timestamp) e `deletedBy` (text) adicionados à tabela messages
- **Edit Feature Removed**: Sistema de edição de mensagens foi removido
  - Reason: Evolution API não suporta edição nativa - edição funcionava apenas no banco de dados, não atualizava WhatsApp do cliente
  - Decision: Funcionalidade removida por incompatibilidade com WhatsApp (mensagem editada só aparecia no sistema, não no WhatsApp)
  - Alternative: Agentes podem deletar mensagem incorreta e enviar nova mensagem correta
- **AI Suggestion Editing Preserved**: Edição de sugestões da IA antes de enviar continua funcional (diferente de editar mensagens já enviadas)
- Location: `shared/schema.ts` (deletedAt/deletedBy fields), `server/routes.ts` (DELETE /api/messages/:id), `client/src/components/ChatMessage.tsx` (deletion badge)

**✅ FIXED: Conversation Sorting & Agent Name Display (2025-10-15)**
- **Bug Fix 1 - Inverted Chat Update Logic**: Corrigido comportamento onde conversas iam ao topo quando ATENDENTE enviava mensagem
  - Problem: lastMessageTime atualizava incorretamente fazendo conversas subir quando assistente respondia
  - Solution: Atualização de lastMessageTime movida para webhook quando CLIENTE envia mensagem (fromMe=false)
  - Impact: Conversas agora aparecem no topo apenas quando cliente responde, facilitando identificação de mensagens novas dos clientes
  - Location: `server/routes.ts` (lines 1981-1986, webhook messages.upsert handler)
- **Bug Fix 2 - Agent Name Display**: Badge "Atribuído por [Nome]" já estava implementado corretamente, problema era cache do navegador
  - Backend: Endpoint `/api/conversations/assigned` já enriquecia resposta com assignedToName usando getUsersByIds em lote
  - Frontend: Badge já exibia "Atribuído por [Nome]" corretamente (ex: "Atribuído por Marcio")
  - Verified: Teste end-to-end confirmou 19 conversas com badges exibindo nomes corretos
  - Location: `server/routes.ts` (lines 4720-4734), `client/src/pages/Conversations.tsx` (line 255)

**✅ IMPLEMENTED: WhatsApp Groups Management System (2025-10-15)**
- **Feature**: Sistema completo de gerenciamento de grupos WhatsApp com controle individual de IA por grupo
- **Database Schema**: Tabela `groups` criada com campos: groupId (WhatsApp ID), name, avatar, aiEnabled, evolutionInstance, lastMessageTime, lastMessage, participantsCount, metadata
- **Automatic Import**: Webhook detecta mensagens de grupos (`@g.us`), importa grupos automaticamente com IA desativada por padrão
- **AI Toggle Control**: Supervisores e admins podem ativar/desativar IA individualmente por grupo via interface web
- **Webhook Integration**: Sistema verifica se `aiEnabled=true` antes de processar mensagens de grupo - grupos com IA desativada são ignorados
- **Frontend UI**: Página `/groups` com lista de grupos, filtros (Todos/IA Ativa/IA Inativa), painel de detalhes e toggle switch para IA
- **API Endpoints**: GET `/api/groups`, GET `/api/groups/:id`, PUT `/api/groups/:id/toggle-ai`
- **Visual Indicators**: Badges verde (IA ON) e cinza (IA OFF) para identificação rápida do status
- **Use Cases**: Permite ativar IA apenas em grupos específicos (ex: suporte, vendas) enquanto mantém outros grupos silenciosos (ex: grupos internos da empresa)
- Location: `shared/schema.ts` (groups table), `server/routes.ts` (webhook lines 1666-1745, endpoints lines 6284-6341), `server/storage.ts` (Groups methods), `client/src/pages/Groups.tsx`, `client/src/components/app-sidebar.tsx`

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