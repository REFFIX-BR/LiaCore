import { redis } from './redis-config';

const MASS_REOPEN_KEY = 'cortex:mass_reopen:counter';
const MASS_REOPEN_WINDOW_SECONDS = 60;
const MASS_REOPEN_THRESHOLD = 10;

interface MassReopenCheck {
  isMassReopen: boolean;
  currentCount: number;
  threshold: number;
  windowSeconds: number;
}

export async function checkMassReopen(): Promise<MassReopenCheck> {
  try {
    if (!redis) {
      return { isMassReopen: false, currentCount: 0, threshold: MASS_REOPEN_THRESHOLD, windowSeconds: MASS_REOPEN_WINDOW_SECONDS };
    }

    const currentCount = await redis.get<string>(MASS_REOPEN_KEY);
    const count = parseInt(currentCount || '0', 10);

    return {
      isMassReopen: count >= MASS_REOPEN_THRESHOLD,
      currentCount: count,
      threshold: MASS_REOPEN_THRESHOLD,
      windowSeconds: MASS_REOPEN_WINDOW_SECONDS,
    };
  } catch (error) {
    console.error('[MassReopen] Error checking mass reopen:', error);
    return { isMassReopen: false, currentCount: 0, threshold: MASS_REOPEN_THRESHOLD, windowSeconds: MASS_REOPEN_WINDOW_SECONDS };
  }
}

export async function incrementReopenCounter(): Promise<number> {
  try {
    if (!redis) {
      return 0;
    }

    const key = MASS_REOPEN_KEY;
    const count = await redis.incr(key);
    
    if (count === 1) {
      await redis.expire(key, MASS_REOPEN_WINDOW_SECONDS);
    }

    return count;
  } catch (error) {
    console.error('[MassReopen] Error incrementing counter:', error);
    return 0;
  }
}

export async function handleConversationReopen(conversationId: string, chatId: string): Promise<{ shouldBlock: boolean; reason?: string }> {
  const count = await incrementReopenCounter();
  const check = await checkMassReopen();

  if (check.isMassReopen) {
    console.warn(`🛑 [MassReopen] BLOQUEADO: Detectada reabertura em massa (${count}/${check.threshold} em ${check.windowSeconds}s)`);
    console.warn(`   Conversa: ${conversationId}, ChatId: ${chatId}`);
    
    return {
      shouldBlock: true,
      reason: `mass_reopen_detected_${count}_in_${check.windowSeconds}s`,
    };
  }

  if (count >= 5) {
    console.log(`⚠️ [MassReopen] Alerta: ${count} reaberturas nos últimos ${check.windowSeconds}s (limite: ${check.threshold})`);
  }

  return { shouldBlock: false };
}

export async function getReopenStats(): Promise<{ count: number; threshold: number; windowSeconds: number }> {
  const check = await checkMassReopen();
  return {
    count: check.currentCount,
    threshold: check.threshold,
    windowSeconds: check.windowSeconds,
  };
}
