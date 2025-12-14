# 🛠️ Configuração das Funções de Vendas - Assistente Comercial OpenAI

## 📋 **O QUE SÃO ESSAS FUNÇÕES?**

O assistente comercial precisa de **4 ferramentas essenciais** para atender clientes pelo WhatsApp:

1. **`buscar_cep`** - Busca endereço completo pela API ViaCEP (logradouro, bairro, cidade, estado)
2. **`consultar_planos`** - Busca planos disponíveis no banco de dados em tempo real
3. **`enviar_cadastro_venda`** - Submete cadastro de venda após coletar dados completos do cliente
4. **`consultar_plano_cliente`** - 🆕 Consulta plano de cliente EXISTENTE (CPF) via API TR Telecom

---

## 🛠️ **COMO ADICIONAR NO OPENAI DASHBOARD**

### **1. Acesse o Assistente Comercial**
- Entre no OpenAI Dashboard
- Vá em **Assistants**
- Selecione: **LIA Comercial - TR Telecom** (`asst_KY7AbcYc3VeVk9QPlk8xPYAA`)

### **2. Adicione a Função 0: consultar_plano_cliente** 🆕 CRÍTICA!

**USE ESTA FUNÇÃO para clientes EXISTENTES que querem saber seu plano atual!**

Clique em **Add Function** e cole o JSON completo:

```json
{
  "type": "function",
  "function": {
    "name": "consultar_plano_cliente",
    "description": "Consulta o plano contratado de um cliente EXISTENTE via API TR Telecom. Retorna: nome do cliente, plano atual, velocidade, endereço e status da conexão. Use quando cliente perguntar sobre SEU plano atual, velocidade contratada, ou quiser verificar seus dados cadastrados. OBRIGATÓRIO ter CPF.",
    "parameters": {
      "type": "object",
      "properties": {
        "documento": {
          "type": "string",
          "description": "CPF ou CNPJ do cliente (11 ou 14 dígitos)"
        }
      },
      "required": ["documento"]
    }
  }
}
```

**IMPORTANTE:** Esta função é OBRIGATÓRIA para atender clientes existentes!

---

### **3. Adicione a Função 1: buscar_cep**

Clique em **Add Function** e cole o JSON completo:

**JSON completo da função:**
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

---

### **3. Adicione a Função 2: consultar_planos**

Clique em **Add Function** e configure:

#### **Nome da Função:**
```
consultar_planos
```

#### **Descrição:**
```
Consulta os planos de internet, combos e móveis disponíveis no banco de dados. Retorna lista completa com IDs, nomes, velocidades, preços e benefícios. Use SEMPRE que cliente perguntar sobre planos ou quiser ver opções disponíveis.
```

#### **Parâmetros (JSON Schema):**
```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

**Observação:** Esta função não precisa de parâmetros. Ela sempre retorna todos os planos ativos.

---

### **3. Adicione a Função 2: enviar_cadastro_venda**

Clique em **Add Function** novamente e configure:

#### **Nome da Função:**
```
enviar_cadastro_venda
```

#### **Descrição:**
```
Envia o cadastro completo de venda para o sistema após coletar TODOS os dados obrigatórios do cliente. Registra o lead com status 'Aguardando Análise' e retorna protocolo. Use APENAS quando tiver coletado: tipo_pessoa, nome_cliente, telefone_cliente e plano_id. Dados adicionais como CPF/CNPJ, email, endereço, nome da mãe, RG, data de nascimento também podem ser enviados.
```

#### **Parâmetros (JSON Schema):**
```json
{
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
      "description": "ID do plano escolhido (obtido via consultar_planos)"
    },
    "nome_mae": {
      "type": "string",
      "description": "Nome completo da mãe do cliente"
    },
    "data_nascimento": {
      "type": "string",
      "description": "Data de nascimento no formato YYYY-MM-DD"
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
      "description": "Endereço completo do cliente",
      "properties": {
        "cep": {"type": "string"},
        "logradouro": {"type": "string"},
        "numero": {"type": "string"},
        "complemento": {"type": "string"},
        "bairro": {"type": "string"},
        "cidade": {"type": "string"},
        "estado": {"type": "string"}
      }
    },
    "dia_vencimento": {
      "type": "string",
      "description": "Dia de vencimento preferido (1-31)"
    },
    "forma_pagamento": {
      "type": "string",
      "description": "Forma de pagamento preferida",
      "enum": ["boleto", "pix", "cartao_credito", "debito_automatico"]
    },
    "observacoes": {
      "type": "string",
      "description": "Observações adicionais sobre a venda"
    }
  },
  "required": ["tipo_pessoa", "nome_cliente", "telefone_cliente", "plano_id"]
}
```

---

## 📝 **INSTRUÇÕES PARA O ASSISTENTE**

Certifique-se de que o assistente comercial (`asst_KY7AbcYc3VeVk9QPlk8xPYAA`) tem as seguintes instruções no prompt (já documentadas em `server/prompts/comercial-assistant-prompt.md`):

### **Fluxo de Vendas:**

1. **Qualificação inicial** - Confirmar se é para residência ou empresa (PF ou PJ)
2. **Consultar planos** - Chamar `consultar_planos()` para ver opções disponíveis
3. **Apresentar planos** - Mostrar 3-4 planos mais adequados ao perfil
4. **Coleta de dados** - Seguir fluxo estruturado:
   - Nome completo
   - CPF/CNPJ
   - Telefone principal
   - Email
   - Endereço completo (CEP, rua, número, bairro, cidade)
   - Dados adicionais (nome da mãe, data nascimento, RG)
   - Dia de vencimento preferido
   - Forma de pagamento

5. **Confirmação** - Revisar dados com cliente
6. **Submeter venda** - Chamar `enviar_cadastro_venda()` com TODOS os dados
7. **Protocolo** - Informar número de protocolo ao cliente

### **Quando Usar Cada Ferramenta:**

**`consultar_planos`:**
- ✅ Cliente pergunta "quais planos vocês têm?"
- ✅ Cliente quer conhecer opções
- ✅ Início do processo de vendas
- ✅ Cliente pede para ver outros planos

**`enviar_cadastro_venda`:**
- ✅ Coletou TODOS os dados obrigatórios (tipo_pessoa, nome, telefone, plano_id)
- ✅ Cliente confirmou os dados
- ✅ Cliente escolheu um plano específico
- ❌ **NÃO use** se faltam dados obrigatórios

---

## 🔍 **EXEMPLO DE USO NO ASSISTENTE**

```
Cliente: "Queria conhecer os planos"
Assistente: "Oi! Para te mostrar os planos disponíveis, por favor me informe se é para residência ou empresa? 😊"

Cliente: "Pra minha casa"
Assistente: [CHAMA consultar_planos()]
Assistente: "Para sua casa, temos os seguintes planos de internet fibra óptica:
1. Plano 50 Mega - R$ 69,90/mês
2. Plano 650 Mega - R$ 109,90/mês (MAIS VENDIDO! ⭐)
3. Plano 1 Giga - R$ 149,90/mês

Também temos COMBOS com internet + móvel:
- BRONZE - 650 Mega + 8GB móvel + TV - R$ 149,90/mês
- PRATA - 650 Mega + 25GB móvel + TV - R$ 179,90/mês

Qual te interessou mais? 😊"

Cliente: "O 650 mega"
Assistente: "Ótima escolha! O plano 650 Mega é ideal para famílias e home office. Agora vou precisar de alguns dados para seguir com a contratação..."

[COLETA DADOS: nome, CPF, telefone, email, endereço, etc]

Cliente: "Tudo certo, pode finalizar"
Assistente: [CHAMA enviar_cadastro_venda(tipo_pessoa: "PF", nome_cliente: "João Silva", ...)]
Assistente: "Cadastro registrado com sucesso! ✅ 
Seu protocolo é: abc123
Nossa equipe entrará em contato em breve no telefone (24) 99999-9999 para confirmar os dados e agendar a instalação. 😊"
```

---

## 🎯 **VALIDAÇÃO APÓS CONFIGURAÇÃO**

Teste se as ferramentas foram adicionadas corretamente:

1. Abra uma conversa de teste com o assistente comercial
2. Pergunte: "Quais planos vocês têm?"
3. Verifique se o assistente **chama `consultar_planos`**
4. Confirme que ele mostra os **10 planos** do banco de dados (não hardcoded)
5. Simule uma venda completa até a submissão

---

## 🔗 **ARQUIVOS RELACIONADOS**

- **Prompt do Comercial**: `server/prompts/comercial-assistant-prompt.md`
- **Implementação Backend**: `server/lib/openai.ts` (cases "consultar_planos" e "enviar_cadastro_venda")
- **API Endpoints**: `server/routes.ts` (GET /api/plans, POST /api/site-lead)
- **Database Schema**: `shared/schema.ts` (plans, sales tables)
- **Scripts**: `server/scripts/populate-plans.ts`, `server/scripts/ingest-sales-rag.ts`

---

## ✅ **CHECKLIST DE CONFIGURAÇÃO**

- [ ] Função `consultar_planos` adicionada ao assistente comercial
- [ ] Função `enviar_cadastro_venda` adicionada ao assistente comercial
- [ ] Prompt do assistente atualizado com fluxo de vendas estruturado
- [ ] RAG de vendas ingerido (92 chunks no Upstash Vector)
- [ ] Tabela `plans` populada com 10 planos TR Telecom
- [ ] Testado fluxo completo de vendas
- [ ] Assistente respondendo com dados do banco (não hardcoded)
