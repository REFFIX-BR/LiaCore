# LIA CORTEX - AI Orchestration Platform

## Overview

LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom's customer service operations. It functions as an intelligent router and coordinator for multiple specialized AI assistants, powered by OpenAI's Assistants API. The platform integrates a RAG (Retrieval-Augmented Generation) knowledge base using Upstash Vector, enabling assistants to dynamically answer open-ended questions from company documentation and perform actions via structured APIs.

Key features include a real-time supervisor monitoring dashboard for tracking customer interactions and facilitating human intervention, and a fully autonomous continuous learning system. This system evolves assistant prompts based on supervisor interventions and customer feedback, aiming for continuous improvement and adaptation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend is built with React and TypeScript using Vite, leveraging `shadcn/ui` (based on Radix UI) and Tailwind CSS. The design system is inspired by Carbon Design System and Linear's interface, optimized for enterprise data-dense interfaces with dark and light mode support. Client-side routing is handled by Wouter.

### Technical Implementations

**Frontend**:
- **State Management**: TanStack Query for server state management with 5-second polling.
- **Key Pages**: Dashboard, Monitor, Test Chat, Conversations, Knowledge, Assistants, Agent Evolution, Metrics, Feedbacks NPS, Settings.
- **Header Controls**: Theme toggle (light/dark mode) and logout button with accessible tooltip, positioned in top-right header area.

**Backend**:
- **Runtime**: Node.js with Express.js, written in TypeScript.
- **API Design**: RESTful API endpoints under `/api`.
- **Core Modules**: Intelligent routing of messages using GPT-5, OpenAI Assistants API integration, Upstash Vector for RAG, and Upstash Redis for conversation thread storage.
- **Session Management**: OpenAI thread-based conversations with 7-day expiry, stored in Redis.
- **Data Persistence**: PostgreSQL via Drizzle ORM for permanent data.

**AI & Knowledge Management**:
- **AI Provider**: OpenAI (Assistants API for specialized assistants).
- **Specialized Assistants**: Six assistants configured for specific roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation), each with detailed instructions, WhatsApp-friendly formatting, and domain-specific function calling. All assistants are configured for "text" response format.
- **Receptionist-First Routing**: All new conversations start with LIA Recepcionista (APRESENTACAO_ASSISTANT_ID), who triages client needs and routes to the appropriate specialist using `transferir_para_humano`. The system automatically maps departments (Suporte Técnico, Comercial, Financeiro, Ouvidoria, Cancelamento) to their corresponding specialist assistants, updating the conversation's assistant type seamlessly without marking as transferred to human.
- **Automatic Conversation Summarization**: Asynchronous summarization every 12 messages, generating structured JSON summaries to maintain context.
- **RAG Implementation**: Knowledge chunks in Upstash Vector, accessible via `consultar_base_de_conhecimento` function.
- **Function Calling**: Custom functions for tasks like connection verification, knowledge base queries, invoice lookups, and visit scheduling.

**Real-Time Monitoring**:
- **Supervisor Dashboard**: Displays KPIs, live conversation queue with urgency/sentiment, alerts, transcripts, and human intervention controls.
- **Monitor Page**: Optimized for high-density display of concurrent conversations with a responsive grid layout and floating dialogs for conversation details.

**Continuous Learning System**:
- **Autonomous Learning**: GPT-4 powered analysis agent identifies patterns from supervisor interventions and feedback.
- **Feedback Collection**: Gathers implicit (resolved conversations, transfers) and explicit (supervisor corrections, NPS) feedback.
- **Prompt Evolution**: Supervisor-approved suggestions update OpenAI assistant instructions.

**NPS & Customer Satisfaction System**:
- **WhatsApp-based Feedback**: Automated NPS surveys sent to clients via WhatsApp upon conversation resolution.
- **Feedback Processing**: Extracts scores using flexible regex, saves to database with conversation linkage, and feeds detractors into the learning pipeline.
- **Feedbacks NPS Page**: Supervisors can view all NPS feedback linked to conversations, filter by category (Detratores 0-6, Neutros 7-8, Promotores 9-10), and click to open the related conversation for context. Includes visual indicators for missing conversations.

**Hybrid Supervised Mode (Conversations Tab)**:
- **Transferred Conversation Queue**: Manages conversations escalated to human supervisors.
- **AI-Assisted Responses**: Supervisors can request AI-generated response suggestions, which can be approved directly or edited, creating learning events.

**WhatsApp Integration**:
- **Evolution API**: Native integration for real-time WhatsApp message processing via webhooks.
- **Supported Events**: Handles `messages.upsert`, `chats.upsert`, and others for message and chat synchronization.
- **Message Processing**: Extracts text from various message types, identifies clients, routes to AI, manages threads, and generates responses.
- **Outbound Messaging**: AI responses are automatically sent back to WhatsApp via the Evolution API with a typing simulation delay.

**Role-Based Access Control (RBAC)**:
- **3-Tier System**: ADMIN (full access), SUPERVISOR (operational access), AGENT (restricted to assigned conversations).
- **User Management**: Complete CRUD interface at `/users` for ADMIN to invite, edit, activate/deactivate, and delete users. Includes email field, role assignment, and status toggle (ACTIVE/INACTIVE).
- **Granular Permissions**: Middleware system with `authenticate`, `requireAdmin`, `requireAdminOrSupervisor`, and `requireAnyRole` for flexible route protection.
- **Organized Navigation**: Sidebar with collapsible categories for better organization:
  - **Visão Geral**: Dashboard (all roles)
  - **Monitoramento**: Monitor Supervisor, Dashboard de Atendentes, Relatórios de Atendentes, Monitor Webhook (ADMIN/SUPERVISOR, webhook ADMIN-only)
  - **Conversas**: Test Chat, Conversas (all roles, Test Chat ADMIN/SUPERVISOR only)
  - **Conhecimento & IA**: Base de Conhecimento, Evolução dos Agentes, Assistentes (ADMIN/SUPERVISOR)
  - **Análises**: Métricas, Feedbacks NPS (ADMIN/SUPERVISOR)
  - **Administração**: Usuários (ADMIN only), Solicitações de Registro (ADMIN/SUPERVISOR), Configurações (ADMIN only)
- **Category State Persistence**: User's expanded/collapsed category preferences saved in localStorage and maintained across sessions.
- **Default Credentials**: admin/admin123 (change after first login for security).
- **Test Users**: supervisor/supervisor123, agent/agent123 available for testing different permission levels.

**User Registration System**:
- **Public Registration**: Self-service registration form on login page for new users to request access.
- **Approval Workflow**: All registration requests require admin/supervisor approval before user account creation.
- **Database Schema**: `registration_requests` table stores pending and processed requests with username, hashed password, full name, email, status, reviewer info, and timestamps.
- **Security Model**: Public endpoint ALWAYS forces `requestedRole = "AGENT"` regardless of client input to prevent privilege escalation. Admin/Supervisor roles can only be assigned through the Users management page by existing admins.
- **Management Interface**: `/registration-requests` page (accessible by ADMIN and SUPERVISOR) displays pending requests with approve/reject actions. Processed requests shown in historical table.
- **API Endpoints**: 
  - `POST /api/auth/register` (public) - Creates registration request with validated email/password
  - `GET /api/registration-requests` (admin/supervisor) - Lists all requests
  - `POST /api/registration-requests/:id/approve` (admin/supervisor) - Approves request and creates user
  - `POST /api/registration-requests/:id/reject` (admin/supervisor) - Rejects with reason
- **Navigation**: "Solicitações de Registro" menu item under Administração section (UserPlus icon), visible to ADMIN and SUPERVISOR.
- **Validation**: Email format and password length (min 6 characters) enforced on backend.

**Personalized Dashboards by Role**:
- **Agent Dashboard**: Personal KPIs (conversations in queue, finished today, personal TMA, personal NPS), sentiment trend chart (7 days), recent feedback list with scores.
- **Supervisor Dashboard**: Three tabs (Overview, AI Performance, Team). Overview tab shows global KPIs (active conversations, transfer queue, global TMA, global NPS), volume vs success chart (24h), and team status table with real-time metrics.
- **Admin Dashboard**: System KPIs (API/DB/worker status, estimated monthly costs, active users by role, security events), token usage chart (30 days), and recent system activity log.
- **Dashboard APIs**: Three protected endpoints (/api/dashboard/agent, /api/dashboard/supervisor, /api/dashboard/admin) with role-specific data aggregation and automatic refresh (30-60s intervals).

**Agent Reports System**:
- **Historical Analysis**: Temporal evolution tracking with flexible filtering (daily/weekly/monthly periods, custom date ranges).
- **Metrics Tracked**: Total conversations, success rate, average NPS, transfer count, sentiment analysis per period.
- **Visualization**: Recharts-powered line charts (evolution) and bar charts (performance), summary cards with key metrics.
- **Granular Filtering**: Period presets (7/15/30 days, 4/8/12 weeks, 3/6/12 months) or custom dates with configurable grouping (day/week/month).
- **Agent Selection**: View aggregated team data or filter by specific agent for individual performance tracking.
- **API Endpoints**: `/api/reports/agents` (historical data), `/api/agents/list` (agent roster for dropdowns), both accessible to ADMIN/SUPERVISOR.
- **Detailed Tables**: Period-by-period breakdown with all metrics for deep analysis.

## External Dependencies

**Third-Party Services**:
- **OpenAI**: Assistants API, GPT-5.
- **Upstash Vector**: Serverless vector database.
- **Upstash Redis**: Serverless Redis.
- **Neon Database**: Serverless PostgreSQL.
- **Evolution API**: WhatsApp integration.

**Key NPM Packages**:
- `@radix-ui/*`: Headless UI components.
- `@tanstack/react-query`: Server state management.
- `drizzle-orm`: Type-safe database ORM.
- `express`: Web server framework.
- `react-hook-form`, `zod`: Form handling and validation.
- `date-fns`: Date manipulation.
- `tailwindcss`: CSS framework.