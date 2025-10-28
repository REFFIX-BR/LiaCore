# 🔧 CORREÇÃO - Assistentes Duplicados no OpenAI Dashboard

**Data:** 28 de outubro de 2025  
**Prioridade:** ALTA  
**Impacto:** Configuração incorreta afetando roteamento de conversas

---

## 🚨 PROBLEMAS IDENTIFICADOS

### Problema 1: Assistente de Suporte com Nome Errado
- **ID:** `asst_CDkh1oE8YvKLtJYs3WY4rJX8`
- **Nome atual no OpenAI:** "Lia - Comercial" ❌
- **Uso real no sistema:** SUPORTE TÉCNICO
- **Impacto:** Confusão ao identificar qual assistente é qual

### Problema 2: Ouvidoria e Cancelamento Compartilham o Mesmo Assistente
- **ID compartilhado:** `asst_6SljJ5QSmAfgCVGXztUaKadC`
- **Departamentos afetados:** Ouvidoria + Cancelamento
- **Impacto:** Ambos departamentos usando as mesmas instruções/ferramentas

---

## ✅ CORREÇÃO 1: Renomear Assistente de Suporte

### Passo a Passo:

1. **Acesse o assistente:**
   - URL direta: https://platform.openai.com/playground/assistants?assistant=asst_CDkh1oE8YvKLtJYs3WY4rJX8
   - Ou vá em https://platform.openai.com/assistants e procure por `asst_CDkh1oE8YvKLtJYs3WY4rJX8`

2. **Editar nome:**
   - Clique em **Edit** (ou no ícone de lápis)
   - Na seção **Name**, mude de:
     ```
     Lia - Comercial
     ```
     Para:
     ```
     Lia - Suporte Técnico
     ```

3. **Salvar:**
   - Clique em **Save** (canto superior direito)
   - Aguarde confirmação

4. **Validar:**
   - Recarregue a página
   - Confirme que o nome mudou para "Lia - Suporte Técnico"

---

## ✅ CORREÇÃO 2: Separar Ouvidoria e Cancelamento

**IMPORTANTE:** Primeiro precisamos verificar se já existe um assistente separado para um deles.

### Opção A: Se já existem assistentes separados (mas IDs não foram atualizados)

1. **Procurar assistentes existentes:**
   - Acesse: https://platform.openai.com/assistants
   - Procure por:
     - "Lia - Ouvidoria"
     - "Ouvidoria"
     - "Lia - Cancelamento"
     - "Cancelamento"

2. **Se encontrar assistentes separados:**
   - Anote os IDs corretos
   - Pule para **CORREÇÃO 3** abaixo

### Opção B: Se NÃO existem assistentes separados (precisa criar)

#### **Criar Assistente de Ouvidoria:**

1. **Acesse:** https://platform.openai.com/assistants

2. **Clique em:** "+ Create"

3. **Configure:**
   - **Name:** `Lia - Ouvidoria`
   - **Model:** `gpt-4o` (ou o modelo que está usando)
   - **Instructions:** Cole o conteúdo de `PROMPT_OUVIDORIA_ATUALIZADO.md`

4. **Ferramentas (Tools):**
   - ✅ `registrar_reclamacao_ouvidoria`
   - ✅ `transferir_para_humano`
   - ✅ `consultar_base_de_conhecimento`

5. **Salvar e anotar o ID:**
   - Clique em **Save**
   - Copie o ID (formato: `asst_xxxxxxxxxxxxx`)

#### **Criar Assistente de Cancelamento:**

1. **Acesse:** https://platform.openai.com/assistants

2. **Clique em:** "+ Create"

3. **Configure:**
   - **Name:** `Lia - Cancelamento`
   - **Model:** `gpt-4o` (ou o modelo que está usando)
   - **Instructions:** Procure o arquivo `INSTRUCOES_CANCELAMENTO.md` ou similar

4. **Ferramentas (Tools):**
   - ✅ `transferir_para_humano`
   - ✅ `consultar_base_de_conhecimento`
   - ✅ `abrir_ticket_crm`

5. **Salvar e anotar o ID:**
   - Clique em **Save**
   - Copie o ID (formato: `asst_xxxxxxxxxxxxx`)

---

## ✅ CORREÇÃO 3: Atualizar Variáveis de Ambiente

**IMPORTANTE:** Após criar ou identificar os assistentes corretos, você precisa atualizar as variáveis de ambiente no Replit.

### Passo a Passo:

1. **No Replit, clique em "Secrets" (ícone de chave) no painel esquerdo**

2. **Localize e atualize as seguintes variáveis:**

   **Se criou novos assistentes:**
   
   - `OPENAI_OUVIDOIRA_ASSISTANT_ID` (sim, tem erro de digitação no nome da variável):
     ```
     Valor atual: asst_6SljJ5QSmAfgCVGXztUaKadC
     Novo valor: [ID DO ASSISTENTE DE OUVIDORIA]
     ```
   
   - `OPENAI_CANCELAMENTO_ASSISTANT_ID`:
     ```
     Valor atual: asst_6SljJ5QSmAfgCVGXztUaKadC
     Novo valor: [ID DO ASSISTENTE DE CANCELAMENTO]
     ```

3. **Salvar as alterações**

4. **Reiniciar o workflow:**
   - No Replit, pare o servidor (se estiver rodando)
   - Execute novamente ou espere reiniciar automaticamente

---

## ✅ CORREÇÃO 4: Validar Configuração

Após todas as correções, valide:

1. **No OpenAI Dashboard:**
   - ✅ Lia - Apresentação: `asst_oY50Ec5BKQzIzWcnYEo2meFc`
   - ✅ Lia - Comercial: `asst_KY7AbcYc3VeVk9QPlk8xPYAA`
   - ✅ Lia - Suporte Técnico: `asst_CDkh1oE8YvKLtJYs3WY4rJX8` (RENOMEADO)
   - ✅ Lia - Financeiro: `asst_pRXVhoy1o4YxNxVmaRiNOTMX`
   - ✅ Lia - Ouvidoria: [NOVO ID]
   - ✅ Lia - Cancelamento: [NOVO ID]

2. **Nos Secrets do Replit:**
   - ✅ OPENAI_APRESENTACAO_ASSISTANT_ID
   - ✅ OPENAI_COMMRCIAL_ASSISTANT_ID
   - ✅ OPENAI_SUPORTE_ASSISTANT_ID
   - ✅ OPENAI_FINANCEIRO_ASSISTANT_ID
   - ✅ OPENAI_OUVIDOIRA_ASSISTANT_ID (atualizado)
   - ✅ OPENAI_CANCELAMENTO_ASSISTANT_ID (atualizado)

3. **Teste no WhatsApp:**
   - Envie mensagem teste para cada departamento
   - Verifique se o roteamento está correto
   - Confirme que as respostas são apropriadas para cada assistente

---

## 📋 CONFIGURAÇÃO DOS ASSISTENTES

### Assistente de Ouvidoria - Ferramentas Necessárias

**Função:** `registrar_reclamacao_ouvidoria`
```json
{
  "name": "registrar_reclamacao_ouvidoria",
  "description": "Registra reclamação, elogio ou sugestão no painel interno de Ouvidoria. SEMPRE use esta função ao coletar um relato completo de ouvidoria. Retorna protocolo único para o cliente.",
  "parameters": {
    "type": "object",
    "properties": {
      "tipo": {
        "type": "string",
        "enum": ["reclamacao", "elogio", "sugestao"],
        "description": "Tipo do registro: reclamacao (alta severidade), elogio (baixa severidade) ou sugestao (média severidade)"
      },
      "descricao": {
        "type": "string",
        "description": "Descrição COMPLETA do relato incluindo: nome do cliente, CPF/CNPJ, o que aconteceu, quando, onde, e quem estava envolvido"
      }
    },
    "required": ["tipo", "descricao"]
  }
}
```

**Função:** `transferir_para_humano`
```json
{
  "name": "transferir_para_humano",
  "description": "Transfere conversa para atendente humano. Use SEMPRE após registrar na ouvidoria ou quando cliente solicitar.",
  "parameters": {
    "type": "object",
    "properties": {
      "departamento": {
        "type": "string",
        "description": "Departamento de destino (ex: Ouvidoria, Suporte, Financeiro)"
      },
      "motivo": {
        "type": "string",
        "description": "Motivo da transferência"
      }
    },
    "required": ["motivo"]
  }
}
```

**Função:** `consultar_base_de_conhecimento`
```json
{
  "name": "consultar_base_de_conhecimento",
  "description": "Consulta base de conhecimento interna para informações sobre processos de ouvidoria",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Pergunta ou tópico a consultar"
      }
    },
    "required": ["query"]
  }
}
```

---

### Assistente de Cancelamento - Ferramentas Necessárias

**Função:** `transferir_para_humano`
(mesmo schema acima)

**Função:** `consultar_base_de_conhecimento`
(mesmo schema acima)

**Função:** `abrir_ticket_crm`
```json
{
  "name": "abrir_ticket_crm",
  "description": "Registra atendimento no CRM externo. Use quando resolver um atendimento ou precisar escalar formalmente.",
  "parameters": {
    "type": "object",
    "properties": {
      "resumo": {
        "type": "string",
        "description": "Resumo detalhado do atendimento"
      },
      "setor": {
        "type": "string",
        "enum": ["SUPORTE", "FINANCEIRO", "COMERCIAL", "OUVIDORIA", "CANCELAMENTO"],
        "description": "Setor responsável"
      },
      "motivo": {
        "type": "string",
        "description": "Motivo/categoria do ticket"
      }
    },
    "required": ["resumo", "setor", "motivo"]
  }
}
```

---

## 🎯 RESULTADO ESPERADO

Após todas as correções:

✅ **6 assistentes únicos** com nomes corretos  
✅ **IDs únicos** para cada departamento  
✅ **Roteamento correto** de conversas  
✅ **Sem duplicações** de ferramentas ou instruções  

---

## 🆘 PROBLEMAS COMUNS

### "Não consigo salvar as alterações no OpenAI"
- Tente em modo anônimo
- Limpe o cache do navegador
- Use outro navegador

### "O ID não aparece nos Secrets do Replit"
- Clique em "+ New Secret"
- Digite o nome EXATO da variável (ex: `OPENAI_OUVIDOIRA_ASSISTANT_ID`)
- Cole o valor do ID
- Salve

### "O sistema ainda usa o assistente antigo"
- Reinicie o workflow no Replit
- Aguarde 30 segundos
- Teste novamente no WhatsApp

---

**Status:** 🔴 AGUARDANDO CORREÇÕES
