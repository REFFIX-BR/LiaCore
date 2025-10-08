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

**Backend**:
- **Runtime**: Node.js with Express.js, written in TypeScript.
- **API Design**: RESTful API endpoints under `/api`.
- **Core Modules**: Intelligent routing of messages using GPT-5, OpenAI Assistants API integration, Upstash Vector for RAG, and Upstash Redis for conversation thread storage.
- **Session Management**: OpenAI thread-based conversations with 7-day expiry, stored in Redis.
- **Data Persistence**: PostgreSQL via Drizzle ORM for permanent data.

**AI & Knowledge Management**:
- **AI Provider**: OpenAI (Assistants API for specialized assistants, GPT-5 for routing).
- **Specialized Assistants**: Six assistants configured for specific roles (Support, Sales, Finance, Cancellation, Ombudsman, Presentation), each with detailed instructions, WhatsApp-friendly formatting, and domain-specific function calling. All assistants are configured for "text" response format.
- **Routing Logic**: GPT-5 based intent classification using conversation summaries and recent messages.
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