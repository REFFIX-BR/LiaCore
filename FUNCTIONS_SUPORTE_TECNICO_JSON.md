# 🔧 FUNCTIONS - SUPORTE TÉCNICO (OpenAI Dashboard)

**Copie cada função abaixo e cole no OpenAI Dashboard**

---

## 📋 PASSO A PASSO

1. **Acesse:** https://platform.openai.com/playground/assistants?assistant=asst_CDkh1oE8YvKLtJYs3WY4rJX8

2. **Clique em "Edit"**

3. **Role até a seção "Functions"**

4. **Para cada função abaixo:**
   - Clique em "+ Add function"
   - Copie o JSON completo
   - Cole no editor
   - Clique em "Save"

5. **Repita para todas as 7 funções**

---

## ✅ FUNÇÃO 1: verificar_conexao

```json
{
  "name": "verificar_conexao",
  "description": "Verifica o status da conexão PPPoE/ONT em tempo real do cliente. SEMPRE use esta função quando cliente reportar problema de conexão (sem internet, lentidão, offline). Retorna statusIP (BLOQUEIO/ATIVO), statusPPPoE (ONLINE/OFFLINE), onu_run_state, onu_last_down_cause e informações sobre falha massiva se houver.",
  "parameters": {
    "type": "object",
    "properties": {
      "documento": {
        "type": "string",
        "description": "CPF ou CNPJ do cliente (apenas números). OPCIONAL - se não fornecido, o sistema busca automaticamente do banco de dados."
      }
    },
    "required": []
  }
}
```

---

## ✅ FUNÇÃO 2: consultar_base_de_conhecimento

```json
{
  "name": "consultar_base_de_conhecimento",
  "description": "Consulta a base de conhecimento interna (RAG) para obter procedimentos detalhados, interpretação de status técnicos, guias de equipamentos e regras de encaminhamento. Use quando precisar de informações técnicas específicas ou orientações sobre diagnóstico.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Pergunta ou tópico a consultar na base de conhecimento. Exemplos: 'interpretação luzes modem', 'procedimento reiniciar equipamento', 'quando encaminhar financeiro vs suporte'"
      }
    },
    "required": ["query"]
  }
}
```

---

## ✅ FUNÇÃO 3: agendar_visita

```json
{
  "name": "agendar_visita",
  "description": "Agenda visita técnica presencial quando necessário. Use quando: problema não pode ser resolvido remotamente, cliente relata problema físico (cabos, equipamento danificado), ou após tentativas de diagnóstico remoto sem sucesso.",
  "parameters": {
    "type": "object",
    "properties": {
      "motivo": {
        "type": "string",
        "description": "Motivo detalhado da visita técnica. Exemplo: 'Cliente sem conexão, ONT offline, possível problema no cabeamento'"
      },
      "urgencia": {
        "type": "string",
        "enum": ["normal", "urgente"],
        "description": "Nível de urgência da visita. Use 'urgente' para problemas críticos ou clientes prioritários."
      }
    },
    "required": ["motivo"]
  }
}
```

---

## ✅ FUNÇÃO 4: transferir_para_humano

```json
{
  "name": "transferir_para_humano",
  "description": "Transfere a conversa para atendente humano. SEMPRE use quando: cliente solicitar explicitamente (ex: 'quero falar com atendente'), cliente recusar fornecer CPF/CNPJ, problema requer atenção humana, procedimentos técnicos avançados, ou solicitação de troca de senha Wi-Fi.",
  "parameters": {
    "type": "object",
    "properties": {
      "departamento": {
        "type": "string",
        "description": "Departamento de destino. Exemplos: 'Suporte Técnico', 'Financeiro', 'Comercial'. Opcional, pode deixar vazio para transferir para suporte geral."
      },
      "motivo": {
        "type": "string",
        "description": "Motivo da transferência. Seja específico para ajudar o atendente humano. Exemplo: 'Cliente solicitou troca de senha Wi-Fi', 'Cliente recusou fornecer CPF', 'Problema técnico complexo - ONT offline após múltiplas tentativas'"
      }
    },
    "required": ["motivo"]
  }
}
```

---

## ✅ FUNÇÃO 5: abrir_ticket_crm

```json
{
  "name": "abrir_ticket_crm",
  "description": "Registra um atendimento no CRM externo. Use APENAS quando você RESOLVEU um problema do cliente e o atendimento está FINALIZADO com sucesso. NÃO use se vai transferir para humano. Retorna protocolo do ticket criado.",
  "parameters": {
    "type": "object",
    "properties": {
      "resumo": {
        "type": "string",
        "description": "Resumo DETALHADO do atendimento e como foi resolvido. Exemplo: 'Cliente sem internet. Diagnóstico: ONT offline por queda de energia. Orientado reiniciar modem. Conexão restabelecida com sucesso.'"
      },
      "setor": {
        "type": "string",
        "enum": ["SUPORTE", "FINANCEIRO", "COMERCIAL", "OUVIDORIA", "CANCELAMENTO"],
        "description": "Setor responsável pelo atendimento. Para suporte técnico, sempre use 'SUPORTE'."
      },
      "motivo": {
        "type": "string",
        "enum": ["SEM CONEXÃO", "SEM INTERNET", "LENTIDÃO", "CABO DESCONECTADO", "TROCA DE EQUIPAMENTO", "PROBLEMA EMAIL", "TROCA MAC", "TROCA LOGIN", "TROCA SENHA", "INTERMITÊNCIA", "INFORMAÇÃO LOGIN/SENHA", "RECONFIGURAÇÃO PPPOE", "REPARO NA REDE", "INFORMAÇÃO", "TELEFONIA"],
        "description": "Motivo específico do atendimento. Escolha o mais apropriado da lista."
      }
    },
    "required": ["resumo", "setor", "motivo"]
  }
}
```

---

## ✅ FUNÇÃO 6: finalizar_conversa

```json
{
  "name": "finalizar_conversa",
  "description": "Finaliza o atendimento e dispara automaticamente pesquisa NPS para o cliente via WhatsApp. Use APENAS quando: problema foi COMPLETAMENTE resolvido pela IA, cliente confirmou satisfação (ex: 'Obrigado', 'Resolvido', 'Funcionou'). NÃO use se vai transferir para humano ou se problema persiste.",
  "parameters": {
    "type": "object",
    "properties": {
      "motivo": {
        "type": "string",
        "description": "Descrição do que foi resolvido. Exemplo: 'Internet restabelecida após reiniciar modem', 'Cliente orientado sobre luzes do equipamento - conexão normalizada'"
      }
    },
    "required": ["motivo"]
  }
}
```

---

## ✅ FUNÇÃO 7: selecionar_ponto_instalacao

```json
{
  "name": "selecionar_ponto_instalacao",
  "description": "Seleciona um ponto de instalação específico quando cliente possui múltiplos endereços. Use APÓS cliente indicar qual endereço está com problema (ex: 'o da rua X', 'número 1', 'primeiro'). Sistema retornará informações do ponto selecionado e detectará falhas massivas na região.",
  "parameters": {
    "type": "object",
    "properties": {
      "numeroPonto": {
        "type": "number",
        "description": "Número do ponto de instalação que o cliente selecionou (1, 2, 3, etc). Baseado na lista apresentada anteriormente ao cliente."
      }
    },
    "required": ["numeroPonto"]
  }
}
```

---

## 📊 RESUMO DAS FUNÇÕES

| Função | Quando Usar | Obrigatória? |
|--------|-------------|--------------|
| `verificar_conexao` | Cliente reporta problema de conexão | ✅ SIM |
| `consultar_base_de_conhecimento` | Precisa de informações técnicas | Opcional |
| `agendar_visita` | Problema requer visita presencial | Quando necessário |
| `transferir_para_humano` | Cliente pede humano ou problema complexo | ✅ SIM quando solicitado |
| `abrir_ticket_crm` | Problema RESOLVIDO pela IA | Quando resolver |
| `finalizar_conversa` | Atendimento concluído com sucesso | Quando finalizar |
| `selecionar_ponto_instalacao` | Cliente tem múltiplos endereços | Quando aplicável |

---

## ⚠️ REGRAS CRÍTICAS

1. **SEMPRE execute a função ANTES de responder ao cliente**
2. **NUNCA simule execução** com texto tipo "*[EXECUTO: ...]"
3. **verificar_conexao:** Chame SEM parâmetro (sistema busca CPF automaticamente)
4. **Bloqueio Financeiro:** Se statusIP = BLOQUEIO/SEMIBLOQUEIO → transferir para Financeiro IMEDIATAMENTE
5. **Troca de senha Wi-Fi:** SEMPRE transferir para humano
6. **Finalizar vs Transferir:**
   - Problema resolvido → `abrir_ticket_crm` + `finalizar_conversa`
   - Problema NÃO resolvido → `transferir_para_humano`

---

## 🎯 VALIDAÇÃO

Após adicionar todas as funções:

1. **Confira que todas as 7 funções estão ativas** na lista
2. **Salve o assistente**
3. **Teste via WhatsApp:**
   - "Minha internet caiu" → Deve chamar `verificar_conexao`
   - "Quero falar com atendente" → Deve chamar `transferir_para_humano`

---

**Status:** ✅ Pronto para copiar e colar no OpenAI Dashboard

**Link direto:** https://platform.openai.com/playground/assistants?assistant=asst_CDkh1oE8YvKLtJYs3WY4rJX8
