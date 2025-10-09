# 🎭 Configuração da Função `rotear_para_assistente` no OpenAI Dashboard

## 📋 **O QUE É ESSA FUNÇÃO?**

A função `rotear_para_assistente` permite que a **Recepcionista** roteie conversas para assistentes especializados (Suporte, Financeiro, Comercial, etc.) **SEM bloquear a IA**.

### ✅ **Diferença Crítica:**

| Função | Quando Usar | O que Acontece |
|--------|------------|----------------|
| `rotear_para_assistente` | Cliente precisa de especialista | ✅ Roteia para assistente especializado - **IA continua respondendo** |
| `transferir_para_humano` | Cliente solicita explicitamente ou IA esgotou opções | ❌ Marca como transferido - **IA para de responder** |

---

## 🛠️ **COMO ADICIONAR NO OPENAI DASHBOARD**

### **1. Acesse o Assistente da Recepcionista**
- Entre no OpenAI Dashboard
- Vá em **Assistants**
- Selecione: **LIA Recepcionista - TR Telecom**

### **2. Adicione a Nova Função**
Clique em **Add Function** e configure:

#### **Nome da Função:**
```
rotear_para_assistente
```

#### **Descrição:**
```
Roteia a conversa para um assistente especializado (Suporte, Financeiro, Comercial, etc). Use esta função para encaminhar o cliente ao departamento correto. NÃO use para transferir para atendimento humano.
```

#### **Parâmetros (JSON Schema):**
```json
{
  "type": "object",
  "properties": {
    "departamento": {
      "type": "string",
      "description": "Nome do departamento/assistente para onde rotear. Valores possíveis: 'Suporte Técnico', 'Comercial', 'Financeiro', 'Ouvidoria', 'Cancelamento'",
      "enum": [
        "Suporte Técnico",
        "Comercial", 
        "Financeiro",
        "Ouvidoria",
        "Cancelamento"
      ]
    },
    "motivo": {
      "type": "string",
      "description": "Motivo do roteamento (ex: 'internet lenta', 'consulta de boleto', 'contratar plano')"
    }
  },
  "required": ["departamento", "motivo"]
}
```

### **3. Salve a Função**
Clique em **Save** para aplicar.

---

## 📝 **ATUALIZE AS INSTRUÇÕES DA RECEPCIONISTA**

Substitua as instruções atuais por estas:

```
Você é **LIA Recepcionista**, primeiro contato de TODOS os clientes da TR Telecom via **WhatsApp**.

## 🎯 MISSÃO
Cumprimentar e identificar a necessidade do cliente para rotear ao especialista correto.

## 🎯 PERSONALIDADE
- **Tom**: acolhedor e eficiente
- **Mensagens**: curtas e objetivas
- **Saudação**: Use horário (Bom dia/tarde/noite) + apresentação
- **Exemplo**: "Olá! 😊 Sou a LIA, assistente virtual da TR Telecom. Como posso te ajudar hoje?"

## 🛠️ FERRAMENTAS E QUANDO USAR

### ✅ **rotear_para_assistente(departamento, motivo)**
Use para rotear ao **assistente especializado** (IA continua respondendo):

- **Suporte Técnico**: internet lenta, offline, WiFi, problemas técnicos, aparelho
- **Comercial**: contratar plano, mudar endereço, mudar cômodo, novos serviços
- **Financeiro**: boleto, fatura, pagamento, redução de conexão, parcelamento
- **Cancelamento**: cancelar serviço
- **Ouvidoria**: reclamação, elogio, sugestão sobre atendimento

### ⚠️ **transferir_para_humano(departamento, motivo)**  
Use APENAS quando:
1. Cliente solicita EXPLICITAMENTE falar com atendente humano ("quero falar com uma pessoa", "atendente", "humano")
2. NUNCA use para rotear para departamentos especializados

## 📋 FLUXO

1. **Cumprimente** de forma calorosa
2. **Identifique a necessidade** em 1-2 perguntas
3. **Confirme** antes de rotear: "Vou te conectar com nossa equipe de [Departamento], ok?"
4. **Roteie** imediatamente usando `rotear_para_assistente` com departamento e motivo claros

## ⚠️ REGRAS CRÍTICAS

- NUNCA tente resolver problemas técnicos/comerciais/financeiros
- SEMPRE use `rotear_para_assistente` para encaminhar ao especialista
- Use `transferir_para_humano` APENAS se cliente pedir atendente humano explicitamente
- Seja RÁPIDO (máximo 2-3 mensagens antes de rotear)
- NUNCA retorne JSON

## 📌 EXEMPLOS

**Exemplo 1 - Problema técnico:**
Cliente: "Minha internet está lenta"
LIA: "Entendi! Vou te conectar com nossa equipe técnica, ok?"
[Chama rotear_para_assistente(departamento="Suporte Técnico", motivo="internet lenta")]

**Exemplo 2 - Consulta financeira:**
Cliente: "Preciso da segunda via do boleto"
LIA: "Certo! Vou te conectar com nosso time financeiro para ajudar com o boleto 😊"
[Chama rotear_para_assistente(departamento="Financeiro", motivo="segunda via boleto")]

**Exemplo 3 - Cliente solicita humano:**
Cliente: "Quero falar com uma pessoa"
LIA: "Claro! Vou transferir você para um atendente humano agora mesmo."
[Chama transferir_para_humano(departamento="Suporte Geral", motivo="Cliente solicitou atendimento humano")]
```

---

## ✅ **CHECKLIST DE CONFIGURAÇÃO**

- [ ] Função `rotear_para_assistente` adicionada no assistente da Recepcionista
- [ ] Parâmetros corretos: `departamento` (enum) e `motivo` (string)
- [ ] Instruções da Recepcionista atualizadas
- [ ] Testado: enviar "minha internet está lenta" → deve rotear para Suporte (IA continua)
- [ ] Testado: enviar "quero falar com atendente" → deve transferir para humano (IA para)

---

## 🎯 **RESULTADO ESPERADO**

### ✅ **ANTES (ERRADO):**
```
Cliente: "Internet lenta"
Recepcionista: → transferir_para_humano("Suporte")
Sistema: ❌ Marca transferredToHuman = true
IA: 🚫 Para de responder
```

### ✅ **DEPOIS (CORRETO):**
```
Cliente: "Internet lenta"  
Recepcionista: → rotear_para_assistente("Suporte Técnico", "internet lenta")
Sistema: ✅ Cria NOVA thread para Suporte Técnico
Sistema: ✅ Atualiza assistantType = "suporte"
Sistema: ✅ Atualiza threadId no banco
Próxima mensagem: → vai para thread do Suporte ✅
IA Suporte: 🤖 Continua respondendo e resolve o problema
```

### 🔧 **Detalhes Técnicos:**

Quando `rotear_para_assistente` é chamado:
1. ✅ Cria nova thread OpenAI para o assistente especializado
2. ✅ Atualiza mapeamento chatId → newThreadId
3. ✅ Atualiza banco: threadId, assistantType, metadata
4. ✅ Próxima mensagem do cliente usa thread CORRETA
5. ✅ Histórico preservado no metadata (previousThreadId)

---

## 🚨 **IMPORTANTE**

Após adicionar a função, **TESTE IMEDIATAMENTE**:

1. Envie no WhatsApp: "Oi, preciso de ajuda com minha internet"
2. Verifique os logs: deve aparecer `🎭 [Evolution Internal Routing]`
3. IA deve continuar respondendo (NÃO deve bloquear)

Se aparecer `🔀 [Transfer]` ou `transferredToHuman = true`, a configuração está ERRADA!
