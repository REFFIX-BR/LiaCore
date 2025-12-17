import OpenAI from "openai";
import { z } from "zod";
import { assistantCache, redisConnection } from "./redis-config";
import { agentLogger } from "./agent-logger";
import { trackTokenUsage } from "./openai-usage";
import { 
  enviarVendaChat, 
  enviarSiteLead, 
  enviarLeadSimples,
  verificarConexaoComercial 
} from "./comercial-api";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: "org-AaGGTB8W7UF7Cyzrxi12lVL8",
});

// OTIMIZAÇÃO DE CUSTO: Limitar contexto para reduzir tokens
// Mantém apenas as últimas N mensagens no thread (média ideal: 10-15)
const MAX_THREAD_MESSAGES = 10;

// Circuit Breaker para proteger contra falhas em cascata
class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly failureThreshold = 5,
    private readonly successThreshold = 2,
    private readonly timeout = 90000, // 90s timeout for GPT-5 training processing
    private readonly resetTimeout = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.resetTimeout) {
        console.log('🔄 [CircuitBreaker] Tentando half-open...');
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - too many failures');
      }
    }

    try {
      const result = await this.withTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`OpenAI request timeout (${this.timeout/1000}s)`)), this.timeout)
      ),
    ]);
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        console.log('✅ [CircuitBreaker] Circuito FECHADO - recuperado');
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      console.error(`🔴 [CircuitBreaker] Circuito ABERTO - ${this.failureCount} falhas consecutivas`);
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }
}

const openaiCircuitBreaker = new CircuitBreaker();

// Circuit Breaker separado para consolidação com timeout maior (180s)
// Consolidação de muitas sugestões pode demorar mais devido ao tamanho do prompt
const consolidationCircuitBreaker = new CircuitBreaker(
  5,     // failureThreshold
  2,     // successThreshold  
  180000, // 180s timeout (2x do padrão) para processar 50+ sugestões
  30000  // resetTimeout
);

// ============================================================================
// SINCRONIZAÇÃO COM API COMERCIAL - Função auxiliar para dual-write
// ============================================================================

type SyncType = 'venda' | 'lead_prospeccao' | 'lead_sem_cobertura';

interface SyncPayload {
  type: SyncType;
  saleId: string;
  conversationId?: string;
  payload: any;
}

/**
 * Sincroniza dados com API Comercial
 * Em caso de falha, salva na tabela de pendências para retry posterior
 */
async function syncWithComercialApi(syncData: SyncPayload): Promise<{
  success: boolean;
  comercialSaleId?: string;
  error?: string;
  savedForRetry?: boolean;
}> {
  const startTime = Date.now();
  
  console.log(`🔄 [Comercial Sync] Iniciando sincronização - Tipo: ${syncData.type}, SaleID: ${syncData.saleId}`);
  
  try {
    let result;
    
    switch (syncData.type) {
      case 'venda':
        result = await enviarVendaChat(syncData.payload);
        break;
      case 'lead_prospeccao':
        result = await enviarSiteLead(syncData.payload);
        break;
      case 'lead_sem_cobertura':
        result = await enviarLeadSimples(syncData.payload);
        break;
      default:
        throw new Error(`Tipo de sincronização desconhecido: ${syncData.type}`);
    }
    
    if (result.success) {
      console.log(`✅ [Comercial Sync] Sincronização bem-sucedida em ${Date.now() - startTime}ms`);
      console.log(`   - Comercial Sale ID: ${result.sale_id || 'N/A'}`);
      return {
        success: true,
        comercialSaleId: result.sale_id,
      };
    } else {
      // Falha na API, salvar para retry
      console.warn(`⚠️ [Comercial Sync] Falha na API, salvando para retry: ${result.error}`);
      await savePendingSync(syncData, result.error || 'Erro desconhecido');
      return {
        success: false,
        error: result.error,
        savedForRetry: true,
      };
    }
  } catch (error: any) {
    // Erro de conexão, salvar para retry
    console.error(`❌ [Comercial Sync] Erro de conexão: ${error.message}`);
    await savePendingSync(syncData, error.message);
    return {
      success: false,
      error: error.message,
      savedForRetry: true,
    };
  }
}

// Exponential backoff em minutos: 5, 15, 45, 120 (2h), 360 (6h)
const BACKOFF_MINUTES = [5, 15, 45, 120, 360];

/**
 * Salva sincronização pendente para retry posterior
 * Registra como attempts=1 já que a primeira tentativa falhou
 */
async function savePendingSync(syncData: SyncPayload, errorMessage: string): Promise<void> {
  try {
    const { db } = await import("../db");
    const { pendingComercialSync } = await import("../../shared/schema");
    
    // A primeira tentativa já falhou, então começamos com attempts=1
    // Próximo retry usa o índice 1 do backoff (15 minutos)
    const attempts = 1;
    const backoffIndex = Math.min(attempts, BACKOFF_MINUTES.length - 1);
    const nextRetryMinutes = BACKOFF_MINUTES[backoffIndex];
    const nextRetryAt = new Date(Date.now() + nextRetryMinutes * 60 * 1000);
    
    await db.insert(pendingComercialSync).values({
      type: syncData.type,
      saleId: syncData.saleId,
      conversationId: syncData.conversationId || null,
      payload: syncData.payload,
      status: 'pending',
      attempts: attempts,
      maxAttempts: 5,
      lastError: errorMessage,
      lastAttemptAt: new Date(),
      nextRetryAt,
    });
    
    console.log(`💾 [Comercial Sync] Pendência salva para retry em ${nextRetryMinutes}min (tentativa ${attempts + 1}/5)`);
  } catch (saveError: any) {
    console.error(`❌ [Comercial Sync] Erro ao salvar pendência:`, saveError.message);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openaiCircuitBreaker.execute(() =>
    openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    })
  );
  
  // Track token usage for embeddings
  if (response.usage) {
    await trackTokenUsage(
      "text-embedding-3-small",
      response.usage.prompt_tokens || 0,
      0 // embeddings não têm completion tokens
    );
  }
  
  return response.data[0].embedding;
}

// Validação de variáveis de ambiente dos assistants
function validateAssistantEnvVars() {
  const envVars = {
    cortex: process.env.CORTEX_ASSISTANT_ID,
    apresentacao: process.env.OPENAI_APRESENTACAO_ASSISTANT_ID,
    comercial: process.env.OPENAI_COMMRCIAL_ASSISTANT_ID,
    financeiro: process.env.OPENAI_FINANCEIRO_ASSISTANT_ID,
    suporte: process.env.OPENAI_SUPORTE_ASSISTANT_ID,
    ouvidoria: process.env.OPENAI_OUVIDOIRA_ASSISTANT_ID,
    cancelamento: process.env.OPENAI_CANCELAMENTO_ASSISTANT_ID,
    cobranca: process.env.OPENAI_COBRANCA_ASSISTANT_ID,
  };

  const missing: string[] = [];
  const configured: string[] = [];

  for (const [key, value] of Object.entries(envVars)) {
    if (!value) {
      missing.push(key);
      console.error(`❌ [OpenAI] Variável de ambiente faltando: ${key.toUpperCase()}_ASSISTANT_ID`);
    } else {
      configured.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(`🔴 [OpenAI] ${missing.length} assistants sem configuração: ${missing.join(', ')}`);
    console.error(`⚠️  [OpenAI] Configure as variáveis de ambiente em produção!`);
  } else {
    console.log(`✅ [OpenAI] Todos os ${configured.length} assistants configurados: ${configured.join(', ')}`);
  }

  return { configured, missing, isValid: missing.length === 0 };
}

// Validar na inicialização
export const ASSISTANT_ENV_STATUS = validateAssistantEnvVars();

export const ASSISTANT_IDS = {
  cortex: process.env.CORTEX_ASSISTANT_ID!,
  apresentacao: process.env.OPENAI_APRESENTACAO_ASSISTANT_ID!,
  comercial: process.env.OPENAI_COMMRCIAL_ASSISTANT_ID!,
  financeiro: process.env.OPENAI_FINANCEIRO_ASSISTANT_ID!,
  suporte: process.env.OPENAI_SUPORTE_ASSISTANT_ID!,
  ouvidoria: process.env.OPENAI_OUVIDOIRA_ASSISTANT_ID!,
  cancelamento: process.env.OPENAI_CANCELAMENTO_ASSISTANT_ID!,
  cobranca: process.env.OPENAI_COBRANCA_ASSISTANT_ID!,
};

// Mapeamento de assistente para departamento
export const ASSISTANT_TO_DEPARTMENT: Record<string, string> = {
  cortex: "general",
  apresentacao: "general",
  comercial: "commercial",
  financeiro: "financial",
  suporte: "support",
  ouvidoria: "cancellation",
  cancelamento: "cancellation",
  cobranca: "financial",
};

export interface RouterResult {
  assistantType: string;
  assistantId: string;
  confidence: number;
}

export async function routeMessage(message: string, conversationSource?: string): Promise<RouterResult> {
  // Se a conversa veio de campanha de cobrança, rotear diretamente para IA Cobrança
  if (conversationSource === 'voice_campaign' || conversationSource === 'whatsapp_campaign') {
    console.log(`🎯 [Routing] Campanha de cobrança detectada - roteando para IA Cobrança`);
    return {
      assistantType: "cobranca",
      assistantId: ASSISTANT_IDS.cobranca,
      confidence: 1.0,
    };
  }

  const routingPrompt = `Analise a mensagem do cliente e determine qual assistente especializado deve atendê-lo:

Assistentes disponíveis:
- suporte: Problemas técnicos, conexão, velocidade, equipamentos
- comercial: Vendas, planos, upgrade, contratação
- financeiro: Faturas, pagamentos, dúvidas financeiras gerais
- cobranca: Negociação de débitos, promessas de pagamento, acordos, boletos vencidos
- apresentacao: Apresentação da empresa, novos clientes
- ouvidoria: Reclamações formais, SAC
- cancelamento: Cancelamento de serviço

Mensagem do cliente: "${message}"

Responda apenas com o nome do assistente (suporte, comercial, financeiro, cobranca, apresentacao, ouvidoria, ou cancelamento).`;

  try {
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: routingPrompt }],
      })
    );

    // Track token usage for routing
    if (response.usage) {
      await trackTokenUsage(
        "gpt-5",
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0
      );
    }

    const assistantType = response.choices[0].message.content?.trim().toLowerCase() || "suporte";
    const validTypes = ["suporte", "comercial", "financeiro", "cobranca", "apresentacao", "ouvidoria", "cancelamento"];
    const finalType = validTypes.includes(assistantType) ? assistantType : "suporte";
    
    const assistantId = ASSISTANT_IDS[finalType as keyof typeof ASSISTANT_IDS] || ASSISTANT_IDS.suporte;
    
    console.log(`🎯 [Routing] Message routed to ${finalType} (${assistantId})`);
    
    // Log AI routing decision
    agentLogger.routing('cortex', `Mensagem roteada para ${finalType.toUpperCase()}`, {
      reasoning: `Analisou a mensagem "${message.substring(0, 100)}..." e determinou que o assistente ${finalType.toUpperCase()} é o mais adequado`,
      toAssistant: finalType,
      confidence: 0.85,
    });
    
    return {
      assistantType: finalType,
      assistantId: assistantId,
      confidence: 0.85,
    };
  } catch (error) {
    console.error("Routing error:", error);
    return {
      assistantType: "suporte",
      assistantId: ASSISTANT_IDS.suporte,
      confidence: 0.5,
    };
  }
}

export async function createThread(): Promise<string> {
  const thread = await openaiCircuitBreaker.execute(() =>
    openai.beta.threads.create()
  );
  
  // Adicionar mensagem de sistema com data/hora atual
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const timeStr = now.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  await openaiCircuitBreaker.execute(() =>
    openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: `[INFORMAÇÃO DO SISTEMA - NÃO RESPONDER]\nData e hora atual: ${dateStr} às ${timeStr}\nFuso horário: America/Sao_Paulo (UTC-3)`
    })
  );
  
  console.log(`📅 [OpenAI] Thread criado com contexto de data: ${dateStr} às ${timeStr}`);
  
  return thread.id;
}

// Thread lock helper usando Redis para evitar concorrência
async function acquireThreadLock(threadId: string, timeoutMs: number = 60000): Promise<{ acquired: boolean; lockValue?: string }> {
  const lockKey = `thread-lock:${threadId}`;
  const lockValue = `lock-${Date.now()}-${Math.random()}`;
  const maxWaitTime = Date.now() + timeoutMs;
  let attempts = 0;
  
  while (Date.now() < maxWaitTime) {
    try {
      // TTL de 120s (maior que circuit breaker timeout de 90s)
      const acquired = await redisConnection.set(lockKey, lockValue, 'EX', 120, 'NX');
      
      if (acquired === 'OK') {
        console.log(`🔒 [OpenAI] Lock acquired for thread ${threadId} with value ${lockValue} (attempt ${attempts + 1})`);
        return { acquired: true, lockValue };
      }
      
      // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, max 2000ms
      attempts++;
      const backoffTime = Math.min(100 * Math.pow(2, attempts - 1), 2000);
      
      if (attempts % 10 === 0) {
        console.log(`⏳ [OpenAI] Aguardando lock para thread ${threadId} (tentativa ${attempts})...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    } catch (error) {
      console.error(`❌ [OpenAI] Error acquiring lock for thread ${threadId}:`, error);
      return { acquired: false };
    }
  }
  
  console.warn(`⏰ [OpenAI] Lock timeout para thread ${threadId} após ${timeoutMs}ms (${attempts} tentativas)`);
  return { acquired: false };
}

async function releaseThreadLock(threadId: string, lockValue: string): Promise<void> {
  const lockKey = `thread-lock:${threadId}`;
  
  try {
    // Usa Lua script para verificar e deletar atomicamente (só deleta se for meu lock)
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redisConnection.eval(luaScript, 1, lockKey, lockValue);
    
    if (result === 1) {
      console.log(`🔓 [OpenAI] Lock released for thread ${threadId}`);
    } else {
      console.warn(`⚠️  [OpenAI] Lock for thread ${threadId} was already released or taken by another worker`);
    }
  } catch (error) {
    console.error(`❌ [OpenAI] Error releasing lock for thread ${threadId}:`, error);
  }
}

/**
 * OTIMIZAÇÃO DE CUSTO: Cria thread resumido quando conversa fica muito longa
 * 
 * Estratégia:
 * 1. Busca todas as mensagens do thread atual
 * 2. Usa GPT-4o-mini para criar resumo do contexto
 * 3. Cria novo thread com resumo como primeira mensagem
 * 4. Retorna ID do novo thread
 * 
 * Benefícios:
 * - Reduz tokens de 12k+ para ~3k (economia de 70%+)
 * - Reduz latência de resposta (menos contexto = mais rápido)
 * - Preserva informações essenciais (dados do cliente, progresso)
 */
export async function summarizeAndRotateThread(
  conversationId: string,
  currentThreadId: string,
  assistantType: string,
  dbMessageCount: number, // DB message count para evitar drift
  previousSummary?: string // Summary anterior para preservar contexto em rotações subsequentes
): Promise<{ newThreadId: string; summary: string }> {
  // 🔒 Adquirir lock de thread para prevenir rotações concorrentes
  const lockResult = await acquireThreadLock(currentThreadId, 30000); // 30s timeout
  
  if (!lockResult.acquired) {
    console.warn(`⚠️  [Thread Summary] Lock não adquirido - rotação já em andamento por outro worker`);
    throw new Error('Thread rotation already in progress');
  }
  
  try {
    console.log(`📊 [Thread Summary] Iniciando summarização para conversa ${conversationId}`);
    console.log(`   - DB message count: ${dbMessageCount}`);
    console.log(`   - Tem summary anterior: ${!!previousSummary}`);
    
    // 1. Buscar TODAS as mensagens disponíveis (paginar completamente)
    // CRITICAL: Precisamos do contexto COMPLETO (dados do cliente nas primeiras msgs)
    let allMessages: any[] = [];
    let hasMore = true;
    let after: string | undefined = undefined;
    
    while (hasMore) {
      const response = await openaiCircuitBreaker.execute(() =>
        openai.beta.threads.messages.list(currentThreadId, { 
          limit: 100,
          after
        })
      );
      
      allMessages = allMessages.concat(response.data);
      hasMore = response.has_more; // FIX: Propriedade correta é has_more (snake_case)
      
      if (hasMore && response.data.length > 0) {
        after = response.data[response.data.length - 1].id;
      }
    }
    
    console.log(`📊 [Thread Summary] ${allMessages.length} mensagens recuperadas para resumo completo`);
    
    // 2. Preparar texto para summarização (TODAS as mensagens em ordem cronológica)
    const conversationText = allMessages
      .reverse() // Reverter para ordem cronológica (mais antigas primeiro)
      .map(msg => {
        const role = msg.role === 'user' ? 'Cliente' : 'Assistente';
        const firstContent = msg.content[0];
        const content = (firstContent && 'text' in firstContent) ? firstContent.text.value : '';
        return `${role}: ${content}`;
      })
      .join('\n\n');
    
    // 3. Criar resumo usando GPT-4o-mini (mais rápido e barato)
    // CRITICAL: Incluir summary anterior (se existir) para preservar contexto em rotações subsequentes
    const previousContextSection = previousSummary 
      ? `RESUMO ANTERIOR (contexto preservado de rotações anteriores):
${previousSummary}

---

` 
      : '';
    
    const summaryPrompt = `Você é um assistente de resumo. Crie um resumo CONCISO e ESTRUTURADO desta conversa de venda/atendimento, focando em:

1. **Dados do Cliente Coletados**: Nome, CPF, telefone, email, endereço completo
2. **Produto/Serviço**: Qual plano foi escolhido, preço, características
3. **Progresso**: Etapas já concluídas (validação, coleta de dados, etc)
4. **Pendências**: O que ainda falta para finalizar

IMPORTANTE: 
- Seja EXTREMAMENTE CONCISO. Máximo 300 palavras.
- Se há RESUMO ANTERIOR, PRESERVE todos os dados do cliente já coletados.
- Atualize apenas o progresso e pendências com base na conversa atual.

${previousContextSection}CONVERSA ATUAL:
${conversationText}

RESUMO ESTRUTURADO:`;

    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você cria resumos concisos e estruturados.' },
        { role: 'user', content: summaryPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });
    
    const summary = summaryResponse.choices[0]?.message?.content || 'Resumo não disponível';
    console.log(`✅ [Thread Summary] Resumo criado (${summary.length} chars)`);
    
    // 4. Criar novo thread com resumo como contexto
    const newThread = await openai.beta.threads.create({
      messages: [
        {
          role: 'assistant',
          content: `📝 RESUMO DA CONVERSA ANTERIOR:\n\n${summary}\n\n---\n\nContinuando o atendimento...`
        }
      ]
    });
    
    console.log(`✅ [Thread Summary] Novo thread criado: ${newThread.id}`);
    
    // 5. Atualizar conversation com novo thread_id
    const { storage } = await import("../storage");
    await storage.updateConversation(conversationId, {
      threadId: newThread.id,
      conversationSummary: summary,
      lastSummarizedAt: new Date(),
      messageCountAtLastSummary: dbMessageCount, // Usar DB count para evitar drift
    });
    
    console.log(`✅ [Thread Summary] Conversa atualizada - economia estimada: ~70% tokens`);
    
    return {
      newThreadId: newThread.id,
      summary
    };
    
  } catch (error) {
    console.error(`❌ [Thread Summary] Erro ao summarizar thread:`, error);
    throw error;
  } finally {
    // 🔓 SEMPRE liberar lock, mesmo em caso de erro
    if (lockResult.lockValue) {
      await releaseThreadLock(currentThreadId, lockResult.lockValue);
    }
  }
}

/**
 * OTIMIZAÇÃO DE CUSTO: Trunca mensagens antigas do thread para reduzir tokens
 * Mantém apenas as últimas MAX_THREAD_MESSAGES mensagens em pares user+assistant
 * 
 * DESABILITADO: A OpenAI Assistants API não permite deletar mensagens individuais
 * Solução futura: Rotação de threads (criar nova thread periodicamente)
 * 
 * Regras de preservação:
 * - NUNCA deleta mensagens de sistema (role='system')
 * - NUNCA deleta mensagens vinculadas a runs ativos
 * - SEMPRE preserva pares completos user+assistant (continuidade)
 * - Mensagens com file_ids só são deletadas quando o par completo está fora da janela
 * 
 * Pricing: GPT-4o ~$5/1M input, ~$15/1M output
 */
/* async function truncateThreadMessages(threadId: string): Promise<void> {
  try {
    // Pagina TODAS as mensagens do thread (ordem DESC = mais recentes primeiro)
    let allMessages: any[] = [];
    let hasMore = true;
    let after: string | undefined = undefined;
    
    while (hasMore) {
      const response = await openaiCircuitBreaker.execute(() =>
        openai.beta.threads.messages.list(threadId, { 
          limit: 100, 
          order: 'desc',
          after 
        })
      );
      
      allMessages = allMessages.concat(response.data);
      hasMore = response.hasMore;
      
      if (hasMore && response.data.length > 0) {
        after = response.data[response.data.length - 1].id;
      }
    }
    
    const totalMessages = allMessages.length;
    
    // Se tiver menos que o limite, não precisa truncar
    if (totalMessages <= MAX_THREAD_MESSAGES) {
      console.log(`✅ [Cost Opt] Thread ${threadId}: ${totalMessages} mensagens (limite: ${MAX_THREAD_MESSAGES})`);
      return;
    }
    
    console.log(`🔍 [Cost Opt] Thread ${threadId}: ${totalMessages} mensagens - truncando para ${MAX_THREAD_MESSAGES}`);
    
    // Build keep-set: últimas MAX_THREAD_MESSAGES + mensagens de sistema + runs ativos
    const keepSet = new Set<string>();
    
    // 1. Adiciona as últimas MAX_THREAD_MESSAGES ao keep-set
    for (let i = 0; i < Math.min(MAX_THREAD_MESSAGES, allMessages.length); i++) {
      keepSet.add(allMessages[i].id);
    }
    
    // 2. Sempre preserva mensagens de sistema
    for (const msg of allMessages) {
      if (msg.role === 'system') {
        keepSet.add(msg.id);
      }
    }
    
    // 3. Verifica runs ativos e preserva mensagens vinculadas
    const activeRunIds = new Set<string>();
    try {
      const activeRuns = await openaiCircuitBreaker.execute(() =>
        openai.beta.threads.runs.list(threadId, { limit: 50 }) // Aumentado de 10 para 50
      );
      
      for (const run of activeRuns.data) {
        if (run.status === 'requires_action' || run.status === 'in_progress' || run.status === 'queued') {
          activeRunIds.add(run.id);
        }
      }
      
      console.log(`✅ [Cost Opt] Encontrados ${activeRunIds.size} runs ativos em ${activeRuns.data.length} runs totais`);
    } catch (runError) {
      console.warn(`⚠️  [Cost Opt] Erro ao verificar runs ativos - preservando todas as mensagens por segurança`);
      return; // Aborta truncamento por segurança
    }
    
    for (const msg of allMessages) {
      if (msg.run_id && activeRunIds.has(msg.run_id)) {
        keepSet.add(msg.id);
      }
    }
    
    // 4. Garante pares user+assistant (continuidade conversacional)
    // Itera em ordem cronológica reversa (mais antiga → mais recente)
    const chronologicalMessages = [...allMessages].reverse();
    
    for (let i = 0; i < chronologicalMessages.length; i++) {
      const msg = chronologicalMessages[i];
      
      if (keepSet.has(msg.id)) {
        // Se essa mensagem está no keep-set, garante que o par também está
        if (msg.role === 'user' && i + 1 < chronologicalMessages.length) {
          // User message: preserva a resposta do assistant (próxima mensagem)
          const nextMsg = chronologicalMessages[i + 1];
          if (nextMsg.role === 'assistant') {
            keepSet.add(nextMsg.id);
          }
        } else if (msg.role === 'assistant' && i > 0) {
          // Assistant message: preserva a pergunta do user (mensagem anterior)
          const prevMsg = chronologicalMessages[i - 1];
          if (prevMsg.role === 'user') {
            keepSet.add(prevMsg.id);
          }
        }
      }
    }
    
    // 5. Deleta mensagens que NÃO estão no keep-set (com retry)
    let deletedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    for (const msg of allMessages) {
      if (keepSet.has(msg.id)) {
        skippedCount++;
        continue;
      }
      
      // Deleta a mensagem com retry (3 tentativas)
      let deleted = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await openaiCircuitBreaker.execute(() =>
            openai.beta.threads.messages.del(threadId, msg.id)
          );
          deletedCount++;
          deleted = true;
          break;
        } catch (deleteError) {
          if (attempt === 3) {
            console.error(`❌ [Cost Opt] Falha ao deletar mensagem ${msg.id} após 3 tentativas:`, deleteError);
            failedCount++;
          } else {
            // Espera 500ms antes de tentar de novo (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }
    }
    
    console.log(`✅ [Cost Opt] Truncamento: ${deletedCount} deletadas, ${keepSet.size} mantidas, ${failedCount} falhas`);
    
    // Log de economia estimada (GPT-4o pricing: ~$5/1M input)
    const estimatedTokensSaved = deletedCount * 150; // ~150 tokens por mensagem (conservador)
    const estimatedCostSaved = (estimatedTokensSaved / 1000000) * 5.00; // $5.00 por 1M tokens input
    console.log(`💰 [Cost Opt] Economia estimada: ~${estimatedTokensSaved} tokens (~$${estimatedCostSaved.toFixed(4)} USD)`);
    
    // Track total savings for monitoring
    if (deletedCount > 0) {
      await trackTokenUsage({
        model: 'context-truncation',
        inputTokens: 0,
        outputTokens: 0,
        cost: -estimatedCostSaved, // Negative = savings
        metadata: {
          threadId,
          messagesDeleted: deletedCount,
          messagesMaintained: keepSet.size,
          tokensSaved: estimatedTokensSaved,
          operation: 'truncate-context'
        }
      });
    }
    
  } catch (error) {
    // Não bloqueia o fluxo se truncamento falhar
    console.error(`❌ [Cost Opt] Erro ao truncar thread ${threadId}:`, error);
  }
} */

export async function sendMessageAndGetResponse(
  threadId: string,
  assistantId: string,
  userMessage: string,
  chatId?: string,
  conversationId?: string
): Promise<{ 
  response: string; 
  transferred?: boolean; 
  transferredTo?: string;
  resolved?: boolean;
  resolveReason?: string;
  routed?: boolean;
  assistantTarget?: string;
  routingReason?: string;
  functionCalls?: Array<{name: string; arguments: string}>;
}> {
  // CONTEXT WINDOW OPTIMIZATION: Verificar se precisa rotacionar thread ANTES de adquirir lock
  if (conversationId) {
    const { shouldRotateThread, rotateThread } = await import("./thread-rotation");
    const needsRotation = await shouldRotateThread(conversationId);
    
    if (needsRotation) {
      console.log(`🔄 [OpenAI] Thread ${threadId} precisa de rotação - iniciando processo...`);
      const rotationStart = Date.now();
      
      try {
        const { newThreadId, summary } = await rotateThread(conversationId);
        threadId = newThreadId; // Usar novo thread
        
        const rotationDuration = Date.now() - rotationStart;
        console.log(`✅ [OpenAI] Thread rotacionado em ${rotationDuration}ms - novo thread: ${newThreadId}`);
        console.log(`   Resumo: ${summary.substring(0, 80)}...`);
      } catch (error) {
        console.error("❌ [OpenAI] Erro na rotação de thread:", error);
        // Continuar com thread atual em caso de erro (fail gracefully)
      }
    }
  }
  
  // Adquire lock para evitar concorrência na mesma thread
  const lock = await acquireThreadLock(threadId);
  
  if (!lock.acquired) {
    console.error(`❌ [OpenAI] Could not acquire lock for thread ${threadId} - concurrent access detected`);
    return { 
      response: "Desculpe, estou processando sua mensagem anterior. Por favor, aguarde um momento." 
    };
  }
  
  try {
    if (!threadId) {
      throw new Error("Thread ID is required");
    }

    // Use suporte as default (not cortex) to avoid routing assistant
    const effectiveAssistantId = assistantId || ASSISTANT_IDS.suporte;
    
    if (!effectiveAssistantId) {
      throw new Error("No valid assistant ID available");
    }

    console.log("🔵 [OpenAI] Sending message:", { 
      threadId, 
      assistantId: effectiveAssistantId,
      providedAssistantId: assistantId,
      usedFallback: !assistantId 
    });

    // Check for active runs and cancel them if found
    try {
      const activeRuns = await openaiCircuitBreaker.execute(() =>
        openai.beta.threads.runs.list(threadId, { limit: 5 })
      );
      
      for (const activeRun of activeRuns.data) {
        // If run is already cancelling, just wait for it to finish (don't try to cancel again)
        if (activeRun.status === 'cancelling') {
          console.warn(`⏳ [OpenAI] Run ${activeRun.id} is already cancelling, waiting for completion...`);
          
          // Wait for the cancellation to complete (up to 5 seconds)
          let finished = false;
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const runStatus = await openaiCircuitBreaker.execute(() =>
              openai.beta.threads.runs.retrieve(activeRun.id, { thread_id: threadId })
            );
            
            if (runStatus.status === 'cancelled' || runStatus.status === 'failed' || runStatus.status === 'completed') {
              console.log(`✅ [OpenAI] Run ${activeRun.id} finished (final status: ${runStatus.status})`);
              finished = true;
              break;
            }
            
            console.log(`⏳ [OpenAI] Waiting for run to finish... (attempt ${i + 1}/10, status: ${runStatus.status})`);
          }
          
          if (!finished) {
            console.warn(`⚠️  [OpenAI] Run ${activeRun.id} still not finished after 5 seconds, continuing anyway`);
          }
          continue;
        }
        
        // Only cancel runs that need cancellation
        if (activeRun.status === 'queued' || activeRun.status === 'in_progress' || activeRun.status === 'requires_action') {
          console.warn(`⚠️  [OpenAI] Cancelling active run ${activeRun.id} (status: ${activeRun.status})`);
          
          try {
            await openaiCircuitBreaker.execute(() =>
              openai.beta.threads.runs.cancel(activeRun.id, { thread_id: threadId })
            );
            
            // Wait and verify cancellation (up to 5 seconds)
            let cancelled = false;
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 500));
              const runStatus = await openaiCircuitBreaker.execute(() =>
                openai.beta.threads.runs.retrieve(activeRun.id, { thread_id: threadId })
              );
              
              if (runStatus.status === 'cancelled' || runStatus.status === 'failed' || runStatus.status === 'completed') {
                console.log(`✅ [OpenAI] Run ${activeRun.id} successfully cancelled (final status: ${runStatus.status})`);
                cancelled = true;
                break;
              }
              
              console.log(`⏳ [OpenAI] Waiting for cancellation... (attempt ${i + 1}/10, status: ${runStatus.status})`);
            }
            
            if (!cancelled) {
              console.error(`❌ [OpenAI] Failed to cancel run ${activeRun.id} after 5 seconds`);
              throw new Error(`Could not cancel active run ${activeRun.id}`);
            }
          } catch (cancelError: any) {
            // If error is "Cannot cancel run with status 'cancelling'", it's already being cancelled - not a real error
            if (cancelError?.message?.includes("Cannot cancel run with status 'cancelling'")) {
              console.warn(`⚠️  [OpenAI] Run ${activeRun.id} is already being cancelled, continuing...`);
              continue;
            }
            console.error(`❌ [OpenAI] Error cancelling run ${activeRun.id}:`, cancelError);
            throw cancelError;
          }
        }
      }
    } catch (error) {
      console.error(`❌ [OpenAI] Error checking/cancelling active runs:`, error);
      throw new Error("Não foi possível processar sua mensagem no momento. Por favor, aguarde alguns segundos e tente novamente.");
    }

    // OTIMIZAÇÃO DE CUSTO: Trunca mensagens antigas ANTES de adicionar nova mensagem
    // DESABILITADO: OpenAI não permite deletar mensagens individuais via API
    // await truncateThreadMessages(threadId);
    
    // Attempt to create message with retry logic for active run conflicts
    let messageCreated = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!messageCreated && retryCount < maxRetries) {
      try {
        await openaiCircuitBreaker.execute(() =>
          openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: userMessage,
          })
        );
        messageCreated = true;
        console.log(`✅ [OpenAI] Message created successfully (attempt ${retryCount + 1})`);
      } catch (messageError: any) {
        // Check if error is due to active run
        if (messageError?.message?.includes("while a run") && messageError?.message?.includes("is active")) {
          retryCount++;
          console.warn(`⚠️ [OpenAI] Active run detected during message creation (attempt ${retryCount}/${maxRetries})`);
          
          if (retryCount < maxRetries) {
            // Extract run ID from error message if possible
            const runIdMatch = messageError.message.match(/run (run_[a-zA-Z0-9]+) is active/);
            const activeRunId = runIdMatch ? runIdMatch[1] : null;
            
            if (activeRunId) {
              console.log(`🔄 [OpenAI] Attempting to cancel run ${activeRunId}`);
              try {
                await openaiCircuitBreaker.execute(() =>
                  openai.beta.threads.runs.cancel(activeRunId, { thread_id: threadId })
                );
                console.log(`✅ [OpenAI] Run ${activeRunId} cancellation requested`);
              } catch (cancelErr: any) {
                // If error is "Cannot cancel run with status 'cancelling'", it's already being cancelled
                if (cancelErr?.message?.includes("Cannot cancel run with status 'cancelling'")) {
                  console.warn(`⚠️ [OpenAI] Run ${activeRunId} is already being cancelled`);
                } else {
                  console.warn(`⚠️ [OpenAI] Could not cancel run ${activeRunId}:`, cancelErr);
                }
              }
            }
            
            // Wait before retry (exponential backoff: 2s, 4s, 8s)
            const waitTime = Math.pow(2, retryCount) * 1000;
            console.log(`⏳ [OpenAI] Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            console.error(`❌ [OpenAI] Failed to create message after ${maxRetries} attempts due to active runs`);
            throw new Error("Desculpe, estou processando sua mensagem anterior. Por favor, aguarde um momento e tente novamente.");
          }
        } else {
          // Different error, throw immediately
          throw messageError;
        }
      }
    }

    let run = await openaiCircuitBreaker.execute(() =>
      openai.beta.threads.runs.create(threadId, {
        assistant_id: effectiveAssistantId,
      })
    );

    console.log("🔵 [OpenAI] Run created:", { runId: run.id, threadId });

    // Manual polling loop
    let attempts = 0;
    const maxAttempts = 60;
    const runId = run.id;
    let transferData: { transferred?: boolean; transferredTo?: string } = {};
    let resolveData: { resolved?: boolean; resolveReason?: string } = {};
    let routingData: { routed?: boolean; assistantTarget?: string; routingReason?: string } = {};
    let functionCalls: Array<{name: string; arguments: string}> = [];

    while (run.status === "queued" || run.status === "in_progress" || run.status === "requires_action") {
      if (attempts >= maxAttempts) {
        throw new Error("Run timed out after 60 seconds");
      }

      console.log("🔄 [OpenAI] Polling run:", { status: run.status, runId, threadId, attempt: attempts });

      if (run.status === "requires_action" && run.required_action?.type === "submit_tool_outputs") {
        console.log("🔧 [OpenAI] Handling tool calls...");
        const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = await Promise.all(
          toolCalls.map(async (toolCall) => {
            // Capture function call for persistence
            functionCalls.push({
              name: toolCall.function.name,
              arguments: toolCall.function.arguments
            });
            
            const result = await handleToolCall(toolCall.function.name, toolCall.function.arguments, chatId, conversationId, userMessage);
            
            // Check if this was a transfer call (para HUMANO - bloqueia IA)
            if (toolCall.function.name === "transferir_para_humano") {
              const transferResult = JSON.parse(result);
              if (transferResult.success) {
                transferData = {
                  transferred: true,
                  transferredTo: transferResult.departamento
                };
                
                // Log AI decision to transfer to human
                const assistantType = Object.keys(ASSISTANT_IDS).find(key => ASSISTANT_IDS[key as keyof typeof ASSISTANT_IDS] === assistantId) || 'unknown';
                const args = JSON.parse(toolCall.function.arguments);
                agentLogger.functionCall(
                  assistantType, 
                  'transferir_para_humano',
                  `Transferindo para humano - Departamento: ${transferResult.departamento}`,
                  {
                    conversationId,
                    department: transferResult.departamento,
                    reason: args.motivo || 'Não especificado',
                    decision: 'Cliente precisa de atendimento humano especializado'
                  }
                );
              }
            }
            
            // Check if this was a routing call (para ASSISTENTE - continua com IA)
            if (toolCall.function.name === "rotear_para_assistente") {
              const routingResult = JSON.parse(result);
              if (routingResult.roteado) {
                routingData = {
                  routed: true,
                  assistantTarget: routingResult.assistente,
                  routingReason: routingResult.motivo
                };
                
                // Log AI routing decision
                const fromAssistant = Object.keys(ASSISTANT_IDS).find(key => ASSISTANT_IDS[key as keyof typeof ASSISTANT_IDS] === assistantId) || 'unknown';
                agentLogger.routing(
                  fromAssistant,
                  `Roteando para assistente ${routingResult.assistente.toUpperCase()}`,
                  {
                    conversationId,
                    fromAssistant,
                    toAssistant: routingResult.assistente,
                    routingReason: routingResult.motivo,
                    decision: 'Conversa requer especialização de outro assistente'
                  }
                );
              }
            }
            
            // Check if this was a resolve call
            if (toolCall.function.name === "finalizar_conversa") {
              const resolveResult = JSON.parse(result);
              if (resolveResult.success) {
                resolveData = {
                  resolved: true,
                  resolveReason: resolveResult.motivo
                };
                
                // Log AI decision to finalize conversation
                const assistantType = Object.keys(ASSISTANT_IDS).find(key => ASSISTANT_IDS[key as keyof typeof ASSISTANT_IDS] === assistantId) || 'unknown';
                agentLogger.decision(
                  assistantType,
                  'Finalizando conversa - Problema resolvido',
                  {
                    conversationId,
                    resolveReason: resolveResult.motivo,
                    decision: 'Conversa pode ser finalizada autonomamente'
                  }
                );
              }
            }
            
            return {
              tool_call_id: toolCall.id,
              output: result,
            };
          })
        );

        run = await openaiCircuitBreaker.execute(() =>
          openai.beta.threads.runs.submitToolOutputs(runId, {
            thread_id: threadId,
            tool_outputs: toolOutputs,
          })
        );
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        run = await openaiCircuitBreaker.execute(() =>
          openai.beta.threads.runs.retrieve(runId, {
            thread_id: threadId,
          })
        );
      }

      attempts++;
    }

    console.log("🔵 [OpenAI] Run completed:", { runId: run.id, status: run.status, threadId });

    // Track token usage if available
    if (run.usage) {
      await trackTokenUsage(
        "gpt-5", // Assistant model
        run.usage.prompt_tokens || 0,
        run.usage.completion_tokens || 0
      );
    }

    if (run.status === "failed" || run.status === "cancelled" || run.status === "expired") {
      // Log detailed error information from OpenAI
      const errorDetails = {
        status: run.status,
        runId: run.id,
        threadId: threadId,
        lastError: (run as any).last_error || null,
        incompleteDetails: (run as any).incomplete_details || null,
      };
      
      console.error("❌ [OpenAI] Run failed with details:", JSON.stringify(errorDetails, null, 2));
      
      // Create detailed error message
      let errorMessage = `Run failed with status: ${run.status}`;
      if ((run as any).last_error) {
        const lastError = (run as any).last_error;
        errorMessage += ` | Error: ${lastError.code || 'unknown'} - ${lastError.message || 'No message provided'}`;
      }
      
      throw new Error(errorMessage);
    }

    const messages = await openaiCircuitBreaker.execute(() =>
      openai.beta.threads.messages.list(threadId, {
        order: "desc",
        limit: 1,
      })
    );

    const lastMessage = messages.data[0];
    
    // DEBUG: Log complete response structure
    console.log("🔍 [OpenAI DEBUG] Last message:", JSON.stringify(lastMessage, null, 2));
    
    if (lastMessage && lastMessage.role === "assistant") {
      // Check if content array exists and is not empty before accessing
      if (!Array.isArray(lastMessage.content) || lastMessage.content.length === 0) {
        console.log("⚠️ [OpenAI] Assistant returned empty content array");
        
        // If routing was requested, return routing confirmation
        if (routingData.routed) {
          console.log("✅ [OpenAI] Empty content with routing - using fallback message");
          return {
            response: `Perfeito! Vou conectar você com nosso time de ${routingData.assistantTarget}. Um momento!`,
            ...routingData,
            functionCalls: functionCalls.length > 0 ? functionCalls : undefined
          };
        }
        
        // If transfer was requested, return transfer confirmation
        if (transferData.transferred) {
          console.log("✅ [OpenAI] Empty content with transfer - using fallback message");
          return {
            response: `Entendido! Vou transferir você para ${transferData.transferredTo || 'um atendente humano'}. Em instantes você será atendido por nossa equipe.`,
            ...transferData,
            ...resolveData,
            functionCalls: functionCalls.length > 0 ? functionCalls : undefined
          };
        }
        
        // If resolve was requested, return resolve confirmation
        if (resolveData.resolved) {
          console.log("✅ [OpenAI] Empty content with resolve - using fallback message");
          return {
            response: "Conversa finalizada. Foi um prazer ajudar você! 😊",
            ...resolveData,
            functionCalls: functionCalls.length > 0 ? functionCalls : undefined
          };
        }
        
        // No action taken, return generic message
        console.log("⚠️ [OpenAI] Empty content without action - returning fallback");
        return {
          response: "Entendi. Como posso ajudar você?",
          ...transferData,
          ...resolveData,
          ...routingData,
          functionCalls: functionCalls.length > 0 ? functionCalls : undefined
        };
      }
      
      const content = lastMessage.content[0];
      if (content && content.type === "text") {
        const responseText = content.text.value;
        
        // Detect if assistant is returning JSON instead of conversational response
        if (responseText.trim().startsWith('{') && responseText.includes('recommendedAssistantType')) {
          console.error("⚠️ [CONFIGURATION ERROR] Assistant returned routing JSON instead of conversational response!");
          console.error("⚠️ Assistant ID:", effectiveAssistantId);
          console.error("⚠️ This assistant needs to be reconfigured in OpenAI platform");
          console.error("⚠️ See INSTRUCOES_ASSISTENTES_OPENAI.md for correct configuration");
          
          // Return a helpful error to the user
          return {
            response: "Desculpe, há um problema de configuração no sistema. Por favor, contate o suporte técnico. (Erro: Assistente configurado incorretamente)",
            ...transferData,
            ...resolveData
          };
        }
        
        return {
          response: responseText,
          ...transferData,
          ...resolveData,
          ...routingData,
          functionCalls: functionCalls.length > 0 ? functionCalls : undefined
        };
      }
    }

    // If transfer was requested but no assistant message, return transfer confirmation
    if (transferData.transferred) {
      console.log("✅ [OpenAI] Transfer requested but no response - using fallback message");
      return {
        response: `Entendido! Vou transferir você para ${transferData.transferredTo || 'um atendente humano'}. Em instantes você será atendido por nossa equipe.`,
        ...transferData,
        ...resolveData,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
      };
    }

    // If routing was requested but no assistant message, return routing confirmation
    if (routingData.routed) {
      console.log("✅ [OpenAI] Routing requested but no response - using fallback message");
      return {
        response: `Perfeito! Vou conectar você com nosso time de ${routingData.assistantTarget}. Um momento!`,
        ...routingData,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
      };
    }

    // If resolve was requested but no assistant message, return resolve confirmation
    if (resolveData.resolved) {
      console.log("✅ [OpenAI] Resolve requested but no response - using fallback message");
      return {
        response: "Atendimento finalizado com sucesso! Em breve você receberá uma pesquisa de satisfação.",
        ...resolveData,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
      };
    }

    console.error("⚠️ [OpenAI] No valid response from assistant");
    return { response: "Desculpe, não consegui processar sua mensagem." };
  } catch (error) {
    console.error("❌ [OpenAI] Assistant run error - Full details:");
    console.error("Error name:", (error as Error).name);
    console.error("Error message:", (error as Error).message);
    console.error("Error stack:", (error as Error).stack);
    console.error("Thread ID:", threadId);
    console.error("Assistant ID:", assistantId);
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return { response: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente." };
  } finally {
    // Sempre libera o lock, mesmo em caso de erro (só se foi adquirido)
    if (lock.lockValue) {
      await releaseThreadLock(threadId, lock.lockValue);
    }
  }
}

async function handleToolCall(functionName: string, argsString: string, chatId?: string, conversationId?: string, currentUserMessage?: string): Promise<string> {
  try {
    console.log(`🔧 [AI Tool] Handling function call: ${functionName}`);
    const args = JSON.parse(argsString);
    console.log(`🔧 [AI Tool] Function arguments:`, JSON.stringify(args));
    console.log(`🔧 [AI Tool] Context - chatId: ${chatId || 'undefined'}, conversationId: ${conversationId || 'undefined'}`);
    console.log(`🔧 [AI Tool] Current message available: ${currentUserMessage ? 'yes' : 'no'}`);
    console.log(`🔧 [AI Tool] Entering switch for function: "${functionName}" (length: ${functionName.length})`);

    switch (functionName) {
      case "verificar_conexao":
        if (!conversationId) {
          console.error("❌ [AI Tool] verificar_conexao chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { consultaStatusConexao } = await import("../ai-tools");
        const { storage: storageConexao } = await import("../storage");
        
        try {
          console.log(`🔍 [AI Tool Handler] Iniciando consulta de status de conexão para conversação ${conversationId}`);
          
          // ESTRATÉGIA 1: Tentar usar documento fornecido como parâmetro (se houver)
          let documentoParaUsar = args.documento;
          
          // ESTRATÉGIA 2: Se não houver documento fornecido, buscar do banco
          if (!documentoParaUsar) {
            console.log(`🔍 [AI Tool Handler] Documento não fornecido como parâmetro, buscando no banco...`);
            
            const conversationConexao = await storageConexao.getConversation(conversationId);
            
            if (!conversationConexao) {
              console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
              return JSON.stringify({
                error: "Conversa não encontrada"
              });
            }
            
            console.log(`🔍 [AI Tool Handler] Conversa encontrada. clientDocument: ${conversationConexao.clientDocument ? 'SIM' : 'NÃO'}`);
            
            if (!conversationConexao.clientDocument) {
              // ESTRATÉGIA 3: Extrair CPF do histórico de mensagens (LGPD compliance)
              console.log(`🔍 [AI Tool Handler] CPF não no banco, tentando extrair do histórico...`);
              const { extractCPFFromHistory } = await import("./cpf-context-injector");
              const messagesForCPF = await storageConexao.getMessagesByConversationId(conversationId);
              const cpfExtraido = extractCPFFromHistory(
                messagesForCPF.map(m => ({ content: m.content, role: m.role as 'user' | 'assistant' }))
              );
              
              if (cpfExtraido) {
                documentoParaUsar = cpfExtraido;
                console.log(`✅ [AI Tool Handler] CPF extraído do histórico: ${cpfExtraido.slice(0, 3)}...`);
              } else {
                console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
                return JSON.stringify({
                  error: "Para verificar sua conexão, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
                });
              }
            } else {
              documentoParaUsar = conversationConexao.clientDocument;
              console.log(`✅ [AI Tool Handler] CPF encontrado no banco! Usando CPF persistido.`);
            }
          } else {
            console.log(`✅ [AI Tool Handler] Usando documento fornecido como parâmetro: ***.***.***-${documentoParaUsar.slice(-2)}`);
          }
          
          console.log(`🔍 [AI Tool Handler] Chamando consultaStatusConexao com documento...`);
          
          // Chamar diretamente a API real
          const conexoes = await consultaStatusConexao(
            documentoParaUsar,
            { conversationId },
            storageConexao
          );
          
          console.log(`✅ [AI Tool Handler] Status de conexão consultado com sucesso: ${conexoes?.length || 0} conexão(ões)`);
          
          // Formatar resposta
          if (!conexoes || conexoes.length === 0) {
            return JSON.stringify({
              mensagem: "Não encontrei conexões ativas para este CPF/CNPJ."
            });
          }
          
          // Mapear conexões para formato simplificado
          const conexoesFormatadas = conexoes.map(conexao => ({
            nome_cliente: conexao.nomeCliente,
            plano: conexao.plano,
            velocidade: conexao.velocidadeContratada,
            login: conexao.LOGIN,
            status_ip: conexao.statusIP,
            status_pppoe: conexao.statusPPPoE,
            conectado_desde: conexao.conectadoDesde,
            minutos_conectado: conexao.minutosConectado
          }));
          
          return JSON.stringify(conexoesFormatadas);
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao consultar status de conexão:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
          }
          
          // Fallback quando API falha - retornar instrução estruturada para IA
          const errorMessage = error instanceof Error ? error.message : "Erro ao consultar status de conexão";
          return JSON.stringify({
            status: "ERRO_API",
            error: errorMessage,
            instrucao_ia: "A consulta de status falhou. PRÓXIMOS PASSOS: (1) Pergunte ao cliente seu endereço completo (cidade/bairro/rua); (2) Verifique se há falha massiva na região consultando a ferramenta 'consultar_base_de_conhecimento' com a região; (3) Se necessário, ofereça transferência para técnico. NÃO invente dados de conexão."
          });
        }

      case "consultar_pppoe_status":
        // REDIRECIONAR para verificar_conexao (mesmo handler)
        console.log("🔄 [AI Tool] consultar_pppoe_status → Redirecionando para verificar_conexao");
        
        if (!conversationId) {
          console.error("❌ [AI Tool] consultar_pppoe_status chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { consultaStatusConexao: consultaPPPoE } = await import("../ai-tools");
        const { storage: storagePPPoE } = await import("../storage");
        
        try {
          console.log(`🔍 [AI Tool Handler] Iniciando consulta PPPoE para conversação ${conversationId}`);
          
          // ESTRATÉGIA 1: Tentar usar documento fornecido como parâmetro (cpf ou documento)
          let documentoPPPoE = args.cpf || args.documento;
          
          // ESTRATÉGIA 2: Se não houver documento fornecido, buscar do banco
          if (!documentoPPPoE) {
            console.log(`🔍 [AI Tool Handler] Documento não fornecido como parâmetro, buscando no banco...`);
            
            const conversationPPPoE = await storagePPPoE.getConversation(conversationId);
            
            if (!conversationPPPoE) {
              console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
              return JSON.stringify({
                error: "Conversa não encontrada"
              });
            }
            
            console.log(`🔍 [AI Tool Handler] Conversa encontrada. clientDocument: ${conversationPPPoE.clientDocument ? 'SIM' : 'NÃO'}`);
            
            if (!conversationPPPoE.clientDocument) {
              console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
              return JSON.stringify({
                error: "Para verificar sua conexão, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
              });
            }
            
            documentoPPPoE = conversationPPPoE.clientDocument;
            console.log(`✅ [AI Tool Handler] CPF encontrado no banco! Usando CPF persistido.`);
          } else {
            console.log(`✅ [AI Tool Handler] Usando documento fornecido como parâmetro: ***.***.***-${documentoPPPoE.slice(-2)}`);
          }
          
          console.log(`🔍 [AI Tool Handler] Chamando consultaStatusConexao com documento...`);
          
          // Chamar diretamente a API real
          const conexoesPPPoE = await consultaPPPoE(
            documentoPPPoE,
            { conversationId },
            storagePPPoE
          );
          
          console.log(`✅ [AI Tool Handler] Status de conexão consultado com sucesso: ${conexoesPPPoE?.length || 0} conexão(ões)`);
          
          // Formatar resposta
          if (!conexoesPPPoE || conexoesPPPoE.length === 0) {
            return JSON.stringify({
              mensagem: "Não encontrei conexões ativas para este CPF/CNPJ."
            });
          }
          
          // Mapear conexões para formato simplificado
          const conexoesFormatadasPPPoE = conexoesPPPoE.map(conexao => ({
            nome_cliente: conexao.nomeCliente,
            plano: conexao.plano,
            velocidade: conexao.velocidadeContratada,
            login: conexao.LOGIN,
            status_ip: conexao.statusIP,
            status_pppoe: conexao.statusPPPoE,
            conectado_desde: conexao.conectadoDesde,
            minutos_conectado: conexao.minutosConectado
          }));
          
          return JSON.stringify(conexoesFormatadasPPPoE);
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao consultar status PPPoE:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
          }
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao consultar status de conexão"
          });
        }

      case "consultar_plano_cliente":
        // Alias para verificar_conexao - mesmo retorno, usado pela IA Comercial
        // Reutiliza a lógica centralizada de verificar_conexao
        console.log("🔄 [AI Tool] consultar_plano_cliente → Redirecionando para verificar_conexao");
        return await handleToolCall("verificar_conexao", argsString, chatId, conversationId, currentUserMessage);

      case "consultar_fatura":
        // LGPD: CPF deve ser fornecido a cada consulta - não usar CPF armazenado
        if (!conversationId) {
          console.error("❌ [AI Tool] consultar_fatura chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível para consulta de boletos"
          });
        }
        
        const { consultaBoletoCliente: consultaBoletoFatura, validarDocumentoFlexivel: validarDocFatura } = await import("../ai-tools");
        const { storage: storageFatura } = await import("../storage");
        
        try {
          // LGPD: Verificar se CPF foi fornecido nos argumentos
          const cpfFornecidoFatura = args.documento || args.cpf || args.cpf_cnpj;
          
          if (!cpfFornecidoFatura) {
            // LGPD: SEMPRE solicitar CPF - não usar CPF armazenado
            console.warn("⚠️ [AI Tool] LGPD: CPF não fornecido - solicitando ao cliente");
            return JSON.stringify({
              error: "Para consultar seus boletos, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
            });
          }
          
          // Validar documento fornecido
          const validacaoFatura = validarDocFatura(cpfFornecidoFatura);
          
          if (!validacaoFatura.valido) {
            return JSON.stringify({
              error: validacaoFatura.motivo || 'Documento inválido'
            });
          }
          
          // LGPD: Usar CPF fornecido diretamente, sem armazenar
          const boletosFatura = await consultaBoletoFatura(
            validacaoFatura.documentoNormalizado,
            { conversationId },
            storageFatura
          );
          
          console.log(`✅ [AI Tool] Boletos consultados com sucesso via consultar_fatura`);
          return JSON.stringify(boletosFatura);
        } catch (error) {
          console.error("❌ [AI Tool] Erro ao consultar boletos via consultar_fatura:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool] Stack trace:", error.stack);
            console.error("❌ [AI Tool] Tipo de erro:", error.constructor.name);
          }
          
          // IMPORTANTE: Retornar erro ESTRUTURADO para que a IA NUNCA use dados mockados
          return JSON.stringify({
            status: "ERRO_API",
            error: error instanceof Error ? error.message : "Erro ao consultar boletos",
            instrucao_ia: "ATENÇÃO: A consulta de boletos FALHOU. NÃO invente dados. NÃO use exemplos. Informe ao cliente que houve um problema técnico temporário e peça para tentar novamente em alguns minutos ou ofereça transferir para atendimento humano."
          });
        }

      case "consultar_base_de_conhecimento":
        const query = args.query || "";
        const startTime = Date.now();
        const { searchKnowledge } = await import("./upstash");
        const results = await searchKnowledge(query, 3);
        const executionTime = Date.now() - startTime;
        
        // Track RAG usage for analytics
        if (conversationId) {
          try {
            const { storage } = await import("../storage");
            const conversation = await storage.getConversation(conversationId);
            
            if (conversation) {
              await storage.createRagAnalytics({
                conversationId,
                assistantType: conversation.assistantType,
                query,
                resultsCount: results.length,
                resultsFound: results.length > 0,
                sources: results.map(r => r.chunk.source),
                executionTime
              });
            }
          } catch (error) {
            console.error('❌ [RAG Analytics] Failed to track:', error);
            // Continue even if tracking fails
          }
        }
        
        if (results.length === 0) {
          return `--- CONTEXTO DA BASE DE CONHECIMENTO ---
Não foram encontradas informações específicas sobre este tópico na base de conhecimento.

--- SUA TAREFA ---
1. Informe ao cliente de forma natural e honesta que não encontrou a informação específica.
2. Ofereça transferir para um atendente humano que possa ajudar.
3. NUNCA mencione "base de conhecimento" ou "contexto" - aja naturalmente.
4. Responda seguindo todas as regras absolutas e de persona definidas para você.`;
        }
        
        const contextoRecuperado = results.map(r => r.chunk.content).join('\n\n');
        const fonte = results[0]?.chunk.source || "Base de Conhecimento TR Telecom";
        
        // Retorna PROMPT RAG ESTRUTURADO conforme recomendação do especialista
        return `--- CONTEXTO DA BASE DE CONHECIMENTO ---
${contextoRecuperado}

--- SUA TAREFA ---
1. **Analise a pergunta do cliente** usando o histórico da conversa para entender o contexto completo.
2. **Formule uma resposta precisa e concisa usando APENAS as informações contidas no CONTEXTO DA BASE DE CONHECIMENTO acima.**
3. **Se a resposta não estiver no CONTEXTO fornecido, seja honesto:** Informe que não encontrou a informação específica e ofereça ajuda de outra forma.
4. **NUNCA mencione** a existência da "base de conhecimento" ou do "contexto" na sua resposta. Aja como se você soubesse a informação naturalmente.
5. **Responda seguindo todas as regras absolutas e de persona definidas para você.**

Fonte: ${fonte}`;

      case "transferir_para_humano":
        const departamento = args.departamento || args.department || "Suporte Geral";
        const motivo = args.motivo || args.reason || "Solicitação do cliente";
        
        console.log("🔀 [Transfer] IA solicitou transferência para HUMANO:", { chatId, departamento, motivo });
        
        // Mark conversation for transfer (will be processed in routes.ts)
        return JSON.stringify({
          success: true,
          departamento,
          motivo,
          mensagem: "Transferência para atendimento humano iniciada com sucesso",
        });

      case "rotear_para_assistente":
        // 🆕 BLOQUEIO: Verificar se está aguardando seleção de ponto
        if (conversationId) {
          const { installationPointManager } = await import('./redis-config');
          const isAwaitingSelection = await installationPointManager.isAwaitingSelection(conversationId);
          
          if (isAwaitingSelection) {
            console.warn(`⛔ [Routing] BLOQUEADO - Conversa ${conversationId} está aguardando seleção de ponto de instalação`);
            return JSON.stringify({
              roteado: false,
              bloqueado: true,
              mensagem: "Aguardando seleção do cliente. Não é possível rotear neste momento.",
            });
          }
        }
        
        const assistente = args.assistantType || args.assistente || args.departamento || args.department || "Suporte";
        const motivo_roteamento = args.motivo || args.reason || "Roteamento interno";
        
        console.log("🎭 [Routing] IA solicitou roteamento para ASSISTENTE:", { chatId, assistente, motivo: motivo_roteamento });
        
        // Mark conversation for internal routing (will be processed in routes.ts)
        return JSON.stringify({
          roteado: true,
          assistente,
          motivo: motivo_roteamento,
          mensagem: `Roteando para assistente ${assistente}`,
        });

      case "finalizar_conversa":
        const motivo_finalizacao = args.motivo || "Problema resolvido";
        
        console.log("✅ [Resolve] IA solicitou finalização:", { chatId, motivo: motivo_finalizacao });
        
        // Mark conversation for resolution (will be processed in routes.ts)
        return JSON.stringify({
          success: true,
          motivo: motivo_finalizacao,
          mensagem: "Conversa finalizada com sucesso. Pesquisa de satisfação será enviada ao cliente.",
        });

      case "registrar_reclamacao_ouvidoria":
        if (!conversationId) {
          console.error("❌ [AI Tool] registrar_reclamacao_ouvidoria chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível para registrar reclamação"
          });
        }
        
        const { storage: storageComplaint } = await import("../storage");
        
        const complaintType = args.tipo || args.type || "outro";
        const complaintSeverity = args.gravidade || args.severity || "media";
        const complaintDescription = args.descricao || args.description || "Sem descrição fornecida";
        
        try {
          const complaint = await storageComplaint.createComplaint({
            conversationId,
            complaintType,
            severity: complaintSeverity,
            description: complaintDescription,
            status: "novo",
          });
          
          console.log(`📋 [Ouvidoria] Reclamação registrada:`, { 
            complaintId: complaint.id,
            conversationId,
            type: complaintType,
            severity: complaintSeverity
          });
          
          return JSON.stringify({
            success: true,
            protocolo: complaint.id,
            tipo: complaintType,
            gravidade: complaintSeverity,
            mensagem: `Reclamação registrada com sucesso. Protocolo: ${complaint.id}. Sua reclamação será analisada por nossa equipe.`,
          });
        } catch (error) {
          console.error("❌ [Ouvidoria] Erro ao registrar reclamação:", error);
          return JSON.stringify({
            error: "Não foi possível registrar a reclamação. Tente novamente.",
          });
        }

      case "agendar_visita":
        console.warn("⚠️ [AI Tool] agendar_visita chamada - função não implementada");
        return JSON.stringify({
          error: "Função de agendamento de visita não está disponível no momento. Por favor, solicite transferência para atendimento humano."
        });

      case "buscar_cep":
        console.log("📍 [AI Tool] buscar_cep chamada -", args.cep);
        try {
          const cep = args.cep?.replace(/\D/g, ''); // Remove caracteres não numéricos
          
          if (!cep || cep.length !== 8) {
            return JSON.stringify({
              error: "CEP inválido. Por favor, informe um CEP válido com 8 dígitos (ex: 12345-678)."
            });
          }

          // Buscar endereço na API ViaCEP
          const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await response.json();
          
          if (data.erro) {
            return JSON.stringify({
              error: "CEP não encontrado. Por favor, verifique o CEP informado."
            });
          }

          console.log("✅ [CEP] Endereço encontrado:", data.logradouro, data.bairro, data.localidade);

          // ============================================================================
          // VERIFICAÇÃO DE VIABILIDADE - CIDADES COM COBERTURA TR TELECOM
          // ============================================================================
          // Cidades atendidas: Três Rios RJ, Comendador Levy Gasparian RJ, 
          // Santana do Deserto MG, Simão Pereira MG, Paraíba do Sul RJ, Chiador MG, Areal RJ
          const cidadesComCobertura = [
            "três rios",
            "tres rios",
            "comendador levy gasparian",
            "levy gasparian",
            "santana do deserto",
            "simão pereira",
            "simao pereira",
            "paraíba do sul",
            "paraiba do sul",
            "chiador",
            "areal"
          ];
          
          const cidadeNormalizada = data.localidade?.toLowerCase().trim() || "";
          const temCobertura = cidadesComCobertura.some(cidade => 
            cidadeNormalizada.includes(cidade) || cidade.includes(cidadeNormalizada)
          );

          // Preparar resultado para retorno e persistência
          const coverageResult = {
            success: true,
            cep: data.cep,
            logradouro: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || "",
            complemento: data.complemento || "",
            tem_cobertura: temCobertura,
            mensagem: temCobertura 
              ? `Endereço encontrado: ${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}. Temos cobertura nessa região! 🎉`
              : `Endereço encontrado: ${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}. Infelizmente, ainda não temos cobertura nessa região. 😔`,
            timestamp: new Date().toISOString()
          };

          // ============================================================================
          // PERSISTIR RESULTADO DA VERIFICAÇÃO DE COBERTURA NO BANCO
          // ============================================================================
          if (conversationId) {
            try {
              const { db } = await import("../db");
              const { conversations } = await import("../../shared/schema");
              const { eq } = await import("drizzle-orm");
              
              await db.update(conversations)
                .set({ 
                  lastCoverageCheck: coverageResult 
                })
                .where(eq(conversations.id, conversationId));
              
              console.log(`✅ [CEP] Resultado da verificação de cobertura salvo no banco (tem_cobertura: ${temCobertura})`);
            } catch (dbError) {
              console.error("❌ [CEP] Erro ao salvar resultado da verificação de cobertura:", dbError);
            }
          } else {
            console.warn("⚠️ [CEP] conversationId não disponível - resultado não será persistido");
          }

          if (!temCobertura) {
            console.log("⚠️ [CEP] Sem cobertura na cidade:", data.localidade);
          }

          return JSON.stringify(coverageResult);
        } catch (error) {
          console.error("❌ [AI Tool] Erro ao buscar CEP:", error);
          return JSON.stringify({
            error: "Erro ao buscar CEP. Por favor, tente novamente ou informe o endereço manualmente."
          });
        }

      case "consultar_planos":
        console.log("📋 [AI Tool] consultar_planos chamada - buscando planos ativos");
        try {
          const { storage: storagePlans } = await import("../storage");
          const plans = await storagePlans.getActivePlans();
          
          // Formatar planos para resposta humanizada
          const plansFormatted = plans.map((plan: any) => ({
            id: plan.id,
            nome: plan.name,
            tipo: plan.type,
            velocidade_download: plan.downloadSpeed > 0 ? `${plan.downloadSpeed} Mbps` : null,
            velocidade_upload: plan.uploadSpeed > 0 ? `${plan.uploadSpeed} Mbps` : null,
            preco: `R$ ${(plan.price / 100).toFixed(2).replace('.', ',')}`,
            descricao: plan.description,
            beneficios: plan.features
          }));
          
          return JSON.stringify({
            success: true,
            quantidade: plans.length,
            planos: plansFormatted,
            mensagem: `Encontrei ${plans.length} planos disponíveis.`
          });
        } catch (error) {
          console.error("❌ [AI Tool] Erro ao consultar planos:", error);
          return JSON.stringify({
            error: "Erro ao buscar planos disponíveis. Tente novamente."
          });
        }

      case "enviar_cadastro_venda":
        console.log("💰 [AI Tool] enviar_cadastro_venda chamada - processando lead");
        try {
          // ============================================================================
          // VALIDAÇÃO CRÍTICA: VERIFICAR COBERTURA ANTES DE PROCESSAR VENDA
          // ============================================================================
          if (conversationId) {
            try {
              const { db: dbSales } = await import("../db");
              const { conversations: conversationsSales } = await import("../../shared/schema");
              const { eq: eqSales } = await import("drizzle-orm");
              
              const conversationData = await dbSales.query.conversations.findFirst({
                where: eqSales(conversationsSales.id, conversationId)
              });
              
              const lastCoverage = conversationData?.lastCoverageCheck as any;
              
              // Validação 1: Verificar se existe lastCoverageCheck
              if (!lastCoverage) {
                console.error("🚫 [Sales Validation] BLOQUEADO - Nenhuma verificação de CEP encontrada");
                return JSON.stringify({
                  error: "É necessário verificar o CEP antes de finalizar o cadastro. Por favor, informe o CEP do cliente.",
                  instrucao: "Use a função buscar_cep() antes de enviar_cadastro_venda()."
                });
              }

              // Validação 2: Verificar se tem cobertura
              if (lastCoverage.tem_cobertura === false) {
                console.error("🚫 [Sales Validation] BLOQUEADO - Tentativa de venda em região SEM cobertura");
                console.error(`🚫 [Sales Validation] Cidade: ${lastCoverage.cidade}, Estado: ${lastCoverage.estado}`);
                
                return JSON.stringify({
                  error: "Não é possível finalizar o cadastro de venda porque não temos cobertura nesta região.",
                  tem_cobertura: false,
                  cidade: lastCoverage.cidade,
                  estado: lastCoverage.estado,
                  instrucao: "Use a função registrar_lead_sem_cobertura() para registrar apenas o interesse do cliente (nome, telefone, cidade, email opcional)."
                });
              }

              // Validação 3: Verificar se CEP da venda COINCIDE com lastCoverageCheck
              const saleCep = args.endereco?.cep?.replace(/\D/g, '');
              const checkedCep = lastCoverage.cep?.replace(/\D/g, '');
              
              if (saleCep && checkedCep && saleCep !== checkedCep) {
                console.error("🚫 [Sales Validation] BLOQUEADO - CEP da venda não coincide com CEP verificado");
                console.error(`🚫 [Sales Validation] CEP verificado: ${checkedCep}, CEP da venda: ${saleCep}`);
                
                return JSON.stringify({
                  error: "O CEP fornecido no endereço não coincide com o CEP verificado anteriormente. Por favor, verifique o CEP novamente com buscar_cep().",
                  cep_verificado: lastCoverage.cep,
                  cep_fornecido: args.endereco?.cep,
                  instrucao: "Chame buscar_cep() com o CEP correto antes de enviar_cadastro_venda()."
                });
              }

              // Validação 4: Verificar freshness (30 minutos) e renovar automaticamente se expirado
              const coverageTimestamp = lastCoverage.timestamp ? new Date(lastCoverage.timestamp).getTime() : 0;
              const now = Date.now();
              const thirtyMinutesMs = 30 * 60 * 1000; // Aumentado de 5min para 30min
              
              if (now - coverageTimestamp > thirtyMinutesMs) {
                console.warn(`⚠️ [Sales Validation] Cobertura expirada (idade: ${Math.floor((now - coverageTimestamp) / 60000)}min) - renovando automaticamente`);
                
                // Renovar cobertura automaticamente chamando buscar_cep
                try {
                  const cepToCheck = lastCoverage.cep;
                  console.log(`🔄 [Sales Validation] Renovando cobertura para CEP ${cepToCheck}...`);
                  
                  // Buscar CEP via ViaCEP
                  const viaCepUrl = `https://viacep.com.br/ws/${cepToCheck}/json/`;
                  const viaCepResponse = await fetch(viaCepUrl);
                  const cepData = await viaCepResponse.json();
                  
                  if (cepData.erro) {
                    throw new Error('CEP não encontrado');
                  }
                  
                  // Atualizar lastCoverageCheck na conversa
                  const updatedCoverage = {
                    cep: cepToCheck,
                    logradouro: cepData.logradouro,
                    complemento: cepData.complemento,
                    bairro: cepData.bairro,
                    cidade: cepData.localidade,
                    estado: cepData.uf,
                    tem_cobertura: lastCoverage.tem_cobertura, // Mantém status anterior
                    timestamp: new Date().toISOString()
                  };
                  
                  const { storage: storageRenewal } = await import("../storage");
                  await storageRenewal.updateConversation(conversationId, {
                    lastCoverageCheck: updatedCoverage
                  });
                  
                  console.log(`✅ [Sales Validation] Cobertura renovada com sucesso - ${updatedCoverage.cidade}, ${updatedCoverage.estado}`);
                } catch (renewError) {
                  console.error(`❌ [Sales Validation] Erro ao renovar cobertura:`, renewError);
                  return JSON.stringify({
                    error: "Não foi possível renovar a verificação de cobertura. Por favor, confirme o CEP novamente.",
                    instrucao: "Chame buscar_cep() antes de enviar_cadastro_venda()."
                  });
                }
              }
              
              console.log(`✅ [Sales Validation] Todas validações OK - ${lastCoverage.cidade}, ${lastCoverage.estado}, CEP: ${lastCoverage.cep}`);
            } catch (validationError) {
              console.error("❌ [Sales Validation] Erro ao validar cobertura:", validationError);
              return JSON.stringify({
                error: "Erro ao validar cobertura. Por favor, tente novamente."
              });
            }
          }

          // ============================================================================
          // VALIDAÇÃO COMPLETA DE CAMPOS OBRIGATÓRIOS PARA VENDA
          // ============================================================================
          const requiredFields = ['tipo_pessoa', 'nome_cliente', 'telefone_cliente', 'plano_id'];
          const missingFields = requiredFields.filter(field => !args[field]);
          
          if (missingFields.length > 0) {
            console.error("❌ [Sales] Campos básicos obrigatórios faltando:", missingFields);
            return JSON.stringify({
              error: `Dados básicos incompletos. Faltam: ${missingFields.join(', ')}`,
              campos_faltantes: missingFields
            });
          }

          // Validar CPF/CNPJ
          const cpfCnpj = args.cpf_cnpj || args.cpf_cliente || args.cnpj;
          if (!cpfCnpj) {
            console.error("❌ [Sales] CPF/CNPJ não fornecido");
            return JSON.stringify({
              error: "CPF ou CNPJ é obrigatório para finalizar o cadastro."
            });
          }

          // Validar email
          if (!args.email_cliente && !args.email) {
            console.error("❌ [Sales] Email não fornecido");
            return JSON.stringify({
              error: "Email é obrigatório para finalizar o cadastro."
            });
          }

          // Validar endereço completo
          if (!args.endereco) {
            console.error("❌ [Sales] Endereço não fornecido");
            return JSON.stringify({
              error: "Endereço completo é obrigatório (CEP, logradouro, número, bairro, cidade, estado)."
            });
          }

          const enderecoFields = ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'estado'];
          const missingAddressFields = enderecoFields.filter(field => !args.endereco[field]);
          
          if (missingAddressFields.length > 0) {
            console.error("❌ [Sales] Campos de endereço faltando:", missingAddressFields);
            return JSON.stringify({
              error: `Endereço incompleto. Faltam: ${missingAddressFields.join(', ')}`,
              campos_faltantes: missingAddressFields
            });
          }

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

          // Validar dia de vencimento
          if (!args.dia_vencimento) {
            console.error("❌ [Sales] Dia de vencimento não fornecido");
            return JSON.stringify({
              error: "Dia de vencimento é obrigatório (05, 10 ou 15)."
            });
          }

          // Preparar dados do cadastro (já validados)
          const saleData = {
            type: args.tipo_pessoa, // "PF" ou "PJ"
            customerName: args.nome_cliente,
            cpfCnpj: args.cpf_cnpj || args.cpf_cliente || args.cnpj,
            email: args.email_cliente || args.email,
            phone: args.telefone_cliente || args.telefone,
            phone2: args.telefone_secundario || args.telefone2,
            motherName: args.nome_mae,
            birthDate: args.data_nascimento,
            rg: args.rg,
            sex: args.sexo,
            civilStatus: args.estado_civil,
            // Address - Extract individual fields from endereco object
            cep: args.endereco?.cep || null,
            address: args.endereco?.logradouro || null,
            number: args.endereco?.numero || null,
            complement: args.endereco?.complemento || null,
            neighborhood: args.endereco?.bairro || null,
            city: args.endereco?.cidade || null,
            state: args.endereco?.estado || null,
            reference: args.endereco?.referencia || null,
            // Service
            planId: args.plano_id,
            billingDay: args.dia_vencimento ? parseInt(args.dia_vencimento) : null,
            preferredInstallDate: args.data_instalacao_preferida,
            availability: args.disponibilidade,
            // Lead Management
            source: "chat",
            status: "Aguardando Análise",
            conversationId,
            observations: args.observacoes,
            howDidYouKnow: args.como_conheceu || null, // Como conheceu a TR Telecom
          };

          // Salvar no banco via storage
          console.log(`📝 [Sales] Iniciando gravação no banco de dados...`);
          console.log(`   - Cliente: ${saleData.customerName}`);
          console.log(`   - CPF/CNPJ: ${saleData.cpfCnpj?.substring(0, 3)}***`);
          console.log(`   - Cidade: ${saleData.city}/${saleData.state}`);
          console.log(`   - Plano ID: ${saleData.planId}`);
          console.log(`   - Conversa ID: ${conversationId}`);
          
          const { storage: storageSales } = await import("../storage");
          const saleStartTime = Date.now();
          const sale = await storageSales.addSale(saleData);
          const saleElapsed = Date.now() - saleStartTime;

          console.log(`✅ [Sales] Cadastro registrado com sucesso!`);
          console.log(`   - Protocolo: ${sale.id}`);
          console.log(`   - Tempo de gravação: ${saleElapsed}ms`);
          console.log(`   - Status: ${sale.status}`);

          // ============================================================================
          // SINCRONIZAÇÃO COM API COMERCIAL (dual-write)
          // Envia dados para comercial.trtelecom.net em background
          // Em caso de falha, salva para retry posterior (não bloqueia a venda)
          // ============================================================================
          const comercialPayload = {
            tipo_pessoa: args.tipo_pessoa,
            nome_cliente: args.nome_cliente,
            cpf_cnpj: args.cpf_cnpj || args.cpf_cliente || args.cnpj,
            telefone_cliente: args.telefone_cliente || args.telefone,
            email_cliente: args.email_cliente || args.email,
            nome_mae: args.nome_mae,
            data_nascimento: args.data_nascimento,
            rg: args.rg,
            sexo: args.sexo,
            estado_civil: args.estado_civil,
            plano_id: args.plano_id,
            endereco: args.endereco,
            dia_vencimento: args.dia_vencimento,
            forma_pagamento: args.forma_pagamento,
            observacoes: args.observacoes,
            conversationId: conversationId,
          };
          
          // Sincronizar em background (não espera resultado)
          syncWithComercialApi({
            type: 'venda',
            saleId: sale.id,
            conversationId: conversationId,
            payload: comercialPayload,
          }).then(syncResult => {
            if (syncResult.success) {
              console.log(`✅ [Sales] Sincronizado com sistema comercial - ID: ${syncResult.comercialSaleId}`);
            } else if (syncResult.savedForRetry) {
              console.log(`📋 [Sales] Venda salva para sincronização posterior`);
            }
          }).catch(syncError => {
            console.error(`❌ [Sales] Erro na sincronização (ignorado):`, syncError);
          });

          return JSON.stringify({
            success: true,
            lead_id: sale.id,
            protocolo: sale.id,
            mensagem: `Cadastro registrado com sucesso! Protocolo: ${sale.id}. Nossa equipe entrará em contato em breve no telefone ${saleData.phone} para confirmar os dados e agendar a instalação.`
          });
        } catch (error) {
          console.error("❌ [Sales] Erro ao processar cadastro de venda:", error);
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao processar cadastro. Tente novamente ou solicite transferência para atendimento humano."
          });
        }

      case "registrar_lead_sem_cobertura":
        console.log("📋 [AI Tool] registrar_lead_sem_cobertura chamada - registrando interesse de cliente sem cobertura");
        try {
          // ============================================================================
          // VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
          // ============================================================================
          const requiredLeadFields = ['nome', 'telefone', 'cidade'];
          const missingLeadFields = requiredLeadFields.filter(field => !args[field]);
          
          if (missingLeadFields.length > 0) {
            console.error("❌ [Lead] Campos obrigatórios faltando:", missingLeadFields);
            return JSON.stringify({
              error: `Dados incompletos. Para registrar seu interesse, preciso de: ${missingLeadFields.join(', ')}`,
              campos_faltantes: missingLeadFields
            });
          }

          // Validar e normalizar nome (mínimo 3 caracteres)
          const leadName = args.nome.trim();
          if (leadName.length < 3) {
            console.error("❌ [Lead] Nome muito curto:", leadName);
            return JSON.stringify({
              error: "Nome inválido. Por favor, informe o nome completo (mínimo 3 caracteres)."
            });
          }

          // Validar e normalizar telefone (apenas números, mínimo 10 dígitos)
          const leadPhone = args.telefone.replace(/\D/g, '');
          if (leadPhone.length < 10 || leadPhone.length > 11) {
            console.error("❌ [Lead] Telefone inválido:", args.telefone);
            return JSON.stringify({
              error: "Telefone inválido. Por favor, informe um telefone válido com DDD (ex: (24) 99999-9999)."
            });
          }

          // Validar e normalizar cidade (mínimo 3 caracteres)
          const leadCity = args.cidade.trim();
          if (leadCity.length < 3) {
            console.error("❌ [Lead] Cidade inválida:", leadCity);
            return JSON.stringify({
              error: "Cidade inválida. Por favor, informe o nome completo da cidade."
            });
          }

          // Validar email se fornecido
          if (args.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(args.email)) {
              console.error("❌ [Lead] Email inválido:", args.email);
              return JSON.stringify({
                error: "Email inválido. Por favor, informe um email válido (ex: nome@exemplo.com)."
              });
            }
          }

          // Preparar dados mínimos do lead sem cobertura (já validados e normalizados)
          const leadData = {
            type: "PF", // Default PF para leads sem cobertura
            customerName: leadName,
            email: args.email || null,
            phone: leadPhone,
            city: leadCity,
            cep: args.cep || null,
            // Lead Management
            source: "chat",
            status: "Lead Sem Cobertura",
            conversationId,
            observations: `Lead interessado em ${leadCity}. Região sem cobertura TR Telecom. ${args.observacoes || ''}`
          };

          // Salvar no banco via storage
          const { storage: storageLead } = await import("../storage");
          const lead = await storageLead.addSale(leadData);

          console.log(`✅ [Lead] Lead sem cobertura registrado com sucesso - ID: ${lead.id}, Cidade: ${args.cidade}`);

          // ============================================================================
          // SINCRONIZAÇÃO COM API COMERCIAL (dual-write)
          // Envia lead simples para comercial.trtelecom.net
          // ============================================================================
          const comercialPayloadLead = {
            nome: leadName,
            telefone: leadPhone,
            cidade: leadCity,
            descricao: `Lead sem cobertura - ${leadCity}. ${args.observacoes || ''}`,
            origem: 'LIA Bot - Sem Cobertura',
          };
          
          syncWithComercialApi({
            type: 'lead_sem_cobertura',
            saleId: lead.id,
            conversationId: conversationId,
            payload: comercialPayloadLead,
          }).then(syncResult => {
            if (syncResult.success) {
              console.log(`✅ [Lead] Sincronizado com sistema comercial`);
            } else if (syncResult.savedForRetry) {
              console.log(`📋 [Lead] Lead salvo para sincronização posterior`);
            }
          }).catch(syncError => {
            console.error(`❌ [Lead] Erro na sincronização (ignorado):`, syncError);
          });

          return JSON.stringify({
            success: true,
            lead_id: lead.id,
            mensagem: `Perfeito! Registrei seu interesse. Assim que a TR Telecom chegar em ${args.cidade}, entraremos em contato no telefone ${args.telefone}. Obrigado! 🎉`
          });
        } catch (error) {
          console.error("❌ [Lead] Erro ao registrar lead sem cobertura:", error);
          return JSON.stringify({
            error: "Erro ao registrar seu interesse. Tente novamente."
          });
        }

      case "registrar_lead_prospeccao":
        console.log("📊 [AI Tool] registrar_lead_prospeccao chamada - salvando lead com interesse inicial");
        try {
          // ============================================================================
          // VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS PARA PROSPECÇÃO
          // ============================================================================
          const requiredProspectFields = ['nome', 'telefone'];
          const missingProspectFields = requiredProspectFields.filter(field => !args[field]);
          
          if (missingProspectFields.length > 0) {
            console.error("❌ [Prospect] Campos obrigatórios faltando:", missingProspectFields);
            return JSON.stringify({
              error: `Dados incompletos. Para registrar o lead, preciso de: ${missingProspectFields.join(', ')}`,
              campos_faltantes: missingProspectFields
            });
          }

          // Validar e normalizar nome (mínimo 3 caracteres)
          const prospectName = args.nome.trim();
          if (prospectName.length < 3) {
            console.error("❌ [Prospect] Nome muito curto:", prospectName);
            return JSON.stringify({
              error: "Nome inválido. Por favor, informe o nome completo (mínimo 3 caracteres)."
            });
          }

          // Validar e normalizar telefone (apenas números, mínimo 10 dígitos)
          const prospectPhone = args.telefone.replace(/\D/g, '');
          if (prospectPhone.length < 10 || prospectPhone.length > 11) {
            console.error("❌ [Prospect] Telefone inválido:", args.telefone);
            return JSON.stringify({
              error: "Telefone inválido. Por favor, informe um telefone válido com DDD (ex: (24) 99999-9999)."
            });
          }

          // Validar email se fornecido
          if (args.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(args.email)) {
              console.error("❌ [Prospect] Email inválido:", args.email);
              return JSON.stringify({
                error: "Email inválido. Por favor, informe um email válido (ex: nome@exemplo.com)."
              });
            }
          }

          // Preparar dados do lead em prospecção
          const prospectData = {
            type: args.tipo_pessoa || "PF", // PF ou PJ
            customerName: prospectName,
            email: args.email || null,
            phone: prospectPhone,
            city: args.cidade || null,
            state: args.estado || null,
            planId: args.plano_id || null, // ID do plano de interesse
            // Lead Management
            source: "chat",
            status: "Prospecção", // Status específico para leads em prospecção
            conversationId,
            observations: args.observacoes || `Lead com interesse inicial. ${args.plano_interesse ? `Plano de interesse: ${args.plano_interesse}` : ''}`
          };

          // Salvar no banco via storage
          const { storage: storageProspect } = await import("../storage");
          const prospect = await storageProspect.addSale(prospectData);

          console.log(`✅ [Prospect] Lead em prospecção registrado com sucesso - ID: ${prospect.id}, Nome: ${args.nome}`);

          // ============================================================================
          // SINCRONIZAÇÃO COM API COMERCIAL (dual-write)
          // Envia lead de prospecção para comercial.trtelecom.net (via site-lead)
          // ============================================================================
          const comercialPayloadProspect = {
            nome: prospectName,
            telefone: prospectPhone,
            email: args.email || undefined,
            cidade: args.cidade || undefined,
            estado: args.estado || undefined,
            plano_id: args.plano_id || undefined,
            plano_interesse: args.plano_interesse || undefined,
            observacoes: args.observacoes || `Lead de prospecção via LIA Bot. ${args.plano_interesse ? `Interesse: ${args.plano_interesse}` : ''}`,
          };
          
          syncWithComercialApi({
            type: 'lead_prospeccao',
            saleId: prospect.id,
            conversationId: conversationId,
            payload: comercialPayloadProspect,
          }).then(syncResult => {
            if (syncResult.success) {
              console.log(`✅ [Prospect] Sincronizado com sistema comercial`);
            } else if (syncResult.savedForRetry) {
              console.log(`📋 [Prospect] Lead salvo para sincronização posterior`);
            }
          }).catch(syncError => {
            console.error(`❌ [Prospect] Erro na sincronização (ignorado):`, syncError);
          });

          return JSON.stringify({
            success: true,
            lead_id: prospect.id,
            mensagem: `Lead registrado com sucesso! Vou anotar seu interesse. Nossa equipe pode entrar em contato para mais informações se necessário.`
          });
        } catch (error) {
          console.error("❌ [Prospect] Erro ao registrar lead em prospecção:", error);
          return JSON.stringify({
            error: "Erro ao registrar lead. Tente novamente."
          });
        }

      case "persistir_documento":
        // LGPD: CPF não é mais armazenado - apenas validado e usado diretamente
        if (!conversationId) {
          console.error(`❌ [AI Tool] persistir_documento chamada sem conversationId`);
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        try {
          const { validarDocumentoFlexivel, consultaBoletoCliente: consultaBoletoDoc } = await import("../ai-tools");
          const { storage: storageForBoleto } = await import("../storage");
          const { installationPointManager: pointManagerDoc } = await import("./redis-config");
          
          const cpfCnpj = args.cpf_cnpj;
          
          if (!cpfCnpj) {
            console.error("❌ [AI Tool] CPF/CNPJ/Código não fornecido");
            return JSON.stringify({
              error: "CPF, CNPJ ou Código de Cliente é obrigatório"
            });
          }
          
          console.log(`📝 [AI Tool] Validando documento do cliente (LGPD: sem armazenamento) - conversação: ${conversationId}`);
          
          // Validar e classificar documento (aceita CPF, CNPJ ou código de cliente)
          const validacao = validarDocumentoFlexivel(cpfCnpj);
          
          if (!validacao.valido) {
            console.warn(`⚠️ [AI Tool] Documento inválido: ${validacao.motivo || 'Documento inválido'}`);
            return JSON.stringify({
              error: validacao.motivo || 'Documento inválido'
            });
          }
          
          // LGPD: NÃO salvar CPF no banco de dados - usar diretamente para consulta
          console.log(`✅ [AI Tool] Documento validado (tipo: ${validacao.tipo}) - consultando boletos diretamente...`);
          
          // Chamar consulta de boletos diretamente com o CPF fornecido (storage usado apenas para contexto, não para persistir CPF)
          const resultadoBoletos = await consultaBoletoDoc(
            validacao.documentoNormalizado,
            { conversationId },
            storageForBoleto
          );
          
          // Tratar múltiplos pontos
          if (resultadoBoletos.hasMultiplePoints && resultadoBoletos.pontos) {
            const { pontos, totalBoletos } = resultadoBoletos;
            
            console.log(`🏠 [Boletos] Cliente possui ${pontos.length} pontos de instalação - apresentando menu`);
            
            // Salvar menu no Redis (efêmero - 5 minutos) COM o CPF temporário
            const menuItems = pontos.map((p: any) => ({
              numero: parseInt(p.numero),
              endereco: p.endereco,
              bairro: p.bairro,
              cidade: p.cidade,
              totalBoletos: p.totalBoletos,
              totalVencidos: p.totalVencidos,
              valorTotal: p.valorTotal,
              valorMensalidade: p.valorMensalidade,
              keywords: [
                p.endereco.toLowerCase(),
                p.bairro.toLowerCase(),
                p.cidade.toLowerCase(),
                p.numero
              ]
            }));
            
            await pointManagerDoc.saveMenu({
              conversationId,
              cpf: validacao.documentoNormalizado,
              pontos: menuItems,
              createdAt: Date.now()
            });
            
            console.log(`💾 [Boletos] Menu salvo no Redis com CPF temporário (TTL: 5min)`);
            
            // Construir menu formatado
            let menuFormatado = `📍 *Encontrei ${pontos.length} endereços cadastrados:*\n\n`;
            
            pontos.forEach((ponto: any, index: number) => {
              const numero = index + 1;
              menuFormatado += `${numero}️⃣ *${ponto.endereco}*\n`;
              menuFormatado += `   📌 ${ponto.bairro} - ${ponto.cidade}\n`;
              menuFormatado += `   📦 Mensalidade: R$ ${ponto.valorMensalidade.toFixed(2)}\n`;
              if (ponto.totalVencidos > 0) {
                menuFormatado += `   ⚠️ ${ponto.totalVencidos} boleto(s) vencido(s)\n`;
              }
              menuFormatado += '\n';
            });
            
            menuFormatado += '\n*Qual endereço você deseja consultar?*\n';
            menuFormatado += '_Responda com o número ou o nome do bairro._';
            
            return JSON.stringify({
              success: true,
              hasMultiplePoints: true,
              menuParaCliente: menuFormatado,
              totalPontos: pontos.length,
              totalBoletos
            });
          }
          
          // Ponto único - retornar boletos diretamente
          const { boletos } = resultadoBoletos;
          
          if (!boletos || boletos.length === 0) {
            return JSON.stringify({
              success: true,
              mensagem: "Cliente está EM DIA - sem boletos pendentes, vencidos ou em aberto.",
              boletos: []
            });
          }
          
          const boletosFormatados = boletos.map((boleto: any) => ({
            vencimento: boleto.DATA_VENCIMENTO || 'Não disponível',
            valor: boleto.VALOR_TOTAL || '0.00',
            codigo_barras: boleto.CODIGO_BARRA_TRANSACAO || '',
            codigo_barras_sem_espacos: boleto.CODIGO_BARRA_TRANSACAO?.replace(/\D/g, '') || '',
            link_pagamento: boleto.link_carne_completo || '',
            pix: boleto.PIX_TXT || '',
            status: boleto.STATUS || 'DESCONHECIDO'
          }));
          
          return JSON.stringify({
            success: true,
            boletos: boletosFormatados
          });
          
        } catch (error) {
          console.error("❌ [AI Tool] Erro ao consultar boletos:", error);
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao consultar boletos",
            instrucao_ia: "ATENÇÃO: A consulta de boletos FALHOU. NÃO invente dados. Informe ao cliente que houve um problema técnico temporário."
          });
        }

      case "consultar_faturas":
      case "consultar_boleto_cliente":
        // LGPD: CPF deve ser fornecido a cada consulta - não usar CPF armazenado
        console.log(`🚨 [DEBUG] ENTRANDO NO CASE ${functionName} - conversationId: ${conversationId || 'UNDEFINED'}`);
        if (!conversationId) {
          console.error(`❌ [AI Tool] ${functionName} chamada sem conversationId`);
          return JSON.stringify({
            error: "Contexto de conversa não disponível para consulta de boletos"
          });
        }
        
        const { consultaBoletoCliente } = await import("../ai-tools");
        const { storage } = await import("../storage");
        const { installationPointManager } = await import("./redis-config");
        const { extractDocumentoFromHistory } = await import("./cpf-context-injector");
        
        try {
          console.log(`🔍 [AI Tool Handler] Iniciando consulta de boletos para conversação ${conversationId}`);
          
          // LGPD: Verificar se documento (CPF ou CNPJ) foi fornecido nos argumentos
          let documentoFornecido = args.documento || args.cpf || args.cpf_cnpj || args.cnpj;
          
          // CRÍTICO: Se documento não veio nos argumentos, tentar extrair da MENSAGEM ATUAL primeiro
          // Isso resolve o bug onde a mensagem atual ainda não está no DB quando a função é chamada
          if (!documentoFornecido && currentUserMessage) {
            console.log(`🔍 [AI Tool] Documento não nos argumentos - tentando extrair da MENSAGEM ATUAL...`);
            const currentMessageAsArray = [{ content: currentUserMessage, role: 'user' as const }];
            const docFromCurrentMessage = extractDocumentoFromHistory(currentMessageAsArray);
            if (docFromCurrentMessage) {
              documentoFornecido = docFromCurrentMessage.documento;
              console.log(`✅ [AI Tool] ${docFromCurrentMessage.tipo} extraído da MENSAGEM ATUAL: ${docFromCurrentMessage.formatado}`);
            }
          }
          
          // Se ainda não encontrou, tentar extrair do histórico de mensagens no DB
          if (!documentoFornecido) {
            console.log(`🔍 [AI Tool] Documento não na mensagem atual - tentando extrair do histórico DB...`);
            try {
              const mensagensHistorico = await storage.getMessagesByConversationId(conversationId);
              const messagesForExtraction = mensagensHistorico.slice(-50).map((m: { content: string; role: string }) => ({
                content: m.content,
                role: m.role as 'user' | 'assistant'
              }));
              // IMPORTANTE: extractDocumentoFromHistory tenta CNPJ primeiro (14 dígitos), depois CPF (11 dígitos)
              const documentoExtraido = extractDocumentoFromHistory(messagesForExtraction);
              if (documentoExtraido) {
                documentoFornecido = documentoExtraido.documento;
                console.log(`✅ [AI Tool] ${documentoExtraido.tipo} extraído do histórico DB: ${documentoExtraido.formatado}`);
              }
            } catch (err) {
              console.warn(`⚠️ [AI Tool] Erro ao extrair documento do histórico:`, err);
            }
          }
          
          if (!documentoFornecido) {
            // LGPD: SEMPRE solicitar documento - não usar documento armazenado
            console.warn("⚠️ [AI Tool] LGPD: Documento não fornecido e não encontrado - solicitando ao cliente");
            return JSON.stringify({
              error: "Para consultar seus boletos, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
            });
          }
          
          console.log(`🔍 [AI Tool Handler] Chamando consultaBoletoCliente com documento fornecido (LGPD: sem armazenamento)...`);
          
          // LGPD: Validar documento fornecido (CPF ou CNPJ)
          const { validarDocumentoFlexivel } = await import("../ai-tools");
          const validacaoDocumento = validarDocumentoFlexivel(documentoFornecido);
          
          if (!validacaoDocumento.valido) {
            return JSON.stringify({
              error: validacaoDocumento.motivo || 'Documento inválido'
            });
          }
          
          const documentoNormalizado = validacaoDocumento.documentoNormalizado;
          
          // Chamar diretamente a API real - pode retornar { boletos, hasMultiplePoints } OU { pontos, hasMultiplePoints }
          const resultadoBoletos = await consultaBoletoCliente(
            documentoNormalizado,
            { conversationId },
            storage
          );
          
          // ====================================
          // TRATAMENTO DE MÚLTIPLOS PONTOS (NOVA ARQUITETURA EFÊMERA)
          // ====================================
          if (resultadoBoletos.hasMultiplePoints && resultadoBoletos.pontos) {
            const { pontos, totalBoletos } = resultadoBoletos;
            
            console.log(`🏠 [Boletos] Cliente possui ${pontos.length} pontos de instalação - apresentando menu`);
            
            // Formatar pontos para apresentação à IA
            const pontosFormatados = pontos.map(p => ({
              numero: p.numero,
              endereco: `${p.endereco}, ${p.bairro} - ${p.cidade}`,
              totalBoletos: p.totalBoletos,
              totalVencidos: p.totalVencidos,
              valorTotal: `R$ ${p.valorTotal.toFixed(2)}`
            }));
            
            // 🆕 NOVA ARQUITETURA: Salvar menu no Redis (efêmero - 5 minutos)
            // Gerar keywords para cada ponto (para matching textual)
            const menuItems = pontos.map(p => ({
              numero: parseInt(p.numero),
              endereco: p.endereco,
              bairro: p.bairro,
              cidade: p.cidade,
              totalBoletos: p.totalBoletos,
              totalVencidos: p.totalVencidos,
              valorTotal: p.valorTotal,
              valorMensalidade: p.valorMensalidade,
              keywords: [
                p.endereco.toLowerCase(),
                p.bairro.toLowerCase(),
                p.cidade.toLowerCase(),
                p.numero
              ]
            }));
            
            // LGPD: Salvar documento no Redis temporário (5min) apenas para seleção de ponto
            await installationPointManager.saveMenu({
              conversationId,
              cpf: documentoNormalizado, // Aceita CPF ou CNPJ
              pontos: menuItems,
              createdAt: Date.now()
            });
            
            console.log(`💾 [Boletos] Menu salvo no Redis - aguardando seleção do cliente (TTL: 5min)`);
            
            // Construir menu formatado para a IA apresentar ao cliente
            let menuFormatado = `📍 *Encontrei ${pontos.length} endereços cadastrados no seu documento:*\n\n`;
            
            pontos.forEach((ponto, index) => {
              const numero = index + 1;
              menuFormatado += `${numero}️⃣ *${ponto.endereco}*\n`;
              menuFormatado += `   📌 ${ponto.bairro} - ${ponto.cidade}\n`;
              menuFormatado += `   📦 Mensalidade: R$ ${ponto.valorMensalidade.toFixed(2)}\n`;
              if (ponto.totalVencidos > 0) {
                menuFormatado += `   ⚠️ ${ponto.totalVencidos} boleto(s) vencido(s)\n`;
                menuFormatado += `   💰 Total vencido: R$ ${ponto.valorVencido.toFixed(2)}\n`;
              } else {
                menuFormatado += `   ✅ Em dia\n`;
              }
              menuFormatado += `\n`;
            });
            
            menuFormatado += `*Qual endereço você deseja consultar?*\nResponda com o *número* (1, 2, 3...) ou o *nome do bairro/rua*.`;
            
            return JSON.stringify({
              status: "MULTIPLOS_PONTOS_DETECTADOS",
              mensagem: menuFormatado,
              totalBoletos,
              pontos: pontosFormatados,
              instrucao_ia: "IMPORTANTE: Copie EXATAMENTE a mensagem acima e envie ao cliente. NÃO altere a formatação. Aguarde a resposta do cliente (número ou nome). O sistema processará automaticamente a escolha dele."
            });
          }
          
          // ====================================
          // PONTO ÚNICO (FLUXO NORMAL)
          // ====================================
          const { boletos } = resultadoBoletos;
          
          console.log(`✅ [AI Tool Handler] Boletos consultados com sucesso: ${boletos?.length || 0} boleto(s) EM ABERTO`);
          
          // Formatar resposta com mensagem clara para a IA
          if (!boletos || boletos.length === 0) {
            return JSON.stringify({
              status: "EM_DIA",
              mensagem: "Cliente está EM DIA - sem boletos pendentes, vencidos ou em aberto.",
              boletos: []
            });
          }
          
          // Mapear boletos para incluir link na descrição formatada
          // Defensive: Ensure all fields are strings to prevent downstream formatting errors
          const boletosFormatados = boletos.map(boleto => ({
            vencimento: boleto.DATA_VENCIMENTO || 'Não disponível',
            valor: boleto.VALOR_TOTAL || '0.00',
            codigo_barras: boleto.CODIGO_BARRA_TRANSACAO || '',
            codigo_barras_sem_espacos: boleto.CODIGO_BARRA_TRANSACAO?.replace(/\D/g, '') || '',
            link_pagamento: boleto.link_carne_completo || '',
            pix: boleto.PIX_TXT || '',
            status: boleto.STATUS || 'DESCONHECIDO'
          }));
          
          // CRITICAL FIX: Detect malformed boleto data from TR Telecom API
          // If boleto exists but has undefined/empty vencimento AND valor, the API returned incomplete data
          const boletosComDadosValidos = boletosFormatados.filter(b => 
            b.vencimento !== 'Não disponível' || b.valor !== '0.00'
          );
          
          const boletosComDadosIncompletos = boletosFormatados.filter(b => 
            b.vencimento === 'Não disponível' && b.valor === '0.00'
          );
          
          if (boletosComDadosIncompletos.length > 0) {
            console.warn(`⚠️ [AI Tool Handler] ${boletosComDadosIncompletos.length} boleto(s) com dados INCOMPLETOS detectados!`);
            console.warn(`   - Status recebido: ${boletosComDadosIncompletos.map(b => b.status).join(', ')}`);
            
            // If ALL boletos have incomplete data, return error status
            if (boletosComDadosValidos.length === 0) {
              console.error(`❌ [AI Tool Handler] TODOS os boletos têm dados incompletos - problema na API TR Telecom`);
              return JSON.stringify({
                status: "DADOS_INCOMPLETOS",
                mensagem: "A API do sistema financeiro retornou boleto(s) mas com dados incompletos (vencimento e valor não disponíveis). Isso indica um problema temporário no sistema financeiro da TR Telecom.",
                boletos_detectados: boletos.length,
                instrucao_ia: "IMPORTANTE: Existe(m) boleto(s) no sistema, mas os dados estão incompletos no momento. Informe ao cliente que foi identificado boleto em aberto, mas que há uma instabilidade temporária no sistema que impede a visualização completa dos dados. Ofereça TRANSFERIR para um atendente humano para resolver a situação ou peça para o cliente tentar novamente em alguns minutos."
              });
            }
            
            // If some boletos have data and some don't, return valid ones with warning
            console.warn(`⚠️ [AI Tool Handler] Retornando apenas ${boletosComDadosValidos.length} boleto(s) com dados válidos`);
          }
          
          return JSON.stringify({
            status: "success",
            boletos: boletosComDadosValidos.length > 0 ? boletosComDadosValidos : boletosFormatados
          });
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao consultar boletos:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
            console.error("❌ [AI Tool Handler] Tipo de erro:", error.constructor.name);
          }
          
          // IMPORTANTE: Retornar erro ESTRUTURADO para que a IA NUNCA use dados mockados
          return JSON.stringify({
            status: "ERRO_API",
            error: error instanceof Error ? error.message : "Erro ao consultar boletos",
            instrucao_ia: "ATENÇÃO: A consulta de boletos FALHOU. NÃO invente dados. NÃO use exemplos. Informe ao cliente que houve um problema técnico temporário e peça para tentar novamente em alguns minutos ou ofereça transferir para atendimento humano."
          });
        }

      case "consultar_nota_fiscal":
        console.log(`📄 [AI Tool Handler] Iniciando consulta de nota fiscal - conversationId: ${conversationId || 'UNDEFINED'}`);
        if (!conversationId) {
          console.error(`❌ [AI Tool] consultar_nota_fiscal chamada sem conversationId`);
          return JSON.stringify({
            error: "Contexto de conversa não disponível para consulta de notas fiscais"
          });
        }
        
        const { consultaNotaFiscal } = await import("../ai-tools");
        const { storage: storageNF } = await import("../storage");
        const { extractDocumentoFromHistory: extractDocNF } = await import("./cpf-context-injector");
        
        try {
          // LGPD: Verificar se documento (CPF ou CNPJ) foi fornecido nos argumentos
          let documentoNF = args.documento || args.cpf || args.cpf_cnpj || args.cnpj;
          
          // Se documento não veio nos argumentos, tentar extrair da mensagem atual
          if (!documentoNF && currentUserMessage) {
            console.log(`🔍 [AI Tool] NF - Documento não nos argumentos - tentando extrair da mensagem atual...`);
            const currentMsgArrayNF = [{ content: currentUserMessage, role: 'user' as const }];
            const docFromCurrentNF = extractDocNF(currentMsgArrayNF);
            if (docFromCurrentNF) {
              documentoNF = docFromCurrentNF.documento;
              console.log(`✅ [AI Tool] NF - ${docFromCurrentNF.tipo} extraído da mensagem atual: ${docFromCurrentNF.formatado}`);
            }
          }
          
          // Se ainda não encontrou, tentar extrair do histórico de mensagens
          if (!documentoNF) {
            console.log(`🔍 [AI Tool] NF - Documento não na mensagem atual - tentando extrair do histórico...`);
            try {
              const mensagensHistoricoNF = await storageNF.getMessagesByConversationId(conversationId);
              const messagesForExtractionNF = mensagensHistoricoNF.slice(-50).map((m: { content: string; role: string }) => ({
                content: m.content,
                role: m.role as 'user' | 'assistant'
              }));
              const documentoExtraidoNF = extractDocNF(messagesForExtractionNF);
              if (documentoExtraidoNF) {
                documentoNF = documentoExtraidoNF.documento;
                console.log(`✅ [AI Tool] NF - ${documentoExtraidoNF.tipo} extraído do histórico: ${documentoExtraidoNF.formatado}`);
              }
            } catch (err) {
              console.warn(`⚠️ [AI Tool] NF - Erro ao extrair documento do histórico:`, err);
            }
          }
          
          if (!documentoNF) {
            console.warn("⚠️ [AI Tool] NF - LGPD: Documento não fornecido - solicitando ao cliente");
            return JSON.stringify({
              error: "Para consultar suas notas fiscais, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
            });
          }
          
          // Validar documento
          const { validarDocumentoFlexivel: validarDocNF } = await import("../ai-tools");
          const validacaoNF = validarDocNF(documentoNF);
          
          if (!validacaoNF.valido) {
            return JSON.stringify({
              error: validacaoNF.motivo || 'Documento inválido'
            });
          }
          
          console.log(`📄 [AI Tool Handler] Chamando consultaNotaFiscal...`);
          
          const resultadoNF = await consultaNotaFiscal(
            validacaoNF.documentoNormalizado,
            { conversationId },
            storageNF
          );
          
          if (!resultadoNF.sucesso) {
            return JSON.stringify({
              status: "ERRO_API",
              error: resultadoNF.mensagem || "Erro ao consultar notas fiscais",
              instrucao_ia: "ATENÇÃO: A consulta de notas fiscais FALHOU. NÃO invente dados. Informe ao cliente que houve um problema técnico temporário."
            });
          }
          
          if (resultadoNF.totalNotas === 0) {
            return JSON.stringify({
              status: "SEM_NOTAS",
              mensagem: "Não foram encontradas notas fiscais para este documento.",
              notas: []
            });
          }
          
          // Formatar notas para apresentação
          const notasFormatadas = resultadoNF.notas.map(nf => ({
            numero: nf.numero_nf,
            data_emissao: nf.data_emissao,
            mes_referencia: nf.mes_referencia,
            link_download: nf.link_download
          }));
          
          console.log(`✅ [AI Tool Handler] ${resultadoNF.totalNotas} nota(s) fiscal(is) encontrada(s)`);
          
          return JSON.stringify({
            status: "success",
            total: resultadoNF.totalNotas,
            notas: notasFormatadas,
            instrucao_ia: "Apresente as notas fiscais ao cliente com os links para download. Cada nota tem número, data de emissão, mês de referência e link para baixar/imprimir."
          });
          
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao consultar notas fiscais:", error);
          return JSON.stringify({
            status: "ERRO_API",
            error: error instanceof Error ? error.message : "Erro ao consultar notas fiscais",
            instrucao_ia: "ATENÇÃO: A consulta de notas fiscais FALHOU. NÃO invente dados. Informe ao cliente que houve um problema técnico temporário."
          });
        }

      case "solicitarDesbloqueio":
        if (!conversationId) {
          console.error("❌ [AI Tool] solicitarDesbloqueio chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { solicitarDesbloqueio } = await import("../ai-tools");
        const { storage: storageDesbloqueio } = await import("../storage");
        
        try {
          console.log(`🔓 [AI Tool Handler] Iniciando solicitação de desbloqueio para conversação ${conversationId}`);
          
          // Buscar documento do cliente automaticamente da conversa
          const conversationDesbloqueio = await storageDesbloqueio.getConversation(conversationId);
          
          if (!conversationDesbloqueio) {
            console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
            return JSON.stringify({
              error: "Conversa não encontrada"
            });
          }
          
          console.log(`🔓 [AI Tool Handler] Conversa encontrada. clientDocument: ${conversationDesbloqueio.clientDocument ? 'SIM' : 'NÃO'}`);
          
          let documentoParaDesbloqueio = conversationDesbloqueio.clientDocument;
          
          // ESTRATÉGIA LGPD: Se não houver documento no banco, extrair do histórico
          if (!documentoParaDesbloqueio) {
            console.log(`🔍 [AI Tool Handler] CPF não no banco (LGPD), tentando extrair do histórico...`);
            const { extractCPFFromHistory } = await import("./cpf-context-injector");
            const messagesForDesbloqueio = await storageDesbloqueio.getMessagesByConversationId(conversationId);
            const cpfExtraidoDesbloqueio = extractCPFFromHistory(
              messagesForDesbloqueio.map(m => ({ content: m.content, role: m.role as 'user' | 'assistant' }))
            );
            
            if (cpfExtraidoDesbloqueio) {
              documentoParaDesbloqueio = cpfExtraidoDesbloqueio;
              console.log(`✅ [AI Tool Handler] CPF extraído do histórico para desbloqueio: ${cpfExtraidoDesbloqueio.slice(0, 3)}...`);
            } else {
              console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ - não encontrado no histórico");
              return JSON.stringify({
                error: "Para solicitar desbloqueio, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
              });
            }
          }
          
          console.log(`🔓 [AI Tool Handler] Chamando solicitarDesbloqueio com documento...`);
          
          // Chamar diretamente a API real de desbloqueio
          const resultado = await solicitarDesbloqueio(
            documentoParaDesbloqueio,
            { conversationId },
            storageDesbloqueio
          );
          
          console.log(`✅ [AI Tool Handler] Desbloqueio solicitado com sucesso:`, resultado);
          
          // Extrair mensagem de resposta da API
          const obs = resultado.data?.[0]?.resposta?.[0]?.obs || "";
          const status = resultado.data?.[0]?.status?.[0]?.status || "";
          
          // 🔓 PERSISTIR METADATA: Registrar desbloqueio em confiança na conversa
          if (status === 'S' || status === 'Y' || obs.toLowerCase().includes('sucesso') || obs.toLowerCase().includes('liberado')) {
            const currentMetadata = (conversationDesbloqueio.metadata || {}) as any;
            await storageDesbloqueio.updateConversation(conversationId, {
              metadata: {
                ...currentMetadata,
                unlockInTrust: true,
                unlockTimestamp: new Date().toISOString(),
                unlockObs: obs
              }
            });
            console.log(`🔓 [AI Tool Handler] Metadata de desbloqueio em confiança persistida na conversa ${conversationId}`);
          }
          
          return JSON.stringify({
            success: true,
            mensagem: obs || "Desbloqueio solicitado com sucesso",
            status: status,
            detalhes: resultado
          });
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao solicitar desbloqueio:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
          }
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao solicitar desbloqueio"
          });
        }

      case "consultar_ordem_servico_aberta":
        if (!conversationId) {
          console.error("❌ [AI Tool] consultar_ordem_servico_aberta chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { consultarOrdemServicoAberta } = await import("../ai-tools");
        const { storage: storageOS } = await import("../storage");
        
        try {
          console.log(`🔧 [AI Tool Handler] Iniciando consulta de OS em aberto para conversação ${conversationId}`);
          
          // Buscar documento do cliente automaticamente da conversa
          const conversationOS = await storageOS.getConversation(conversationId);
          
          if (!conversationOS) {
            console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
            return JSON.stringify({
              error: "Conversa não encontrada"
            });
          }
          
          console.log(`🔧 [AI Tool Handler] Conversa encontrada. clientDocument: ${conversationOS.clientDocument ? 'SIM' : 'NÃO'}`);
          
          if (!conversationOS.clientDocument) {
            console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
            return JSON.stringify({
              error: "Para consultar sua ordem de serviço, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
            });
          }
          
          console.log(`🔧 [AI Tool Handler] Chamando consultarOrdemServicoAberta com documento do banco...`);
          
          // Chamar diretamente a API real de consulta de OS
          const resultado = await consultarOrdemServicoAberta(
            conversationOS.clientDocument,
            { conversationId },
            storageOS
          );
          
          const existeOsAtiva = resultado.existe_os_ativa === "true";
          
          console.log(`✅ [AI Tool Handler] Consulta de OS concluída - Existe OS ativa: ${existeOsAtiva ? 'SIM' : 'NÃO'}`);
          
          return JSON.stringify({
            success: true,
            existe_os_ativa: existeOsAtiva,
            mensagem: existeOsAtiva 
              ? "Cliente possui ordem de serviço em aberto/andamento"
              : "Cliente não possui ordem de serviço em aberto"
          });
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao consultar OS em aberto:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
          }
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao consultar ordem de serviço"
          });
        }

      case "abrir_ticket_crm":
        if (!conversationId) {
          console.error("❌ [AI Tool] abrir_ticket_crm chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { abrirTicketCRM } = await import("../ai-tools");
        const { storage: storageTicket } = await import("../storage");
        
        try {
          console.log(`🎫 [AI Tool Handler] Iniciando abertura de ticket para conversação ${conversationId}`);
          
          // Validação de argumentos obrigatórios
          const resumoTicket = args.resumo || args.summary;
          const setorTicket = args.setor || args.department;
          const motivoTicket = args.motivo || args.reason;
          
          if (!resumoTicket || !setorTicket || !motivoTicket) {
            console.error("❌ [AI Tool] Argumentos obrigatórios faltando:", { resumo: !!resumoTicket, setor: !!setorTicket, motivo: !!motivoTicket });
            return JSON.stringify({
              error: "Parâmetros obrigatórios faltando. É necessário: resumo, setor e motivo."
            });
          }
          
          // Buscar conversa no banco
          const conversationTicket = await storageTicket.getConversation(conversationId);
          
          if (!conversationTicket) {
            console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
            return JSON.stringify({
              error: "Conversa não encontrada"
            });
          }
          
          console.log(`🎫 [AI Tool Handler] Conversa encontrada. clientDocument: ${conversationTicket.clientDocument ? 'SIM' : 'NÃO'}`);
          
          // LGPD Compliance: Tentar extrair CPF do histórico se não estiver no banco
          let clientDocumentTicket = conversationTicket.clientDocument;
          
          if (!clientDocumentTicket) {
            console.log(`🔍 [AI Tool Handler] CPF não encontrado no banco, buscando no histórico...`);
            
            // Buscar mensagens da conversa
            const messagesForCPF = await storageTicket.getRecentMessagesByConversationId(conversationId, 50);
            const { extractCPFFromHistory } = await import("./cpf-context-injector");
            
            const extractedCPF = extractCPFFromHistory(messagesForCPF.map((m: { content: string; role: string }) => ({
              content: m.content,
              role: m.role as 'user' | 'assistant'
            })));
            
            if (extractedCPF) {
              clientDocumentTicket = extractedCPF;
              console.log(`✅ [AI Tool Handler] CPF extraído do histórico: ***.***.***-${extractedCPF.slice(-2)}`);
            }
          }
          
          if (!clientDocumentTicket) {
            console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
            return JSON.stringify({
              error: "Para abrir um ticket, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento."
            });
          }
          
          // Recuperar imageUrl do metadata (se disponível E recente)
          const metadata = conversationTicket?.metadata as any;
          let imageUrl = metadata?.lastImageUrl;
          
          // VALIDAÇÃO DE FRESHNESS: só usar link se foi processado recentemente (últimos 5 minutos)
          if (imageUrl) {
            // CRÍTICO: Ignorar metadata legado sem timestamp (conversas antigas)
            if (!metadata?.lastImageProcessedAt) {
              console.log(`⚠️ [AI Tool Security] imageUrl ignorado - metadata legado sem timestamp`);
              imageUrl = null; // Ignorar e limpar metadata legado
              
              // Limpar metadata legado
              await storageTicket.updateConversation(conversationId, {
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
          
          console.log(`🎫 [AI Tool Handler] Chamando abrirTicketCRM...`, { setor: setorTicket, motivo: motivoTicket, comprovanteUrl: imageUrl ? 'SIM' : 'NÃO', cpfExtraido: !!clientDocumentTicket });
          
          // Chamar função de abertura de ticket COM link do comprovante E CPF extraído (LGPD)
          const resultado = await abrirTicketCRM(
            resumoTicket,
            setorTicket,
            motivoTicket,
            { conversationId },
            storageTicket,
            imageUrl,           // ← LINK DO COMPROVANTE
            clientDocumentTicket // ← CPF EXTRAÍDO DO HISTÓRICO (LGPD)
          );
          
          // Extrair protocolo da resposta
          const protocolo = resultado?.data?.[0]?.resposta?.[0]?.protocolo || 'ERRO_SEM_PROTOCOLO';
          
          console.log(`✅ [AI Tool Handler] Ticket aberto com sucesso - Protocolo: ${protocolo}`);
          
          return JSON.stringify({
            success: true,
            protocolo: protocolo,
            setor: setorTicket.toUpperCase(),
            motivo: motivoTicket.toUpperCase(),
            mensagem: `Ticket aberto com sucesso! Protocolo: ${protocolo}. O setor ${setorTicket.toUpperCase()} irá processar seu atendimento.`,
            detalhes: resultado
          });
        } catch (error) {
          console.error("❌ [AI Tool Handler] Erro ao abrir ticket:", error);
          if (error instanceof Error) {
            console.error("❌ [AI Tool Handler] Stack trace:", error.stack);
          }
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao abrir ticket no CRM",
            instrucao_ia: "Não foi possível abrir o ticket automaticamente. Por favor, informe ao cliente que houve um problema técnico e transfira para atendimento humano."
          });
        }

      case "priorizar_atendimento_tecnico":
        if (!conversationId) {
          console.error("❌ [AI Tool] priorizar_atendimento_tecnico chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { storage: storagePrioridade } = await import("../storage");
        const { checkRecurrence } = await import("./conversation-intelligence");
        
        try {
          const conversationPrioridade = await storagePrioridade.getConversation(conversationId);
          
          if (!conversationPrioridade) {
            return JSON.stringify({ error: "Conversa não encontrada" });
          }
          
          const motivoPrioridade = args.motivo || "Problema recorrente detectado";
          const tipoProblema = args.tipo_problema || "tecnico";
          
          // Verificar recorrência se houver CPF
          let recorrencia = null;
          if (conversationPrioridade.clientDocument) {
            recorrencia = await checkRecurrence(
              conversationPrioridade.clientDocument,
              tipoProblema,
              30
            );
          }
          
          // Criar protocolo de atendimento prioritário
          const protocolo = `PRIOR-${Date.now().toString().slice(-6)}`;
          
          // Atualizar metadata da conversa
          const metadata = (conversationPrioridade.metadata as any) || {};
          await storagePrioridade.updateConversation(conversationId, {
            urgency: "critical",
            metadata: {
              ...metadata,
              atendimentoPrioritario: {
                ativado: true,
                protocolo,
                motivo: motivoPrioridade,
                tipoProblema,
                recorrencia: recorrencia?.isRecurrent ? {
                  ocorrencias: recorrencia.previousOccurrences,
                  ultimaOcorrencia: recorrencia.lastOccurrence
                } : null,
                criadoEm: new Date().toISOString()
              }
            }
          });
          
          console.log(`🚨 [Prioridade] Atendimento técnico priorizado:`, {
            conversationId,
            protocolo,
            motivo: motivoPrioridade,
            recorrente: recorrencia?.isRecurrent
          });
          
          return JSON.stringify({
            success: true,
            protocolo,
            prazo: "URGENTE - Atendimento em até 4 horas",
            motivo: motivoPrioridade,
            recorrencia: recorrencia?.isRecurrent ? {
              ocorrencias: recorrencia.previousOccurrences,
              mensagem: `Detectamos ${recorrencia.previousOccurrences} ocorrência(s) similar(es) nos últimos 30 dias`
            } : null,
            mensagem: recorrencia?.isRecurrent 
              ? `Seu atendimento foi PRIORIZADO devido à recorrência do problema (${recorrencia.previousOccurrences}x nos últimos 30 dias). Protocolo: ${protocolo}. Nossa equipe técnica entrará em contato em até 4 horas para resolver definitivamente.`
              : `Seu atendimento foi PRIORIZADO. Protocolo: ${protocolo}. Nossa equipe técnica entrará em contato em até 4 horas.`
          });
        } catch (error) {
          console.error("❌ [Prioridade] Erro ao priorizar atendimento:", error);
          return JSON.stringify({
            error: "Não foi possível priorizar o atendimento. Tente novamente."
          });
        }

      case "selecionar_ponto_instalacao":
        if (!conversationId) {
          console.error("❌ [AI Tool] selecionar_ponto_instalacao chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        const { selecionarPontoInstalacao } = await import("../ai-tools");
        const { storage: storageSelecao } = await import("../storage");
        
        try {
          console.log(`🔀 [AI Tool Handler] Selecionando ponto de instalação para conversação ${conversationId}`);
          
          const result = await selecionarPontoInstalacao(
            args.numeroPonto,
            { conversationId },
            storageSelecao
          );
          
          return JSON.stringify(result);
        } catch (error) {
          console.error("❌ [Seleção] Erro ao selecionar ponto de instalação:", error);
          return JSON.stringify({
            error: "Não foi possível selecionar o ponto de instalação. Tente novamente."
          });
        }

      case "atualizar_status_cobranca":
        console.log(`💰 [Cobranças] Atualizando status do target - CPF/CNPJ: ${args.cpf_cnpj}, Status: ${args.status}`);
        
        try {
          const { storage: storageCobranca } = await import("../storage");
          const { db: dbCobranca } = await import("../db");
          const { voiceCampaignTargets } = await import("../../shared/schema");
          const { eq: eqCobranca } = await import("drizzle-orm");
          
          // Buscar target por CPF/CNPJ
          const target = await dbCobranca.query.voiceCampaignTargets.findFirst({
            where: eqCobranca(voiceCampaignTargets.debtorDocument, args.cpf_cnpj)
          });
          
          if (!target) {
            console.warn(`⚠️ [Cobranças] Nenhum target encontrado com CPF/CNPJ: ${args.cpf_cnpj}`);
            return JSON.stringify({
              success: false,
              mensagem: "Registro de cobrança não encontrado para este cliente."
            });
          }
          
          // Atualizar state e outcome do target
          await dbCobranca.update(voiceCampaignTargets)
            .set({
              state: 'completed', // Marcar target como completo
              outcome: args.status, // 'paid' ou 'promise_made'
              outcomeDetails: args.observacao || null,
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eqCobranca(voiceCampaignTargets.id, target.id));
          
          console.log(`✅ [Cobranças] Target ${target.id} atualizado para status: ${args.status}`);
          
          return JSON.stringify({
            success: true,
            mensagem: `Status atualizado com sucesso! Cliente marcado como ${args.status === 'paid' ? 'pago' : 'promessa registrada'}.`
          });
        } catch (error) {
          console.error("❌ [Cobranças] Erro ao atualizar status:", error);
          return JSON.stringify({
            error: "Não foi possível atualizar o status. Tente novamente."
          });
        }

      case "registrar_promessa_pagamento":
        console.log(`📝 [Promessa] Registrando promessa de pagamento - CPF/CNPJ: ${args.cpf_cnpj}, Data: ${args.data_prevista_pagamento}`);
        
        if (!conversationId) {
          console.error("❌ [Promessa] Chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível"
          });
        }
        
        try {
          const { storage: storagePromessa } = await import("../storage");
          const { db: dbPromessa } = await import("../db");
          const { voiceCampaignTargets, conversations } = await import("../../shared/schema");
          const { eq: eqPromessa } = await import("drizzle-orm");
          const { addVoicePromiseMonitorToQueue } = await import("../lib/queue");
          
          // Buscar conversa para obter informações
          const conversation = await storagePromessa.getConversation(conversationId);
          if (!conversation) {
            return JSON.stringify({
              error: "Conversa não encontrada"
            });
          }
          
          // Buscar target por CPF/CNPJ
          const target = await dbPromessa.query.voiceCampaignTargets.findFirst({
            where: eqPromessa(voiceCampaignTargets.debtorDocument, args.cpf_cnpj)
          });
          
          if (!target) {
            console.warn(`⚠️ [Promessa] Target não encontrado - criando promessa sem vínculo de campanha`);
          }
          
          // Converter data_prevista_pagamento (string DD/MM/YYYY) para Date
          // IMPORTANTE: Definir horário como 23:59:59 para que a promessa seja válida durante TODO o dia prometido
          let dueDate: Date;
          try {
            const [day, month, year] = args.data_prevista_pagamento.split('/');
            dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999);
          } catch (error) {
            return JSON.stringify({
              error: "Data inválida. Use o formato DD/MM/YYYY (ex: 15/01/2025)"
            });
          }
          
          // Validar se a data é futura
          if (dueDate <= new Date()) {
            return JSON.stringify({
              error: "A data de pagamento deve ser no futuro"
            });
          }
          
          // ============================================================================
          // VALIDAÇÃO: Cliente só pode ter UMA promessa ativa por vez
          // ============================================================================
          const { voicePromises } = await import("../../shared/schema");
          const { and: andPromise, gte: gtePromise } = await import("drizzle-orm");
          
          const existingActivePromises = await dbPromessa.query.voicePromises.findMany({
            where: andPromise(
              eqPromessa(voicePromises.contactDocument, args.cpf_cnpj),
              eqPromessa(voicePromises.status, 'pending'),
              gtePromise(voicePromises.dueDate, new Date()) // Promessa ainda válida (não vencida)
            )
          });
          
          if (existingActivePromises.length > 0) {
            const existingPromise = existingActivePromises[0];
            const existingDate = new Date(existingPromise.dueDate!);
            const formattedDate = `${existingDate.getDate().toString().padStart(2, '0')}/${(existingDate.getMonth() + 1).toString().padStart(2, '0')}/${existingDate.getFullYear()}`;
            
            console.warn(`⚠️ [Promessa] Cliente ${args.cpf_cnpj} já tem promessa ativa até ${formattedDate}`);
            
            return JSON.stringify({
              success: false,
              mensagem: `Você já tem um compromisso de pagamento registrado para o dia ${formattedDate}. ` +
                       `Não é possível fazer uma nova promessa. Por favor, cumpra a promessa atual primeiro. 🙏`
            });
          }
          
          console.log(`✅ [Promessa] Cliente ${args.cpf_cnpj} não tem promessas ativas - prosseguindo com registro`);
          
          // Criar promessa de pagamento
          const promise = await storagePromessa.createVoicePromise({
            campaignId: target?.campaignId || conversation.voiceCampaignTargetId || 'manual',
            targetId: target?.id || null,
            contactId: null, // Pode ser vinculado depois se necessário
            contactName: conversation.clientName || args.nome || 'Cliente',
            contactDocument: args.cpf_cnpj,
            phoneNumber: conversation.clientId || 'unknown',
            promisedAmount: args.valor_prometido ? parseInt(args.valor_prometido.toString()) : null,
            dueDate,
            paymentMethod: args.metodo_pagamento || 'boleto',
            status: 'pending',
            notes: args.observacoes || `Promessa registrada via WhatsApp pela IA Cobrança`,
            recordedBy: 'ai',
          });
          
          console.log(`✅ [Promessa] Promessa ${promise.id} criada com sucesso - vencimento: ${dueDate.toISOString()}`);
          
          // Atualizar target se existir
          if (target) {
            await dbPromessa.update(voiceCampaignTargets)
              .set({
                state: 'contacted', // Não marca como 'completed' pois ainda não pagou
                outcome: 'promise_made',
                outcomeDetails: `Promessa de pagamento registrada para ${args.data_prevista_pagamento}`,
                updatedAt: new Date()
              })
              .where(eqPromessa(voiceCampaignTargets.id, target.id));
            
            console.log(`✅ [Promessa] Target ${target.id} atualizado com outcome='promise_made'`);
          }
          
          // Agendar monitoramento da promessa (função calcula delay automaticamente)
          await addVoicePromiseMonitorToQueue({
            promiseId: promise.id,
            dueDate,
            targetId: target?.id ?? '',
            campaignId: target?.campaignId ?? 'manual',
          });
          
          console.log(`📅 [Promessa] Monitoramento agendado para verificar vencimento em ${dueDate.toISOString()}`);
          
          return JSON.stringify({
            success: true,
            promiseId: promise.id,
            mensagem: `Promessa registrada com sucesso! Vou anotar que você prometeu pagar até ${args.data_prevista_pagamento}. Não vou te cobrar até essa data. 😊`
          });
        } catch (error) {
          console.error("❌ [Promessa] Erro ao registrar promessa:", error);
          return JSON.stringify({
            error: "Não foi possível registrar a promessa. Tente novamente."
          });
        }

      case "validar_cpf_cnpj":
        const { validarCpfCnpj } = await import("../ai-tools");
        
        try {
          console.log(`🔍 [AI Tool Handler] Validando CPF/CNPJ: ${args.documento}`);
          
          const result = validarCpfCnpj(args.documento);
          
          console.log(`✅ [AI Tool Handler] Resultado da validação:`, result);
          
          return JSON.stringify(result);
        } catch (error) {
          console.error("❌ [Validação] Erro ao validar CPF/CNPJ:", error);
          return JSON.stringify({
            error: "Não foi possível validar o documento. Tente novamente."
          });
        }

      case "verificar_status_pagamento":
        if (!conversationId) {
          console.error("❌ [AI Tool] verificar_status_pagamento chamada sem conversationId");
          return JSON.stringify({
            error: "Contexto de conversa não disponível para verificação de status de pagamento"
          });
        }
        
        const { verificarStatusPagamento } = await import("../ai-tools");
        const { storage: storageStatusPgto } = await import("../storage");
        
        try {
          console.log(`💰 [AI Tool Handler] Verificando status de pagamento para conversação ${conversationId}`);
          
          // Buscar documento do cliente da conversa
          const conversationStatusPgto = await storageStatusPgto.getConversation(conversationId);
          
          if (!conversationStatusPgto) {
            console.error("❌ [AI Tool] Conversa não encontrada:", conversationId);
            return JSON.stringify({
              error: "Conversa não encontrada"
            });
          }
          
          if (!conversationStatusPgto.clientDocument) {
            console.warn("⚠️ [AI Tool] Cliente ainda não forneceu CPF/CNPJ");
            return JSON.stringify({
              error: "Para verificar status de pagamento, preciso do seu CPF ou CNPJ."
            });
          }
          
          console.log(`🔍 [AI Tool Handler] Chamando verificarStatusPagamento...`);
          
          const resultado = await verificarStatusPagamento(
            conversationStatusPgto.clientDocument,
            { conversationId },
            storageStatusPgto
          );
          
          console.log(`✅ [AI Tool Handler] Verificação concluída:`, resultado);
          return JSON.stringify(resultado);
        } catch (error) {
          console.error("❌ [AI Tool] Erro ao verificar status de pagamento:", error);
          return JSON.stringify({
            error: "Erro ao verificar status de pagamento. Por favor, tente novamente."
          });
        }

      default:
        console.error(`❌ [AI Tool] CAIU NO DEFAULT - Função não implementada: "${functionName}"`);
        console.error(`❌ [AI Tool] Funções disponíveis: verificar_conexao, consultar_fatura, consultar_base_de_conhecimento, consultar_boleto_cliente, verificar_status_pagamento, etc.`);
        return JSON.stringify({
          error: `Função ${functionName} não implementada`,
        });
    }
  } catch (error) {
    console.error(`Tool call error for ${functionName}:`, error);
    return JSON.stringify({
      error: `Erro ao executar ${functionName}`,
    });
  }
}

// Update assistant prompt/instructions
export async function updateAssistantPrompt(assistantType: string, newInstructions: string): Promise<void> {
  try {
    const assistantId = ASSISTANT_IDS[assistantType as keyof typeof ASSISTANT_IDS];
    
    if (!assistantId) {
      throw new Error(`Assistant type ${assistantType} not found`);
    }

    await openaiCircuitBreaker.execute(() =>
      openai.beta.assistants.update(assistantId, {
        instructions: newInstructions,
      })
    );

    // Invalidate cache immediately after update to ensure fresh instructions
    await assistantCache.invalidateByTag(`assistant:${assistantType}`);
    console.log(`✅ [OpenAI] Updated instructions for ${assistantType} (${assistantId}) and invalidated cache`);
  } catch (error) {
    console.error(`❌ [OpenAI] Error updating ${assistantType}:`, error);
    throw error;
  }
}

// Process training content and generate improved prompts using GPT-4
export async function processTrainingContent(
  assistantType: string, 
  trainingContent: string
): Promise<string> {
  try {
    console.log(`🎓 [Training] Processing training for ${assistantType}...`);
    
    // Get current assistant instructions
    const currentInstructions = await getAssistantInstructions(assistantType);
    
    const trainingPrompt = `Você é um especialista em otimização de prompts para assistentes de IA.

TAREFA:
Analise o conteúdo de treinamento fornecido e as instruções atuais do assistente, e gere uma versão melhorada das instruções que incorpore os aprendizados do treinamento.

ASSISTENTE ATUAL: ${assistantType}

INSTRUÇÕES ATUAIS:
${currentInstructions}

CONTEÚDO DO TREINAMENTO (exemplos de conversas, correções, procedimentos):
${trainingContent}

INSTRUÇÕES PARA MELHORIA:
1. Identifique padrões e procedimentos corretos demonstrados no treinamento
2. Identifique erros ou problemas que foram corrigidos
3. Mantenha a estrutura e tom das instruções originais
4. Adicione ou modifique seções específicas para incorporar os aprendizados
5. Seja específico e prático nas melhorias
6. NÃO remova funcionalidades ou ferramentas existentes
7. Mantenha o formato markdown e a organização das instruções

RESPONDA APENAS COM O TEXTO COMPLETO DAS INSTRUÇÕES MELHORADAS (sem explicações adicionais).`;

    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: trainingPrompt }],
        // GPT-5 only supports default temperature (1), custom values not allowed
      })
    );

    const improvedInstructions = response.choices[0].message.content?.trim() || currentInstructions;
    
    console.log(`✅ [Training] Generated improved instructions for ${assistantType} (${improvedInstructions.length} chars)`);
    
    return improvedInstructions;
  } catch (error) {
    console.error(`❌ [Training] Error processing training for ${assistantType}:`, error);
    throw error;
  }
}

// Get current assistant instructions
export async function getAssistantInstructions(assistantType: string): Promise<string> {
  try {
    // Check cache first (assistants don't change frequently)
    const cacheKey = `instructions:${assistantType}`;
    const cached = await assistantCache.get<string>(cacheKey);
    if (cached) {
      console.log(`💾 [Cache] Assistant instructions HIT for ${assistantType}`);
      return cached;
    }
    
    const assistantId = ASSISTANT_IDS[assistantType as keyof typeof ASSISTANT_IDS];
    
    if (!assistantId) {
      throw new Error(`Assistant type ${assistantType} not found`);
    }

    const assistant = await openaiCircuitBreaker.execute(() =>
      openai.beta.assistants.retrieve(assistantId)
    );
    
    const instructions = assistant.instructions || "";
    
    // Cache instructions for 24 hours (they rarely change)
    await assistantCache.set(cacheKey, instructions, { 
      ttl: 86400, // 24 hours
      tags: ['assistant-config', `assistant:${assistantType}`] 
    });
    
    console.log(`💾 [Cache] Assistant instructions MISS for ${assistantType} - cached for 24h`);
    return instructions;
  } catch (error) {
    console.error(`❌ [OpenAI] Error getting instructions for ${assistantType}:`, error);
    throw error;
  }
}

// Configurações de contexto e resumo
export const CONTEXT_CONFIG = {
  SUMMARIZE_EVERY: parseInt(process.env.SUMMARIZE_EVERY || "12"), // Resumir a cada X mensagens
  KEEP_RECENT: parseInt(process.env.KEEP_RECENT_MESSAGES || "5"), // Manter últimas X mensagens intactas
  CONTEXT_WINDOW: parseInt(process.env.CONTEXT_WINDOW || "7"), // Janela de contexto para roteamento
};

// Estrutura do resumo
interface ConversationSummary {
  summary: string;
  keyFacts: {
    currentPlan?: string;
    requestedPlan?: string;
    technicalIssue?: string;
    cpf?: string;
    [key: string]: any;
  };
  sentiment: string;
  assistantHistory: string[];
  actionsTaken: string[];
  pendingActions: string[];
  importantDates?: string[];
}

// Gerar resumo estruturado da conversa
export async function summarizeConversation(messages: Array<{ role: string; content: string }>): Promise<string> {
  try {
    const prompt = `Você é um assistente especializado em resumir conversas de atendimento ao cliente.

Analise as mensagens abaixo e crie um resumo estruturado em JSON com:
- summary: Resumo conciso da conversa (2-3 frases)
- keyFacts: Informações importantes extraídas (plano atual, CPF, problema técnico, etc)
- sentiment: Sentimento do cliente (satisfeito/neutro/frustrado/irritado)
- assistantHistory: Lista de assistentes que atenderam (ex: ["comercial", "suporte"])
- actionsTaken: Ações já realizadas
- pendingActions: Ações pendentes/próximos passos
- importantDates: Datas mencionadas (se houver)

IMPORTANTE:
- Seja objetivo e preserve TODAS as informações críticas (CPF, números de protocolo, valores, etc)
- Ignore saudações e confirmações genéricas
- Foque no contexto necessário para continuidade do atendimento

Mensagens:
${messages.map((m, i) => `${i + 1}. [${m.role}]: ${m.content}`).join('\n')}

Responda APENAS com o JSON estruturado, sem explicações adicionais.`;

    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      })
    );

    const summary = response.choices[0].message.content?.trim() || "{}";
    
    // Validar que é JSON válido
    JSON.parse(summary);
    
    console.log("📝 [Summarization] Summary generated successfully");
    return summary;
  } catch (error) {
    console.error("❌ [Summarization] Error:", error);
    // Retornar resumo básico em caso de erro
    return JSON.stringify({
      summary: "Erro ao gerar resumo. Contexto parcialmente preservado.",
      keyFacts: {},
      sentiment: "unknown",
      assistantHistory: [],
      actionsTaken: [],
      pendingActions: []
    });
  }
}

// Roteamento com contexto (nova versão)
export async function routeMessageWithContext(
  currentMessage: string, 
  conversationHistory: Array<{ role: string; content: string }> = [],
  conversationSummary?: string
): Promise<RouterResult> {
  try {
    // Pegar últimas N mensagens para contexto
    const recentMessages = conversationHistory.slice(-CONTEXT_CONFIG.CONTEXT_WINDOW);
    
    // Construir contexto
    let contextText = "";
    if (conversationSummary) {
      const summary = JSON.parse(conversationSummary) as ConversationSummary;
      contextText = `RESUMO DA CONVERSA ANTERIOR:\n${summary.summary}\n`;
      if (summary.assistantHistory.length > 0) {
        contextText += `Assistentes anteriores: ${summary.assistantHistory.join(" → ")}\n`;
      }
      if (summary.pendingActions.length > 0) {
        contextText += `Ações pendentes: ${summary.pendingActions.join(", ")}\n`;
      }
      contextText += "\n";
    }
    
    if (recentMessages.length > 0) {
      contextText += `ÚLTIMAS ${recentMessages.length} MENSAGENS:\n`;
      contextText += recentMessages.map(m => `[${m.role}]: ${m.content}`).join('\n');
      contextText += "\n\n";
    }

    const routingPrompt = `Você é o supervisor de roteamento da TR Telecom. Analise a mensagem atual do cliente considerando o contexto da conversa.

${contextText}MENSAGEM ATUAL DO CLIENTE: "${currentMessage}"

Assistentes disponíveis:
- suporte: Problemas técnicos, conexão, velocidade, equipamentos, desbloqueio
- comercial: Vendas, planos, upgrade, contratação
- financeiro: Faturas, pagamentos, cobranças, dúvidas financeiras
- apresentacao: Apresentação da empresa, novos clientes
- ouvidoria: Reclamações formais, SAC
- cancelamento: Cancelamento de serviço

REGRAS IMPORTANTES:
1. PRIORIZE a mensagem atual - ela tem precedência sobre o histórico
2. Se a mensagem atual contiver palavras de suporte técnico/desbloqueio (desbloqueio, desbloquear, liberar conexão, reduzir conexão), retorne SUPORTE imediatamente
3. Se a mensagem for apenas um número, use o contexto para determinar:
   - Se contexto indica CPF solicitado → tipo apropriado baseado no fluxo
   - Se for número isolado sem contexto → suporte (fallback seguro)
4. Detecte mudanças de assunto - cliente pode mudar de demanda durante conversa
5. Considere o sentimento - frustração recorrente pode indicar necessidade de escalação

Responda APENAS com JSON válido:
{
  "recommendedAssistantType": "<tipo>",
  "confidence": <0.0-1.0>,
  "reason": "<1-2 frases explicando a decisão>"
}`;

    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: routingPrompt }],
        response_format: { type: "json_object" },
      })
    );

    const result = JSON.parse(response.choices[0].message.content?.trim() || "{}");
    const assistantType = result.recommendedAssistantType?.toLowerCase() || "suporte";
    const validTypes = ["suporte", "comercial", "financeiro", "apresentacao", "ouvidoria", "cancelamento"];
    const finalType = validTypes.includes(assistantType) ? assistantType : "suporte";
    
    const assistantId = ASSISTANT_IDS[finalType as keyof typeof ASSISTANT_IDS] || ASSISTANT_IDS.suporte;
    
    console.log(`🎯 [Routing with Context] ${currentMessage.substring(0, 50)}... → ${finalType} (confidence: ${result.confidence}, reason: ${result.reason})`);
    
    return {
      assistantType: finalType,
      assistantId: assistantId,
      confidence: result.confidence || 0.85,
    };
  } catch (error) {
    console.error("❌ [Routing with Context] Error:", error);
    // Fallback para roteamento simples
    return routeMessage(currentMessage);
  }
}

/**
 * AI Prompt Analysis Service
 * Uses GPT-4 to analyze assistant prompts and provide improvement suggestions
 */

// Zod schema for AI analysis validation
const promptAnalysisRecommendationSchema = z.object({
  category: z.enum(['clarity', 'structure', 'tone', 'instructions', 'edge_cases', 'extreme_cases', 'compliance']),
  priority: z.enum(['high', 'medium', 'low']),
  suggestion: z.string(),
  example: z.string().optional(),
});

const promptAnalysisOptimizationSchema = z.object({
  title: z.string(),
  before: z.string(),
  after: z.string(),
  rationale: z.string(),
});

const promptAnalysisResultSchema = z.object({
  analysis: z.string(),
  score: z.number().min(0).max(100),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recommendations: z.array(promptAnalysisRecommendationSchema).default([]),
  optimizations: z.array(promptAnalysisOptimizationSchema).default([]),
  estimatedTokenCount: z.number().default(0),
});

export interface PromptAnalysisResult {
  analysis: string;
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendations: Array<{
    category: 'clarity' | 'structure' | 'tone' | 'instructions' | 'edge_cases' | 'extreme_cases' | 'compliance';
    priority: 'high' | 'medium' | 'low';
    suggestion: string;
    example?: string;
  }>;
  optimizations: Array<{
    title: string;
    before: string;
    after: string;
    rationale: string;
  }>;
  estimatedTokenCount: number;
}

export async function analyzePrompt(
  currentPrompt: string,
  draftPrompt: string,
  assistantType: string,
  userContext?: string
): Promise<PromptAnalysisResult> {
  try {
    const analysisPrompt = `Você é um especialista em engenharia de prompts para assistentes de IA em atendimento ao cliente de telecomunicações.

**CONTEXTO:**
- Tipo de assistente: ${assistantType.toUpperCase()}
- Setor: Telecomunicações (TR Telecom)
- Cliente: Atendimento via WhatsApp com IA
${userContext ? `- Contexto adicional do usuário: ${userContext}` : ''}

**PROMPT ATUAL (PRODUÇÃO):**
${currentPrompt}

**NOVO PROMPT (RASCUNHO):**
${draftPrompt}

**SUA TAREFA:**
Analise o novo prompt (rascunho) comparando com o atual e forneça uma análise detalhada considerando:

1. **CLAREZA**: O prompt é claro e específico sobre o papel do assistente?
2. **ESTRUTURA**: O prompt está bem organizado e fácil de seguir?
3. **TOM**: O tom é apropriado para atendimento ao cliente brasileiro?
4. **INSTRUÇÕES**: As instruções são completas e acionáveis?
5. **CASOS EXTREMOS**: O prompt lida com situações difíceis (clientes irritados, perguntas fora do escopo)?
6. **COMPLIANCE**: O prompt respeita LGPD e boas práticas de atendimento?

**IMPORTANTE - CAMPO "optimizations" (OBRIGATÓRIO: 3-5 OTIMIZAÇÕES):**
O campo "optimizations" contém substituições LITERAIS de texto. Este campo será usado para aplicar as otimizações automaticamente ao prompt.

**VOCÊ DEVE GERAR ENTRE 3 A 5 OTIMIZAÇÕES.** Mesmo que o prompt esteja bom, encontre oportunidades de melhoria em:
- Clareza e concisão (reduzir redundâncias)
- Exemplos mais específicos
- Instruções mais acionáveis
- Casos extremos não cobertos
- Tom e empatia
- Estrutura e organização

Para cada otimização:
- "before": COPIE LITERALMENTE um trecho do PROMPT RASCUNHO que precisa ser melhorado (entre 10-200 palavras)
- "after": ESCREVA LITERALMENTE o texto COMPLETO que vai SUBSTITUIR o "before" (não escreva uma descrição, escreva o texto final)
- NÃO use descrições genéricas como "Consolidar as instruções..." - use o TEXTO REAL
- O "before" deve existir EXATAMENTE no prompt rascunho (incluindo pontuação e formatação)

**EXEMPLO CORRETO:**
{
  "title": "Melhorar instruções de saudação",
  "before": "Você deve cumprimentar o cliente de forma educada.",
  "after": "Inicie sempre com uma saudação calorosa e personalizada. Exemplos: 'Olá! Como posso ajudar você hoje?' ou 'Bom dia! É um prazer atendê-lo(a).'",
  "rationale": "Saudações específicas e exemplos tornam o atendimento mais humano e consistente."
}

**EXEMPLO INCORRETO (NÃO FAÇA ASSIM):**
{
  "title": "Melhorar instruções de saudação",
  "before": "O texto atual é muito vago sobre saudações",
  "after": "Adicionar exemplos de saudações personalizadas",
  "rationale": "..."
}

**FORMATO DE RESPOSTA (JSON):**
{
  "analysis": "Análise geral do prompt em 2-3 parágrafos",
  "score": 85,
  "strengths": ["Ponto forte 1", "Ponto forte 2", "Ponto forte 3"],
  "weaknesses": ["Ponto fraco 1", "Ponto fraco 2"],
  "recommendations": [
    {
      "category": "clarity",
      "priority": "high",
      "suggestion": "Descrição da sugestão",
      "example": "Exemplo opcional de implementação"
    }
  ],
  "optimizations": [
    {
      "title": "Título da otimização 1",
      "before": "COPIE AQUI O TEXTO LITERAL EXATO DO PROMPT RASCUNHO QUE DEVE SER SUBSTITUÍDO (mínimo 10 palavras, máximo 200 palavras)",
      "after": "ESCREVA AQUI O TEXTO LITERAL COMPLETO QUE VAI SUBSTITUIR O 'before' (deve ser o texto final, não uma descrição)",
      "rationale": "Por que essa mudança melhora o prompt"
    },
    {
      "title": "Título da otimização 2",
      "before": "OUTRO TRECHO LITERAL DO PROMPT RASCUNHO",
      "after": "TEXTO COMPLETO DE SUBSTITUIÇÃO",
      "rationale": "Justificativa"
    },
    {
      "title": "Título da otimização 3",
      "before": "MAIS UM TRECHO LITERAL DO PROMPT RASCUNHO",
      "after": "TEXTO COMPLETO DE SUBSTITUIÇÃO",
      "rationale": "Justificativa"
    }
  ],
  "estimatedTokenCount": 1500
}

Forneça uma análise honesta, construtiva e acionável. Se o prompt já está excelente, diga isso!

**LEMBRE-SE: VOCÊ DEVE GERAR NO MÍNIMO 3 OTIMIZAÇÕES, IDEALMENTE 5. Não gere apenas 1 ou 2.**`;

    const response = await openaiCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: analysisPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      })
    );

    const rawResult = JSON.parse(response.choices[0].message.content?.trim() || "{}");
    
    // Track token usage
    if (response.usage) {
      await trackTokenUsage(
        "gpt-4o",
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0
      );
    }

    // Validate and sanitize result with Zod
    const validatedResult = promptAnalysisResultSchema.parse(rawResult);

    console.log(`✅ [Prompt Analysis] Completed for ${assistantType} (score: ${validatedResult.score}/100)`);
    
    return validatedResult;
  } catch (error) {
    console.error("❌ [Prompt Analysis] Error:", error);
    throw new Error("Erro ao analisar prompt com IA");
  }
}

/**
 * Evolution Suggestions Consolidation Service
 * Consolidates multiple evolution suggestions into a single updated prompt
 */

// Zod schema for applied suggestion
const appliedSuggestionSchema = z.object({
  suggestionId: z.string(),
  category: z.enum(['tone', 'instructions', 'edge_cases', 'scripts', 'compliance', 'structure']),
  applied: z.boolean(),
  howApplied: z.string(),
});

// Zod schema for consolidation result
const consolidationResultSchema = z.object({
  updatedPrompt: z.string(),
  summary: z.object({
    totalSuggestions: z.number(),
    appliedCount: z.number(),
    duplicatesCount: z.number(),
    conflictsCount: z.number(),
  }),
  appliedSuggestions: z.array(appliedSuggestionSchema),
  duplicateGroups: z.array(z.object({
    mainSuggestionId: z.string(),
    duplicateIds: z.array(z.string()),
    reason: z.string(),
  })).default([]),
  notApplied: z.array(z.object({
    suggestionId: z.string(),
    reason: z.string(),
  })).default([]),
  changes: z.array(z.object({
    category: z.string(),
    count: z.number(),
    description: z.string(),
  })).default([]),
});

export interface ConsolidationResult {
  updatedPrompt: string;
  summary: {
    totalSuggestions: number;
    appliedCount: number;
    duplicatesCount: number;
    conflictsCount: number;
  };
  appliedSuggestions: Array<{
    suggestionId: string;
    category: 'tone' | 'instructions' | 'edge_cases' | 'scripts' | 'compliance' | 'structure';
    applied: boolean;
    howApplied: string;
  }>;
  duplicateGroups: Array<{
    mainSuggestionId: string;
    duplicateIds: string[];
    reason: string;
  }>;
  notApplied: Array<{
    suggestionId: string;
    reason: string;
  }>;
  changes: Array<{
    category: string;
    count: number;
    description: string;
  }>;
}

export interface EvolutionSuggestion {
  id: string;
  problemIdentified: string;
  rootCauseAnalysis: string;
  currentPrompt: string;
  suggestedPrompt: string;
  confidenceScore: number;
}

export async function consolidateEvolutionSuggestions(
  currentPrompt: string,
  suggestions: EvolutionSuggestion[],
  assistantType: string
): Promise<ConsolidationResult> {
  try {
    console.log(`🔄 [Consolidation] Starting for ${assistantType} with ${suggestions.length} suggestions`);

    const suggestionsContext = suggestions.map((s, i) => `
SUGESTÃO ${i + 1} (ID: ${s.id}):
- Problema: ${s.problemIdentified}
- Análise: ${s.rootCauseAnalysis}
- Confiança: ${s.confidenceScore}%
- Mudança sugerida:
  ANTES: ${s.currentPrompt}
  DEPOIS: ${s.suggestedPrompt}
`).join('\n---\n');

    const consolidationPrompt = `Você é um especialista em consolidar feedback e melhorar prompts de assistentes de IA.

**CONTEXTO:**
- Assistente: ${assistantType.toUpperCase()}
- Setor: Telecomunicações (TR Telecom)
- Prompt atual em produção: VER ABAIXO

**PROMPT ATUAL (PRODUÇÃO):**
${currentPrompt}

**SUGESTÕES DE EVOLUÇÃO (${suggestions.length} no total):**
${suggestionsContext}

**SUA TAREFA:**
1. Analise TODAS as ${suggestions.length} sugestões
2. Identifique sugestões **DUPLICADAS** ou muito similares (agrupe-as)
3. Identifique sugestões **CONFLITANTES** (que não podem ser aplicadas juntas)
4. Categorize cada sugestão por tema:
   - tone: Mudanças no tom de voz
   - instructions: Novas instruções ou procedimentos
   - edge_cases: Tratamento de casos extremos
   - scripts: Novos scripts de resposta
   - compliance: Adequação a LGPD ou políticas
   - structure: Organização do prompt

5. Gere um **PROMPT ATUALIZADO** que incorpore as sugestões válidas e não-duplicadas
   - Mantenha a estrutura original sempre que possível
   - Aplique as mudanças de forma coesa e harmoniosa
   - Se uma sugestão conflita com políticas da empresa ou outras sugestões, NÃO aplique

6. Para cada sugestão, indique:
   - Se foi aplicada (true/false)
   - Como foi aplicada (descreva a mudança feita)
   - Se é duplicada de outra
   - Se não foi aplicada, por qual motivo

**FORMATO DE RESPOSTA (JSON ESTRITO):**
{
  "updatedPrompt": "COLOQUE AQUI O PROMPT COMPLETO E ATUALIZADO COM TODAS AS MUDANÇAS APLICADAS. DEVE SER UM PROMPT FUNCIONAL E COMPLETO, NÃO APENAS UMA MENSAGEM. COPIE TODO O PROMPT ORIGINAL E APLIQUE AS MUDANÇAS NECESSÁRIAS.",
  "summary": {
    "totalSuggestions": ${suggestions.length},
    "appliedCount": 10,
    "duplicatesCount": 3,
    "conflictsCount": 2
  },
  "appliedSuggestions": [
    {
      "suggestionId": "abc-123",
      "category": "tone",
      "applied": true,
      "howApplied": "Adicionada instrução para tom mais empático em casos de reclamação na seção de Ouvidoria"
    }
  ],
  "duplicateGroups": [
    {
      "mainSuggestionId": "abc-123",
      "duplicateIds": ["def-456", "ghi-789"],
      "reason": "Todas sugerem adicionar tratamento de tom empático - consolidadas na sugestão principal"
    }
  ],
  "notApplied": [
    {
      "suggestionId": "xyz-999",
      "reason": "Conflita com política da empresa de não prometer prazos específicos"
    }
  ],
  "changes": [
    {
      "category": "Tone",
      "count": 4,
      "description": "Tom mais empático em situações de frustração do cliente"
    },
    {
      "category": "Scripts",
      "count": 3,
      "description": "Novos scripts para tratamento de inadimplência"
    }
  ]
}

**REGRAS CRÍTICAS:**
- O campo "updatedPrompt" DEVE conter o PROMPT COMPLETO atualizado (várias centenas ou milhares de caracteres)
- NÃO retorne apenas "Prompt completo atualizado aqui..." - isso é inválido!
- COPIE todo o prompt original e aplique as mudanças onde necessário
- Seja conservador: não faça mudanças drásticas sem justificativa clara
- Se uma sugestão é vaga ou de baixa confiança (<70%), considere não aplicar
- Mantenha o tom profissional e alinhado com a marca TR Telecom
- Sempre retorne JSON válido e completo`;

    // Use circuit breaker com timeout estendido (180s) para consolidações grandes
    const response = await consolidationCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: consolidationPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3, // Lower temperature for more conservative/consistent consolidation
      })
    );

    const rawResult = JSON.parse(response.choices[0].message.content?.trim() || "{}");

    // Track token usage
    if (response.usage) {
      await trackTokenUsage(
        "gpt-4o",
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0
      );
    }

    // Validate and sanitize result with Zod
    let validatedResult;
    try {
      validatedResult = consolidationResultSchema.parse(rawResult);
    } catch (zodError: any) {
      console.error("❌ [Consolidation] Zod validation failed:", zodError);
      console.error("❌ [Consolidation] Raw result:", JSON.stringify(rawResult, null, 2).substring(0, 1000));
      throw new Error(`Validação de schema falhou: ${zodError.message || JSON.stringify(zodError.errors?.slice(0, 3) || 'erro desconhecido')}`);
    }

    // CRITICAL: Validate that updatedPrompt is actually a complete prompt, not a placeholder
    if (validatedResult.updatedPrompt.length < 100) {
      console.error(`❌ [Consolidation] Prompt muito curto: ${validatedResult.updatedPrompt.length} caracteres`);
      throw new Error(`GPT-4o retornou um prompt muito curto (${validatedResult.updatedPrompt.length} caracteres). Esperado: várias centenas ou milhares de caracteres.`);
    }

    // Check for common placeholder messages
    const placeholderMessages = [
      'prompt completo atualizado aqui',
      'coloque aqui o prompt',
      'updated prompt here',
    ];
    
    const lowerPrompt = validatedResult.updatedPrompt.toLowerCase();
    for (const placeholder of placeholderMessages) {
      if (lowerPrompt.includes(placeholder)) {
        console.error(`❌ [Consolidation] Placeholder detectado: "${validatedResult.updatedPrompt.substring(0, 100)}..."`);
        throw new Error(`GPT-4o retornou um placeholder ao invés do prompt completo. Texto retornado: "${validatedResult.updatedPrompt.substring(0, 100)}..."`);
      }
    }

    console.log(`✅ [Consolidation] Completed for ${assistantType}`);
    console.log(`   - Applied: ${validatedResult.summary.appliedCount}/${validatedResult.summary.totalSuggestions}`);
    console.log(`   - Duplicates: ${validatedResult.summary.duplicatesCount}`);
    console.log(`   - Conflicts: ${validatedResult.summary.conflictsCount}`);

    return validatedResult;
  } catch (error) {
    console.error("❌ [Consolidation] Error:", error);
    console.error("❌ [Consolidation] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    
    // Return more specific error message
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao consolidar";
    throw new Error(`Erro ao consolidar sugestões: ${errorMessage}`);
  }
}

/**
 * Consolida sugestões de Contexto de forma inteligente usando GPT-4o
 */
export async function consolidateContextSuggestions(
  currentPrompt: string,
  suggestions: Array<{
    problemSummary: string;
    rootCause: string;
    suggestedFix: string;
    priority: string;
    count: number;
  }>,
  assistantType: string
): Promise<{ updatedPrompt: string; summary: string }> {
  try {
    console.log(`🔄 [Context Consolidation] Starting for ${assistantType} with ${suggestions.length} suggestions`);

    const suggestionsContext = suggestions.map((s, i) => `
SUGESTÃO ${i + 1}:
- Problema: ${s.problemSummary}
- Causa Raiz: ${s.rootCause}
- Prioridade: ${s.priority}
- Ocorrências: ${s.count}x
- Correção Sugerida:
${s.suggestedFix}
`).join('\n---\n');

    const consolidationPrompt = `Você é um especialista em consolidar correções de contexto e melhorar prompts de assistentes de IA.

**CONTEXTO:**
- Assistente: ${assistantType.toUpperCase()}
- Setor: Telecomunicações (TR Telecom)
- Prompt atual em produção: VER ABAIXO

**PROMPT ATUAL (PRODUÇÃO):**
${currentPrompt}

**SUGESTÕES DE CORREÇÃO DO MONITOR DE CONTEXTO (${suggestions.length} no total):**
${suggestionsContext}

**SUA TAREFA:**
1. Analise TODAS as ${suggestions.length} sugestões de correção
2. Integre as correções de forma inteligente e coesa no prompt atual
3. Organize as correções nas seções apropriadas do prompt (não adicione tudo no final)
4. Mantenha o estilo markdown do prompt original
5. Evite duplicação - se o prompt já aborda parcialmente um problema, MELHORE a seção existente

**DIRETRIZES IMPORTANTES:**
- PRESERVE a estrutura markdown (##, ###, -, etc.)
- INTEGRE as correções nas seções relevantes (não crie seção separada no final)
- Se uma correção é sobre "revisar histórico", adicione na seção de regras ou procedimentos existente
- Remova redundâncias - consolide instruções similares
- Use linguagem IMPERATIVA e CLARA (SEMPRE, NUNCA, OBRIGATÓRIO)
- Mantenha tom profissional e direto

**FORMATO DE RESPOSTA (JSON ESTRITO):**
{
  "updatedPrompt": "Prompt completo atualizado com as correções integradas de forma harmoniosa...",
  "summary": "Resumo das ${suggestions.length} correções aplicadas: lista as principais mudanças feitas"
}

**IMPORTANTE:**
- O updatedPrompt deve ser o prompt COMPLETO e final, pronto para uso
- NÃO adicione seção "Novas Instruções" ou "Correções" no final
- INTEGRE tudo de forma orgânica nas seções existentes
- O resultado deve parecer que foi escrito por uma única pessoa, não como colagem de correções`;

    // Use circuit breaker com timeout estendido (180s) para consolidações grandes
    const response = await consolidationCircuitBreaker.execute(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em engenharia de prompts que consolida feedback de forma inteligente e coesa."
          },
          {
            role: "user",
            content: consolidationPrompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    );

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Track token usage
    if (response.usage) {
      await trackTokenUsage(
        "gpt-4o",
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0
      );
    }
    
    console.log(`✅ [Context Consolidation] Completed for ${assistantType}`);
    console.log(`📊 [Context Consolidation] Summary: ${result.summary}`);

    return {
      updatedPrompt: result.updatedPrompt || currentPrompt,
      summary: result.summary || 'Consolidação concluída'
    };
  } catch (error) {
    console.error(`❌ [Context Consolidation] Error:`, error);
    throw error;
  }
}

export { openai };
