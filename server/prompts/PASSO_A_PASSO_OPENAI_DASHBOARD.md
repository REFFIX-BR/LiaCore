# 🔧 Passo a Passo: Configurar Função no OpenAI Dashboard

## ⚠️ IMPORTANTE
Se o schema está sendo esvaziado quando você salva, siga **exatamente** estes passos:

---

## 📝 Passo 1: Acessar o Assistente

1. Acesse: https://platform.openai.com/assistants
2. Clique no assistente **Comercial** (ID: `asst_KY7AbcYc3VeVk9QPlk8xPYAA`)

---

## 📝 Passo 2: Verificar se a Função Existe

Na seção **Tools**:
- Se a função `enviar_cadastro_venda` já existe → Clique em **Edit** (ícone de lápis)
- Se não existe → Clique em **Add Function**

---

## 📝 Passo 3: Configurar a Função

### Nome
```
enviar_cadastro_venda
```

### Descrição
```
Registra cadastro de venda após coletar dados pessoais (nome, CPF, email, telefone), dados complementares (nome_mae, data_nascimento, RG, sexo, estado_civil), endereço completo via buscar_cep, e dados do serviço (dia_vencimento, data_instalacao_preferida, disponibilidade). Use APENAS após cliente confirmar TODOS os dados.
```

---

## 📝 Passo 4: Schema (Parameters)

**IMPORTANTE:** No campo "Parameters", você tem 2 opções:

### Opção A: Interface Visual (Recomendado)
Se o Dashboard tem uma interface visual para adicionar parâmetros:

1. Clique em **Add Parameter**
2. Para cada campo abaixo, adicione manualmente:

**Campos Obrigatórios (required):**
- `tipo_pessoa` (string, enum: ["PF", "PJ"])
- `nome_cliente` (string)
- `cpf_cnpj` (string)
- `telefone_cliente` (string)
- `email_cliente` (string)
- `plano_id` (string)
- `endereco` (object) → **Ver estrutura abaixo**

**Campos Opcionais:**
- `telefone_secundario` (string)
- `nome_mae` (string)
- `data_nascimento` (string)
- `rg` (string)
- `sexo` (string, enum: ["M", "F", "Outro"])
- `estado_civil` (string, enum: ["S", "C", "V", "O"])
- `dia_vencimento` (string)
- `forma_pagamento` (string, enum: ["boleto", "pix", "cartao", "debito"])
- `data_instalacao_preferida` (string)
- `disponibilidade` (string, enum: ["Manhã", "Tarde", "Comercial"])
- `observacoes` (string)

**Estrutura do objeto `endereco`:**
- `cep` (string) - obrigatório
- `logradouro` (string) - obrigatório
- `numero` (string) - obrigatório
- `complemento` (string) - opcional
- `bairro` (string) - obrigatório
- `cidade` (string) - obrigatório
- `estado` (string) - obrigatório
- `referencia` (string) - opcional

### Opção B: JSON Raw (Se houver campo de texto)
Se o Dashboard permite colar JSON diretamente:

1. Copie **EXATAMENTE** o conteúdo do arquivo `SCHEMA_OPENAI_VALIDADO.json`
2. Cole no campo de schema/parameters
3. **NÃO modifique nada** - cole como está

---

## 📝 Passo 5: Salvar

1. Clique em **Save** ou **Update Function**
2. **Verifique se os campos não foram esvaziados**
3. Se foram esvaziados novamente, tente:
   - Usar a **Opção A** (interface visual) ao invés de JSON
   - Verificar se há erros de validação sendo mostrados
   - Testar em outro navegador

---

## 🚨 Se Continuar Esvaziando

Possíveis causas e soluções:

### 1. **Problema de Validação do OpenAI**
- O OpenAI pode estar rejeitando o schema silenciosamente
- **Solução:** Use a interface visual (Opção A) em vez de colar JSON

### 2. **Limite de Complexidade**
- O schema pode ser muito complexo para o Dashboard
- **Solução:** Simplifique removendo temporariamente os campos opcionais

### 3. **Bug do Dashboard**
- Pode ser um bug temporário da plataforma OpenAI
- **Solução:** Tente em outro navegador (Chrome, Firefox, Edge)

### 4. **Strict Mode Ativado**
- Se `"strict": true`, o OpenAI é mais rigoroso
- **Solução:** Certifique-se que `"strict": false`

---

## 📋 Schema Mínimo (Teste)

Se nada funcionar, teste primeiro com este schema **super simplificado**:

```json
{
  "type": "object",
  "properties": {
    "tipo_pessoa": {
      "type": "string",
      "description": "PF ou PJ"
    },
    "nome_cliente": {
      "type": "string",
      "description": "Nome completo"
    },
    "cpf_cnpj": {
      "type": "string",
      "description": "CPF ou CNPJ"
    },
    "telefone_cliente": {
      "type": "string",
      "description": "Telefone"
    },
    "email_cliente": {
      "type": "string",
      "description": "Email"
    },
    "plano_id": {
      "type": "string",
      "description": "ID do plano"
    }
  },
  "required": ["tipo_pessoa", "nome_cliente", "telefone_cliente", "plano_id"]
}
```

**Se este schema mínimo funcionar**, vá adicionando campos gradualmente pela interface visual.

---

## ✅ Como Verificar se Funcionou

Após salvar:
1. Recarregue a página do assistente
2. Abra a função `enviar_cadastro_venda` novamente
3. Verifique se os parâmetros ainda estão lá
4. Se sim → **Sucesso!** ✅
5. Se não → Tente a **Opção A** ou o **Schema Mínimo**

---

## 📞 Suporte

Se nenhuma solução funcionar, me informe:
1. Qual navegador você está usando?
2. O Dashboard mostra algum erro quando você salva?
3. Os parâmetros aparecem por alguns segundos antes de sumir?
4. Você está usando a interface visual ou colando JSON?

Vou ajudar a resolver! 💪
