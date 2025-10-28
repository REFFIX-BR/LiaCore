# 🔧 CORREÇÃO RÁPIDA - IDs dos Assistentes

## 📊 SITUAÇÃO IDENTIFICADA

### ✅ Assistentes que JÁ EXISTEM no OpenAI:
- **Ouvidoria:** `asst_6SljJ5QSmAfgCVGXztUaKadC` ✅
- **Cancelamento:** `asst_yZqsxE2CRBacv5UT8ysMw9RE` ✅
- **Financeiro:** `asst_pRXVhoy1o4YxNxVmaRiNOTMX` ✅
- **Comercial:** `asst_KY7AbcYc3VeVk9QPlk8xPYAA` ✅
- **Suporte** (nome errado): `asst_CDkh1oE8YvKLtJYs3WY4rJX8` ⚠️
- **Apresentação:** `asst_oY50Ec5BKQzIzWcnYEo2meFc` ✅

### ❌ PROBLEMAS:

**Problema 1:** Assistente de Suporte está nomeado como "Comercial" no OpenAI
- **ID:** `asst_CDkh1oE8YvKLtJYs3WY4rJX8`
- **Nome atual:** "Lia - Comercial" ❌
- **Deveria ser:** "Lia - Suporte Técnico" ✅

**Problema 2:** Cancelamento está usando ID da Ouvidoria
- **Configurado no sistema:** `asst_6SljJ5QSmAfgCVGXztUaKadC` (ID da Ouvidoria) ❌
- **ID correto disponível:** `asst_yZqsxE2CRBacv5UT8ysMw9RE` ✅

---

## ✅ CORREÇÃO 1: Renomear Assistente de Suporte

### Passo a Passo:

1. **Acesse este link direto:**
   ```
   https://platform.openai.com/playground/assistants?assistant=asst_CDkh1oE8YvKLtJYs3WY4rJX8
   ```

2. **Clique em "Edit"** (ícone de lápis)

3. **No campo "Name", mude de:**
   ```
   Lia - Comercial
   ```
   **Para:**
   ```
   Lia - Suporte Técnico
   ```

4. **Clique em "Save"** (canto superior direito)

5. **Pronto!** O assistente agora tem o nome correto

---

## ✅ CORREÇÃO 2: Atualizar ID do Cancelamento nos Secrets

### Passo a Passo:

1. **No Replit, clique em "Secrets"** (🔑 ícone de chave no painel esquerdo)

2. **Procure por:** `OPENAI_CANCELAMENTO_ASSISTANT_ID`

3. **Clique no botão de editar** (ícone de lápis)

4. **Substitua o valor:**
   ```
   Valor ANTIGO (errado): asst_6SljJ5QSmAfgCVGXztUaKadC
   Valor NOVO (correto): asst_yZqsxE2CRBacv5UT8ysMw9RE
   ```

5. **Salve**

6. **Pronto!** Cancelamento agora usa o assistente correto

---

## ✅ CORREÇÃO 3: Reiniciar Workflow

Após fazer as 2 correções acima:

1. **No Replit, vá até a aba "Tools"**

2. **Clique em "Stop"** (parar o workflow atual)

3. **Aguarde alguns segundos**

4. **Clique em "Run"** (ou apenas aguarde reiniciar automaticamente)

5. **Aguarde aparecer:** `✅ [OpenAI] Todos os 7 assistants configurados`

---

## 📋 VALIDAÇÃO FINAL

Após as correções, sua configuração deve estar assim:

| Departamento | ID no Sistema | Nome no OpenAI |
|--------------|---------------|----------------|
| Apresentação | `asst_oY50Ec5BKQzIzWcnYEo2meFc` | Lia - Apresentação ✅ |
| Comercial | `asst_KY7AbcYc3VeVk9QPlk8xPYAA` | Lia - Comercial ✅ |
| **Suporte** | `asst_CDkh1oE8YvKLtJYs3WY4rJX8` | **Lia - Suporte Técnico** ✅ |
| Financeiro | `asst_pRXVhoy1o4YxNxVmaRiNOTMX` | Lia - Financeiro ✅ |
| Ouvidoria | `asst_6SljJ5QSmAfgCVGXztUaKadC` | Lia - Ouvidoria ✅ |
| **Cancelamento** | **`asst_yZqsxE2CRBacv5UT8ysMw9RE`** | Lia - Cancelamento ✅ |

---

## 🧪 TESTE

Após reiniciar, teste via WhatsApp:

1. **Teste Suporte:**
   - Envie: "Minha internet caiu"
   - Deve rotear para: Suporte Técnico
   - Assistente: `asst_CDkh1oE8YvKLtJYs3WY4rJX8`

2. **Teste Cancelamento:**
   - Envie: "Quero cancelar meu plano"
   - Deve rotear para: Cancelamento
   - Assistente: `asst_yZqsxE2CRBacv5UT8ysMw9RE` (não mais Ouvidoria!)

3. **Teste Ouvidoria:**
   - Envie: "Quero fazer uma reclamação"
   - Deve rotear para: Ouvidoria
   - Assistente: `asst_6SljJ5QSmAfgCVGXztUaKadC`

---

## 🎯 RESUMO

**São apenas 2 correções simples:**

1. ✅ Renomear `asst_CDkh1oE8YvKLtJYs3WY4rJX8` no OpenAI Dashboard
2. ✅ Atualizar `OPENAI_CANCELAMENTO_ASSISTANT_ID` nos Secrets do Replit

**Tempo estimado:** 2-3 minutos

---

**Status:** 🟡 AGUARDANDO CORREÇÕES
