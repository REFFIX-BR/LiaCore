# Análise de Escalabilidade - LIA CORTEX

> **Objetivo**: Avaliar a capacidade da plataforma para atender 5.000 conversas diárias e definir roadmap de crescimento.

---

## 📊 Cenário de Carga: 5.000 Conversas/Dia

### Volumetria Projetada

| Métrica | Valor |
|---------|-------|
| **Conversas diárias** | 5.000 |
| **Conversas/hora (pico 9h-18h)** | ~390 |
| **Conversas/minuto (pico)** | ~6,5 |
| **Mensagens/mês** | ~150.000 |
| **Imagens para análise/mês** | ~1.000 (Vision) |
| **Duração média/conversa** | 5-10 minutos |
| **Mensagens/conversa** | 10-15 |
| **Tool calls/conversa** | 2-3 |

### Premissas
- **Horário de pico**: 70% do tráfego entre 9h-18h (9 horas)
- **Distribuição**: 1 imagem a cada 5 conversas
- **Média de switches entre assistentes**: 1-2 por conversa
- **Taxa de transferência para humano**: ~15%

---

## 🚨 Avaliação da Arquitetura Atual

### ❌ RESULTADO: INCAPAZ DE ATENDER 5.000/DIA

**Capacidade atual estimada**: 500-1.000 conversas/dia com estabilidade

### Gargalos Críticos

#### 1. **Servidor Único - Zero Escalabilidade Horizontal** 🔴
- **Arquitetura**: Node.js monolítico em Replit
- **Problema**: Event loop bloqueado por operações síncronas longas
- **Operações bloqueantes**:
  - Vision analysis: 3-8 segundos/imagem
  - OpenAI run polling: até 60 segundos/conversa
  - Knowledge base queries: 1-2 segundos
- **Limite prático**: ~50 conversas simultâneas
- **Saturação**: CPU único não aguenta 6,5 conv/min no pico

#### 2. **OpenAI API - Rate Limits Excedidos** 🔴
- **Tier atual**: Free/Tier 1 (500 req/min)
- **Necessário no pico**: ~2.000 req/min
- **Breakdown por conversa**:
  - Thread creation: 1 req
  - Message creation: 1 req
  - Run creation: 1 req
  - Run polling: 3-10 req (até 60 tentativas)
  - Tool outputs: 2-4 req
  - **Total**: 8-17 requisições/conversa
- **Custo estimado**: $3.000-5.000/mês em tokens

#### 3. **Evolution API (WhatsApp) - Capacidade Insuficiente** 🟡
- **Limite/instância**: ~50 mensagens/minuto
- **Necessário no pico**: ~200 mensagens/minuto
- **Solução mínima**: 4-6 instâncias dedicadas
- **Custo**: $200-400/mês

#### 4. **Upstash Redis - Free Tier Ultrapassado** 🟡
- **Limite free**: 600 comandos/minuto, 10 conexões
- **Necessário**: ~1.500 comandos/minuto, 50+ conexões
- **Operações/mensagem**: 4-6 (thread lookup, cache write, metadata)
- **Solução**: Plano Pro ($50-100/mês)

#### 5. **Neon PostgreSQL - Conexões Insuficientes** 🟡
- **Limite free**: 3 conexões simultâneas, 5 GB storage
- **Necessário**: 20+ conexões no pico
- **Crescimento**: ~2 GB/mês (mensagens, logs, complaints)
- **Solução**: Plano Pro ($50-100/mês)

#### 6. **Upstash Vector (RAG) - Quota Excedida** 🟡
- **Limite free**: 10.000 queries/mês
- **Necessário**: ~50.000 queries/mês
- **Uso médio**: 1-2 consultas por conversa que precisa conhecimento
- **Solução**: Plano Pro ($30-50/mês)

#### 7. **Processos em Background - Competição de Recursos** 🟡
- **Learning system**: Executa a cada 2 horas (GPT-4 pesado)
- **Dashboard polling**: A cada 15 segundos (múltiplos supervisores)
- **NPS surveys**: Disparo assíncrono pós-conversa
- **Problema**: Compete pela mesma CPU/memória do servidor único

---

## 💰 Análise de Custos

### Arquitetura Atual (até 1.000/dia)
| Serviço | Tier | Custo/Mês |
|---------|------|-----------|
| OpenAI API | Pay-as-go | $300-500 |
| Evolution API | 1 instância | $50-100 |
| Upstash Redis | Free → Basic | $0-30 |
| Upstash Vector | Free | $0 |
| Neon PostgreSQL | Free | $0 |
| Replit Deployment | Hacker Plan | $20 |
| **TOTAL** | | **$370-650/mês** |

### Arquitetura Necessária (5.000/dia)
| Serviço | Tier | Custo/Mês |
|---------|------|-----------|
| OpenAI API | Enterprise/High | $3.000-5.000 |
| Evolution API | 4-6 instâncias | $200-400 |
| Upstash Redis | Pro | $50-100 |
| Upstash Vector | Pro | $30-50 |
| Neon PostgreSQL | Pro | $50-100 |
| Cloud Infrastructure (AWS/GCP) | 3-5 servidores + LB | $200-500 |
| Monitoring (DataDog/New Relic) | Essencial | $100-200 |
| **TOTAL** | | **$3.630-6.350/mês** |

**ROI**: A ~$1.20 por atendimento, 5k/dia = $6k/dia = $180k/mês de receita potencial

---

## 📈 Capacidade por Tier

| Volume Diário | Arquitetura | Custo/Mês | Mudanças Necessárias |
|---------------|-------------|-----------|---------------------|
| **500-1.000** | Atual otimizada | $500-800 | • Sistema de filas<br>• Redis Basic<br>• Connection pooling |
| **1.000-2.500** | Híbrida | $1.200-2.000 | • 2-3 servidores<br>• Load balancer<br>• Upstash Pro<br>• Neon Pro |
| **2.500-5.000** | Cloud nativa | $3.500-6.000 | • Cluster K8s<br>• Auto-scaling<br>• Multi-region<br>• Full monitoring |
| **5.000-10.000** | Enterprise | $7.000-12.000 | • Database replicas<br>• CDN global<br>• Disaster recovery |

---

## 🛠️ Roadmap de Escalabilidade

### **FASE 0: Otimização Atual (Semana 1-2)** ✅ MVP
**Objetivo**: Suportar 500-1.000 conversas/dia com estabilidade

#### Ações Imediatas
1. ✅ **Implementar Sistema de Filas (BullMQ)**
   - Queue para mensagens WhatsApp
   - Workers assíncronos (3-5 processos)
   - Retry automático em falhas
   - **Ganho**: 3x capacidade sem mudar infra
   - **Custo**: $0 (só Redis atual)

2. 🔄 **Otimizar Connection Pooling**
   ```typescript
   // PostgreSQL
   max: 20,
   min: 5,
   idleTimeoutMillis: 30000
   
   // Redis
   maxRetriesPerRequest: 3,
   enableReadyCheck: true
   ```

3. 🔄 **Cache Inteligente**
   - Respostas frequentes (FAQ)
   - Metadata de conversas
   - Templates de mensagens
   - **Ganho**: 40% menos queries

4. 🔄 **Rate Limiting por Usuário**
   - Max 10 mensagens/minuto/usuário
   - Previne spam/DoS
   - Protege recursos

#### Resultado Esperado
- **Capacidade**: 1.000 conv/dia
- **Latência**: <3s por resposta
- **Custo adicional**: $200-300/mês

---

### **FASE 1: Infraestrutura Escalável (Mês 1-2)**
**Objetivo**: Suportar 2.500 conversas/dia

#### Migração de Infra
1. **Cloud Provider Setup**
   - AWS ECS ou Google Cloud Run
   - 3 containers API (auto-scaling)
   - Load balancer (ALB/NLB)
   - **Custo**: $200-300/mês

2. **Upgrade de Serviços**
   - Upstash Redis Pro: $80/mês
   - Neon PostgreSQL Pro: $80/mês
   - Evolution API: 2-3 instâncias ($150/mês)
   - **Custo**: $310/mês

3. **Observabilidade**
   - Prometheus + Grafana (self-hosted)
   - Logs centralizados (Loki)
   - Alertas (PagerDuty free tier)
   - **Custo**: $0-50/mês

#### Arquitetura Resultante
```
                          ┌─────────────┐
WhatsApp ──→ Evolution ──→│ Load Balancer│
                          └──────┬──────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
                 [API-1]      [API-2]      [API-3]
                    │            │            │
                    └────────────┼────────────┘
                                 ▼
                          ┌─────────────┐
                          │  Bull Queue │
                          └──────┬──────┘
                                 ▼
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              [Worker-1]   [Worker-2]   [Worker-3]
                    │            │            │
                    └────────────┼────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  Redis  │  PostgreSQL  │
                    └────────────────────────┘
```

#### Resultado Esperado
- **Capacidade**: 2.500 conv/dia
- **Alta disponibilidade**: 99.5% uptime
- **Custo total**: $1.500-2.000/mês

---

### **FASE 2: Alta Performance (Mês 3-4)**
**Objetivo**: Suportar 5.000 conversas/dia

#### Otimizações Avançadas
1. **Database Read Replicas**
   - 1 master (write)
   - 2 replicas (read)
   - Query routing automático
   - **Ganho**: 5x throughput de leitura

2. **Redis Cluster**
   - 3 nodes (sharding)
   - Failover automático
   - Sentinel para HA
   - **Ganho**: 10x operações/segundo

3. **CDN para Assets**
   - Cloudflare (free tier)
   - Static assets
   - API response caching
   - **Ganho**: 50% menos latência

4. **OpenAI Rate Limit Upgrade**
   - Enterprise tier ou TPM boost
   - Garantia de 5.000 req/min
   - **Custo**: Negociado (volume)

5. **Multi-Instance Evolution API**
   - 6 instâncias balanceadas
   - Round-robin distribution
   - Healthcheck automático
   - **Ganho**: 300 msg/min

#### Resultado Esperado
- **Capacidade**: 5.000 conv/dia
- **Latência P95**: <2s
- **Alta disponibilidade**: 99.9% uptime
- **Custo total**: $3.500-6.000/mês

---

### **FASE 3: Enterprise Scale (Mês 5-6)**
**Objetivo**: Suportar 10.000+ conversas/dia

#### Arquitetura Enterprise
1. **Kubernetes Cluster**
   - Auto-scaling horizontal (HPA)
   - Multi-AZ deployment
   - Blue/green deployments
   - **Ganho**: Elasticidade infinita

2. **Disaster Recovery**
   - Backup automático 4x/dia
   - Recovery Time Objective: <15min
   - Multi-region failover
   - **Ganho**: Business continuity

3. **Performance Tuning**
   - Edge caching (Cloudflare Workers)
   - GraphQL para dashboards
   - Database partitioning
   - **Ganho**: 2x performance geral

4. **Advanced Monitoring**
   - DataDog APM
   - Real User Monitoring
   - Synthetic testing
   - AI anomaly detection
   - **Custo**: $200-300/mês

#### Resultado Esperado
- **Capacidade**: 10.000+ conv/dia
- **SLA**: 99.99% uptime
- **Global latency**: <1s
- **Custo total**: $7.000-12.000/mês

---

## 🎯 Recomendação Estratégica

### **Estratégia Gradual: Crescimento Seguro**

#### **Trimestre 1: Validação (0-1.000 conv/dia)**
- ✅ Implementar filas (esta sprint)
- ✅ Otimizar recursos atuais
- ✅ Coletar métricas reais
- **Investimento**: $500/mês
- **Objetivo**: Validar product-market fit

#### **Trimestre 2: Expansão (1.000-2.500 conv/dia)**
- 🔄 Migrar para cloud
- 🔄 Horizontal scaling
- 🔄 Upgrade de tiers
- **Investimento**: $1.500-2.000/mês
- **Objetivo**: Crescer base de clientes

#### **Trimestre 3: Maturidade (2.500-5.000 conv/dia)**
- 🔄 HA e DR
- 🔄 Multi-region
- 🔄 Advanced monitoring
- **Investimento**: $3.500-6.000/mês
- **Objetivo**: Operação estável em escala

#### **Trimestre 4: Enterprise (5.000-10.000 conv/dia)**
- 🔄 K8s cluster
- 🔄 Global CDN
- 🔄 SLA garantido
- **Investimento**: $7.000-12.000/mês
- **Objetivo**: Liderança de mercado

---

## 📊 Métricas de Monitoramento

### KPIs Críticos para Escalabilidade

#### **Performance**
- **Latência P50/P95/P99**: <1s / <3s / <5s
- **Throughput**: mensagens processadas/segundo
- **Queue depth**: tamanho da fila (alerta >100)
- **Error rate**: <1% de falhas

#### **Recursos**
- **CPU usage**: <70% em médio
- **Memory usage**: <80% em médio
- **Disk I/O**: <60% em pico
- **Network bandwidth**: <500 Mbps

#### **Externos**
- **OpenAI rate limit**: % utilizado
- **Redis commands/s**: vs. quota
- **DB connections**: ativas vs. pool
- **Evolution API queue**: mensagens pendentes

#### **Business**
- **Conversion rate**: conversas → resolução
- **CSAT/NPS**: satisfação do cliente
- **Cost per conversation**: $/conversa
- **Revenue per conversation**: R$/conversa

### Alertas Configurados
```yaml
alerts:
  - name: High Queue Depth
    condition: queue_size > 100
    action: Scale workers +2
    
  - name: High Latency
    condition: p95_latency > 5s
    action: Alert DevOps + Scale API
    
  - name: Rate Limit Approaching
    condition: openai_rpm > 80% quota
    action: Enable throttling
    
  - name: Database Saturation
    condition: db_connections > 90% pool
    action: Alert + Block new conversations
```

---

## 🔧 Implementação do MVP de Filas

### Tecnologias Escolhidas
- **BullMQ**: Sistema de filas robusto (Node.js)
- **Redis**: Backend para BullMQ (já existe)
- **Workers**: Processos separados para processar mensagens

### Arquitetura de Filas

```typescript
// Fluxo
WhatsApp Webhook → Express → Bull Queue → Workers → OpenAI → Response
```

### Filas Criadas
1. **message-processing**: Mensagens do cliente
2. **ai-response**: Respostas da IA
3. **image-analysis**: Análise de imagens (Vision)
4. **nps-survey**: Envio de pesquisas NPS
5. **learning-tasks**: Tarefas do sistema de aprendizado

### Benefícios Imediatos
- ✅ **3x mais capacidade** sem trocar servidor
- ✅ **Retry automático** em falhas
- ✅ **Priorização** de mensagens urgentes
- ✅ **Rate limiting** natural
- ✅ **Visibilidade** do processamento

### Monitoramento de Filas
```typescript
// Métricas expostas
- queue.waiting: mensagens aguardando
- queue.active: sendo processadas
- queue.completed: finalizadas com sucesso
- queue.failed: falharam (com retry)
- queue.delayed: agendadas para depois
```

---

## 🚀 Próximos Passos

### Imediato (Esta Sprint)
1. ✅ Implementar BullMQ e workers
2. ✅ Migrar webhook para usar filas
3. ✅ Adicionar monitoramento básico
4. ✅ Testar com carga simulada

### Curto Prazo (2-4 semanas)
1. Coletar métricas de uso real
2. Otimizar queries de banco
3. Implementar cache Redis avançado
4. Upgrade Upstash para Basic/Pro

### Médio Prazo (2-3 meses)
1. Planejar migração para cloud
2. Setup de CI/CD robusto
3. Testes de carga automatizados
4. Documentação de runbooks

### Longo Prazo (6+ meses)
1. Kubernetes deployment
2. Multi-region expansion
3. Disaster recovery completo
4. SLA de 99.99% uptime

---

## 📝 Conclusão

### Situação Atual
- ✅ **Plataforma funcional** para 500-1.000 conv/dia
- ⚠️ **Não suporta 5.000/dia** sem mudanças estruturais
- 💰 **Custo atual**: $500-800/mês

### Para Alcançar 5.000/dia
- 🔄 **Reestruturação completa** necessária
- 💰 **Investimento**: $3.500-6.000/mês
- ⏱️ **Tempo**: 3-4 meses de desenvolvimento

### Estratégia Recomendada
1. **Fase 0** (agora): MVP de filas → 1.000/dia
2. **Fase 1** (mês 1-2): Cloud migration → 2.500/dia
3. **Fase 2** (mês 3-4): HA setup → 5.000/dia
4. **Fase 3** (mês 5-6): Enterprise → 10.000/dia

### ROI Estimado
- **1.000 conv/dia**: $30k/mês receita - $800 custo = **$29k lucro**
- **5.000 conv/dia**: $150k/mês receita - $6k custo = **$144k lucro**
- **10.000 conv/dia**: $300k/mês receita - $12k custo = **$288k lucro**

**Payback**: Investimento de $20-30k em dev pago em 1-2 meses de operação

---

*Última atualização: Outubro 2025*
*Próxima revisão: Após 30 dias de métricas reais*
