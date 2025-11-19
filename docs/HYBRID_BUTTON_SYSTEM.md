# Sistema Híbrido de Botões Meta + IA

## Visão Geral

Sistema de triagem de atendimento que combina botões interativos do WhatsApp (Meta) com a IA existente, permitindo fluxos 100% automatizados para casos simples (como 2ª via de boleto) e roteamento inteligente para casos complexos.

## Objetivos

- **Reduzir custos com IA**: Fluxos simples não consomem tokens OpenAI
- **Melhorar experiência**: Interface visual clara com botões
- **Atendimento mais rápido**: Cliente vai direto ao ponto sem precisar explicar
- **Reduzir carga na IA**: IA só atua em casos que realmente precisam de inteligência

## Arquitetura Geral

```
Cliente envia mensagem
        ↓
É primeira interação?
        ↓
    [SIM] → Envia BOTÕES de triagem
        ↓
Cliente clica no botão
        ↓
Identifica tipo de solicitação
        ↓
    ┌───────────────┴───────────────┐
    ↓                               ↓
FLUXO AUTOMÁTICO              FLUXO COM IA
(sem tokens)                  (roteamento inteligente)
    ↓                               ↓
Resolve e encerra             IA atende ou transfere
```

---

## 1. FLUXO: 2ª VIA DE BOLETO (100% Automático)

### 1.1 Diagrama Completo

```
Cliente: "Oi"
    ↓
Sistema: Envia botões de triagem
    ↓
Cliente: Clica "💰 2ª Via de Boleto"
    ↓
Sistema: "Por favor, informe seu CPF ou CNPJ:"
    ↓
Cliente: "12345678900"
    ↓
Sistema: Valida formato do CPF
    ↓
    ├─ INVÁLIDO → "CPF inválido, tente novamente"
    └─ VÁLIDO → Busca no CRM
                    ↓
            ┌───────┴────────┐
            ↓                ↓
     TEM FATURAS      SEM FATURAS
            ↓                ↓
     Envia PDFs      "Não encontrei faturas"
     + PIX + Código      ↓
            ↓         Transfere para humano
     Resolve conversa
```

### 1.2 Mensagens no Fluxo

**Passo 1: Botões Iniciais**
```
Olá! Como posso ajudar você hoje?

[💰 2ª Via de Boleto]
[📱 Suporte Técnico]
[🛍️  Vendas/Upgrade]
[📋 Ouvidoria]
[❌ Cancelamento]
```

**Passo 2: Solicitação de CPF**
```
Por favor, informe seu CPF ou CNPJ para buscar seus boletos:
```

**Passo 3: Envio de Fatura (para cada boleto)**
```
📄 *Fatura - Vencimento: 10/12/2025*
💰 Valor: R$ 89,90

*Código de Barras:*
00190.00009 03096.941012 41008.190201 6 96580000008990

*PIX Copia e Cola:*
00020101021126...

*Link de Pagamento:*
https://pay.trtelecom.net/invoice/abc123

[PDF anexado: Fatura_10_12_2025.pdf]
```

**Passo 4: Mensagem Final**
```
✅ Todas as faturas foram enviadas! 

Se precisar de ajuda, é só chamar.
```

### 1.3 Cenários de Erro

| Situação | Mensagem | Ação |
|----------|----------|------|
| CPF inválido | "❌ CPF inválido. Por favor, digite novamente:" | Pede novamente |
| 3 tentativas erradas | "⚠️ CPF inválido 3 vezes. Vou transferir para atendente." | Transfere para financeiro |
| Sem faturas no CRM | "ℹ️ Não encontrei faturas pendentes para este CPF." | Transfere para financeiro |
| Erro no CRM | "⚠️ Ocorreu um erro ao buscar suas faturas." | Transfere para financeiro |
| Cliente não responde CPF | Após 5min → "⏰ Ainda precisa do boleto?" | Se não responder, auto-encerra |

---

## 2. ESTRUTURA TÉCNICA

### 2.1 Nova Tabela: `automated_flows`

```typescript
// shared/schema.ts

export const automatedFlows = pgTable("automated_flows", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: varchar("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  
  // Tipo de fluxo automatizado
  flowType: varchar("flow_type").notNull(), 
  // Valores: "boleto_2via", "suporte_tecnico", "consulta_plano", etc.
  
  // Passo atual no fluxo
  currentStep: varchar("current_step").notNull(),
  // Valores: "waiting_cpf", "validating_cpf", "fetching_invoices", "completed", etc.
  
  // Dados do fluxo (JSON)
  metadata: jsonb("metadata").$type<{
    cpf?: string;
    cpfHash?: string; // Nunca armazenar CPF puro em produção
    invoiceIds?: string[];
    attempts?: number;
    errorReason?: string;
  }>(),
  
  // Timestamps
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  
  // Métricas
  duration: integer("duration"), // segundos
  success: boolean("success"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AutomatedFlow = typeof automatedFlows.$inferSelect;
export type InsertAutomatedFlow = typeof automatedFlows.$inferInsert;
```

### 2.2 Atualização na Tabela `conversations`

```typescript
// Adicionar campos para rastrear fluxo automatizado
export const conversations = pgTable("conversations", {
  // ... campos existentes ...
  
  // Novo campo: indica se está em fluxo automatizado
  isAutomatedFlow: boolean("is_automated_flow").default(false),
  
  // Novo campo: tipo de fluxo (null se não estiver em fluxo)
  automatedFlowType: varchar("automated_flow_type"),
  // Valores: "boleto_2via", "buttons_menu", null
});
```

### 2.3 Novo Worker: `automated-flow-processor`

```typescript
// server/workers/automated-flow-processor.ts

import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis';

// Queue para processar fluxos automatizados
export const automatedFlowQueue = new Queue('automated-flows', {
  connection: redis,
});

// Worker que processa os fluxos
export const automatedFlowWorker = new Worker(
  'automated-flows',
  async (job) => {
    const { type, conversationId, buttonId, chatId, userMessage } = job.data;
    
    switch (type) {
      case 'button_clicked':
        return await handleButtonClick(conversationId, buttonId, chatId);
      
      case 'user_message':
        return await handleUserMessage(conversationId, userMessage, chatId);
      
      case 'timeout_check':
        return await handleTimeout(conversationId);
      
      default:
        throw new Error(`Unknown flow type: ${type}`);
    }
  },
  { connection: redis, concurrency: 10 }
);

async function handleButtonClick(
  conversationId: string, 
  buttonId: string, 
  chatId: string
) {
  // Identifica qual botão foi clicado
  switch (buttonId) {
    case 'boleto_2via':
      return await startBoletoFlow(conversationId, chatId);
    
    case 'suporte':
      return await transferToAgent(conversationId, 'support');
    
    case 'comercial':
      return await routeToAI(conversationId, 'comercial');
    
    // ... outros botões
  }
}

async function startBoletoFlow(conversationId: string, chatId: string) {
  // 1. Criar registro de fluxo automatizado
  const flow = await db.insert(automatedFlows).values({
    conversationId,
    flowType: 'boleto_2via',
    currentStep: 'waiting_cpf',
    metadata: { attempts: 0 },
  }).returning();
  
  // 2. Atualizar conversa
  await db.update(conversations)
    .set({
      isAutomatedFlow: true,
      automatedFlowType: 'boleto_2via',
    })
    .where(eq(conversations.id, conversationId));
  
  // 3. Enviar mensagem solicitando CPF
  await sendWhatsAppMessage(
    chatId,
    "Por favor, informe seu CPF ou CNPJ para buscar seus boletos:"
  );
  
  // 4. Agendar timeout (5 minutos)
  await automatedFlowQueue.add(
    'timeout_check',
    { conversationId },
    { delay: 5 * 60 * 1000 } // 5 minutos
  );
  
  return { success: true, flowId: flow[0].id };
}

async function handleUserMessage(
  conversationId: string,
  userMessage: string,
  chatId: string
) {
  // Buscar fluxo ativo
  const flow = await db.query.automatedFlows.findFirst({
    where: and(
      eq(automatedFlows.conversationId, conversationId),
      isNull(automatedFlows.completedAt)
    ),
  });
  
  if (!flow) {
    // Não está em fluxo automatizado, processar normalmente
    return { success: false, reason: 'no_active_flow' };
  }
  
  // Processar baseado no passo atual
  switch (flow.currentStep) {
    case 'waiting_cpf':
      return await processCPF(flow, userMessage, chatId);
    
    case 'waiting_invoice_selection':
      return await processInvoiceSelection(flow, userMessage, chatId);
    
    default:
      throw new Error(`Unknown step: ${flow.currentStep}`);
  }
}

async function processCPF(
  flow: AutomatedFlow,
  cpf: string,
  chatId: string
) {
  // 1. Validar formato do CPF
  const cpfClean = cpf.replace(/\D/g, '');
  
  if (!isValidCPF(cpfClean)) {
    const attempts = (flow.metadata.attempts || 0) + 1;
    
    // Atualizar tentativas
    await db.update(automatedFlows)
      .set({
        metadata: { ...flow.metadata, attempts },
      })
      .where(eq(automatedFlows.id, flow.id));
    
    // Máximo 3 tentativas
    if (attempts >= 3) {
      await sendWhatsAppMessage(
        chatId,
        "⚠️ CPF inválido 3 vezes. Vou transferir você para um atendente."
      );
      
      await completeFlow(flow.id, false, 'max_attempts_exceeded');
      await transferToAgent(flow.conversationId, 'financial');
      return { success: false, reason: 'max_attempts' };
    }
    
    // Pedir novamente
    await sendWhatsAppMessage(
      chatId,
      `❌ CPF inválido. Por favor, digite novamente:\n\n(Tentativa ${attempts}/3)`
    );
    
    return { success: false, reason: 'invalid_cpf' };
  }
  
  // 2. CPF válido - buscar faturas no CRM
  await db.update(automatedFlows)
    .set({ currentStep: 'fetching_invoices' })
    .where(eq(automatedFlows.id, flow.id));
  
  try {
    const invoices = await crmAPI.getInvoicesByCPF(cpfClean);
    
    if (invoices.length === 0) {
      // Sem faturas
      await sendWhatsAppMessage(
        chatId,
        "ℹ️ Não encontrei faturas pendentes para este CPF.\n\n" +
        "Vou transferir você para um atendente que pode ajudar melhor."
      );
      
      await completeFlow(flow.id, false, 'no_invoices_found');
      await transferToAgent(flow.conversationId, 'financial', 
        `Cliente informou CPF: ${cpfClean.slice(0, 3)}***`);
      
      return { success: false, reason: 'no_invoices' };
    }
    
    // 3. Enviar todas as faturas
    for (const invoice of invoices) {
      // Enviar PDF
      await sendWhatsAppMedia(
        chatId,
        invoice.pdfBase64,
        'document',
        `📄 *Fatura - Vencimento: ${formatDate(invoice.dueDate)}*\n` +
        `💰 Valor: R$ ${formatCurrency(invoice.amount)}\n\n` +
        `*Código de Barras:*\n${invoice.barcode}\n\n` +
        `*PIX Copia e Cola:*\n${invoice.pixCode}\n\n` +
        `*Link de Pagamento:*\n${invoice.paymentLink}`,
        `Fatura_${invoice.dueDate.replace(/\//g, '_')}.pdf`
      );
      
      // Delay entre mensagens
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 4. Mensagem final
    await sendWhatsAppMessage(
      chatId,
      "✅ Todas as faturas foram enviadas!\n\n" +
      "Se precisar de ajuda, é só chamar."
    );
    
    // 5. Completar fluxo
    await completeFlow(flow.id, true);
    
    // 6. Resolver conversa
    await db.update(conversations)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: null, // Automático
        isAutomatedFlow: false,
        automatedFlowType: null,
      })
      .where(eq(conversations.id, flow.conversationId));
    
    // 7. Registrar métrica
    await logEvent({
      type: 'automated_flow_completed',
      flow: 'boleto_2via',
      conversationId: flow.conversationId,
      invoicesSent: invoices.length,
      success: true,
    });
    
    return { success: true, invoicesSent: invoices.length };
    
  } catch (error) {
    // Erro ao buscar no CRM
    await sendWhatsAppMessage(
      chatId,
      "⚠️ Ocorreu um erro ao buscar suas faturas.\n\n" +
      "Vou transferir você para um atendente."
    );
    
    await completeFlow(flow.id, false, error.message);
    await transferToAgent(flow.conversationId, 'financial',
      `Erro no CRM: ${error.message}`);
    
    return { success: false, reason: 'crm_error', error: error.message };
  }
}

async function completeFlow(
  flowId: string,
  success: boolean,
  errorReason?: string
) {
  const flow = await db.query.automatedFlows.findFirst({
    where: eq(automatedFlows.id, flowId),
  });
  
  const duration = Math.floor(
    (Date.now() - flow!.startedAt.getTime()) / 1000
  );
  
  await db.update(automatedFlows)
    .set({
      completedAt: new Date(),
      success,
      duration,
      currentStep: 'completed',
      metadata: {
        ...flow!.metadata,
        errorReason,
      },
    })
    .where(eq(automatedFlows.id, flowId));
}
```

### 2.4 Integração com Evolution API - Botões Interativos

```typescript
// server/lib/evolution-buttons.ts

interface ButtonOption {
  id: string;
  text: string;
}

interface InteractiveButtonsPayload {
  number: string;
  buttons: ButtonOption[];
  title: string;
  footer?: string;
  instance?: string;
}

export async function sendInteractiveButtons(
  payload: InteractiveButtonsPayload
): Promise<{ success: boolean; messageId?: string }> {
  
  const instance = payload.instance || 'Leads';
  const apiKey = process.env[`EVOLUTION_API_KEY_${instance.toUpperCase()}`];
  const baseUrl = process.env[`EVOLUTION_API_URL_${instance.toUpperCase()}`];
  
  try {
    const response = await fetch(
      `${baseUrl}/message/sendButtons/${instance}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify({
          number: payload.number,
          title: payload.title,
          description: "",
          footer: payload.footer || "TR Telecom",
          buttons: payload.buttons.map(btn => ({
            type: "reply",
            reply: {
              id: btn.id,
              title: btn.text,
            },
          })),
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      messageId: data?.key?.id,
    };
  } catch (error) {
    console.error('❌ Error sending interactive buttons:', error);
    return { success: false };
  }
}

// Exemplo de uso:
export async function sendMainMenu(chatId: string, instance: string) {
  const phoneNumber = extractNumberFromChatId(chatId);
  
  await sendInteractiveButtons({
    number: phoneNumber,
    title: "Olá! Como posso ajudar você hoje?",
    footer: "TR Telecom - Atendimento Rápido",
    buttons: [
      { id: "boleto_2via", text: "💰 2ª Via de Boleto" },
      { id: "suporte", text: "📱 Suporte Técnico" },
      { id: "comercial", text: "🛍️ Vendas/Upgrade" },
      { id: "ouvidoria", text: "📋 Ouvidoria" },
      { id: "cancelamento", text: "❌ Cancelamento" },
    ],
    instance,
  });
}
```

### 2.5 Webhook Handler - Detectar Clique em Botão

```typescript
// server/routes.ts - Webhook Evolution API

app.post('/webhook/evolution/:instance', async (req, res) => {
  const { event, data } = req.body;
  
  // Detectar resposta de botão
  if (
    event === 'messages.upsert' &&
    data.message?.buttonsResponseMessage
  ) {
    const buttonId = data.message.buttonsResponseMessage.selectedButtonId;
    const chatId = data.key.remoteJid;
    
    // Buscar conversa
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.chatId, `whatsapp_${chatId}`),
    });
    
    if (conversation) {
      // Enfileirar processamento do botão
      await automatedFlowQueue.add('button_clicked', {
        conversationId: conversation.id,
        buttonId,
        chatId: `whatsapp_${chatId}`,
      });
    }
    
    return res.json({ success: true });
  }
  
  // ... resto do webhook handler
});
```

### 2.6 Modificação no Worker Principal

```typescript
// server/workers.ts - Modificar message-processing worker

async function processMessage(job: Job) {
  const { conversationId, fromNumber } = job.data;
  
  // 1. Buscar conversa
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });
  
  // 2. NOVO: Verificar se está em fluxo automatizado
  if (conversation.isAutomatedFlow) {
    // Delegar para worker de fluxos automatizados
    await automatedFlowQueue.add('user_message', {
      conversationId,
      userMessage: job.data.messageContent,
      chatId: conversation.chatId,
    });
    
    // NÃO processar com IA
    return { success: true, delegated: true };
  }
  
  // 3. Verificar se é primeira mensagem
  const messageCount = await db.$count(
    messages,
    eq(messages.conversationId, conversationId)
  );
  
  if (messageCount === 1) {
    // Primeira mensagem - enviar menu de botões
    await sendMainMenu(conversation.chatId, conversation.evolutionInstance);
    
    // Marcar conversa como aguardando botão
    await db.update(conversations)
      .set({ 
        isAutomatedFlow: true,
        automatedFlowType: 'buttons_menu',
      })
      .where(eq(conversations.id, conversationId));
    
    return { success: true, sentButtonMenu: true };
  }
  
  // 4. Processar normalmente com IA (se não for fluxo automatizado)
  // ... código existente ...
}
```

---

## 3. MÉTRICAS E MONITORAMENTO

### 3.1 Dashboard - Nova Seção

```
┌─────────────────────────────────────────────┐
│  FLUXOS AUTOMATIZADOS (ÚLTIMAS 24H)        │
├─────────────────────────────────────────────┤
│  💰 2ª Via de Boleto                        │
│     ✅ Sucesso: 284 (95%)                   │
│     ❌ Falhou: 16 (5%)                       │
│     ⏱️  Tempo médio: 18s                     │
│     💸 Economia: R$ 847,20                   │
├─────────────────────────────────────────────┤
│  📱 Suporte Técnico (botão)                 │
│     ↪️  Transferidos: 42                     │
│     ⏱️  Tempo até transferência: 8s          │
└─────────────────────────────────────────────┘
```

### 3.2 Query para Métricas

```typescript
// server/routes.ts - GET /api/dashboard/automated-flows

app.get('/api/dashboard/automated-flows', async (req, res) => {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const stats = await db
    .select({
      flowType: automatedFlows.flowType,
      total: count(),
      successful: sum(
        sql`CASE WHEN ${automatedFlows.success} = true THEN 1 ELSE 0 END`
      ),
      avgDuration: avg(automatedFlows.duration),
    })
    .from(automatedFlows)
    .where(gte(automatedFlows.startedAt, last24h))
    .groupBy(automatedFlows.flowType);
  
  return res.json(stats);
});
```

---

## 4. TESTES E VALIDAÇÃO

### 4.1 Casos de Teste

| ID | Cenário | Entrada | Resultado Esperado |
|----|---------|---------|-------------------|
| T1 | CPF válido com 1 fatura | "12345678900" | Envia 1 PDF + PIX + resolve |
| T2 | CPF válido com 3 faturas | "12345678900" | Envia 3 PDFs + resolve |
| T3 | CPF inválido (1ª vez) | "123" | "CPF inválido, tente novamente" |
| T4 | CPF inválido (3x) | "123", "456", "789" | Transfere para humano |
| T5 | CPF sem faturas | "99999999999" | "Não encontrei faturas" + transfere |
| T6 | Erro no CRM | CPF válido + CRM offline | "Erro ao buscar" + transfere |
| T7 | Cliente não responde | Timeout 5min | "Ainda precisa?" |
| T8 | Cliente não responde (2x) | Timeout 10min | Auto-encerra |

### 4.2 Script de Teste

```bash
# Simular clique no botão de boleto
curl -X POST http://localhost:5000/webhook/evolution/Leads \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "data": {
      "key": {
        "remoteJid": "5524992727634@s.whatsapp.net",
        "id": "test123"
      },
      "message": {
        "buttonsResponseMessage": {
          "selectedButtonId": "boleto_2via"
        }
      }
    }
  }'

# Simular envio de CPF
curl -X POST http://localhost:5000/webhook/evolution/Leads \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "data": {
      "key": {
        "remoteJid": "5524992727634@s.whatsapp.net",
        "id": "test124"
      },
      "message": {
        "conversation": "12345678900"
      }
    }
  }'
```

---

## 5. ROADMAP DE IMPLEMENTAÇÃO

### Fase 1: Infraestrutura Base (2 dias)

**Objetivos:**
- ✅ Criar tabela `automated_flows`
- ✅ Criar worker `automated-flow-processor`
- ✅ Implementar funções de botões interativos
- ✅ Modificar webhook handler para detectar cliques

**Critérios de Sucesso:**
- Sistema detecta quando botão é clicado
- Cria registro de fluxo automatizado no banco
- Logs mostram processamento correto

### Fase 2: Fluxo de Boleto (2 dias)

**Objetivos:**
- ✅ Implementar validação de CPF
- ✅ Integrar com CRM para buscar faturas
- ✅ Enviar PDFs + PIX + código de barras
- ✅ Tratar erros e casos extremos

**Critérios de Sucesso:**
- Cliente consegue receber boleto sem intervenção
- Taxa de sucesso > 90%
- Tempo médio < 30 segundos

### Fase 3: Outros Botões (1 dia)

**Objetivos:**
- ✅ Implementar "Suporte Técnico" (transferência direta)
- ✅ Implementar "Comercial" (roteamento para IA)
- ✅ Implementar "Ouvidoria" (transferência direta)

**Critérios de Sucesso:**
- Todos os botões funcionam corretamente
- Roteamento para IA preserva contexto

### Fase 4: Métricas e Dashboard (1 dia)

**Objetivos:**
- ✅ Criar seção no dashboard para fluxos automatizados
- ✅ Implementar cálculo de economia de tokens
- ✅ Gráficos de taxa de sucesso

**Critérios de Sucesso:**
- Dashboard mostra métricas em tempo real
- Cálculo de ROI disponível

### Fase 5: Testes e Ajustes (1 dia)

**Objetivos:**
- ✅ Executar todos os casos de teste
- ✅ Ajustar mensagens baseado em feedback
- ✅ Otimizar performance

**Critérios de Sucesso:**
- Todos os testes passam
- Feedback positivo dos usuários de teste

---

## 6. CONFIGURAÇÕES E VARIÁVEIS

### 6.1 Variáveis de Ambiente

```bash
# .env
ENABLE_AUTOMATED_FLOWS=true
AUTOMATED_FLOW_TIMEOUT_MINUTES=5
MAX_CPF_ATTEMPTS=3
AUTOMATED_FLOW_CONCURRENCY=10
```

### 6.2 Configuração de Botões

```typescript
// config/buttons.ts

export const BUTTON_CONFIGS = {
  mainMenu: {
    title: "Olá! Como posso ajudar você hoje?",
    footer: "TR Telecom - Atendimento Rápido",
    buttons: [
      { id: "boleto_2via", text: "💰 2ª Via de Boleto", flow: "automated" },
      { id: "suporte", text: "📱 Suporte Técnico", flow: "transfer_direct" },
      { id: "comercial", text: "🛍️ Vendas", flow: "ai_routing" },
      { id: "ouvidoria", text: "📋 Ouvidoria", flow: "transfer_direct" },
      { id: "cancelamento", text: "❌ Cancelamento", flow: "transfer_direct" },
    ],
  },
};
```

---

## 7. SEGURANÇA E COMPLIANCE

### 7.1 Proteção de Dados (LGPD)

- ✅ **CPF nunca armazenado em texto puro**: Usar hash SHA-256
- ✅ **Logs anonimizados**: CPF mostrado como `123***`
- ✅ **Auditoria completa**: Registrar quem acessou qual CPF
- ✅ **Retenção limitada**: Deletar dados após 30 dias

```typescript
// Exemplo de hash de CPF
import crypto from 'crypto';

function hashCPF(cpf: string): string {
  return crypto.createHash('sha256')
    .update(cpf + process.env.CPF_SALT)
    .digest('hex');
}
```

### 7.2 Rate Limiting

```typescript
// Limite de requisições por CPF
const cpfRateLimiter = new Map<string, number>();

async function checkCPFRateLimit(cpf: string): Promise<boolean> {
  const hash = hashCPF(cpf);
  const count = cpfRateLimiter.get(hash) || 0;
  
  if (count > 10) {
    // Mais de 10 consultas em 1 hora
    return false;
  }
  
  cpfRateLimiter.set(hash, count + 1);
  
  // Limpar após 1 hora
  setTimeout(() => cpfRateLimiter.delete(hash), 60 * 60 * 1000);
  
  return true;
}
```

---

## 8. PERGUNTAS FREQUENTES (FAQ)

### P1: E se o CRM estiver offline?

**R:** O sistema detecta erro e transfere para atendente humano com mensagem clara.

### P2: Cliente pode pular os botões e escrever direto?

**R:** Sim! Se escrever diretamente (ex: "quero boleto"), a IA processa normalmente. Botões são apenas atalho.

### P3: Botões funcionam em grupos do WhatsApp?

**R:** Não. Botões só funcionam em conversas 1-1. Em grupos, mantemos IA tradicional.

### P4: Quanto economiza em tokens?

**R:** Cada boleto automatizado economiza ~1500 tokens (~R$ 0,30). Com 1000 boletos/mês = **R$ 300/mês**.

### P5: E se Evolution API não suportar botões?

**R:** Usamos fallback: enviar mensagem de texto com opções numeradas (1, 2, 3...).

---

## 9. REFERÊNCIAS TÉCNICAS

- [WhatsApp Business API - Interactive Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#interactive-messages)
- [Evolution API - Documentação de Botões](https://doc.evolution-api.com/v2/pt/features/buttons)
- [BullMQ - Queue Documentation](https://docs.bullmq.io/)
- [Drizzle ORM - Schema Design](https://orm.drizzle.team/docs/overview)

---

## 10. CONTATO E SUPORTE

Para dúvidas sobre implementação:
- **Documentação Técnica**: Este arquivo
- **Slack**: #dev-whatsapp-automation
- **Email**: dev@trtelecom.net

---

**Última Atualização:** 18/11/2025  
**Versão:** 1.0.0  
**Status:** 📝 Documentação Completa - Pronto para Implementação
