# Análise de Warnings Intermitentes de Backend

**Data:** 12 de outubro de 2024  
**Status:** Investigação completa ✅

## 🔍 Warnings Identificados

### 1. WebSocket Error - Vite HMR ⚠️ (Benigno)

**Erro:**
```
Failed to construct 'WebSocket': The URL 'wss://localhost:undefined/?token=...' is invalid
```

**Stack Trace:**
```
at setupWebSocket (@vite/client:536:19)
at fallback (@vite/client:509:16)
```

**Causa Raiz:**
- Não é do nosso código! É do **Vite Hot Module Replacement (HMR)**
- Vite tenta conectar WebSocket para live reload mas não consegue determinar porta corretamente no ambiente Replit
- URL gerada: `wss://localhost:undefined/?token=...` (porta undefined)

**Impacto:**
- ✅ **Nenhum** - Warning benigno
- Vite tem mecanismo de fallback automático
- HMR funciona corretamente mesmo com o warning
- Não afeta funcionalidade da aplicação

**Solução:**
- **Nenhuma ação necessária**
- Documentado como conhecido e benigno
- Alternativa (opcional): Configurar `server.hmr.port` no vite.config.ts

---

### 2. "Conversation not found" ⚠️ (Race Condition)

**Erro:**
```
Conversation not found: <conversationId>
```

**Locais identificados:**

#### A. Routes (server/routes.ts)
- **Linha 2531:** GET `/api/conversations/:id`
- **Linha 3824:** GET `/api/conversations/:id` 
- **Linha 3854:** GET `/api/conversations/:id/messages`
- **Linha 3931:** POST `/api/conversations/:id/agent-response`

**Comportamento:** Retorna 404 quando conversa não existe (esperado)

#### B. Workers (server/workers.ts - linha 144)
```typescript
const conversation = await storage.getConversation(conversationId);

if (!conversation) {
  prodLogger.error('worker', 'Conversation not found', 
    new Error(`Conversation not found: ${conversationId}`), {
    conversationId,
    fromNumber,
    jobId: job.id,
  });
  throw new Error(`Conversation not found: ${conversationId}`);
}
```

**Causa Raiz - Race Condition:**
1. Job é enfileirado com `conversationId` 
2. Antes do worker processar, conversa é deletada/arquivada
3. Worker tenta buscar conversa → não existe mais
4. Log de erro é gerado

**Cenários que causam:**
- Usuário deleta conversa enquanto mensagem está na fila
- Admin arquiva/remove conversa com jobs pendentes
- Teste automatizado que cria/deleta conversas rapidamente
- Cleanup automático executado durante processamento

**Impacto:**
- ⚠️ **Baixo** - Job falha mas não quebra sistema
- BullMQ tem retry automático (3 tentativas)
- Após retries, job vai para dead letter queue
- Não afeta outras conversas

**Soluções Recomendadas:**

### Solução 1: Fail Gracefully (Implementar)
```typescript
// server/workers.ts
if (!conversation) {
  prodLogger.warning('worker', 'Conversation deleted before processing', {
    conversationId,
    fromNumber,
    jobId: job.id,
  });
  
  // Marcar job como completo sem erro (conversa foi deletada intencionalmente)
  return { 
    status: 'skipped', 
    reason: 'conversation_deleted',
    conversationId 
  };
}
```

### Solução 2: Verificação Pré-Enfileiramento
```typescript
// Antes de adicionar job à fila
const conversationExists = await storage.getConversation(conversationId);
if (!conversationExists) {
  logger.warning('Tentativa de enfileirar job para conversa inexistente', { conversationId });
  return; // Não enfileira
}

await messageQueue.add('process-message', { conversationId, ... });
```

### Solução 3: Soft Delete (Mais robusto)
```typescript
// Ao invés de deletar, marcar como archived
await storage.updateConversation(id, { 
  status: 'archived',
  archivedAt: new Date().toISOString()
});

// Workers ignoram conversas arquivadas
if (conversation.status === 'archived') {
  return { status: 'skipped', reason: 'archived' };
}
```

---

## 📊 Priorização

| Warning | Severidade | Impacto | Ação Recomendada |
|---------|-----------|---------|------------------|
| WebSocket Vite HMR | Baixa | Nenhum | ✅ Documentar apenas |
| Conversation not found | Média | Baixo | 🔧 Implementar Solução 1 |

---

## ✅ Próximos Passos

### Implementação Imediata:
1. ✅ Documentar warnings conhecidos
2. 🔧 Implementar "fail gracefully" no worker (Solução 1)
3. 📊 Adicionar métrica de jobs skipped

### Implementação Futura:
- Considerar soft delete para conversas (Solução 3)
- Adicionar verificação pré-enfileiramento (Solução 2)
- Dashboard para monitorar jobs skipped/failed

---

## 📈 Métricas Sugeridas

Adicionar ao dashboard de analytics:
- Jobs skipped por "conversation_deleted"
- Taxa de falha por tipo de worker
- Tempo médio entre enfileiramento e processamento
- Dead letter queue size
