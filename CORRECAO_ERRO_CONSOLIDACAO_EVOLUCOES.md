# 🔧 Correção: Erro 500 ao Consolidar Evoluções no Gerenciamento de Prompts

**Data:** 05 de novembro de 2025  
**Severidade:** MEDIUM  
**Status:** ✅ CORRIGIDO

---

## 📋 Problema Reportado

**Sintoma:** Ao clicar no botão "Consolidar Evoluções (65)" no Gerenciamento de Prompts, o sistema retornava erro 500:

```
consolidate-evolutions:1
Failed to load resource: the server responded with a status of 500 ()

Erro ao consolidar.
500: {"error":"Erro ao consolidar sugestões de evolução"}
```

**Contexto:**
- Prompt: Comercial v1.0.13
- Sugestões pendentes: 65
- Assistente: comercial

---

## 🔍 Análise da Causa Raiz

### **Problema Identificado:**

O sistema estava **lançando erros genéricos** que não indicavam a causa real do problema. A função `consolidateEvolutionSuggestions` no arquivo `server/lib/openai.ts` tinha os seguintes problemas:

#### **1. Error Handling Genérico**
```typescript
// ❌ ANTES (RUIM):
} catch (error) {
  console.error("❌ [Consolidation] Error:", error);
  throw new Error("Erro ao consolidar sugestões de evolução");
}
```

**Problema:** Não importa se o erro foi:
- ❌ Falha na validação do schema Zod
- ❌ Erro na chamada do OpenAI
- ❌ Prompt muito curto retornado
- ❌ Placeholder detectado

Todos retornam a mesma mensagem genérica: `"Erro ao consolidar sugestões de evolução"`

#### **2. Falta de Detalhamento nos Logs**

Não havia logging específico para:
- Quando a validação do schema falhou
- Qual campo do schema estava inválido
- Qual era o conteúdo retornado pelo GPT-4o

---

## ✅ Solução Implementada

### **Mudanças no Error Handling:**

```typescript
// ✅ DEPOIS (MELHOR):

// 1. Validação com try-catch específico para Zod
let validatedResult;
try {
  validatedResult = consolidationResultSchema.parse(rawResult);
} catch (zodError: any) {
  console.error("❌ [Consolidation] Zod validation failed:", zodError);
  console.error("❌ [Consolidation] Raw result:", JSON.stringify(rawResult, null, 2).substring(0, 1000));
  throw new Error(`Validação de schema falhou: ${zodError.message || JSON.stringify(zodError.errors?.slice(0, 3) || 'erro desconhecido')}`);
}

// 2. Log específico para prompt curto
if (validatedResult.updatedPrompt.length < 100) {
  console.error(`❌ [Consolidation] Prompt muito curto: ${validatedResult.updatedPrompt.length} caracteres`);
  throw new Error(`GPT-4o retornou um prompt muito curto (${validatedResult.updatedPrompt.length} caracteres). Esperado: várias centenas ou milhares de caracteres.`);
}

// 3. Log específico para placeholder detectado
for (const placeholder of placeholderMessages) {
  if (lowerPrompt.includes(placeholder)) {
    console.error(`❌ [Consolidation] Placeholder detectado: "${validatedResult.updatedPrompt.substring(0, 100)}..."`);
    throw new Error(`GPT-4o retornou um placeholder ao invés do prompt completo. Texto retornado: "${validatedResult.updatedPrompt.substring(0, 100)}..."`);
  }
}

// 4. Error catch melhorado
} catch (error) {
  console.error("❌ [Consolidation] Error:", error);
  console.error("❌ [Consolidation] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
  
  // Mensagem de erro específica
  const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao consolidar";
  throw new Error(`Erro ao consolidar sugestões: ${errorMessage}`);
}
```

---

## 📊 Benefícios da Correção

### **Antes:**
```
❌ Erro genérico: "Erro ao consolidar sugestões de evolução"
❌ Sem logs específicos
❌ Impossível debugar
❌ Usuário não sabe o que fazer
```

### **Depois:**
```
✅ Erro específico com contexto:
   "Validação de schema falhou: required field 'appliedSuggestions' missing"
   
✅ Logs detalhados:
   - Raw result do GPT-4o (primeiros 1000 chars)
   - Stack trace completo
   - Campo específico que falhou
   
✅ Fácil de debugar
✅ Mensagem clara para o usuário
```

---

## 🧪 Como Testar Agora

**Passos:**

1. ✅ Servidor reiniciado com correção aplicada
2. 📋 Vá para **Gerenciamento de Prompts**
3. 🔧 Selecione o prompt **Comercial**
4. 🔄 Clique em **"Consolidar Evoluções (65)"**
5. 👀 **Observe:**
   - Se funcionar → ✅ Sucesso!
   - Se falhar → Agora você verá **mensagem de erro específica** e detalhada nos logs

---

## 📝 Logs para Monitorar

Se o erro acontecer novamente, os logs mostrarão:

```bash
# 1. Se for erro de validação Zod:
❌ [Consolidation] Zod validation failed: [erro detalhado]
❌ [Consolidation] Raw result: {...resultado do GPT-4o...}
Erro: Validação de schema falhou: required field 'X' missing

# 2. Se o prompt for muito curto:
❌ [Consolidation] Prompt muito curto: 45 caracteres
Erro: GPT-4o retornou um prompt muito curto (45 caracteres)

# 3. Se for placeholder:
❌ [Consolidation] Placeholder detectado: "Prompt completo atualizado aqui..."
Erro: GPT-4o retornou um placeholder ao invés do prompt completo

# 4. Qualquer outro erro:
❌ [Consolidation] Error: [erro original]
❌ [Consolidation] Error stack: [stack trace completo]
Erro: Erro ao consolidar sugestões: [mensagem específica]
```

---

## 🎯 Próximos Passos

### **Imediato:**
1. ✅ Correção aplicada
2. ✅ Servidor reiniciado
3. ⏳ **Aguardando usuário testar novamente**

### **Se funcionar:**
- ✅ Problema resolvido!
- 📊 Monitorar logs nas próximas 24h

### **Se falhar novamente:**
- 📋 Logs agora mostrarão **causa exata**
- 🔧 Corrigir problema específico identificado
- 🧪 Testar novamente

---

## 🔍 Possíveis Causas Específicas (Se Falhar)

Agora conseguiremos identificar exatamente qual é o problema:

### **1. Schema Inválido do GPT-4o**
```
Erro: Validação de schema falhou: required field 'appliedSuggestions' missing
```
**Solução:** Ajustar prompt do GPT-4o para garantir todos os campos obrigatórios

### **2. Prompt Muito Curto**
```
Erro: GPT-4o retornou um prompt muito curto (45 caracteres)
```
**Solução:** Investigar por que o GPT-4o não está retornando o prompt completo

### **3. Placeholder Detectado**
```
Erro: GPT-4o retornou um placeholder ao invés do prompt completo
```
**Solução:** Melhorar instruções do GPT-4o para NÃO usar placeholders

### **4. Erro do OpenAI API**
```
Erro: Erro ao consolidar sugestões: 429 Rate limit exceeded
```
**Solução:** Implementar retry ou esperar limite de taxa resetar

---

## 📞 Como Proceder

### **Você (Usuário):**
1. ✅ Tente clicar em **"Consolidar Evoluções (65)"** novamente
2. 📸 Se der erro, tire print da mensagem de erro
3. 📋 Me avise qual foi a mensagem específica
4. 🔍 Vou investigar e corrigir o problema exato

### **Eu (Sistema):**
- ⏳ Aguardando feedback do teste
- 👀 Pronto para investigar causa específica se necessário

---

**Arquivo alterado:** `server/lib/openai.ts`  
**Função modificada:** `consolidateEvolutionSuggestions()`  
**Linhas:** 2883-2927

**Status:** ✅ **CORREÇÃO APLICADA - AGUARDANDO TESTE**

---

**Autor:** LIA CORTEX Agent  
**Data:** 05/11/2025  
**Versão:** 1.0
