# 🚨 AÇÃO URGENTE: ATUALIZAR ASSISTENTE APRESENTACAO NO OPENAI

## ❌ Problema Identificado

O assistente APRESENTACAO no OpenAI **NÃO está roteando** clientes que mencionam "comprovante de pagamento" para o assistente FINANCEIRO!

**Resultado:** Cliente fica com assistente APRESENTACAO, que apenas transfere para humano em vez de abrir ticket automaticamente.

---

## ✅ Solução

Atualizar o assistente APRESENTACAO no OpenAI para incluir "comprovante" nas palavras-chave que fazem rotear para FINANCEIRO.

---

## 📋 PASSO A PASSO

### 1. Acesse o OpenAI
🔗 https://platform.openai.com/assistants

### 2. Localize o Assistente APRESENTACAO
- Procure por nome: "Lia - Assistente Apresentação/Recepção TR Telecom"
- OU procure pelo ID: `asst_oY50Ec5BKQzIzWcnYEo2meFc`

### 3. Encontre a Seção de Roteamento FINANCEIRO

No campo "Instructions", procure pela seção:

```
### **FINANCEIRO**
> "Certo! Estou encaminhando seu atendimento ao setor financeiro, tá bem? 😉"

**Quando usar:** Use a função `rotear_para_assistente` com `assistantType="financeiro"`

**Palavras-chave do cliente:**
- "boleto", "boletos", "segunda via", "segunda via do boleto"
- "fatura", "faturas", "conta", "vencimento", "vencimentos"
- "pagamento", "pagar", "negociação", "parcelamento", "acordo"
- "débito", "débitos", "pendência", "pendências", "dívida"
```

### 4. Substitua as Palavras-chave do FINANCEIRO

**SUBSTITUA** a seção de palavras-chave do cliente por esta versão **COMPLETA E ATUALIZADA**:

```
**Palavras-chave do cliente:**
- "boleto", "boletos", "segunda via", "segunda via do boleto"
- "fatura", "faturas", "conta", "vencimento", "vencimentos"
- "pagamento", "pagar", "paguei", "já paguei", "efetuei pagamento", "realizei pagamento"
- "comprovante", "comprovantes", "comprovante de pagamento", "enviar comprovante", "mandar comprovante"
- "negociação", "parcelamento", "acordo", "renegociar"
- "débito", "débitos", "pendência", "pendências", "dívida", "atrasado", "em atraso"
- "desbloqueio", "desbloquear", "liberar internet", "em confiança"
- "bloqueio", "bloqueado", "IP bloqueado", "cortou internet", "cortaram"
- "religamento", "religar", "reativar internet", "liberação", "voltar internet"
- "redução de velocidade", "internet lenta por inadimplência"
```

### 5. Salve
Clique em **Save**

---

## ✅ Como Testar

Após atualizar:

1. Envie pelo WhatsApp: **"quero enviar o comprovante"**
2. Assistente APRESENTACAO deve responder: "Certo! Estou encaminhando seu atendimento ao setor financeiro, tá bem? 😉"
3. Sistema roteia para assistente FINANCEIRO
4. Agora o FINANCEIRO (que você já atualizou) vai abrir o ticket automaticamente!

**Comportamento CORRETO esperado (após as 2 atualizações):**

1. Cliente diz: "quero enviar o comprovante" ✅
2. APRESENTACAO: "Estou encaminhando ao setor financeiro" ✅
3. Sistema roteia para FINANCEIRO ✅
4. Cliente envia imagem do comprovante ✅
5. FINANCEIRO pergunta: "Você tem 3 endereços: [lista]. Qual?" ✅
6. Cliente responde: "1" ✅
7. FINANCEIRO abre ticket COM endereço específico ✅
8. FINANCEIRO confirma: "Ticket registrado! Protocolo: XXX" ✅
9. **NÃO** transfere para humano ✅

---

## 📞 Resumo

Você precisa atualizar **DOIS** assistentes no OpenAI:

1. ✅ **FINANCEIRO** (já atualizado) - Abre ticket automaticamente
2. 🔄 **APRESENTACAO** (atualizar agora) - Roteia "comprovante" para FINANCEIRO

Após atualizar os dois, o fluxo completo funcionará! 🚀
