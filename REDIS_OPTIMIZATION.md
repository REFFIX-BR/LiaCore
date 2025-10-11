# 🚀 Guia de Otimização Redis - LIA CORTEX

## 📊 Economia Estimada

Com as otimizações implementadas, você pode reduzir **60-80%** dos comandos Redis:

| Operação | Antes | Depois | Economia |
|----------|-------|--------|----------|
| Salvar thread + metadata | 2 requests | 1 request | **50%** |
| Cache de assistants | N requests/min | 0 requests/hora | **~100%** |
| Contadores (1000 msgs) | 1000 requests | 1 request/min | **99%** |
| Buscar múltiplas threads (10) | 10 requests | 1 request | **90%** |

**Total estimado**: De 10.000 requests/dia → **3.000 requests/dia** (-70%)

---

## 🎯 Sistemas Implementados

### 1. Cache Local em Memória

**Arquivo**: `server/lib/redis-cache.ts`

Cache híbrido que prioriza memória local antes de buscar no Redis.

#### Uso:
```typescript
import { getCached, localCache } from './lib/redis-cache';

// Cache híbrido automático (local + Redis)
const data = await getCached(
  redis,
  'minha-chave',
  async () => {
    // Fetcher: executado apenas se não houver cache
    return await buscarDadosPesados();
  },
  {
    localTTL: 5 * 60 * 1000,  // 5 min em memória (0 requests Redis!)
    redisTTL: 3600,            // 1h no Redis (backup)
  }
);

// Cache de assistants (exemplo já implementado)
import { getCachedAssistants } from './lib/redis-config';

const assistants = await getCachedAssistants(async () => {
  return {
    suporte: 'asst_xxx',
    comercial: 'asst_yyy'
  };
});
// Primeira chamada: 1 request Redis
// Próximas chamadas (1h): 0 requests! ✨
```

---

### 2. Pipelines Redis

**Arquivo**: `server/lib/upstash.ts`

Agrupa múltiplas operações em 1 único request.

#### Antes (ineficiente):
```typescript
await redis.set(`thread:${chatId}`, threadId, { ex: 604800 });
await redis.set(`metadata:${chatId}`, JSON.stringify(metadata), { ex: 604800 });
// 2 requests
```

#### Depois (otimizado):
```typescript
import { storeConversationThread } from './lib/upstash';

await storeConversationThread(chatId, threadId, metadata);
// 1 request! ✨
```

#### Criar seu próprio pipeline:
```typescript
const pipeline = redis.pipeline();

pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
pipeline.incr('counter');
pipeline.hset('user:1', { name: 'João', age: 25 });

await pipeline.exec();
// 4 comandos = 1 request!
```

---

### 3. Batch Updates para Contadores

**Arquivo**: `server/lib/stats-optimizer.ts`

Acumula contadores localmente e envia em lote a cada 1 minuto.

#### Antes (ineficiente):
```typescript
await redis.incr('stats:messages')  // 1 request por mensagem
await redis.incr('stats:messages')  // 1 request por mensagem
await redis.incr('stats:messages')  // 1 request por mensagem
// 3 requests
```

#### Depois (otimizado):
```typescript
import { 
  incrementMessageCount, 
  incrementConversationCount,
  incrementAssistantUsage 
} from './lib/stats-optimizer';

// Acumula localmente (0 requests)
incrementMessageCount();
incrementMessageCount();
incrementMessageCount();

// Auto-flush após 60s = 1 request para todas!
```

#### Contadores Disponíveis:
```typescript
incrementMessageCount(amount);           // Mensagens
incrementConversationCount(amount);      // Conversas
incrementAssistantUsage(type, amount);   // Uso por assistente
incrementAIResponseCount(amount);        // Respostas AI
incrementErrorCount(errorType, amount);  // Erros

// Flush manual (se urgente)
await flushStats();
```

---

### 4. Hashes ao Invés de Múltiplas Keys

#### Antes (ineficiente):
```typescript
await redis.set('user:1:name', 'João')
await redis.set('user:1:age', 25)
await redis.set('user:1:email', 'joao@email.com')
// 3 requests para salvar, 3 para buscar = 6 total
```

#### Depois (otimizado):
```typescript
// Salvar
await redis.hset('user:1', { 
  name: 'João', 
  age: 25, 
  email: 'joao@email.com' 
});

// Buscar tudo de uma vez
const user = await redis.hgetall('user:1');
// 1 request para salvar, 1 para buscar = 2 total (67% economia)
```

---

### 5. Multi-Get para Buscar Múltiplas Keys

**Arquivo**: `server/lib/redis-cache.ts` (função `getMultipleThreads`)

#### Antes (ineficiente):
```typescript
const thread1 = await redis.get('thread:1')  // 1 request
const thread2 = await redis.get('thread:2')  // 1 request
const thread3 = await redis.get('thread:3')  // 1 request
// 3 requests
```

#### Depois (otimizado):
```typescript
import { getMultipleThreads } from './lib/redis-cache';

const threads = await getMultipleThreads(redis, [1, 2, 3]);
// 1 request usando pipeline! ✨
```

---

### 6. TTL Automático

Sempre use TTL para dados temporários - evita comandos `DEL` manuais:

```typescript
// Cache com expiração automática
await redis.set('cache:weather', data, {
  ex: 1800  // 30 minutos - auto-deleta
});

// Thread de conversa expira em 7 dias
await redis.setex(`thread:${id}`, 604800, threadId);
```

---

## 📈 Monitoramento

### Ver estatísticas de cache:
```typescript
import { logCacheStats } from './lib/redis-cache';

logCacheStats();
// Output:
// 📊 [Cache Stats] {
//   localCacheSize: 15,
//   batchCounters: 8
// }
```

### Invalidar cache de assistants:
```typescript
import { invalidateAssistantsCache } from './lib/redis-config';

// Quando assistants são atualizados
invalidateAssistantsCache();
```

---

## 🎯 Boas Práticas

### ✅ FAÇA:
1. **Use pipelines** para múltiplas operações relacionadas
2. **Use hashes** para dados estruturados (objetos)
3. **Use cache local** para dados que quase nunca mudam (assistants, configs)
4. **Use batch updates** para contadores/estatísticas
5. **Use TTL** para dados temporários
6. **Use MGET** para buscar múltiplas keys

### ❌ NÃO FAÇA:
1. ❌ Não faça loops de requests Redis
2. ❌ Não use múltiplas keys quando pode usar hash
3. ❌ Não faça `await redis.incr()` a cada mensagem
4. ❌ Não busque dados estáticos sem cache
5. ❌ Não esqueça de usar TTL em dados temporários

---

## 🚀 Implementação no Projeto

### Já Implementado:

1. ✅ **Cache local de assistants** (`redis-config.ts`)
   - 1h cache local (quase nenhum request)
   - 6h cache Redis (backup)

2. ✅ **Pipeline para threads** (`upstash.ts`)
   - `storeConversationThread` salva thread + metadata em 1 request

3. ✅ **Multi-get threads** (`redis-cache.ts`)
   - `getMultipleThreads` busca N threads em 1 request

4. ✅ **Sistema de batch updates** (`stats-optimizer.ts`)
   - Auto-flush a cada 60 segundos
   - Pronto para uso em contadores

### Próximos Passos para Usar:

1. **Implementar batch stats nos workers**:
   ```typescript
   // Em server/workers.ts
   import { incrementMessageCount } from './lib/stats-optimizer';
   
   // Ao processar mensagem:
   incrementMessageCount();
   ```

2. **Usar cache de assistants em routing**:
   ```typescript
   // Já implementado em redis-config.ts
   // Basta usar getCachedAssistants() onde precisar
   ```

3. **Otimizar outras queries com pipeline**:
   ```typescript
   // Sempre que fizer múltiplas operações, use pipeline!
   const pipeline = redis.pipeline();
   pipeline.get('key1');
   pipeline.hgetall('key2');
   pipeline.incr('counter');
   const results = await pipeline.exec();
   ```

---

## 💰 ROI (Retorno sobre Investimento)

Considerando Upstash pricing ($0.20 por 100k requests):

**Antes**: 10.000 requests/dia × 30 dias = 300k requests/mês
- Custo: **$0.60/mês**

**Depois**: 3.000 requests/dia × 30 dias = 90k requests/mês  
- Custo: **$0.18/mês**

**Economia**: **$0.42/mês** (-70%)

Para apps maiores (100k requests/dia):
- Antes: 3M requests/mês = **$6/mês**
- Depois: 900k requests/mês = **$1.80/mês**
- **Economia: $4.20/mês** (-70%)

---

## 🔧 Troubleshooting

### Cache não está funcionando?
```typescript
// Force invalidate
localCache.clear();
await redis.del('minha-chave');
```

### Batch não está enviando?
```typescript
// Force flush manual
import { flushStats } from './lib/stats-optimizer';
await flushStats();
```

### Pipeline deu erro?
```typescript
// Verifique se todos os comandos são válidos
const results = await pipeline.exec();
// results[i] pode conter erro se comando[i] falhou
```

---

## 📚 Referências

- [Upstash Redis Docs](https://upstash.com/docs/redis)
- [Pipeline API](https://upstash.com/blog/pipeline)
- [Redis Best Practices](https://redis.io/docs/manual/pipelining/)
