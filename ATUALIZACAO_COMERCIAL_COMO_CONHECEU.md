# 🔄 ATUALIZAÇÃO DO ASSISTENTE COMERCIAL - "Como Conheceu TR Telecom"

## ⚠️ AÇÃO MANUAL NECESSÁRIA NO OPENAI DASHBOARD

### 📋 **O QUE MUDOU:**

Adicionamos a pergunta **"Como você conheceu a TR Telecom?"** no fluxo de vendas.

Este dado será armazenado no banco de dados no campo `how_did_you_know` e é muito valioso para análise de marketing e origem de leads.

---

## 🎯 **ONDE ATUALIZAR:**

1. Acesse o **OpenAI Dashboard**: https://platform.openai.com/assistants
2. Encontre o assistente: **"Lia - Assistente Comercial TR Telecom"**
3. Clique em **Edit** (ou **Editar**)
4. Vá até a seção **Tools** (Ferramentas)
5. Encontre a função **`enviar_cadastro_venda`**

---

## 🔧 **ADICIONAR ESTE PARÂMETRO:**

Na função `enviar_cadastro_venda`, adicione o seguinte parâmetro na lista de propriedades:

```json
"como_conheceu": {
  "type": "string",
  "description": "Como o cliente conheceu a TR Telecom (ex: indicação, Google, Facebook, amigo, etc). Pergunta feita logo após coletar o nome."
}
```

---

## 📝 **ATUALIZAR AS INSTRUÇÕES DO ASSISTENTE:**

No campo **Instructions** (Instruções), adicione esta seção no fluxo de nova contratação:

```
## 💼 FLUXO DE NOVA CONTRATAÇÃO (ATUALIZADO)

1. **Identificar intenção** → Cliente deseja contratar internet
2. **Apresentar planos** → Use consultar_planos()
3. **Coletar nome** → "Por favor, me diga seu nome completo"
4. **🆕 Como conheceu** → "Como você conheceu a TR Telecom? Isso ajuda a gente a melhorar nosso atendimento. 😊"
   - Esta pergunta é OBRIGATÓRIA e deve ser feita logo após coletar o nome
   - Aceite qualquer resposta em linguagem natural (indicação, Google, amigo, etc)
   - Armazene a resposta no campo `como_conheceu` da função enviar_cadastro_venda
5. **Selecionar plano** → Cliente escolhe o plano desejado
6. **Verificar CPF** → Solicite CPF ou CNPJ
7. **Coletar dados pessoais**:
   - Email
   - Data de nascimento (apenas PF)
   - RG (apenas PF)
8. **Coletar CEP** → Use buscar_cep() para verificar cobertura
9. **Coletar endereço completo** → Logradouro, número, complemento, bairro, ponto de referência
10. **Dia de vencimento** → Cliente escolhe (5, 10 ou 15)
11. **Finalizar** → Use enviar_cadastro_venda() com TODOS os dados incluindo como_conheceu
```

---

## ✅ **EXEMPLO DE USO NA CONVERSA:**

```
Cliente: "Quero contratar internet"
Assistente: [mostra planos]
Cliente: "Quero o de 650 mega"
Assistente: "Ótimo! Para começar, me diga seu nome completo, por favor 😊"
Cliente: "Marcio Zebende"
Assistente: "Obrigado, Marcio! Como você conheceu a TR Telecom? Isso ajuda a gente a melhorar nosso atendimento. 😊"
Cliente: "Foi indicação de um amigo"
Assistente: "Legal! Agora vou precisar do seu CPF para prosseguir..."
```

---

## 🔍 **CAMPOS SIMPLIFICADOS - LEMBRANDO:**

Eliminamos as seguintes perguntas do fluxo (NÃO pergunte mais):
- ❌ ~~Forma de pagamento~~
- ❌ ~~Data de instalação preferida~~
- ❌ ~~Disponibilidade (manhã/tarde)~~
- ❌ ~~Nome da mãe~~ (apenas para PF)
- ❌ ~~Sexo~~ (apenas para PF)
- ❌ ~~Estado civil~~ (apenas para PF)

**Campos que continuam sendo coletados:**
- ✅ Tipo de pessoa (PF/PJ)
- ✅ Nome completo
- ✅ **🆕 Como conheceu a TR Telecom** (NOVO!)
- ✅ CPF ou CNPJ
- ✅ Email
- ✅ Telefone
- ✅ Data de nascimento (PF)
- ✅ RG (PF)
- ✅ CEP + Endereço completo (com ponto de referência)
- ✅ Dia de vencimento

---

## 💾 **VALIDAÇÃO BACKEND:**

O backend já está preparado para receber o campo `como_conheceu` e armazená-lo em `sales.how_did_you_know`.

Este dado estará disponível no Dashboard de Vendas para análise de origem dos leads! 📊

---

## 📌 **IMPORTANTE:**

Esta é a **ÚNICA pergunta adicional** que mantemos além dos dados essenciais. Ela foi solicitada especificamente porque é um dado valioso para marketing e rastreamento de origem de clientes.

