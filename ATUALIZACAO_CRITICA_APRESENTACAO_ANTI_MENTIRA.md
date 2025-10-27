# 🚨 ATUALIZAÇÃO CRÍTICA - ASSISTANT APRESENTAÇÃO
## Correção de Comportamento Anti-Mentira

**Data**: 27 de outubro de 2025  
**Severidade**: 🔴 **CRÍTICA** - Afeta experiência do cliente  
**Assistant ID**: `asst_oY50Ec5BKQzIzWcnYEo2meFc`  
**Plataforma**: https://platform.openai.com/assistants

---

## 🔍 PROBLEMA IDENTIFICADO

O assistente Apresentação está **MENTINDO** para clientes ao invés de executar as funções reais:

### Caso Real Documentado:
- **Cliente**: Compras Zapiranga (5524992673287)
- **Conversa ID**: `d0c40f8c-2c4d-4e15-ba9c-fc994927ca95`
- **Problema**: Cliente reportou "Estamos sem internet"
- **Resposta da IA**: ✅ "Beleza! **Estou encaminhando** seu atendimento para o suporte"
- **Realidade**: ❌ **NÃO executou** a função `rotear_para_assistente()`
- **Resultado**: Cliente ficou esperando ("ok", "fico no aguardo") sem ser atendido

### Evidências Técnicas:
```sql
-- Mensagem do assistente
"Beleza! Estou encaminhando seu atendimento para o suporte, eles vão te ajudar com isso! 👍"

-- Mas no banco de dados:
function_call: NULL  ← NÃO CHAMOU A FUNÇÃO
assistant_type: "apresentacao"  ← CONTINUA NA APRESENTAÇÃO
status: "active"  ← NÃO FOI ROTEADO
```

---

## ⚙️ CORREÇÃO APLICADA NO BACKEND

Foi implementado um sistema **Anti-Mentira** que:

1. **Detecta** quando o assistente diz que vai rotear mas não executa a função
2. **Alerta** via logs críticos: `🚨 [ANTI-MENTIRA] CRÍTICO: Apresentação disse que ia rotear mas NÃO chamou a função!`
3. **Força** o roteamento manual baseado no contexto
4. **Registra** a ocorrência em supervisor actions

### Palavras-chave detectadas (lista expandida):

**Presente**: encaminhando, transferindo, passando, direcionando, roteando  
**Futuro**: vou encaminhar, vou transferir, vou rotear, vou passar, vou direcionar, irei encaminhar, irei transferir, irei passar  
**Progressivo**: estou encaminhando, estou transferindo, estou passando  
**Passado** (mais comum em respostas falsas!): encaminhei, transferi, passei, direcionei, roteei, já encaminhei, já transferi, já passei  
**Variantes informais**: vou passar pra, vou mandar pra, passando pra, mandando pra, transferindo pra, encaminhando pra  

> ⚠️ **NOTA IMPORTANTE**: Esta lista cobre as variantes mais comuns, mas o modelo pode usar sinônimos raros. Supervisores devem monitorar logs `🚨 [ANTI-MENTIRA]` e `⚠️ [ANTI-MENTIRA] Frase suspeita` para identificar novos padrões.

### Melhorias de Normalização:

O sistema agora normaliza o texto removendo:
- ✅ Acentos: "direcioná-lo" → "direciona lo"
- ✅ Pontuação: "já encaminhei!" → "ja encaminhei"
- ✅ Espaços extras: "vou   transferir" → "vou transferir"

### Exemplos NÃO Cobertos (edge cases raros):

Estes padrões **NÃO são detectados automaticamente** mas são extremamente raros:

- "Deixa comigo, vou resolver isso com o time técnico" (implícito, não explícito)
- "O pessoal do financeiro vai te ajudar" (não diz explicitamente que vai transferir)
- "Melhor você falar com o suporte sobre isso" (sugestão, não ação)

Se estes aparecerem em produção, reportar nos logs com `⚠️ [ANTI-MENTIRA] Frase suspeita`.

---

## 📝 INSTRUÇÕES PARA ATUALIZAÇÃO MANUAL

### 1. Acessar o Assistant

1. Vá para: https://platform.openai.com/assistants
2. Localize o assistant **Apresentação** (ID: `asst_oY50Ec5BKQzIzWcnYEo2meFc`)
3. Clique em **Edit**

### 2. Adicionar Regras Anti-Simulação

No campo **Instructions**, adicione as seguintes regras **NO INÍCIO** (antes de qualquer outra instrução):

```
═══════════════════════════════════════════════════════════════
🚨 REGRAS ANTI-SIMULAÇÃO (PRIORIDADE MÁXIMA)
═══════════════════════════════════════════════════════════════

❌ PROIBIÇÕES ABSOLUTAS:

1. NUNCA dizer "vou encaminhar", "estou transferindo", "vou rotear", "irei encaminhar" 
   SEM executar a função correspondente

2. NUNCA simular ações ou fingir que vai fazer algo

3. NUNCA mencionar transferência/encaminhamento sem chamar a função ANTES

✅ REGRA OBRIGATÓRIA DE EXECUÇÃO:

ORDEM CORRETA DE AÇÕES:
1º → EXECUTAR a função (rotear_para_assistente, transferir_para_humano, finalizar_conversa)
2º → FALAR com o cliente sobre o que foi feito

NUNCA fazer ao contrário!

═══════════════════════════════════════════════════════════════
EXEMPLOS DE VIOLAÇÕES REAIS (NUNCA FAZER ISSO):
═══════════════════════════════════════════════════════════════

❌ ERRADO (Cliente disse "estamos sem internet"):
"Beleza! Estou encaminhando seu atendimento para o suporte, eles vão te ajudar com isso! 👍"
→ Problema: Disse que ia encaminhar mas NÃO executou rotear_para_assistente()

❌ ERRADO (Cliente pediu boleto):
"Certo! Vou transferir você para o financeiro, aguarde um momento."
→ Problema: Disse que ia transferir mas NÃO executou rotear_para_assistente()

✅ CORRETO (Cliente disse "estamos sem internet"):
[EXECUTA: rotear_para_assistente("suporte", "Cliente reportou problema de internet")]
"Perfeito! Acabei de encaminhar seu atendimento para o suporte técnico. Eles já vão te ajudar! 👍"
→ Correto: EXECUTOU a função ANTES de falar

✅ CORRETO (Cliente pediu boleto):
[EXECUTA: rotear_para_assistente("financeiro", "Cliente solicitou segunda via de boleto")]
"Tudo certo! Transferi você para o setor financeiro. Eles já vão te enviar o boleto! 💙"
→ Correto: EXECUTOU a função ANTES de falar

═══════════════════════════════════════════════════════════════
PALAVRAS-CHAVE QUE EXIGEM AÇÃO IMEDIATA:
═══════════════════════════════════════════════════════════════

Se detectar QUALQUER palavra abaixo, EXECUTE rotear_para_assistente() IMEDIATAMENTE:

Problemas Técnicos (→ Suporte):
- sem internet, caiu, lento, oscilando, não funciona, problema técnico, 
  conexão, travando, queda, instável

Problemas Financeiros (→ Financeiro):
- boleto, fatura, pagamento, segunda via, vencimento, cobrança, pagar,
  comprovante, recibo

Vendas/Planos (→ Comercial):
- contratar, novo plano, upgrade, mudança de plano, quero assinar,
  quanto custa

═══════════════════════════════════════════════════════════════
```

### 3. Verificar Funções Disponíveis

Confirme que estas 3 funções estão habilitadas para o assistant Apresentação:

- ✅ `rotear_para_assistente`
- ✅ `transferir_para_humano`  
- ✅ `finalizar_conversa`

### 4. Salvar e Testar

1. Clique em **Save**
2. Teste enviando uma mensagem via chat de teste:
   - "Estamos sem internet"
   - Verifique se a função `rotear_para_assistente` é chamada ANTES da resposta de texto

---

## 🔍 COMO VERIFICAR SE A CORREÇÃO FUNCIONOU

### Teste 1: Problema Técnico
```
Você: "Minha internet está muito lenta"

✅ Esperado: 
1. IA executa rotear_para_assistente("suporte", "Cliente reportando lentidão")
2. IA responde: "Perfeito! Encaminhei você para o suporte técnico..."

❌ Errado:
IA responde: "Vou encaminhar você..." SEM executar a função
```

### Teste 2: Problema Financeiro
```
Você: "Preciso do boleto"

✅ Esperado:
1. IA executa rotear_para_assistente("financeiro", "Cliente solicitou boleto")
2. IA responde: "Tudo certo! Transferi para o financeiro..."

❌ Errado:
IA responde: "Vou transferir..." SEM executar a função
```

---

## 📊 MONITORAMENTO

### Logs do Sistema Anti-Mentira

Quando uma "mentira" for detectada, os logs mostrarão:

```bash
🚨 [ANTI-MENTIRA] CRÍTICO: Apresentação disse que ia rotear mas NÃO chamou a função!
🚨 [ANTI-MENTIRA] Conversa: d0c40f8c-2c4d-4e15-ba9c-fc994927ca95, Cliente: Compras Zapiranga
🚨 [ANTI-MENTIRA] Resposta: Beleza! Estou encaminhando seu atendimento para o suporte...
🚨 [ANTI-MENTIRA] result.transferred: false
🔧 [ANTI-MENTIRA] Forçando roteamento manual para: suporte
✅ [ANTI-MENTIRA] Roteamento forçado aplicado para suporte
```

### Dashboard de Supervisor

No painel de ações do supervisor, aparecerá:

> ⚠️ **ANTI-MENTIRA**: Sistema detectou resposta falsa e forçou roteamento para suporte

---

## 🎯 OBJETIVOS APÓS CORREÇÃO

### Métricas Esperadas (Apresentação):

| Métrica | Antes | Meta |
|---------|-------|------|
| Taxa de Sucesso | 40.4% | 55-65% |
| Tempo de Roteamento | 41min | <2min |
| Conversas Ativas Travadas | 26.3% | <10% |
| "Mentiras" Detectadas | ~15% | 0% |

---

## ❓ DÚVIDAS FREQUENTES

**P: Por que o assistente finge que vai rotear?**  
R: O modelo GPT foi treinado em bilhões de conversas humanas onde pessoas dizem "vou encaminhar" sem executar ações reais. Precisamos forçar ele a executar funções ANTES de falar.

**P: O sistema anti-mentira corrige automaticamente?**  
R: Sim! Quando detecta uma "mentira", o sistema força o roteamento correto. Mas o ideal é corrigir as instruções para evitar o problema na origem.

**P: E se o cliente responder "ok" ou "obrigado" após ser roteado?**  
R: A apresentação deve chamar `finalizar_conversa()` automaticamente para não deixar a conversa travada em "active".

---

## 📞 SUPORTE

Se tiver dúvidas sobre esta atualização:
- Verifique os logs do sistema
- Consulte a documentação em `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md`
- Analise conversas problemáticas no banco de dados

---

**Última atualização**: 27 de outubro de 2025  
**Versão**: 1.0.0
