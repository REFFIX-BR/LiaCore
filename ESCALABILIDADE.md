# 📊 Plano de Escalabilidade LIA CORTEX

**Versão**: 1.0  
**Data**: Novembro 2025  
**Autor**: Equipe Técnica LIA CORTEX  
**Status**: Em Planejamento

---

## 📑 Índice

1. [Resumo Executivo](#resumo-executivo)
2. [Meta de Capacidade](#meta-de-capacidade)
3. [Análise da Capacidade Atual](#análise-da-capacidade-atual)
4. [Gargalos Identificados](#gargalos-identificados)
5. [Arquitetura de Escala Proposta](#arquitetura-de-escala-proposta)
6. [Estimativa de Custos](#estimativa-de-custos)
7. [Roadmap de Implementação](#roadmap-de-implementação)
8. [Observabilidade & Monitoring](#observabilidade--monitoring)
9. [Perguntas para Decisão](#perguntas-para-decisão)
10. [Próximos Passos](#próximos-passos)

---

## 🎯 Resumo Executivo

### Objetivo
Escalar a plataforma LIA CORTEX para suportar:
- **160.000 mensagens no pico**
- **15.000 conversas simultâneas**

### Investimentos Necessários

#### Técnicos
- 🔴 **Workers**: 12-16 pods escaláveis (vs. 1 atual)
- 🔴 **Redis**: Enterprise tier (vs. starter)
- 🔴 **PostgreSQL**: Scale plan com pooling (vs. basic)
- 🔴 **OpenAI**: Enterprise tier com rate limits aumentados

#### Financeiros
- 💰 **Curto prazo** (Fase 1-2): +$1,500-2,000/mês
- 💰 **Médio prazo** (Fase 3): +$3,000-4,500/mês
- 💰 **Longo prazo** (Fase 4): +$5,000-8,000/mês
- 💰 **OpenAI** (variável): $7,000-10,000/mês no pico

#### Timeline
- ⏱️ **3 meses**: Capacidade para 100-120 msg/s
- ⏱️ **6 meses**: Capacidade para 180-200 msg/s (meta alcançada)

#### ROI Esperado
- ✅ Suporta 3-4x mais clientes
- ✅ Reduz 80% dos gargalos atuais
- ✅ Melhora experiência do usuário (menor latência)
- ✅ Permite crescimento sustentável

---

## 🎯 Meta de Capacidade

### Requisitos de Performance

| Métrica | Valor Atual | Meta | Multiplicador |
|---------|-------------|------|---------------|
| **Mensagens/Pico** | ~10k-20k | 160.000 | 8-16x |
| **Conversas Simultâneas** | ~1k-2k | 15.000 | 7-15x |
| **Throughput** | ~50 msg/s | 180+ msg/s | 3.6x |
| **Latência P95** | ~2-3s | <1s | -50% |

### Definições

- **Pico**: Período de maior carga (assumido: 1 hora)
- **Conversas Simultâneas**: Conversas ativas com mensagens nos últimos 10 minutos
- **Throughput**: Mensagens processadas por segundo (end-to-end)
- **Latência P95**: 95% das mensagens processadas em menos de X segundos

---

## 📐 Análise da Capacidade Atual

### Cálculos de Throughput

#### Cenário: 160k mensagens/hora (conservador)

```
Pico necessário: 160.000 ÷ 3.600 = ~44 msg/s
Capacidade recomendada (margem 100%): ~90 msg/s
Capacidade atual: ~50 jobs/s ⚠️ INSUFICIENTE
```

#### Cenário: 160k mensagens/dia (otimista)

```
Média necessária: 160.000 ÷ 86.400 = ~1.85 msg/s
Pico esperado (5x média): ~9 msg/s
Capacidade atual: ~50 jobs/s ✅ SUFICIENTE
```

**⚠️ IMPORTANTE**: Este documento assume o cenário conservador (160k/hora).

---

## 🔴 Gargalos Identificados

### Visão Geral

| Componente | Capacidade Atual | Necessário | Gap | Prioridade |
|------------|------------------|------------|-----|------------|
| **Workers (Message Processing)** | 20 concurrent (50 jobs/s) | 180+ jobs/s | -72% | 🔴 CRÍTICO |
| **Redis (Upstash)** | ~1k commands/s | 4k+ commands/s | -75% | 🔴 CRÍTICO |
| **PostgreSQL (Neon)** | ~50 connections | 100-150 connections | -67% | 🟡 ALTO |
| **OpenAI API** | Limite padrão | 5-8k requests/min | Desconhecido | 🟡 ALTO |
| **Evolution API** | Não confirmado | 60+ msg/s | Desconhecido | 🟡 ALTO |
| **Network I/O** | ~50 Mbps | 300+ Mbps | -83% | 🟢 MÉDIO |

### Detalhamento por Componente

#### 1. Workers (BullMQ)

**Estado Atual**:
```typescript
// server/workers.ts
const concurrency = {
  messageProcessing: 20,  // 50 jobs/s max
  imageAnalysis: 8,
  npsSurvey: 8,
  inactivityFollowup: 2,
  autoClosure: 2,
}
```

**Problema**:
- 1 única instância processando todas as mensagens
- Contenção entre filas (financeiro compete com suporte)
- Sem autoscaling
- Sem redundância (SPOF - Single Point of Failure)

**Impacto**:
- Queue depth cresce exponencialmente sob carga
- Latência aumenta para >5s durante picos
- Mensagens podem ser perdidas em caso de crash

---

#### 2. Redis (Upstash)

**Estado Atual**:
- Plano: Provavelmente Free ou Starter (~$30/mês)
- Throughput: ~1,000 comandos/segundo
- Conexões: ~50 simultâneas
- Memória: ~256MB-1GB

**Problema**:
- Redis será hammered com 180+ jobs/s
- Cada job = 5-10 comandos Redis (enqueue, dequeue, lock, etc.)
- Total: ~1,000-1,500 comandos/segundo sob carga
- Risco de throttling e queue stalls

**Impacto**:
- Workers ficam bloqueados esperando Redis
- Latência de enqueue/dequeue aumenta
- Possible data loss em caso de throttling severo

---

#### 3. PostgreSQL (Neon)

**Estado Atual**:
```typescript
// Conexões configuradas
max: 50,
min: 10,
```

**Problema**:
- 15k conversas simultâneas = alta contenção de locks
- Queries sem índices adequados (N+1 queries)
- Sem particionamento de tabelas grandes
- Sem read replicas

**Impacto**:
- Slow queries aumentam (>1s)
- Deadlocks sob alta concorrência
- Database CPU spiking (>80%)

**Queries Críticas** (necessitam otimização):
```sql
-- Listagem de conversas (executada 100+ vezes/min)
SELECT * FROM conversations 
WHERE status = 'active' 
ORDER BY updated_at DESC;

-- Histórico de mensagens (executada por conversa)
SELECT * FROM messages 
WHERE conversation_id = $1 
ORDER BY created_at ASC;
```

---

#### 4. OpenAI API

**Estado Atual**:
- Tier: Pay-as-you-go (rate limits padrão)
- Rate Limits estimados:
  - GPT-5: ~3,500 requests/min
  - GPT-4o: ~5,000 requests/min

**Cálculo de Demanda**:
```
15k conversas simultâneas × 2-3 msgs/min/conversa = 30k-45k msgs/min
Considerando 30% de conversas ativas a qualquer momento:
= 9k-13.5k requests/min

EXCEDE O RATE LIMIT EM 2-3x ⚠️
```

**Impacto**:
- 429 errors (rate limit exceeded)
- Exponential backoff aumenta latência
- Conversas ficam "travadas" aguardando retry

---

#### 5. Evolution API (WhatsApp Gateway)

**Estado Atual**:
- SLA não confirmado
- Throughput desconhecido
- Latência P95 desconhecida

**Riscos**:
- Bottleneck externo fora do nosso controle
- Sem fallback ou redundância
- Dependência crítica (SPOF)

**Ações Necessárias**:
1. ✅ Confirmar SLA com provedor
2. ✅ Solicitar múltiplas instâncias
3. ✅ Implementar circuit breaker
4. ✅ Monitorar uptime e latência

---

## 🏗️ Arquitetura de Escala Proposta

### Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES (WhatsApp)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │Evolution│  (Round-robin entre 3 instâncias)
                    │   API   │
                    └────┬────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │Instance │    │Instance │    │Instance │
    │    1    │    │    2    │    │    3    │
    └────┬────┘    └────┬────┘    └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                    ┌────▼─────┐
                    │  Redis   │  (Upstash Enterprise)
                    │ Cluster  │  (Queues particionadas)
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Worker  │    │ Worker  │    │ Worker  │
    │  Pool   │    │  Pool   │    │  Pool   │
    │ (Msg)   │    │  (AI)   │    │ (Aux)   │
    │ 12 pods │    │ 4 pods  │    │ 3 pods  │
    └────┬────┘    └────┬────┘    └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                    ┌────▼─────┐
                    │PostgreSQL│  (Neon Scale)
                    │+PgBouncer│ (Connection pooling)
                    │+ Replicas│
                    └──────────┘
```

---

### 1. Sistema de Filas (BullMQ + Redis)

#### a) Upgrade Upstash Redis

**Plano Recomendado**: Enterprise

| Feature | Free/Starter | Enterprise | Diferença |
|---------|-------------|------------|-----------|
| **Comandos/s** | 1k | 10k+ | 10x |
| **Conexões** | 50 | 500+ | 10x |
| **Memória** | 256MB-1GB | 5GB-50GB | 5-50x |
| **Replicação** | ❌ | ✅ Multi-region | ✅ |
| **SLA** | Nenhum | 99.99% | ✅ |
| **Custo/mês** | $0-30 | $500-800 | +$470-800 |

**Alternativa**: Self-hosted Redis Cluster (AWS ElastiCache, Google Memorystore)
- **Prós**: Controle total, custos previsíveis
- **Contras**: Requer gerenciamento, complexidade operacional

---

#### b) Particionamento de Filas

**Estratégia**: Separar filas por domínio de assistente

**Implementação**:
```typescript
// server/queues.ts
import { Queue } from 'bullmq';

const ASSISTANTS = ['financeiro', 'comercial', 'suporte', 'ouvidoria', 'cancelamento'];

const queues = {
  messageProcessing: {} as Record<string, Queue>,
  imageAnalysis: new Queue('image-analysis', { connection: redisConfig }),
  npsSurvey: new Queue('nps-survey', { connection: redisConfig }),
  inactivity: new Queue('inactivity', { connection: redisConfig }),
};

// Criar fila dedicada por assistente
ASSISTANTS.forEach(assistant => {
  queues.messageProcessing[assistant] = new Queue(
    `msg-${assistant}`,
    { connection: redisConfig }
  );
});

// Enqueue baseado em assistantType
export function enqueueMessage(conversationId: string, assistantType: string) {
  const queue = queues.messageProcessing[assistantType];
  return queue.add('process', { conversationId }, {
    priority: getPriority(assistantType), // Financeiro = alta prioridade
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}
```

**Benefícios**:
- ✅ Isolamento de falhas (bug no financeiro não afeta suporte)
- ✅ Priorização granular (urgências em fila separada)
- ✅ Melhor observabilidade (métricas por domínio)
- ✅ Scaling independente (mais workers para financeiro se necessário)

---

### 2. Workers (Processamento)

#### Arquitetura Atual vs. Proposta

**Atual** (1 instância monolítica):
```
┌─────────────────────────┐
│  Single Worker Instance │
│  - 20 concurrent jobs   │
│  - All domains mixed    │
│  - No redundancy        │
└─────────────────────────┘
```

**Proposta** (Cluster autoscaling):
```
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│ Message Pod 1      │  │ Message Pod 2      │  │ Message Pod N      │
│ - Financeiro       │  │ - Comercial        │  │ - Suporte          │
│ - 16 concurrent    │  │ - 16 concurrent    │  │ - 16 concurrent    │
└────────────────────┘  └────────────────────┘  └────────────────────┘
         ▲                       ▲                       ▲
         └───────────────────────┴───────────────────────┘
                    Autoscaling Controller
                 (scale on queue depth + CPU)
```

---

#### a) Message Processing Pods

**Configuração por Pod**:
```yaml
# kubernetes/message-worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lia-message-worker
spec:
  replicas: 12  # Base: 12 pods
  template:
    spec:
      containers:
      - name: worker
        image: lia-cortex:latest
        resources:
          requests:
            cpu: "2000m"      # 2 vCPU
            memory: "4Gi"     # 4GB RAM
          limits:
            cpu: "3000m"
            memory: "6Gi"
        env:
        - name: WORKER_TYPE
          value: "message-processing"
        - name: CONCURRENCY
          value: "16"
        - name: ASSISTANT_DOMAIN
          value: "{{ assistant }}"  # Injetado por pod
```

**Throughput Total**:
```
12 pods × 16 concurrent × ~1 msg/s = ~192 msg/s (pico teórico)
Considerando overhead (locks, retries): ~180 msg/s (real)
```

**Autoscaling**:
```yaml
# kubernetes/message-worker-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: lia-message-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: lia-message-worker
  minReplicas: 8
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: bullmq_queue_depth
        selector:
          matchLabels:
            queue: "message-processing"
      target:
        type: AverageValue
        averageValue: "50"  # Scale up se depth > 50
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

#### b) AI Response Pods (Tool-Heavy Threads)

**Objetivo**: Isolar conversas com múltiplas tool calls (que demoram 10-30s)

**Critérios de Roteamento**:
```typescript
// Detectar threads complexas e rotear para worker dedicado
function shouldUseAIResponseWorker(conversation: Conversation): boolean {
  return (
    conversation.toolCallsCount > 5 ||  // Muitas tool calls
    conversation.hasImageAnalysis ||     // Vision API (lento)
    conversation.hasCRMIntegration       // APIs externas (latência)
  );
}
```

**Configuração**:
```yaml
replicas: 4
resources:
  cpu: "3000m"    # 3 vCPU (mais CPU para I/O-bound)
  memory: "6Gi"   # 6GB RAM (mais memória para caching)
concurrency: 8    # Menor concorrência (jobs mais pesados)
```

---

#### c) Auxiliary Pods

**Image Analysis**:
- 2 pods × 2 vCPU × 4GB RAM
- GPT-4o Vision API calls
- Throughput: ~20 imagens/min

**NPS Survey**:
- 1 pod × 1 vCPU × 2GB RAM
- Envio de NPS após resolução
- Throughput: ~100 surveys/hora

**Inactivity/Auto-closure**:
- 1 pod × 1 vCPU × 2GB RAM
- Scheduled jobs (10min, 20min intervals)
- Low priority

---

### 3. PostgreSQL (Neon)

#### a) Upgrade de Plano

**Plano Recomendado**: Scale

| Feature | Free/Starter | Scale | Diferença |
|---------|-------------|-------|-----------|
| **Storage** | 10GB | 200GB+ (auto-scaling) | 20x+ |
| **Compute** | 0.25 vCPU | 4-8 vCPU | 16-32x |
| **Conexões** | 50 | 500 | 10x |
| **TPS** | ~100 | 1,000+ | 10x+ |
| **Custo/mês** | $0-50 | $300-500 | +$250-500 |

**Estimativa de Crescimento de Dados**:
```
160k mensagens/dia × 365 dias = 58.4M mensagens/ano
1 mensagem ≈ 1KB (média com metadata)
Total: ~58GB/ano de mensagens

15k conversas × 30 dias avg lifecycle × 100 msgs = 45M mensagens ativas
Total working set: ~45GB
```

**Recomendação**: Provisionar 200GB iniciais, auto-scale até 500GB.

---

#### b) Connection Pooling (PgBouncer)

**Problema**: Conexões diretas esgotam pool rapidamente

**Solução**: PgBouncer como middleware

```typescript
// server/db.ts
import { Pool } from 'pg';

// SEM PgBouncer (ATUAL)
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 50,  // Esgota rápido com 15k conversas
  min: 10,
});

// COM PgBouncer (PROPOSTO)
const pool = new Pool({
  connectionString: PGBOUNCER_URL,  // aponta para PgBouncer
  max: 100,  // PgBouncer multiplexa para Neon
  min: 20,
  idleTimeoutMillis: 10000,  // Recicla conexões idle
  connectionTimeoutMillis: 2000,
});
```

**Configuração PgBouncer**:
```ini
[databases]
lia_cortex = host=neon-db.com port=5432 dbname=lia_cortex

[pgbouncer]
pool_mode = transaction  # Mais eficiente para OLTP
max_client_conn = 500    # Aceita 500 workers
default_pool_size = 100  # Mantém 100 conexões com Neon
```

**Benefícios**:
- ✅ 5x mais conexões simultâneas
- ✅ Reduz connection overhead (pool reuse)
- ✅ Transaction-level pooling (mais eficiente)

---

#### c) Otimizações de Schema

**Índices Compostos Críticos**:

```sql
-- 1. Listagem de conversas (usado 1000+ vezes/dia)
CREATE INDEX CONCURRENTLY idx_conversations_status_updated 
ON conversations (status, updated_at DESC)
INCLUDE (id, client_name, assigned_to);

-- 2. Histórico de mensagens (usado por conversa)
CREATE INDEX CONCURRENTLY idx_messages_conv_created 
ON messages (conversation_id, created_at ASC)
INCLUDE (role, content);

-- 3. Busca por cliente/documento
CREATE INDEX CONCURRENTLY idx_conversations_client_doc 
ON conversations (client_document)
WHERE client_document IS NOT NULL;

-- 4. Filtros do monitor (supervisor dashboard)
CREATE INDEX CONCURRENTLY idx_conversations_transferred_assigned 
ON conversations (transferred_to_human, assigned_to, status)
WHERE status IN ('active', 'queued');

-- 5. Métricas de performance
CREATE INDEX CONCURRENTLY idx_conversations_resolved_period 
ON conversations (resolved_at, resolved_by)
WHERE status = 'resolved';
```

**Impacto Esperado**:
- Query time: 500ms → 50ms (10x mais rápido)
- DB CPU: -40%
- Lock contention: -60%

---

#### d) Particionamento de Tabelas

**Tabela `messages`** (maior e de crescimento rápido):

```sql
-- Converter para tabela particionada (por semana)
CREATE TABLE messages_partitioned (
  id SERIAL,
  conversation_id VARCHAR,
  role VARCHAR,
  content TEXT,
  created_at TIMESTAMP,
  -- ... outros campos
) PARTITION BY RANGE (created_at);

-- Criar partições (últimas 8 semanas)
CREATE TABLE messages_2025_w45 PARTITION OF messages_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-11-08');

CREATE TABLE messages_2025_w46 PARTITION OF messages_partitioned
  FOR VALUES FROM ('2025-11-08') TO ('2025-11-15');

-- ... etc

-- Partição "default" para dados futuros
CREATE TABLE messages_default PARTITION OF messages_partitioned
  DEFAULT;
```

**Automação** (cron semanal):
```sql
-- Criar nova partição toda semana
CREATE TABLE messages_{{ next_week }} PARTITION OF messages_partitioned
  FOR VALUES FROM ('{{ start_date }}') TO ('{{ end_date }}');

-- Dropar partições antigas (>90 dias)
DROP TABLE messages_{{ old_week }};
```

**Benefícios**:
- ✅ Queries 3-5x mais rápidas (partition pruning)
- ✅ Vacuum/Analyze mais eficiente
- ✅ Archival simplificado (drop partition vs delete rows)

---

#### e) Archival Strategy

**Objetivo**: Mover dados antigos para cold storage

**Critérios**:
- Conversas resolvidas há >90 dias
- Mensagens de conversas arquivadas
- Logs de atividade antigos

**Implementação**:
```sql
-- 1. Exportar para S3/Object Storage
COPY (
  SELECT * FROM conversations 
  WHERE status = 'resolved' 
  AND resolved_at < NOW() - INTERVAL '90 days'
) TO PROGRAM 'aws s3 cp - s3://lia-cortex-archive/conversations/2025-q1.csv.gz --compress gzip';

-- 2. Deletar do banco ativo
DELETE FROM conversations 
WHERE status = 'resolved' 
AND resolved_at < NOW() - INTERVAL '90 days';

-- 3. Vacuum para liberar espaço
VACUUM FULL conversations;
```

**Economia Esperada**:
- Storage: -60% (após primeiro archival)
- Query performance: +40% (working set menor)

---

### 4. OpenAI API

#### a) Upgrade para Enterprise Tier

**Rate Limits Atuais** (Pay-as-you-go):
- GPT-5: ~3,500 requests/min
- GPT-4o: ~5,000 requests/min
- Total: ~8,500 requests/min

**Rate Limits Necessários**:
```
15k conversas × 30% ativas × 3 msgs/min = 13,500 requests/min
Margem de segurança (2x): 27,000 requests/min
```

**Enterprise Tier** (negociado):
- GPT-5: 15,000 requests/min
- GPT-4o: 15,000 requests/min
- Total: 30,000 requests/min ✅

**Como Solicitar**:
1. Contatar OpenAI Sales: sales@openai.com
2. Informar volume esperado: 13.5k req/min
3. Solicitar rate limit increase: 30k req/min
4. Negociar pricing (desconto por volume)

**Timeline**: 2-4 semanas para aprovação

---

#### b) Otimizações de Custo

**1. Caching de Embeddings**:

```typescript
// server/lib/embeddings-cache.ts
import { LRUCache } from 'lru-cache';

const embeddingCache = new LRUCache<string, number[]>({
  max: 10000,  // 10k embeddings em memória
  ttl: 1000 * 60 * 60 * 24,  // 24h
  updateAgeOnGet: true,
});

export async function getEmbeddingCached(text: string): Promise<number[]> {
  const cacheKey = hashText(text);
  
  // Check cache
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    console.log('🎯 Embedding cache HIT');
    return cached;
  }
  
  // Miss - fetch from OpenAI
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  
  const vector = embedding.data[0].embedding;
  embeddingCache.set(cacheKey, vector);
  
  return vector;
}
```

**Economia**: -35% de embedding calls (queries comuns repetidas)

---

**2. Batch de Queries RAG**:

```typescript
// ANTES (individual queries)
for (const query of userQueries) {
  const results = await vectorStore.query(query);
  // Processa cada resultado
}

// DEPOIS (batch)
const batchResults = await vectorStore.queryBatch(userQueries);
// Processa todos juntos
```

**Economia**: -50% de latência, -20% de custos (menos roundtrips)

---

**3. Modelo Seleção Inteligente**:

```typescript
// server/lib/model-selector.ts
export function selectModel(context: {
  messageLength: number;
  hasToolCalls: boolean;
  assistantType: string;
  complexity: number;
}): string {
  // Tarefas simples: gpt-4o-mini ($0.15/1M tokens)
  if (
    context.messageLength < 500 &&
    !context.hasToolCalls &&
    context.complexity < 3
  ) {
    return 'gpt-4o-mini';
  }
  
  // Tarefas médias: gpt-4o ($2.50/1M tokens)
  if (context.complexity < 7) {
    return 'gpt-4o';
  }
  
  // Tarefas complexas: gpt-5 ($10/1M tokens)
  return 'gpt-5';
}
```

**Economia**: -30% de custos OpenAI (mix otimizado de modelos)

---

#### c) Estimativa de Custos OpenAI

**Cenário Pico** (160k mensagens/dia):

```
Tokens por mensagem:
- Input: ~800 tokens (histórico + prompt)
- Output: ~200 tokens (resposta AI)
- Total: ~1,000 tokens/mensagem

Mix de modelos (após otimização):
- gpt-4o-mini: 40% × 160k = 64k msgs
- gpt-4o: 40% × 160k = 64k msgs
- gpt-5: 20% × 160k = 32k msgs

Custo diário:
- gpt-4o-mini: 64k × 1k tokens × $0.15/1M = $9.60
- gpt-4o: 64k × 1k tokens × $2.50/1M = $160
- gpt-5: 32k × 1.5k tokens × $10/1M = $480
TOTAL PICO: $649.60/dia

Custo mensal (pico 20% do tempo):
- Média diária: $649.60 × 0.2 + (baseline) × 0.8
- Assumindo baseline = 30% do pico
- Média: ~$260/dia × 30 dias = $7,800/mês
```

**Nota**: Custos podem variar ±30% dependendo de:
- Complexidade real das conversas
- Eficácia do caching
- Taxa de tool calls
- Comprimento das respostas

---

### 5. Evolution API (WhatsApp Gateway)

#### a) SLA Confirmation

**Questões para Provedor**:

```
1. Qual o throughput máximo suportado?
   - Mensagens enviadas/segundo
   - Mensagens recebidas/segundo

2. Qual a latência P95 e P99?
   - Envio de mensagens
   - Webhook delivery

3. Qual o SLA de uptime?
   - 99%? 99.5%? 99.9%?

4. Como são tratadas mensagens durante downtime?
   - Queueing?
   - Retry automático?

5. Existem múltiplas instâncias disponíveis?
   - Para load balancing
   - Para redundância

6. Qual o plano de disaster recovery?
   - RTO (Recovery Time Objective)
   - RPO (Recovery Point Objective)
```

**Mínimo Aceitável**:
- ✅ 60+ msg/s throughput
- ✅ <500ms P95 latency
- ✅ 99.5% uptime
- ✅ 2+ instâncias disponíveis

---

#### b) Multi-Instance Strategy

**Implementação**:

```typescript
// server/lib/evolution-api.ts
const EVOLUTION_INSTANCES = [
  {
    url: 'https://evolution1.trtelecom.net',
    weight: 3,  // Mais tráfego (instância principal)
    healthy: true,
  },
  {
    url: 'https://evolution2.trtelecom.net',
    weight: 2,  // Backup secundário
    healthy: true,
  },
  {
    url: 'https://evolution3.trtelecom.net',
    weight: 1,  // Failover
    healthy: true,
  },
];

let instanceIndex = 0;

export function getNextEvolutionInstance(): string {
  // Weighted round-robin
  const totalWeight = EVOLUTION_INSTANCES
    .filter(i => i.healthy)
    .reduce((sum, i) => sum + i.weight, 0);
  
  let random = Math.random() * totalWeight;
  
  for (const instance of EVOLUTION_INSTANCES) {
    if (!instance.healthy) continue;
    
    random -= instance.weight;
    if (random <= 0) {
      return instance.url;
    }
  }
  
  // Fallback para primeira healthy
  return EVOLUTION_INSTANCES.find(i => i.healthy)?.url || EVOLUTION_INSTANCES[0].url;
}

// Health check (a cada 30s)
setInterval(async () => {
  for (const instance of EVOLUTION_INSTANCES) {
    try {
      const response = await fetch(`${instance.url}/health`, { timeout: 5000 });
      instance.healthy = response.ok;
    } catch (error) {
      instance.healthy = false;
      console.error(`❌ Evolution instance ${instance.url} unhealthy`);
    }
  }
}, 30000);
```

---

#### c) Circuit Breaker

**Objetivo**: Prevenir cascading failures quando Evolution API está degradada

```typescript
// server/lib/circuit-breaker.ts
import { CircuitBreaker } from 'opossum';

const breakerOptions = {
  timeout: 10000,              // 10s timeout
  errorThresholdPercentage: 50, // Abre se >50% de erros
  resetTimeout: 30000,          // Tenta fechar após 30s
  rollingCountTimeout: 60000,   // Janela de 60s
  volumeThreshold: 10,          // Mínimo 10 requests para abrir
};

export const evolutionBreaker = new CircuitBreaker(
  async (instanceUrl: string, message: any) => {
    const response = await fetch(`${instanceUrl}/message/sendText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    
    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.status}`);
    }
    
    return response.json();
  },
  breakerOptions
);

// Eventos
evolutionBreaker.on('open', () => {
  console.error('🔴 Circuit breaker OPEN - Evolution API degraded');
  // Alertar via PagerDuty
});

evolutionBreaker.on('halfOpen', () => {
  console.warn('🟡 Circuit breaker HALF-OPEN - Testing Evolution API');
});

evolutionBreaker.on('close', () => {
  console.log('🟢 Circuit breaker CLOSED - Evolution API recovered');
});

// Uso
export async function sendWhatsAppMessage(to: string, text: string) {
  const instance = getNextEvolutionInstance();
  
  try {
    return await evolutionBreaker.fire(instance, { to, text });
  } catch (error) {
    // Circuit breaker aberto ou erro
    console.error('Failed to send WhatsApp message:', error);
    
    // Enqueue para retry posterior
    await enqueueRetry({ to, text });
  }
}
```

---

## 🔍 Observabilidade & Monitoring

### Stack de Monitoramento Proposto

```
┌─────────────┐
│ Application │ (LIA CORTEX)
└──────┬──────┘
       │
       ├─── Logs ───────────► Loki / CloudWatch
       │
       ├─── Metrics ────────► Prometheus
       │
       └─── Traces ─────────► Jaeger / OpenTelemetry
                                     │
                                     ▼
                              ┌──────────────┐
                              │   Grafana    │ (Dashboards)
                              └──────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  Alerting    │ (PagerDuty/Slack)
                              └──────────────┘
```

---

### 1. Métricas Críticas

#### a) Queue Health

```typescript
// server/metrics/bullmq.ts
import { register, Gauge, Histogram } from 'prom-client';

// Queue depth (por fila)
const queueDepth = new Gauge({
  name: 'bullmq_queue_depth',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue_name'],
});

// Job latency (tempo na fila)
const jobLatency = new Histogram({
  name: 'bullmq_job_latency_seconds',
  help: 'Time from job creation to processing start',
  labelNames: ['queue_name'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});

// Job processing duration
const jobDuration = new Histogram({
  name: 'bullmq_job_duration_seconds',
  help: 'Time to process a job',
  labelNames: ['queue_name', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});

// Failed jobs
const jobFailures = new Gauge({
  name: 'bullmq_job_failures_total',
  help: 'Number of failed jobs',
  labelNames: ['queue_name', 'error_type'],
});

// Worker utilization
const workerUtilization = new Gauge({
  name: 'bullmq_worker_utilization',
  help: 'Percentage of workers busy',
  labelNames: ['queue_name'],
});

// Coletar métricas a cada 10s
setInterval(async () => {
  for (const [name, queue] of Object.entries(queues)) {
    const counts = await queue.getJobCounts();
    
    queueDepth.set({ queue_name: name }, counts.waiting + counts.delayed);
    jobFailures.set({ queue_name: name }, counts.failed);
  }
}, 10000);
```

---

#### b) Database Performance

```typescript
// server/metrics/database.ts
import { register, Gauge, Histogram } from 'prom-client';

// Active connections
const dbConnections = new Gauge({
  name: 'pg_connections_active',
  help: 'Number of active PostgreSQL connections',
});

// Query duration
const queryDuration = new Histogram({
  name: 'pg_query_duration_seconds',
  help: 'PostgreSQL query execution time',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

// Slow queries (>1s)
const slowQueries = new Gauge({
  name: 'pg_slow_queries_total',
  help: 'Number of queries taking >1s',
});

// Deadlocks
const deadlocks = new Gauge({
  name: 'pg_deadlocks_total',
  help: 'Number of deadlocks detected',
});

// Instrumentar queries
const originalQuery = pool.query.bind(pool);
pool.query = async function(...args) {
  const start = Date.now();
  
  try {
    const result = await originalQuery(...args);
    const duration = (Date.now() - start) / 1000;
    
    queryDuration.observe({ query_type: 'success' }, duration);
    
    if (duration > 1) {
      slowQueries.inc();
      console.warn(`🐌 Slow query (${duration}s):`, args[0]);
    }
    
    return result;
  } catch (error) {
    queryDuration.observe({ query_type: 'error' }, (Date.now() - start) / 1000);
    throw error;
  }
};

// Coletar pg_stat_database
setInterval(async () => {
  const result = await pool.query(`
    SELECT numbackends, deadlocks 
    FROM pg_stat_database 
    WHERE datname = current_database()
  `);
  
  dbConnections.set(result.rows[0].numbackends);
  deadlocks.set(result.rows[0].deadlocks);
}, 30000);
```

---

#### c) OpenAI Metrics

```typescript
// server/metrics/openai.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Requests por modelo
const openaiRequests = new Counter({
  name: 'openai_requests_total',
  help: 'Number of OpenAI API requests',
  labelNames: ['model', 'status'],
});

// Latência
const openaiLatency = new Histogram({
  name: 'openai_latency_seconds',
  help: 'OpenAI API response time',
  labelNames: ['model'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30],
});

// Tokens consumidos
const openaiTokens = new Counter({
  name: 'openai_tokens_total',
  help: 'Total tokens consumed',
  labelNames: ['model', 'type'], // type = prompt | completion
});

// Rate limit hits
const openaiRateLimits = new Counter({
  name: 'openai_rate_limit_hits_total',
  help: 'Number of 429 rate limit errors',
  labelNames: ['model'],
});

// Custo estimado
const openaiCost = new Counter({
  name: 'openai_cost_usd_total',
  help: 'Estimated OpenAI API cost in USD',
  labelNames: ['model'],
});

// Instrumentar chamadas OpenAI
export async function trackOpenAICall<T>(
  model: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = (Date.now() - start) / 1000;
    
    openaiRequests.inc({ model, status: 'success' });
    openaiLatency.observe({ model }, duration);
    
    // Extrair tokens do resultado (se disponível)
    if ('usage' in result) {
      openaiTokens.inc({ model, type: 'prompt' }, result.usage.prompt_tokens);
      openaiTokens.inc({ model, type: 'completion' }, result.usage.completion_tokens);
      
      // Calcular custo
      const cost = calculateCost(model, result.usage);
      openaiCost.inc({ model }, cost);
    }
    
    return result;
  } catch (error: any) {
    openaiRequests.inc({ model, status: 'error' });
    
    if (error.status === 429) {
      openaiRateLimits.inc({ model });
    }
    
    throw error;
  }
}
```

---

#### d) Conversation Metrics

```typescript
// server/metrics/conversations.ts
import { register, Gauge, Histogram } from 'prom-client';

// Conversas ativas
const activeConversations = new Gauge({
  name: 'conversations_active_total',
  help: 'Number of active conversations',
  labelNames: ['assistant_type', 'status'],
});

// Messages per second
const messagesPerSecond = new Gauge({
  name: 'conversations_messages_per_second',
  help: 'Current message throughput',
});

// Transfer rate (AI → Human)
const transferRate = new Gauge({
  name: 'conversations_transfer_rate',
  help: 'Percentage of conversations transferred to human',
  labelNames: ['assistant_type'],
});

// Resolution time
const resolutionTime = new Histogram({
  name: 'conversations_resolution_time_seconds',
  help: 'Time from creation to resolution',
  labelNames: ['assistant_type', 'resolved_by'],
  buckets: [60, 300, 600, 1800, 3600, 7200, 86400],
});

// Atualizar a cada 30s
setInterval(async () => {
  // Active conversations
  const activeConvs = await storage.getConversations({
    status: ['active', 'queued'],
  });
  
  const byType = groupBy(activeConvs, 'assistantType');
  for (const [type, convs] of Object.entries(byType)) {
    activeConversations.set(
      { assistant_type: type, status: 'active' },
      convs.length
    );
  }
  
  // Messages/second (última minuto)
  const msgCount = await redis.get('metrics:messages:last_minute');
  messagesPerSecond.set(parseFloat(msgCount || '0') / 60);
}, 30000);
```

---

### 2. Dashboards (Grafana)

#### Dashboard 1: Queue Health

```
┌─────────────────────────────────────────────────────┐
│               Queue Health Dashboard                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Queue Depth (real-time)                            │
│  ┌────────────────────────────────────────────┐    │
│  │ Financeiro: ████████░░░░ 250 jobs          │    │
│  │ Comercial:  ██░░░░░░░░░░  50 jobs          │    │
│  │ Suporte:    ████░░░░░░░░ 100 jobs          │    │
│  │ Image:      ░░░░░░░░░░░░   5 jobs          │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  Job Latency (P95)                                  │
│  ┌────────────────────────────────────────────┐    │
│  │         2.5s ─────────────────────────────  │    │
│  │         2.0s ──────────                      │    │
│  │         1.5s ────────                        │    │
│  │         1.0s ────                            │    │
│  │         0.5s ──                              │    │
│  │              10:00  10:05  10:10  10:15     │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  Failed Jobs (last hour): 12 🟡                     │
│  Worker Utilization: 78% 🟢                         │
│  Oldest Job Age: 45s 🟢                             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### Dashboard 2: Database Performance

```
┌─────────────────────────────────────────────────────┐
│            Database Performance Dashboard            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Active Connections: 85/100 🟡                      │
│  CPU Usage: 45% 🟢                                  │
│  Memory: 3.2GB/8GB 🟢                               │
│                                                      │
│  Query Duration (P95)                               │
│  ┌────────────────────────────────────────────┐    │
│  │        500ms ──────────                      │    │
│  │        400ms ────────────                    │    │
│  │        300ms ──────                          │    │
│  │        200ms ────                            │    │
│  │        100ms ──                              │    │
│  │              10:00  10:05  10:10  10:15     │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  Slow Queries (>1s, last hour): 5 🟢               │
│  Deadlocks: 0 🟢                                    │
│  Replication Lag: 0ms 🟢                            │
│                                                      │
│  Top 5 Slow Queries:                                │
│  1. SELECT * FROM messages WHERE... (1.2s) 🔴      │
│  2. UPDATE conversations SET... (1.1s) 🟡          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### Dashboard 3: OpenAI API

```
┌─────────────────────────────────────────────────────┐
│              OpenAI API Dashboard                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Requests/min: 3,250 / 30,000 🟢                    │
│  Latency P95: 2.1s 🟢                               │
│  Rate Limit Hits: 0 🟢                              │
│                                                      │
│  Requests by Model (last hour)                      │
│  ┌────────────────────────────────────────────┐    │
│  │ gpt-5:       █████████░░ 45% (2.8k)         │    │
│  │ gpt-4o:      ██████░░░░░ 35% (2.1k)         │    │
│  │ gpt-4o-mini: ████░░░░░░░ 20% (1.2k)         │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  Token Consumption (last hour)                      │
│  - Input: 3.2M tokens                               │
│  - Output: 800k tokens                              │
│  - Total: 4M tokens                                 │
│                                                      │
│  Estimated Cost (today): $285.40 💰                 │
│  Projected Monthly: $8,562 💰                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

### 3. Alerting

#### Regras de Alerta

```yaml
# prometheus/alerts.yml
groups:
  - name: queue_alerts
    interval: 30s
    rules:
      - alert: HighQueueDepth
        expr: bullmq_queue_depth > 500
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High queue depth in {{ $labels.queue_name }}"
          description: "Queue {{ $labels.queue_name }} has {{ $value }} jobs waiting"
      
      - alert: CriticalQueueDepth
        expr: bullmq_queue_depth > 1000
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "CRITICAL: Queue depth in {{ $labels.queue_name }}"
          description: "Queue {{ $labels.queue_name }} has {{ $value }} jobs - possible system degradation"
      
      - alert: HighJobLatency
        expr: histogram_quantile(0.95, bullmq_job_latency_seconds) > 60
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High job latency in {{ $labels.queue_name }}"
          description: "P95 latency is {{ $value }}s (threshold: 60s)"
      
      - alert: HighJobFailureRate
        expr: rate(bullmq_job_failures_total[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High job failure rate in {{ $labels.queue_name }}"
          description: "{{ $value }} jobs/s are failing"

  - name: database_alerts
    interval: 30s
    rules:
      - alert: HighDatabaseCPU
        expr: pg_cpu_usage > 70
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database CPU usage"
          description: "PostgreSQL CPU at {{ $value }}%"
      
      - alert: CriticalDatabaseCPU
        expr: pg_cpu_usage > 85
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "CRITICAL: Database CPU usage"
          description: "PostgreSQL CPU at {{ $value }}% - immediate action required"
      
      - alert: ConnectionPoolExhausted
        expr: pg_connections_active / pg_connections_max > 0.9
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool near exhaustion"
          description: "{{ $value }}% of connections in use"
      
      - alert: SlowQueries
        expr: rate(pg_slow_queries_total[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Multiple slow queries detected"
          description: "{{ $value }} queries/s taking >1s"

  - name: openai_alerts
    interval: 30s
    rules:
      - alert: OpenAIRateLimitHit
        expr: rate(openai_rate_limit_hits_total[1m]) > 0.01
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "OpenAI rate limits being hit"
          description: "{{ $value }}% of requests hitting rate limits"
      
      - alert: OpenAIHighLatency
        expr: histogram_quantile(0.95, openai_latency_seconds) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High OpenAI API latency"
          description: "P95 latency is {{ $value }}s"
      
      - alert: OpenAIHighCost
        expr: rate(openai_cost_usd_total[1h]) > 20
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High OpenAI API costs"
          description: "Burning ${{ $value }}/hour"

  - name: conversation_alerts
    interval: 60s
    rules:
      - alert: HighMessageThroughput
        expr: conversations_messages_per_second > 150
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High message throughput"
          description: "{{ $value }} msg/s - approaching capacity"
      
      - alert: HighTransferRate
        expr: conversations_transfer_rate > 0.30
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High AI→Human transfer rate"
          description: "{{ $value }}% of conversations being transferred"
```

---

#### Canais de Notificação

```yaml
# alertmanager/config.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  
  routes:
    # Alertas críticos → PagerDuty (24/7 on-call)
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true
    
    # Alertas de warning → Slack
    - match:
        severity: warning
      receiver: 'slack'
    
    # Alertas de custo → Email (finance team)
    - match_re:
        alertname: '.*Cost.*'
      receiver: 'email-finance'

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:9093/webhook'
  
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<PAGERDUTY_SERVICE_KEY>'
        description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
  
  - name: 'slack'
    slack_configs:
      - api_url: '<SLACK_WEBHOOK_URL>'
        channel: '#lia-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'
        color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'
  
  - name: 'email-finance'
    email_configs:
      - to: 'finance@trtelecom.net'
        from: 'alerts@trtelecom.net'
        smarthost: 'smtp.gmail.com:587'
        auth_username: '<EMAIL_USER>'
        auth_password: '<EMAIL_PASS>'
        subject: '🚨 LIA CORTEX: {{ .GroupLabels.alertname }}'
```

---

## 💰 Estimativa de Custos

### Custos Atuais (Baseline)

| Componente | Plano Atual | Custo/Mês | Notas |
|------------|-------------|-----------|-------|
| Upstash Redis | Free/Starter | $30 | 1k cmds/s |
| Neon PostgreSQL | Free/Starter | $50 | 50 connections |
| Upstash Vector | Standard | $50 | 1M vectors |
| Compute (Workers) | Replit | Incluído | Single instance |
| OpenAI API | Pay-as-you-go | $2,000 | Volume atual |
| Evolution API | ? | ? | A confirmar |
| Monitoring | Nenhum | $0 | - |
| **TOTAL** | - | **~$2,130** | - |

---

### Custos Escalados (Meta: 160k msgs/pico)

#### Fase 1-2: Vertical Scaling (Mês 1-2)

| Componente | Plano Novo | Custo/Mês | Δ Custo |
|------------|------------|-----------|---------|
| Upstash Redis | **Enterprise** | $600 | +$570 |
| Neon PostgreSQL | **Scale** | $400 | +$350 |
| Upstash Vector | **Pro** | $150 | +$100 |
| Compute | Replit | Incluído | $0 |
| OpenAI API | Pay-as-you-go | $4,000 | +$2,000 |
| Evolution API | ? | ? | ? |
| Monitoring | Prometheus/Grafana Cloud | $50 | +$50 |
| **TOTAL** | - | **~$5,200** | **+$3,070** |

**Capacidade**: ~100 msg/s

---

#### Fase 3: Horizontal Scaling (Mês 3-4)

| Componente | Plano Novo | Custo/Mês | Δ Custo (vs Fase 2) |
|------------|------------|-----------|---------------------|
| Upstash Redis | Enterprise | $600 | $0 |
| Neon PostgreSQL | Scale | $400 | $0 |
| Upstash Vector | Pro | $150 | $0 |
| **Compute** | **AWS ECS/K8s** | **$1,200** | **+$1,200** |
| OpenAI API | Enterprise tier | $7,500 | +$3,500 |
| Evolution API | ? | ? | ? |
| Monitoring | Grafana Cloud Pro | $150 | +$100 |
| **TOTAL** | - | **~$10,000** | **+$4,800** |

**Capacidade**: ~180 msg/s ✅

**Breakdown Compute**:
```
Message Processing: 12 pods × $60/pod = $720
AI Response: 4 pods × $90/pod = $360
Auxiliary: 3 pods × $40/pod = $120
TOTAL: $1,200/mês
```

---

#### Fase 4: Resiliência (Mês 5-6)

| Componente | Plano Novo | Custo/Mês | Δ Custo (vs Fase 3) |
|------------|------------|-----------|---------------------|
| Upstash Redis | **Enterprise Multi-region** | $900 | +$300 |
| Neon PostgreSQL | **Scale + Replicas** | $700 | +$300 |
| Upstash Vector | Pro | $150 | $0 |
| Compute | AWS ECS/K8s | $1,200 | $0 |
| OpenAI API | Enterprise tier | $8,000 | +$500 |
| Evolution API | **Multi-instance** | $500 | +$500 |
| Monitoring | Grafana + PagerDuty | $300 | +$150 |
| **TOTAL** | - | **~$11,750** | **+$1,750** |

**Capacidade**: ~200 msg/s, 99.9% uptime ✅

---

### Resumo de Custos

| Fase | Mês | Custo/Mês | Capacidade | Uptime |
|------|-----|-----------|------------|--------|
| **Baseline** | 0 | $2,130 | 50 msg/s | ~98% |
| **Fase 1-2** | 1-2 | $5,200 | 100 msg/s | ~99% |
| **Fase 3** | 3-4 | $10,000 | 180 msg/s | ~99.5% |
| **Fase 4** | 5-6 | $11,750 | 200 msg/s | ~99.9% |

**ROI**:
- **Capacidade**: +4x (50 → 200 msg/s)
- **Custo**: +5.5x ($2,130 → $11,750)
- **Eficiência**: Custo por mensagem reduz 20% com economia de escala

---

### Variáveis de Custo OpenAI

**Cenários**:

| Cenário | Msgs/Dia | Tokens/Msg | Mix Modelos | Custo/Mês |
|---------|----------|------------|-------------|-----------|
| **Otimista** | 80k | 800 | 50% mini, 30% 4o, 20% 5 | $4,500 |
| **Realista** | 120k | 1,000 | 40% mini, 40% 4o, 20% 5 | $7,500 |
| **Pessimista** | 160k | 1,200 | 30% mini, 40% 4o, 30% 5 | $11,000 |

**Fatores que Aumentam Custo**:
- ❌ Contextos longos (histórico >10 mensagens)
- ❌ Múltiplas tool calls (retrials)
- ❌ Vision API (imagens pesadas)
- ❌ Embeddings sem cache

**Fatores que Reduzem Custo**:
- ✅ Caching de embeddings (-35%)
- ✅ Modelo seleção inteligente (-30%)
- ✅ Compressão de contexto (-20%)
- ✅ Batch queries RAG (-20%)

**Economia potencial**: -50% de custos OpenAI com otimizações

---

## 🛣️ Roadmap de Implementação

### Visão Geral

```
Fase 0: Preparação (2 semanas) → $0
    ↓
Fase 1: Quick Wins (2-3 semanas) → $0
    ↓
Fase 2: Vertical Scaling (3-4 semanas) → +$3,070/mês
    ↓
Fase 3: Horizontal Scaling (4-6 semanas) → +$4,800/mês
    ↓
Fase 4: Resiliência (6-8 semanas) → +$1,750/mês
    ↓
Total: 5-6 meses, $11,750/mês
```

---

### Fase 0: Preparação (Semanas 1-2)

#### Objetivos
- ✅ Estabelecer baseline de performance
- ✅ Instrumentar código com métricas
- ✅ Configurar stack de observabilidade
- ✅ Validar SLAs de dependências externas

#### Tarefas

**Semana 1: Instrumentação**

1. **Setup Prometheus + Grafana**
   - [ ] Deploy Prometheus server
   - [ ] Configurar scrapers para métricas
   - [ ] Deploy Grafana
   - [ ] Criar dashboards iniciais

2. **Instrumentar BullMQ**
   - [ ] Adicionar métricas de queue depth
   - [ ] Adicionar métricas de job latency
   - [ ] Adicionar métricas de failures
   - [ ] Testar coleta de métricas

3. **Instrumentar PostgreSQL**
   - [ ] Ativar pg_stat_statements
   - [ ] Coletar métricas de conexões
   - [ ] Coletar métricas de slow queries
   - [ ] Configurar query logging

4. **Instrumentar OpenAI**
   - [ ] Wrapper para tracking de requests
   - [ ] Métricas de tokens e custos
   - [ ] Métricas de latência
   - [ ] Rate limit monitoring

**Semana 2: Baseline e Validação**

5. **Load Testing**
   - [ ] Configurar k6 ou Artillery
   - [ ] Criar script de load test
   - [ ] Executar teste: 10 msg/s
   - [ ] Executar teste: 25 msg/s
   - [ ] Executar teste: 50 msg/s
   - [ ] Executar teste: 75 msg/s (falha esperada)
   - [ ] Documentar limite real

6. **Validação de SLAs**
   - [ ] Contatar Evolution API sobre SLA
   - [ ] Solicitar métricas de throughput
   - [ ] Confirmar uptime garantido
   - [ ] Testar failover (se houver)

7. **Documentação**
   - [ ] Arquitetura atual (diagrama)
   - [ ] Fluxo de dados (sequence diagrams)
   - [ ] Dependency map
   - [ ] Runbook de incidentes

#### Entregáveis
- ✅ Grafana com 4 dashboards funcionais
- ✅ Relatório de baseline (capacidade atual)
- ✅ SLAs validados (Evolution API)
- ✅ Documentação técnica atualizada

#### Investimento
- **Custo**: $0
- **Tempo**: 2 semanas (1-2 pessoas)

---

### Fase 1: Quick Wins (Semanas 3-5)

#### Objetivos
- ✅ Otimizações de código (sem custo adicional)
- ✅ Ganhar +30-40% throughput
- ✅ Reduzir latência P95 em 20%

#### Tarefas

**Semana 3: Otimizações de Database**

1. **Índices Compostos**
   ```sql
   -- Ver seção "PostgreSQL > Otimizações de Schema"
   CREATE INDEX CONCURRENTLY idx_conversations_status_updated...
   CREATE INDEX CONCURRENTLY idx_messages_conv_created...
   CREATE INDEX CONCURRENTLY idx_conversations_client_doc...
   ```
   - [ ] Criar 5 índices críticos
   - [ ] Validar query plans (EXPLAIN ANALYZE)
   - [ ] Medir impacto em prod (A/B test)

2. **Query Optimization**
   - [ ] Identificar top 10 slow queries
   - [ ] Reescrever com JOINs eficientes
   - [ ] Adicionar LIMIT onde apropriado
   - [ ] Usar prepared statements

3. **Connection Pooling**
   - [ ] Ajustar max connections: 50 → 80
   - [ ] Ajustar idle timeout: 30s → 10s
   - [ ] Implementar connection recycling

**Semana 4: Otimizações de Workers**

4. **Ajustar Concorrência**
   - [ ] Testar concurrency: 20 → 30
   - [ ] Testar concurrency: 30 → 40
   - [ ] Medir CPU e memory usage
   - [ ] Escolher configuração ótima

5. **Caching de Embeddings**
   - [ ] Implementar LRU cache (10k entries)
   - [ ] Integrar com queries RAG
   - [ ] Medir hit rate
   - [ ] Ajustar tamanho do cache

6. **Retry Policies**
   - [ ] Exponential backoff: 2s, 4s, 8s
   - [ ] Max attempts: 3
   - [ ] Dead letter queue
   - [ ] Alerting em DLQ depth

**Semana 5: Otimizações de OpenAI**

7. **Model Selection**
   - [ ] Implementar heurística de seleção
   - [ ] Testar com 20% do tráfego
   - [ ] Medir economia de custos
   - [ ] Rollout para 100%

8. **Batch RAG Queries**
   - [ ] Agrupar queries similares
   - [ ] Implementar batch API
   - [ ] Medir redução de latência

9. **Idempotency**
   - [ ] Adicionar idempotency keys
   - [ ] Redis para dedup (TTL 24h)
   - [ ] Testar com duplicate messages

#### Entregáveis
- ✅ Throughput: 50 → 70 msg/s (+40%)
- ✅ Latência P95: 3s → 2.4s (-20%)
- ✅ Custos OpenAI: -15%

#### Investimento
- **Custo**: $0
- **Tempo**: 3 semanas (2-3 pessoas)

---

### Fase 2: Vertical Scaling (Semanas 6-9)

#### Objetivos
- ✅ Upgrade de infraestrutura gerenciada
- ✅ Ganhar +50% throughput adicional
- ✅ Preparar para horizontal scaling

#### Tarefas

**Semana 6: Upstash Redis Upgrade**

1. **Migração para Enterprise**
   - [ ] Provisionar cluster Enterprise
   - [ ] Configurar replicação
   - [ ] Migrar dados (zero downtime)
   - [ ] Validar performance

2. **Particionamento de Filas**
   - [ ] Separar filas por assistente
   - [ ] Atualizar workers (routing)
   - [ ] Testar isolamento
   - [ ] Rollout gradual (10%, 50%, 100%)

**Semana 7: Neon PostgreSQL Upgrade**

3. **Upgrade para Scale Plan**
   - [ ] Provisionar Scale instance
   - [ ] Configurar PgBouncer
   - [ ] Migrar dados (pg_dump/restore)
   - [ ] Cutover (maintenance window)

4. **Particionamento de Tabelas**
   - [ ] Particionar `messages` por semana
   - [ ] Criar 12 partições (últimas 12 semanas)
   - [ ] Migrar dados históricos
   - [ ] Configurar cron de manutenção

**Semana 8: OpenAI Enterprise**

5. **Rate Limit Increase**
   - [ ] Solicitar aumento (30k req/min)
   - [ ] Aguardar aprovação (1-2 semanas)
   - [ ] Testar novos limites
   - [ ] Atualizar alerting

6. **Archival de Dados**
   - [ ] Implementar script de export (S3)
   - [ ] Exportar conversas >90 dias
   - [ ] Deletar do banco ativo
   - [ ] Vacuum database

**Semana 9: Validação**

7. **Load Testing (Fase 2)**
   - [ ] Teste: 80 msg/s (esperado: ✅)
   - [ ] Teste: 100 msg/s (esperado: ✅)
   - [ ] Teste: 120 msg/s (esperado: 🟡)
   - [ ] Documentar resultados

8. **Monitoring**
   - [ ] Atualizar dashboards
   - [ ] Ajustar thresholds de alertas
   - [ ] Configurar PagerDuty
   - [ ] Testar alerting end-to-end

#### Entregáveis
- ✅ Throughput: 70 → 110 msg/s (+57%)
- ✅ Uptime: 98% → 99.5%
- ✅ Database: 50 → 150 connections

#### Investimento
- **Custo**: +$3,070/mês
- **Tempo**: 4 semanas (3-4 pessoas)

---

### Fase 3: Horizontal Scaling (Semanas 10-15)

#### Objetivos
- ✅ Deploy de múltiplas instâncias de workers
- ✅ Autoscaling baseado em carga
- ✅ Atingir meta de 180 msg/s

#### Tarefas

**Semanas 10-11: Containerização**

1. **Dockerização**
   - [ ] Criar Dockerfile otimizado
   - [ ] Multi-stage build
   - [ ] Otimizar tamanho da imagem (<500MB)
   - [ ] Testar localmente

2. **CI/CD Pipeline**
   - [ ] GitHub Actions workflow
   - [ ] Build automático
   - [ ] Push para registry (ECR/GCR)
   - [ ] Automated tests

3. **Kubernetes Manifests**
   - [ ] Deployments (message, AI, aux)
   - [ ] Services (ClusterIP)
   - [ ] ConfigMaps (env vars)
   - [ ] Secrets (credentials)

**Semanas 12-13: Deploy em Cluster**

4. **Provisionar Cluster K8s**
   - [ ] AWS EKS ou GCP GKE
   - [ ] 3-5 nodes (t3.large ou equivalent)
   - [ ] Configurar networking
   - [ ] Configurar storage (PVs)

5. **Deploy Workers**
   - [ ] Deploy message workers (3 pods iniciais)
   - [ ] Deploy AI workers (2 pods)
   - [ ] Deploy aux workers (1 pod)
   - [ ] Validar health checks

6. **Load Balancing**
   - [ ] Configurar ingress controller
   - [ ] SSL/TLS certificates
   - [ ] DNS records
   - [ ] Health checks

**Semanas 14-15: Autoscaling e Validação**

7. **Horizontal Pod Autoscaler**
   - [ ] HPA para message workers
   - [ ] HPA para AI workers
   - [ ] Testar scale-up (carga artificial)
   - [ ] Testar scale-down (idle)

8. **Circuit Breakers**
   - [ ] Implementar para Evolution API
   - [ ] Implementar para OpenAI API
   - [ ] Testar failover
   - [ ] Documentar comportamento

9. **Load Testing (Fase 3)**
   - [ ] Teste: 150 msg/s (esperado: ✅)
   - [ ] Teste: 180 msg/s (esperado: ✅)
   - [ ] Teste: 200 msg/s (esperado: 🟡)
   - [ ] Stress test: 250 msg/s (esperado: ❌)

10. **Performance Tuning**
    - [ ] Ajustar resources (CPU/memory)
    - [ ] Ajustar concurrency
    - [ ] Otimizar network latency
    - [ ] Final validation

#### Entregáveis
- ✅ Throughput: 110 → 185 msg/s (+68%)
- ✅ Autoscaling funcional (8-20 pods)
- ✅ Zero downtime deployments

#### Investimento
- **Custo**: +$4,800/mês (vs Fase 2)
- **Tempo**: 6 semanas (4-5 pessoas)

---

### Fase 4: Resiliência e HA (Semanas 16-22)

#### Objetivos
- ✅ Alta disponibilidade (99.9% uptime)
- ✅ Disaster recovery
- ✅ Produção-ready

#### Tarefas

**Semanas 16-17: Multi-Region Redis**

1. **Redis Cluster (Multi-AZ)**
   - [ ] Deploy cluster em 3 AZs
   - [ ] Configurar automatic failover
   - [ ] Testar failover (kill node)
   - [ ] Validar zero data loss

2. **Replicação de Dados**
   - [ ] Active-passive replication
   - [ ] Lag monitoring (<100ms)
   - [ ] Backup automático (diário)

**Semanas 18-19: PostgreSQL HA**

3. **Read Replicas**
   - [ ] Provisionar 2 read replicas
   - [ ] Rotear queries read-only
   - [ ] Load balancing (pgpool)
   - [ ] Testar failover

4. **Point-in-Time Recovery**
   - [ ] Configurar WAL archiving
   - [ ] Testar restore (backup de 1h atrás)
   - [ ] Testar restore (backup de 1 dia atrás)
   - [ ] Documentar procedimento

**Semanas 20-21: Multi-Instance Evolution**

5. **Evolution API Load Balancing**
   - [ ] Configurar 3 instâncias
   - [ ] Round-robin com weights
   - [ ] Health checks (30s interval)
   - [ ] Failover automático

6. **Disaster Recovery Plan**
   - [ ] Documentar RTO/RPO targets
   - [ ] Criar runbook de DR
   - [ ] Simular disaster (região down)
   - [ ] Testar recovery (<30min)

**Semana 22: Chaos Engineering**

7. **Chaos Testing**
   - [ ] Kill random pod (Chaos Monkey)
   - [ ] Network partition (Chaos Kong)
   - [ ] Database slow queries (latency injection)
   - [ ] Redis failover (kill primary)

8. **Final Validation**
   - [ ] Load test: 200 msg/s × 1 hora
   - [ ] Soak test: 150 msg/s × 24 horas
   - [ ] Spike test: 0 → 250 msg/s × 5min
   - [ ] Documentar resultados

9. **Production Readiness Review**
   - [ ] Security audit
   - [ ] Performance review
   - [ ] Disaster recovery validation
   - [ ] Documentation complete

#### Entregáveis
- ✅ Uptime: 99.5% → 99.9%
- ✅ RTO: <30 minutos
- ✅ RPO: <5 minutos
- ✅ Produção-ready ✅

#### Investimento
- **Custo**: +$1,750/mês (vs Fase 3)
- **Tempo**: 7 semanas (3-4 pessoas)

---

### Cronograma Visual

```
Mês 1: ████████░░░░░░░░░░░░ Fase 0 + Fase 1
       - Instrumentação
       - Quick wins
       - Throughput: 50 → 70 msg/s

Mês 2: ░░░░░░░░████████░░░░ Fase 2 (início)
       - Upgrade Redis
       - Upgrade PostgreSQL
       - Throughput: 70 → 90 msg/s

Mês 3: ░░░░░░░░░░░░████████ Fase 2 (fim) + Fase 3 (início)
       - OpenAI Enterprise
       - Containerização
       - Throughput: 90 → 120 msg/s

Mês 4: ░░░░░░░░░░░░░░░░████ Fase 3 (meio)
       - Deploy K8s cluster
       - Autoscaling
       - Throughput: 120 → 160 msg/s

Mês 5: ████████░░░░░░░░░░░░ Fase 3 (fim) + Fase 4 (início)
       - Load testing
       - Multi-region Redis
       - Throughput: 160 → 180 msg/s

Mês 6: ░░░░░░░░████████████ Fase 4 (fim)
       - PostgreSQL HA
       - Chaos testing
       - Production-ready ✅
```

---

### Recursos Necessários

#### Equipe

| Papel | Fase 0-1 | Fase 2 | Fase 3 | Fase 4 |
|-------|----------|--------|--------|--------|
| **Backend Engineer** | 1-2 | 2 | 3 | 2 |
| **DevOps/SRE** | 1 | 2 | 3 | 2 |
| **Database Specialist** | 0.5 | 1 | 0.5 | 1 |
| **QA/Testing** | 0.5 | 1 | 1 | 1 |
| **Project Manager** | 0.5 | 0.5 | 0.5 | 0.5 |
| **TOTAL (FTE)** | 3.5-4.5 | 6.5 | 8 | 6.5 |

---

## ❓ Perguntas para Decisão

### Críticas (bloqueadoras)

1. **Qual a janela de tempo do "pico de 160k mensagens"?**
   - [ ] Por hora (mais conservador - assumido neste doc)
   - [ ] Por dia (mais otimista)
   - [ ] Por mês (muito otimista)
   
   **Impacto**: Muda capacidade necessária em 10-100x

2. **Qual o budget aprovado para infraestrutura?**
   - [ ] $5,000/mês (suficiente para Fase 2)
   - [ ] $10,000/mês (suficiente para Fase 3)
   - [ ] $15,000/mês (suficiente para Fase 4)
   - [ ] Outro: ___________
   
   **Impacto**: Define até qual fase podemos ir

3. **Quando precisa estar pronto?**
   - [ ] 1 mês (impossível)
   - [ ] 3 meses (possível até Fase 2-3)
   - [ ] 6 meses (possível Fase 4 completa)
   - [ ] Flexível
   
   **Impacto**: Define priorização e tamanho da equipe

---

### Importantes (direcional)

4. **Qual o SLA de uptime exigido?**
   - [ ] 99% (12 horas downtime/ano) - Fase 1-2 suficiente
   - [ ] 99.5% (44 horas/ano) - Fase 3 suficiente
   - [ ] 99.9% (8.8 horas/ano) - Requer Fase 4
   
   **Impacto**: Define necessidade de HA/DR

5. **Evolution API tem múltiplas instâncias disponíveis?**
   - [ ] Sim (qual SLA?)
   - [ ] Não (precisamos negociar)
   - [ ] Não sei
   
   **Impacto**: Crítico para resiliência

6. **Podemos migrar para AWS/GCP ou ficamos no Replit?**
   - [ ] Sim, podemos migrar
   - [ ] Preferível ficar no Replit
   - [ ] Flexível
   
   **Impacto**: Define estratégia de compute

---

### Secundárias (otimização)

7. **Qual a distribuição de carga ao longo do dia?**
   - [ ] Uniforme (24/7)
   - [ ] Horário comercial (8h-18h pico)
   - [ ] Variável (spikes imprevisíveis)
   
   **Impacto**: Define estratégia de autoscaling

8. **Qual a taxa de crescimento esperada?**
   - [ ] 10% ao mês
   - [ ] 20% ao mês
   - [ ] 50% ao mês
   - [ ] Explosivo (>100% ao mês)
   
   **Impacto**: Define margem de segurança

9. **Quais métricas de negócio são prioritárias?**
   - [ ] Latência (UX)
   - [ ] Custo (ROI)
   - [ ] Uptime (SLA)
   - [ ] Todas igualmente
   
   **Impacto**: Define tradeoffs de otimização

---

## 🚀 Próximos Passos Imediatos

### Semana 1-2: Kickoff e Setup

#### Segunda-feira
- [ ] **Reunião de kickoff** (1h)
  - Apresentar este plano
  - Alinhar expectativas
  - Responder perguntas críticas
  - Definir budget e timeline

- [ ] **Configurar ferramentas** (4h)
  - Provisionar Prometheus server
  - Deploy Grafana
  - Configurar GitHub Projects (tracking)

#### Terça-feira
- [ ] **Instrumentação - BullMQ** (6h)
  - Adicionar métricas de queue depth
  - Adicionar métricas de latency
  - Testar coleta

#### Quarta-feira
- [ ] **Instrumentação - PostgreSQL** (6h)
  - Ativar pg_stat_statements
  - Coletar métricas de conexões
  - Configurar slow query log

#### Quinta-feira
- [ ] **Instrumentação - OpenAI** (6h)
  - Criar wrapper de tracking
  - Métricas de tokens e custos
  - Métricas de latência

#### Sexta-feira
- [ ] **Dashboards Grafana** (6h)
  - Dashboard: Queue Health
  - Dashboard: Database Performance
  - Dashboard: OpenAI API
  - Dashboard: Conversations

---

### Semana 3-4: Quick Wins

#### Objetivos
- ✅ Ganhar +30% throughput sem custo
- ✅ Load testing para baseline
- ✅ Validar SLAs externos

#### Prioridades
1. **Índices PostgreSQL** (impacto: alto, esforço: baixo)
2. **Caching de embeddings** (impacto: médio, esforço: médio)
3. **Ajustar concorrência workers** (impacto: alto, esforço: baixo)
4. **Load testing** (impacto: crítico, esforço: médio)

---

### Decisões Críticas (Até Fim da Semana 2)

**Para prosseguir com Fase 2, precisamos de**:

1. ✅ **Confirmação de budget**: $5,000-10,000/mês
2. ✅ **Timeline aprovada**: 3-6 meses
3. ✅ **SLA da Evolution API**: Confirmado pelo fornecedor
4. ✅ **Definição de "pico"**: Por hora, dia ou mês?

**Sem essas respostas, não podemos avançar além da Fase 1.**

---

## 📞 Contatos e Suporte

### Equipe Técnica
- **Lead Engineer**: [Nome]
- **DevOps Lead**: [Nome]
- **Database Specialist**: [Nome]

### Fornecedores
- **OpenAI Sales**: sales@openai.com
- **Upstash Support**: support@upstash.com
- **Neon Support**: support@neon.tech
- **Evolution API**: [Contato do fornecedor]

### Escalação
- **Urgente (P0)**: PagerDuty (24/7)
- **Alta (P1)**: Slack #lia-alerts
- **Normal (P2)**: Email team@trtelecom.net

---

## 📚 Referências

### Documentação Técnica
- [BullMQ Best Practices](https://docs.bullmq.io/guide/best-practices)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [Kubernetes Autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)

### Ferramentas
- [Prometheus](https://prometheus.io/)
- [Grafana](https://grafana.com/)
- [k6 Load Testing](https://k6.io/)
- [PgBouncer](https://www.pgbouncer.org/)

### Arquitetura
- [12 Factor App](https://12factor.net/)
- [Microservices Patterns](https://microservices.io/patterns/)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)

---

## 📄 Controle de Versões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0 | Nov 2025 | Equipe LIA | Versão inicial |

---

## ✅ Aprovações

| Stakeholder | Papel | Status | Data |
|-------------|-------|--------|------|
| [Nome] | CTO | ⏳ Pendente | - |
| [Nome] | CFO | ⏳ Pendente | - |
| [Nome] | Product Lead | ⏳ Pendente | - |

---

**Nota Final**: Este documento é um plano vivo e será atualizado conforme o projeto evolui. Revisões são esperadas a cada fase.
