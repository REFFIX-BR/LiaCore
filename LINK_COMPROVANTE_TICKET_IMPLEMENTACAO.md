# 📎 IMPLEMENTAÇÃO: Link do Comprovante no Ticket CRM

## ✅ Implementado em 27/10/2025

### 🎯 Solicitação do Usuário

Quando o cliente envia uma imagem/PDF de comprovante, incluir o link (URL S3) no ticket do CRM para que o atendente possa abrir o comprovante diretamente.

---

## 🔧 Implementação Técnica

### 1. Modificação em `server/ai-tools.ts` (Função `abrirTicketCRM`)

**Linhas 669-676 - Nova assinatura com parâmetro opcional:**

```typescript
export async function abrirTicketCRM(
  resumo: string,
  setor: string,
  motivo: string,
  conversationContext: { conversationId: string },
  storage: IStorage,
  comprovante_url?: string  // ← NOVO parâmetro opcional
): Promise<AbrirTicketResult>
```

**Linhas 710-716 - Incluir link no resumo:**

```typescript
// Montar resumo com telefone e link do comprovante (se disponível)
let resumoCompleto = `[WhatsApp: ${phoneNumber}] ${resumo}`;

if (comprovante_url) {
  resumoCompleto += `\n\n📎 Comprovante: ${comprovante_url}`;
  console.log(`📎 [AI Tool] Link do comprovante incluído no ticket`);
}
```

---

### 2. Salvamento do Link no Metadata (`server/workers.ts`)

**Linhas 487-498 - Salvar imageUrl após processamento Vision:**

```typescript
// Salvar imageUrl original (S3) no metadata da conversa para uso posterior
if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
  const currentMetadata = conversation.metadata || {};
  await storage.updateConversation(conversationId, {
    metadata: {
      ...currentMetadata,
      lastImageUrl: imageUrl,
      lastImageProcessedAt: new Date().toISOString()
    }
  });
  console.log(`📎 [Worker] Link da imagem salvo no metadata para acesso futuro`);
}
```

**Como funciona:**
1. Quando uma imagem é processada via GPT-4o Vision, o `imageUrl` original (link S3) é salvo no `metadata` da conversa
2. Fica disponível em `conversation.metadata.lastImageUrl`
3. Timestamp do processamento também é salvo

---

### 3. Recuperação com Validação de Freshness (`server/ai-tools.ts`)

**Linhas 954-989 - AI Tool Handler com validação de segurança (3 camadas):**

```typescript
// Recuperar imageUrl do metadata (se disponível E recente)
const conversation = await storage.getConversation(context.conversationId);
const metadata = conversation?.metadata as any;
let imageUrl = metadata?.lastImageUrl;

// VALIDAÇÃO DE FRESHNESS: só usar link se foi processado recentemente (últimos 5 minutos)
if (imageUrl) {
  // CRÍTICO: Ignorar metadata legado sem timestamp (conversas antigas)
  if (!metadata?.lastImageProcessedAt) {
    console.log(`⚠️ [AI Tool Security] imageUrl ignorado - metadata legado sem timestamp`);
    imageUrl = null; // Ignorar e limpar metadata legado
    
    // Limpar metadata legado para evitar repetição deste log
    await storage.updateConversation(context.conversationId, {
      metadata: {
        ...metadata,
        lastImageUrl: null,
        lastImageProcessedAt: null
      }
    });
  } else {
    // Verificar se foi processado recentemente
    const processedAt = new Date(metadata.lastImageProcessedAt);
    const now = new Date();
    const minutesAgo = (now.getTime() - processedAt.getTime()) / (1000 * 60);
    
    if (minutesAgo > 5) {
      console.log(`⚠️ [AI Tool Security] imageUrl ignorado - processado há ${minutesAgo.toFixed(1)} minutos (limite: 5 min)`);
      imageUrl = null; // Ignorar link antigo
    } else {
      console.log(`✅ [AI Tool Security] imageUrl validado - processado há ${minutesAgo.toFixed(1)} minutos`);
    }
  }
}

return await abrirTicketCRM(args.resumo, args.setor, args.motivo, context, storage, imageUrl);
```

**Como funciona (3 camadas de proteção):**
1. **Camada 1:** Verificar se imageUrl existe
2. **Camada 2:** Verificar se timestamp existe (protege contra metadata legado)
   - Se não existir, **ignora o link** e **limpa metadata legado**
3. **Camada 3:** Verificar se foi processado nos últimos 5 minutos (freshness check)
   - Se muito antigo, ignora o link
4. Passa automaticamente para a função `abrirTicketCRM`
5. A IA NÃO precisa saber ou fornecer o link - tudo é automático!

---

## 📋 Formato do Resumo no CRM

### Antes (sem imagem):
```
[WhatsApp: 5522997074180] Cliente Marcio enviou solicitação de cancelamento.
```

### Agora (COM imagem):
```
[WhatsApp: 5522997074180] Cliente Marcio Zebende enviou comprovante de R$ 69,00 
referente ao endereço CENTRO - Bernardo Belo, 160. 
Pagamento via boleto em 20/03/2024.

📎 Comprovante: https://s3.trtelecom.net/evolution/evolution-api/397e1aa4-8cb8-4627-8340-9689b6464d6a/5522997074180%40s.whatsapp.net/3A0ABEC97B4E2D5E4CF9.jpeg
```

---

## 📄 Documentação Atualizada

### 1. `INSTRUCTIONS_FINANCEIRO_NOVA_VERSAO.md`

**Linhas 168-186:** Atualizado para mencionar que link é incluído automaticamente:

```markdown
**ℹ️ IMPORTANTE:** O sistema adiciona AUTOMATICAMENTE:
- ✅ **Número de telefone** (WhatsApp) no início do resumo
- ✅ **Link do comprovante** (se cliente enviou imagem/PDF)
```

**Exemplo completo no CRM:**
```
[WhatsApp: 5522997074180] Cliente Marcio enviou comprovante de R$ 69,00...

📎 Comprovante: https://s3.trtelecom.net/evolution/...
```

**Linha 212:** Nota atualizada
```markdown
**📱 Nota:** O número de telefone (WhatsApp) e link do comprovante (se enviado) 
serão adicionados automaticamente pelo sistema.
```

---

### 4. Limpeza de Metadata Após Uso (`server/ai-tools.ts`)

**Linhas 738-749 - Limpeza após sucesso:**

```typescript
// LIMPAR metadata após usar o link do comprovante (evitar reutilização em tickets futuros)
if (comprovante_url) {
  const currentMetadata = conversation.metadata || {};
  await storage.updateConversation(conversationContext.conversationId, {
    metadata: {
      ...currentMetadata,
      lastImageUrl: null, // Limpar para evitar reutilização
      lastImageProcessedAt: null
    }
  });
  console.log(`🧹 [AI Tool] Metadata do comprovante limpo após criar ticket`);
}
```

**Como funciona:**
1. Após criar o ticket com sucesso, o metadata é limpo
2. Evita que o mesmo link seja reutilizado em tickets futuros da mesma conversa
3. Combina com validação de freshness para máxima segurança

---

## ✅ Vantagens da Implementação

1. **Automática:** IA não precisa saber nada sobre o link
2. **Transparente:** Link S3 é preservado e incluído automaticamente
3. **Rastreável:** Atendente pode abrir o comprovante diretamente
4. **Seguro:** Usa storage seguro (S3) da Evolution API
5. **Validação de Freshness (3 camadas):**
   - **Camada 1:** Verifica se imageUrl existe
   - **Camada 2:** Protege contra metadata legado sem timestamp
   - **Camada 3:** Só aceita links processados nos últimos 5 minutos
6. **Auto-limpeza:** Metadata é limpo após uso para evitar reutilização
7. **Proteção contra bugs:** Múltiplas camadas de validação impedem links errados

---

## 🎯 Fluxo Completo (Exemplo Real)

**1. Cliente envia comprovante via WhatsApp:**
```
Cliente (5522997074180): [Envia imagem de comprovante de R$ 69,00]
```

**2. Worker processa a imagem:**
```
🖼️ [Worker] Image detected, analyzing...
🔗 [Worker] imageUrl é URL S3/MinIO, baixando...
🔍 [Worker] URL: https://s3.trtelecom.net/evolution/evolution-api/...
✅ [Worker] Vision analysis completed successfully
📎 [Worker] Link da imagem salvo no metadata para acesso futuro
```

**3. IA processa e identifica comprovante:**
```
IA: Recebi seu comprovante! Você tem 3 endereços: [lista]. 
    Qual corresponde a este pagamento?
Cliente: 1
```

**4. IA abre ticket (handler recupera link automaticamente):**
```
🔧 [AI Tool] Handling function call: abrir_ticket_crm
📎 [AI Tool] Link do comprovante incluído no ticket
🎫 [AI Tool] Abrindo ticket no CRM
```

**5. Resumo no CRM (com telefone + link):**
```
[WhatsApp: 5522997074180] Cliente Marcio Zebende enviou comprovante de R$ 69,00 
referente ao endereço CENTRO - Bernardo Belo, 160. 
Pagamento via boleto em 20/03/2024.

📎 Comprovante: https://s3.trtelecom.net/evolution/evolution-api/397e1aa4-8cb8-4627-8340-9689b6464d6a/5522997074180%40s.whatsapp.net/3A0ABEC97B4E2D5E4CF9.jpeg
```

**6. Atendente no CRM:**
- Vê o protocolo: 2510270030641791
- Vê o resumo completo com endereço
- **Clica no link do comprovante para visualizar/baixar**
- Verifica o pagamento
- Dá baixa manual

---

## 🔍 Teste Manual

Para testar, envie um comprovante via WhatsApp:

**Comando para verificar logs:**
```bash
grep "Link da imagem salvo" /tmp/logs/Start_application_*.log | tail -1
grep "imageUrl validado" /tmp/logs/Start_application_*.log | tail -1
grep "Link do comprovante incluído" /tmp/logs/Start_application_*.log | tail -1
grep "Metadata do comprovante limpo" /tmp/logs/Start_application_*.log | tail -1
```

**Deve aparecer:**
```
📎 [Worker] Link da imagem salvo no metadata para acesso futuro
✅ [AI Tool Security] imageUrl validado - processado há 0.2 minutos
📎 [AI Tool] Link do comprovante incluído no ticket
🧹 [AI Tool] Metadata do comprovante limpo após criar ticket
```

**Teste de segurança 1 (verificar freshness temporal):**
1. Enviar comprovante
2. Aguardar 6+ minutos
3. Solicitar novo ticket (sem enviar nova imagem)
4. Verificar que link NÃO foi incluído:

```bash
grep "imageUrl ignorado" /tmp/logs/Start_application_*.log | tail -1
```

**Deve aparecer:**
```
⚠️ [AI Tool Security] imageUrl ignorado - processado há 6.3 minutos (limite: 5 min)
```

**Teste de segurança 2 (verificar proteção contra metadata legado):**
1. Criar metadata legado manualmente (apenas `lastImageUrl` sem `lastImageProcessedAt`)
2. Tentar abrir ticket
3. Verificar que link NÃO foi incluído:

```bash
grep "metadata legado sem timestamp" /tmp/logs/Start_application_*.log | tail -1
```

**Deve aparecer:**
```
⚠️ [AI Tool Security] imageUrl ignorado - metadata legado sem timestamp
```

---

## 🔗 Formato do Link S3

O link segue este padrão:
```
https://s3.trtelecom.net/evolution/evolution-api/{instance-id}/{phone}/{filename}
```

**Exemplo:**
```
https://s3.trtelecom.net/evolution/evolution-api/397e1aa4-8cb8-4627-8340-9689b6464d6a/5522997074180%40s.whatsapp.net/3A0ABEC97B4E2D5E4CF9.jpeg
```

---

## ✅ Status

**Totalmente implementado com validações de segurança em 3 camadas!** 
- ✅ Código modificado (ai-tools.ts, workers.ts)
- ✅ Link salvo automaticamente no metadata com timestamp
- ✅ Validação de freshness (5 minutos) implementada
- ✅ Proteção contra metadata legado sem timestamp
- ✅ Auto-limpeza de metadata após uso
- ✅ Recuperação automática pelo handler com segurança
- ✅ Inclusão no resumo do ticket
- ✅ Documentação atualizada com todas as validações
- ✅ **Bug de reutilização de link CORRIGIDO** (architect review #1)
- ✅ **Proteção contra metadata legado implementada** (architect review #2)

---

## 📞 Benefícios para o Atendente

Antes:
- ❌ Atendente precisava pedir para cliente reenviar comprovante
- ❌ Ou acessar WhatsApp manualmente para procurar a imagem
- ❌ Processo lento e ineficiente

Agora:
- ✅ Link direto no ticket do CRM
- ✅ Um clique para visualizar o comprovante
- ✅ Processo rápido e eficiente
- ✅ Melhor experiência para atendente e cliente
