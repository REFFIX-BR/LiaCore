# LIA CORTEX - AI Orchestration Platform

## Overview
LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed to automate Q&A and actions for TR Telecom's customer service. It leverages specialized AI assistants powered by OpenAI's Assistants API and a RAG knowledge base. The platform includes real-time supervisor monitoring and an autonomous continuous learning system, aiming to significantly enhance customer service efficiency and satisfaction within the telecommunications sector. Its business vision is to provide a scalable, intelligent, and cost-effective solution for managing customer interactions, improving agent productivity, and offering a superior customer experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Fixes
- **Gabriele Bernardes Case - FIXED**: IA Comercial agora reconhece cliente EXISTENTE consultando plano (ex: "qual meu plano?") e chama `consultar_plano_cliente(cpf)` via API em vez de oferecer novos planos. Elimina loops infinitos.
- **Commercial AI Optimized v2.0.1**: Adicionado suporte a consulta de planos existentes via API TR Telecom.
- **Flaviana Magalhaes Case - FIXED v1.1**: IA Suporte agora TRANSFERE para atendente humano quando cliente precisa de técnico, informando claramente "o atendente vai abrir a OS e um técnico virá". Expandido de 82 para 300+ linhas com: escala de urgência (24h+=URGENTE), casos especiais, perguntas diagnósticas, tratamento de frustrações.
- **Financial AI Optimized v1.1**: Reduzido de 444 para 310 linhas (removido redundâncias), adicionado escalas de urgência (24h+=URGENTE), casos especiais (contestação, débito antigo, divergência), perguntas diagnósticas, contexto detalhado em transferências, limite de desbloqueios (1/7 dias), tratamento de frustrações. Nota esperada 8.5/10.
- **Cobrança AI Optimized v1.1**: Reduzido de 411 para 260 linhas (removido redundâncias extremas), adicionado escalas de urgência (30+ dias=URGENTE), casos especiais (prescrição, divergência, revoltado), perguntas diagnósticas 1-por-1, limite de tentativas (1 promessa/15 dias), horários ANATEL obrigatório, tratamento de frustrações. Nota esperada 8.5/10.
- **Comercial AI Bug Fix v2.0.2**: CORRIGIDO - IA agora reconhece "mudança de endereço" como caso ESPECIAL (não nova venda), informa taxa R$80, transfere para humano com contexto "Mudança de endereço - agendamento necessário". Problema: Érica Silva Santos caso tratado como nova venda.
- **CPF Context Injector - CRITICAL FIX**: CORRIGIDO - IA pedia CPF que cliente já forneceu (whatsapp_5524992900220 e whatsapp_5524988447569). Solução: Novo sistema extrai CPF do histórico de mensagens e injeta no contexto ANTES da IA responder, evitando duplicate_data_request alerts. Implementado com Redis TTL APENAS para fluxos multi-ponto (LGPD compliance).
- **Suporte AI Anti-Hallucination Fix v1.1.2-1.1.4** (Dec 6, 2025): CORRIGIDO - IA ALUCINANDO em 3 padrões: (1) Renata (5524992950208): "atendente foi acionado" SEM transferência real; (2) Queli Cristina (5524992002134): "estou com dificuldade para consultar" SEM chamar API; (3) Juarez Teixeira (5524998442981): "vou confirmar se técnico vem hoje e retorno com a informação" - promessa vazia SEM função. Nova REGRA ANTI-ALUCINAÇÃO v1.1.4 proíbe TODAS as frases vazias: (1) Dizer ações sem executar (acionou/transferiu/encaminhou), (2) Promessas de "vou verificar e retorno" - DEVE transferir imediatamente, (3) "Estou com dificuldade/não consigo" - DEVE chamar função ou TRANSFERIR. REGRA OURO: Se não pode responder AGORA com função real → TRANSFIRA. Sincronizado com OpenAI Assistants API v1.1.4.
- **Reopened Conversation Thread Fix** (Dec 14, 2025): CORRIGIDO - Caso Marcos (whatsapp_5524992538204): Erro "Desculpe, ocorreu um erro ao processar sua mensagem" ao reabrir conversa fechada por inatividade. Causa: Sistema usava thread OpenAI antigo (expirado) em vez de criar novo. Solução: Ao reabrir conversa resolvida, sistema agora CRIA NOVO thread OpenAI, limpa o resumo anterior, e garante fresh start. Local: `server/routes.ts` linha ~1094-1108.
- **Boleto Lookup Race Condition Fix** (Dec 15, 2025): CORRIGIDO - Caso Mônica (whatsapp_553284468411): IA disse "não há boletos disponíveis" quando existia boleto ABERTO (R$91,71 venc 15/12). Causa: AI chamava `consultar_boleto_cliente` com argumentos vazios `{}`, e fallback de extração buscava CPF apenas no DB - mas a mensagem atual (contendo o CPF) ainda não estava salva. Solução: `handleToolCall` agora recebe `currentUserMessage` e extrai CPF da MENSAGEM ATUAL antes de buscar no histórico DB. Local: `server/lib/openai.ts` linhas 1320, 1047, 1527, 2555-2565.
- **Malformed Boleto Data Detection Fix** (Dec 15, 2025): CORRIGIDO - Caso Daniel (whatsapp_5524998371795): IA disse "não há boletos" mesmo quando API retornou 1 boleto. Causa: API TR Telecom retornou boleto com campos undefined (Vencimento: undefined, Valor: undefined). A IA interpretava dados vazios como "sem boletos". Solução: Novo sistema detecta boletos com dados incompletos (vencimento='Não disponível' E valor='0.00') e retorna status `DADOS_INCOMPLETOS` com instrução para IA informar cliente sobre instabilidade e oferecer transferência para humano. Local: `server/lib/openai.ts` linhas 2718-2750.

## System Architecture
### UI/UX Decisions
The frontend, built with React, TypeScript, Vite, `shadcn/ui`, and Tailwind CSS, draws inspiration from Carbon Design System and Linear, supporting both dark and light modes. Key features include color-coded wait times, enhanced complaint descriptions, private note dialogs, new contact creation, conversation reopening, and comprehensive activity logs. Dashboards provide KPIs and CRUD interfaces for sales and plans management. The chat interface supports message pagination, auto-scroll, auto-focus, and inline PDF viewing. The agent conversation interface offers flexible layout modes, with preferences persisted locally.

### Technical Implementations
The platform uses TanStack Query for frontend server state management. The backend, built with Node.js and Express.js (TypeScript), integrates GPT-5 for intelligent routing, OpenAI Assistants API, Upstash Vector for RAG, Upstash Redis for conversation threads, and PostgreSQL via Drizzle ORM. Asynchronous processing is managed by BullMQ with Redis TLS. A persistent message batching system combines sequential messages to reduce token costs and API calls.

A Thread Rotation System optimizes context windows for long conversations by rotating to new OpenAI threads with AI-generated summaries and critical message preservation.

AI and knowledge management orchestrate seven specialized AI assistants using a "Receptionist-First" routing model, supported by a dual-layer RAG architecture. Custom function calling enables verification, knowledge queries, invoice lookups, scheduling, sales operations, automated CRM ticket creation, service order status checks, payment promise registration, document persistence, and payment clearance verification. It handles flexible client identification, preserves full context during assistant routing, and supports AI-to-AI routing.

A Prompt Management System offers an AI-powered editor with version control, draft workflows, semantic versioning, GPT-4o analysis, real-time token counting, and automatic OpenAI Assistants API synchronization. A Context Quality Monitoring System provides automated real-time context monitoring with detectors for issues and offers AI-powered prompt correction suggestions. The commercial assistant (Lia Comercial) is optimized for direct, efficient sales conversations, presenting plans immediately and asking discovery questions only when requested.

Massive Failures dashboard metrics ("Notificações Enviadas" and "Clientes Notificados") now show real-time data from active failures only.

The platform includes a Gamification System for performance ranking and badges, a Supervisor Dashboard for real-time monitoring, KPIs, live queues, alerts, transcripts, human intervention controls, and live logs. An Agent Dashboard supports period-based filtering for performance metrics. A Continuous Learning System with a GPT-4 agent suggests prompt improvements.

A Fair Resolution Metrics System prevents agents from losing credit when conversations are reopened by tracking `first_resolved_by` and `first_resolved_at` in the database, integrated into gamification scores.

Hybrid Supervised Mode manages "Transferred" and "Assigned" conversations with AI-assisted agent responses. Native WhatsApp integration with Evolution API supports three WhatsApp instances with end-to-end routing. Role-Based Access Control (RBAC) is implemented with ADMIN, SUPERVISOR, and AGENT tiers. A centralized Contact Management System with automatic WhatsApp contact sync and an Announcements/Communications System are also present.

The COBRANÇAS - Autonomous Debt Collection Module is a WhatsApp-based system with a dedicated AI Cobrança assistant for debt negotiation, payment promise registration, and compliance, utilizing Meta-approved templates. It features dedicated monitoring, a Messaging Control Center for flexible contact method management, and campaign conversation tracking. It integrates with CRM for proactive debt collection, including configurable sync schedules, data transformation, smart deduplication, and error handling. A comprehensive phone normalization utility ensures canonical format for WhatsApp integration. A Selective Target Activation System allows bulk management of collection volumes.

Advanced features include an automatic retry and rate limiting system for WhatsApp messages using a Redis-based token bucket, and an enhanced idempotency architecture for BullMQ workers. Chat lock optimization reduces concurrency lock timeouts for faster message recovery. Full support for WhatsApp Business accounts is implemented, with a centralized `chatId` creation fix.

A Campaign Job Persistence System ensures automatic recovery of BullMQ campaign jobs after server restarts by re-enqueuing pending targets.

### System Design Choices
- **Chat Simulator (Test Chat)**: A professional tool for validating assistant behaviors, isolated from the production database.
- **Admin Tools**: Features for mass-closing abandoned conversations, reprocessing stuck messages, and configuration management.
- **System Health Dashboard**: Real-time monitoring for conversations without AI response, offering one-click reprocessing.
- **Media Handling**: Supervisors can download WhatsApp images and PDFs, with inline PDF viewing.
- **Security & Compliance**: LGPD/GDPR-compliant logging, protected debug endpoints, and structured error handling, including audit logging for cross-CPF operations.
- **Failure Detection**: Enhanced massive failure detection supporting city-wide outages and automatic client notification via WhatsApp.
- **Conversation Management**: Includes automatic reopening of resolved conversations, intelligent farewell detection with auto-resolution and NPS surveys, payment proof auto-resolution, and a comprehensive auto-closure system.
- **Thread ID Protection System**: Defensive persistence guards prevent conversation `threadId` from being overwritten.
- **Date/Time Awareness**: All new OpenAI threads automatically receive current date/time context in Brazilian Portuguese (pt-BR).
- **LID chatId Malformation Fix**: Includes migration scripts and architectural corrections to resolve and prevent malformed WhatsApp Business chatIds.
- **Message Recovery LID Bug Fix**: Fixes message delivery failures for WhatsApp Business accounts by correctly prioritizing `conversation.clientId`.
- **Multi-Point Installation Address Fix**: Correctly identifies installation addresses for customers with multiple points by using `/check_pppoe_status` API.
- **LGPD CPF Compliance**: **CRITICAL ARCHITECTURAL CHANGE** - CPF is no longer stored in the database. The system now requests CPF from the customer for each API query (e.g., for boleto) without persisting it, using Redis with 5-minute TTL for temporary storage during multi-point selection flows only.
- **Message Archiving System**: A two-table architecture automatically archives messages older than 30 days to `messages_archive` while remaining fully queryable, optimizing performance for the main `messages` table.

### Scalability & Performance
The roadmap targets handling 160,000 messages at peak with 15,000 concurrent conversations through queue optimization, worker scaling, database optimization, OpenAI optimization, multi-tier infrastructure, and extensive observability with Prometheus + Grafana. A comprehensive end-to-end latency tracking system measures response time across the message pipeline, with alerts for P95 latency exceeding 30 seconds.

## External Dependencies
- **OpenAI**: AI Assistants API.
- **Upstash Vector**: Serverless vector database.
- **Upstash Redis**: Serverless Redis.
- **Neon Database**: Serverless PostgreSQL.
- **Evolution API**: WhatsApp integration.