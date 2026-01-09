# 📊 Como Funciona o Relatório de Atendentes

## 🔍 Critérios de Contagem

O relatório mostra **DUAS métricas independentes**:

### 1️⃣ **Atendidas** 
Conversas **ATRIBUÍDAS** ao atendente no período:
- **AssignedTo**: ID do atendente
- **Data de Atribuição**: `transferredAt` ou `createdAt` dentro do período
- **Inclui**: Conversas ativas, resolvidas, pendentes - **qualquer status**
- **Critério**: Se foi atribuída a ela no período, conta como "atendida"

### 2️⃣ **Resolvidas**
Conversas **RESOLVIDAS** pelo atendente no período:
- **Status**: `resolved` (resolvida)
- **ResolvedBy**: Preenchido com o ID do atendente
- **ResolvedAt**: Dentro do período selecionado (data de resolução)
- **Critério**: Se ela resolveu no período, conta como "resolvida"

## 📝 Exemplo Prático

**Cenário**: Thais Alves foi atribuída a 32 conversas no dia 09/01/2026

**O que aconteceu:**
- ✅ **32 conversas** foram **atribuídas** a ela no dia 09/01 → **Coluna "Atendidas"**
  - Baseado em `assignedTo` + data de atribuição (`transferredAt` ou `createdAt`)
  - Conta **qualquer conversa atribuída a ela no período**, independente de status
  
- ✅ **28 conversas** foram **resolvidas por ela** no dia 09/01 → **Coluna "Resolvidas"**
  - Baseado em `resolvedBy` + `resolvedAt` no período
  - Conta apenas conversas que ela **efetivamente resolveu** no período

- ❌ **4 conversas** (32 - 28 = 4) podem estar em uma destas situações:
  1. Ainda estão **ativas** (não foram resolvidas ainda)
  2. Foram **resolvidas em outro dia** (resolvedAt em outro período)
  3. Foram **resolvidas por outro atendente** (resolvedBy diferente)
  4. Não têm `resolvedBy` preenchido (resolvidas pela IA ou auto-fechadas)

## 📝 Exemplo Prático

**Cenário**: Thais Alves atendeu 32 conversas no dia 09/01/2026

**O que pode ter acontecido:**
- ✅ **28 conversas** foram **resolvidas por ela** no dia 09/01 → **Aparecem no relatório**
- ❌ **4 conversas** podem estar em uma destas situações:
  1. Ainda estão **ativas** (não foram resolvidas)
  2. Foram **resolvidas em outro dia** (resolvedAt diferente)
  3. Foram **resolvidas por outro atendente** (resolvedBy diferente)
  4. Não têm `resolvedBy` preenchido (resolvidas pela IA ou auto-fechadas)

## 🔄 Diferença entre "Atendidas" e "Resolvidas"

- **Atendidas**: Conversas atribuídas ao atendente (`assignedTo`)
- **Resolvidas**: Conversas que o atendente efetivamente finalizou (`resolvedBy` + `resolvedAt`)

## 💡 Por que essa lógica?

O relatório foca em **performance real** do atendente:
- Conta apenas o que foi **efetivamente resolvido**
- Considera a **data de resolução** (não a data de atribuição)
- Garante que o atendente **realmente finalizou** a conversa

## 🔍 Como Verificar a Diferença

Para ver todas as conversas atribuídas (não apenas resolvidas), você pode:

1. **Verificar no Monitor**: Filtrar por atendente e ver todas as conversas atribuídas
2. **Query SQL direta**: Consultar o banco para ver todas as conversas com `assignedTo` no período

## 📊 Campos do Relatório

| Campo | O que representa |
|-------|------------------|
| **Atendidas** | ✅ NOVO: Total de conversas ATRIBUÍDAS ao atendente no período (inclui ativas, resolvidas e pendentes) |
| **Resolvidas** | Total de conversas RESOLVIDAS pelo atendente no período |
| **Sucesso** | % de conversas resolvidas com sentimento positivo/neutro |
| **NPS** | Score médio de Net Promoter Score |
| **Transferências** | Conversas que foram transferidas da IA para humano |

## 💡 Diferença entre "Atendidas" e "Resolvidas"

### **Atendidas**
- **Baseado em**: `assignedTo` + **data de atribuição** (`transferredAt` ou `createdAt`)
- **Conta**: Todas as conversas atribuídas ao atendente **no período**
- **Inclui**: Conversas ativas, resolvidas, pendentes - **qualquer status**
- **Lógica**: "Se foi atribuída a ela no período, conta como atendida"

### **Resolvidas**
- **Baseado em**: `resolvedBy` + **data de resolução** (`resolvedAt`)
- **Conta**: Apenas conversas que o atendente **efetivamente resolveu** no período
- **Inclui**: Apenas conversas com status `resolved`
- **Lógica**: "Se ela resolveu no período, conta como resolvida"

**Exemplo:**
- Se "Atendidas" = 32 e "Resolvidas" = 28
- Significa que:
  - 32 conversas foram **atribuídas** a ela no período
  - 28 dessas conversas foram **resolvidas por ela** no período
  - 4 conversas foram atribuídas mas não resolvidas por ela no período (podem estar ativas, resolvidas em outro dia, ou resolvidas por outro agente)

## ✅ Melhorias Implementadas

O relatório agora mostra:

1. ✅ **Coluna "Atendidas"**: Todas as conversas atribuídas ao atendente
2. ✅ **Coluna "Resolvidas"**: Apenas as conversas finalizadas pelo atendente
3. ✅ **Indicador de pendentes**: Mostra quantas conversas estão pendentes (atendidas - resolvidas)

Isso ajuda a identificar:
- Conversas que foram atribuídas mas não foram resolvidas
- Taxa de conclusão (resolvidas / atendidas)
- Conversas que podem ter sido resolvidas em outro dia ou por outro atendente

