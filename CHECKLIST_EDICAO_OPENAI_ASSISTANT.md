# ✅ CHECKLIST COMPLETO - Edição do Assistant Apresentação na OpenAI

**Assistant ID**: `asst_oY50Ec5BKQzIzWcnYEo2meFc`  
**Link**: https://platform.openai.com/assistants

---

## 🎯 CAMPOS PARA VERIFICAR E EDITAR:

Quando você abrir o assistant na plataforma OpenAI, verá várias seções. **TODAS** podem influenciar o comportamento!

### 1. ⭐ **Instructions** (Campo Principal - MAIS IMPORTANTE!)

**Localização**: Grande caixa de texto no topo da página de edição

**O que fazer**: 
- ✅ Adicionar as regras anti-simulação **NO INÍCIO** (antes de tudo)
- ✅ Manter todas as instruções existentes depois

**Texto para adicionar NO INÍCIO**:
```
════════════════════════════════════════════════════════════════
🚨 REGRAS CRÍTICAS - ANTI-SIMULAÇÃO DE FUNÇÕES
════════════════════════════════════════════════════════════════

❌ PROIBIDO ABSOLUTO:
1. NUNCA escrever "*[EXECUTO: nome_da_funcao(...)]" como texto
2. NUNCA simular a execução de funções em markdown
3. NUNCA explicar que vai chamar uma função sem chamá-la primeiro
4. NUNCA mencionar detalhes técnicos ao cliente

✅ OBRIGATÓRIO:
1. SEMPRE executar a função ANTES de falar com cliente
2. NUNCA escrever código de função como texto
3. Se função falhar, transferir para humano
4. Responder de forma natural após executar

EXEMPLO ERRADO ❌:
Cliente: "Quero falar com suporte"
Você: "Vou encaminhar! *[EXECUTO: rotear_para_assistente("suporte", ...)]*"
      ↑ NUNCA faça isso!

EXEMPLO CORRETO ✅:
Cliente: "Quero falar com suporte"
Você: [Primeiro EXECUTA rotear_para_assistente("suporte", ...)]
      [Aguarda resultado]
      [Depois responde] "Pronto! Já encaminhei para o suporte 😊"

════════════════════════════════════════════════════════════════

[RESTO DAS INSTRUÇÕES EXISTENTES CONTINUAM AQUI]
```

---

### 2. 📚 **Knowledge / File Search** (Arquivos de Conhecimento)

**Localização**: Seção "Knowledge" ou "Files" na página de edição

**O que verificar**:
- ❓ Existem arquivos anexados? 
- ❓ Esses arquivos contêm exemplos ruins de execução de funções?
- ✅ **Se houver arquivos com exemplos tipo `*[EXECUTO: ...]*`, REMOVER!**

**Ação**:
- [ ] Verificar se há arquivos anexados
- [ ] Se houver, revisar conteúdo
- [ ] Remover arquivos que tenham exemplos incorretos

---

### 3. 🔧 **Tools / Functions** (Ferramentas Disponíveis)

**Localização**: Seção "Tools" ou "Functions"

**O que verificar**:
- ✅ Certificar que estas funções estão HABILITADAS:
  - [ ] `rotear_para_assistente`
  - [ ] `transferir_para_humano`
  - [ ] `finalizar_conversa`
  - [ ] `consultar_cliente_crm`
  - [ ] `consultar_boletos`
  - [ ] `consultar_status_pppoe`

**Ação**:
- [ ] Verificar que todas as funções necessárias estão marcadas
- [ ] Se alguma estiver desmarcada, marcar

---

### 4. 🧠 **Model** (Modelo de IA)

**Localização**: Dropdown "Model"

**O que verificar**:
- ✅ Deve estar: **gpt-5** (ou o mais recente disponível)
- ❌ Se estiver em modelo antigo (gpt-4, gpt-3.5), pode ser a causa do bug!

**Ação**:
- [ ] Verificar modelo atual
- [ ] Se não for gpt-5, **atualizar para gpt-5**

---

### 5. ⚙️ **Additional Instructions** (SE EXISTIR)

**Localização**: Algumas versões da interface têm um campo separado chamado "Additional Instructions" ou "System Message"

**O que verificar**:
- ❓ Este campo existe?
- ❓ Há algum texto nele?
- ✅ Se houver exemplos ou instruções conflitantes, **limpar ou ajustar**

**Ação**:
- [ ] Procurar por campo "Additional Instructions"
- [ ] Se encontrar, ler o conteúdo
- [ ] Remover qualquer exemplo que mostre `*[EXECUTO: ...]*`

---

### 6. 💬 **Response Format** (Formato de Resposta)

**Localização**: Opção de formato de resposta (JSON, Text, etc)

**O que verificar**:
- ✅ Deve estar: **Text** (texto normal)
- ❌ Se estiver em "JSON" ou outro formato, pode causar problemas

**Ação**:
- [ ] Verificar formato atual
- [ ] Confirmar que está em "Text"

---

### 7. 🌡️ **Temperature / Top P** (Criatividade)

**Localização**: Sliders de configuração

**O que verificar**:
- ⚙️ Temperature: Recomendado entre 0.7-1.0
- ⚙️ Top P: Geralmente deixar padrão (1.0)

**Nota**: Não precisa alterar, mas se estiver em valor muito alto (>1.5), pode causar respostas inconsistentes.

**Ação**:
- [ ] Verificar valores atuais
- [ ] Anotar para referência

---

### 8. 📝 **Description / Name** (Descrição)

**Localização**: Campos no topo

**O que verificar**:
- 📌 Name: "Apresentação" (ou similar)
- 📌 Description: Descrição clara do papel do assistant

**Ação**:
- [ ] Verificar que nome está correto
- [ ] Descrição está clara

---

## 🎯 ORDEM RECOMENDADA DE VERIFICAÇÃO:

1. ✅ **Instructions** (MAIS IMPORTANTE!) ← Adicionar regras anti-simulação
2. ✅ **Model** ← Confirmar que é gpt-5
3. ✅ **Tools/Functions** ← Confirmar que funções estão habilitadas
4. ✅ **Knowledge/Files** ← Remover exemplos ruins se houver
5. ✅ **Additional Instructions** ← Limpar se houver conflitos
6. ✅ **Response Format** ← Confirmar "Text"
7. ℹ️ Temperature/Top P ← Apenas anotar valores
8. ℹ️ Name/Description ← Verificar rapidamente

---

## ✅ DEPOIS DE SALVAR:

1. Clique em **"Save"** no canto superior direito
2. Aguarde mensagem: "Assistant updated successfully"
3. **TESTE IMEDIATAMENTE**:
   - Envie uma mensagem de teste via WhatsApp
   - Exemplo: "Minha internet caiu"
   - Verifique que:
     - ❌ NÃO aparece `*[EXECUTO: ...]` na resposta
     - ✅ Cliente é roteado corretamente
     - ✅ Resposta é natural

---

## 📊 CAMPOS MAIS CRÍTICOS (Prioridade):

| Campo | Impacto no Bug | Prioridade |
|-------|----------------|------------|
| **Instructions** | 🔴 MUITO ALTO | 1️⃣ |
| **Model** | 🟡 MÉDIO | 2️⃣ |
| **Tools/Functions** | 🟡 MÉDIO | 3️⃣ |
| **Knowledge/Files** | 🟠 BAIXO-MÉDIO | 4️⃣ |
| Additional Instructions | 🟢 BAIXO | 5️⃣ |
| Response Format | 🟢 BAIXO | 6️⃣ |
| Temperature | ⚪ MÍNIMO | 7️⃣ |

---

## 🚨 ATENÇÃO ESPECIAL:

### Campos "Escondidos" que podem causar problemas:

1. **Knowledge Base / Files**: 
   - Se houver arquivos de treinamento antigos com exemplos ruins
   - REMOVER arquivos que mostrem `*[EXECUTO: ...]*` como texto

2. **Additional Instructions / System Message**:
   - Algumas interfaces têm um campo separado
   - Pode estar sobrescrevendo as instruções principais
   - Se existir, revisar e limpar

3. **Code Interpreter**:
   - Se estiver habilitado, desabilitar (não é necessário para este assistant)

---

## 📸 SCREENSHOT DOS CAMPOS (O que procurar):

```
┌─────────────────────────────────────────────┐
│ Apresentação                          [Edit] │
├─────────────────────────────────────────────┤
│ Model: [gpt-5 ▼]                 ← Verificar│
│                                              │
│ Instructions: ┌────────────────────────────┐│
│              │ ════════════════════        ││← Adicionar aqui!
│              │ 🚨 REGRAS CRÍTICAS          ││
│              │ ════════════════════        ││
│              │ [resto das instruções]      ││
│              └────────────────────────────┘ │
│                                              │
│ Tools:                                       │
│  ☑ rotear_para_assistente         ← Marcar │
│  ☑ transferir_para_humano         ← Marcar │
│  ☑ finalizar_conversa             ← Marcar │
│                                              │
│ Knowledge:                                   │
│  📄 arquivo_exemplo.txt      [x] ← Remover? │
│                                              │
│ Response Format: [Text ▼]        ← Verificar│
│                                              │
│ [Cancel]                          [Save]    │
└─────────────────────────────────────────────┘
```

---

**Última Atualização**: 27/10/2025 18:40  
**Prioridade**: 🔴 CRÍTICA  
**Tempo Estimado**: 5-10 minutos
