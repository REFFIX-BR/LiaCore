# ✅ CORREÇÕES APLICADAS - CONFUSÃO DA LIA COMERCIAL

## 🔴 PROBLEMAS IDENTIFICADOS

Analisando os logs da conversa com Marcio Zebende, identifiqu amos que a Lia estava **muito confusa** por causa de:

1. **Prompt misturado** - Tinha instruções de suporte/financeiro misturadas com vendas
2. **Verificava CPF existente** - Quando deveria cadastrar NOVOS clientes
3. **Perguntava sobre boleto** - No meio do processo de vendas
4. **Roteava para si mesma** - comercial → comercial (loop infinito)
5. **Usava RAG para buscar CEP** - Ao invés de ferramenta específica
6. **Resetava conversa** - Se reapresentava no meio do cadastro
7. **"Sempre consultar RAG"** - Instrução que fazia perder foco

## ✅ SOLUÇÕES IMPLEMENTADAS

### 1. **Prompt Comercial Reescrito** (`server/prompts/comercial-assistant-prompt.md`)

**ANTES:**
- Misturava vendas + suporte + financeiro
- Instruía "sempre consultar RAG"
- Verificava CPF em sistema
- Não tinha estrutura clara de coleta de dados

**DEPOIS:**
- **Foco EXCLUSIVO em vendas** de novos leads
- **Proibido** consultar boleto/CPF existente
- **Transfere imediatamente** se cliente mencionar boleto ou problemas
- **Fluxo estruturado** com ferramentas obrigatórias
- **Exemplos completos** de sucesso

### 2. **Nova Ferramenta: `buscar_cep()`** (implementada em `server/lib/openai.ts`)

**O que faz:**
- Integra com API ViaCEP
- Busca logradouro, bairro, cidade, estado automaticamente
- Valida CEP de 8 dígitos
- Preenche formulário de endereço automaticamente

**Exemplo de uso:**
```
Cliente: "25805-290"
Lia: [CHAMA buscar_cep("25805-290")]
Lia: "Encontrei: Rua ABC, Centro, Petrópolis - RJ. Qual o número?"
```

### 3. **Ferramentas de Vendas Otimizadas**

Agora temos **3 ferramentas obrigatórias** no fluxo:

1. **`consultar_planos()`** → Busca planos ativos do banco (não hardcoded)
2. **`buscar_cep(cep)`** → Preenche endereço automaticamente
3. **`enviar_cadastro_venda(...)`** → Submete venda completa

### 4. **Documentação Atualizada**

- `server/prompts/FUNCAO_VENDAS_COMERCIAL_SETUP.md` - Instruções completas para configuração
- `server/prompts/comercial-assistant-prompt.md` - Prompt limpo e focado
- Exemplos de uso claros
- JSONs prontos para copiar/colar

---

## 🔧 O QUE VOCÊ PRECISA FAZER AGORA

### **PASSO 1: Configurar Ferramentas no OpenAI Dashboard**

**⚠️ IMPORTANTE:** As 3 ferramentas ainda NÃO estão configuradas no OpenAI Dashboard!

1. **Acesse:** https://platform.openai.com/assistants
2. **Encontre:** LIA Comercial - TR Telecom (`asst_KY7AbcYc3VeVk9QPlk8xPYAA`)
3. **Clique em:** "Add Function" (3 vezes - uma para cada ferramenta)

### **FUNÇÃO 1: buscar_cep**

```json
{
  "type": "function",
  "function": {
    "name": "buscar_cep",
    "description": "Busca endereço completo pela API ViaCEP. Retorna: logradouro, bairro, cidade e estado. Use quando cliente informar CEP para preencher automaticamente o endereço de instalação.",
    "parameters": {
      "type": "object",
      "properties": {
        "cep": {
          "type": "string",
          "description": "CEP com 8 dígitos (ex: 12345-678 ou 12345678)"
        }
      },
      "required": ["cep"]
    }
  }
}
```

### **FUNÇÃO 2: consultar_planos**

```json
{
  "type": "function",
  "function": {
    "name": "consultar_planos",
    "description": "Consulta os planos de internet, combos e móveis disponíveis no banco de dados da TR Telecom. Retorna lista completa com IDs, nomes, tipos, velocidades, preços e benefícios. Use SEMPRE que cliente perguntar sobre planos disponíveis, quiser conhecer opções, ou no início do processo de vendas.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": []
    }
  }
}
```

### **FUNÇÃO 3: enviar_cadastro_venda**

```json
{
  "type": "function",
  "function": {
    "name": "enviar_cadastro_venda",
    "description": "Envia o cadastro completo de venda para o sistema após coletar TODOS os dados obrigatórios do cliente. Registra o lead com status 'Aguardando Análise' e retorna protocolo de atendimento. Use APENAS quando tiver coletado no mínimo: tipo_pessoa, nome_cliente, telefone_cliente e plano_id.",
    "parameters": {
      "type": "object",
      "properties": {
        "tipo_pessoa": {
          "type": "string",
          "description": "Tipo de pessoa: 'PF' (Pessoa Física) ou 'PJ' (Pessoa Jurídica)",
          "enum": ["PF", "PJ"]
        },
        "nome_cliente": {
          "type": "string",
          "description": "Nome completo do cliente"
        },
        "cpf_cnpj": {
          "type": "string",
          "description": "CPF (para PF) ou CNPJ (para PJ) do cliente"
        },
        "telefone_cliente": {
          "type": "string",
          "description": "Telefone principal do cliente (com DDD)"
        },
        "telefone_secundario": {
          "type": "string",
          "description": "Telefone secundário do cliente (opcional)"
        },
        "email_cliente": {
          "type": "string",
          "description": "Email do cliente"
        },
        "plano_id": {
          "type": "string",
          "description": "ID do plano escolhido pelo cliente (obtido via consultar_planos)"
        },
        "nome_mae": {
          "type": "string",
          "description": "Nome completo da mãe do cliente"
        },
        "data_nascimento": {
          "type": "string",
          "description": "Data de nascimento do cliente no formato YYYY-MM-DD (ex: 1990-05-15)"
        },
        "rg": {
          "type": "string",
          "description": "RG do cliente"
        },
        "sexo": {
          "type": "string",
          "description": "Sexo do cliente",
          "enum": ["M", "F", "Outro"]
        },
        "endereco": {
          "type": "object",
          "description": "Endereço completo de instalação do cliente",
          "properties": {
            "cep": {"type": "string", "description": "CEP do endereço"},
            "logradouro": {"type": "string", "description": "Nome da rua/avenida"},
            "numero": {"type": "string", "description": "Número da residência"},
            "complemento": {"type": "string", "description": "Complemento (apto, bloco, etc)"},
            "bairro": {"type": "string", "description": "Bairro"},
            "cidade": {"type": "string", "description": "Cidade"},
            "estado": {"type": "string", "description": "Estado (UF)"}
          }
        },
        "dia_vencimento": {
          "type": "string",
          "description": "Dia de vencimento preferido da fatura (1-31)"
        },
        "forma_pagamento": {
          "type": "string",
          "description": "Forma de pagamento preferida pelo cliente",
          "enum": ["boleto", "pix", "cartao_credito", "debito_automatico"]
        },
        "observacoes": {
          "type": "string",
          "description": "Observações adicionais sobre a venda ou solicitações especiais do cliente"
        }
      },
      "required": ["tipo_pessoa", "nome_cliente", "telefone_cliente", "plano_id"]
    }
  }
}
```

---

### **PASSO 2: Atualizar Instruções do Assistente** (Opcional)

Copie o novo prompt de `server/prompts/comercial-assistant-prompt.md` para as instruções do assistente no Dashboard se quiser garantir que ele siga o fluxo estruturado.

---

## 🧪 COMO TESTAR

Após configurar as 3 ferramentas no Dashboard:

### **Teste 1: Consultar Planos**
```
Você: "Quais planos vocês têm?"
Lia: [Deve chamar consultar_planos() e mostrar os 10 planos do banco]
```

### **Teste 2: Buscar CEP**
```
Você: "Quero contratar o plano PRATA"
Lia: "Ótimo! Qual seu nome?"
Você: "João Silva"
Lia: "E seu CPF?"
Você: "123.456.789-00"
Lia: "Telefone com DDD?"
Você: "(24) 99999-9999"
Lia: "Email?"
Você: "joao@email.com"
Lia: "CEP do endereço de instalação?"
Você: "25805-290"
Lia: [Deve chamar buscar_cep() e retornar endereço completo]
Lia: "Encontrei: Rua ABC, Correias, Petrópolis - RJ. Qual o número?"
```

### **Teste 3: Venda Completa**
```
[Continue o teste 2]
Você: "123"
Lia: "Perfeito! Confirmando seus dados..."
Você: "Tudo certo"
Lia: [Deve chamar enviar_cadastro_venda() e retornar protocolo]
Lia: "Cadastro registrado! ✅ Protocolo: #17"
```

---

## 📊 STATUS ATUAL

| Item | Status |
|------|--------|
| ✅ Banco de dados com 10 planos | **PRONTO** |
| ✅ RAG com 92 chunks de vendas | **PRONTO** |
| ✅ Endpoint GET /api/plans | **PRONTO** |
| ✅ Endpoint POST /api/site-lead | **PRONTO** |
| ✅ Tool `consultar_planos()` implementada | **PRONTO** |
| ✅ Tool `buscar_cep()` implementada | **PRONTO** |
| ✅ Tool `enviar_cadastro_venda()` implementada | **PRONTO** |
| ✅ Prompt comercial reescrito | **PRONTO** |
| ⚠️ Ferramentas configuradas no Dashboard | **PENDENTE - VOCÊ PRECISA FAZER** |
| 🔲 Interface de gestão de vendas | PRÓXIMO |
| 🔲 Teste end-to-end | PRÓXIMO |

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Configure as 3 ferramentas** no OpenAI Dashboard (copie os JSONs acima)
2. 🧪 **Teste** com as mensagens sugeridas acima
3. ✅ **Confirme** que a Lia não está mais confusa
4. 🚀 **Avise** quando terminar para eu criar a interface de gestão de vendas

---

## 📁 ARQUIVOS MODIFICADOS

- `server/lib/openai.ts` - Adicionado case "buscar_cep" (linha 976-1014)
- `server/prompts/comercial-assistant-prompt.md` - Reescrito completamente (foco em vendas)
- `server/prompts/FUNCAO_VENDAS_COMERCIAL_SETUP.md` - Atualizado com buscar_cep
- `CORRECOES_VENDAS_LIA.md` - Este arquivo (documentação)

---

**Qualquer dúvida, me avise! Estou pronto para criar a interface de gestão de vendas assim que você confirmar que as ferramentas estão funcionando. 🚀**
