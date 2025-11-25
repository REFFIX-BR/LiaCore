/**
 * Worker para reprocessar sincronizações pendentes com a API Comercial
 * 
 * Este worker roda periodicamente para tentar sincronizar vendas/leads
 * que falharam na primeira tentativa.
 * 
 * Exponential backoff: 5min, 15min, 45min, 2h, 6h
 */

import { db } from "../db";
import { pendingComercialSync } from "../../shared/schema";
import { eq, and, lte, lt } from "drizzle-orm";
import { enviarVendaChat, enviarSiteLead, enviarLeadSimples } from "../lib/comercial-api";

const SYNC_INTERVAL_MS = 60 * 1000; // Verificar a cada 1 minuto
const MAX_BATCH_SIZE = 10; // Processar no máximo 10 itens por vez

// Exponential backoff em minutos: 5, 15, 45, 120 (2h), 360 (6h)
const BACKOFF_MINUTES = [5, 15, 45, 120, 360];

interface SyncItem {
  id: string;
  type: string;
  saleId: string | null;
  conversationId: string | null;
  payload: any;
  attempts: number;
  maxAttempts: number;
  status: string;
}

async function processPendingSync(item: SyncItem): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log(`🔄 [Comercial Sync Worker] Processando item ${item.id} (tentativa ${item.attempts + 1}/${item.maxAttempts})`);
  
  try {
    let result;
    
    switch (item.type) {
      case 'venda':
        result = await enviarVendaChat(item.payload);
        break;
      case 'lead_prospeccao':
        result = await enviarSiteLead(item.payload);
        break;
      case 'lead_sem_cobertura':
        result = await enviarLeadSimples(item.payload);
        break;
      default:
        return { success: false, error: `Tipo desconhecido: ${item.type}` };
    }
    
    return { success: result.success, error: result.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function runSyncWorker(): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Buscar itens pendentes que estão prontos para retry
    const pendingItems = await db
      .select()
      .from(pendingComercialSync)
      .where(
        and(
          eq(pendingComercialSync.status, 'pending'),
          lte(pendingComercialSync.nextRetryAt, new Date()),
          lt(pendingComercialSync.attempts, pendingComercialSync.maxAttempts)
        )
      )
      .limit(MAX_BATCH_SIZE);
    
    if (pendingItems.length === 0) {
      return; // Nada para processar
    }
    
    console.log(`📋 [Comercial Sync Worker] Encontrados ${pendingItems.length} itens pendentes`);
    
    for (const item of pendingItems) {
      const result = await processPendingSync(item as SyncItem);
      const newAttempts = item.attempts + 1;
      
      if (result.success) {
        // Sucesso - marcar como sincronizado
        await db
          .update(pendingComercialSync)
          .set({
            status: 'completed',
            attempts: newAttempts,
            lastError: null,
            completedAt: new Date(),
          })
          .where(eq(pendingComercialSync.id, item.id));
        
        console.log(`✅ [Comercial Sync Worker] Item ${item.id} sincronizado com sucesso`);
      } else if (newAttempts >= item.maxAttempts) {
        // Esgotou tentativas - marcar como falha permanente
        await db
          .update(pendingComercialSync)
          .set({
            status: 'failed',
            attempts: newAttempts,
            lastError: result.error || 'Máximo de tentativas atingido',
          })
          .where(eq(pendingComercialSync.id, item.id));
        
        console.error(`❌ [Comercial Sync Worker] Item ${item.id} falhou permanentemente após ${newAttempts} tentativas`);
      } else {
        // Falhou mas ainda tem tentativas - agendar próxima
        const backoffIndex = Math.min(newAttempts, BACKOFF_MINUTES.length - 1);
        const nextRetryMinutes = BACKOFF_MINUTES[backoffIndex];
        const nextRetryAt = new Date(Date.now() + nextRetryMinutes * 60 * 1000);
        
        await db
          .update(pendingComercialSync)
          .set({
            attempts: newAttempts,
            lastError: result.error,
            nextRetryAt,
          })
          .where(eq(pendingComercialSync.id, item.id));
        
        console.log(`⏰ [Comercial Sync Worker] Item ${item.id} agendado para retry em ${nextRetryMinutes}min`);
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ [Comercial Sync Worker] Processamento concluído em ${elapsed}ms`);
    
  } catch (error: any) {
    console.error(`❌ [Comercial Sync Worker] Erro no worker:`, error.message);
  }
}

let syncInterval: NodeJS.Timeout | null = null;

export function startComercialSyncWorker(): void {
  if (syncInterval) {
    console.warn('⚠️ [Comercial Sync Worker] Worker já está rodando');
    return;
  }
  
  console.log('🚀 [Comercial Sync Worker] Iniciando worker de sincronização comercial');
  console.log(`   - Intervalo: ${SYNC_INTERVAL_MS / 1000}s`);
  console.log(`   - Batch size: ${MAX_BATCH_SIZE}`);
  console.log(`   - Backoff (min): ${BACKOFF_MINUTES.join(' → ')}`);
  
  // Rodar imediatamente na primeira vez
  runSyncWorker();
  
  // Depois rodar periodicamente
  syncInterval = setInterval(runSyncWorker, SYNC_INTERVAL_MS);
}

export function stopComercialSyncWorker(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('🛑 [Comercial Sync Worker] Worker parado');
  }
}

// Estatísticas do worker
export async function getComercialSyncStats(): Promise<{
  pending: number;
  completed: number;
  failed: number;
}> {
  const stats = await db
    .select({
      status: pendingComercialSync.status,
    })
    .from(pendingComercialSync);
  
  return {
    pending: stats.filter(s => s.status === 'pending').length,
    completed: stats.filter(s => s.status === 'completed').length,
    failed: stats.filter(s => s.status === 'failed').length,
  };
}
