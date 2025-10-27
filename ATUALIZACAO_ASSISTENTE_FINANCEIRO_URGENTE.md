# 🚨 ATUALIZAÇÃO URGENTE - Assistente FINANCEIRO

**Data:** 27/10/2025  
**Prioridade:** CRÍTICA  
**Assistant ID:** `asst_pRXVhoy1o4YxNxVmaRiNOTMX`

---

## 📋 Problema Identificado

Na conversa de **Michele Machado** (whatsapp_223742194143312@lid), o assistente FINANCEIRO:

❌ **NÃO solicitou CPF** ao cliente  
❌ **NÃO abriu ticket** no CRM  
❌ **Finalizou conversa prematuramente**  
❌ **Confiou em CPF extraído incorretamente** (código de barras: "00000007990")

---

## ✅ Correções Implementadas

### Backend: Nova Função `validar_cpf_cnpj`
- ✅ Função criada em `server/ai-tools.ts` (linhas 95-188)
- ✅ Validação matemática completa (algoritmo de dígitos verificadores)
- ✅ Rejeita sequências repetidas (111.111.111-11, etc.)
- ✅ Retorna `{ valido: true/false, tipo: 'CPF'/'CNPJ', motivo: "..." }`
- ✅ Registrada em `executeAssistantTool` (linha 1092)

### Frontend: Instruções do Assistente
As instruções foram atualizadas em `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md` (linhas 738-935) com:

### 1. **REGRA #0: VALIDAÇÃO RIGOROSA DE CPF (4 PASSOS)**

**PASSO 1:** Verificar Origem do CPF
- ✅ CPF válido APENAS se cliente DIGITOU no chat
- ❌ Desconsiderar CPF extraído de imagens/OCR/metadata
- ✅ Procurar no histórico mensagens `role: "user"` contendo CPF

**PASSO 2:** CPF Não Digitado? Solicitar ao Cliente
- Pedir explicitamente: "preciso que você me informe seu CPF"
- Aguardar cliente digitar

**PASSO 3:** Validar CPF/CNPJ com Função `validar_cpf_cnpj`
- 🚨 **OBRIGATÓRIO:** Chamar `validar_cpf_cnpj(documento: "cpf_digitado")`
- ✅ CPF válido: dígitos verificadores corretos (algoritmo matemático)
- ✅ CNPJ válido: dígitos verificadores corretos
- ❌ Rejeitar: sequências repetidas, dígitos incorretos, tamanho inválido
- ❌ Exemplo rejeitado: "00000007990", "111.111.111-11", "12345678900" (dígito errado)

**PASSO 4:** Cliente se Recusa? Transferir para Humano
- Após 2 tentativas sem CPF válido → `transferir_para_humano`
- ❌ NUNCA finalizar sem CPF válido ou transferência

### 2. **REGRA #5: NÃO FINALIZAR PREMATURAMENTE**
- ❌ NÃO finalizar enquanto aguardar informações (CPF, endereço, etc.)
- ✅ Só finalizar após ticket aberto + confirmação do cliente

### 3. **Checklist Expandido (10 Itens)**
- Confirmar CPF foi digitado (não extraído)
- Revisar TODO histórico para encontrar CPF digitado
- Validar formato (não sequência, não código de barras)
- Edge case: transferir se cliente não fornecer CPF após 2 tentativas
- Confirmação de endereço (multi-ponto)
- Apenas UMA ação: `abrir_ticket_crm` (não transferir depois)

---

## 🔧 Como Atualizar o Assistente no OpenAI

### **Método 1: Via Dashboard OpenAI (Recomendado)**

1. **Acesse:** https://platform.openai.com/assistants
2. **Localize:** Assistente `asst_pRXVhoy1o4YxNxVmaRiNOTMX` (Lia - Assistente Financeiro)
3. **Clique em:** "Edit"
4. **Atualize as Instruções:**
   - Abra `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md`
   - **Copie** todo o conteúdo das linhas **614-923** (seção "ASSISTENTE FINANCEIRO")
   - **Cole** na caixa "Instructions" do assistente
5. **Clique em:** "Save"

### **Método 2: Via API OpenAI**

```bash
curl https://api.openai.com/v1/assistants/asst_pRXVhoy1o4YxNxVmaRiNOTMX \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -d '{
    "instructions": "<COLE_AQUI_AS_INSTRUÇÕES_COMPLETAS>"
  }' \
  -X POST
```

---

## 📊 Validação Pós-Atualização

### **Teste 1: Cenário Michele Machado (Reprodução do Bug)**

1. Cliente envia: "Minha internet tá cortada"
2. Cliente envia: "Vou enviar comprovante"
3. Cliente envia: 📷 Imagem do comprovante (com código de barras "00000007990")
4. **✅ ESPERADO:** LIA pede CPF: "Para registrar o ticket, preciso que você me informe seu CPF ou CNPJ, por favor 😊"
5. **❌ NÃO ESPERADO:** LIA diz "já encaminhei" ou finaliza conversa

### **Teste 2: Cliente Fornece CPF Válido**

1. Cliente envia: 📷 Comprovante
2. LIA pede: CPF
3. Cliente envia: "123.456.789-00"
4. **✅ ESPERADO:** LIA valida formato e abre ticket
5. **✅ ESPERADO:** LIA NÃO chama `transferir_para_humano` depois

### **Teste 3: Cliente Fornece CPF Inválido (Sequência)**

1. Cliente envia: 📷 Comprovante
2. LIA pede: CPF
3. Cliente envia: "111.111.111-11"
4. **✅ ESPERADO:** LIA identifica sequência e pede CPF válido
5. **✅ ESPERADO:** LIA NÃO aceita e abre ticket com CPF inválido

### **Teste 4: Cliente Recusa Fornecer CPF**

1. Cliente envia: 📷 Comprovante
2. LIA pede: CPF (1ª vez)
3. Cliente ignora
4. LIA pede: CPF (2ª vez)
5. Cliente diz: "Não sei"
6. **✅ ESPERADO:** LIA transfere para humano
7. **❌ NÃO ESPERADO:** LIA finaliza conversa sem CPF ou ticket

---

## 🔍 Mudanças Específicas

### **Antes (ERRADO):**
```
Cliente: [Envia comprovante]
LIA: "Já encaminhei as informações para o financeiro!" ❌
LIA: [Finaliza conversa] ❌
```

### **Depois (CORRETO):**
```
Cliente: [Envia comprovante]
LIA: "Recebi seu comprovante! Para registrar, preciso do seu CPF ou CNPJ, por favor 😊"
Cliente: "123.456.789-00"
LIA: [Abre ticket no CRM]
LIA: "Ticket registrado! ✅ Nosso setor financeiro irá verificar em até 24h. 💙"
Cliente: "Ok, obrigada"
LIA: [Finaliza conversa]
```

---

## 📝 Arquivo de Instruções Completo

**Localização:** `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md`  
**Seção:** Linhas 608-933 (## 3. ASSISTENTE FINANCEIRO)

---

## ⚠️ IMPORTANTE

Esta atualização é **CRÍTICA** porque:
- Sem CPF válido, tickets não são abertos corretamente
- Clientes ficam sem suporte financeiro
- Atendentes humanos precisam intervir manualmente
- Sistema perde confiabilidade

**Atualize o mais rápido possível!** ⏰
