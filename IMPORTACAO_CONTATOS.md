# 📇 GUIA DE IMPORTAÇÃO DE CONTATOS - LIA CORTEX

## 🎯 **Visão Geral**

O LIA CORTEX possui **3 formas automáticas** de importar e gerenciar contatos:

1. **Sincronização WhatsApp** (Evolution API webhook) ⭐ **NOVO!**
2. **Importação na 1ª Mensagem** (automático)
3. **Enriquecimento Progressivo** (durante conversas)

**NÃO É NECESSÁRIO IMPORTAÇÃO MANUAL!**  
Tudo acontece automaticamente via WhatsApp 🚀

---

## 📥 **1. SINCRONIZAÇÃO WHATSAPP (NOVO!)**

### **Como Funciona:**

Quando você **adiciona um contato no WhatsApp** ou **atualiza o nome**, o Evolution API envia um webhook `contacts.update` e o sistema **importa automaticamente**.

### **Fluxo:**

```
Você adiciona contato no WhatsApp
↓
Evolution API detecta a mudança
↓
Envia webhook: contacts.update
↓
LIA CORTEX processa automaticamente
↓
Contato criado/atualizado no sistema
```

### **Dados Capturados:**

```javascript
{
  phoneNumber: "5524981175973",      // Do WhatsApp
  name: "João Silva",                // Nome do contato
  profilePicUrl: "https://...",      // Foto de perfil (opcional)
  status: "active",                  // Status inicial
  totalConversations: 0              // Ainda não conversou
}
```

### **Eventos Processados:**

#### **Contato Novo:**
```
📇 [Contacts Import] Processando contato do WhatsApp:
  phoneNumber: "5524981175973"
  name: "João Silva"
  
✅ [Contacts Import] Novo contato importado: 5524981175973 (João Silva)
📊 [Contacts Import] Sincronização concluída: 1 novos, 0 atualizados
```

#### **Contato Atualizado:**
```
📇 [Contacts Import] Processando contato do WhatsApp:
  phoneNumber: "5524981175973"
  name: "João Carlos Silva" (nome atualizado)
  
✏️ [Contacts Import] Contato atualizado: 5524981175973 → João Carlos Silva
📊 [Contacts Import] Sincronização concluída: 0 novos, 1 atualizados
```

### **Monitorar em Tempo Real:**

Acesse `/live-logs` e filtre por **eventos específicos**:
```
CONTACT_IMPORTED    → Novo contato importado do WhatsApp
CONTACT_UPDATED     → Nome do contato atualizado
CONTACTS_SYNC_COMPLETED → Sincronização concluída
```

### **Payload do Webhook:**

```json
{
  "event": "contacts.update",
  "instance": "Leads",
  "data": [
    {
      "remoteJid": "5524981175973@s.whatsapp.net",
      "profilePicUrl": "https://pps.whatsapp.net/...",
      "instanceId": "397e1aa4-8cb8-4627-8340-9689b6464d6a"
    }
  ]
}
```

### **Resposta da API:**

```json
{
  "success": true,
  "processed": true,
  "imported": 1,     // Contatos novos
  "updated": 0,      // Contatos atualizados
  "total": 1         // Total processado
}
```

---

## 💬 **2. IMPORTAÇÃO NA 1ª MENSAGEM**

### **Como Funciona:**

Quando um cliente envia a **primeira mensagem** no WhatsApp, o sistema **cria automaticamente** o contato.

### **Fluxo:**

```
Cliente: "Olá, preciso de ajuda"
↓
Evolution API envia webhook: messages.upsert
↓
Sistema extrai: phoneNumber + name
↓
Verifica se contato existe
↓
Se NÃO existe: Cria novo contato
Se EXISTE: Atualiza dados
```

### **Código (server/routes.ts linha 792-801):**

```javascript
// Auto-create/update contact
const phoneNumber = clientId || chatId.split('@')[0];
await storage.updateContactFromConversation(phoneNumber, conversation.id, {
  name: clientName || undefined,
});
console.log(`📇 [Contacts] Created/updated contact for ${phoneNumber}`);
```

### **Dados Capturados:**

```javascript
{
  phoneNumber: "5511999999999",        // Do chatId
  name: "João Silva",                   // Do pushName (perfil WhatsApp)
  lastConversationId: "abc-123",       // ID da conversa atual
  lastConversationDate: "2024-10-12",  // Agora
  totalConversations: 1,               // Primeira conversa
  status: "active",                     // Ativo
  hasRecurringIssues: false            // Inicial
}
```

---

## 🔄 **3. ENRIQUECIMENTO PROGRESSIVO**

### **Como Funciona:**

Durante as conversas, o sistema **detecta automaticamente** CPF/CNPJ e outros dados, enriquecendo o contato.

### **Dados Enriquecidos:**

#### **CPF/CNPJ (Automático):**
```javascript
// Cliente menciona CPF na conversa
Cliente: "Meu CPF é 123.456.789-00"
↓
Sistema detecta automaticamente (regex)
↓
Atualiza: contact.document = "12345678900"
```

#### **Problemas Recorrentes:**
```javascript
// Sistema detecta múltiplas conversas com mesmo CPF
if (conversationsWithSameCPF > 1) {
  contact.hasRecurringIssues = true;
}
```

#### **Histórico de Conversas:**
```javascript
// A cada nova conversa
contact.totalConversations++;
contact.lastConversationDate = new Date();
contact.lastConversationId = newConversationId;
```

### **Timeline de Enriquecimento:**

| Momento | Dados Capturados |
|---------|------------------|
| **Sincronização WhatsApp** | Telefone + Nome (antes da 1ª mensagem) |
| **1ª Mensagem** | Telefone + Nome do perfil |
| **Durante Conversa** | CPF/CNPJ (se mencionado) |
| **2ª Conversa** | Atualiza totalConversations |
| **Múltiplas Conversas** | Detecta problemas recorrentes |

---

## 🔍 **ESTRUTURA COMPLETA DO CONTATO**

```typescript
interface Contact {
  // Identificação
  id: string;                          // UUID gerado automaticamente
  phoneNumber: string;                 // Único (índice)
  name: string | null;                 // Nome do WhatsApp/atualizado

  // Documentos
  document: string | null;             // CPF/CNPJ (capturado na conversa)

  // Histórico
  lastConversationId: string | null;   // Última conversa
  lastConversationDate: Date | null;   // Data da última conversa
  totalConversations: number;          // Contador

  // Status e Flags
  hasRecurringIssues: boolean;         // Problemas recorrentes
  status: string;                      // 'active' ou 'inactive'

  // Metadados
  createdAt: Date;                     // Quando foi criado
  updatedAt: Date;                     // Última atualização
}
```

---

## 📊 **VISUALIZAR CONTATOS**

### **Via Interface:**

**URL:** `/contacts`  
**Menu:** Conversas → Contatos

**Funcionalidades:**
- ✅ Lista completa de contatos
- ✅ Busca por nome, telefone ou CPF
- ✅ Filtros por status e problemas recorrentes
- ✅ Histórico de conversas
- ✅ Botão para reabrir conversa

### **Via API:**

```bash
# Listar todos os contatos
GET /api/contacts

# Buscar contato específico
GET /api/contacts/:id

# Ver conversas do contato
GET /api/contacts/:id/conversations

# Reabrir conversa com contato
POST /api/contacts/:id/reopen
```

---

## 🎬 **EXEMPLOS PRÁTICOS**

### **Exemplo 1: Sincronização WhatsApp**

**Cenário:** Você adiciona um novo cliente no WhatsApp

```
1. Você adiciona "Maria Santos - 5521987654321" no WhatsApp

2. Evolution API detecta e envia webhook:
   {
     "event": "contacts.update",
     "data": [{
       "remoteJid": "5521987654321@s.whatsapp.net",
       "pushName": "Maria Santos"
     }]
   }

3. LIA CORTEX processa:
   📇 Processando contato do WhatsApp: 5521987654321
   ✅ Novo contato importado: Maria Santos

4. Contato criado no sistema:
   {
     "phoneNumber": "5521987654321",
     "name": "Maria Santos",
     "totalConversations": 0,
     "status": "active"
   }
```

### **Exemplo 2: Primeira Mensagem**

**Cenário:** Cliente envia primeira mensagem

```
1. Cliente (5511999999999): "Olá, preciso de ajuda"

2. Sistema processa webhook messages.upsert:
   - phoneNumber: "5511999999999"
   - pushName: "João Silva"

3. Verifica se contato existe:
   contact = await getContactByPhoneNumber("5511999999999")
   // Resultado: null (não existe)

4. Cria novo contato:
   📇 Created/updated contact for 5511999999999
   {
     "phoneNumber": "5511999999999",
     "name": "João Silva",
     "totalConversations": 1,
     "lastConversationDate": "2024-10-12"
   }
```

### **Exemplo 3: Enriquecimento com CPF**

**Cenário:** Cliente informa CPF durante conversa

```
1. Contato já existe:
   {
     "phoneNumber": "5511999999999",
     "name": "João Silva",
     "document": null
   }

2. Cliente envia: "Meu CPF é 123.456.789-00"

3. Sistema detecta CPF automaticamente (regex):
   const cpfPattern = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/
   detected = "12345678900"

4. Atualiza contato:
   📝 [Test Chat] CPF/CNPJ detectado e persistido
   {
     "phoneNumber": "5511999999999",
     "name": "João Silva",
     "document": "12345678900"
   }
```

### **Exemplo 4: Detecção de Recorrência**

**Cenário:** Cliente com múltiplas conversas

```
1ª Conversa (10/10):
   {
     "phoneNumber": "5511999999999",
     "totalConversations": 1,
     "hasRecurringIssues": false
   }

2ª Conversa (11/10):
   {
     "phoneNumber": "5511999999999",
     "totalConversations": 2,
     "hasRecurringIssues": false
   }

3ª Conversa (12/10) - Sistema detecta CPF igual:
   {
     "phoneNumber": "5511999999999",
     "document": "12345678900",
     "totalConversations": 3,
     "hasRecurringIssues": true  // ✅ Marcado automaticamente
   }
```

---

## 🔧 **CONFIGURAÇÃO**

### **Webhook Evolution API:**

**1. Configure o webhook no Evolution API:**
```json
{
  "webhook": "https://seu-dominio.replit.app/api/webhooks/evolution",
  "webhook_by_events": false,
  "events": [
    "MESSAGES_UPSERT",
    "CONTACTS_UPDATE"  // ⭐ Importante para sincronização
  ]
}
```

**2. Verifique se está ativo:**
```bash
# Via Evolution API
GET /instance/webhook/{instance}

# Resposta esperada:
{
  "webhook": "https://...",
  "webhook_by_events": false,
  "events": ["MESSAGES_UPSERT", "CONTACTS_UPDATE"]
}
```

---

## 📈 **MONITORAMENTO**

### **Via Live Logs (`/live-logs`):**

**Filtrar por eventos de contatos:**
```
Eventos disponíveis:
- CONTACT_IMPORTED → Novo contato importado do WhatsApp
- CONTACT_UPDATED → Nome atualizado
- CONTACTS_SYNC_COMPLETED → Sincronização concluída
- CONTACTS_IMPORT_ERROR → Erro na importação
```

**Exemplo de logs:**
```
✅ CONTACT_IMPORTED
   Contato importado do WhatsApp
   Details:
   {
     "phoneNumber": "5524981175973",
     "name": "João Silva",
     "source": "whatsapp_sync"
   }

✏️ CONTACT_UPDATED
   Nome do contato atualizado
   Details:
   {
     "phoneNumber": "5524981175973",
     "oldName": "João",
     "newName": "João Silva",
     "source": "whatsapp_sync"
   }

✅ CONTACTS_SYNC_COMPLETED
   Sincronização de contatos concluída
   Details:
   {
     "imported": 5,
     "updated": 3,
     "total": 8
   }
```

### **Via Console do Servidor:**

```bash
# Sincronização WhatsApp
📇 [Contacts Import] Processando contato do WhatsApp: {...}
✅ [Contacts Import] Novo contato importado: 5524981175973 (João Silva)
📊 [Contacts Import] Sincronização concluída: 1 novos, 0 atualizados

# Primeira mensagem
📇 [Contacts] Created/updated contact for 5511999999999

# CPF detectado
📝 [Test Chat] CPF/CNPJ detectado e persistido
```

---

## 🔄 **COMPARAÇÃO: ANTES vs DEPOIS**

### **ANTES (Apenas 1ª Mensagem):**
```
❌ Contato só criado quando cliente envia mensagem
❌ Se você adiciona no WhatsApp, não aparece no sistema
❌ Só enriquece durante conversas
```

### **DEPOIS (Com Sincronização WhatsApp):**
```
✅ Contato importado quando você adiciona no WhatsApp
✅ Aparece no sistema ANTES da 1ª mensagem
✅ Nome atualizado automaticamente se mudar no WhatsApp
✅ Enriquecimento progressivo continua funcionando
```

---

## 💡 **MELHORES PRÁTICAS**

### **1. Adicione contatos importantes no WhatsApp:**
```
Quando você adiciona no WhatsApp:
→ Automaticamente importa para o sistema
→ Fica disponível para reabrir conversa
→ Histórico começa a ser rastreado
```

### **2. Mantenha nomes atualizados:**
```
Se mudar nome no WhatsApp:
→ Sistema atualiza automaticamente
→ Logs mostram a mudança
→ Histórico preservado
```

### **3. Use a página de Contatos:**
```
/contacts
→ Visualizar todos os contatos
→ Buscar por nome/telefone/CPF
→ Reabrir conversas
→ Ver histórico completo
```

### **4. Monitore importações:**
```
/live-logs (filtro: CONTACT_IMPORTED)
→ Ver contatos sendo importados
→ Verificar sincronização
→ Debug de problemas
```

---

## 🚨 **TROUBLESHOOTING**

### **Problema: Webhook não está funcionando**

**Sintomas:**
```
❓ [Evolution] Evento desconhecido: contacts.update
```

**Solução:**
```
1. Verificar se código foi atualizado (linha 2519-2607)
2. Reiniciar servidor
3. Testar adicionando contato no WhatsApp
4. Verificar logs em /live-logs
```

### **Problema: Contato não aparece no sistema**

**Checklist:**
```
1. ✅ Webhook configurado no Evolution API?
2. ✅ Evento CONTACTS_UPDATE habilitado?
3. ✅ Webhook apontando para /api/webhooks/evolution?
4. ✅ Logs mostram "CONTACT_IMPORTED"?
```

### **Problema: Nome não atualiza**

**Verificar:**
```
1. Nome mudou no WhatsApp?
2. Webhook CONTACTS_UPDATE enviado?
3. Logs mostram "CONTACT_UPDATED"?
4. Contato já existe no banco?
```

---

## 📊 **ESTATÍSTICAS**

### **Formas de Importação:**

| Método | Quando | Dados |
|--------|--------|-------|
| **Sincronização WhatsApp** | Ao adicionar contato | Telefone + Nome |
| **1ª Mensagem** | Cliente inicia conversa | Telefone + Nome |
| **Enriquecimento** | Durante conversa | CPF/CNPJ + Histórico |

### **Dados Capturados:**

| Campo | Sincronização | 1ª Mensagem | Conversa |
|-------|--------------|-------------|----------|
| phoneNumber | ✅ | ✅ | - |
| name | ✅ | ✅ | - |
| document | - | - | ✅ |
| totalConversations | - | ✅ | ✅ |
| lastConversationDate | - | ✅ | ✅ |
| hasRecurringIssues | - | - | ✅ |

---

## ✅ **RESUMO**

**Como os contatos são importados?**

1. ✅ **Sincronização WhatsApp** (NOVO!) - Quando você adiciona/atualiza contato
2. ✅ **1ª Mensagem** - Quando cliente envia primeira mensagem
3. ✅ **Enriquecimento** - Durante conversas (CPF, histórico, etc.)

**Vantagens:**

- 🚀 **100% Automático** - Zero trabalho manual
- 📊 **Dados Completos** - Nome, telefone, CPF, histórico
- 🔄 **Sempre Atualizado** - Sincronização em tempo real
- 📈 **Progressivo** - Enriquece com o tempo
- 🎯 **Inteligente** - Detecta recorrência automaticamente

**Não há necessidade de:**
- ❌ Importar CSV ou planilha
- ❌ Cadastrar manualmente
- ❌ Atualizar dados periodicamente

**Tudo acontece automaticamente via WhatsApp!** 🎉

---

**Última Atualização:** 12 de Outubro de 2024  
**Versão:** 2.0 (com Sincronização WhatsApp)
