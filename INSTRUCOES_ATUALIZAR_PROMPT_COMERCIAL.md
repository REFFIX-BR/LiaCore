# 📝 Instruções: Atualizar Prompt Comercial via Gerenciamento de Prompts

## ⚠️ Por que usar o Gerenciamento de Prompts?

O sistema LIA CORTEX carrega os prompts **DO BANCO DE DADOS** (tabela `prompt_templates`), não dos arquivos `.md`.

**Benefícios de usar a interface:**
- ✅ Sincronização automática com OpenAI API
- ✅ Versionamento semântico (1.0.12 → 1.0.13)
- ✅ Histórico de mudanças
- ✅ Análise de IA com sugestões
- ✅ Comparação visual (diff)

---

## 📋 Passo a Passo

### **1. Acessar Gerenciamento de Prompts**
1. Abra o LIA CORTEX
2. Faça login com credenciais de **ADMIN** ou **SUPERVISOR**
3. Navegue: **Conhecimento & IA** → **Gerenciamento de Prompts**
4. Você verá 6 cards dos assistentes

### **2. Abrir Editor do Comercial**
1. Clique no card **"Comercial - Vendas e Planos"**
2. A aba **"Edição"** abrirá automaticamente
3. Você verá o prompt atual no campo de texto

### **3. Localizar Seções a Atualizar**

Você precisa atualizar **2 seções** no prompt:

#### **SEÇÃO 1: Linha ~236 - Função `enviar_cadastro_venda`**

**BUSCAR por:**
```markdown
### 5. `enviar_cadastro_venda(dados)`
**Quando usar:**
- ✅ **SOMENTE** quando `buscar_cep()` retornou `tem_cobertura: true`
- ✅ Coletou TODOS os dados obrigatórios (tipo_pessoa, nome, CPF/CNPJ, telefone, email, plano_id)
```

**ADICIONAR** esta linha logo após a segunda linha:
```markdown
- ✅ **Para PESSOA FÍSICA (PF):** Coletou obrigatoriamente `data_nascimento` E `rg`
```

E **ADICIONAR** na seção "**NÃO use se:**" (linha ~245):
```markdown
- ❌ **PESSOA FÍSICA sem RG ou data_nascimento** (OBRIGATÓRIOS!)
```

**Resultado final da seção:**
```markdown
### 5. `enviar_cadastro_venda(dados)`
**Quando usar:**
- ✅ **SOMENTE** quando `buscar_cep()` retornou `tem_cobertura: true`
- ✅ Coletou TODOS os dados obrigatórios (tipo_pessoa, nome, CPF/CNPJ, telefone, email, plano_id)
- ✅ **Para PESSOA FÍSICA (PF):** Coletou obrigatoriamente `data_nascimento` E `rg`
- ✅ Coletou endereço completo via `buscar_cep()` (CEP, logradouro, bairro, cidade, estado, número)
- ✅ Cliente confirmou os dados
- ✅ Cliente confirmou que quer contratar

**NÃO use se:**
- ❌ Faltam dados obrigatórios (CPF, email, endereço completo)
- ❌ **PESSOA FÍSICA sem RG ou data_nascimento** (OBRIGATÓRIOS!)
- ❌ Cliente ainda está apenas consultando preços
- ❌ Cliente não confirmou interesse em contratar
- ❌ **CEP sem cobertura** (use `registrar_lead_sem_cobertura` nesse caso)
```

---

#### **SEÇÃO 2: Linha ~330 - Etapa 4: COLETA DE DADOS**

**BUSCAR por:**
```markdown
### Etapa 4: COLETA DE DADOS ESTRUTURADA

**IMPORTANTE:** Colete TODOS os dados abaixo de forma sequencial e organizada.

#### PASSO 1: Tipo de Documento
```

**ADICIONAR** este bloco ANTES de "#### PASSO 1":
```markdown
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
```

E **ALTERAR** o título do "#### PASSO 3:" para:
```markdown
#### PASSO 3: Dados Complementares (PF) - OBRIGATÓRIOS!
```

E **ALTERAR** o texto dentro do PASSO 3 para:
```markdown
Agora preciso de mais algumas informações OBRIGATÓRIAS para completar seu cadastro:

5️⃣ Qual sua data de nascimento? (formato: DD/MM/AAAA)
   [Aguarda resposta]

6️⃣ Qual seu número do RG?
   [Aguarda resposta]
```

---

### **4. Salvar Rascunho**
1. Após fazer as edições, clique em **"Salvar Rascunho"**
2. Aguarde confirmação: "Rascunho salvo com sucesso"

### **5. (Opcional) Análise da IA**
1. Clique em **"Solicitar Análise da IA"**
2. Aguarde 15-30 segundos
3. Revise sugestões na aba **"Sugestões da IA"**

### **6. Comparar Mudanças**
1. Clique na aba **"Comparar"**
2. Revise as diferenças lado a lado
3. Confirme que as mudanças estão corretas

### **7. Publicar Versão**
1. Clique em **"Publicar"**
2. **Tipo de versão:** Selecione `Patch` (correção de bug)
3. **Notas da versão:** 
   ```
   Correção: Reforço de campos obrigatórios para Pessoa Física
   
   - Adicionado aviso crítico sobre RG e data_nascimento serem OBRIGATÓRIOS para PF
   - Atualizada seção de validação da função enviar_cadastro_venda
   - Melhorada clareza do fluxo de coleta de dados
   
   Resolves: Bug de cadastro confuso onde IA tentava cadastrar sem RG/data_nascimento primeiro
   ```
4. Clique em **"Publicar Versão"**
5. ⏳ Aguarde sincronização automática com OpenAI (10-30 segundos)

### **8. Confirmar Atualização**
1. Após publicação bem-sucedida, você verá:
   - ✅ Nova versão: `1.0.13` (ou próxima patch)
   - ✅ Status: `active`
   - ✅ "Sincronizado com OpenAI" ✅

---

## 🔍 Verificar se Funcionou

Após publicar, você pode testar:

1. Criar uma nova conversa de teste (simular cliente)
2. Solicitar contratação de plano para Pessoa Física
3. A IA deve coletar RG e data de nascimento **ANTES** de tentar cadastrar

---

## ⚙️ Alternativa: Atualização Direta no Banco

Se preferir, posso atualizar diretamente no banco de dados via SQL. **Porém**:
- ❌ Não mantém versionamento semântico
- ❌ Não sincroniza automaticamente com OpenAI
- ❌ Não registra no histórico de mudanças

**Só recomendo isso se houver urgência extrema.**

---

## 📞 Dúvidas?

Se tiver alguma dúvida durante o processo, é só me chamar! 😊
