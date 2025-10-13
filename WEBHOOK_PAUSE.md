# 🛑 Sistema de Pausa do Webhook Evolution API

## Como Pausar o Webhook (Para Evitar Receber Mensagens)

### Método 1: Via Secrets (Recomendado)
1. Vá até a aba **Secrets** (🔒) no painel lateral do Replit
2. Adicione um novo secret:
   - **Key**: `WEBHOOK_PAUSED`
   - **Value**: `true`
3. O servidor irá automaticamente pausar o processamento de webhooks

### Método 2: Via Terminal
```bash
export WEBHOOK_PAUSED=true
```

## Como Reativar o Webhook

### Método 1: Via Secrets
1. Vá até a aba **Secrets**
2. Delete o secret `WEBHOOK_PAUSED` OU altere o valor para `false`

### Método 2: Via Terminal
```bash
unset WEBHOOK_PAUSED
```

## O Que Acontece Quando Pausado?

✅ **Webhook continua funcionando** - Evolution API não recebe erro
✅ **Todas as mensagens são ignoradas** - Nada é processado ou armazenado
✅ **Log claro**: `⏸️ [Evolution] Webhook pausado - ignorando evento`
✅ **Resposta HTTP 200** com `{ processed: false, reason: "webhook_paused" }`

## Quando Usar?

- 🔧 Durante manutenção ou ajustes
- 🧪 Quando estiver testando localmente
- 📝 Ao atualizar configurações de assistentes OpenAI
- 🛠️ Para evitar processar mensagens durante deploys

## Status Atual

Para verificar se está pausado, procure no log por:
```
⏸️ [Evolution] Webhook pausado - ignorando evento
```

---

**Implementado em**: 2024-10-13
**Arquivo**: `server/routes.ts` (linha 1342)
