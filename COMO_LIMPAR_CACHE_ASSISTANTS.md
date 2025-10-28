# 🗑️ COMO LIMPAR CACHE DE INSTRUÇÕES DOS ASSISTANTS

## 🚨 PROBLEMA IDENTIFICADO

Quando você atualiza as instruções de um assistente no **OpenAI Dashboard**, o sistema LIA CORTEX **continua usando as instruções antigas** porque elas ficam em **cache por 24 horas**.

**Exemplo real:**
```
✅ Você atualizou o prompt do Financeiro no OpenAI Dashboard às 14h
❌ Sistema continua usando o prompt antigo até às 14h do dia seguinte
🔴 Clientes continuam recebendo respostas com o comportamento antigo
```

---

## ✅ SOLUÇÃO: ENDPOINT DE LIMPEZA DE CACHE

Foi criado o endpoint `/api/admin/clear-assistant-cache` que **limpa imediatamente** o cache de todos os 6 assistants.

### 📋 Como Usar (Opção 1: Via Interface Web - Recomendado)

**AINDA NÃO IMPLEMENTADO** - Será adicionado um botão no Dashboard Admin.

Por enquanto, use a **Opção 2** abaixo.

---

### 🔧 Como Usar (Opção 2: Via curl/Postman)

#### Passo 1: Fazer Login como Admin
1. Acesse: https://[seu-dominio].replit.app/login
2. Faça login com usuário ADMIN
3. Copie o cookie de sessão do navegador (F12 → Application → Cookies)

#### Passo 2: Executar o Comando

**No terminal do Replit:**
```bash
curl -X POST http://localhost:5000/api/admin/clear-assistant-cache \
  -H "Content-Type: application/json" \
  --cookie "connect.sid=SEU_COOKIE_AQUI"
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Cache de instruções dos assistants limpo com sucesso. As novas instruções do OpenAI Dashboard serão carregadas na próxima interação.",
  "clearedAssistants": [
    "apresentacao",
    "comercial", 
    "financeiro",
    "suporte",
    "ouvidoria",
    "cancelamento"
  ]
}
```

---

### 🎯 Como Usar (Opção 3: Direto no Console do Navegador) ⭐ RECOMENDADO

**⚠️ IMPORTANTE: Execute no console DA APLICAÇÃO, NÃO no console do Replit.com!**

1. **Abra a aplicação** no navegador:
   - URL: `https://[seu-projeto].replit.app` ou
   - Clique no botão "Webview" no Replit

2. **Faça login como ADMIN** no sistema

3. **Abra o Console do navegador**:
   - Pressione **F12** (Windows/Linux) ou **Cmd+Option+J** (Mac)
   - Vá para a aba **Console**
   - ✅ Certifique-se que a URL na barra de endereços é a da sua aplicação (termina com `.replit.app`)

4. **Cole e execute este código**:

```javascript
fetch('/api/admin/clear-assistant-cache', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log('✅ Cache limpo:', data))
.catch(err => console.error('❌ Erro:', err));
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Cache de instruções dos assistants limpo com sucesso...",
  "clearedAssistants": ["apresentacao", "comercial", "financeiro", "suporte", "ouvidoria", "cancelamento"]
}
```

**Possíveis erros:**

❌ **Erro: 403 Forbidden**
- **Causa**: Você não está logado como ADMIN
- **Solução**: Faça logout e login novamente com credenciais de ADMIN

❌ **Erro: "POST https://replit.com/api/admin/clear-assistant-cache 403"**
- **Causa**: Você está no console ERRADO (console do replit.com)
- **Solução**: Abra a aplicação (`.replit.app`) e execute lá

❌ **Erro: "Não autenticado"**
- **Causa**: Sessão expirada
- **Solução**: Faça login novamente

---

## 📊 QUANDO USAR

**Use esse comando SEMPRE que:**
1. ✅ Atualizar instruções de um assistente no OpenAI Dashboard
2. ✅ Adicionar ou modificar funções (Function Calling)
3. ✅ Corrigir bugs de comportamento dos assistants
4. ✅ Implementar novas features nos prompts

**Fluxo recomendado:**
```
1. Atualizar prompt no OpenAI Dashboard
2. ⚡ LIMPAR CACHE (usar este endpoint)
3. Testar o assistente para validar mudanças
4. ✅ Mudanças aplicadas imediatamente
```

---

## 🔍 DETALHES TÉCNICOS

### Cache Atual
- **Local**: Redis + Memória local
- **TTL**: 24 horas
- **Chaves afetadas**: `instructions:apresentacao`, `instructions:comercial`, etc.

### O que o endpoint faz
```javascript
// 1. Deleta cache individual de cada assistant
for (const type of ['apresentacao', 'comercial', 'financeiro', 'suporte', 'ouvidoria', 'cancelamento']) {
  await assistantCache.delete(`instructions:${type}`);
}

// 2. Invalida por tags
await assistantCache.invalidateByTag('assistant-config');
```

### Logs esperados
```
🗑️ [Admin] Clearing assistant instructions cache...
🗑️ [Admin] Cleared cache for apresentacao
🗑️ [Admin] Cleared cache for comercial
🗑️ [Admin] Cleared cache for financeiro
🗑️ [Admin] Cleared cache for suporte
🗑️ [Admin] Cleared cache for ouvidoria
🗑️ [Admin] Cleared cache for cancelamento
✅ [Admin] Assistant instructions cache cleared successfully
```

---

## ⚠️ IMPORTANTE

- **Permissão necessária**: Apenas usuários com role `ADMIN`
- **Impacto**: Próxima mensagem de cada conversa irá buscar instruções atualizadas do OpenAI
- **Performance**: Primeira interação após limpar cache terá ~200ms de latência extra (aceitável)
- **Segurança**: Endpoint protegido por autenticação + autorização

---

## 🚀 PRÓXIMOS PASSOS

### TODO: Adicionar Botão no Dashboard Admin
Criar interface visual no `AdminDashboard.tsx`:

```tsx
<Button 
  onClick={handleClearCache}
  variant="outline"
  data-testid="button-clear-assistant-cache"
>
  🗑️ Limpar Cache dos Assistants
</Button>
```

---

## 📝 EXEMPLO DE USO REAL

**Cenário**: Você atualizou o prompt do Financeiro para parar de prometer ações sem executar.

**ANTES** (sem limpar cache):
```
14:00 - Atualiza prompt no OpenAI Dashboard
14:05 - Cliente entra em contato
❌ IA ainda usa prompt antigo (cache)
❌ Continua prometendo sem executar
```

**DEPOIS** (limpando cache):
```
14:00 - Atualiza prompt no OpenAI Dashboard
14:01 - ⚡ Executa /api/admin/clear-assistant-cache
14:05 - Cliente entra em contato
✅ IA usa prompt novo (busca do OpenAI)
✅ Comportamento corrigido imediatamente
```

---

**Criado em**: 28/10/2025  
**Endpoint**: `/api/admin/clear-assistant-cache`  
**Arquivo**: `server/routes.ts` (linha ~3845)
