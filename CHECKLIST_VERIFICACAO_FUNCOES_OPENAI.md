# ✅ Checklist de Verificação - Funções OpenAI Dashboard

## 🚨 **ATENÇÃO IMPORTANTE**
Este documento é EXCLUSIVAMENTE para uso HUMANO na configuração manual do OpenAI Dashboard.
Os schemas JSON aqui apresentados devem ser configurados através da interface web do OpenAI.
**NÃO** inclua este documento nas instruções dos assistentes.

## 🎯 Objetivo
Este checklist ajuda a verificar se todas as funções (tools) estão corretamente configuradas no OpenAI Dashboard para cada assistente, evitando que o assistente **escreva as chamadas como texto** ao invés de **executá-las**.

---

## 🚨 Problema Identificado

**Sintoma:** Assistente envia mensagens como:
```
[use rotear_para_assistente com assistantType="financeiro", motivo="Cliente solicitou 2ª via do boleto"]
```

**Causa Raiz:**
1. ❌ Função não configurada no OpenAI Dashboard
2. ❌ Função configurada com nome/parâmetros incorretos
3. ❌ Assistente confundido por exemplos de código nas instruções

---

## 📋 Checklist por Assistente

### 🎭 1. ASSISTENTE APRESENTAÇÃO (Recepcionista)

**Funções Obrigatórias:**

#### ✅ rotear_para_assistente
- [ ] Nome: `rotear_para_assistente`
- [ ] Descrição: "Roteia a conversa para um assistente especializado (Suporte, Financeiro, Comercial, etc). Use esta função para encaminhar o cliente ao departamento correto. NÃO use para transferir para atendimento humano."
- [ ] Parâmetros:
  ```json
  {
    "type": "object",
    "properties": {
      "assistantType": {
        "type": "string",
        "description": "Tipo do assistente para onde rotear",
        "enum": ["suporte", "financeiro", "comercial", "ouvidoria", "cancelamento"]
      },
      "motivo": {
        "type": "string",
        "description": "Motivo do roteamento (ex: 'Cliente sem internet há 2 dias', 'Solicitação de 2ª via de boleto')"
      }
    },
    "required": ["assistantType", "motivo"]
  }
  ```

#### ✅ transferir_para_humano
- [ ] Nome: `transferir_para_humano`
- [ ] Descrição: "Transfere conversa para atendimento humano. Use APENAS quando cliente solicitar explicitamente ou recusar fornecer CPF."
- [ ] Parâmetros:
  ```json
  {
    "type": "object",
    "properties": {
      "departamento": {
        "type": "string",
        "description": "Nome do departamento"
      },
      "motivo": {
        "type": "string",
        "description": "Motivo da transferência"
      }
    },
    "required": ["departamento", "motivo"]
  }
  ```

#### ✅ finalizar_conversa
- [ ] Nome: `finalizar_conversa`
- [ ] Descrição: "Finaliza a conversa após roteamento concluído e cliente satisfeito"
- [ ] Parâmetros:
  ```json
  {
    "type": "object",
    "properties": {
      "motivo": {
        "type": "string",
        "description": "Breve descrição do motivo da finalização"
      }
    },
    "required": []
  }
  ```

---

### 🔧 2. ASSISTENTE SUPORTE TÉCNICO

**Funções Obrigatórias:**

#### ✅ verificar_conexao
- [ ] Nome: `verificar_conexao`
- [ ] Descrição: "Verifica o status da conexão PPPoE e IP do cliente usando CPF/CNPJ"
- [ ] Parâmetros:
  ```json
  {
    "type": "object",
    "properties": {
      "documento": {
        "type": "string",
        "description": "CPF ou CNPJ do cliente (somente números)"
      }
    },
    "required": ["documento"]
  }
  ```

#### ✅ consultar_base_de_conhecimento
- [ ] Nome: `consultar_base_de_conhecimento`
- [ ] Descrição: "Consulta documentação técnica para resolver problemas"
- [ ] Parâmetros:
  ```json
  {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Pergunta ou problema a ser consultado"
      }
    },
    "required": ["query"]
  }
  ```

#### ✅ transferir_para_humano
- [ ] Nome: `transferir_para_humano` (mesma configuração do APRESENTAÇÃO)

#### ✅ finalizar_conversa
- [ ] Nome: `finalizar_conversa` (mesma configuração do APRESENTAÇÃO)

---

### 💰 3. ASSISTENTE FINANCEIRO

**Funções Obrigatórias:**

#### ✅ consulta_boleto_cliente
- [ ] Nome: `consulta_boleto_cliente`
- [ ] Descrição: "Consulta boletos do cliente usando CPF/CNPJ"
- [ ] Parâmetros:
  ```json
  {
    "type": "object",
    "properties": {
      "documento": {
        "type": "string",
        "description": "CPF ou CNPJ do cliente (somente números)"
      }
    },
    "required": ["documento"]
  }
  ```

#### ✅ solicitar_desbloqueio
- [ ] Nome: `solicitar_desbloqueio`
- [ ] Descrição: "Solicita desbloqueio/religamento de conexão por confiança"
- [ ] Parâmetros:
  ```json
  {
    "type": "object",
    "properties": {
      "documento": {
        "type": "string",
        "description": "CPF ou CNPJ do cliente"
      },
      "motivo": {
        "type": "string",
        "description": "Motivo da solicitação"
      }
    },
    "required": ["documento", "motivo"]
  }
  ```

#### ✅ transferir_para_humano
- [ ] Nome: `transferir_para_humano` (mesma configuração)

#### ✅ finalizar_conversa
- [ ] Nome: `finalizar_conversa` (mesma configuração)

---

### 🛒 4. ASSISTENTE COMERCIAL

**Funções Obrigatórias:**

#### ✅ consultar_planos
- [ ] Nome: `consultar_planos`
- [ ] Descrição: "Consulta planos disponíveis da TR Telecom"
- [ ] Parâmetros:
  ```json
  {
    "type": "object",
    "properties": {
      "filtro": {
        "type": "string",
        "description": "Filtro opcional (ex: 'fibra', 'empresarial')"
      }
    },
    "required": []
  }
  ```

#### ✅ buscar_cep
- [ ] Nome: `buscar_cep`
- [ ] Descrição: "Verifica cobertura e endereço pelo CEP"
- [ ] Parâmetros:
  ```json
  {
    "type": "object",
    "properties": {
      "cep": {
        "type": "string",
        "description": "CEP a ser consultado (somente números)"
      }
    },
    "required": ["cep"]
  }
  ```

#### ✅ enviar_cadastro_venda
- [ ] Nome: `enviar_cadastro_venda`
- [ ] Descrição: "Registra nova venda/contratação"
- [ ] Parâmetros: (consulte ai-tools.ts para schema completo)

#### ✅ registrar_lead_sem_cobertura
- [ ] Nome: `registrar_lead_sem_cobertura`
- [ ] Descrição: "Registra lead em área sem cobertura"
- [ ] Parâmetros: (consulte ai-tools.ts para schema completo)

#### ✅ transferir_para_humano
- [ ] Nome: `transferir_para_humano` (mesma configuração)

#### ✅ finalizar_conversa
- [ ] Nome: `finalizar_conversa` (mesma configuração)

---

### 📢 5. ASSISTENTE OUVIDORIA

**Funções Obrigatórias:**

#### ✅ registrar_reclamacao_ouvidoria
- [ ] Nome: `registrar_reclamacao_ouvidoria`
- [ ] Descrição: "Registra reclamação, elogio ou sugestão na ouvidoria"
- [ ] Parâmetros:
  ```json
  {
    "type": "object",
    "properties": {
      "documento": {
        "type": "string",
        "description": "CPF ou CNPJ do cliente"
      },
      "tipo": {
        "type": "string",
        "enum": ["reclamacao", "elogio", "sugestao"],
        "description": "Tipo de manifestação"
      },
      "descricao": {
        "type": "string",
        "description": "Descrição detalhada"
      }
    },
    "required": ["documento", "tipo", "descricao"]
  }
  ```

#### ✅ consultar_base_de_conhecimento
- [ ] Nome: `consultar_base_de_conhecimento` (mesma configuração do SUPORTE)

#### ✅ transferir_para_humano
- [ ] Nome: `transferir_para_humano` (mesma configuração)

#### ✅ finalizar_conversa
- [ ] Nome: `finalizar_conversa` (mesma configuração)

---

### ❌ 6. ASSISTENTE CANCELAMENTO

**Funções Obrigatórias:**

#### ✅ transferir_para_humano
- [ ] Nome: `transferir_para_humano` (mesma configuração)

#### ✅ finalizar_conversa
- [ ] Nome: `finalizar_conversa` (mesma configuração)

---

## 🧪 Como Testar

### Teste Rápido - APRESENTAÇÃO
1. Envie no WhatsApp: **"Preciso do boleto"**
2. ✅ **Esperado:** Assistente responde normalmente e roteia (sem texto de função visível)
3. ❌ **Erro:** Se aparecer `[use rotear_para_assistente...]` → função não configurada!

### Teste Rápido - SUPORTE
1. Envie: **"Minha internet está lenta"**
2. Solicite verificação de conexão
3. ✅ **Esperado:** Assistente executa `verificar_conexao()` sem mostrar código
4. ❌ **Erro:** Se aparecer `[use verificar_conexao...]` → função não configurada!

### Teste Rápido - FINANCEIRO
1. Envie: **"Quero a 2ª via do boleto"**
2. Forneça CPF quando solicitado
3. ✅ **Esperado:** Assistente executa `consulta_boleto_cliente()` e retorna dados
4. ❌ **Erro:** Se aparecer `[use consulta_boleto_cliente...]` → função não configurada!

---

## 🔧 Como Configurar Função no OpenAI Dashboard

1. Acesse: https://platform.openai.com/assistants
2. Selecione o assistente (ex: LIA Recepcionista)
3. Vá em **Tools** → **Add Function**
4. Preencha:
   - **Name:** Nome exato da função (ex: `rotear_para_assistente`)
   - **Description:** Descrição clara do que a função faz
   - **Parameters:** Schema JSON conforme acima
5. Clique em **Save**
6. **Teste imediatamente** conforme instruções acima

---

## 🚨 Regras Críticas

1. ✅ **Nome EXATO**: Use o nome exato da função (case-sensitive!)
2. ✅ **Parâmetros REQUIRED**: Marque corretamente quais são obrigatórios
3. ✅ **Enum VALUES**: Use valores exatos (ex: "suporte", não "Suporte Técnico")
4. ❌ **NUNCA** mude o nome de uma função já em produção
5. ✅ **Sempre teste** após adicionar/modificar função

---

## 📊 Status de Verificação

Use esta tabela para marcar o status de cada assistente:

| Assistente | rotear_para_assistente | transferir_para_humano | finalizar_conversa | Outras Funções | Testado |
|------------|------------------------|------------------------|-------------------|----------------|---------|
| APRESENTAÇÃO | ⬜ | ⬜ | ⬜ | N/A | ⬜ |
| SUPORTE | N/A | ⬜ | ⬜ | ⬜ verificar_conexao | ⬜ |
| FINANCEIRO | N/A | ⬜ | ⬜ | ⬜ consulta_boleto | ⬜ |
| COMERCIAL | N/A | ⬜ | ⬜ | ⬜ consultar_planos | ⬜ |
| OUVIDORIA | N/A | ⬜ | ⬜ | ⬜ registrar_reclamacao | ⬜ |
| CANCELAMENTO | N/A | ⬜ | ⬜ | N/A | ⬜ |

---

## 📝 Notas Importantes

- **Backend já está correto**: O código em `server/ai-tools.ts` processa todas as funções corretamente
- **Problema é no Dashboard**: As funções precisam estar configuradas no OpenAI Dashboard
- **Instruções atualizadas**: O arquivo `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md` já foi corrigido
- **Próximo passo**: Verificar e configurar funções no Dashboard usando este checklist

---

## 🎯 Resultado Esperado

Após configurar todas as funções:

✅ Cliente: "Preciso do boleto"
✅ Assistente: "Certo! Estou encaminhando seu atendimento ao setor financeiro, tá bem? 😉"
✅ [Sistema executa rotear_para_assistente internamente - NADA aparece na mensagem]
✅ Cliente recebe apenas a mensagem amigável

❌ NUNCA MAIS:
❌ "[use rotear_para_assistente com assistantType="financeiro", motivo="..."]"
