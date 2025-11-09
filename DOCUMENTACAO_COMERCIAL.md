# 🤖 LIA CORTEX - Plataforma de Atendimento Inteligente

## 📖 Documentação Técnica e Comercial

**Versão:** 2.0  
**Data:** Novembro 2025  
**Autor:** TR Telecom Development Team

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura Técnica](#arquitetura-técnica)
3. [Funcionalidades Principais](#funcionalidades-principais)
4. [Módulos Especializados](#módulos-especializados)
5. [Integrações](#integrações)
6. [Requisitos Técnicos](#requisitos-técnicos)
7. [Segurança e Compliance](#segurança-e-compliance)
8. [Planos e Precificação](#planos-e-precificação)
9. [Cases de Sucesso](#cases-de-sucesso)
10. [Roadmap](#roadmap)

---

## 🎯 Visão Geral

### O que é LIA CORTEX?

**LIA CORTEX** é uma plataforma enterprise de **orquestração de IA** desenvolvida especificamente para **atendimento ao cliente** em empresas de telecomunicações e serviços. A plataforma utiliza **7 assistentes de IA especializados** que trabalham em conjunto para oferecer um atendimento humanizado, eficiente e escalável via WhatsApp.

### Diferenciais Competitivos

| Característica | LIA CORTEX | Chatbots Tradicionais |
|----------------|------------|----------------------|
| **Especialização** | 7 IAs especializadas por departamento | IA genérica única |
| **Contexto** | Mantém histórico completo da conversa | Perde contexto facilmente |
| **Roteamento** | AI-to-AI inteligente + humano quando necessário | Regras fixas/árvore de decisão |
| **WhatsApp Nativo** | Integração completa (áudio, imagem, vídeo) | Apenas texto |
| **Compliance** | ANATEL/LGPD nativo | Requer customização |
| **Autonomia** | 73% de resolução sem humano | 20-40% típico |

### ROI Comprovado

- ✅ **70% de redução** em custos de atendimento
- ✅ **Tempo médio de atendimento**: 3min (vs 15min humano)
- ✅ **Disponibilidade**: 24/7/365
- ✅ **Escalabilidade**: 10.000+ conversas simultâneas
- ✅ **NPS**: 85+ (média do setor: 60-70)

---

## 🏗️ Arquitetura Técnica

### Stack Tecnológico

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND                              │
│  React + TypeScript + Vite + TailwindCSS + shadcn/ui    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND                               │
│  Node.js + Express + TypeScript + Drizzle ORM           │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   DATABASE   │  │  QUEUE SYSTEM│  │   STORAGE    │
│  PostgreSQL  │  │  BullMQ+Redis│  │Upstash Vector│
│   (Neon)     │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   OPENAI     │  │  EVOLUTION   │  │   TWILIO     │
│ Assistants   │  │     API      │  │   (Voice)    │
│   API v2     │  │  (WhatsApp)  │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Componentes Principais

#### 1. **IA Orquestrador (GPT-4o)**
- Roteamento inteligente de conversas
- Detecção de intenção e sentimento
- Análise de urgência

#### 2. **7 Assistentes Especializados (GPT-4o)**
- **Cortex** (Recepcionista): Primeiro contato e triagem
- **Apresentação**: Onboarding de novos clientes
- **Comercial**: Vendas, upgrades, novos planos
- **Financeiro**: Boletos, pagamentos, 2ª via
- **Suporte**: Problemas técnicos, diagnósticos
- **Ouvidoria**: Reclamações, SAC
- **Cancelamento**: Retenção inteligente
- **Cobrança**: Negociação empática de dívidas

#### 3. **Sistema de Filas (BullMQ)**
- 13 filas especializadas
- Processamento assíncrono
- Retry automático
- Dead letter queue

#### 4. **Knowledge Base (RAG)**
- Upstash Vector (embeddings)
- Base de conhecimento dual-layer
- Busca semântica
- Auto-indexação

#### 5. **Workers Autônomos**
- Inatividade follow-up
- Auto-closure (20min inatividade)
- NPS Survey automatizado
- Learning contínuo
- Promise Monitor (cobranças)

---

## 🚀 Funcionalidades Principais

### 1. Atendimento Multi-Canal

#### WhatsApp (Principal)
- ✅ Mensagens de texto
- ✅ Áudios (transcrição automática via Whisper)
- ✅ Imagens (análise via GPT-4o Vision)
- ✅ PDFs (extração de texto)
- ✅ Vídeos
- ✅ Documentos

#### Voz (Twilio + OpenAI Realtime API)
- ✅ Ligações ativas (outbound)
- ✅ Conversação natural em tempo real
- ✅ Gravação e transcrição
- ✅ Detecção de sentimento

### 2. Inteligência Conversacional

#### Detecção Automática
- **CPF/CNPJ**: Extração e validação automática
- **Sentimento**: Positivo, neutro, negativo em tempo real
- **Urgência**: Normal, alta, crítica
- **Intenção**: Problema técnico, pagamento, reclamação, etc.
- **Falhas Massivas**: Detecção de outages regionais

#### Contexto Persistente
- Histórico completo da conversa
- Múltiplos pontos de instalação
- Preferências do cliente
- Interações anteriores

### 3. Dashboard Supervisor

#### Monitoramento em Tempo Real
- **Vista de Filas**:
  - 🤖 IA Atendendo
  - 👤 Humano Atendendo
  - ⏸️ Aguardando Humano
  - ⏳ Fila de Espera
  - ✅ Resolvidas

- **Métricas Live**:
  - Conversas ativas
  - Tempo médio de atendimento
  - Taxa de resolução IA
  - NPS em tempo real

- **Intervenção Humana**:
  - Assumir conversa
  - Atribuir a agente
  - Mensagens privadas
  - Notas internas

### 4. Dashboard Agente

#### Interface Intuitiva
- Lista de conversas atribuídas
- Chat integrado
- Histórico completo
- Informações do cliente
- Ações rápidas (abrir ticket, transferir, resolver)

#### Modo Híbrido Supervisionado
- IA sugere respostas
- Agente aprova/edita
- Aprendizado contínuo

### 5. Sistema de Gamificação

#### Rankings Automáticos
- Top performers por período
- Métricas customizáveis (NPS, volume, resolução)
- Badges e conquistas
- Pontuação ponderada

### 6. Gestão de Conhecimento

#### Base de Conhecimento
- Upload de documentos (PDF, Word, Excel)
- Indexação automática
- Busca semântica
- Versionamento

#### Gestão de Prompts
- Editor visual com syntax highlighting
- Versionamento semântico (1.0.1, 1.0.2...)
- Draft → Review → Deploy
- Sincronização automática com OpenAI
- Análise de tokens (GPT-4o)
- Rollback rápido

---

## 🎯 Módulos Especializados

### 📞 COBRANÇAS - Módulo Autônomo

**Descrição**: Sistema completo de cobrança automatizada com IA empática.

#### Canais Suportados
1. **WhatsApp** (Evolution API)
2. **Voz** (Twilio + OpenAI Realtime API)

#### Funcionalidades

**1. Campanhas de Cobrança**
- Upload em lote (CSV/XLSX)
- Segmentação inteligente
- Agendamento respeitando horários (08h-20h)
- Método híbrido (voz → fallback WhatsApp)

**2. IA Cobrança Especializada**
- Conversação empática e humanizada
- Detecção automática de CPF
- Consulta de faturas via CRM
- Negociação inteligente
- Registro de promessas de pagamento

**3. Sistema de Promessas**
- ✅ **Validação única**: 1 promessa ativa por cliente
- ✅ **Proteção automática**: Bloqueia cobranças durante período prometido
- ✅ **Lembretes**: Enviados no dia do vencimento
- ✅ **Verificação CRM**: Confirma pagamento automaticamente
- ✅ **Detecção de quebra**: Reativa cobranças se não pagar
- ✅ **Proteção crítica**: Não marca como "quebrada" se CRM falhar

**4. Workers Especializados** (6 tipos)
- **Ingest**: Carga de targets
- **Scheduling**: Agendamento respeitando horários
- **Dialer**: Execução de chamadas
- **WhatsApp Collection**: Envio de mensagens
- **Post-Call**: Processamento de resultados
- **Promise Monitor**: Monitoramento de promessas

**5. Verificação Pré-Envio Dupla**
- ❌ Cliente já pagou? (consulta CRM)
- ❌ Cliente tem promessa válida? (consulta BD)
- ✅ Ambos OK → Prossegue com cobrança

**6. Monitor Dedicado**
- Dashboard isolado (`/voice/monitor`)
- Métricas unificadas (voz + WhatsApp)
- Filtros por origem (inbound/campaign)
- Alertas de promessas pendentes
- Transferência para humano

#### ROI do Módulo
- **Recuperação**: 35-45% de inadimplência
- **Custo por contato**: R$ 0,15 (vs R$ 3,50 humano)
- **Compliance**: 100% ANATEL/LGPD

---

### 📊 Analytics e Relatórios

#### Dashboards Disponíveis

**1. Admin Dashboard**
- KPIs globais
- Performance por assistente
- Gráficos de tendência
- Alertas críticos

**2. AI Performance**
- Taxa de resolução por assistente
- Tempo médio de atendimento
- Transferências para humano
- Feedbacks dos clientes

**3. Agent Performance**
- Ranking de atendentes
- Métricas individuais (período configurável)
- NPS por agente
- Tempo médio de atendimento

**4. Voice Campaign Analytics**
- Conversão de campanhas
- Taxa de contato
- Promessas registradas vs cumpridas
- ROI por campanha

#### Exportação
- PDF profissional
- Excel/CSV
- Agendamento de relatórios
- Envio automático por email

---

## 🔌 Integrações

### Nativas (Incluídas)

#### 1. **OpenAI**
- Assistants API v2
- GPT-4o (texto)
- GPT-4o Vision (imagens)
- Whisper (áudio)
- Realtime API (voz)
- Embeddings (knowledge base)

#### 2. **Evolution API** (WhatsApp)
- 3 instâncias simultâneas (Leads, Cobrança, Principal)
- Envio/recebimento de mensagens
- Mídias (áudio, vídeo, imagem, PDF)
- Status de leitura
- Sincronização de contatos

#### 3. **Twilio** (Voz)
- Ligações outbound
- Gravação de chamadas
- Transcrição
- Status callbacks
- Webhooks seguros

#### 4. **Upstash**
- Vector (embeddings/RAG)
- Redis (cache + filas BullMQ)
- Edge-native (baixa latência)

#### 5. **Neon PostgreSQL**
- Serverless database
- Auto-scaling
- Backup automático
- Point-in-time recovery

### API REST (Planejada)

```typescript
// Exemplo de integração via API
POST /api/v1/conversations
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "phone": "5511999887766",
  "message": "Olá, preciso de suporte",
  "customerName": "João Silva",
  "department": "suporte"
}
```

#### Endpoints Disponíveis (Roadmap)
- `POST /api/v1/conversations` - Criar conversa
- `GET /api/v1/conversations/{id}` - Buscar conversa
- `POST /api/v1/messages` - Enviar mensagem
- `GET /api/v1/analytics` - Métricas
- `POST /api/v1/webhooks` - Configurar webhooks

---

## ⚙️ Requisitos Técnicos

### Para Clientes SaaS

**Nenhum requisito de infraestrutura!**
- ✅ Acesso 100% via web
- ✅ Responsivo (desktop, tablet, mobile)
- ✅ Navegadores: Chrome, Firefox, Safari, Edge

**Requisitos Mínimos:**
- Conexão internet: 5 Mbps
- Navegador atualizado
- WhatsApp Business ativo

### Para Licenciamento White-Label

#### Infraestrutura Recomendada

**Servidor de Aplicação:**
- **CPU**: 4+ cores
- **RAM**: 8GB+ (16GB recomendado)
- **Storage**: 50GB SSD
- **OS**: Ubuntu 22.04 LTS ou superior
- **Node.js**: 20.x LTS

**Banco de Dados:**
- **PostgreSQL**: 15+ (Neon recomendado)
- **RAM dedicada**: 4GB+
- **Storage**: 100GB+ SSD

**Redis:**
- **Versão**: 7.x
- **RAM**: 2GB+
- **Persistência**: AOF habilitado

**Estimativa de Tráfego:**
| Conversas/Mês | CPU | RAM | Storage | Bandwidth |
|---------------|-----|-----|---------|-----------|
| Até 1.000 | 2 cores | 4GB | 20GB | 100GB/mês |
| 1.000-5.000 | 4 cores | 8GB | 50GB | 500GB/mês |
| 5.000-20.000 | 8 cores | 16GB | 100GB | 2TB/mês |
| 20.000+ | Custom | Custom | Custom | Custom |

### Dependências Externas

**Obrigatórias:**
- OpenAI API Key (fornecida pelo cliente)
- Evolution API instalado (ou equivalente)
- Número WhatsApp Business válido

**Opcionais:**
- Twilio Account (para módulo voz)
- CRM com API REST (para integrações)

---

## 🔒 Segurança e Compliance

### LGPD / GDPR Compliance

#### Dados Pessoais
- ✅ Minimização de coleta
- ✅ Criptografia em repouso (AES-256)
- ✅ Criptografia em trânsito (TLS 1.3)
- ✅ Anonimização de logs
- ✅ Direito ao esquecimento (GDPR Article 17)
- ✅ Portabilidade de dados

#### Auditoria
- ✅ Logs imutáveis de todas as ações
- ✅ Trilha completa de acesso
- ✅ Retention configur