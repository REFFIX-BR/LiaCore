# Arquitetura RAG - LIA CORTEX

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Arquitetura Dual-Layer](#arquitetura-dual-layer)
3. [System Prompts](#system-prompts)
4. [RAG Prompts](#rag-prompts)
5. [Fluxo Completo](#fluxo-completo)
6. [Exemplos Práticos](#exemplos-práticos)
7. [Benefícios](#benefícios)
8. [Manutenção](#manutenção)

---

## 🎯 Visão Geral

O sistema RAG (Retrieval-Augmented Generation) do LIA CORTEX utiliza uma **arquitetura dual-layer** que separa claramente:

- **System Prompts** (Camada 1): Regras absolutas de comportamento
- **RAG Prompts** (Camada 2): Contexto dinâmico recuperado da base de conhecimento

Esta separação garante que as regras fundamentais sejam **sempre respeitadas**, enquanto o conhecimento contextual é **dinamicamente recuperado** conforme necessário.

---

## 🏗️ Arquitetura Dual-Layer

```
┌─────────────────────────────────────────────────────────┐
│                    CAMADA 1: SYSTEM PROMPTS              │
│                  (Permanente - OpenAI Instructions)      │
│                                                          │
│  ✅ NUNCA retorne JSON ao cliente                        │
│  ✅ SEMPRE transfira quando cliente pedir                │
│  ✅ Mensagens curtas (≤ 500 caracteres)                  │
│  ✅ Use emojis ocasionalmente                            │
│  ✅ Revise o histórico antes de perguntar                │
│  ✅ NUNCA invente dados, URLs ou prazos                  │
└─────────────────────────────────────────────────────────┘
                            ↓
                  Cliente faz pergunta
                            ↓
┌─────────────────────────────────────────────────────────┐
│              BUSCA SEMÂNTICA (Upstash Vector)            │
│                                                          │
│  Query: "política de compensação financeira"            │
│  → Top 3 documentos mais relevantes                     │
│  → Score de similaridade                                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  CAMADA 2: RAG PROMPTS                   │
│              (Dinâmico - Function Return)                │
│                                                          │
│  --- CONTEXTO DA BASE DE CONHECIMENTO ---               │
│  {documentos recuperados do Upstash}                    │
│                                                          │
│  --- SUA TAREFA ---                                     │
│  1. Use APENAS o contexto acima                         │
│  2. Se não houver resposta, seja honesto                │
│  3. NUNCA mencione "base de conhecimento"               │
│  4. Siga todas as regras absolutas                      │
└─────────────────────────────────────────────────────────┘
                            ↓
                  IA formula resposta natural
```

---

## 📜 System Prompts (Camada 1)

### **O que são?**
Regras **permanentes** de comportamento definidas nas `instructions` de cada Assistant na OpenAI.

### **Onde estão definidos?**
- Arquivo: `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md`
- Aplicados via OpenAI Platform (https://platform.openai.com/assistants)

### **Estrutura Padrão:**

```markdown
## ⚠️ REGRAS ABSOLUTAS - NUNCA VIOLAR

**1. NUNCA retorne JSON nas respostas ao cliente**
   - Sempre responda em linguagem natural
   - JSON é apenas para comunicação interna

**2. SEMPRE use transferir_para_humano quando cliente pedir**
   - Sem exceção
   - Imediatamente
   - Não tente convencer a continuar com IA

**3. Mensagens curtas (≤ 500 caracteres)**
   - Seja objetivo
   - Divida informações longas

**4. Use emojis ocasionalmente**
   - Para humanizar
   - Sem exageros
   - Apropriados ao contexto

**5. Revise o histórico**
   - Antes de fazer perguntas
   - Para evitar repetições
   - Para manter contexto

**6. NUNCA:**
   - Inventar dados ou valores
   - Prometer prazos não confirmados
   - Mencionar sistemas internos ou nomes de arquivos
   - Pedir dados além do necessário
   - Criar URLs ou informações fictícias

**7. ESPECÍFICO PARA [ASSISTANT_TYPE]:**
   - Regras específicas do tipo de assistant
```

### **Cobertura:**
Aplicado em **todos os 7 assistants**:
1. ✅ Suporte Técnico
2. ✅ Comercial
3. ✅ Financeiro
4. ✅ Cancelamento
5. ✅ Ouvidoria
6. ✅ Apresentação (Recepcionista)
7. ✅ Cortex (Roteador)

---

## 🔍 RAG Prompts (Camada 2)

### **O que são?**
Instruções **dinâmicas** construídas em tempo real quando a IA precisa de conhecimento específico.

### **Onde estão implementados?**
- Arquivo: `server/lib/openai.ts`
- Function: `consultar_base_de_conhecimento`
- Linhas: 445-475

### **Estrutura do Prompt:**

```typescript
case "consultar_base_de_conhecimento":
  const query = args.query || "";
  const { searchKnowledge } = await import("./upstash");
  const results = await searchKnowledge(query, 3); // Top 3 docs
  
  if (results.length === 0) {
    return `--- CONTEXTO DA BASE DE CONHECIMENTO ---
Não foram encontradas informações específicas sobre este tópico.

--- SUA TAREFA ---
1. Informe ao cliente de forma natural e honesta
2. Ofereça transferir para um atendente humano
3. NUNCA mencione "base de conhecimento"
4. Siga todas as regras absolutas`;
  }
  
  const contextoRecuperado = results.map(r => r.chunk.content).join('\n\n');
  const fonte = results[0]?.chunk.source || "Base de Conhecimento TR Telecom";
  
  return `--- CONTEXTO DA BASE DE CONHECIMENTO ---
${contextoRecuperado}

--- SUA TAREFA ---
1. Analise a pergunta usando o histórico
2. Use APENAS as informações do CONTEXTO acima
3. Se a resposta não estiver no CONTEXTO, seja honesto
4. NUNCA mencione "base de conhecimento" ou "contexto"
5. Siga todas as regras absolutas

Fonte: ${fonte}`;
```

### **Características:**

#### **✅ Grounded Generation**
Força a IA a usar **APENAS** o contexto fornecido, prevenindo alucinações.

#### **✅ Estrutura Clara**
Separadores `---` delimitam inequivocamente:
- O que é **contexto factual** (conhecimento recuperado)
- O que é **tarefa** (instruções de como processar)

#### **✅ Experiência Natural**
Instrução explícita para **nunca mencionar** a mecânica do RAG ao cliente.

#### **✅ Fallback Inteligente**
Quando não há resultados, instrui a IA a ser **honesta** e oferecer alternativas.

---

## 🔄 Fluxo Completo

### **Passo a Passo:**

```
1. Cliente pergunta: "Qual é a política de compensação financeira?"
   ↓
2. IA determina que precisa consultar base de conhecimento
   ↓
3. IA chama function: consultar_base_de_conhecimento(
      query: "política compensação financeira problemas recorrentes"
   )
   ↓
4. Sistema busca no Upstash Vector (busca semântica)
   ↓
5. Upstash retorna top 3 documentos mais relevantes:
   - kb-geral-002: "NUNCA oferecer compensação financeira..."
   - kb-suporte-001: "Priorizar atendimento técnico..."
   - kb-politicas-003: "Política de retenção sem descontos..."
   ↓
6. Sistema constrói RAG Prompt estruturado:
   --- CONTEXTO DA BASE DE CONHECIMENTO ---
   NUNCA oferecer compensação financeira para problemas recorrentes.
   A política é escalar para atendimento técnico prioritário...
   
   --- SUA TAREFA ---
   1. Use APENAS as informações do CONTEXTO acima
   2. Se não houver resposta, seja honesto
   3. NUNCA mencione "base de conhecimento"
   4. Siga todas as regras absolutas
   ↓
7. IA processa com:
   - System Prompt (regras absolutas sempre ativas)
   - RAG Prompt (contexto + tarefa específica)
   - Histórico da conversa (gerenciado pela OpenAI)
   ↓
8. IA responde ao cliente:
   "Nossa política para problemas recorrentes é priorizar seu
   atendimento técnico! Vou agendar uma visita urgente do nosso
   time para resolver definitivamente. 🔧"
   ↓
9. ✅ Resposta natural, baseada em fatos, sem inventar compensações
```

---

## 💡 Exemplos Práticos

### **Exemplo 1: Pergunta com Resposta na Base**

**Pergunta do Cliente:**
> "Quais são as regras de finalização de conversa?"

**Processo Interno:**
1. IA chama `consultar_base_de_conhecimento("regras finalização conversa")`
2. Upstash retorna documento `kb-geral-002`
3. RAG Prompt construído:
   ```
   --- CONTEXTO ---
   Assistentes SUPORTE/COMERCIAL/FINANCEIRO podem finalizar quando:
   - Problema COMPLETAMENTE resolvido
   - Cliente confirmar satisfação
   
   CANCELAMENTO/OUVIDORIA/APRESENTAÇÃO NUNCA finalizam.
   Sempre transferem para humano.
   
   --- SUA TAREFA ---
   Use APENAS este contexto...
   ```
4. IA responde naturalmente com base no contexto

**Resposta ao Cliente:**
> "Aqui na TR Telecom, finalizamos o atendimento quando seu problema estiver completamente resolvido e você confirmar que está tudo ok! Para casos de cancelamento ou ouvidoria, sempre transferimos para nossa equipe especializada. 😊"

---

### **Exemplo 2: Pergunta SEM Resposta na Base**

**Pergunta do Cliente:**
> "Vocês aceitam Bitcoin como pagamento?"

**Processo Interno:**
1. IA chama `consultar_base_de_conhecimento("pagamento bitcoin criptomoeda")`
2. Upstash retorna 0 resultados
3. RAG Prompt (fallback):
   ```
   --- CONTEXTO ---
   Não foram encontradas informações específicas sobre este tópico.
   
   --- SUA TAREFA ---
   1. Informe ao cliente de forma natural
   2. Ofereça transferir para atendente
   3. NUNCA mencione "base de conhecimento"
   ```
4. IA responde honestamente

**Resposta ao Cliente:**
> "Não tenho essa informação específica no momento. Posso te conectar com nossa equipe financeira que vai esclarecer as formas de pagamento aceitas. Pode ser?"

✅ **Honesto, natural, sem inventar informações**

---

### **Exemplo 3: Problema Recorrente (NO Compensation Policy)**

**Pergunta do Cliente:**
> "Minha internet já caiu 3 vezes esse mês. Vão me dar desconto?"

**Processo Interno:**
1. Sistema detecta recorrência (Conversation Intelligence)
2. IA chama `consultar_base_de_conhecimento("compensação desconto problema recorrente")`
3. Upstash retorna `kb-geral-002` com política ANTI-COMPENSAÇÃO
4. RAG Prompt:
   ```
   --- CONTEXTO ---
   NUNCA oferecer compensação financeira, desconto ou redução
   de mensalidade para problemas recorrentes.
   
   Política: Escalar para atendimento técnico PRIORITÁRIO.
   Agendar visita urgente para resolução definitiva.
   
   --- SUA TAREFA ---
   Use APENAS este contexto...
   ```
5. IA responde seguindo a política

**Resposta ao Cliente:**
> "Entendo sua frustração com essas quedas! Vou priorizar seu atendimento técnico e agendar uma visita urgente do nosso time para resolver isso definitivamente. Quando seria melhor para você? 🔧"

✅ **Nenhuma menção a desconto, foco em solução técnica**

---

## 🎯 Benefícios da Arquitetura

### **1. Enforcement Garantido** 🛡️
- Regras absolutas **sempre ativas** (nas instructions)
- Não dependem de busca semântica
- 100% de compliance

### **2. Zero Alucinações** 🚫
- IA forçada a usar **APENAS** contexto fornecido
- Resposta honesta quando não sabe
- Grounded generation garantido

### **3. Experiência Natural** 😊
- Cliente nunca vê "base de conhecimento" ou "contexto"
- Respostas fluidas e humanizadas
- IA age como se soubesse naturalmente

### **4. Manutenibilidade** 🔧
- **System Prompts**: Mudam raramente (regras fundamentais)
- **RAG Prompts**: Dinâmicos (conhecimento evolui)
- **Knowledge Base**: Editável via UI (sem código)

### **5. Performance** ⚡
- Regras absolutas não precisam de busca RAG
- Apenas contexto específico é recuperado
- Menos tokens consumidos

### **6. Escalabilidade** 📈
- Adicione conhecimento sem alterar código
- Novos assistants herdam regras padrão
- Fácil testar e validar mudanças

---

## 🔧 Manutenção

### **Atualizar System Prompts (Regras Absolutas)**

**1. Edite o arquivo:**
```bash
INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md
```

**2. Localize o assistant desejado:**
```markdown
## 1. ASSISTENTE DE SUPORTE TÉCNICO

## ⚠️ REGRAS ABSOLUTAS - NUNCA VIOLAR
...
```

**3. Faça as alterações necessárias**

**4. Aplique na OpenAI Platform:**
- Acesse: https://platform.openai.com/assistants
- Selecione o assistant
- Cole as novas instructions
- Salve

**⚠️ IMPORTANTE:** Mudanças em System Prompts afetam **todas** as conversas imediatamente.

---

### **Atualizar Knowledge Base (RAG)**

**1. Via Interface (Recomendado):**
- Acesse: `/knowledge` no sistema
- Busque o documento
- Clique em "Editar"
- Modifique e salve

**2. Via Código (Avançado):**
```typescript
// server/lib/upstash.ts
await addKnowledgeChunks([{
  id: "kb-geral-002",
  name: "Regras de Finalização",
  content: "Novo conteúdo atualizado...",
  source: "Manual Operacional v2.0"
}]);
```

**💡 Vantagem:** Mudanças no RAG **não exigem alteração de código** ou reconfiguração de assistants.

---

### **Modificar RAG Prompt Structure**

**Se precisar ajustar o formato do prompt RAG:**

**1. Edite:**
```bash
server/lib/openai.ts
```

**2. Localize:**
```typescript
case "consultar_base_de_conhecimento":
```

**3. Modifique o template:**
```typescript
return `--- CONTEXTO DA BASE DE CONHECIMENTO ---
${contextoRecuperado}

--- HISTÓRICO RECENTE --- 
${historicoRelevante} // NOVA SEÇÃO

--- SUA TAREFA ---
1. Analise PERGUNTA + HISTÓRICO + CONTEXTO
...`;
```

**⚠️ CUIDADO:** Mudanças estruturais podem afetar qualidade das respostas. Teste bem!

---

### **Monitoramento e Debug**

#### **Verificar se RAG está funcionando:**
```typescript
// Logs no console:
console.log("🔍 [Upstash] Searching knowledge base:", { query, topK: 3 });
console.log("✅ [Upstash] Found X results");
```

#### **Testar prompt RAG:**
1. Acesse `/test-chat`
2. Faça pergunta que exige conhecimento
3. Verifique se resposta usa contexto
4. Confirme que não menciona "base de conhecimento"

#### **Métricas importantes:**
- Taxa de uso do RAG vs. respostas genéricas
- Precisão das respostas (baseadas em contexto)
- Menções indevidas de "base de conhecimento" (devem ser 0)

---

## 📚 Arquivos Relacionados

```
ARQUITETURA_RAG.md                          # ← Esta documentação
INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md  # System Prompts
server/lib/openai.ts                        # RAG Prompt implementation
server/lib/upstash.ts                       # Vector search
client/src/pages/Knowledge.tsx              # Knowledge Base UI
replit.md                                   # Visão geral do sistema
```

---

## 🚀 Quick Start

### **Para novos desenvolvedores:**

1. **Entenda a arquitetura:**
   - Leia esta documentação
   - Revise `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md`

2. **Configure os assistants:**
   - Acesse OpenAI Platform
   - Aplique as instructions de cada assistant

3. **Teste o sistema:**
   - Login como admin
   - Vá para `/test-chat`
   - Faça perguntas que exigem conhecimento

4. **Monitore:**
   - Verifique logs de busca RAG
   - Confirme respostas naturais
   - Valide compliance com regras

---

## 📞 Suporte

**Dúvidas sobre System Prompts?**
→ Consulte `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md`

**Dúvidas sobre RAG Prompts?**
→ Veja `server/lib/openai.ts` (linha 445)

**Dúvidas sobre Knowledge Base?**
→ Acesse `/knowledge` na interface

**Problemas com respostas?**
→ Verifique logs de busca Upstash
→ Teste no `/test-chat`

---

**Última atualização:** 12 de Outubro de 2024  
**Versão:** 2.0 (Dual-Layer Architecture)  
**Status:** ✅ Produção
