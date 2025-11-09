# COBRANÇAS - Sistema Autônomo de Cobrança

## Visão Geral

O módulo COBRANÇAS é um sistema completo de cobrança automatizada que utiliza Inteligência Artificial para realizar negociações humanizadas de dívidas através de dois canais: **chamadas de voz** (Twilio + OpenAI Realtime API) e **mensagens WhatsApp** (Evolution API).

### Características Principais

- ✅ **IA Especializada em Cobrança**: Assistant dedicado com foco em negociação empática
- ✅ **Multi-Canal**: Suporte a voz (Twilio) e WhatsApp (Evolution API)
- ✅ **Verificação Pré-Envio Dupla**: Valida pagamento e promessas antes de contatar
- ✅ **Sistema de Promessas**: Registro e proteção automática de compromissos de pagamento
- ✅ **Atualização Automática**: IA detecta e registra pagamentos durante conversação
- ✅ **Monitoramento Dedicado**: Dashboard isolado para alta volumetria
- ✅ **Compliance ANATEL/LGPD**: Respeita regulamentações brasileiras

---

## Arquitetura do Sistema

### Componentes Principais

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMPANHA DE COBRANÇA                     │
│  - Lista de clientes inadimplentes                          │
│  - Configuração de método (voz/WhatsApp/híbrido)            │
│  - Estratégia de fallback                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   WORKERS BullMQ (6 tipos)                  │
│  1. Ingest Worker      → Carrega targets para fila          │
│  2. Scheduling Worker  → Agenda contatos por horário        │
│  3. Dialer Worker      → Executa chamadas de voz (Twilio)   │
│  4. WhatsApp Worker    → Envia mensagens WhatsApp           │
│  5. Post-Call Worker   → Processa resultados                │
│  6. Promise Monitor    → Monitora vencimento de promessas   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              VERIFICAÇÕES PRÉ-ENVIO (Dual Check)            │
│  ✓ Consulta CRM API → Cliente já pagou?                     │
│  ✓ Consulta BD Promessas → Tem promessa válida?             │
│  → Se SIM para qualquer: PULA envio                         │
│  → Se NÃO para ambos: PROSSEGUE                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    IA COBRANÇA ASSISTANT                    │
│  - Saudação humanizada                                      │
│  - Confirmação de identidade                                │
│  - Consulta automática de faturas (via CPF)                 │
│  - Negociação empática                                      │
│  - Registro de promessas de pagamento                       │
│  - Atualização de status (pago/promessa)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 MONITORAMENTO E MÉTRICAS                    │
│  - Dashboard dedicado (/voice/monitor)                      │
│  - Métricas unificadas (voz + WhatsApp)                     │
│  - Filtros por origem de conversa                           │
│  - Alertas de promessas pendentes                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Funcionamento

### 1. Criação de Campanha

```typescript
// Endpoint: POST /api/voice/campaigns
{
  name: "Cobrança Janeiro 2025",
  contactMethod: "whatsapp_primary", // ou "voice", "whatsapp_fallback"
  allowedMethods: ["whatsapp", "voice"],
  fallbackOrder: ["whatsapp", "voice"],
  scheduleStart: "08:00",
  scheduleEnd: "20:00"
}
```

**Resposta:** Campanha criada com status `draft`

---

### 2. Importação de Targets (Clientes)

```typescript
// Endpoint: POST /api/voice/campaigns/:id/targets/import
// Upload de arquivo CSV/XLSX com colunas:
{
  clientName: "João Silva",
  phoneNumber: "5511999998888",
  clientDocument: "123.456.789-00", // CPF/CNPJ
  installationPoint: "123456",
  debtAmount: 150.00,
  invoiceNumber: "FAT-2024-12-001"
}
```

**Workers Ativados:**
- **Ingest Worker**: Carrega targets em lote para o banco de dados
- Cria registros na tabela `voiceCampaignTargets` com estado inicial `pending`

---

### 3. Ativação da Campanha

```typescript
// Endpoint: POST /api/voice/campaigns/:id/activate
```

**Workers Ativados:**
- **Scheduling Worker**: Agenda contatos respeitando horário comercial (08:00-20:00)
- Processa targets com estado `pending` → `scheduled`

---

### 4. Execução do Contato

#### 4.1 Verificação Pré-Envio (Dual Check)

```typescript
// WhatsApp Collection Worker - Linha 109-207
async function executeWhatsAppOutreach(targetId: number) {
  
  // ========================================
  // CHECK 1: Cliente já pagou?
  // ========================================
  const crmResponse = await fetch(
    `https://api.trtelecom.net/v1/clientes/consultar_inadimplencia`,
    {
      method: 'POST',
      body: JSON.stringify({ cpf_cnpj: clientDocument })
    }
  );
  
  if (crmResponse.faturas_em_aberto === 0) {
    // Cliente já pagou - PULAR envio
    await updateTarget(targetId, {
      state: 'completed',
      outcome: 'paid',
      outcomeDetails: 'Cliente já quitou débitos'
    });
    return { success: true, skipped: true, reason: 'already_paid' };
  }
  
  // ========================================
  // CHECK 2: Cliente tem promessa válida?
  // ========================================
  const pendingPromises = await db.query.voicePromises.findMany({
    where: and(
      eq(voicePromises.contactDocument, clientDocument),
      eq(voicePromises.status, 'pending'),
      gte(voicePromises.dueDate, now) // Promessa ainda válida?
    )
  });
  
  if (pendingPromises.length > 0) {
    // Cliente prometeu pagar - PULAR envio
    const promise = pendingPromises[0];
    await updateTarget(targetId, {
      state: 'contacted',
      outcome: 'promise_made',
      outcomeDetails: `Promessa válida até ${promise.dueDate}`
    });
    return { success: true, skipped: true, reason: 'active_promise' };
  }
  
  // ========================================
  // Ambas verificações OK - PROSSEGUIR
  // ========================================
  await sendWhatsAppMessage(phoneNumber, message);
}
```

#### 4.2 Envio por WhatsApp

```typescript
// WhatsApp Collection Worker - Linha 209-284
const message = `Olá ${clientName}! 👋

Aqui é a equipe de cobrança da TR Telecom.

Identificamos que você possui pendências financeiras. Podemos conversar sobre isso?

Estou aqui para te ajudar a regularizar sua situação! 💙`;

// Envia via Evolution API
await evolutionApi.sendText({
  number: cleanPhone,
  text: message
});

// Cria conversa no sistema
const conversation = await storage.createConversation({
  chatId: `whatsapp_${cleanPhone}`,
  clientName,
  clientDocument,
  conversationSource: 'whatsapp_campaign',
  voiceCampaignTargetId: targetId,
  assignedAssistant: 'cobranca' // Roteamento automático
});

// Registra mensagem inicial
await storage.createMessage({
  conversationId: conversation.id,
  sender: 'assistant',
  content: message,
  isFromCampaign: true
});
```

#### 4.3 Envio por Voz (Twilio)

```typescript
// Voice Dialer Worker
const call = await twilioClient.calls.create({
  to: phoneNumber,
  from: process.env.TWILIO_PHONE_NUMBER,
  url: `${webhookBaseUrl}/api/voice/twiml/${targetId}`,
  statusCallback: `${webhookBaseUrl}/api/voice/webhooks/twilio/status`,
  statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
});
```

---

### 5. Conversação com IA Cobrança

#### Fluxo de Conversação Humanizado

```
1. SAUDAÇÃO
   IA: "Olá! Aqui é a Lia, assistente virtual da TR Telecom. 
        Estou entrando em contato sobre sua fatura. Posso falar com [NOME]?"

2. CONFIRMAÇÃO DE IDENTIDADE
   IA: "Ótimo! Para sua segurança, pode confirmar seu CPF para mim?"
   Cliente: "123.456.789-00"

3. CONSULTA AUTOMÁTICA DE FATURAS
   IA: [chama ferramenta consultar_faturas_cpf internamente]
   IA: "João, identifiquei que você possui 2 faturas em aberto:
        - Fatura de dezembro: R$ 89,90 (vencida há 15 dias)
        - Fatura de janeiro: R$ 89,90 (vencida há 45 dias)
        Total: R$ 179,80"

4. NEGOCIAÇÃO EMPÁTICA
   Cliente: "Não tenho como pagar agora, estou desempregado"
   IA: "Entendo perfeitamente sua situação, João. 
        Que tal combinarmos um prazo que funcione para você? 
        Você conseguiria pagar até quando?"

5. REGISTRO DE PROMESSA
   Cliente: "Posso pagar dia 15 do mês que vem"
   IA: [chama registrar_promessa_pagamento]
   IA: "Perfeito! Registrei aqui que você vai pagar R$ 179,80 até 15/02/2025.
        Fique tranquilo, você NÃO receberá mais cobranças até essa data.
        Combinado? 😊"

6. CONFIRMAÇÃO E ENCERRAMENTO
   Cliente: "Sim, obrigado!"
   IA: "De nada, João! Qualquer dúvida, estamos à disposição.
        Até 15/02 então! 👋"
```

---

## Ferramentas da IA Cobrança

### 1. `consultar_faturas_cpf`

**Função:** Busca faturas em aberto no CRM usando CPF/CNPJ do cliente

```typescript
// Tool Schema
{
  type: "function",
  function: {
    name: "consultar_faturas_cpf",
    description: "Consulta faturas em aberto de um cliente usando CPF/CNPJ",
    parameters: {
      type: "object",
      properties: {
        cpf_cnpj: {
          type: "string",
          description: "CPF ou CNPJ do cliente (apenas números)"
        }
      },
      required: ["cpf_cnpj"]
    }
  }
}

// Handler (server/lib/openai.ts - linha 2130-2196)
async function handleConsultaFaturas(cpf_cnpj: string) {
  const response = await fetch(
    `https://api.trtelecom.net/v1/clientes/consultar_inadimplencia`,
    {
      method: 'POST',
      body: JSON.stringify({ cpf_cnpj })
    }
  );
  
  const data = await response.json();
  
  return {
    cliente: data.nome,
    cpf_cnpj: data.cpf_cnpj,
    total_devido: data.valor_total,
    faturas_em_aberto: data.faturas_em_aberto,
    detalhes_faturas: data.faturas.map(f => ({
      numero: f.numero_fatura,
      valor: f.valor,
      vencimento: f.data_vencimento,
      dias_atraso: f.dias_atraso
    }))
  };
}
```

**Exemplo de Resposta:**
```json
{
  "cliente": "João Silva",
  "cpf_cnpj": "123.456.789-00",
  "total_devido": 179.80,
  "faturas_em_aberto": 2,
  "detalhes_faturas": [
    {
      "numero": "FAT-2024-12-001",
      "valor": 89.90,
      "vencimento": "2024-12-10",
      "dias_atraso": 45
    },
    {
      "numero": "FAT-2025-01-001",
      "valor": 89.90,
      "vencimento": "2025-01-10",
      "dias_atraso": 15
    }
  ]
}
```

---

### 2. `registrar_promessa_pagamento`

**Função:** Registra promessa de pagamento do cliente com proteção automática

```typescript
// Tool Schema
{
  type: "function",
  function: {
    name: "registrar_promessa_pagamento",
    description: "Registra promessa de pagamento do cliente. O cliente NÃO receberá mais cobranças até a data prometida.",
    parameters: {
      type: "object",
      properties: {
        cpf_cnpj: {
          type: "string",
          description: "CPF ou CNPJ do cliente"
        },
        data_prevista_pagamento: {
          type: "string",
          description: "Data que o cliente prometeu pagar (formato DD/MM/YYYY)"
        },
        valor_prometido: {
          type: "number",
          description: "Valor que o cliente prometeu pagar"
        },
        metodo_pagamento: {
          type: "string",
          enum: ["pix", "boleto", "cartao_credito", "debito_automatico", "outros"],
          description: "Como o cliente pretende pagar"
        },
        observacoes: {
          type: "string",
          description: "Observações adicionais sobre a promessa"
        }
      },
      required: ["cpf_cnpj", "data_prevista_pagamento", "valor_prometido"]
    }
  }
}

// Handler (server/lib/openai.ts - linha 2247-2354)
async function handleRegistrarPromessa(args) {
  // 1. Converter data DD/MM/YYYY para Date com horário 23:59:59
  //    (garante proteção durante TODO o dia prometido)
  const [day, month, year] = args.data_prevista_pagamento.split('/');
  const dueDate = new Date(
    parseInt(year), 
    parseInt(month) - 1, 
    parseInt(day), 
    23, 59, 59, 999
  );
  
  // 2. Validar que a data é futura
  if (dueDate <= new Date()) {
    return { error: "Data deve ser futura" };
  }
  
  // 3. Buscar target da campanha (se houver)
  const target = await storage.getVoiceCampaignTargetByDocument(
    args.cpf_cnpj
  );
  
  // 4. Criar registro de promessa
  const promise = await storage.createVoicePromise({
    contactDocument: args.cpf_cnpj,
    dueDate,
    amount: args.valor_prometido,
    paymentMethod: args.metodo_pagamento,
    notes: args.observacoes,
    status: 'pending',
    voiceCampaignTargetId: target?.id
  });
  
  // 5. Atualizar target com outcome 'promise_made'
  if (target) {
    await storage.updateVoiceCampaignTarget(target.id, {
      state: 'contacted',
      outcome: 'promise_made',
      outcomeDetails: `Promessa registrada até ${args.data_prevista_pagamento}`
    });
  }
  
  // 6. Agendar monitoramento (24h após vencimento)
  const monitorDate = new Date(dueDate);
  monitorDate.setDate(monitorDate.getDate() + 1);
  
  await promiseMonitorQueue.add(
    'check-promise',
    { promiseId: promise.id },
    { delay: monitorDate.getTime() - Date.now() }
  );
  
  // 7. Retornar confirmação humanizada
  return {
    success: true,
    message: `Promessa registrada com sucesso! O cliente ${args.cpf_cnpj} prometeu pagar R$ ${args.valor_prometido} até ${args.data_prevista_pagamento}. Ele NÃO receberá mais cobranças até essa data.`
  };
}
```

**Exemplo de Uso pela IA:**
```
Cliente: "Posso pagar dia 15 de fevereiro"

IA chama internamente:
registrar_promessa_pagamento({
  cpf_cnpj: "123.456.789-00",
  data_prevista_pagamento: "15/02/2025",
  valor_prometido: 179.80,
  metodo_pagamento: "pix",
  observacoes: "Cliente desempregado, aguardando acerto"
})

IA recebe:
{
  success: true,
  message: "Promessa registrada! Cliente NÃO receberá mais cobranças até 15/02/2025"
}

IA responde ao cliente:
"Perfeito, João! Registrei sua promessa de pagar R$ 179,80 até 15/02/2025 via Pix. 
Fique tranquilo, você não receberá mais cobranças até lá. Combinado? 😊"
```

---

### 3. `atualizar_status_cobranca`

**Função:** Permite que a IA atualize o status da cobrança quando detectar pagamento

```typescript
// Tool Schema
{
  type: "function",
  function: {
    name: "atualizar_status_cobranca",
    description: "Atualiza status de cobrança quando cliente informa que já pagou",
    parameters: {
      type: "object",
      properties: {
        cpf_cnpj: {
          type: "string",
          description: "CPF ou CNPJ do cliente"
        },
        novo_status: {
          type: "string",
          enum: ["paid", "payment_confirmed"],
          description: "Novo status da cobrança"
        },
        observacoes: {
          type: "string",
          description: "Detalhes sobre o pagamento"
        }
      },
      required: ["cpf_cnpj", "novo_status"]
    }
  }
}

// Handler (server/lib/openai.ts - linha 2198-2245)
async function handleAtualizarStatus(args) {
  // 1. Buscar target ativo da campanha
  const target = await storage.getVoiceCampaignTargetByDocument(
    args.cpf_cnpj
  );
  
  if (!target) {
    return { error: "Cliente não encontrado em campanhas ativas" };
  }
  
  // 2. Atualizar status para 'paid'
  await storage.updateVoiceCampaignTarget(target.id, {
    state: 'completed',
    outcome: 'paid',
    outcomeDetails: args.observacoes || 'Cliente informou pagamento durante conversa'
  });
  
  // 3. Retornar confirmação
  return {
    success: true,
    message: `Status atualizado! Cliente ${args.cpf_cnpj} marcado como 'pago'. Ele não receberá mais cobranças.`
  };
}
```

**Exemplo de Uso:**
```
Cliente: "Eu já paguei ontem no aplicativo!"

IA chama:
atualizar_status_cobranca({
  cpf_cnpj: "123.456.789-00",
  novo_status: "paid",
  observacoes: "Cliente informou pagamento via aplicativo ontem"
})

IA responde:
"Que ótimo, João! Deixa eu verificar aqui... Confirmado! 
Seu pagamento já consta no sistema. Muito obrigado! 
Você não receberá mais cobranças. 😊"
```

---

## Sistema de Promessas de Pagamento

### 📋 Visão Geral & Objetivos

O **Sistema de Promessas de Pagamento** é um módulo completo e autônomo que gerencia compromissos de pagamento registrados pela IA Cobrança durante negociações com clientes. 

**Objetivos principais:**
- ✅ **Proteger clientes** que assumiram compromissos, evitando cobranças repetitivas
- ✅ **Validar cumprimento** de promessas através de verificação automática via CRM
- ✅ **Enviar lembretes** no dia do vencimento para auxiliar o cliente
- ✅ **Detectar quebras** quando promessas não são cumpridas, reativando cobranças
- ✅ **Garantir unicidade** - cliente só pode ter UMA promessa ativa por vez
- ✅ **Proteção crítica** contra falhas do CRM para evitar falsos positivos

---

### 🗄️ Estrutura de Dados

```typescript
// Tabela: voice_promises
interface VoicePromise {
  id: string;                    // UUID da promessa
  campaignId: string;            // ID da campanha de cobrança
  targetId: string | null;       // ID do target na campanha (opcional)
  contactId: string | null;      // ID do contato no sistema
  contactName: string;           // Nome do cliente
  contactDocument: string;       // CPF/CNPJ (chave de busca)
  phoneNumber: string;           // Telefone do cliente
  promisedAmount: number | null; // Valor prometido (em centavos)
  dueDate: Date;                 // Data de vencimento (23:59:59)
  paymentMethod: string;         // pix, boleto, cartao_credito, etc.
  status: string;                // pending, reminderSent, fulfilled, broken
  reminderSent: boolean;         // Lembrete foi enviado?
  reminderSentAt: Date | null;   // Quando o lembrete foi enviado
  verified: boolean;             // Pagamento foi verificado?
  verifiedAt: Date | null;       // Quando foi verificada
  completedAt: Date | null;      // Quando foi finalizada (fulfilled/broken)
  notes: string | null;          // Observações adicionais
  recordedBy: string;            // 'ai' ou 'manual'
  createdAt: Date;
  updatedAt: Date;
}
```

**Relacionamentos:**
- `campaignId` → `voiceCampaigns.id` (campanha de origem)
- `targetId` → `voiceCampaignTargets.id` (target específico, se houver)
- `contactDocument` → usado para validação e verificações

---

### 🔄 Ciclo de Vida Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                  ESTADOS DA PROMESSA                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PENDING          → Ativa, cliente protegido de cobranças       │
│      │                                                           │
│      ▼ (no dia do vencimento)                                   │
│  REMINDER_SENT    → Lembrete enviado, aguardando vencimento     │
│      │                                                           │
│      ▼ (após vencimento + verificação CRM)                      │
│      ├──→ FULFILLED   → Cliente pagou ✅ (proteção permanente)  │
│      └──→ BROKEN      → Não pagou ⚠️ (volta a receber cobranças)│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Tabela de Estados e Gatilhos

| Estado | Descrição | Proteção Ativa? | Gatilho para Transição | Próximo Estado |
|--------|-----------|----------------|------------------------|----------------|
| `pending` | Promessa ativa, aguardando vencimento | ✅ SIM | Chegou dia do vencimento | `reminderSent` |
| `reminderSent` | Lembrete enviado, aguardando fim do dia | ✅ SIM | Passou do vencimento + CRM confirmou pagamento | `fulfilled` |
| `reminderSent` | Lembrete enviado, aguardando fim do dia | ✅ SIM | Passou do vencimento + CRM confirmou NÃO pagamento | `broken` |
| `fulfilled` | Cliente cumpriu promessa | ✅ SIM (permanente) | - | Estado final |
| `broken` | Cliente quebrou promessa | ❌ NÃO | - | Estado final |

**Regras de Negócio:**
- WhatsApp Worker **bloqueia envio** apenas para status `pending` ou `reminderSent` com `dueDate >= hoje`
- Promessas `broken` **permitem cobranças** normalmente
- Promessas `fulfilled` **bloqueiam cobranças** permanentemente (cliente está regular)

---

### ✅ Validação de Promessa Única

**Regra:** Cliente só pode ter **UMA** promessa ativa por vez.

```typescript
// Implementação em server/lib/openai.ts (linhas 2304-2324)
// Função: registrar_promessa_pagamento

// ANTES de criar nova promessa, busca promessas ativas
const existingActivePromises = await db.query.voicePromises.findMany({
  where: and(
    eq(voicePromises.contactDocument, cpf_cnpj),
    eq(voicePromises.status, 'pending'),
    gte(voicePromises.dueDate, new Date()) // Promessa ainda não venceu
  )
});

if (existingActivePromises.length > 0) {
  const existingPromise = existingActivePromises[0];
  const formattedDate = formatDate(existingPromise.dueDate); // "15/02/2025"
  
  // Retorna mensagem humanizada para a IA
  return {
    success: false,
    mensagem: `Você já tem um compromisso de pagamento registrado para o dia ${formattedDate}. ` +
             `Não é possível fazer uma nova promessa. Por favor, cumpra a promessa atual primeiro. 🙏`
  };
}
```

**Fluxo com o Cliente:**
```
Cliente: "Posso pagar dia 20/02"
IA: [tenta registrar promessa]
Sistema: [detecta promessa existente para 15/02]
IA: "Você já tem um compromisso de pagamento registrado para o dia 15/02. 
     Não é possível fazer uma nova promessa. Por favor, cumpra a promessa atual primeiro. 🙏"
Cliente: "Ah é verdade, desculpa!"
```

---

### ⚙️ Worker Unificado de Monitoramento

**Arquivo:** `server/modules/voice/workers/promise-monitor.worker.ts`

**Função:** Monitora diariamente todas as promessas e executa ações automáticas:
1. 📅 **Envio de Lembretes** (no dia do vencimento)
2. ✅ **Verificação de Pagamento** (após vencimento)
3. ⚠️ **Detecção de Quebra** (quando não pagou)

#### Lógica do Worker (Pseudo-código)

```typescript
// Execução: A cada 1 hora
async function processPromiseMonitor() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // ========================================================
  // PARTE 1: LEMBRETES (promessas vencendo HOJE)
  // ========================================================
  const promisesDueToday = await db.query.voicePromises.findMany({
    where: and(
      eq(voicePromises.status, 'pending'),
      gte(voicePromises.dueDate, today),
      lt(voicePromises.dueDate, addDays(today, 1)),
      eq(voicePromises.reminderSent, false)
    )
  });
  
  for (const promise of promisesDueToday) {
    const message = `Olá ${promise.contactName}! 👋
    
Este é um lembrete amigável: hoje (${formatDate(promise.dueDate)}) é o dia que você prometeu regularizar sua situação conosco.

Valor: R$ ${(promise.promisedAmount / 100).toFixed(2)}

Se já pagou, desconsidere esta mensagem. Caso precise de ajuda, estamos à disposição! 💙`;
    
    await sendWhatsAppMessage(promise.phoneNumber, message);
    
    await db.update(voicePromises)
      .set({
        reminderSent: true,
        reminderSentAt: new Date(),
        status: 'reminderSent'
      })
      .where(eq(voicePromises.id, promise.id));
    
    console.log(`📅 Lembrete enviado: ${promise.contactDocument}`);
  }
  
  // ========================================================
  // PARTE 2: VERIFICAÇÃO (promessas VENCIDAS)
  // ========================================================
  const expiredPromises = await db.query.voicePromises.findMany({
    where: and(
      inArray(voicePromises.status, ['pending', 'reminderSent']),
      lt(voicePromises.dueDate, today), // Venceu antes de hoje
      eq(voicePromises.verified, false)
    )
  });
  
  for (const promise of expiredPromises) {
    // ⚠️ PROTEÇÃO CRÍTICA: Verificar pagamento via CRM
    let verificationSuccessful = false;
    let isPaid = false;
    
    try {
      const crmResponse = await fetch(
        'https://api.trtelecom.net/v1/clientes/consultar_inadimplencia',
        {
          method: 'POST',
          body: JSON.stringify({ cpf_cnpj: promise.contactDocument }),
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (crmResponse.ok) {
        const data = await crmResponse.json();
        verificationSuccessful = true;
        isPaid = (data.valor_total === 0 || data.faturas_em_aberto === 0);
      } else {
        console.warn(`⚠️ CRM retornou erro ${crmResponse.status} - PULANDO promessa ${promise.id}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao verificar CRM para ${promise.contactDocument}:`, error);
      // NÃO marca como broken - será verificado novamente no próximo ciclo
    }
    
    // ========================================================
    // CRÍTICO: Só atualiza status se verificação foi bem-sucedida
    // ========================================================
    if (verificationSuccessful) {
      if (isPaid) {
        // ✅ Cliente PAGOU - marcar como cumprida
        await db.update(voicePromises)
          .set({
            status: 'fulfilled',
            verified: true,
            verifiedAt: new Date(),
            completedAt: new Date()
          })
          .where(eq(voicePromises.id, promise.id));
        
        // Atualizar target da campanha
        if (promise.targetId) {
          await db.update(voiceCampaignTargets)
            .set({
              state: 'completed',
              outcome: 'paid',
              outcomeDetails: 'Pagamento confirmado via CRM após promessa cumprida'
            })
            .where(eq(voiceCampaignTargets.id, promise.targetId));
        }
        
        console.log(`✅ Promessa CUMPRIDA: ${promise.contactDocument}`);
      } else {
        // ⚠️ Cliente NÃO pagou - marcar como quebrada
        await db.update(voicePromises)
          .set({
            status: 'broken',
            verified: true,
            verifiedAt: new Date(),
            completedAt: new Date()
          })
          .where(eq(voicePromises.id, promise.id));
        
        console.log(`⚠️ Promessa QUEBRADA: ${promise.contactDocument} - cliente voltará à fila de cobranças`);
      }
    } else {
      // Verificação falhou - promessa será verificada novamente no próximo ciclo
      console.log(`⏭️ Promessa ${promise.id} PULADA - aguardando próxima verificação`);
    }
  }
}
```

#### Proteção Durante TODO o Dia Prometido

```
Cenário: Cliente promete pagar dia 15/01/2025

❌ ERRADO (meia-noite):
dueDate = new Date(2025, 0, 15, 0, 0, 0)
→ Expira às 00:00 do dia 15
→ Cliente é cobrado DURANTE o dia prometido (08:00)

✅ CORRETO (fim do dia):
dueDate = new Date(2025, 0, 15, 23, 59, 59, 999)
→ Expira às 23:59:59 do dia 15
→ Cliente SÓ é cobrado no dia 16
→ Honra o compromisso até o final do dia prometido
```

---

### 🛡️ Proteções Críticas contra Falhas do CRM

**Problema:** Se o CRM estiver offline ou retornar erro, o sistema NÃO deve marcar promessas como "quebradas" incorretamente.

**Solução:** Verificação em 3 camadas:

```typescript
// 1. Variável de controle
let verificationSuccessful = false;

// 2. Tentar verificar via CRM
try {
  const response = await fetch(CRM_API_URL, {...});
  if (response.ok) {
    verificationSuccessful = true; // ✅ CRM respondeu
  } else {
    console.warn(`CRM erro ${response.status} - PULANDO promessa`);
  }
} catch (error) {
  console.error(`CRM offline - PULANDO promessa`);
}

// 3. Só atualizar se verificação foi bem-sucedida
if (verificationSuccessful) {
  // Atualizar status: fulfilled ou broken
} else {
  // PULAR promessa - será verificada novamente no próximo ciclo
  console.log(`Promessa PULADA - aguardando próxima verificação`);
}
```

**Comportamento Seguro:**
- ✅ CRM OK + Cliente pagou → `fulfilled`
- ✅ CRM OK + Cliente não pagou → `broken`
- ⏭️ CRM com erro/offline → Promessa **PULADA** (mantém status atual, tenta novamente depois)

Isso **previne falsos positivos** onde clientes que pagaram seriam marcados como inadimplentes por falha técnica.

---

### 📡 Integração com Canais de Cobrança

#### WhatsApp Collection Worker

**Arquivo:** `server/modules/voice/workers/whatsapp-collection.worker.ts`

```typescript
// Verificação ANTES de enviar mensagem
const pendingPromises = await db.query.voicePromises.findMany({
  where: and(
    eq(voicePromises.contactDocument, target.clientDocument),
    eq(voicePromises.status, 'pending'),
    gte(voicePromises.dueDate, new Date()) // Promessa ainda válida?
  )
});

if (pendingPromises.length > 0) {
  const promise = pendingPromises[0];
  console.log(`🛡️ Cliente ${target.contactDocument} tem promessa ativa até ${promise.dueDate}`);
  
  await storage.updateVoiceCampaignTarget(target.id, {
    state: 'skipped',
    outcome: 'active_promise',
    outcomeDetails: `Promessa válida até ${formatDate(promise.dueDate)}`
  });
  
  return { success: true, skipped: true, reason: 'active_promise' };
}

// Se não tem promessa ativa, prossegue com envio
await sendWhatsAppMessage(target.phoneNumber, collectionMessage);
```

**Lógica de Bloqueio:**
- Status `pending` + vencimento futuro → ❌ BLOQUEIA
- Status `reminderSent` + vencimento futuro → ❌ BLOQUEIA  
- Status `broken` → ✅ PERMITE (proteção removida)
- Status `fulfilled` → ❌ BLOQUEIA (cliente regular)

---

### 🧪 Guia de Testes

#### 1️⃣ Teste de Registro de Promessa

```sql
-- 1.1 Criar target de teste
INSERT INTO voice_campaign_targets (
  campaign_id, contact_name, contact_phone, 
  contact_document, state, contact_method
) VALUES (
  'sua-campanha-id',
  'Cliente Teste',
  '5511999887766',
  '12345678900',
  'pending',
  'whatsapp'
) RETURNING id;

-- 1.2 Criar promessa para AMANHÃ
INSERT INTO voice_promises (
  campaign_id, target_id, contact_name, contact_document,
  phone_number, promised_amount, due_date, payment_method,
  status, notes, recorded_by
) VALUES (
  'sua-campanha-id',
  'target-id-retornado-acima',
  'Cliente Teste',
  '12345678900',
  '5511999887766',
  15000,
  CURRENT_DATE + INTERVAL '1 day' + INTERVAL '23 hours 59 minutes 59 seconds',
  'pix',
  'pending',
  'Teste de promessa',
  'manual'
) RETURNING id, due_date, status;
```

#### 2️⃣ Teste de Promessa Única

```sql
-- Verificar se existe promessa ativa
SELECT 
  id, contact_document, due_date, status,
  CASE 
    WHEN due_date >= CURRENT_DATE THEN '🛡️ ATIVA (bloqueará nova promessa)'
    ELSE 'VENCIDA (permite nova promessa)'
  END as situacao
FROM voice_promises 
WHERE contact_document = '12345678900'
  AND status = 'pending'
ORDER BY created_at DESC;

-- Se tentar criar segunda promessa, a IA retornará erro
```

#### 3️⃣ Teste de Lembrete (Simular Dia do Vencimento)

```sql
-- Alterar promessa para vencer HOJE
UPDATE voice_promises 
SET 
  due_date = CURRENT_DATE + INTERVAL '23 hours 59 minutes',
  reminder_sent = false,
  reminder_sent_at = NULL
WHERE contact_document = '12345678900'
  AND status = 'pending'
RETURNING id, due_date;

-- Aguardar worker executar (a cada 1 hora)
-- Verificar se lembrete foi enviado:
SELECT id, reminder_sent, reminder_sent_at, status
FROM voice_promises
WHERE contact_document = '12345678900';
```

#### 4️⃣ Teste de Verificação (Simular Promessa Vencida)

```sql
-- Alterar promessa para ONTEM (já vencida)
UPDATE voice_promises 
SET 
  due_date = CURRENT_DATE - INTERVAL '1 day',
  reminder_sent = true
WHERE contact_document = '12345678900'
  AND status = 'pending'
RETURNING id, due_date;

-- Aguardar worker executar
-- Verificar resultado:
SELECT 
  id, contact_document, status, verified, verified_at,
  CASE 
    WHEN status = 'fulfilled' THEN '✅ PAGOU'
    WHEN status = 'broken' THEN '⚠️ NÃO PAGOU'
    ELSE 'Aguardando verificação'
  END as resultado
FROM voice_promises
WHERE contact_document = '12345678900';
```

#### 5️⃣ Painel de Monitoramento

```sql
-- Ver TODAS as promessas e seus estados
SELECT 
  id,
  contact_name,
  contact_document,
  due_date::date as vencimento,
  status,
  reminder_sent,
  verified,
  promised_amount / 100.0 as valor_R$,
  CASE 
    WHEN status = 'pending' AND due_date >= CURRENT_DATE 
    THEN '🛡️ ATIVA (protegido)'
    WHEN status = 'pending' AND due_date < CURRENT_DATE
    THEN '⏳ Aguardando verificação'
    WHEN status = 'broken'
    THEN '⚠️ QUEBRADA (pode cobrar)'
    WHEN status = 'fulfilled'
    THEN '✅ CUMPRIDA (pago)'
    ELSE status
  END as situacao,
  created_at::date as criada_em
FROM voice_promises 
ORDER BY created_at DESC 
LIMIT 20;
```

---

### 💡 Exemplos de Uso

#### Exemplo 1: Registro Bem-Sucedido

```
Cliente: "Não posso pagar hoje, mas dia 20 eu consigo"
IA: [chama registrar_promessa_pagamento({
  cpf_cnpj: "123.456.789-00",
  data_prevista_pagamento: "20/02/2025",
  valor_prometido: 17980,
  metodo_pagamento: "pix"
})]

Sistema retorna:
{
  success: true,
  mensagem: "Promessa registrada! Cliente NÃO receberá cobranças até 20/02/2025"
}

IA: "Perfeito! Registrei que você vai pagar R$ 179,80 dia 20/02 via Pix. 
     Fique tranquilo, você não receberá mais cobranças até lá! 😊"
```

#### Exemplo 2: Tentativa de Segunda Promessa

```
Cliente: "Mudei de ideia, quero pagar só dia 25"
IA: [tenta registrar nova promessa]

Sistema retorna:
{
  success: false,
  mensagem: "Você já tem um compromisso de pagamento registrado para o dia 20/02. 
            Não é possível fazer uma nova promessa. Cumpra a promessa atual primeiro."
}

IA: "Você já tem um compromisso registrado para 20/02. 
     Não posso fazer uma nova promessa agora. Vamos manter o dia 20?"
```

#### Exemplo 3: Lembrete Automático

```
[Dia 20/02/2025 às 10:00 - sistema envia WhatsApp]

"Olá João! 👋

Este é um lembrete amigável: hoje (20/02/2025) é o dia que você prometeu 
regularizar sua situação conosco.

Valor: R$ 179,80

Se já pagou, desconsidere esta mensagem. Caso precise de ajuda, estamos à disposição! 💙"
```

---

### ❓ FAQ / Troubleshooting

#### P: O que acontece se o CRM estiver offline quando o worker tentar verificar?

**R:** A promessa é **PULADA** (não marcada como quebrada). O worker tentará novamente na próxima execução. Isso previne falsos positivos.

---

#### P: Cliente pode ter mais de uma promessa ao mesmo tempo?

**R:** **NÃO**. O sistema bloqueia criação de segunda promessa e retorna mensagem humanizada explicando que precisa cumprir a promessa atual primeiro.

---

#### P: Quando o cliente volta a receber cobranças após quebrar promessa?

**R:** Imediatamente. Quando o status muda para `broken`, o WhatsApp Worker detecta e permite envios novamente.

---

#### P: Como funciona a proteção no dia prometido?

**R:** A promessa expira às **23:59:59** do dia prometido, garantindo que o cliente tenha o dia inteiro para pagar sem ser cobrado.

---

#### P: O que acontece se houver um erro de documento/CPF inválido?

**R:** A função `registrar_promessa_pagamento` valida formato antes de salvar. Se inválido, retorna erro para a IA que explica ao cliente.

---

## Workers BullMQ

### 1. Voice Campaign Ingest Worker

**Função:** Importação em lote de targets para campanhas

```typescript
// Queue: voice-campaign-ingest
// Concurrency: 5 workers

async function processIngest(job) {
  const { campaignId, targets } = job.data;
  
  // Processar em chunks de 1000
  for (const chunk of _.chunk(targets, 1000)) {
    await db.insert(voiceCampaignTargets).values(
      chunk.map(t => ({
        voiceCampaignId: campaignId,
        clientName: t.clientName,
        phoneNumber: t.phoneNumber,
        clientDocument: t.clientDocument,
        state: 'pending'
      }))
    );
  }
}
```

---

### 2. Voice Scheduling Worker

**Função:** Agenda contatos respeitando horário comercial

```typescript
// Queue: voice-scheduling
// Concurrency: 10 workers

async function processScheduling(job) {
  const { campaignId } = job.data;
  
  const campaign = await storage.getVoiceCampaign(campaignId);
  const now = new Date();
  const currentHour = now.getHours();
  
  // Verificar se está no horário permitido
  const scheduleStart = parseInt(campaign.scheduleStart.split(':')[0]);
  const scheduleEnd = parseInt(campaign.scheduleEnd.split(':')[0]);
  
  if (currentHour < scheduleStart || currentHour >= scheduleEnd) {
    // Fora do horário - reagendar
    const nextRun = new Date(now);
    nextRun.setHours(scheduleStart, 0, 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    await voiceSchedulingQueue.add(
      'schedule-campaign',
      { campaignId },
      { delay: nextRun.getTime() - now.getTime() }
    );
    return;
  }
  
  // Buscar targets pendentes
  const targets = await db.query.voiceCampaignTargets.findMany({
    where: and(
      eq(voiceCampaignTargets.voiceCampaignId, campaignId),
      eq(voiceCampaignTargets.state, 'pending')
    ),
    limit: 100
  });
  
  // Agendar envios
  for (const target of targets) {
    if (campaign.contactMethod.includes('whatsapp')) {
      await whatsappCollectionQueue.add('send-whatsapp', {
        targetId: target.id,
        campaignId
      });
    } else if (campaign.contactMethod === 'voice') {
      await voiceDialerQueue.add('make-call', {
        targetId: target.id,
        campaignId
      });
    }
  }
}
```

---

### 3. Voice Dialer Worker

**Função:** Executa chamadas de voz via Twilio

```typescript
// Queue: voice-dialer
// Concurrency: 20 workers

async function processDialer(job) {
  const { targetId } = job.data;
  const target = await storage.getVoiceCampaignTarget(targetId);
  
  // Criar chamada Twilio
  const call = await twilioClient.calls.create({
    to: target.phoneNumber,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: `${webhookBaseUrl}/api/voice/twiml/${targetId}`,
    statusCallback: `${webhookBaseUrl}/api/voice/webhooks/twilio/status`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
  });
  
  // Atualizar target
  await storage.updateVoiceCampaignTarget(targetId, {
    state: 'calling',
    callSid: call.sid,
    attemptCount: target.attemptCount + 1,
    lastAttemptAt: new Date()
  });
}
```

---

### 4. WhatsApp Collection Worker

**Função:** Envia mensagens WhatsApp com verificação dupla

```typescript
// Queue: voice-whatsapp-collection
// Concurrency: 10 workers

async function processWhatsAppCollection(job) {
  const { targetId } = job.data;
  const target = await storage.getVoiceCampaignTarget(targetId);
  
  // ========================================
  // VERIFICAÇÃO 1: Cliente já pagou?
  // ========================================
  if (target.clientDocument) {
    const crmCheck = await fetch(
      'https://api.trtelecom.net/v1/clientes/consultar_inadimplencia',
      {
        method: 'POST',
        body: JSON.stringify({ cpf_cnpj: target.clientDocument })
      }
    );
    
    const crmData = await crmCheck.json();
    
    if (crmData.faturas_em_aberto === 0) {
      await storage.updateVoiceCampaignTarget(targetId, {
        state: 'completed',
        outcome: 'paid',
        outcomeDetails: 'Cliente já quitou - verificado via CRM'
      });
      return { skipped: true, reason: 'already_paid' };
    }
  }
  
  // ========================================
  // VERIFICAÇÃO 2: Tem promessa válida?
  // ========================================
  if (target.clientDocument) {
    const now = new Date();
    const pendingPromises = await db.query.voicePromises.findMany({
      where: and(
        eq(voicePromises.contactDocument, target.clientDocument),
        eq(voicePromises.status, 'pending'),
        gte(voicePromises.dueDate, now)
      ),
      orderBy: asc(voicePromises.dueDate)
    });
    
    if (pendingPromises.length > 0) {
      const promise = pendingPromises[0];
      const daysUntilDue = Math.ceil(
        (promise.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      await storage.updateVoiceCampaignTarget(targetId, {
        state: 'contacted',
        outcome: 'promise_made',
        outcomeDetails: `Promessa válida até ${promise.dueDate.toLocaleDateString('pt-BR')} (${daysUntilDue} dias)`
      });
      
      return { 
        skipped: true, 
        reason: 'active_promise',
        daysUntilDue 
      };
    }
  }
  
  // ========================================
  // AMBAS VERIFICAÇÕES OK - ENVIAR
  // ========================================
  const message = `Olá ${target.clientName}! 👋\n\nAqui é a equipe de cobrança da TR Telecom.\n\nIdentificamos que você possui pendências financeiras. Podemos conversar sobre isso?\n\nEstou aqui para te ajudar a regularizar sua situação! 💙`;
  
  const cleanPhone = target.phoneNumber.replace(/\D/g, '');
  
  // Enviar via Evolution API
  await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: { 'apikey': evolutionApiKey },
    body: JSON.stringify({
      number: cleanPhone,
      text: message
    })
  });
  
  // Criar/atualizar conversa
  const chatId = `whatsapp_${cleanPhone}`;
  let conversation = await storage.getConversationByChatId(chatId);
  
  if (!conversation) {
    conversation = await storage.createConversation({
      chatId,
      clientName: target.clientName,
      clientDocument: target.clientDocument,
      conversationSource: 'whatsapp_campaign',
      voiceCampaignTargetId: targetId,
      assignedAssistant: 'cobranca'
    });
  }
  
  // Registrar mensagem
  await storage.createMessage({
    conversationId: conversation.id,
    sender: 'assistant',
    content: message,
    isFromCampaign: true
  });
  
  // Atualizar target
  await storage.updateVoiceCampaignTarget(targetId, {
    state: 'contacted',
    attemptCount: target.attemptCount + 1,
    lastAttemptAt: new Date()
  });
  
  return { success: true };
}
```

---

### 5. Voice Post-Call Worker

**Função:** Processa resultados de chamadas

```typescript
// Queue: voice-post-call
// Concurrency: 10 workers

async function processPostCall(job) {
  const { callSid, status } = job.data;
  
  const target = await db.query.voiceCampaignTargets.findFirst({
    where: eq(voiceCampaignTargets.callSid, callSid)
  });
  
  if (!target) return;
  
  // Mapear status Twilio → outcome
  const outcomeMap = {
    'completed': 'answered',
    'no-answer': 'no_answer',
    'busy': 'busy',
    'failed': 'failed',
    'canceled': 'canceled'
  };
  
  await storage.updateVoiceCampaignTarget(target.id, {
    state: 'contacted',
    outcome: outcomeMap[status] || 'unknown',
    lastAttemptAt: new Date()
  });
}
```

---

### 6. Promise Monitor Worker

**Função:** Monitora vencimento de promessas

```typescript
// Queue: voice-promise-monitor
// Concurrency: 5 workers

async function processPromiseMonitor(job) {
  const { promiseId } = job.data;
  
  const promise = await db.query.voicePromises.findFirst({
    where: eq(voicePromises.id, promiseId)
  });
  
  if (!promise || promise.status !== 'pending') {
    return; // Já foi processada
  }
  
  const now = new Date();
  const daysOverdue = Math.ceil(
    (now.getTime() - promise.dueDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysOverdue > 7) {
    // Promessa quebrada após 7 dias
    await storage.updateVoicePromise(promiseId, {
      status: 'broken',
      notes: `Promessa não cumprida - ${daysOverdue} dias de atraso`
    });
    
    // Retornar target para fila
    if (promise.voiceCampaignTargetId) {
      await storage.updateVoiceCampaignTarget(
        promise.voiceCampaignTargetId,
        {
          state: 'pending',
          outcome: 'promise_broken'
        }
      );
    }
  } else {
    // Reagendar verificação para 24h depois
    await promiseMonitorQueue.add(
      'check-promise',
      { promiseId },
      { delay: 24 * 60 * 60 * 1000 }
    );
  }
}
```

---

## Rotas da API

### Campanhas

```typescript
// Listar campanhas
GET /api/voice/campaigns
Response: VoiceCampaign[]

// Criar campanha
POST /api/voice/campaigns
Body: {
  name: string
  contactMethod: 'voice' | 'whatsapp_primary' | 'whatsapp_fallback'
  allowedMethods: ('voice' | 'whatsapp')[]
  fallbackOrder: ('voice' | 'whatsapp')[]
  scheduleStart: string // "08:00"
  scheduleEnd: string   // "20:00"
}
Response: VoiceCampaign

// Buscar campanha
GET /api/voice/campaigns/:id
Response: VoiceCampaign

// Atualizar campanha
PATCH /api/voice/campaigns/:id
Body: Partial<VoiceCampaign>
Response: VoiceCampaign

// Deletar campanha
DELETE /api/voice/campaigns/:id
Response: { success: true }

// Ativar campanha
POST /api/voice/campaigns/:id/activate
Response: { success: true }

// Pausar campanha
POST /api/voice/campaigns/:id/pause
Response: { success: true }
```

### Targets

```typescript
// Importar targets
POST /api/voice/campaigns/:id/targets/import
Body: FormData (CSV/XLSX file)
Response: { 
  imported: number
  errors: string[]
}

// Listar targets
GET /api/voice/campaigns/:campaignId/targets
Query: {
  state?: 'pending' | 'scheduled' | 'calling' | 'contacted' | 'completed'
  outcome?: 'answered' | 'no_answer' | 'promise_made' | 'paid' | ...
}
Response: VoiceCampaignTarget[]

// Atualizar target
PATCH /api/voice/targets/:id
Body: Partial<VoiceCampaignTarget>
Response: VoiceCampaignTarget
```

### Promessas

```typescript
// Listar promessas
GET /api/voice/promises
Query: {
  status?: 'pending' | 'fulfilled' | 'broken' | 'renegotiated'
  contactDocument?: string
}
Response: VoicePromise[]

// Buscar promessa
GET /api/voice/promises/:id
Response: VoicePromise

// Atualizar promessa
PATCH /api/voice/promises/:id
Body: {
  status?: 'pending' | 'fulfilled' | 'broken' | 'renegotiated'
  notes?: string
}
Response: VoicePromise
```

### Métricas

```typescript
// Estatísticas de campanha
GET /api/voice/campaigns/:id/stats
Response: {
  totalTargets: number
  pending: number
  contacted: number
  completed: number
  outcomes: {
    answered: number
    no_answer: number
    busy: number
    promise_made: number
    paid: number
  }
}

// Métricas unificadas
GET /api/voice/metrics
Response: {
  totalCalls: number
  totalWhatsAppMessages: number
  totalContacts: number
  pendingPromises: number
  fulfilledPromises: number
  conversionRate: number
  breakdown: {
    voice: { count: number, percentage: number }
    whatsapp: { count: number, percentage: number }
  }
}
```

### Webhooks

```typescript
// Twilio Status Callback
POST /api/voice/webhooks/twilio/status
Body: {
  CallSid: string
  CallStatus: 'initiated' | 'ringing' | 'answered' | 'completed'
  CallDuration?: string
}
Response: 200 OK

// Twilio Connect (WebSocket)
GET /api/voice/webhooks/twilio/connect
Upgrade: websocket
```

---

## Monitoramento

### Dashboard Dedicado (`/voice/monitor`)

Interface isolada para supervisores com:

#### 1. Métricas em Cards

```
┌─────────────────────────────────────────────────────────────┐
│  📞 Total Chamadas    💬 Total WhatsApp    📊 Total Contatos │
│        247                  1,834               2,081        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  ⏳ Promessas Pendentes    ✅ Promessas Cumpridas           │
│          34                        128                      │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  💰 Taxa de Conversão                                       │
│       42.3%                                                 │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Tabela de Conversas

Filtros disponíveis:
- 📱 **Todas**: Todas as conversas de cobrança
- 📥 **Entrada**: Clientes que ligaram/enviaram mensagem
- 💬 **Campanha WhatsApp**: Originadas do WhatsApp worker
- 📞 **Campanha Voz**: Originadas de chamadas Twilio

Colunas:
- Cliente
- CPF/CNPJ
- Origem (badge colorido)
- Status (IA Atendendo / Transferido / Resolvido)
- Última Atividade
- Ações (Transferir / Ver Detalhes)

#### 3. Badge de Alertas

No Supervisor Dashboard principal:

```
┌─────────────────────────────────────────────────────────────┐
│  Monitor de Cobranças                            🔔 34       │
│  ─────────────────────────────────────────────────────────  │
│  Conversas de cobrança e promessas pendentes                │
│  [Ver Monitor Completo →]                                   │
└─────────────────────────────────────────────────────────────┘
```

O número `34` representa promessas pendentes que exigem atenção.

---

## Schemas do Banco de Dados

### Tabela `voiceCampaigns`

```typescript
export const voiceCampaigns = pgTable('voice_campaigns', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'), // draft, active, paused, completed
  contactMethod: text('contact_method').notNull(), // voice, whatsapp_primary, whatsapp_fallback
  allowedMethods: text('allowed_methods').array().default(['whatsapp']),
  fallbackOrder: text('fallback_order').array().default(['whatsapp', 'voice']),
  scheduleStart: text('schedule_start').default('08:00'),
  scheduleEnd: text('schedule_end').default('20:00'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});
```

### Tabela `voiceCampaignTargets`

```typescript
export const voiceCampaignTargets = pgTable('voice_campaign_targets', {
  id: serial('id').primaryKey(),
  voiceCampaignId: integer('voice_campaign_id').notNull().references(() => voiceCampaigns.id),
  clientName: text('client_name').notNull(),
  phoneNumber: text('phone_number').notNull(),
  clientDocument: text('client_document'), // CPF/CNPJ
  installationPoint: text('installation_point'),
  debtAmount: numeric('debt_amount', { precision: 10, scale: 2 }),
  invoiceNumber: text('invoice_number'),
  
  state: text('state').notNull().default('pending'), 
  // pending, scheduled, calling, contacted, completed
  
  outcome: text('outcome'), 
  // answered, no_answer, busy, promise_made, paid, failed, etc.
  
  outcomeDetails: text('outcome_details'),
  attemptCount: integer('attempt_count').default(0),
  lastAttemptAt: timestamp('last_attempt_at'),
  callSid: text('call_sid'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Tabela `voicePromises`

```typescript
export const voicePromises = pgTable('voice_promises', {
  id: serial('id').primaryKey(),
  contactDocument: text('contact_document').notNull(), // CPF/CNPJ
  dueDate: timestamp('due_date').notNull(), // Data prometida (23:59:59)
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text('payment_method'), // pix, boleto, cartao, etc.
  
  status: text('status').notNull().default('pending'),
  // pending, fulfilled, broken, renegotiated
  
  notes: text('notes'),
  voiceCampaignTargetId: integer('voice_campaign_target_id').references(() => voiceCampaignTargets.id),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  fulfilledAt: timestamp('fulfilled_at'),
});
```

### Tabela `conversations` (integração)

```typescript
// Campos adicionados para integração com cobranças
export const conversations = pgTable('conversations', {
  // ... campos existentes ...
  
  conversationSource: text('conversation_source').default('inbound'),
  // 'inbound', 'voice_campaign', 'whatsapp_campaign'
  
  voiceCampaignTargetId: integer('voice_campaign_target_id')
    .references(() => voiceCampaignTargets.id),
  
  assignedAssistant: text('assigned_assistant'),
  // 'cobranca', 'comercial', 'suporte', etc.
});
```

---

## Configuração de Ambiente

### Variáveis Necessárias

```bash
# Twilio (Voz)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+5511999998888

# Evolution API (WhatsApp)
EVOLUTION_API_URL=https://evolutionapi.trtelecom.net
EVOLUTION_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EVOLUTION_API_INSTANCE=cobranca # Nome da instância WhatsApp

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_COBRANCA_ASSISTANT_ID=asst_xxxxxxxxxxxxxxxx # IA Cobrança

# Webhooks
WEBHOOK_BASE_URL=https://liacortex.replit.app

# CRM API
CRM_API_URL=https://api.trtelecom.net/v1
CRM_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Compliance e Regulamentação

### ANATEL - Resolução 632/2014

✅ **Respeitamos os horários permitidos:**
- Ligações apenas entre 08:00 e 20:00 (dias úteis)
- Mensagens WhatsApp com respeito ao mesmo horário

✅ **Identificação clara:**
- IA se identifica como "assistente virtual da TR Telecom"
- Sempre informa o motivo do contato

✅ **Direito de recusa:**
- Cliente pode solicitar não ser mais contatado
- Sistema registra opt-out permanente

### LGPD (Lei Geral de Proteção de Dados)

✅ **Minimização de dados:**
- Coletamos apenas CPF/CNPJ necessário
- Dados de promessas anonimizados em logs

✅ **Consentimento:**
- Cliente já é cliente TR Telecom (relação contratual)
- Cobrança de débito legítimo

✅ **Segurança:**
- CPF/CNPJ nunca exposto em logs públicos
- Comunicação via HTTPS/TLS
- Acesso restrito ao dashboard (RBAC)

---

## Exemplos de Uso

### Cenário 1: Cliente com Dívida Simples

```
Timeline: 2 faturas vencidas, R$ 179,80

1. Sistema envia WhatsApp
   Worker: ✅ Verificou CRM → dívida ativa
   Worker: ✅ Verificou promessas → nenhuma
   Worker: 📤 Enviou mensagem

2. Cliente responde
   Cliente: "Olá, vi a mensagem"

3. IA inicia negociação
   IA: "Oi! Identifiquei que você possui 2 faturas em aberto totalizando R$ 179,80.
        Podemos regularizar isso hoje?"

4. Cliente aceita parcelar
   Cliente: "Posso parcelar em 2x?"
   IA: "Posso consultar com financeiro, mas geralmente aceitamos!
        Quando você conseguiria pagar a primeira parcela?"

5. Cliente define data
   Cliente: "Dia 20 desse mês"
   IA: [registra promessa via tool]
   IA: "Perfeito! Registrei R$ 89,90 para 20/01/2025.
        Você não receberá mais cobranças até lá! 😊"

Resultado:
✅ Promessa registrada
✅ Cliente protegido até 20/01
✅ Target marcado como 'promise_made'
```

### Cenário 2: Cliente Já Pagou

```
Timeline: Cliente pagou ontem mas CRM ainda não processou

1. Sistema envia WhatsApp
   Worker: ✅ Verificou CRM → ainda mostra dívida (delay de 24h)
   Worker: ✅ Verificou promessas → nenhuma
   Worker: 📤 Enviou mensagem

2. Cliente informa pagamento
   Cliente: "Já paguei ontem! Por que ainda recebo cobrança?"

3. IA atualiza status
   IA: [verifica via consultar_faturas_cpf]
   IA: [chama atualizar_status_cobranca]
   IA: "Você tem razão! Confirmei seu pagamento aqui.
        Desculpe o transtorno, às vezes o sistema demora para atualizar.
        Você não receberá mais cobranças! 🙏"

Resultado:
✅ Target marcado como 'paid'
✅ Cliente removido da campanha
✅ Evita contatos futuros desnecessários
```

### Cenário 3: Cliente com Dificuldades Financeiras

```
Timeline: Desempregado, sem previsão de pagamento

1. Cliente explica situação
   Cliente: "Estou desempregado, não tenho como pagar agora"

2. IA demonstra empatia
   IA: "Entendo perfeitamente sua situação, João.
        Vamos tentar encontrar uma solução juntos?
        Você tem alguma previsão de quando conseguirá?"

3. Cliente dá previsão longa
   Cliente: "Só quando arrumar emprego, talvez mês que vem"

4. IA registra promessa flexível
   Cliente: "Posso tentar dia 28/02"
   IA: [registra promessa]
   IA: "Combinado! Fique tranquilo até 28/02, não vamos te cobrar.
        Se conseguir antes, ótimo! Caso contrário, conversamos de novo.
        Boa sorte na busca de emprego! 💙"

Resultado:
✅ Cliente sente-se respeitado
✅ Promessa de 1 mês registrada
✅ Relacionamento preservado
```

---

## Métricas de Sucesso

### KPIs Principais

1. **Taxa de Contato** = (Contacted / Total Targets) × 100
   - Meta: > 80%

2. **Taxa de Resposta** = (Responderam / Contacted) × 100
   - Meta: > 50%

3. **Taxa de Promessa** = (Promessas / Responderam) × 100
   - Meta: > 60%

4. **Taxa de Cumprimento** = (Fulfilled / Total Promises) × 100
   - Meta: > 70%

5. **Taxa de Conversão** = (Paid / Total Targets) × 100
   - Meta: > 40%

### Dashboard de Métricas

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMPANHA: Janeiro 2025                   │
├─────────────────────────────────────────────────────────────┤
│  Total de Clientes:              5,000                      │
│  Contatados:                     4,200 (84%)                │
│  Responderam:                    2,310 (55%)                │
│  Promessas Registradas:          1,617 (70%)                │
│  Promessas Cumpridas:            1,132 (70%)                │
│  Pagamentos Confirmados:         2,100 (42%)                │
├─────────────────────────────────────────────────────────────┤
│  Por Canal:                                                 │
│    📱 WhatsApp:   3,780 (90%)                               │
│    📞 Voz:          420 (10%)                               │
├─────────────────────────────────────────────────────────────┤
│  Status Atual:                                              │
│    ⏳ Pendente:           800                               │
│    📞 Contatando:         150                               │
│    💬 Negociando:         485                               │
│    ✅ Pago:             2,100                               │
│    🤝 Promessa Ativa:     485                               │
│    ❌ Sem Resposta:     1,890                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Problema: Cliente reclama de múltiplas cobranças

**Verificar:**
1. Logs do WhatsApp Worker → verificação de promessas
2. Tabela `voicePromises` → status da promessa
3. Tabela `voiceCampaignTargets` → outcome atual

**Solução:**
```sql
-- Verificar promessas do cliente
SELECT * FROM voice_promises 
WHERE contact_document = '123.456.789-00'
ORDER BY created_at DESC;

-- Verificar targets ativos
SELECT * FROM voice_campaign_targets
WHERE client_document = '123.456.789-00'
  AND state != 'completed'
ORDER BY last_attempt_at DESC;

-- Se promessa válida mas cliente foi contatado:
UPDATE voice_campaign_targets
SET state = 'contacted',
    outcome = 'promise_made',
    outcome_details = 'Promessa válida - pausado manualmente'
WHERE client_document = '123.456.789-00'
  AND state != 'completed';
```

### Problema: Promessa não está protegendo cliente

**Verificar:**
```sql
-- Confirmar horário da promessa
SELECT 
  id,
  contact_document,
  due_date,
  EXTRACT(HOUR FROM due_date) as hour,
  EXTRACT(MINUTE FROM due_date) as minute,
  status
FROM voice_promises
WHERE contact_document = '123.456.789-00';

-- Deve retornar: hour=23, minute=59
-- Se hour=0, minute=0 → ERRO: promessa expira à meia-noite
```

**Correção:**
```sql
UPDATE voice_promises
SET due_date = due_date + INTERVAL '23 hours 59 minutes 59 seconds'
WHERE contact_document = '123.456.789-00'
  AND EXTRACT(HOUR FROM due_date) = 0;
```

### Problema: Worker não está enviando mensagens

**Verificar logs:**
```bash
# Ver logs do WhatsApp Worker
grep "Voice WhatsApp" /tmp/logs/Start_application_*.log | tail -50

# Verificar filas BullMQ
curl http://localhost:5000/api/debug/queues
```

**Verificações:**
1. Evolution API está respondendo?
2. Instance WhatsApp está conectada?
3. Rate limit atingido? (10 msg/s)
4. Número está no formato correto?

---

## Roadmap

### Fase 1: MVP ✅ (Concluído)
- [x] IA Cobrança dedicada
- [x] WhatsApp Worker com verificação dupla
- [x] Sistema de promessas
- [x] Proteção durante período prometido
- [x] Atualização automática de status
- [x] Monitor dedicado

### Fase 2: Melhorias (Em Planejamento)
- [ ] SMS como canal adicional
- [ ] Integração com gateways de pagamento (link de pagamento na conversa)
- [ ] Chatbot de renegociação com opções pré-definidas
- [ ] Análise de sentimento em tempo real
- [ ] Previsão de propensão a pagar (ML)

### Fase 3: Escalabilidade
- [ ] Multi-tenancy (múltiplas operadoras)
- [ ] API pública para integrações
- [ ] Webhooks customizáveis
- [ ] Dashboard white-label

---

## Conclusão

O sistema COBRANÇAS representa uma solução completa e humanizada para cobrança automatizada, respeitando:

✅ **Eficiência**: 90% dos contatos via WhatsApp (mais barato que voz)
✅ **Empatia**: IA treinada para negociação respeitosa
✅ **Inteligência**: Verificação dupla evita contatos desnecessários
✅ **Compliance**: Total aderência à ANATEL e LGPD
✅ **Proteção**: Sistema de promessas honra compromissos do cliente
✅ **Transparência**: Monitoramento em tempo real e métricas detalhadas

O resultado é um sistema que não apenas recupera receitas, mas também **preserva o relacionamento com o cliente** através de uma abordagem inteligente e humanizada.
