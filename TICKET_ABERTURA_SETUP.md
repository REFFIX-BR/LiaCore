# 🎫 Sistema de Abertura de Tickets no CRM

## 📋 Visão Geral

O sistema permite que os assistentes de IA abram tickets automaticamente no CRM externo quando o cliente envia comprovantes de pagamento ou necessita de registro formal de atendimento.

---

## 🔧 Implementação Técnica

### Backend Completo ✅

**Localização:** `server/ai-tools.ts` e `server/lib/openai.ts`

**Endpoint da API Externa:**
```
POST https://webhook.trtelecom.net/webhook/abrir_ticket
```

**Funcionalidades Implementadas:**
- ✅ Validação de segurança: requer `conversationId` e `clientDocument`
- ✅ Validação de combinações válidas entre setor/motivo
- ✅ Retry automático com circuit breaker
- ✅ Logging completo sem exposição de dados sensíveis (LGPD/GDPR)
- ✅ Handler registrado em `server/lib/openai.ts`

---

## 🤖 Configuração no OpenAI Platform

### Assistentes que DEVEM ter essa função:

1. **✅ FINANCEIRO** (asst_pRXVhoy1o4YxNxVmaRiNOTMX)
2. **✅ SUPORTE** (asst_aF7OvhbUuSfM8qUdR2JEFBhM)
3. **❓ RECEPÇÃO** (opcional - avaliar se necessário)

---

## 📝 Configuração da Função no OpenAI

### Passo 1: Acessar o Assistente

1. Vá para: https://platform.openai.com/assistants
2. Selecione o assistente **FINANCEIRO** ou **SUPORTE**
3. Clique em **Tools** → **Add Function**

### Passo 2: Configurar a Função

**1. Nome da Função** (obrigatório):
```
abrir_ticket_crm
```

**2. Descrição** (obrigatório):
```
Abre um ticket no sistema CRM para registrar formalmente o atendimento do cliente. 

USE ESTA FUNÇÃO quando:
- Cliente enviar comprovante de pagamento (para FINANCEIRO)
- Cliente solicitar registro formal do atendimento
- Necessário criar protocolo de atendimento
- Após resolver problema técnico (para SUPORTE)

NÃO USE para:
- Transferências simples para humano (use transferir_para_humano)
- Problemas não resolvidos (transfira primeiro)

O sistema captura automaticamente o CPF/CNPJ da conversa - você NÃO precisa pedir novamente.
```

**3. Parameters (Schema JSON completo)**:
```json
{
  "name": "abrir_ticket_crm",
  "description": "Abre um ticket no sistema CRM para registrar formalmente o atendimento do cliente.",
  "parameters": {
    "type": "object",
    "properties": {
      "resumo": {
        "type": "string",
        "description": "Resumo COMPLETO e CLARO do atendimento incluindo: (1) Nome do cliente, (2) Problema/solicitação relatada, (3) Resolução aplicada ou ação tomada. Exemplo: 'Cliente João solicitou desbloqueio. Verificado pagamento de R$ 150,00 referente à fatura 10/2025. Conexão desbloqueada com sucesso.'"
      },
      "setor": {
        "type": "string",
        "description": "Setor responsável. Valores válidos: ADMINISTRAÇÃO, SUPORTE, FINANCEIRO, COMERCIAL, RECEPÇÃO, COBRANÇA, TÉCNICO, OUVIDORIA, LOCAÇÃO",
        "enum": [
          "ADMINISTRAÇÃO",
          "SUPORTE",
          "FINANCEIRO",
          "COMERCIAL",
          "RECEPÇÃO",
          "COBRANÇA",
          "TÉCNICO",
          "OUVIDORIA",
          "LOCAÇÃO"
        ]
      },
      "motivo": {
        "type": "string",
        "description": "Motivo do atendimento COMPATÍVEL com o setor escolhido. Consulte a lista de combinações válidas na documentação interna. Exemplos para FINANCEIRO: INFORMAR PAGAMENTO, DESBLOQUEIO, PAGAMENTO. Para SUPORTE: SEM CONEXÃO, SEM INTERNET, LENTIDÃO."
      }
    },
    "required": ["resumo", "setor", "motivo"]
  }
}
```

> **💡 Dica:** No OpenAI Platform, você pode copiar e colar o schema JSON completo acima diretamente no campo "Parameters" após preencher Nome e Descrição.

---

## 📚 Combinações Válidas: Setor × Motivo

### FINANCEIRO
- 2.VIA BOLETO
- MUDANÇA ENDEREÇO DE COBRANÇA
- SOLICITAÇÃO DE DESCONTO
- **INFORMAR PAGAMENTO** ← Use quando cliente enviar comprovante
- BLOQUEIO
- SEMIBLOQUEIO
- PROMOÇÃO BANDA EM DOBRO
- **PAGAMENTO** ← Alternativa para comprovantes
- INFORMAÇÃO
- **DESBLOQUEIO** ← Após processar desbloqueio
- MUDANÇA DE VENCIMENTO

### SUPORTE
- SEM CONEXÃO
- SEM INTERNET
- LENTIDÃO
- CABO DESCONECTADO
- TROCA DE EQUIPAMENTO
- PROBLEMA EMAIL
- TROCA MAC
- TROCA LOGIN
- TROCA SENHA
- INTERMITÊNCIA
- INFORMAÇÃO LOGIN/SENHA
- RECONFIGURAÇÃO PPPOE
- REPARO NA REDE
- INFORMAÇÃO
- TELEFONIA

### ADMINISTRAÇÃO
- INFORMAÇÃO
- RECLAMAÇÃO
- CONTRATO
- PONTO ELÉTRICO
- NOTA FISCAL
- PERMUTA

### COMERCIAL
- PEDIDO DE INSTALAÇÃO
- MUDANÇA DE PLANO
- MUDANÇA DE ENDEREÇO
- EXTENSÃO DE CABO
- INFORMAÇÃO PLANOS/INSTALAÇÃO
- PEDIDO VIABILIDADE
- PONTO ADICIONAL
- REATIVAÇÃO
- UPGRADE
- MUDANÇA DE CÔMODO
- VENDA REALIZADA

### RECEPÇÃO
- ATENDIMENTO
- RECLAMAÇÃO
- CANCELAMENTO
- SUSPENSÃO
- MUDANÇA TITULARIDADE
- 2.VIA BOLETO

### COBRANÇA
- RENEGOCIAÇÃO / ACORDO
- RECOLHIMENTO DE EQUIPAMENTOS
- COBRANÇA INADIMPLÊNCIA

### TÉCNICO
- ATENDIMENTO
- RETIRADA DE MATERIAL
- RECONFIGURAÇÃO/TROCA CONECTOR
- LINK LOSS
- LENTIDÃO
- POTÊNCIA ALTA

### OUVIDORIA
- ATENDIMENTO
- RECLAMAÇÃO

### LOCAÇÃO
- INSTALAÇAO DE CAMERA
- MANUNTENÇAO DE CAMERA
- INSTALAÇAO TVBOX
- REPARO TVBOX

---

## 🎯 Workflow: Comprovante de Pagamento → Ticket

### Cenário Real

**Cliente envia:**
- Imagem de comprovante de pagamento
- Mensagem: "Enviei o comprovante"

**Fluxo Esperado:**

1. **GPT-4o Vision** analisa a imagem automaticamente
2. **Assistente FINANCEIRO** detecta: "comprovante de pagamento recebido"
3. **Assistente decide** entre duas opções:

**Opção A - Abertura Automática de Ticket:**
```javascript
abrir_ticket_crm({
  "resumo": "Cliente Maria Silva enviou comprovante de pagamento de R$ 150,00 via Pix em 27/10/2025. Valor referente à fatura de outubro/2025. Aguardando confirmação bancária.",
  "setor": "FINANCEIRO",
  "motivo": "INFORMAR PAGAMENTO"
})
```

**Opção B - Transferência para Humano:**
```javascript
transferir_para_humano({
  "departamento": "financeiro",
  "motivo": "Verificação de comprovante de pagamento recebido do cliente"
})
```

---

## ⚡ Resposta da API

**Exemplo de sucesso:**
```json
[
  {
    "data": [
      {
        "resposta": [
          {
            "protocolo": "2510271534789012"
          }
        ]
      }
    ]
  }
]
```

**IA responde ao cliente:**
> "Recebi seu comprovante de pagamento! ✅ Ticket registrado com sucesso.  
> **Protocolo: 2510271534789012**  
> Nosso setor financeiro irá confirmar o pagamento em até 24 horas e sua conexão será liberada automaticamente. 💙"

---

## 🔒 Segurança e Validações

### Validações Implementadas

1. **✅ conversationId obrigatório** - Garante rastreabilidade
2. **✅ clientDocument obrigatório** - CPF/CNPJ deve estar salvo na conversa
3. **✅ Validação setor/motivo** - Previne combinações inválidas
4. **✅ Retry automático** - Até 3 tentativas com backoff exponencial
5. **✅ Circuit breaker** - Protege contra falhas em cascata

### Logging LGPD/GDPR Compliant

**✅ O que é logado:**
- Protocolo gerado
- Setor e motivo
- ConversationId
- Timestamp

**❌ O que NUNCA é logado:**
- CPF/CNPJ completo
- Dados pessoais do cliente
- Valores financeiros
- Informações sensíveis

---

## 🧪 Como Testar

### 1. Teste Manual via WhatsApp

**Cenário 1 - Comprovante de Pagamento:**
```
Cliente: [envia imagem do comprovante]
Cliente: "Acabei de pagar"

Esperado: IA detecta e abre ticket com FINANCEIRO → INFORMAR PAGAMENTO
```

**Cenário 2 - Após Resolver Problema:**
```
Cliente: "Minha internet voltou! Obrigado"
IA: [verifica que resolveu problema de conexão]
IA: [abre ticket com SUPORTE → SEM INTERNET]
IA: "Que bom que resolveu! Protocolo: XXX..."
```

### 2. Verificar nos Logs

Após chamar a função, procure:
```
🎫 [AI Tool Handler] Iniciando abertura de ticket
🎫 [AI Tool Handler] Conversa encontrada. clientDocument: SIM
🎫 [AI Tool Handler] Chamando abrirTicketCRM...
✅ [AI Tool Handler] Ticket aberto com sucesso - Protocolo: 2510271534789012
```

### 3. Confirmar no CRM Externo

Verificar se o ticket foi criado no sistema TR Telecom com:
- ✅ Protocolo correto
- ✅ Setor adequado
- ✅ Motivo compatível
- ✅ Resumo claro e completo

---

## 🚨 Troubleshooting

### Erro: "Parâmetros obrigatórios faltando"
**Causa:** IA não forneceu resumo, setor ou motivo  
**Solução:** Revisar instructions do assistente

### Erro: "Motivo não é compatível com setor"
**Causa:** Combinação inválida (ex: "SEM CONEXÃO" com setor "FINANCEIRO")  
**Solução:** Consultar tabela de combinações válidas acima

### Erro: "Para abrir um ticket, preciso do seu CPF ou CNPJ"
**Causa:** Cliente ainda não forneceu documento  
**Solução:** IA deve solicitar CPF/CNPJ antes de abrir ticket

### Ticket criado mas sem protocolo
**Causa:** API retornou sucesso mas sem protocolo  
**Solução:** Verificar resposta da API no log detalhado

---

## 📊 Métricas e Monitoramento

### KPIs Importantes

- **Taxa de sucesso na abertura** - Meta: >95%
- **Tempo médio de resposta da API** - Meta: <500ms
- **Tickets com combinação inválida** - Meta: <1%
- **Tickets sem protocolo** - Meta: 0%

### Logs para Análise

```bash
# Buscar tickets abertos hoje
grep "🎫 \[AI Tool Handler\] Ticket aberto com sucesso" logs.txt

# Buscar erros na abertura
grep "❌ \[AI Tool Handler\] Erro ao abrir ticket" logs.txt

# Verificar combinações setor/motivo usadas
grep "Chamando abrirTicketCRM" logs.txt
```

---

## 🎓 Recomendações de Uso

### Para Assistente FINANCEIRO

**SEMPRE use `abrir_ticket_crm` quando:**
- Cliente enviar comprovante de pagamento ✅
- Após processar desbloqueio automatizado ✅
- Cliente solicitar protocolo formal do atendimento ✅

**NUNCA use quando:**
- Problema não foi resolvido ❌
- Cliente está apenas consultando informações ❌
- Transferência para humano é mais adequada ❌

### Para Assistente SUPORTE

**SEMPRE use `abrir_ticket_crm` quando:**
- Problema técnico foi resolvido pela IA ✅
- Cliente confirma que conexão voltou ✅
- Necessário registrar solução aplicada ✅

**NUNCA use quando:**
- Problema persiste e precisa técnico presencial ❌
- Diagnóstico ainda não foi concluído ❌

---

## 📝 Próximos Passos

1. ✅ **Backend implementado** - Handler completo em `openai.ts`
2. ⏳ **Configurar no OpenAI Platform** - Adicionar função aos assistentes
3. ⏳ **Testar em produção** - Validar com casos reais
4. ⏳ **Monitorar métricas** - Acompanhar taxa de sucesso
5. ⏳ **Ajustar instructions** - Otimizar quando usar a função

---

## 📞 Suporte

**Dúvidas sobre implementação:**
- Verificar logs em `/tmp/logs/`
- Consultar `server/ai-tools.ts` (função `abrirTicketCRM`)
- Consultar `server/lib/openai.ts` (handler `abrir_ticket_crm`)

**Problemas com API externa:**
- Endpoint: `https://webhook.trtelecom.net/webhook/abrir_ticket`
- Verificar conectividade
- Confirmar que setor/motivo são válidos

---

**Última atualização:** 27 de outubro de 2025  
**Status:** ✅ Implementação Backend Completa - Pronto para registro no OpenAI Platform
