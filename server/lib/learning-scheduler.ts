import { analyzeLearningEvents } from "./cortex-analysis";

// Configuração do scheduler (padrão: 2 horas - mais responsivo para atendimento ao cliente)
const ANALYSIS_INTERVAL_HOURS = parseInt(process.env.ANALYSIS_INTERVAL_HOURS || "2");
const ANALYSIS_INTERVAL_MS = ANALYSIS_INTERVAL_HOURS * 60 * 60 * 1000;

let schedulerInterval: NodeJS.Timeout | null = null;

export function startLearningScheduler() {
  // Evitar múltiplas instâncias
  if (schedulerInterval) {
    console.log("⏰ [Learning Scheduler] Já está em execução");
    return;
  }

  console.log(`⏰ [Learning Scheduler] Iniciado - análise a cada ${ANALYSIS_INTERVAL_HOURS} horas`);

  // Executar análise imediatamente na inicialização (opcional - comentado para evitar análise em vazio)
  // analyzeLearningEvents().catch(err => console.error("❌ [Learning Scheduler] Erro na análise inicial:", err));

  // Agendar análises periódicas
  schedulerInterval = setInterval(async () => {
    try {
      console.log("⏰ [Learning Scheduler] Executando análise periódica...");
      const suggestions = await analyzeLearningEvents();
      console.log(`✅ [Learning Scheduler] Análise concluída: ${suggestions.length} sugestões geradas`);
    } catch (error) {
      console.error("❌ [Learning Scheduler] Erro na análise periódica:", error);
    }
  }, ANALYSIS_INTERVAL_MS);
}

export function stopLearningScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("⏹️  [Learning Scheduler] Parado");
  }
}

// Análise manual sob demanda (pode ser chamada por rota API)
export async function triggerManualAnalysis(): Promise<any[]> {
  console.log("🔄 [Learning Scheduler] Análise manual disparada");
  return await analyzeLearningEvents();
}
