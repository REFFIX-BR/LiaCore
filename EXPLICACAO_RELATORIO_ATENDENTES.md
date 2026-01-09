# 📊 Como Funciona o Relatório de Atendentes

## 🔍 Critérios de Contagem

O relatório agora mostra **DUAS métricas**:

### 1️⃣ **Atendidas** (Nova métrica)
Conversas **ATRIBUÍDAS** ao atendente no período:
- **AssignedTo**: ID do atendente
- **TransferredAt** ou **CreatedAt**: Dentro do período (data de atribuição)
- Inclui conversas **ativas**, **resolvidas** e **pendentes**

### 2️⃣ **Resolvidas** (Métrica existente)
Conversas **RESOLVIDAS** pelo atendente no período:
- **Status**: `resolved` (resolvida)
- **ResolvedBy**: Preenchido com o ID do atendente
- **ResolvedAt**: Dentro do período selecionado (data de resolução)

## 📝 Exemplo Prático

**Cenário**: Thais Alves atendeu 32 conversas no dia 09/01/2026

**O que aconteceu:**
- ✅ **32 conversas** foram **atribuídas** a ela no dia 09/01 → **Coluna "Atendidas"**
- ✅ **28 conversas** foram **resolvidas por ela** no dia 09/01 → **Coluna "Resolvidas"**
- ❌ **4 conversas** podem estar em uma destas situações:
  1. Ainda estão **ativas** (não foram resolvidas)
  2. Foram **resolvidas em outro dia** (resolvedAt diferente)
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

- **Atendidas**: Todas as conversas que foram atribuídas ao atendente (`assignedTo`)
- **Resolvidas**: Apenas as conversas que o atendente efetivamente finalizou (`resolvedBy` + `resolvedAt`)

**Exemplo:**
- Se "Atendidas" = 32 e "Resolvidas" = 28
- Significa que 4 conversas foram atribuídas mas não foram resolvidas por ela no período

## ✅ Melhorias Implementadas

O relatório agora mostra:

1. ✅ **Coluna "Atendidas"**: Todas as conversas atribuídas ao atendente
2. ✅ **Coluna "Resolvidas"**: Apenas as conversas finalizadas pelo atendente
3. ✅ **Indicador de pendentes**: Mostra quantas conversas estão pendentes (atendidas - resolvidas)

Isso ajuda a identificar:
- Conversas que foram atribuídas mas não foram resolvidas
- Taxa de conclusão (resolvidas / atendidas)
- Conversas que podem ter sido resolvidas em outro dia ou por outro atendente

