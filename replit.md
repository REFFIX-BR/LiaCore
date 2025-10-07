# LIA CORTEX - AI Orchestration Platform

## Overview

LIA CORTEX is an enterprise-grade AI middleware orchestration platform designed for TR Telecom customer service operations. The system acts as an intelligent router and coordinator that manages multiple specialized AI assistants (Support, Sales, Technical, Financial, etc.) powered by OpenAI's Assistants API. It integrates a RAG (Retrieval-Augmented Generation) knowledge base using Upstash Vector for dynamic document-based responses, enabling assistants to both perform actions through structured APIs and answer open-ended questions from company documentation.

The platform includes a real-time supervisor monitoring dashboard that provides complete visibility into all customer interactions, allowing human supervisors to track sentiment, detect issues, and intervene when necessary.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Components**: shadcn/ui component library based on Radix UI primitives with Tailwind CSS for styling

**Design System**: Custom design guidelines inspired by Carbon Design System and Linear's interface patterns, optimized for enterprise data-dense interfaces with both dark mode (primary) and light mode support

**State Management**: TanStack Query (React Query) for server state management and data fetching with 5-second polling intervals for real-time updates

**Routing**: Wouter for lightweight client-side routing

**Key Pages**:
- Dashboard: Overview metrics and system status
- Monitor: Real-time supervisor dashboard with conversation tracking
- Test Chat: Development tool for testing chat flows
- Conversations: Chat interface with message history
- Knowledge: RAG knowledge base management

### Backend Architecture

**Runtime**: Node.js with Express.js server

**Language**: TypeScript with ES modules

**API Design**: RESTful API endpoints under `/api` namespace

**Core Modules**:
- **Router Module** (`server/lib/openai.ts`): Analyzes incoming messages using GPT-5 to route to appropriate specialized assistant (Support, Commercial, Financial, Presentation, Ombudsman, Cancellation)
- **OpenAI Integration**: Manages threads and message exchanges with OpenAI Assistants API
- **Upstash Integration**: Handles vector search for RAG knowledge base and Redis for conversation thread storage

**Session Management**: OpenAI thread-based conversations with 7-day expiry stored in Redis

**Storage Layer**: In-memory storage implementation (`MemStorage`) with interface design (`IStorage`) ready for database migration

### Database & Data Storage

**Primary Database**: PostgreSQL (via Neon serverless) - schema defined but not yet fully connected

**ORM**: Drizzle ORM for type-safe database operations

**Schema Entities**:
- Users: Authentication and supervisor accounts
- Conversations: Chat metadata, sentiment, urgency, assistant routing
- Messages: Complete message history with function calls
- Alerts: Critical issues requiring supervisor attention
- Supervisor Actions: Audit trail of human interventions

**Vector Database**: Upstash Vector for semantic search in knowledge base

**Cache Layer**: Upstash Redis for session data and conversation threads

### AI & Knowledge Management

**AI Provider**: OpenAI with separate assistant IDs for each specialized role

**Routing Logic**: GPT-5 based intent classification to select appropriate assistant

**RAG Implementation**:
- Knowledge chunks stored in Upstash Vector with embeddings
- Semantic search retrieves relevant context (top-K results)
- Assistants can call `consultar_base_de_conhecimento` function to access dynamic knowledge
- Supports both structured API calls (e.g., `verificar_conexao`) and unstructured document queries

**Function Calling**: Assistants equipped with custom functions for:
- Connection verification
- Knowledge base queries
- Invoice lookups
- Visit scheduling

### Real-Time Monitoring

**Supervisor Dashboard Features**:
- KPI metrics (active conversations, response time, sentiment, resolution rate)
- Live conversation queue with urgency/sentiment indicators
- Critical alerts (negative sentiment, AI loops, function failures)
- Conversation details with full transcript and AI analysis
- Human intervention controls (pause AI, transfer to human, add notes)

**Update Mechanism**: Client-side polling with React Query at 3-5 second intervals for different data types

## External Dependencies

**Third-Party Services**:
- **OpenAI**: Assistants API for conversational AI and GPT-5 for routing
- **Upstash Vector**: Serverless vector database for RAG knowledge embeddings
- **Upstash Redis**: Serverless Redis for session and thread storage
- **Neon Database**: Serverless PostgreSQL for persistent data storage

**Key NPM Packages**:
- `@radix-ui/*`: Headless UI component primitives
- `@tanstack/react-query`: Server state management
- `drizzle-orm`: Type-safe database ORM
- `express`: Web server framework
- `react-hook-form` + `zod`: Form handling and validation
- `date-fns`: Date formatting and manipulation
- `tailwindcss`: Utility-first CSS framework

**Development Tools**:
- Vite with React plugin for fast development
- TypeScript for type safety
- ESLint and Prettier (implied by setup)
- Replit-specific plugins for development environment integration