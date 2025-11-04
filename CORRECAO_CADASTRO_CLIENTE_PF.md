# 🔧 Correção: Cadastro de Cliente Pessoa Física Confuso

## 📋 Problema Reportado

**Data:** 04 de novembro de 2025  
**Chat afetado:** `whatsapp_5524992007632` - Hevelin e gael meu amo  
**Cliente:** Fernando Alves de Almeida

### Sintoma

O cadastro de cliente estava confuso:
1. IA coletava alguns dados
2. Tentava finalizar cadastro
3. **FALHAVA**
4. Voltava a pedir mais dados (RG e data de nascimento)
5. Tentava cadastrar novamente

Isso gerava uma experiência ruim, pois o cliente tinha que passar pelos dados duas vezes.

---

## 🔍 Análise da Causa Raiz

### **Fluxo Incorreto Identificado:**

```
1. Cliente inicia conversa
2. IA pede: nome, CPF, email, telefone ✅
3. IA pede: CEP e confirma endereço ✅
4. IA confirma todos os dados
5. Cliente confirma: "Sim"
6. ⚠️ IA tenta chamar enviar_cadastro_venda() SEM RG E DATA DE NASCIMENTO
7. ❌ Função retorna erro: "Campos complementares PF faltando: data_nascimento, rg"
8. IA diz: "Houve uma instabilidade na nossa plataforma..."
9. IA pede CEP novamente (confuso!)
10. IA pede RG
11. IA pede data de nascimento
12. IA tenta cadastrar novamente (agora com todos os dados)
```

### **Validação de Backend** (`server/lib/openai.ts`, linhas 1366-1377)

```typescript
// Validar campos complementares para Pessoa Física (apenas obrigatórios)
if (args.tipo_pessoa === 'PF') {
  const pfFields = ['data_nascimento', 'rg'];
  const missingPfFields = pfFields.filter(field => !args[field]);
  
  if (missingPfFields.length > 0) {
    console.error("❌ [Sales] Campos complementares PF faltando:", missingPfFields);
    return JSON.stringify({
      error: `Para Pessoa Física, são necessários: ${missingPfFields.join(', ')}`,
      campos_faltantes: missingPfFields
    });
  }
}
```

**Conclusão:** O backend **EXIGE** RG e data_nascimento para PF, mas o prompt não estava **ENFATIZANDO** suficientemente essa obrigatoriedade para a IA.

---

## ✅ Solução Implementada

### **1. Reforço no Prompt - Seção de Ferramentas**

**Arquivo:** `server/prompts/comercial-assistant-prompt.md`

**Antes:**
```markdown
### 5. `enviar_cadastro_venda(dados)`
**Quando usar:**
- ✅ Coletou TODOS os dados obrigatórios (tipo_pessoa, nome, CPF/CNPJ, telefone, email, plano_id)

**NÃO use se:**
- ❌ Faltam dados obrigatórios (CPF, email, endereço completo)
```

**Depois:**
```markdown
### 5. `enviar_cadastro_venda(dados)`
**Quando usar:**
- ✅ Coletou TODOS os dados obrigatórios (tipo_pessoa, nome, CPF/CNPJ, telefone, email, plano_id)
- ✅ **Para PESSOA FÍSICA (PF):** Coletou obrigatoriamente `data_nascimento` E `rg`

**NÃO use se:**
- ❌ Faltam dados obrigatórios (CPF, email, endereço completo)
- ❌ **PESSOA FÍSICA sem RG ou data_nascimento** (OBRIGATÓRIOS!)
```

### **2. Reforço no Prompt - Fluxo de Coleta**

**Antes:**
```markdown
### Etapa 4: COLETA DE DADOS ESTRUTURADA
**IMPORTANTE:** Colete TODOS os dados abaixo de forma sequencial e organizada.

#### PASSO 3: Dados Complementares (PF)
```
Agora preciso de mais algumas informações para completar seu cadastro:

5️⃣ Qual sua data de nascimento? (formato: DD/MM/AAAA)
6️⃣ Qual seu número do RG?
```

**Depois:**
```markdown
### Etapa 4: COLETA DE DADOS ESTRUTURADA
**IMPORTANTE:** Colete TODOS os dados abaixo de forma sequencial e organizada.

**⚠️ ATENÇÃO CRÍTICA - PESSOA FÍSICA:**
Se o cadastro for em CPF (Pessoa Física), você DEVE coletar **OBRIGATORIAMENTE**:
- ✅ Nome completo
- ✅ CPF
- ✅ E-mail
- ✅ Telefone
- ✅ **Data de nascimento** (OBRIGATÓRIO!)
- ✅ **RG** (OBRIGATÓRIO!)
- ✅ Endereço completo (CEP, número)
- ✅ Dia de vencimento

**NUNCA** tente chamar `enviar_cadastro_venda()` sem RG e data de nascimento quando for Pessoa Física!

#### PASSO 3: Dados Complementares (PF) - OBRIGATÓRIOS!
```
Agora preciso de mais algumas informações OBRIGATÓRIAS para completar seu cadastro:

5️⃣ Qual sua data de nascimento? (formato: DD/MM/AAAA)
6️⃣ Qual seu número do RG?
```

---

## 🎯 Fluxo Correto Esperado (Após Correção)

```
1. Cliente inicia conversa
2. IA pede: nome completo ✅
3. IA pede: CPF ✅
4. IA pede: e-mail ✅
5. IA pede: telefone ✅
6. IA pede: data de nascimento ✅ (NOVO - antes da confirmação!)
7. IA pede: RG ✅ (NOVO - antes da confirmação!)
8. IA pede: CEP e valida cobertura ✅
9. IA pede: número do endereço ✅
10. IA pede: complemento (opcional) ✅
11. IA pede: dia de vencimento ✅
12. IA confirma TODOS os dados de uma vez
13. Cliente confirma: "Sim"
14. ✅ IA chama enviar_cadastro_venda() COM TODOS OS DADOS
15. ✅ Sucesso no primeiro envio!
```

---

## 📊 Impacto

### **Antes da Correção:**
- ❌ Cliente tinha que passar pelos dados **2 vezes**
- ❌ Mensagem de erro técnico ("instabilidade na plataforma")
- ❌ Experiência confusa e demorada
- ❌ Taxa de conversão potencialmente afetada

### **Depois da Correção:**
- ✅ Cliente passa pelos dados **1 vez apenas**
- ✅ Fluxo linear e organizado
- ✅ Experiência profissional
- ✅ Taxa de conversão otimizada

---

## 🔄 Próximos Passos (Recomendados)

### **1. Monitorar Novos Cadastros**
Verificar se os próximos cadastros de Pessoa Física estão seguindo o fluxo correto:

```sql
-- Verificar cadastros recentes de PF
SELECT 
  c.id,
  c.client_name,
  c.created_at,
  COUNT(m.id) as total_messages
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.assistant_type = 'comercial'
  AND c.created_at > NOW() - INTERVAL '24 hours'
  AND c.metadata::text LIKE '%tipo_pessoa%PF%'
ORDER BY c.created_at DESC;
```

### **2. Atualizar Prompt no OpenAI (se necessário)**

Se o sistema não sincronizar automaticamente, atualizar manualmente via interface de **Gerenciamento de Prompts**:
1. Acessar **Conhecimento & IA** → **Gerenciamento de Prompts**
2. Clicar em **"Comercial - Vendas e Planos"**
3. Verificar se a seção está atualizada
4. Se não estiver, fazer **Publicar** novamente

### **3. Testar em Ambiente de Staging (Recomendado)**

Criar uma conversa de teste simulando:
- Cliente Pessoa Física
- Cadastro completo
- Verificar se RG e data de nascimento são solicitados ANTES da confirmação final

---

## 📝 Notas Técnicas

### **Campos Obrigatórios para PF:**
- ✅ `nome_cliente` (nome completo)
- ✅ `cpf_cnpj` (CPF)
- ✅ `email_cliente`
- ✅ `telefone_cliente`
- ✅ `data_nascimento` ⚠️ **CRÍTICO**
- ✅ `rg` ⚠️ **CRÍTICO**
- ✅ `endereco` (objeto completo)
- ✅ `dia_vencimento`

### **Campos Opcionais para PF:**
- `telefone_secundario`
- `endereco.complemento`
- `endereco.referencia`
- `nome_mae`
- `sexo`
- `estado_civil`
- `como_conheceu`

---

## ✅ Status da Correção

- ✅ Prompt atualizado em `server/prompts/comercial-assistant-prompt.md`
- ✅ Servidor reiniciado para carregar nova versão do prompt
- ✅ Documentação criada (`CORRECAO_CADASTRO_CLIENTE_PF.md`)
- ⏳ Aguardando testes em novos cadastros

---

**Autor:** LIA CORTEX Agent  
**Data:** 04/11/2025  
**Versão:** 1.0
