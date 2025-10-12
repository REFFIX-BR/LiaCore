# 🧠 GUIA DE LOGS DE RACIOCÍNIO DOS AGENTES - LIA CORTEX

## 🎯 **Visão Geral**

O sistema de **Agent Reasoning Logs** permite visualizar em tempo real o que os assistentes de IA estão **pensando, decidindo e fazendo** durante o atendimento ao cliente.

**Diferença dos Live Logs:**
- **Live Logs** (`/live-logs`): Eventos do sistema (webhooks, mensagens recebidas, erros técnicos)
- **Agent Logs** (`/agent-logs`): Raciocínios da IA (decisões, roteamentos, funções chamadas)

---

## 📊 **TIPOS DE LOGS**

### **1. 🧠 REASONING (Raciocínio)**
Quando a IA analisa e pensa sobre a mensagem do cliente.

**Exemplo:**
```
🧠 LIA Cortex (Router)
REASONING - Mensagem roteada para SUPORTE

Details:
{
  "reasoning": "Analisou a mensagem 'Internet caiu...' e determinou que o assistente SUPORTE é o mais adequado",
  "toAssistant": "suporte",
  "confidence": 0.85
}
```

### **2. 🔀 ROUTING (Roteamento)**
Quando um assistente roteia para outro assistente especializado.

**Exemplo:**
```
🔀 LIA Apresentação (Recepcionista)
ROUTING - Roteando para assistente COMERCIAL

Details:
{
  "fromAssistant": "apresentacao",
  "toAssistant": "comercial",
  "routingReason": "Cliente demonstrou interesse em contratar novo plano",
  "decision": "Conversa requer especialização de outro assistente"
}
```

### **3. 🛠️ FUNCTION_CALL (Chamada de Função)**
Quando a IA chama uma função/ferramenta para executar ação.

**Exemplo - Transferência para Humano:**
```
🛠️ LIA Suporte Técnico
FUNCTION_TRANSFERIR_PARA_HUMANO - Transferindo para humano

Details:
{
  "conversationId": "abc-123",
  "department": "suporte",
  "reason": "Cliente recusou fornecer CPF",
  "decision": "Cliente precisa de atendimento humano especializado"
}
```

**Exemplo - Consulta de Boleto:**
```
🛠️ LIA Financeiro
FUNCTION_CONSULTAR_BOLETO - Consultando segunda via de boleto

Details:
{
  "conversationId": "abc-123",
  "cpf": "12345678900",
  "functionName": "consultar_boleto"
}
```

### **4. 🎯 DECISION (Decisão)**
Quando a IA toma uma decisão importante sobre a conversa.

**Exemplo - Finalizar Conversa:**
```
🎯 LIA Suporte Técnico
DECISION - Finalizando conversa - Problema resolvido

Details:
{
  "conversationId": "abc-123",
  "resolveReason": "Problema de conexão resolvido após reiniciar modem",
  "decision": "Conversa pode ser finalizada autonomamente"
}
```

### **5. ❌ ERROR (Erro)**
Quando ocorre um erro no processamento da IA.

**Exemplo:**
```
❌ LIA Financeiro
ERROR - Falha ao processar função

Details:
{
  "error": "CPF não encontrado no sistema",
  "conversationId": "abc-123"
}
```

---

## 🎬 **COMO FUNCIONA**

### **Fluxo Completo:**

```
1. Cliente envia: "Minha internet está lenta"
   ↓
2. 🧠 LIA Cortex (Router) - REASONING
   "Analisou a mensagem e determinou que SUPORTE é o assistente adequado"
   ↓
3. 🔀 LIA Apresentação - ROUTING
   "Roteando para assistente SUPORTE"
   ↓
4. 🛠️ LIA Suporte - FUNCTION_CALL
   "Executando diagnóstico PPPoE"
   ↓
5. 🎯 LIA Suporte - DECISION
   "Problema identificado - Orientando reiniciar modem"
   ↓
6. Cliente resolve o problema
   ↓
7. 🎯 LIA Suporte - DECISION
   "Finalizando conversa - Problema resolvido"
```

---

## 🖥️ **INTERFACE DO USUÁRIO**

### **Acesso:**
```
URL: /agent-logs
Menu: Monitoramento → Logs dos Agentes IA
Permissões: ADMIN e SUPERVISOR
```

### **Dashboard Completo:**

#### **📊 Estatísticas (Topo):**
```
┌─────────┬──────────────┬──────────────┬──────────┬──────────┐
│ Total   │ Raciocínios  │ Roteamentos  │ Funções  │ Decisões │
├─────────┼──────────────┼──────────────┼──────────┼──────────┤
│   150   │      45      │      38      │    42    │    25    │
└─────────┴──────────────┴──────────────┴──────────┴──────────┘
```

#### **🎛️ Filtros:**
```
[ Todos ] [ Raciocínios ] [ Roteamentos ] [ Funções ] [ Decisões ] [ Erros ]
```

#### **⏯️ Controles:**
```
[ ⏸ Pausar ] [ 🗑️ Limpar ]
```

#### **📋 Lista de Logs:**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔀 LIA Apresentação (Recepcionista)                          │
│ ROUTING                                            21:30:45  │
│                                                              │
│ Roteando para assistente COMERCIAL                          │
│                                                              │
│ [ ▼ Ver detalhes ]                                           │
│ {                                                            │
│   "fromAssistant": "apresentacao",                           │
│   "toAssistant": "comercial",                                │
│   "routingReason": "Cliente quer upgrade de plano",          │
│   "decision": "Conversa requer especialização"               │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 **IMPLEMENTAÇÃO TÉCNICA**

### **Backend (server/lib/agent-logger.ts):**

```typescript
// Estrutura do Log
interface AgentLog {
  id: string;
  timestamp: string;
  type: 'reasoning' | 'routing' | 'function_call' | 'decision' | 'error';
  assistantType: string;
  assistantName: string;
  event: string;
  message: string;
  details?: {
    conversationId?: string;
    fromAssistant?: string;
    toAssistant?: string;
    functionName?: string;
    reasoning?: string;
    decision?: string;
    confidence?: number;
  };
}

// Funções de Log
agentLogger.reasoning(assistantType, message, details);
agentLogger.routing(assistantType, message, details);
agentLogger.functionCall(assistantType, functionName, message, details);
agentLogger.decision(assistantType, message, details);
agentLogger.error(assistantType, message, details);
```

### **WebSocket:**
```
Endpoint: /ws/agent-logs
Protocol: ws:// ou wss://

Mensagens:
- type: 'history' → Histórico de logs ao conectar
- type: 'new' → Novo log em tempo real
- type: 'clear' → Logs foram limpos
```

### **API Endpoints:**

```bash
# Obter histórico de logs
GET /api/agent-logs
Response: { logs: AgentLog[] }

# Obter estatísticas
GET /api/agent-logs/stats
Response: {
  total: 150,
  byType: {
    reasoning: 45,
    routing: 38,
    function_call: 42,
    decision: 25
  },
  byAssistant: {
    apresentacao: 50,
    comercial: 30,
    suporte: 40,
    financeiro: 30
  }
}

# Limpar logs
POST /api/agent-logs/clear
Response: { success: true, message: "Agent logs cleared" }
```

### **Integração no OpenAI (server/lib/openai.ts):**

**1. Routing Decision (linha 187-191):**
```typescript
agentLogger.routing('cortex', `Mensagem roteada para ${finalType.toUpperCase()}`, {
  reasoning: `Analisou a mensagem "${message.substring(0, 100)}..."`,
  toAssistant: finalType,
  confidence: 0.85,
});
```

**2. Function Call - Transfer (linha 299-310):**
```typescript
agentLogger.functionCall(
  assistantType, 
  'transferir_para_humano',
  `Transferindo para humano - Departamento: ${transferResult.departamento}`,
  {
    conversationId,
    department: transferResult.departamento,
    reason: args.motivo,
    decision: 'Cliente precisa de atendimento humano especializado'
  }
);
```

**3. Routing Between Assistants (linha 325-336):**
```typescript
agentLogger.routing(
  fromAssistant,
  `Roteando para assistente ${routingResult.assistente.toUpperCase()}`,
  {
    conversationId,
    fromAssistant,
    toAssistant: routingResult.assistente,
    routingReason: routingResult.motivo,
    decision: 'Conversa requer especialização de outro assistente'
  }
);
```

**4. Conversation Finalization (linha 350-359):**
```typescript
agentLogger.decision(
  assistantType,
  'Finalizando conversa - Problema resolvido',
  {
    conversationId,
    resolveReason: resolveResult.motivo,
    decision: 'Conversa pode ser finalizada autonomamente'
  }
);
```

---

## 📱 **FRONTEND**

### **Componente: client/src/pages/AgentLogs.tsx**

**Features:**
- ✅ WebSocket em tempo real
- ✅ Filtros por tipo de log
- ✅ Estatísticas em tempo real
- ✅ Pausar/Retomar logs
- ✅ Expandir/Colapsar detalhes
- ✅ Auto-scroll para novos logs
- ✅ Cores por tipo e assistente
- ✅ Timestamps formatados
- ✅ Limpar logs

### **Cores dos Assistentes:**

```typescript
const assistantColors = {
  'apresentacao': 'bg-indigo-500/10 text-indigo-500',  // Roxo/Índigo
  'comercial': 'bg-green-500/10 text-green-500',       // Verde
  'financeiro': 'bg-blue-500/10 text-blue-500',        // Azul
  'suporte': 'bg-orange-500/10 text-orange-500',       // Laranja
  'ouvidoria': 'bg-red-500/10 text-red-500',           // Vermelho
  'cancelamento': 'bg-gray-500/10 text-gray-500',      // Cinza
  'cortex': 'bg-purple-500/10 text-purple-500',        // Roxo
};
```

---

## 🎯 **CASOS DE USO**

### **1. Supervisionar Decisões da IA**
```
Problema: "A IA está transferindo muito para humano?"

Solução:
1. Acesse /agent-logs
2. Filtre por: FUNCTION_CALL
3. Busque: transferir_para_humano
4. Analise os motivos nas details
5. Identifique padrões de transferência desnecessária
```

### **2. Debug de Roteamento**
```
Problema: "Cliente foi roteado para assistente errado"

Solução:
1. Acesse /agent-logs
2. Filtre por: ROUTING
3. Busque a conversa específica
4. Veja o raciocínio do Cortex
5. Identifique erro no prompt de routing
```

### **3. Análise de Funções Chamadas**
```
Pergunta: "Quais funções a IA está usando mais?"

Solução:
1. Acesse /agent-logs
2. Filtre por: FUNCTION_CALL
3. Veja estatísticas
4. Identifique funções mais usadas:
   - consultar_boleto
   - diagnostico_pppoe
   - verificar_cliente
```

### **4. Verificar Finalizações Autônomas**
```
Pergunta: "A IA está finalizando conversas corretamente?"

Solução:
1. Acesse /agent-logs
2. Filtre por: DECISION
3. Busque: "Finalizando conversa"
4. Analise os motivos de finalização
5. Valide se estão apropriados
```

---

## 🔍 **EXEMPLOS PRÁTICOS**

### **Exemplo 1: Roteamento Inteligente**

**Cenário:** Cliente pede upgrade de plano

**Logs Gerados:**
```
1. 🧠 LIA Cortex
   REASONING - Mensagem roteada para APRESENTACAO
   {
     "reasoning": "Cliente novo, iniciar com recepcionista",
     "toAssistant": "apresentacao"
   }

2. 🔀 LIA Apresentação
   ROUTING - Roteando para assistente COMERCIAL
   {
     "fromAssistant": "apresentacao",
     "toAssistant": "comercial",
     "routingReason": "Cliente quer upgrade de plano"
   }

3. 🛠️ LIA Comercial
   FUNCTION_CALL - Consultando planos disponíveis
   {
     "functionName": "consultar_planos",
     "conversationId": "abc-123"
   }

4. 🎯 LIA Comercial
   DECISION - Apresentando opções de plano ao cliente
   {
     "decision": "Cliente qualificado para upgrade",
     "conversationId": "abc-123"
   }
```

### **Exemplo 2: Problema Técnico Resolvido**

**Cenário:** Cliente com internet lenta

**Logs Gerados:**
```
1. 🧠 LIA Cortex
   REASONING - Mensagem roteada para SUPORTE
   {
     "reasoning": "Problema técnico de conexão",
     "toAssistant": "suporte"
   }

2. 🛠️ LIA Suporte
   FUNCTION_CALL - Executando diagnóstico PPPoE
   {
     "functionName": "diagnostico_pppoe",
     "conversationId": "abc-123"
   }

3. 🎯 LIA Suporte
   DECISION - Orientando reiniciar modem
   {
     "decision": "Diagnóstico identificou necessidade de reinício",
     "conversationId": "abc-123"
   }

4. 🎯 LIA Suporte
   DECISION - Finalizando conversa - Problema resolvido
   {
     "resolveReason": "Cliente confirmou que internet voltou ao normal",
     "conversationId": "abc-123"
   }
```

### **Exemplo 3: Transferência para Humano**

**Cenário:** Cliente recusa fornecer CPF

**Logs Gerados:**
```
1. 🧠 LIA Cortex
   REASONING - Mensagem roteada para FINANCEIRO
   {
     "reasoning": "Cliente quer segunda via de boleto",
     "toAssistant": "financeiro"
   }

2. 🛠️ LIA Financeiro
   FUNCTION_CALL - Solicitando CPF do cliente
   {
     "functionName": "solicitar_cpf",
     "conversationId": "abc-123"
   }

3. 🛠️ LIA Financeiro
   FUNCTION_TRANSFERIR_PARA_HUMANO - Transferindo para humano
   {
     "department": "financeiro",
     "reason": "Cliente recusou fornecer CPF",
     "decision": "Cliente precisa de atendimento humano"
   }
```

---

## 📊 **MÉTRICAS E ANÁLISES**

### **Dashboard de Métricas:**

```
Total de Logs: 500
├── Raciocínios: 150 (30%)
├── Roteamentos: 125 (25%)
├── Funções: 175 (35%)
└── Decisões: 50 (10%)

Por Assistente:
├── Apresentação: 200 logs (40%)
├── Suporte: 150 logs (30%)
├── Comercial: 75 logs (15%)
├── Financeiro: 50 logs (10%)
└── Outros: 25 logs (5%)

Funções Mais Usadas:
1. consultar_boleto: 45 chamadas
2. diagnostico_pppoe: 38 chamadas
3. verificar_cliente: 32 chamadas
4. transferir_para_humano: 28 chamadas
5. rotear_para_assistente: 25 chamadas
```

---

## 🚨 **TROUBLESHOOTING**

### **Problema: Logs não aparecem**

**Checklist:**
```
1. ✅ WebSocket conectado? (Badge "Conectado" verde)
2. ✅ Assistentes processando mensagens?
3. ✅ Filtro correto aplicado?
4. ✅ Logs foram limpos acidentalmente?
5. ✅ Console do servidor mostra logs?
```

**Solução:**
```bash
# Verificar logs no servidor
grep -r "🧠\|🔀\|🛠️\|🎯" /tmp/logs/

# Testar WebSocket
wscat -c ws://localhost:5000/ws/agent-logs
```

### **Problema: WebSocket desconectando**

**Sintomas:**
```
Badge "Desconectado" vermelho
Logs param de chegar
```

**Solução:**
```
1. Recarregar página (F5)
2. Verificar conexão de rede
3. Verificar servidor está rodando
4. Verificar firewall/proxy
```

### **Problema: Muitos logs, interface lenta**

**Solução:**
```
1. Usar filtros para reduzir quantidade
2. Limpar logs antigos com botão "Limpar"
3. Pausar logs durante análise
4. Reduzir maxLogs no agent-logger.ts
```

---

## 🔄 **COMPARAÇÃO: LIVE LOGS vs AGENT LOGS**

| Aspecto | Live Logs | Agent Logs |
|---------|-----------|------------|
| **Foco** | Eventos do sistema | Raciocínios da IA |
| **Dados** | Webhooks, mensagens, erros | Decisões, roteamentos, funções |
| **Uso** | Debug técnico | Supervisão de IA |
| **Eventos** | MESSAGE_RECEIVED, CONVERSATION_ROUTED | REASONING, FUNCTION_CALL, DECISION |
| **Detalhes** | Payloads técnicos | Raciocínios e motivações |
| **URL** | /live-logs | /agent-logs |
| **WebSocket** | /ws/webhook-logs | /ws/agent-logs |

**Use Live Logs para:**
- ✅ Debugar webhooks
- ✅ Ver mensagens recebidas
- ✅ Erros técnicos
- ✅ Fluxo de entrada/saída

**Use Agent Logs para:**
- ✅ Entender decisões da IA
- ✅ Ver roteamentos entre assistentes
- ✅ Funções chamadas pela IA
- ✅ Análise de raciocínio

---

## 📄 **ARQUIVOS MODIFICADOS/CRIADOS**

```
✅ server/lib/agent-logger.ts (CRIADO)
   Sistema de logs de raciocínio dos agentes

✅ server/lib/openai.ts (MODIFICADO)
   Adicionado logs em pontos críticos:
   - Linha 3: Import agentLogger
   - Linha 187-191: Log de routing decision
   - Linha 299-310: Log de transferência para humano
   - Linha 325-336: Log de roteamento entre assistentes
   - Linha 350-359: Log de finalização de conversa

✅ server/routes.ts (MODIFICADO)
   Linha 5241-5242: Setup WebSocket
   Linha 5262-5278: Endpoints da API

✅ client/src/pages/AgentLogs.tsx (CRIADO)
   Interface completa com filtros, stats e real-time

✅ client/src/App.tsx (MODIFICADO)
   Linha 37: Import AgentLogs
   Linha 117-119: Rota /agent-logs

✅ client/src/components/app-sidebar.tsx (MODIFICADO)
   Linha 119-124: Menu "Logs dos Agentes IA"
```

---

## ✅ **RESUMO**

**O que foi implementado:**

1. ✅ **Sistema de Logs Completo**
   - Captura raciocínios, decisões e ações da IA
   - WebSocket em tempo real
   - Armazenamento em memória (últimos 500 logs)

2. ✅ **Interface Visual**
   - Dashboard com estatísticas
   - Filtros por tipo de log
   - Expandir/colapsar detalhes
   - Pausar/retomar logs
   - Auto-scroll e cores por tipo

3. ✅ **Integração OpenAI**
   - Logs em 4 pontos críticos
   - Routing decisions
   - Function calls
   - Transferências e finalizações

4. ✅ **API e WebSocket**
   - 3 endpoints REST
   - WebSocket em /ws/agent-logs
   - Stats em tempo real

**Vantagens:**

- 🎯 **Transparência**: Ver o que a IA está pensando
- 🔍 **Debug**: Identificar erros de raciocínio
- 📊 **Análise**: Métricas de uso de funções
- 🎓 **Treinamento**: Identificar padrões para melhorar prompts
- 👁️ **Supervisão**: Monitorar decisões em tempo real

**Acesso:**
```
URL: /agent-logs
Menu: Monitoramento → Logs dos Agentes IA
Permissões: ADMIN e SUPERVISOR
```

---

**Última Atualização:** 12 de Outubro de 2024  
**Versão:** 1.0 (Sistema de Agent Reasoning Logs)
