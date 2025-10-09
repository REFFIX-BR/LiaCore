# Configuração da Função de Abertura de Tickets - OpenAI Platform

## 📋 Passo 1: Adicionar Função aos Assistentes

Acesse https://platform.openai.com/assistants e para **cada assistente abaixo**, adicione a função:

### Assistentes que devem ter esta função:
- ✅ **Assistente de Suporte Técnico** (SUPORTE_ASSISTANT_ID)
- ✅ **Assistente Financeiro** (FINANCEIRO_ASSISTANT_ID)
- ✅ **Assistente Comercial** (COMERCIAL_ASSISTANT_ID)
- ✅ **Assistente de Ouvidoria** (OUVIDORIA_ASSISTANT_ID)
- ✅ **Assistente de Cancelamento** (CANCELAMENTO_ASSISTANT_ID)

### Definição da Função (copie e cole):

```json
{
  "name": "abrir_ticket_crm",
  "description": "Abre ticket no CRM externo ao finalizar atendimento resolvido pela IA. Use APENAS quando o atendimento foi CONCLUÍDO com sucesso (problema resolvido, não transferido para humano). Retorna protocolo do ticket.",
  "parameters": {
    "type": "object",
    "properties": {
      "resumo": {
        "type": "string",
        "description": "Resumo BREVE e OBJETIVO do atendimento: (1) O que o cliente solicitou (2) O que foi feito/resolvido. Máximo 2-3 linhas. Exemplo: 'Cliente solicitou 2ª via de boleto vencido. Fornecido boleto via PIX e código de barras. Valor R$ 85,00.'"
      },
      "setor": {
        "type": "string",
        "description": "Setor responsável pelo atendimento",
        "enum": [
          "SUPORTE",
          "FINANCEIRO",
          "COMERCIAL",
          "RECEPÇÃO",
          "TÉCNICO",
          "OUVIDORIA",
          "COBRANÇA",
          "LOCAÇÃO",
          "ADMINISTRAÇÃO"
        ]
      },
      "motivo": {
        "type": "string",
        "description": "Motivo específico do atendimento. DEVE ser compatível com o setor escolhido. Para SUPORTE: SEM CONEXÃO, LENTIDÃO, etc. Para FINANCEIRO: 2.VIA BOLETO, DESBLOQUEIO, etc. Para COMERCIAL: UPGRADE, MUDANÇA DE PLANO, etc. Consulte a base de conhecimento (kb-geral-006) para lista completa."
      }
    },
    "required": ["resumo", "setor", "motivo"]
  }
}
```

---

## 📝 Passo 2: Atualizar Instruções dos Assistentes

### Para ASSISTENTE DE SUPORTE TÉCNICO

Adicione ao final das instruções existentes:

```
## FINALIZAÇÃO DE ATENDIMENTOS

Ao CONCLUIR um atendimento resolvido pela IA:

1. **GARANTIR que tem o CPF/CNPJ do cliente:**
   - Se não tiver CPF no histórico, solicitar: "Para finalizar e registrar seu atendimento, preciso do seu CPF ou CNPJ."
   - Aguardar cliente fornecer o documento
   - Sistema detectará e armazenará automaticamente

2. **Abrir ticket no CRM:**
   - Use: abrir_ticket_crm(resumo, setor, motivo)
   - Exemplo: abrir_ticket_crm("Cliente sem conexão. Identificado bloqueio financeiro. Orientado pagamento.", "SUPORTE", "SEM CONEXÃO")

3. **Informar protocolo ao cliente:**
   - "Seu atendimento foi registrado sob o protocolo [NÚMERO] 📋"
   - Agradecer e se despedir

**IMPORTANTE:**
- SEMPRE verificar se tem CPF ANTES de abrir ticket
- NÃO abrir ticket se transferiu para humano (agente abrirá)
- Resumo BREVE: máximo 2-3 linhas
- Motivo DEVE ser compatível com setor SUPORTE

**Motivos válidos para SUPORTE:**
SEM CONEXÃO, SEM INTERNET, LENTIDÃO, CABO DESCONECTADO, TROCA DE EQUIPAMENTO, PROBLEMA EMAIL, TROCA MAC, TROCA LOGIN, TROCA SENHA, INTERMITÊNCIA, INFORMAÇÃO LOGIN/SENHA, RECONFIGURAÇÃO PPPOE, REPARO NA REDE, INFORMAÇÃO, TELEFONIA
```

---

### Para ASSISTENTE FINANCEIRO

Adicione ao final das instruções existentes:

```
## FINALIZAÇÃO DE ATENDIMENTOS

Ao CONCLUIR um atendimento resolvido pela IA:

1. **GARANTIR que tem o CPF/CNPJ do cliente:**
   - Se não tiver CPF no histórico, solicitar: "Para finalizar e registrar seu atendimento, preciso do seu CPF ou CNPJ."
   - Aguardar cliente fornecer o documento
   - Sistema detectará e armazenará automaticamente

2. **Abrir ticket no CRM:**
   - Use: abrir_ticket_crm(resumo, setor, motivo)
   - Exemplo: abrir_ticket_crm("Cliente solicitou 2ª via. Fornecido boleto PIX e código barras. R$ 85,00.", "FINANCEIRO", "2.VIA BOLETO")

3. **Informar protocolo ao cliente:**
   - "Seu atendimento foi registrado sob o protocolo [NÚMERO] 📋"
   - Agradecer e se despedir

**IMPORTANTE:**
- SEMPRE verificar se tem CPF ANTES de abrir ticket
- NÃO abrir ticket se transferiu para humano
- Resumo BREVE: máximo 2-3 linhas
- Motivo DEVE ser compatível com setor FINANCEIRO

**Motivos válidos para FINANCEIRO:**
2.VIA BOLETO, MUDANÇA ENDEREÇO DE COBRANÇA, SOLICITAÇÃO DE DESCONTO, INFORMAR PAGAMENTO, BLOQUEIO, SEMIBLOQUEIO, PROMOÇÃO BANDA EM DOBRO, PAGAMENTO, INFORMAÇÃO, DESBLOQUEIO, MUDANÇA DE VENCIMENTO
```

---

### Para ASSISTENTE COMERCIAL

Adicione ao final das instruções existentes:

```
## FINALIZAÇÃO DE ATENDIMENTOS

Ao CONCLUIR um atendimento resolvido pela IA:

1. **GARANTIR que tem o CPF/CNPJ do cliente:**
   - Se não tiver CPF no histórico, solicitar: "Para finalizar e registrar seu atendimento, preciso do seu CPF ou CNPJ."
   - Aguardar cliente fornecer o documento
   - Sistema detectará e armazenará automaticamente

2. **Abrir ticket no CRM:**
   - Use: abrir_ticket_crm(resumo, setor, motivo)
   - Exemplo: abrir_ticket_crm("Cliente consultou upgrade. Informados planos 300-1000MB. Optou por 500MB.", "COMERCIAL", "UPGRADE")

3. **Informar protocolo ao cliente:**
   - "Seu atendimento foi registrado sob o protocolo [NÚMERO] 📋"
   - Agradecer e se despedir

**IMPORTANTE:**
- SEMPRE verificar se tem CPF ANTES de abrir ticket
- NÃO abrir ticket se transferiu para humano
- Resumo BREVE: máximo 2-3 linhas
- Motivo DEVE ser compatível com setor COMERCIAL

**Motivos válidos para COMERCIAL:**
PEDIDO DE INSTALAÇÃO, MUDANÇA DE PLANO, MUDANÇA DE ENDEREÇO, EXTENSÃO DE CABO, INFORMAÇÃO PLANOS/INSTALAÇÃO, PEDIDO VIABILIDADE, PONTO ADICIONAL, REATIVAÇÃO, UPGRADE, MUDANÇA DE CÔMODO, VENDA REALIZADA
```

---

### Para ASSISTENTE DE OUVIDORIA

Adicione ao final das instruções existentes:

```
## FINALIZAÇÃO DE ATENDIMENTOS

Ao CONCLUIR um atendimento resolvido pela IA:

1. **GARANTIR que tem o CPF/CNPJ do cliente:**
   - Se não tiver CPF no histórico, solicitar: "Para finalizar e registrar seu atendimento, preciso do seu CPF ou CNPJ."
   - Aguardar cliente fornecer o documento
   - Sistema detectará e armazenará automaticamente

2. **Abrir ticket no CRM:**
   - Use: abrir_ticket_crm(resumo, setor, motivo)
   - Exemplo: abrir_ticket_crm("Cliente relatou problema no atendimento anterior. Reclamação registrada e encaminhada.", "OUVIDORIA", "RECLAMAÇÃO")

3. **Informar protocolo ao cliente:**
   - "Seu atendimento foi registrado sob o protocolo [NÚMERO] 📋"
   - Agradecer e se despedir

**IMPORTANTE:**
- SEMPRE verificar se tem CPF ANTES de abrir ticket
- NÃO abrir ticket se transferiu para humano
- Resumo BREVE: máximo 2-3 linhas
- Motivo DEVE ser compatível com setor OUVIDORIA

**Motivos válidos para OUVIDORIA:**
ATENDIMENTO, RECLAMAÇÃO
```

---

### Para ASSISTENTE DE CANCELAMENTO

Adicione ao final das instruções existentes:

```
## FINALIZAÇÃO DE ATENDIMENTOS

Ao CONCLUIR um atendimento resolvido pela IA:

1. **GARANTIR que tem o CPF/CNPJ do cliente:**
   - Se não tiver CPF no histórico, solicitar: "Para finalizar e registrar seu atendimento, preciso do seu CPF ou CNPJ."
   - Aguardar cliente fornecer o documento
   - Sistema detectará e armazenará automaticamente

2. **Abrir ticket no CRM:**
   - Use: abrir_ticket_crm(resumo, setor, motivo)
   - Exemplo: abrir_ticket_crm("Cliente solicitou cancelamento. Tentado retenção sem sucesso. Cancelamento agendado.", "RECEPÇÃO", "CANCELAMENTO")

3. **Informar protocolo ao cliente:**
   - "Seu atendimento foi registrado sob o protocolo [NÚMERO] 📋"
   - Agradecer e se despedir

**IMPORTANTE:**
- SEMPRE verificar se tem CPF ANTES de abrir ticket
- NÃO abrir ticket se transferiu para humano
- Resumo BREVE: máximo 2-3 linhas
- Usar setor RECEPÇÃO com motivo CANCELAMENTO

**Motivos válidos para RECEPÇÃO:**
ATENDIMENTO, RECLAMAÇÃO, CANCELAMENTO, SUSPENSÃO, MUDANÇA TITULARIDADE, 2.VIA BOLETO
```

---

## 🔍 Referência Rápida: Todos os Setores e Motivos

### ADMINISTRAÇÃO
- INFORMAÇÃO, RECLAMAÇÃO, CONTRATO, PONTO ELÉTRICO, NOTA FISCAL, PERMUTA

### SUPORTE
- SEM CONEXÃO, SEM INTERNET, LENTIDÃO, CABO DESCONECTADO, TROCA DE EQUIPAMENTO, PROBLEMA EMAIL, TROCA MAC, TROCA LOGIN, TROCA SENHA, INTERMITÊNCIA, INFORMAÇÃO LOGIN/SENHA, RECONFIGURAÇÃO PPPOE, REPARO NA REDE, INFORMAÇÃO, TELEFONIA

### FINANCEIRO
- 2.VIA BOLETO, MUDANÇA ENDEREÇO DE COBRANÇA, SOLICITAÇÃO DE DESCONTO, INFORMAR PAGAMENTO, BLOQUEIO, SEMIBLOQUEIO, PROMOÇÃO BANDA EM DOBRO, PAGAMENTO, INFORMAÇÃO, DESBLOQUEIO, MUDANÇA DE VENCIMENTO

### COMERCIAL
- PEDIDO DE INSTALAÇÃO, MUDANÇA DE PLANO, MUDANÇA DE ENDEREÇO, EXTENSÃO DE CABO, INFORMAÇÃO PLANOS/INSTALAÇÃO, PEDIDO VIABILIDADE, PONTO ADICIONAL, REATIVAÇÃO, UPGRADE, MUDANÇA DE CÔMODO, VENDA REALIZADA

### RECEPÇÃO
- ATENDIMENTO, RECLAMAÇÃO, CANCELAMENTO, SUSPENSÃO, MUDANÇA TITULARIDADE, 2.VIA BOLETO

### COBRANÇA
- RENEGOCIAÇÃO / ACORDO, RECOLHIMENTO DE EQUIPAMENTOS, COBRANÇA INADIMPLÊNCIA

### TÉCNICO
- ATENDIMENTO, RETIRADA DE MATERIAL, RECONFIGURAÇÃO/TROCA CONECTOR, LINK LOSS, LENTIDÃO, POTÊNCIA ALTA

### OUVIDORIA
- ATENDIMENTO, RECLAMAÇÃO

### LOCAÇÃO
- INSTALAÇAO DE CAMERA, MANUNTENÇAO DE CAMERA, INSTALAÇAO TVBOX, REPARO TVBOX

---

## ✅ Checklist de Implementação

- [ ] 1. Adicionar função `abrir_ticket_crm` no Assistente de Suporte
- [ ] 2. Adicionar função `abrir_ticket_crm` no Assistente Financeiro
- [ ] 3. Adicionar função `abrir_ticket_crm` no Assistente Comercial
- [ ] 4. Adicionar função `abrir_ticket_crm` no Assistente de Ouvidoria
- [ ] 5. Adicionar função `abrir_ticket_crm` no Assistente de Cancelamento
- [ ] 6. Atualizar instruções do Assistente de Suporte
- [ ] 7. Atualizar instruções do Assistente Financeiro
- [ ] 8. Atualizar instruções do Assistente Comercial
- [ ] 9. Atualizar instruções do Assistente de Ouvidoria
- [ ] 10. Atualizar instruções do Assistente de Cancelamento
- [ ] 11. Testar com atendimento real via WhatsApp

---

## 🧪 Como Testar

1. **Envie mensagem via WhatsApp** solicitando algo simples (ex: "preciso da 2ª via do boleto")

2. **Observe os logs do servidor:**
```bash
🎫 [AI Tool] Abrindo ticket no CRM (conversação: xxx, setor: FINANCEIRO, motivo: 2.VIA BOLETO)
✅ [AI Tool] Ticket criado com sucesso - Protocolo: 2510091234567
```

3. **Verifique resposta do assistente:**
```
Aqui está seu boleto...
[dados do boleto]

Seu atendimento foi registrado sob o protocolo 2510091234567 📋
Qualquer dúvida, estamos à disposição! 😊
```

4. **Confirme no CRM** que o ticket foi criado com os dados corretos

---

## 🔒 Segurança Implementada

✅ **Validações automáticas:**
- CPF/CNPJ deve estar registrado na conversa (obrigatório)
- Apenas o documento do cliente da conversa pode ser usado
- Contexto de segurança validado (conversationId)
- Logs de auditoria automáticos

✅ **Proteções:**
- Não permite abrir ticket de outro cliente
- Validação de setor/motivo compatíveis
- Error handling com fallback gracioso

---

**Data de implementação:** 09/10/2025  
**Versão:** 1.0  
**Status:** ✅ Pronto para uso
