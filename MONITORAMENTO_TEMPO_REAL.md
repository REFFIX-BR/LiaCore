# 📊 GUIA DE MONITORAMENTO EM TEMPO REAL - LIA CORTEX

## 🎯 **Visão Geral**

O sistema LIA CORTEX possui **3 formas** de monitorar agentes recebendo mensagens e roteamento em tempo real:

1. **Monitor Supervisor** - Interface visual de conversas
2. **Logs em Tempo Real** - WebSocket com todos os eventos (NOVO!)
3. **Console do Servidor** - Logs técnicos diretos

---

## 📺 **1. MONITOR SUPERVISOR (Interface Visual)**

### **Como Acessar:**
```
http://seu-dominio/monitor
```

### **Requisitos:**
- Login como **SUPERVISOR** ou **ADMIN**

### **O que você vê:**

#### **Visão em Tempo Real:**
- ✅ Lista de conversas ativas
- ✅ Última mensagem do cliente
- ✅ Assistente atual (Apresentação, Comercial, Financeiro, etc.)
- ✅ Status (Ativa, Transferida, Resolvida)
- ✅ Sentimento (Positivo, Neutro, Negativo)
- ✅ Urgência (Normal, Alta, Crítica)
- ✅ Tempo de duração

#### **Filtros Disponíveis:**
- **Por Status:** Todas, Transferidas, Ouvidoria, Alertas, Resolvidas
- **Por Departamento:** Apresentação, Comercial, Financeiro, Suporte, Ouvidoria, Cancelamento

#### **Detalhes da Conversa:**
Ao clicar em uma conversa, você vê:
- 📝 Histórico completo de mensagens
- 🔀 Roteamentos feitos pela IA
- 🛠️ Functions chamadas (verificação, boleto, etc.)
- 📊 Análise de sentimento
- ⏱️ Timeline de eventos

#### **Atualização Automática:**
- Conversas: **a cada 5 segundos**
- Detalhes: **a cada 3 segundos**
- Alertas: **a cada 3 segundos**

---

## 🔴 **2. LOGS EM TEMPO REAL (WebSocket - NOVO!)**

### **Como Acessar:**
```
http://seu-dominio/live-logs
```

### **Requisitos:**
- Login como **SUPERVISOR** ou **ADMIN**

### **O que você vê:**

#### **Dashboard de Logs:**
- 📊 **Total de Logs** - Quantidade total de eventos
- ✅ **Sucessos** - Operações bem-sucedidas
- ❌ **Erros** - Falhas no sistema
- 🟢 **Status de Conexão** - WebSocket conectado/desconectado

#### **Eventos Monitorados:**

##### **🔀 Roteamento:**
```
✅ CONVERSATION_ROUTED - Recepcionista roteou para assistente
✅ CONVERSATION_ROUTED_INTERNAL - Roteamento interno entre assistentes
⚠️ TRANSFER_TO_HUMAN - Conversa transferida para humano
```

##### **💬 Mensagens:**
```
📥 MESSAGE_RECEIVED - Mensagem recebida do cliente
🤖 AI_RESPONSE - Resposta da IA gerada
📤 MESSAGE_SENT - Mensagem enviada ao WhatsApp
❌ SEND_FAILED - Falha no envio
```

##### **🎯 Processamento:**
```
✅ CONVERSATION_RESOLVED - Conversa finalizada
✅ WELCOME_MESSAGE_SENT - Mensagem de boas-vindas enviada
⚠️ TRANSFER_ACTIVE - Resposta manual necessária
```

##### **📋 Outros:**
```
ℹ️ CONNECTION - Webhook recebido
⚠️ INVALID_EVENT - Evento inválido
❌ WEBHOOK_ERROR - Erro crítico
```

#### **Filtros Inteligentes:**
- **Todos os eventos** - Ver tudo
- **🔀 Roteamento** - Apenas roteamentos e transferências
- **💬 Mensagens** - Recebidas e respostas da IA
- **❌ Erros** - Apenas erros do sistema
- **Eventos Específicos:** MESSAGE_RECEIVED, AI_RESPONSE, CONVERSATION_ROUTED, TRANSFER_TO_HUMAN

#### **Funcionalidades:**
- ⏸️ **Pausar/Continuar** - Pausar atualização para analisar
- 🗑️ **Limpar Logs** - Limpar visualização
- 📋 **Ver Detalhes** - JSON completo do evento
- 🔄 **Atualização em Tempo Real** - Via WebSocket

#### **Exemplo de Log:**

```
✅ CONVERSATION_ROUTED
12:34:56

Recepcionista roteou para comercial

Detalhes ▼
{
  "conversationId": "abc-123",
  "fromAssistant": "apresentacao",
  "toAssistant": "comercial",
  "clientName": "João Silva",
  "reason": "Cliente interessado em upgrade de plano"
}
```

---

## 🖥️ **3. CONSOLE DO SERVIDOR (Logs Técnicos)**

### **Como Acessar:**

#### **Opção A: Replit Console**
1. Abra o painel de **Console** no Replit
2. Os logs aparecem automaticamente

#### **Opção B: SSH/Terminal**
```bash
# Ver logs em tempo real
tail -f logs/production.log

# Filtrar por roteamento
tail -f logs/production.log | grep "ROUTED\|TRANSFER"

# Filtrar por erros
tail -f logs/production.log | grep "ERROR\|❌"
```

### **Formato dos Logs:**
```
✅ [Webhook Monitor] [CONVERSATION_ROUTED] Recepcionista roteou para comercial
🔀 [Transfer] Conversa 123 transferida de João para Maria
📥 [Webhook] Mensagem recebida de +5511999999999
🤖 [AI Response] Resposta da IA gerada (comercial)
❌ [Error] Falha ao enviar mensagem ao WhatsApp
```

---

## 🎬 **CENÁRIOS DE USO**

### **Cenário 1: Monitorar Roteamento de Assistentes**

**Objetivo:** Ver em tempo real qual assistente está atendendo cada cliente

**Método Recomendado:** **Logs em Tempo Real** (`/live-logs`)

**Passos:**
1. Acesse `/live-logs`
2. Selecione filtro: **🔀 Roteamento**
3. Observe os eventos:
   - `CONVERSATION_ROUTED` → Recepcionista roteou
   - `CONVERSATION_ROUTED_INTERNAL` → Roteamento interno
   - `TRANSFER_TO_HUMAN` → Transferiu para supervisor

**O que você verá:**
```
✅ CONVERSATION_ROUTED - Recepcionista roteou para comercial
  Cliente: João Silva
  Motivo: Interessado em upgrade

✅ CONVERSATION_ROUTED_INTERNAL - Roteado para financeiro
  De: comercial → Para: financeiro
  Motivo: Cliente solicitou segunda via de boleto
```

---

### **Cenário 2: Acompanhar Mensagens e Respostas**

**Objetivo:** Ver mensagens chegando e respostas da IA em tempo real

**Método Recomendado:** **Logs em Tempo Real** + **Monitor Supervisor**

**Passos:**
1. Abra `/live-logs` em uma aba
2. Selecione filtro: **💬 Mensagens**
3. Abra `/monitor` em outra aba
4. Compare os logs com a interface visual

**O que você verá em `/live-logs`:**
```
📥 MESSAGE_RECEIVED - Mensagem de João Silva
  Conteúdo: "Preciso de ajuda com minha internet"
  
🤖 AI_RESPONSE - Resposta da IA gerada (suporte)
  Assistente: suporte
  
📤 MESSAGE_SENT - Mensagem enviada ao WhatsApp
  Status: Sucesso
```

**O que você verá em `/monitor`:**
```
Conversa: João Silva
Assistente: LIA Suporte
Última mensagem: "Vou verificar sua conexão..."
Status: Ativa
```

---

### **Cenário 3: Detectar Erros em Tempo Real**

**Objetivo:** Identificar falhas no processamento

**Método Recomendado:** **Logs em Tempo Real** (filtro de Erros)

**Passos:**
1. Acesse `/live-logs`
2. Selecione filtro: **❌ Erros**
3. Configure alertas (se disponível)

**O que você verá:**
```
❌ SEND_FAILED - Falha ao enviar resposta ao WhatsApp
  Erro: Timeout na API
  ConversationId: abc-123
  
❌ WEBHOOK_ERROR - Erro crítico no webhook
  Mensagem: Invalid JSON payload
  Details: {...}
```

---

### **Cenário 4: Verificar Performance da IA**

**Objetivo:** Medir tempo de resposta e qualidade

**Método Recomendado:** **Monitor Supervisor** + **Logs**

**Passos:**
1. Acesse `/monitor`
2. Observe o tempo entre mensagens
3. Verifique function calls executadas
4. Compare com `/live-logs` para ver eventos detalhados

**Métricas Importantes:**
- ⏱️ Tempo entre recebimento e resposta
- 🎯 Taxa de roteamento correto
- 🔀 Quantidade de transferências para humano
- ✅ Taxa de resolução automática

---

## 🔧 **TROUBLESHOOTING**

### **WebSocket não conecta:**
```
Problema: Status mostra "🔴 Desconectado"
Solução: 
1. Verifique se o servidor está rodando
2. Confirme que a porta WebSocket está aberta
3. Tente recarregar a página (F5)
```

### **Logs não atualizam:**
```
Problema: Logs param de aparecer
Solução:
1. Verifique se não está pausado (botão ⏸️)
2. Limpe os logs e aguarde novos eventos
3. Verifique conexão WebSocket
```

### **Monitor muito lento:**
```
Problema: Interface trava com muitas conversas
Solução:
1. Use filtros por departamento
2. Use filtro "Ativas" ao invés de "Todas"
3. Resolva conversas antigas
```

---

## 📈 **MELHORES PRÁTICAS**

### **1. Monitoramento Diário:**
- ✅ Abrir `/monitor` no início do turno
- ✅ Manter `/live-logs` aberto em outra tela
- ✅ Filtrar por departamento específico se necessário
- ✅ Observar alertas e urgências

### **2. Debug de Problemas:**
- ✅ Usar filtro "Erros" em `/live-logs`
- ✅ Copiar JSON de detalhes para análise
- ✅ Verificar timestamp para correlacionar eventos
- ✅ Comparar com logs do servidor

### **3. Análise de Roteamento:**
- ✅ Filtrar por "Roteamento" em `/live-logs`
- ✅ Observar padrões de transferência
- ✅ Identificar assistentes com mais roteamentos
- ✅ Verificar se recepcionista está roteando corretamente

### **4. Otimização:**
- ✅ Pausar logs quando não estiver olhando
- ✅ Limpar logs periodicamente
- ✅ Usar filtros específicos ao invés de "Todos"
- ✅ Fechar abas não utilizadas

---

## 🚀 **NOVIDADES (12/10/2024)**

### **✅ Página de Logs em Tempo Real Criada**
- WebSocket integrado
- Filtros inteligentes
- Estatísticas em tempo real
- Pausar/Continuar
- Detalhes expandíveis

### **✅ Logs de Roteamento Aprimorados**
- Todos os roteamentos são logados
- Detalhes completos (de/para assistente)
- Timestamp preciso
- Motivo do roteamento incluído

### **✅ Eventos Monitorados:**
```
MESSAGE_RECEIVED        → Cliente enviou mensagem
AI_RESPONSE            → IA gerou resposta
MESSAGE_SENT           → Mensagem enviada ao WhatsApp
CONVERSATION_ROUTED    → Recepcionista roteou
CONVERSATION_ROUTED_INTERNAL → Roteamento interno
TRANSFER_TO_HUMAN      → Transferiu para humano
CONVERSATION_RESOLVED  → Conversa finalizada
WELCOME_MESSAGE_SENT   → Boas-vindas enviada
SEND_FAILED            → Falha no envio
WEBHOOK_ERROR          → Erro crítico
```

---

## 📞 **ACESSO RÁPIDO**

### **URLs Importantes:**
```
Monitor Supervisor:     /monitor
Logs em Tempo Real:     /live-logs
Dashboard Admin:        /
Test Chat:              /test-chat
Webhook Monitor:        /webhook-monitor
```

### **Atalhos de Teclado (futuros):**
```
P - Pausar/Continuar logs
C - Limpar logs
F - Abrir filtros
D - Baixar logs
```

---

## 🎯 **RESUMO RÁPIDO**

**Quero ver...** | **Use...**
---|---
Conversas ativas em tempo real | `/monitor`
Roteamentos acontecendo agora | `/live-logs` (filtro: Roteamento)
Mensagens chegando e saindo | `/live-logs` (filtro: Mensagens)
Erros do sistema | `/live-logs` (filtro: Erros)
Detalhes técnicos de eventos | `/live-logs` (expandir detalhes)
KPIs e métricas gerais | `/` (Dashboard)
Teste manual do sistema | `/test-chat`

---

## 🆘 **SUPORTE**

**Em caso de dúvidas:**
1. Consulte este guia
2. Verifique logs de erros em `/live-logs`
3. Entre em contato com o time de suporte

**Links Úteis:**
- [Documentação Completa](./replit.md)
- [Checklist de Produção](./PRODUCTION_CHECKLIST.md)
- [Instruções dos Assistentes](./INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md)

---

**Última Atualização:** 12 de Outubro de 2024  
**Versão:** 1.0
