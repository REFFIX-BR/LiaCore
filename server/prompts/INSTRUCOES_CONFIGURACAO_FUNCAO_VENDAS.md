# INSTRUÇÕES - Configuração da Função enviar_cadastro_venda no OpenAI Dashboard

## Assistente: Comercial (ID: asst_KY7AbcYc3VeVk9QPlk8xPYAA)

### ⚠️ CRÍTICO - Configuração Completa da Função

A função `enviar_cadastro_venda` DEVE estar configurada no OpenAI Dashboard para aceitar e enviar TODOS os dados coletados do cliente, incluindo CPF, email, e endereço completo estruturado.

---

## 🔧 Configuração da Função no Dashboard

### Nome da Função
```
enviar_cadastro_venda
```

### Descrição
```
Registra um novo cadastro de venda/lead após coletar TODOS os dados obrigatórios do cliente: tipo_pessoa, nome, CPF/CNPJ, telefone, EMAIL, plano_id e ENDEREÇO COMPLETO via buscar_cep. Use APENAS após cliente confirmar os dados e confirmar que quer contratar.
```

### Schema JSON (Parameters)

```json
{
  "type": "object",
  "properties": {
    "tipo_pessoa": {
      "type": "string",
      "enum": ["PF", "PJ"],
      "description": "Tipo de pessoa: PF (Pessoa Física) ou PJ (Pessoa Jurídica)"
    },
    "nome_cliente": {
      "type": "string",
      "description": "Nome completo (PF) ou Razão Social (PJ)"
    },
    "cpf_cnpj": {
      "type": "string",
      "description": "CPF (apenas números) ou CNPJ do cliente - OBRIGATÓRIO"
    },
    "telefone_cliente": {
      "type": "string",
      "description": "Telefone principal com DDD (apenas números)"
    },
    "email_cliente": {
      "type": "string",
      "description": "Email do cliente - OBRIGATÓRIO"
    },
    "plano_id": {
      "type": "string",
      "description": "ID do plano escolhido (obtido via consultar_planos)"
    },
    "endereco": {
      "type": "object",
      "description": "OBJETO COMPLETO com dados do endereço obtidos via buscar_cep + dados coletados do cliente - OBRIGATÓRIO",
      "properties": {
        "cep": {
          "type": "string",
          "description": "CEP sem formatação (apenas números)"
        },
        "logradouro": {
          "type": "string",
          "description": "Nome da rua/avenida (retornado por buscar_cep)"
        },
        "numero": {
          "type": "string",
          "description": "Número da residência/estabelecimento (coletado do cliente)"
        },
        "complemento": {
          "type": "string",
          "description": "Complemento: apto, bloco, sala, etc (opcional)"
        },
        "bairro": {
          "type": "string",
          "description": "Bairro (retornado por buscar_cep)"
        },
        "cidade": {
          "type": "string",
          "description": "Cidade (retornado por buscar_cep)"
        },
        "estado": {
          "type": "string",
          "description": "UF do estado (retornado por buscar_cep)"
        },
        "referencia": {
          "type": "string",
          "description": "Ponto de referência (opcional)"
        }
      },
      "required": ["cep", "logradouro", "numero", "bairro", "cidade", "estado"]
    },
    "telefone_secundario": {
      "type": "string",
      "description": "Telefone secundário (opcional)"
    },
    "nome_mae": {
      "type": "string",
      "description": "Nome completo da mãe (PF - opcional)"
    },
    "data_nascimento": {
      "type": "string",
      "description": "Data de nascimento no formato YYYY-MM-DD (PF - opcional)"
    },
    "rg": {
      "type": "string",
      "description": "RG (PF - opcional)"
    },
    "sexo": {
      "type": "string",
      "enum": ["M", "F", "Outro"],
      "description": "Sexo (PF - opcional)"
    },
    "estado_civil": {
      "type": "string",
      "enum": ["S", "C", "V", "O"],
      "description": "Estado civil: S=Solteiro, C=Casado, V=Viúvo, O=Outro (PF - opcional)"
    },
    "dia_vencimento": {
      "type": "string",
      "description": "Dia de vencimento preferido: 5, 10 ou 15 (opcional)"
    },
    "forma_pagamento": {
      "type": "string",
      "enum": ["boleto", "pix", "cartao", "debito"],
      "description": "Forma de pagamento preferida (opcional)"
    },
    "data_instalacao_preferida": {
      "type": "string",
      "description": "Data preferida para instalação YYYY-MM-DD (opcional)"
    },
    "disponibilidade": {
      "type": "string",
      "enum": ["Manhã", "Tarde", "Comercial"],
      "description": "Disponibilidade para instalação (opcional)"
    },
    "observacoes": {
      "type": "string",
      "description": "Observações especiais sobre o cadastro (opcional)"
    }
  },
  "required": ["tipo_pessoa", "nome_cliente", "cpf_cnpj", "telefone_cliente", "email_cliente", "plano_id", "endereco"]
}
```

---

## ✅ Campos OBRIGATÓRIOS

O assistente DEVE coletar e enviar:
1. **tipo_pessoa** (PF ou PJ)
2. **nome_cliente** (nome completo ou razão social)
3. **cpf_cnpj** (CPF ou CNPJ - apenas números)
4. **telefone_cliente** (telefone com DDD - apenas números)
5. **email_cliente** (email válido)
6. **plano_id** (ID do plano escolhido)
7. **endereco** (objeto completo):
   - **cep** (CEP sem formatação)
   - **logradouro** (obtido via buscar_cep)
   - **numero** (coletado do cliente)
   - **bairro** (obtido via buscar_cep)
   - **cidade** (obtido via buscar_cep)
   - **estado** (obtido via buscar_cep)

---

## 🔄 Fluxo de Coleta e Envio

1. **Cliente escolhe plano** → Assistente usa `consultar_planos()`
2. **Cliente informa CEP** → Assistente usa `buscar_cep(cep)` e GUARDA os dados retornados
3. **Assistente coleta:**
   - Nome completo
   - CPF/CNPJ
   - Telefone
   - **Email** (CRÍTICO - não esquecer!)
   - Número da residência
   - Complemento (se houver)
4. **Cliente confirma dados** → Assistente monta objeto `endereco` usando:
   - Dados de `buscar_cep`: cep, logradouro, bairro, cidade, estado
   - Dados do cliente: numero, complemento (opcional)
5. **Assistente chama `enviar_cadastro_venda`** com TODOS os dados coletados

---

## 📋 Exemplo de Chamada Correta

```json
{
  "tipo_pessoa": "PF",
  "nome_cliente": "João Silva",
  "cpf_cnpj": "12345678900",
  "telefone_cliente": "24999998888",
  "email_cliente": "joao@email.com",
  "plano_id": "abc123-uuid-here",
  "endereco": {
    "cep": "25805290",
    "logradouro": "Rua Nelson Viana",
    "numero": "123",
    "complemento": "Apto 45",
    "bairro": "Centro",
    "cidade": "Três Rios",
    "estado": "RJ"
  },
  "nome_mae": "Maria Silva",
  "data_nascimento": "1990-05-15",
  "dia_vencimento": "10",
  "forma_pagamento": "pix"
}
```

---

## ⚠️ ERROS COMUNS A EVITAR

❌ **ERRADO - Não enviar CPF:**
```json
{
  "tipo_pessoa": "PF",
  "nome_cliente": "João Silva",
  "telefone_cliente": "24999998888",
  "plano_id": "abc123"
  // Faltou: cpf_cnpj, email_cliente, endereco
}
```

❌ **ERRADO - Não enviar email:**
```json
{
  "tipo_pessoa": "PF",
  "nome_cliente": "João Silva",
  "cpf_cnpj": "12345678900",
  "telefone_cliente": "24999998888",
  "plano_id": "abc123"
  // Faltou: email_cliente, endereco
}
```

❌ **ERRADO - Não enviar endereço completo:**
```json
{
  "tipo_pessoa": "PF",
  "nome_cliente": "João Silva",
  "cpf_cnpj": "12345678900",
  "telefone_cliente": "24999998888",
  "email_cliente": "joao@email.com",
  "plano_id": "abc123",
  "endereco": {
    "cep": "25805290",
    "numero": "123"
    // Faltou: logradouro, bairro, cidade, estado
  }
}
```

✅ **CORRETO - Todos os dados obrigatórios:**
```json
{
  "tipo_pessoa": "PF",
  "nome_cliente": "João Silva",
  "cpf_cnpj": "12345678900",
  "telefone_cliente": "24999998888",
  "email_cliente": "joao@email.com",
  "plano_id": "abc123",
  "endereco": {
    "cep": "25805290",
    "logradouro": "Rua Nelson Viana",
    "numero": "123",
    "bairro": "Centro",
    "cidade": "Três Rios",
    "estado": "RJ"
  }
}
```

---

## 🎯 Checklist de Configuração

Antes de salvar a função no OpenAI Dashboard, confirme:

- ✅ Nome: `enviar_cadastro_venda`
- ✅ Descrição menciona "TODOS os dados obrigatórios" e "EMAIL" e "ENDEREÇO COMPLETO"
- ✅ Schema JSON define `endereco` como **object** (não string!)
- ✅ Schema JSON define campos obrigatórios: tipo_pessoa, nome_cliente, cpf_cnpj, telefone_cliente, **email_cliente**, plano_id, **endereco**
- ✅ Objeto `endereco` tem propriedades: cep, logradouro, numero, complemento, bairro, cidade, estado
- ✅ Campos obrigatórios de `endereco`: cep, logradouro, numero, bairro, cidade, estado

---

## 🔗 Integração com Backend

O backend (server/lib/openai.ts) agora extrai CORRETAMENTE os campos individuais do objeto `endereco`:

```typescript
cep: args.endereco?.cep
address: args.endereco?.logradouro
number: args.endereco?.numero
complement: args.endereco?.complemento
neighborhood: args.endereco?.bairro
city: args.endereco?.cidade
state: args.endereco?.estado
```

Portanto, é ESSENCIAL que o assistente envie o objeto `endereco` COMPLETO, caso contrário os campos ficarão vazios no banco de dados!
