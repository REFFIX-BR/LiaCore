# 📘 LIA CORTEX - Documentação Técnica Completa

## Arquitetura de Sistema

### Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         CAMADA DE APRESENTAÇÃO                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Dashboard  │  │   Dashboard  │  │  Gerenciador │          │
│  │  Supervisor  │  │    Agente    │  │  de Prompts  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  React + TypeScript + Vite + TailwindCSS + shadcn/ui            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CAMADA DE APLICAÇÃO                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  API Router  │  │  Middleware  │  │ Auth Service │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Node.js + Express + TypeScript                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│  ORQUESTRADOR IA │  │  PROCESSADOR │  │   WORKERS    │
│                  │  │  MENSAGENS   │  │  ASSÍNCRONOS │
│  GPT-4o Router   │  │              │  │              │
│  Context Manager │  │  BullMQ      │  │  13 Filas    │
└──────────────────┘  └──────────────┘  └──────────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CAMADA DE SERVIÇOS                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   7 IAs      │  │  Knowledge   │  │   CRM/ERP    │          │
│  │ Especializadas│  │     Base     │  │  Integration │          │
│  │              │  │              │  │              │          │
│  │  OpenAI API  │  │ Upstash Vec  │  │  REST APIs   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│    DATABASE      │  │    CACHE     │  │   STORAGE    │
│                  │  │              │  │              │
│  PostgreSQL 15+  │  │  Redis 7.x   │  │  Upstash Vec │
│  (Neon)          │  │  (Upstash)   │  │  (RAG)       │
└──────────────────┘  └──────────────┘  └──────────────┘
```

---

## Modelo de Dados

### Entidades Principais

#### 1. Conversations (Conversas)
```typescript
{
  id: UUID,
  chatId: string, // whatsapp_5511999887766
  clientName: string,
  clientId: string,
  clientDocument: string, // CPF/CNPJ
  threadId: string, // OpenAI thread
  assistantType: string, // cortex, suporte, financeiro...
  status: string, // active, transferred, resolved
  sentiment: string, // positive, neutral, negative
  urgency: string, // normal, high, critical
  transferredToHuman: boolean,
  assignedTo: UUID | null,
  conversationSource: string, // inbound, voice_campaign, whatsapp_campaign
  evolutionInstance: string, // Principal, Leads, Cobranca
  metadata: JSON,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 2. Messages (Mensagens)
```typescript
{
  id: UUID,
  conversationId: UUID,
  role: string, // user, assistant
  content: text,
  assistant: string | null,
  imageBase64: text | null,
  pdfBase64: text | null,
  audioUrl: text | null,
  whatsappMessageId: string | null,
  isPrivate: boolean,
  timestamp: timestamp
}
```

#### 3. Voice Promises (Promessas de Pagamento)
```typescript
{
  id: UUID,
  campaignId: UUID,
  targetId: UUID | null,
  contactName: string,
  contactDocument: string, // CPF/CNPJ
  phoneNumber: string,
  promisedAmount: integer, // centavos
  dueDate: timestamp, // DD/MM/YYYY 23:59:59
  paymentMethod: string, // pix, boleto, cartao
  status: string, // pending, reminderSent, fulfilled, broken
  reminderSent: boolean,
  reminderSentAt: timestamp | null,
  verified: boolean,
  verifiedAt: timestamp | null,
  notes: text | null,
  recordedBy: string, // 'ai' ou user_id
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 4. Users (Usuários)
```typescript
{
  id: UUID,
  username: string unique,
  password: string, // bcrypt hashed
  fullName: string,
  email: string | null,
  role: string, // ADMIN, SUPERVISOR, AGENT
  status: string, // ACTIVE, INACTIVE
  departments: string[], // commercial, support, financial...
  participatesInGamification: boolean,
  lastLoginAt: timestamp | null,
  createdAt: timestamp
}
```

#### 5. Voice Campaigns (Campanhas de Cobrança)
```typescript
{
  id: UUID,
  name: string,
  description: text | null,
  status: string, // draft, active, paused, completed
  contactMethod: string, // voice, whatsapp_primary, whatsapp_fallback
  allowedMethods: string[], // ['voice', 'whatsapp']
  fallbackOrder: string[], // ordem de fallback
  scheduleStart: string, // "08:00"
  scheduleEnd: string, // "20:00"
  maxAttempts: integer,
  createdBy: UUID,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## Sistema de Filas (BullMQ)

### Filas Ativas

| Fila | Propósito | Concurrency | Rate Limit |
|------|-----------|-------------|------------|
| `message-processing` | Processar mensagens recebidas | 20 | 50 jobs/s |
| `ai-response` | Gerar respostas da IA | 10 | 30 jobs/s |
| `image-analysis` | Analisar imagens (GPT-4o Vision) | 8 | 10 jobs/s |
| `nps-survey` | Enviar pesquisas NPS | 8 | 20 jobs/s |
| `learning-tasks` | Aprendizado contínuo | 2 | 5 jobs/s |
| `inactivity-followup` | Follow-up de inatividade (10min) | 2 | 10 jobs/s |
| `auto-closure` | Fechamento automático (30min) | 2 | 10 jobs/s |
| `voice-campaign-ingest` | Importar targets de campanha | 5 | - |
| `voice-scheduling` | Agendar contatos | 10 | - |
| `voice-dialer` | Executar chamadas (Twilio) | 20 | - |
| `voice-post-call` | Processar resultados | 10 | - |
| `voice-promise-monitor` | Monitorar promessas | 1 | - |
| `voice-whatsapp-collection` | Enviar WhatsApp cobrança | 10 | - |

### Workers Autônomos

#### 1. Message Processing Worker
```typescript
// Processa mensagens recebidas do WhatsApp
async function processMessage(job) {
  const { conversationId, message, hasImage } = job.data;
  
  // 1. Buscar conversa e histórico
  const conversation = await storage.getConversation(conversationId);
  const messages = await storage.getMessages(conversationId);
  
  // 2. Análise de imagem (se houver)
  if (hasImage) {
    const analysis = await analyzeImageWithVision(imageBase64);
    message = `[Imagem] ${analysis}`;
  }
  
  // 3. Detectar CPF/CNPJ e salvar
  await persistClientDocument(conversationId, message);
  
  // 4. Enfileirar para IA responder
  await aiResponseQueue.add('generate-response', {
    conversationId,
    userMessage: message
  });
}
```

#### 2. AI Response Worker
```typescript
// Gera resposta da IA usando OpenAI Assistants API
async function generateAIResponse(job) {
  const { conversationId, userMessage } = job.data;
  
  // 1. Buscar conversa
  const conversation = await storage.getConversation(conversationId);
  
  // 2. Adicionar mensagem ao thread OpenAI
  await addMessageToThread(conversation.threadId, userMessage);
  
  // 3. Executar assistant
  const run = await runAssistant(
    conversation.threadId,
    getAssistantId(conversation.assistantType)
  );
  
  // 4. Processar function calls (se houver)
  if (run.required_action) {
    await handleFunctionCalls(run, conversation);
  }
  
  // 5. Obter resposta
  const response = await getAssistantResponse(conversation.threadId);
  
  // 6. Salvar e enviar
  await storage.createMessage({
    conversationId,
    role: 'assistant',
    content: response
  });
  
  await sendWhatsAppMessage(conversation.clientId, response);
  
  // 7. Agendar follow-up de inatividade
  await inactivityQueue.add('check-inactivity', {
    conversationId
  }, { delay: 10 * 60 * 1000 }); // 10 minutos
}
```

#### 3. Promise Monitor Worker
```typescript
// Monitora promessas de pagamento (executa a cada 1 hora)
async function monitorPromises() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // PARTE 1: Enviar lembretes (promessas vencendo HOJE)
  const promisesDueToday = await db.query.voicePromises.findMany({
    where: and(
      eq(voicePromises.status, 'pending'),
      gte(voicePromises.dueDate, today),
      lt(voicePromises.dueDate, addDays(today, 1)),
      eq(voicePromises.reminderSent, false)
    )
  });
  
  for (const promise of promisesDueToday) {
    await sendWhatsAppReminder(promise);
    await markReminderSent(promise.id);
  }
  
  // PARTE 2: Verificar promessas vencidas
  const expiredPromises = await db.query.voicePromises.findMany({
    where: and(
      inArray(voicePromises.status, ['pending', 'reminderSent']),
      lt(voicePromises.dueDate, today),
      eq(voicePromises.verified, false)
    )
  });
  
  for (const promise of expiredPromises) {
    // Verificar pagamento via CRM
    const isPaid = await checkPaymentInCRM(promise.contactDocument);
    
    if (isPaid) {
      await markPromiseFulfilled(promise.id);
    } else {
      await markPromiseBroken(promise.id);
    }
  }
}
```

---

## Function Calling (Ferramentas da IA)

### Ferramentas Disponíveis por Assistente

#### 🔧 Suporte Técnico

##### 1. `verificar_conexao()`
```json
{
  "name": "verificar_conexao",
  "description": "Verifica status da conexão do cliente (PPPoE, ONT, bloqueios, falhas massivas)",
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

**Exemplo de retorno:**
```json
{
  "status": "offline",
  "bloqueado": true,
  "motivo_bloqueio": "Inadimplência",
  "status_pppoe": "Desconectado",
  "status_ont": "Online",
  "falha_massiva": {
    "ativa": true,
    "cidade": "Chiador/MG",
    "afetados": 127
  }
}
```

##### 2. `consultar_base_de_conhecimento(pergunta: string)`
```json
{
  "name": "consultar_base_de_conhecimento",
  "description": "Consulta base de conhecimento técnico usando busca semântica",
  "parameters": {
    "type": "object",
    "properties": {
      "pergunta": {
        "type": "string",
        "description": "Pergunta ou termo de busca"
      }
    },
    "required": ["pergunta"]
  }
}
```

##### 3. `desbloquear_cliente()`
Desbloqueia cliente por inadimplência (apenas se pagamento confirmado).

##### 4. `abrir_ticket_crm(resumo, departamento, motivo)`
Cria ticket no CRM para follow-up humano.

##### 5. `consultar_status_os(numero_os: string)`
Consulta andamento de ordem de serviço técnica.

---

#### 💰 Financeiro

##### 1. `consultar_faturas()`
Lista faturas em aberto e vencidas do cliente.

##### 2. `gerar_segunda_via(mes, ano)`
Gera 2ª via de boleto.

##### 3. `consultar_pix_cobranca()`
Retorna chave PIX para pagamento.

##### 4. `consultar_planos()`
Lista planos disponíveis para upgrade.

---

#### 📞 Cobrança

##### 1. `consultar_faturas_cpf(cpf_cnpj: string)`
```json
{
  "name": "consultar_faturas_cpf",
  "description": "Consulta faturas em aberto usando CPF/CNPJ via API do CRM",
  "parameters": {
    "type": "object",
    "properties": {
      "cpf_cnpj": {
        "type": "string",
        "description": "CPF ou CNPJ do cliente (apenas números)"
      }
    },
    "required": ["cpf_cnpj"]
  }
}
```

**Retorno:**
```json
{
  "cliente": "João Silva",
  "cpf_cnpj": "123.456.789-00",
  "total_devido": 179.80,
  "faturas_em_aberto": 2,
  "detalhes_faturas": [
    {
      "numero": "FAT-2024-12-001",
      "valor": 89.90,
      "vencimento": "2024-12-10",
      "dias_atraso": 45
    }
  ]
}
```

##### 2. `registrar_promessa_pagamento(cpf_cnpj, data_prevista, valor, metodo, observacoes?)`
```json
{
  "name": "registrar_promessa_pagamento",
  "description": "Registra promessa de pagamento. Cliente NÃO receberá mais cobranças até a data prometida.",
  "parameters": {
    "type": "object",
    "properties": {
      "cpf_cnpj": {"type": "string"},
      "data_prevista_pagamento": {"type": "string", "description": "DD/MM/YYYY"},
      "valor_prometido": {"type": "number"},
      "metodo_pagamento": {
        "type": "string",
        "enum": ["pix", "boleto", "cartao_credito", "debito_automatico", "outros"]
      },
      "observacoes": {"type": "string"}
    },
    "required": ["cpf_cnpj", "data_prevista_pagamento", "valor_prometido"]
  }
}
```

**Validações:**
- ✅ Cliente só pode ter UMA promessa ativa
- ✅ Data deve ser futura
- ✅ Valor deve ser positivo
- ✅ CPF/CNPJ validado

##### 3. `atualizar_status_cobranca(cpf_cnpj, novo_status, observacoes?)`
Atualiza status quando cliente informa pagamento.

---

#### 🛒 Comercial

##### 1. `consultar_disponibilidade_tecnica(cep: string)`
Verifica se endereço tem cobertura.

##### 2. `consultar_planos_disponiveis()`
Lista planos e promoções vigentes.

##### 3. `registrar_venda_completa(...)`
Registra venda com todos os dados (CPF, endereço, plano, etc.).

##### 4. `selecionar_ponto_instalacao()`
Quando cliente tem múltiplos endereços, permite selecionar qual quer contratar.

---

### Ferramentas Universais (Todos os Assistentes)

#### 1. `rotear_para_assistente(assistantType, motivo)`
```json
{
  "name": "rotear_para_assistente",
  "description": "Roteia conversa para outro assistente de IA especializado",
  "parameters": {
    "type": "object",
    "properties": {
      "assistantType": {
        "type": "string",
        "enum": ["apresentacao", "comercial", "financeiro", "suporte", "ouvidoria", "cancelamento", "cobranca"]
      },
      "motivo": {"type": "string"}
    },
    "required": ["assistantType", "motivo"]
  }
}
```

**Importante**: Preserva TODO o contexto da conversa.

#### 2. `transferir_para_humano(departamento, motivo)`
Transfere para atendente humano quando:
- Cliente solicita explicitamente
- Problema técnico complexo
- Insatisfação/reclamação grave

---

## Segurança e Autenticação

### Sistema de Auth

#### Sessões
```typescript
// Express Session + PostgreSQL
{
  store: new ConnectPgSimple({
    pool: db,
    tableName: 'sessions'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
  }
}
```

#### RBAC (Role-Based Access Control)

| Role | Permissões |
|------|------------|
| **ADMIN** | Acesso total, gerenciar usuários, configurações, prompts |
| **SUPERVISOR** | Monitorar todas conversas, atribuir, intervir, relatórios |
| **AGENT** | Atender conversas atribuídas, transferir, resolver |

### Middleware de Proteção

```typescript
// Verificar autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

// Verificar role
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };
}

// Uso
app.get('/api/admin/users', requireAuth, requireRole('ADMIN'), getUsers);
```

### Secrets Management

**Variáveis de Ambiente Críticas:**
```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_CORTEX_ASSISTANT_ID=asst_...
OPENAI_SUPORTE_ASSISTANT_ID=asst_...
# (+ 6 assistants)

# Evolution API
EVOLUTION_API_KEY=...
EVOLUTION_API_URL=https://...

# Twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+55...

# Database
DATABASE_URL=postgresql://...

# Redis
UPSTASH_REDIS_URL=...

# Session
SESSION_SECRET=... (256-bit random)
```

---

## Performance e Otimização

### Caching Strategy

#### 1. Redis Cache
```typescript
// Cache de métricas do admin (60s)
const cacheKey = `admin_metrics_${date}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const metrics = await calculateMetrics();
await redis.setex(cacheKey, 60, JSON.stringify(metrics));
```

#### 2. Query Optimization
```sql
-- Índices críticos
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_promises_status_due ON voice_promises(status, due_date);
```

#### 3. Connection Pooling
```typescript
// PostgreSQL (Neon)
{
  min: 5,
  max: 20,
  idleTimeoutMillis: 30000
}
```

### Rate Limiting

```typescript
// Por IP
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15min
  max: 1000 // requests
}));

// Por usuário autenticado
app.use('/api/chat', rateLimit({
  windowMs: 1 * 60 * 1000, // 1min
  max: 60, // 60 mensagens/min
  keyGenerator: (req) => req.session.userId
}));
```

---

## Monitoramento e Logs

### Logging Structure

```typescript
// Production Logger
prodLogger.info('webhook', 'Mensagem recebida', {
  instance: 'Principal',
  phoneNumber: '5511999887766',
  messageType: 'text'
});

prodLogger.error('ai_response', 'Falha ao gerar resposta', {
  conversationId: '...',
  error: err.message,
  stack: err.stack
});
```

### Métricas Coletadas

- ✅ Total de conversas (ativas, resolvidas, transferidas)
- ✅ Tempo médio de atendimento (TMA)
- ✅ Taxa de resolução IA vs Humano
- ✅ NPS em tempo real
- ✅ Performance por assistente
- ✅ Latência de APIs externas (OpenAI, Evolution, CRM)
- ✅ Uso de recursos (CPU, RAM, Queue depth)

---

## Deployment

### Replit Deployment (Atual)

```bash
# Build frontend
npm run build

# Start server
npm run dev # development
npm start # production
```

**Características:**
- ✅ Auto-scaling
- ✅ Zero-downtime deploys
- ✅ Built-in SSL
- ✅ Environment secrets management

### Docker (Opcional - White-Label)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

### Backup Strategy

**PostgreSQL (Neon):**
- Backup automático a cada 24h
- Retention: 7 dias (grátis), 30 dias (pago)
- Point-in-time recovery

**Redis (Upstash):**
- AOF persistence enabled
- Snapshot a cada 1h

---

## Troubleshooting

### Problemas Comuns

#### 1. IA não responde

**Sintomas:** Cliente envia mensagem, nada acontece  
**Causas possíveis:**
- Thread OpenAI não existe
- API key inválida/expirada
- Rate limit atingido
- Worker queue travado

**Solução:**
```bash
# Verificar logs
tail -f server.log | grep ERROR

# Restart workers
pkill -f "tsx server/index.ts" && npm run dev

# Verificar OpenAI status
curl https://status.openai.com/api/v2/status.json
```

#### 2. WhatsApp não envia mensagens

**Sintomas:** IA gera resposta mas não chega no WhatsApp  
**Causas possíveis:**
- Evolution API offline
- Instância desconectada
- Número bloqueado pelo WhatsApp

**Solução:**
```bash
# Verificar conexão Evolution
curl -H "apikey: $EVOLUTION_API_KEY" \
  https://evolutionapi.trtelecom.net/instance/connectionState/Principal

# Reconectar instância (via Evolution UI)
```

#### 3. Promessas não sendo monitoradas

**Sintomas:** Cliente fez promessa mas recebe cobrança mesmo assim  
**Causas possíveis:**
- Worker `promise-monitor` não está rodando
- Promessa com status incorreto
- Data formatada errada

**Solução:**
```sql
-- Verificar promessas
SELECT * FROM voice_promises 
WHERE status = 'pending' 
AND due_date >= CURRENT_DATE 
ORDER BY due_date;

-- Forçar execução do worker (via BullMQ board)
```

---

## Glossário Técnico

| Termo | Significado |
|-------|-------------|
| **Assistant** | IA especializada (OpenAI Assistants API) |
| **Thread** | Histórico de conversa no OpenAI |
| **Run** | Execução de um assistant sobre um thread |
| **Function Calling** | Ferramentas que a IA pode chamar (APIs, DBs, etc.) |
| **RAG** | Retrieval-Augmented Generation (busca + IA) |
| **Embedding** | Representação vetorial de texto para busca semântica |
| **Worker** | Processo assíncrono que executa tarefas em background |
| **Queue** | Fila de jobs para processamento assíncrono |
| **Evolution API** | Gateway para WhatsApp Business |
| **Target** | Cliente em campanha de cobrança |
| **Promise** | Compromisso de pagamento registrado |

---

**Última atualização:** 09/11/2025  
**Versão:** 2.0.0  
**Mantenedor:** TR Telecom Development Team
