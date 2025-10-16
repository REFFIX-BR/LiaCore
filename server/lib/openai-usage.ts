import { redisConnection } from "./redis-config";

// Preços da OpenAI (por 1M tokens) - Atualizado em Outubro 2025
const OPENAI_PRICING = {
  "gpt-5": {
    input: 2.50,  // $2.50 por 1M tokens de input
    output: 10.00  // $10.00 por 1M tokens de output
  },
  "gpt-4o": {
    input: 5.00,
    output: 15.00
  },
  "text-embedding-3-small": {
    input: 0.02,
    output: 0
  },
  "whisper-1": {
    input: 0.006 * 1_000_000,  // $0.006 por minuto, convertido para escala de "por milhão" (6000 por milhão de minutos)
    output: 0
  }
};

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  cost: number;
}

export interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
}

export interface UsageMetrics {
  total30Days: {
    tokens: number;
    cost: number;
    requests: number;
  };
  today: {
    tokens: number;
    cost: number;
    requests: number;
  };
  byModel: Record<string, {
    tokens: number;
    cost: number;
    requests: number;
  }>;
  dailyUsage: DailyUsage[];
}

/**
 * Calcula o custo baseado no modelo e tokens usados
 */
function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = OPENAI_PRICING[model as keyof typeof OPENAI_PRICING];
  
  if (!pricing) {
    console.warn(`⚠️ [OpenAI Usage] Modelo desconhecido: ${model}, usando preço do gpt-5`);
    const fallbackPricing = OPENAI_PRICING["gpt-5"];
    return (
      (promptTokens / 1_000_000) * fallbackPricing.input +
      (completionTokens / 1_000_000) * fallbackPricing.output
    );
  }
  
  return (
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output
  );
}

/**
 * Registra uso de tokens no Redis
 */
export async function trackTokenUsage(
  model: string,
  promptTokens: number,
  completionTokens: number
): Promise<void> {
  try {
    const totalTokens = promptTokens + completionTokens;
    const cost = calculateCost(model, promptTokens, completionTokens);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const usageData = {
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
      timestamp: Date.now()
    };
    
    // Armazena no Redis com chave por data e modelo
    const dailyKey = `openai:usage:${today}:${model}`;
    await redisConnection.rpush(dailyKey, JSON.stringify(usageData));
    
    // Expira após 35 dias (mantém histórico de 30 dias + 5 dias de buffer)
    await redisConnection.expire(dailyKey, 35 * 24 * 60 * 60);
    
    console.log(`📊 [OpenAI Usage] Tracked: ${totalTokens} tokens, $${cost.toFixed(4)} (${model})`);
  } catch (error) {
    console.error("❌ [OpenAI Usage] Error tracking usage:", error);
  }
}

/**
 * Obtém métricas de uso dos últimos 30 dias (OTIMIZADO com Pipeline)
 */
export async function getUsageMetrics(): Promise<UsageMetrics> {
  try {
    const now = new Date();
    const models = Object.keys(OPENAI_PRICING);
    
    // ✅ OTIMIZAÇÃO: Usa pipeline para buscar todos os dados em paralelo
    const pipeline = redisConnection.pipeline();
    const keysToFetch: string[] = [];
    
    // Prepara todas as buscas em batch
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      for (const model of models) {
        const key = `openai:usage:${dateStr}:${model}`;
        keysToFetch.push(key);
        pipeline.lrange(key, 0, -1);
      }
    }
    
    // Executa todas as buscas de uma vez
    const results = await pipeline.exec();
    
    // Processa resultados
    const dailyUsage: DailyUsage[] = [];
    const byModel: Record<string, { tokens: number; cost: number; requests: number }> = {};
    let totalTokens = 0;
    let totalCost = 0;
    let totalRequests = 0;
    
    const today = new Date().toISOString().split('T')[0];
    let todayTokens = 0;
    let todayCost = 0;
    let todayRequests = 0;
    
    // Mapa para agrupar por data
    const dailyMap: Record<string, { tokens: number; cost: number; requests: number }> = {};
    
    // Processa resultados do pipeline
    if (results) {
      for (let i = 0; i < results.length; i++) {
        const [err, entries] = results[i];
        if (err || !entries || !Array.isArray(entries)) continue;
        
        const key = keysToFetch[i];
        const [, , dateStr, model] = key.split(':');
        
        for (const entry of entries as string[]) {
          const data = JSON.parse(entry);
          
          // Acumula por modelo
          if (!byModel[model]) {
            byModel[model] = { tokens: 0, cost: 0, requests: 0 };
          }
          byModel[model].tokens += data.totalTokens;
          byModel[model].cost += data.cost;
          byModel[model].requests++;
          
          // Acumula por dia
          if (!dailyMap[dateStr]) {
            dailyMap[dateStr] = { tokens: 0, cost: 0, requests: 0 };
          }
          dailyMap[dateStr].tokens += data.totalTokens;
          dailyMap[dateStr].cost += data.cost;
          dailyMap[dateStr].requests++;
          
          // Acumula totais
          totalTokens += data.totalTokens;
          totalCost += data.cost;
          totalRequests++;
          
          // Acumula dados de hoje
          if (dateStr === today) {
            todayTokens += data.totalTokens;
            todayCost += data.cost;
            todayRequests++;
          }
        }
      }
    }
    
    // Converte mapa em array e ordena
    for (const [date, stats] of Object.entries(dailyMap)) {
      dailyUsage.push({
        date,
        tokens: stats.tokens,
        cost: stats.cost,
        requests: stats.requests
      });
    }
    dailyUsage.sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      total30Days: {
        tokens: totalTokens,
        cost: totalCost,
        requests: totalRequests
      },
      today: {
        tokens: todayTokens,
        cost: todayCost,
        requests: todayRequests
      },
      byModel,
      dailyUsage
    };
  } catch (error) {
    console.error("❌ [OpenAI Usage] Error getting metrics:", error);
    return {
      total30Days: { tokens: 0, cost: 0, requests: 0 },
      today: { tokens: 0, cost: 0, requests: 0 },
      byModel: {},
      dailyUsage: []
    };
  }
}

/**
 * Obtém custo estimado da Upstash (baseado em número de requisições Redis)
 * Upstash: $0.20 por 100k comandos
 */
export async function getUpstashCost(): Promise<number> {
  try {
    // Conta comandos executados (aproximação - pode ser melhorada)
    const today = new Date().toISOString().split('T')[0];
    const key = `upstash:commands:${today}`;
    
    const commands = await redisConnection.get(key);
    const commandCount = commands ? parseInt(commands) : 0;
    
    // $0.20 por 100k comandos
    const cost = (commandCount / 100000) * 0.20;
    
    return cost;
  } catch (error) {
    console.error("❌ [Upstash] Error calculating cost:", error);
    return 0;
  }
}

/**
 * Incrementa contador de comandos Upstash
 */
export async function incrementUpstashCommands(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `upstash:commands:${today}`;
    
    await redisConnection.incr(key);
    await redisConnection.expire(key, 35 * 24 * 60 * 60); // 35 dias
  } catch (error) {
    // Silenciosamente ignora erro para não impactar performance
  }
}
