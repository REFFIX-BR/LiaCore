# Sistema de Filas BullMQ - Configuração Pendente

## Status Atual

✅ **Implementado:**
- Estrutura de filas BullMQ instalada e configurada
- Workers para processamento assíncrono de mensagens
- Webhook integrado com sistema de filas
- Retry logic e error handling implementados

❌ **Bloqueio de Produção:**
- Redis TCP nativo NÃO configurado
- Apenas Upstash Redis REST API disponível
- Workers não conseguem se conectar ao Redis

## Problema Técnico

### O Que Está Acontecendo

BullMQ (sistema de filas) **requer conexão Redis TCP nativa** para funcionar:
- Protocolo: TCP (porta 6379 ou 6380 com TLS)
- Comandos: BLOCKING (BLPOP, BRPOPLPUSH, etc.)
- Requirement: `maxRetriesPerRequest: null`

### O Que Está Configurado

Upstash Redis está configurado apenas para REST API:
```bash
UPSTASH_REDIS_REST_URL=https://still-trout-8995.upstash.io
UPSTASH_REDIS_REST_TOKEN=ASMjAAImcDJkODkwNTQ3YTBhM2Q0OTc1YmYwMzI3OGI1ZTNhNmVmNHAyODk5NQ
```

**Problema**: REST API usa HTTP, não TCP - incompatível com BullMQ!

## Como Resolver

### Opção 1: Configurar Upstash Redis TCP (Recomendado para Produção)

1. Acesse o dashboard Upstash: https://console.upstash.com/redis
2. Selecione o database Redis (ainda não criado para TCP)
3. Na aba "Details", copie as credenciais TCP:
   - `UPSTASH_REDIS_HOST` (ex: still-trout-8995.upstash.io)
   - `UPSTASH_REDIS_PORT` (ex: 6379 ou 33775)
   - `UPSTASH_REDIS_PASSWORD` (token de autenticação)

4. Adicione as variáveis de ambiente no Replit:
   ```bash
   UPSTASH_REDIS_HOST=<seu-host>.upstash.io
   UPSTASH_REDIS_PORT=6379
   UPSTASH_REDIS_PASSWORD=<seu-password>
   ```

5. Reinicie a aplicação - workers iniciarão automaticamente

### Opção 2: Usar Redis Serverless Alternative (Temporário)

Para desenvolvimento/teste local, pode-se usar alternativas in-memory, mas **NÃO recomendado para produção** pois perde jobs em caso de restart.

## Estado Atual do Sistema

### O Que Funciona Agora (Fallback)

O webhook ainda está processando mensagens de forma **assíncrona** sem filas:
- Webhook retorna 200 OK imediatamente ✅
- Processamento ocorre em background ✅
- Não há retry automático em caso de falha ❌
- Não há controle de concorrência ❌
- Não há persistência de jobs ❌

### O Que Funcionará Com Redis TCP

Quando configurado, o sistema terá:
- ✅ Retry automático (3 tentativas com backoff exponencial)
- ✅ Persistência de jobs (sobrevive a restarts)
- ✅ Controle de concorrência (5 workers paralelos)
- ✅ Rate limiting (10 jobs/segundo)
- ✅ Monitoramento de filas (waiting, active, completed, failed)
- ✅ **3x aumento de capacidade** (estimado)

## Próximos Passos

**AÇÃO NECESSÁRIA:**

1. ⚠️ **Configurar Upstash Redis TCP** (variáveis de ambiente acima)
2. ✅ Reiniciar aplicação
3. ✅ Verificar logs: `"✅ [Workers] Queue workers initialized"`
4. ✅ Testar envio de mensagem WhatsApp
5. ✅ Monitorar filas via `/api/queue/metrics` (quando implementado)

## Arquivos Criados

- `server/lib/queue.ts` - Configuração das 5 filas BullMQ
- `server/workers.ts` - Workers de processamento assíncrono
- `server/index.ts` - Inicialização dos workers (linha 81-85)
- `server/routes.ts` - Webhook integrado com filas (linha 1276-1298)

## Estimativa de Capacidade

**Sem Filas (Atual):**
- ~500-800 conversas/dia
- Limitado por event loop blocking

**Com Filas (Após Config Redis):**
- ~1,000-1,500 conversas/dia
- Processamento paralelo com 5 workers
- Retry automático em falhas

**Escalado (Futuro):**
- ~2,000-3,000 conversas/dia
- Workers em processos separados
- Redis cluster para alta disponibilidade

---

**Criado em**: 2025-10-10  
**Status**: ⏸️ Aguardando configuração Redis TCP  
**Prioridade**: 🔴 Alta (blocker para escala)
