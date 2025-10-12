# Guia de Verificação - RAG Analytics

## 📊 Como Verificar as Informações do Sistema RAG Analytics

### ✅ Sistema Instalado

A tabela `rag_analytics` foi criada com sucesso e está pronta para coletar dados.

**Estrutura:**
- `id` - Identificador único
- `conversation_id` - ID da conversa
- `assistant_type` - Tipo de assistant (suporte, financeiro, etc)
- `query` - Query enviada ao RAG
- `results_count` - Quantidade de resultados encontrados
- `results_found` - Boolean se encontrou resultados
- `sources` - JSONB com as fontes retornadas
- `execution_time` - Tempo de execução em ms
- `created_at` - Data/hora do registro

**Índices criados:**
- `idx_rag_conversation` - Por conversation_id
- `idx_rag_assistant` - Por assistant_type  
- `idx_rag_created` - Por created_at

---

## 🔍 Formas de Verificar os Dados

### 1. **Via SQL Direto (Development Database)**

**Ver últimos 10 registros:**
```sql
SELECT 
  id,
  assistant_type,
  query,
  results_count,
  results_found,
  execution_time,
  created_at
FROM rag_analytics
ORDER BY created_at DESC
LIMIT 10;
```

**Resumo por Assistant:**
```sql
SELECT 
  assistant_type,
  COUNT(*) as total_queries,
  AVG(results_count) as avg_results,
  SUM(CASE WHEN results_found THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
  AVG(execution_time) as avg_execution_ms
FROM rag_analytics
GROUP BY assistant_type
ORDER BY total_queries DESC;
```

**Top 10 Queries Mais Frequentes:**
```sql
SELECT 
  query,
  COUNT(*) as frequency,
  AVG(results_count) as avg_results,
  AVG(execution_time) as avg_time_ms
FROM rag_analytics
GROUP BY query
ORDER BY frequency DESC
LIMIT 10;
```

**Analytics por Conversa Específica:**
```sql
SELECT 
  assistant_type,
  query,
  results_count,
  results_found,
  execution_time,
  created_at
FROM rag_analytics
WHERE conversation_id = 'SEU_CONVERSATION_ID'
ORDER BY created_at;
```

---

### 2. **Via API Endpoints (Produção)**

Os endpoints estão protegidos e requerem autenticação.

**a) Resumo Geral (ADMIN only)**
```bash
# Últimos 7 dias (padrão)
curl -X GET "http://localhost:5000/api/rag-analytics/summary" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"

# Com filtro de data específico
curl -X GET "http://localhost:5000/api/rag-analytics/summary?start=2024-10-01&end=2024-10-15" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Resposta esperada:**
```json
{
  "totalQueries": 150,
  "successRate": 0.87,
  "avgExecutionTime": 245,
  "byAssistant": {
    "suporte": {
      "count": 80,
      "successRate": 0.90
    },
    "financeiro": {
      "count": 45,
      "successRate": 0.85
    }
  },
  "topQueries": [
    {
      "query": "configurar wifi",
      "count": 25,
      "avgResults": 3.2
    }
  ]
}
```

**b) Analytics por Conversa (ADMIN ou agente atribuído)**
```bash
curl -X GET "http://localhost:5000/api/rag-analytics/conversation/CONVERSATION_ID" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Resposta esperada:**
```json
[
  {
    "id": "uuid-123",
    "conversationId": "conv-456",
    "assistantType": "suporte",
    "query": "configurar controle parental",
    "resultsCount": 3,
    "resultsFound": true,
    "sources": [...],
    "executionTime": 234,
    "createdAt": "2024-10-12T10:30:00Z"
  }
]
```

**c) Lista Completa com Filtros (ADMIN only)**
```bash
# Últimos 30 dias (padrão)
curl -X GET "http://localhost:5000/api/rag-analytics" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Com filtro de data específico
curl -X GET "http://localhost:5000/api/rag-analytics?start=2024-10-01&end=2024-10-15" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

---

### 3. **Via Frontend (Futuro - Dashboard)**

Quando implementado o dashboard de analytics, você poderá visualizar:

**Métricas em Tempo Real:**
- Taxa de uso do RAG por assistant
- Taxa de sucesso (queries que retornam resultados)
- Tempo médio de execução
- Top queries mais frequentes

**Filtros Disponíveis:**
- Por período (data início/fim)
- Por tipo de assistant
- Por conversa específica
- Por taxa de sucesso

**Visualizações:**
- Gráficos de linha (uso ao longo do tempo)
- Gráficos de pizza (distribuição por assistant)
- Tabelas de top queries
- Métricas de performance

---

## 🧪 Como Testar o Tracking

### Opção 1: Via Test Chat

1. Acesse o **Test Chat** no sistema
2. Faça uma pergunta que acione o RAG:
   - "Como configurar controle parental?"
   - "O que significa erro PPPoE 691?"
   - "Como trocar senha do WiFi?"
3. Verifique no banco de dados:

```sql
SELECT * FROM rag_analytics 
ORDER BY created_at DESC 
LIMIT 1;
```

### Opção 2: Via Evolution API (WhatsApp)

1. Envie uma mensagem via WhatsApp que acione o RAG
2. Aguarde a resposta do assistant
3. Verifique o registro:

```sql
SELECT 
  a.*,
  c.client_name,
  c.client_phone
FROM rag_analytics a
LEFT JOIN conversations c ON c.id = a.conversation_id
ORDER BY a.created_at DESC
LIMIT 5;
```

---

## 📈 Monitoramento Recomendado

### Métricas Chave (KPIs)

**Taxa de Uso do RAG:**
- **Baseline:** 60-70%
- **Meta:** 85%+
- **Como calcular:** (queries_rag / total_mensagens) * 100

**Taxa de Sucesso:**
- **Baseline:** 80-85%
- **Meta:** 95%+
- **Como calcular:** (results_found=true / total_queries) * 100

```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN results_found THEN 1 ELSE 0 END) as success_count,
  (SUM(CASE WHEN results_found THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as success_rate
FROM rag_analytics
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**Tempo Médio de Execução:**
- **Baseline:** 200-300ms
- **Meta:** <200ms
- **Como calcular:** AVG(execution_time)

```sql
SELECT 
  assistant_type,
  AVG(execution_time) as avg_ms,
  MIN(execution_time) as min_ms,
  MAX(execution_time) as max_ms
FROM rag_analytics
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY assistant_type;
```

---

## 🔐 Segurança e Permissões

### Quem pode acessar:

**Endpoints de Resumo e Lista Completa:**
- ✅ ADMIN apenas
- ❌ SUPERVISOR não tem acesso
- ❌ AGENT não tem acesso

**Endpoint por Conversa:**
- ✅ ADMIN sempre
- ✅ SUPERVISOR/AGENT se for conversa atribuída a eles
- ❌ Outros sem permissão

### Validações Implementadas:

- ✅ Formato de data validado (ISO 8601)
- ✅ Range de datas validado (start < end)
- ✅ Conversation ID validado (existência + ownership)
- ✅ Error handling robusto (400, 403, 404, 500)
- ✅ Fail-safe tracking (não impacta funcionalidade principal)

---

## 🚀 Próximos Passos

### Fase de Monitoramento (7-14 dias)

1. **Coleta de Dados Baseline:**
   - Deixar o sistema coletar dados por 7-14 dias
   - Não fazer mudanças no RAG durante esse período

2. **Análise Semanal:**
   ```sql
   -- Report semanal
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as queries,
     AVG(results_count) as avg_results,
     AVG(execution_time) as avg_ms
   FROM rag_analytics
   WHERE created_at >= NOW() - INTERVAL '7 days'
   GROUP BY DATE(created_at)
   ORDER BY date;
   ```

3. **Decisão sobre Fase 2:**
   - Se falhas por API changes > 5% → Implementar interpreters
   - Se confusão em exemplos > 10% → Revisar few-shot
   - Se baixo uso RAG → Refinar guias

---

## 📝 Checklist de Verificação

### Verificação Inicial (Agora):
- [x] Tabela `rag_analytics` criada
- [x] Índices criados (conversation_id, assistant_type, created_at)
- [x] Tracking automático implementado em `openai.ts`
- [x] API endpoints criados e seguros
- [x] Validações robustas implementadas

### Verificação Pós-Deploy:
- [ ] Primeiro registro de RAG coletado
- [ ] Endpoints retornando dados corretamente
- [ ] Permissões funcionando (ADMIN vs AGENT)
- [ ] Performance adequada (< 200ms execution time)

### Verificação Semanal (7 dias):
- [ ] Taxa de uso RAG calculada
- [ ] Taxa de sucesso analisada
- [ ] Top queries identificadas
- [ ] Problemas/patterns detectados

---

## 🛠️ Troubleshooting

### Problema: Dados não aparecem na tabela

**Possíveis causas:**
1. RAG não está sendo usado (clientes não fazem perguntas adequadas)
2. Tracking falhou (verificar logs de erro)
3. Função `consultar_base_de_conhecimento` não sendo chamada

**Como verificar:**
```bash
# Ver logs do worker
tail -f logs/workers.log | grep "RAG analytics"

# Verificar se RAG está sendo chamado
grep "consultar_base_de_conhecimento" logs/app.log
```

### Problema: Endpoint retorna erro 403

**Causa:** Usuário sem permissão

**Solução:** 
- Verificar role do usuário no banco
- Usar conta ADMIN para endpoints de resumo
- Verificar se agente está atribuído à conversa

### Problema: Performance ruim (> 500ms)

**Possíveis causas:**
1. Base de conhecimento muito grande
2. Upstash Vector lento
3. Muitos resultados retornados

**Como verificar:**
```sql
SELECT 
  query,
  execution_time,
  results_count
FROM rag_analytics
WHERE execution_time > 500
ORDER BY execution_time DESC;
```

---

**Última atualização:** 12 de Outubro de 2024  
**Versão:** 1.0  
**Autor:** Sistema RAG Analytics
