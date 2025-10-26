# 🧪 Guia de Teste - Sistema de Seleção Efêmera de Pontos para Boletos

## 📋 Objetivo
Validar o novo sistema de seleção temporária de pontos de instalação que garante liberdade total ao cliente para escolher diferentes endereços em cada consulta de boleto.

## 🎯 Arquitetura Testada
- ✅ Redis efêmero (TTL: 5min) em vez de persistência no banco
- ✅ Worker intercepta respostas ANTES da IA
- ✅ NLU mapeia respostas variadas do cliente
- ✅ Bloqueio de auto-roteamento durante seleção
- ✅ Cliente tem liberdade de escolher pontos diferentes a cada consulta

## 👤 Cliente de Teste
**CPF**: 087.841.647-19  
**Nome**: ALEXANDRE MARQUES CARVALHO  
**Pontos de Instalação**: 4 endereços diferentes

## 🔬 Cenários de Teste

### Teste 1: Consulta Inicial + Seleção Numérica
**Objetivo**: Verificar apresentação de menu e seleção por número

**Passos**:
1. Cliente envia: "quero meu boleto"
2. **Verificar**: Sistema apresenta menu com 4 opções
3. Cliente envia: "3"
4. **Verificar**: Sistema retorna boletos APENAS do ponto 3
5. **Verificar**: Menu foi removido do Redis (logs devem mostrar "Menu removido")

**Logs Esperados**:
```
📍 [AI Tool] MÚLTIPLOS PONTOS DETECTADOS: 4 pontos
💾 [Redis] Menu salvo para conversa {id} (TTL: 5min)
🎯 [Worker] Conversa aguardando seleção de ponto - processando resposta do cliente
✅ [Worker] Cliente selecionou ponto 3 - consultando boletos filtrados
🗑️ [Worker] Menu removido do Redis - seleção processada com sucesso
```

---

### Teste 2: Seleção com Ordinal
**Objetivo**: Verificar NLU para ordinais em português

**Passos**:
1. Cliente envia: "preciso do boleto"
2. **Verificar**: Menu apresentado
3. Cliente envia: "o terceiro"
4. **Verificar**: Sistema mapeia "terceiro" → ponto 3
5. **Verificar**: Boletos do ponto 3 retornados

**NLU Esperado**:
- "primeiro" → 1
- "segundo" → 2
- "terceiro" → 3
- "quarto" → 4

---

### Teste 3: Seleção por Endereço/Bairro
**Objetivo**: Verificar matching por keywords do endereço

**Passos**:
1. Cliente envia: "boleto por favor"
2. **Verificar**: Menu apresentado (observar nomes de bairro/cidade)
3. Cliente envia: "{nome do bairro do ponto 2}" (ex: "amazonas")
4. **Verificar**: Sistema mapeia bairro → ponto correto
5. **Verificar**: Boletos filtrados retornados

---

### Teste 4: Liberdade de Escolha (Múltiplas Consultas)
**Objetivo**: CRÍTICO - Verificar que cliente pode escolher pontos DIFERENTES

**Passos**:
1. Cliente envia: "quero boleto"
2. Cliente seleciona: "1"
3. **Verificar**: Boletos do ponto 1
4. **AGUARDAR 10 segundos** (garantir TTL expirouou não)
5. Cliente envia: "quero boleto de novo"
6. **VERIFICAR CRÍTICO**: Menu apresentado NOVAMENTE (não usa seleção anterior)
7. Cliente seleciona: "4" (DIFERENTE da primeira vez)
8. **Verificar**: Boletos do ponto 4 (não do ponto 1)

**Comportamento Esperado**:
- ✅ Menu sempre apresentado em CADA consulta
- ✅ Cliente pode escolher ponto diferente a cada vez
- ✅ Nenhuma "memória" de seleção anterior

---

### Teste 5: Expiração de TTL
**Objetivo**: Verificar que menu expira após 5 minutos

**Passos**:
1. Cliente envia: "quero boleto"
2. **Verificar**: Menu apresentado
3. **AGUARDAR 6 MINUTOS** (sem responder)
4. Cliente envia: "3"
5. **Verificar**: Sistema NÃO encontra menu (expirou)
6. **Verificar**: Sistema pede esclarecimento OU apresenta menu novamente

**Logs Esperados**:
```
⚠️ [Worker] Menu não encontrado (expirou?) - permitindo IA processar normalmente
```

---

### Teste 6: Resposta Ambígua
**Objetivo**: Verificar tratamento de respostas não reconhecidas

**Passos**:
1. Cliente envia: "boleto"
2. **Verificar**: Menu apresentado
3. Cliente envia: "aquele lá" (resposta ambígua)
4. **Verificar**: Sistema pede esclarecimento
5. Cliente envia: "2"
6. **Verificar**: Sistema processa corretamente

**Mensagem Esperada**:
> "Desculpe, não consegui identificar qual endereço você quer. Por favor, responda com o número (1, 2, 3...) ou nome do endereço."

---

### Teste 7: Bloqueio de Auto-Roteamento
**Objetivo**: Verificar que IA não se auto-roteia durante seleção

**Passos**:
1. Cliente envia: "quero boleto"
2. **Verificar**: Menu apresentado + flag `awaitingSelection` ativa
3. **SIMULAR**: IA tenta chamar `rotear_para_assistente` (verificar logs)
4. **Verificar**: Roteamento bloqueado

**Logs Esperados**:
```
⛔ [Routing] BLOQUEADO - Conversa {id} está aguardando seleção de ponto de instalação
```

---

### Teste 8: Ponto sem Boletos
**Objetivo**: Verificar resposta quando ponto está em dia

**Passos**:
1. Cliente envia: "boleto"
2. Cliente seleciona ponto que está EM DIA
3. **Verificar**: Mensagem positiva "O endereço selecionado está EM DIA"

---

## 🔍 Verificações de Log

Durante todos os testes, monitorar:

### Redis (server/lib/redis-config.ts)
- ✅ `💾 [Redis] Menu salvo` quando menu criado
- ✅ `🗑️ [Redis] Menu removido` após processamento
- ✅ TTL configurado corretamente (5min = 300s)

### Worker (server/workers.ts)
- ✅ `🎯 [Worker] Conversa aguardando seleção` quando intercepta
- ✅ `✅ [Worker] Cliente selecionou ponto X` quando mapeia
- ✅ Não deve aparecer `🔄 [Worker] Processing message` (IA não chamada)

### AI Tools (server/ai-tools.ts)
- ✅ `📍 [AI Tool] MÚLTIPLOS PONTOS DETECTADOS` quando detecta
- ✅ `🎯 [AI Tool] Filtrando boletos do ponto X` quando filtra
- ✅ Não deve aparecer `selectedInstallationPoint` persistido

### OpenAI (server/lib/openai.ts)
- ✅ `⛔ [Routing] BLOQUEADO` se IA tentar rotear durante seleção

---

## ✅ Critérios de Sucesso

### Funcionais
- [ ] Menu apresentado SEMPRE em cada consulta
- [ ] Cliente pode selecionar DIFERENTES pontos em consultas consecutivas
- [ ] NLU mapeia: números diretos, ordinais, keywords de endereço
- [ ] Boletos filtrados corretamente por ponto
- [ ] TTL funciona (menu expira após 5min)
- [ ] Respostas ambíguas geram pedido de esclarecimento

### Técnicos
- [ ] Nenhuma escrita em `conversation.selectedInstallationPoint`
- [ ] Worker intercepta ANTES de chamar IA
- [ ] Menu removido do Redis após processamento
- [ ] Auto-roteamento bloqueado durante janela de seleção
- [ ] Zero erros de compilação ou LSP

### Experiência do Usuário
- [ ] Fluxo natural e intuitivo
- [ ] Mensagens claras e objetivas
- [ ] Liberdade total de escolha preservada

---

## 🚨 Problemas Conhecidos a Monitorar

1. **Race Condition**: Verificar se cliente enviar 2 mensagens muito rápidas
2. **Keywords Incompletas**: Adicionar mais keywords se NLU falhar
3. **TTL muito curto**: Ajustar para 10min se clientes reclamarem
4. **Formatação de boletos**: Comparar com formato original da IA

---

## 📊 Dados de Teste Adicionais

Outros clientes com múltiplos pontos (se necessário):
- CPF: {adicionar se disponível}
- CPF: {adicionar se disponível}

---

## 🔄 Próximos Passos Pós-Teste

Após validação bem-sucedida:
1. ✅ Monitorar logs de produção por 48h
2. ✅ Coletar feedback de clientes reais
3. ✅ Ajustar keywords NLU se necessário
4. ✅ Documentar casos de edge descobertos
5. ✅ Treinar equipe de suporte sobre nova arquitetura

---

**Data de Criação**: 26/10/2025  
**Arquitetura**: Redis Efêmera v1.0  
**Status**: Pronto para testes manuais
