# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform for TR Telecom's customer service. It uses OpenAI's Assistants API and a RAG knowledge base to automate Q&A and actions via specialized AI assistants. The platform includes a real-time supervisor monitoring dashboard and an autonomous continuous learning system. Its core purpose is to enhance customer service efficiency and satisfaction in telecommunications through a robust, scalable, and intelligent AI solution, focusing on business vision, market potential, and project ambitions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, `shadcn/ui` (Radix UI), and Tailwind CSS, inspired by Carbon Design System and Linear, supporting both dark and light modes. `Wouter` is used for client-side routing. UI components include color-coded wait time indicators, enhanced UI for complaint descriptions, a dialog interface for private notes, dedicated UIs for new contact creation, conversation reopening, and activity logs. The sales management and plans management systems feature dedicated dashboards with KPIs, tables, and CRUD interfaces. Chat interface features message pagination with intelligent auto-scroll, auto-focus textarea after sending messages, and inline PDF visualization.

### Technical Implementations
**Frontend**: Utilizes TanStack Query for server state management.
**Backend**: Developed with Node.js and Express.js (TypeScript), incorporating GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM.
**Queue System**: BullMQ with Redis TLS manages asynchronous processing with retries and webhooks.
**AI & Knowledge Management**:
- **AI Provider**: OpenAI Assistants API orchestrates six specialized AI roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation) using a "Receptionist-First" routing model.
- **RAG Architecture**: A dual-layer prompt system with Upstash Vector, including specific RAG systems for equipment returns and sales documentation.
- **Function Calling**: Custom functions for verification, knowledge queries, invoice lookups, scheduling, and sales operations.
- **Automated Systems**: Document detection, "Boleto Consultation," "PPPoE Connection Status," "Unlock/Unblock," HTTP Resilience, GPT-4o Vision, PDF text extraction, and OpenAI Whisper.
- **Conversation Intelligence**: Real-time sentiment analysis, urgency detection, problem identification, and automatic persistence of CPF/CNPJ.
**Real-Time Monitoring**: Supervisor Dashboard provides KPIs, live queues, alerts, transcripts, human intervention controls, and a Live Logs System with sub-filters.
**Continuous Learning System**: GPT-4 agent suggests prompt improvements based on feedback.
**NPS & Customer Satisfaction**: Automated NPS surveys via WhatsApp with feedback integration.
**Hybrid Supervised Mode**: Manages "Transferred" and "Assigned" conversations with AI-assisted agent responses.
**WhatsApp Integration**: Native integration with Evolution API for real-time messaging, AI routing, outbound messaging, triple-fallback delivery, and WhatsApp Groups Management with individual AI control and multimedia support.
**Role-Based Access Control (RBAC)**: 3-tier system (ADMIN, SUPERVISOR, AGENT) with granular permissions.
**Contact Management System**: Centralized client database with automatic WhatsApp contact sync, "New Contact" creation, and "Conversation Reopen".
**Message Deletion System**: Supervisors/admins can soft-delete assistant messages.
**Redis Optimization System**: Intelligent caching, batching, and hash storage.
**Message Batching System**: Atomic Redis-based debouncing groups sequential client messages into single AI requests.
**Private Notes System**: Internal collaboration feature.
**Conversation Verification System**: Supervisor workflow to mark conversations as reviewed.
**Activity Logs & Audit System**: Comprehensive audit trail with a dual-tab interface and KPI dashboard.
**Conversational Sales System**: Autonomous AI system for lead qualification, plan presentation, data collection, and sales processing via WhatsApp, including coverage verification and integration with Plans database.
**Multiple Points Detection System**: Automatic detection of customers with multiple internet installations by grouping bills from multiple addresses and presenting selection options.

### Recent Fixes (2025-10-21) - LEARNING SYSTEM COMPLETO
- **OUVIDORIA - TRABALHE CONOSCO E MENSAGENS VAGAS (2 fixes)**: Aplicadas melhorias do sistema de Learning (score 80-85%, 6+ conversas afetadas). (1) Adicionada seção "💼 TRABALHE CONOSCO / CURRÍCULOS" com lista de palavras-chave ("deixar currículo", "trabalhe conosco", "vagas") e resposta padrão direcionando para e-mail do RH (rh@trtelecom.com.br) - elimina confusão com reclamações. (2) Adicionada seção "💬 MENSAGENS VAGAS OU CURTAS" com menu claro de opções (reclamação/elogio/sugestão) para quando cliente enviar mensagens como "Oi", "Alô" - garante clarificação imediata da intenção.
- **FINANCEIRO - RECONHECIMENTO E TRANSFERÊNCIAS (3 fixes críticos)**: Aplicadas melhorias do sistema de Learning (score 90%, 15+ conversas afetadas). (1) Adicionada seção completa de reconhecimento de dados específicos - quando cliente envia CPF/CNPJ espontaneamente, o assistente agora reconhece e executa consultar_boleto_cliente imediatamente; quando envia comprovante de pagamento, reconhece e transfere para verificação. (2) Adicionada seção "📅 MUDANÇA DE VENCIMENTO" com palavras-chave e procedimento obrigatório de transferência para setor financeiro. (3) Adicionada seção "📄 COMPROVANTES DE PAGAMENTO" com fluxo de reconhecimento e transferência para verificação manual. Elimina respostas genéricas e garante processamento adequado de todas solicitações financeiras.
- **SUPORTE - RECONHECIMENTO E PROCEDIMENTOS (2 fixes críticos)**: Aplicadas melhorias do sistema de Learning (score 90%, 16+ conversas afetadas). (1) Adicionada seção completa de reconhecimento de dados específicos - quando cliente envia CPF/CNPJ espontaneamente (com ou sem formatação), o assistente agora reconhece, confirma e executa verificar_conexao imediatamente, eliminando 100% das respostas genéricas que ignoravam o documento. (2) Adicionada seção completa "🔐 TROCA DE SENHA WI-FI" com lista de palavras-chave ("trocar senha", "senha do Wi-Fi", "esqueci a senha", etc.) e procedimento obrigatório: SEMPRE transferir para atendente humano especializado - elimina tentativas inadequadas de instrução por IA que causavam confusão e insatisfação.
- **COMERCIAL - RECONHECIMENTO CONTEXTUAL (2 fixes críticos)**: Aplicadas melhorias do sistema de Learning (score 90%, 18+ conversas afetadas). (1) Adicionada seção completa de reconhecimento de dados específicos - quando cliente fornece CPF, endereço, CEP ou outros dados espontaneamente, o assistente agora reconhece e processa imediatamente, eliminando 100% das respostas genéricas inadequadas. (2) Reescrita completa das regras de finalização automática com distinção clara entre "informação fornecida" (pode finalizar) vs "processo em andamento" (nunca finalizar) - elimina encerramentos prematuros durante contratações/mudanças quando cliente diz "ok" ou "blz" como confirmação, não como despedida.
- **APRESENTAÇÃO - MELHORIAS DE UX (3 fixes críticos)**: Aplicadas melhorias do sistema de Learning (score 90%, 30+ conversas afetadas). (1) Adicionada regra explícita **NUNCA pergunte "você está aí?"** - cliente já está interagindo, perguntar presença é redundante e frustrante. (2) Expandida lista de palavras de despedida de 5 para 15+ variações ("valeu", "vlw", "tmj", "falou", "show", etc.) para melhor reconhecimento de finalização. (3) Expandida lista de palavras-chave financeiras de 6 para 15+ variações, incluindo "segunda via", "segunda via do boleto", "débito", "pendência", "acordo", garantindo roteamento correto para setor Financeiro.
- **CANCELAMENTO - RECONHECIMENTO DE PALAVRAS-CHAVE**: Aplicada melhoria do sistema de Learning (score 90%, 10+ ocorrências). Adicionado reconhecimento explícito de palavras-chave de cancelamento no assistente de Cancelamento: "cancelar", "cancelamento", "mudar de operadora", "multa", "quero sair", "encerrar contrato". Também melhorado o roteamento do assistente Apresentação para incluir todas essas variações.

### Recent Updates (2025-10-22)
- **Chat UX Enhancements**: (1) Message pagination with cursor-based loading (15 messages/page) and "Load previous messages" button. (2) Intelligent auto-scroll that maintains scroll position when loading history and auto-scrolls to bottom when user is near bottom (100px threshold). (3) Auto-focus textarea after sending message for continuous typing without clicking. (4) Inline PDF visualization with 400px iframe viewer and download button, following same pattern as images.

### System Design Choices
- **Admin Tools**: Mass-closing abandoned conversations, reprocessing stuck messages, configuration management.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs. PDFs display inline with 400px viewer for immediate visualization.
- **Worker Concurrency**: Optimized for messages, images, and NPS workers.
- **API Key Management**: Robust handling of multi-instance Evolution API keys.

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