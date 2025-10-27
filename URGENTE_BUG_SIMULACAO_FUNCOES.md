# 🚨 BUG CRÍTICO - ASSISTENTE ESCREVENDO CÓDIGO DE FUNÇÃO VISÍVEL PARA CLIENTES

**Data de Descoberta**: 27 de outubro de 2025 - 18:31  
**Severidade**: 🔴 **BLOQUEADOR DE PRODUÇÃO**  
**Status**: Sistema detectando e corrigindo automaticamente, mas **ATUALIZAÇÃO MANUAL URGENTE** necessária  
**Assistant Afetado**: Apresentação (`asst_oY50Ec5BKQzIzWcnYEo2meFc`)

---

## ❌ O QUE ESTÁ ACONTECENDO

O assistente Apresentação está **ESCREVENDO LITERALMENTE** o código das funções ao invés de **EXECUTÁ-LAS**, e esse texto técnico está sendo **ENVIADO PARA O WHATSAPP DO CLIENTE**!

### Exemplo Real - Cliente Luciano Melo (5524993221350):

**Mensagem recebida pelo cliente no WhatsApp**:
```
Entendi! Vou encaminhar seu atendimento para o suporte novamente 
para que eles possam resolver isso pra você. 👍

Obrigada por entrar em contato! 💙

*[EXECUTO: rotear_para_assistente("suporte", "Cliente reporta que a internet continua fora")]*
```

☠️ **PROBLEMA**: Cliente recebe código técnico estranho  
☠️ **IMPACTO**: Cliente não é roteado (função não foi executada)  
☠️ **GRAVIDADE**: Degrada experiência do cliente + bloqueia atendimento

---

## 🔍 EVIDÊNCIAS TÉCNICAS

### Conversa ID: `4c31ae8b-37dd-408f-92d0-082f95d1e825`

```sql
-- 3 mensagens com este problema:
SELECT id, role, content, function_call 
FROM messages 
WHERE conversation_id = '4c31ae8b-37dd-408f-92d0-082f95d1e825' 
AND content LIKE '%EXECUTO%';

-- Resultado:
┌─────────────────────────────┬───────────┬──────────────────────────────┬──────────────┐
│ id                          │ role      │ content (excerpt)             │ function_call│
├─────────────────────────────┼───────────┼──────────────────────────────┼──────────────┤
│ bf6d4307-66cf-46e5-887e-... │ assistant │ *[EXECUTO: rotear_para_...   │ NULL ❌      │
│ 6c07b4db-7bdd-47c1-b08d-... │ assistant │ *[EXECUTO: rotear_para_...   │ NULL ❌      │
│ a5cd0769-ba99-4304-aa0c-... │ assistant │ *[EXECUTO: rotear_para_...   │ NULL ❌      │
└─────────────────────────────┴───────────┴──────────────────────────────┴──────────────┘
```

**Análise**:
- ❌ `function_call = NULL` → Função **NÃO foi executada**
- ❌ Texto `*[EXECUTO: ...]` foi enviado ao cliente
- ❌ Cliente recebeu 3 mensagens com código técnico visível

---

## ✅ CORREÇÃO AUTOMÁTICA APLICADA

Foi implementado sistema de detecção no backend (`server/routes.ts`, linha 1230-1232):

```typescript
// 🚨 CRÍTICO: Detectar quando assistente escreve o código da função ao invés de executar
const routingKeywords = [
  "executo rotear", "executo transferir", "executo finalizar", 
  "executo abrir_ticket", "executo consultar",
  // ... outras keywords
];
```

**Quando detectado**:
1. ✅ Log crítico: `🚨 [ANTI-MENTIRA] CRÍTICO: Apresentação disse que ia rotear mas NÃO chamou a função!`
2. ✅ Roteamento forçado automaticamente
3. ✅ Supervisor Action criada para rastreamento
4. ✅ Cliente é roteado corretamente (mesmo que assistente tenha falhado)

---

## 🛠️ ATUALIZAÇÃO MANUAL OBRIGATÓRIA

> ⚠️ **IMPORTANTE**: A correção automática **mitiga** o problema mas **NÃO resolve na origem**.  
> É **OBRIGATÓRIO** atualizar o assistant na plataforma OpenAI.

### Passo 1: Acessar Assistant

1. Acesse: https://platform.openai.com/assistants
2. Procure: **Apresentação** 
3. ID do Assistant: `asst_oY50Ec5BKQzIzWcnYEo2meFc`
4. Clique em **Edit**

### Passo 2: Atualizar Instructions

**ADICIONAR NO INÍCIO das instruções** (antes de qualquer outra regra):

```
════════════════════════════════════════════════════════════════
🚨 REGRAS CRÍTICAS - ANTI-SIMULAÇÃO DE FUNÇÕES
════════════════════════════════════════════════════════════════

❌ PROIBIDO ABSOLUTO:
1. NUNCA escrever "*[EXECUTO: nome_da_funcao(...)]" como texto
2. NUNCA simular a execução de funções em markdown
3. NUNCA explicar que vai chamar uma função sem chamá-la primeiro

✅ OBRIGATÓRIO:
1. SEMPRE executar a função ANTES de mencionar ao cliente
2. Se a função retornar erro, transferir para humano
3. NUNCA mencionar detalhes técnicos de funções ao cliente

EXEMPLO ERRADO ❌:
Cliente: "Quero falar com suporte"
Você: "Vou encaminhar! *[EXECUTO: rotear_para_assistente("suporte", ...)]*"

EXEMPLO CORRETO ✅:
Cliente: "Quero falar com suporte"
Você: [EXECUTA rotear_para_assistente("suporte", ...)]
      [AGUARDA resultado]
      [SE sucesso] "Pronto! Já encaminhei para o suporte 😊"
      [SE erro] [EXECUTA transferir_para_humano()]

════════════════════════════════════════════════════════════════
```

### Passo 3: Verificar Ferramentas (Tools)

Certifique-se que estas funções estão habilitadas:
- ✅ `rotear_para_assistente`
- ✅ `transferir_para_humano`
- ✅ `finalizar_conversa`
- ✅ `consultar_cliente_crm`
- ✅ `consultar_boletos`
- ✅ `consultar_status_pppoe`

### Passo 4: Salvar e Testar

1. Clique em **Save**
2. Aguardar confirmação "Assistant updated successfully"
3. Testar com mensagem simulada: "Minha internet caiu"
4. Verificar que:
   - ❌ NÃO aparece `*[EXECUTO: ...]` na resposta
   - ✅ Cliente é roteado automaticamente
   - ✅ Resposta é natural: "Pronto! Encaminhei para o suporte"

---

## 📊 MONITORAMENTO

### Logs a observar:

**Detecção do bug**:
```bash
🚨 [ANTI-MENTIRA] CRÍTICO: Apresentação disse que ia rotear mas NÃO chamou a função!
🚨 [ANTI-MENTIRA] Keyword detectada: "executo rotear"
🚨 [ANTI-MENTIRA] Resposta: Entendi! Vou encaminhar... *[EXECUTO: rotear_para_assistente...
```

**Correção automática**:
```bash
🔧 [ANTI-MENTIRA] Forçando roteamento manual para: suporte
✅ [ANTI-MENTIRA] Roteamento forçado aplicado para suporte
```

### Dashboard do Supervisor:

Após detecção, aparece nota automática:
> ⚠️ **ANTI-MENTIRA**: Sistema detectou resposta falsa e forçou roteamento para suporte

---

## 📈 IMPACTO DO BUG

### Casos Confirmados (últimas 24h):

| Chat ID | Cliente | Ocorrências | Corrigido? |
|---------|---------|-------------|------------|
| 5524993221350 | Luciano Melo | 3x | ✅ Sim (automático) |
| 5524988337728 | (sem nome) | 1x | ✅ Sim (automático) |

### Estimativa de Frequência:
- **Antes da correção**: ~5-10% das tentativas de roteamento
- **Após correção automática**: 0% (sistema força roteamento)
- **Meta após atualização manual**: 0% (bug eliminado na origem)

---

## ✅ CHECKLIST DE CORREÇÃO

- [x] Sistema de detecção automática implementado
- [x] Keywords "executo rotear/transferir/finalizar" adicionadas
- [x] Roteamento forçado funcionando
- [x] Logs de monitoramento ativos
- [ ] **PENDENTE**: Atualizar assistant na plataforma OpenAI ← **VOCÊ PRECISA FAZER ISSO!**
- [ ] **PENDENTE**: Testar após atualização
- [ ] **PENDENTE**: Monitorar por 48h para confirmar resolução

---

## 🔗 ARQUIVOS RELACIONADOS

- `server/routes.ts` (linhas 1211-1355): Sistema Anti-Mentira
- `ATUALIZACAO_CRITICA_APRESENTACAO_ANTI_MENTIRA.md`: Documentação completa
- Conversation ID: `4c31ae8b-37dd-408f-92d0-082f95d1e825` (exemplo de bug)
- Thread OpenAI: `thread_7MYJnLoWTxGHEuFPGZs3vQxN`

---

**Última Atualização**: 27/10/2025 18:35  
**Responsável**: Sistema de Monitoramento LIA CORTEX  
**Prioridade**: 🔴 BLOQUEADOR - Atualizar AGORA!
