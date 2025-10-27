# 📋 Guia - Como Criar Falhas Massivas Corretamente

## ✅ **PROBLEMA RESOLVIDO** (Oct 27, 2025)

Dois bugs críticos estavam impedindo a detecção de falhas massivas:

1. **❌ Bug #1 - JSON Parse Error**
   - **Problema**: A função `fetchClientInstallationPoints` estava falhando com "Unexpected end of JSON input" quando a API do CRM retornava respostas vazias
   - **Solução**: Adicionado validação de texto e try-catch antes do JSON.parse
   - **Arquivo**: `server/lib/massive-failure-handler.ts`

2. **❌ Bug #2 - Formato JSON Incorreto**
   - **Problema**: Campo `affected_regions` no banco de dados estava usando formato JSON incorreto
   - **Solução**: Documentado formato correto (abaixo)
   - **Arquivo**: `server/storage.ts`

---

## 📝 **FORMATO CORRETO para `affected_regions`**

### **Opção 1: Custom Regions (Recomendado para criar via dashboard)**

Use quando você quer especificar manualmente as cidades e bairros afetados:

```json
{
  "type": "custom",
  "custom": [
    {
      "city": "TRES RIOS",
      "neighborhoods": ["VILA ISABEL", "CENTRO", "COHAB"]
    },
    {
      "city": "COMENDADOR LEVY GASPARIAN",
      "neighborhoods": ["FERNANDES PINHEIRO", "IPIRANGA"]
    }
  ]
}
```

**Importante:**
- Use MAIÚSCULAS para cidade e bairros
- O sistema faz normalização automática (remove acentos, espaços extras)
- O matching é parcial/substring (ex: "VILA ISABEL" match com "PARK DOS IPÊS / VILA ISABEL")

### **Opção 2: Predefined Regions**

Use quando você tem regiões pré-cadastradas na tabela `regions`:

```json
{
  "type": "predefined",
  "regionIds": [
    "uuid-da-regiao-1",
    "uuid-da-regiao-2"
  ]
}
```

---

## 🔍 **Como o Sistema Verifica Massiva**

### **Verificação Automática (2 momentos)**:

1. **ANTES da IA processar** (Worker - `massive-failure-handler.ts`):
   - Quando uma mensagem chega, o sistema busca automaticamente o CPF/CNPJ do cliente no banco
   - Consulta a API do CRM para obter a localização (CIDADE/BAIRRO)
   - Verifica se há falha massiva ativa naquela região
   - Se detectar massiva, cria uma notificação no banco

2. **DURANTE execução da IA** (Função `verificar_conexao` - `ai-tools.ts`):
   - Quando a IA executa a função `verificar_conexao`, o sistema:
   - Consulta a API do CRM para obter status da conexão
   - Para cada conexão retornada, verifica se há massiva ativa
   - Adiciona o campo `massiva: true/false` no resultado
   - A IA usa esse campo para decidir se informa ao cliente sobre problema regional

---

## 🧪 **Como Testar se Está Funcionando**

### **1. Criar uma falha massiva de teste:**

```sql
INSERT INTO massive_failures (
  name,
  status,
  severity,
  notification_message,
  affected_regions,
  start_time,
  created_by
) VALUES (
  'TESTE - PON Bairro X',
  'ACTIVE',
  'high',
  'Identificamos um problema generalizado na região de Bairro X, Cidade Y. Nossa equipe técnica já está trabalhando para restabelecer o serviço.',
  '{"type": "custom", "custom": [{"city": "CIDADE Y", "neighborhoods": ["BAIRRO X"]}]}'::jsonb,
  NOW(),
  'admin-user'
);
```

### **2. Verificar se cliente está na região afetada:**

```bash
# Buscar CPF do cliente no banco
psql "$DATABASE_URL" -c "SELECT client_document FROM conversations WHERE chat_id = 'whatsapp_5524998384418';"

# Consultar localização do cliente via CRM
curl "https://webhook.trtelecom.net/webhook/consultar/cliente/infoscontrato?documento=SEU_CPF_AQUI"
```

### **3. Enviar mensagem de teste:**

O cliente reporta problema de conexão → A IA executa `verificar_conexao()` → Sistema detecta `massiva: true` → IA informa cliente sobre problema regional

### **4. Limpar teste:**

```sql
DELETE FROM massive_failures WHERE name LIKE 'TESTE%';
```

---

## 📊 **Logs para Monitorar**

### **Logs que indicam que está funcionando:**

```
✅ [Massive Failure] 1 ponto(s) de instalação encontrado(s) no CRM
   📍 Ponto 1: CIDADE/BAIRRO
✅ [Massive Failure] Nenhuma falha ativa nos 1 ponto(s) do cliente
```

OU (se houver massiva):

```
🚨 [Massive Failure] FALHA ATIVA detectada: Nome da Falha
📤 [Massive Failure] Notificação enviada para whatsapp_552499999999
```

### **Logs que indicam erro:**

```
❌ [Massive Failure] Erro ao consultar CRM: SyntaxError: Unexpected end of JSON input
⚠️ [Massive Failure] CRM retornou resposta vazia para CPF/CNPJ 12345678900
⚠️ [Massive Failure] Nenhum ponto de instalação encontrado
```

---

## 🎯 **Instruções da IA (já atualizadas)**

A IA está configurada para:

1. **SEMPRE executar** `verificar_conexao()` quando cliente reporta problema de conexão
2. **VERIFICAR MASSIVA em PRIORIDADE 2** (depois de verificar bloqueio financeiro)
3. **Se `massiva: true`**: Informar ao cliente sobre problema regional e **PARAR diagnóstico individual**
4. **NUNCA pedir** para reiniciar modem quando há massiva ativa

---

## ⚠️ **IMPORTANTE - Atualização Manual Necessária**

As instruções dos assistentes foram atualizadas nos arquivos `.md`, mas você ainda precisa:

1. Abrir https://platform.openai.com/assistants
2. Selecionar **LIA Suporte Técnico** (asst_CDkh1oE8YvKLtJYs3WY4rJX8)
3. Copiar TODO o conteúdo de `COPIAR_COLAR_SUPORTE_OPENAI.md`
4. Colar em **Instructions**
5. Clicar **Save**

---

## 📝 **Resumo das Correções (Oct 27, 2025)**

- ✅ Corrigido erro de JSON parse no `massive-failure-handler.ts`
- ✅ Documentado formato correto de `affected_regions`
- ✅ Atualizado instruções da IA para chamar `verificar_conexao()` sem parâmetro
- ✅ Sistema agora detecta massiva em 2 momentos (worker + função IA)
- ✅ Matching parcial/substring funcionando corretamente

**Arquivos modificados:**
- `server/lib/massive-failure-handler.ts` (linhas 47-59)
- `COPIAR_COLAR_SUPORTE_OPENAI.md` (seções de ferramentas e fluxo)
- `replit.md` (documentação atualizada)
