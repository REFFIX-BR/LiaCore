# Variáveis de Ambiente - LIA CORTEX

## ✅ Nomes Corretos das Variáveis de Ambiente

Use **EXATAMENTE** estes nomes na aba Secrets do Replit (produção):

### OpenAI API Key
```
OPENAI_API_KEY=sk-proj-xxxxx
```

### Assistant IDs

```
CORTEX_ASSISTANT_ID=asst_xxxxx
OPENAI_APRESENTACAO_ASSISTANT_ID=asst_xxxxx
OPENAI_COMMRCIAL_ASSISTANT_ID=asst_xxxxx
OPENAI_FINANCEIRO_ASSISTANT_ID=asst_xxxxx
OPENAI_SUPORTE_ASSISTANT_ID=asst_xxxxx
OPENAI_OUVIDOIRA_ASSISTANT_ID=asst_xxxxx
OPENAI_CANCELAMENTO_ASSISTANT_ID=asst_xxxxx
```

**⚠️ ATENÇÃO AOS TYPOS:**
- `OPENAI_COMMRCIAL_ASSISTANT_ID` (tem typo no nome: COMMRCIAL ao invés de COMMERCIAL)
- `OPENAI_OUVIDOIRA_ASSISTANT_ID` (tem typo no nome: OUVIDOIRA ao invés de OUVIDORIA)

Esses typos estão no código, então você **precisa** usar os nomes com erro mesmo!

### Redis (Upstash)
```
UPSTASH_REDIS_REST_URL=https://xxxxx
UPSTASH_REDIS_REST_TOKEN=xxxxx
UPSTASH_REDIS_HOST=xxxxx
UPSTASH_REDIS_PORT=6379
UPSTASH_REDIS_PASSWORD=xxxxx
```

### Database
```
DATABASE_URL=postgresql://xxxxx
```

### Evolution API (WhatsApp)

**⚠️ IMPORTANTE: A URL precisa estar CORRETA para evitar erros!**

```bash
# ✅ CORRETO - Com protocolo https:// e sem espaços
EVOLUTION_API_URL=https://evolutionapi.trtelecom.net

# ❌ ERRADO - Sem protocolo
EVOLUTION_API_URL=evolutionapi.trtelecom.net

# ❌ ERRADO - Com espaços extras (causa erro: "Failed to parse URL")
EVOLUTION_API_URL=evolutionapi.trtelecom.net /message

# Outras configurações
EVOLUTION_API_KEY=xxxxx
EVOLUTION_INSTANCE=xxxxx  # Ex: Leads, Atendimento, etc.
```

**Dicas:**
- A URL **DEVE** começar com `https://` (ou `http://`)
- **NÃO** adicione barra no final: ~~`https://api.com/`~~ → `https://api.com` ✅
- **NÃO** deixe espaços antes ou depois da URL
- O sistema agora corrige automaticamente URLs sem protocolo

---

## 🔍 Como Verificar se Está Correto

### 1. Via API Health Check
```bash
curl https://seu-app.replit.app/api/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "openai": {
    "assistantsConfigured": ["cortex", "apresentacao", "comercial", "financeiro", "suporte", "ouvidoria", "cancelamento"],
    "assistantsMissing": [],
    "isValid": true
  }
}
```

### 2. Via Logs de Produção
No Publishing → Logs, procure por:
```
✅ [OpenAI] Todos os 7 assistants configurados: cortex, apresentacao, comercial, financeiro, suporte, ouvidoria, cancelamento
```

Se aparecer:
```
❌ [OpenAI] Variável de ambiente faltando: APRESENTACAO_ASSISTANT_ID
```

Significa que você usou o nome errado!

---

## 🐛 Problema Resolvido

**Antes:** O `workers.ts` estava procurando variáveis com nomes diferentes:
- ❌ `OPENAI_ASSISTANT_APRESENTACAO_ID` (errado)
- ✅ `OPENAI_APRESENTACAO_ASSISTANT_ID` (correto)

**Agora:** Ambos os arquivos usam os mesmos nomes padronizados do `openai.ts`.

---

## 📋 Checklist para Produção

- [ ] Todas as 7 variáveis de assistants configuradas
- [ ] Nomes **exatamente** iguais aos listados acima (incluindo os typos!)
- [ ] Republicar após adicionar variáveis
- [ ] Verificar logs: procurar por "✅ [OpenAI] Todos os 7 assistants configurados"
- [ ] Testar endpoint: `/api/health` deve retornar `"isValid": true`
