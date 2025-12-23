import { redis } from './redis-config';

const MASS_REOPEN_KEY_PREFIX = 'cortex:mass_reopen:';
const MASS_REOPEN_WINDOW_SECONDS = 60;
const MASS_REOPEN_THRESHOLD = 15;
const MASS_REOPEN_ALERT_THRESHOLD = 8;

interface MassReopenCheck {
  isMassReopen: boolean;
  currentCount: number;
  threshold: number;
  windowSeconds: number;
}

export async function checkMassReopen(instance: string = 'global'): Promise<MassReopenCheck> {
  try {
    if (!redis) {
      return { isMassReopen: false, currentCount: 0, threshold: MASS_REOPEN_THRESHOLD, windowSeconds: MASS_REOPEN_WINDOW_SECONDS };
    }

    const key = `${MASS_REOPEN_KEY_PREFIX}${instance}`;
    const currentCount = await redis.get<string>(key);
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

export async function incrementReopenCounter(instance: string = 'global'): Promise<number> {
  try {
    if (!redis) {
      return 0;
    }

    const key = `${MASS_REOPEN_KEY_PREFIX}${instance}`;
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

export async function handleConversationReopen(
  conversationId: string, 
  chatId: string,
  instance: string = 'global'
): Promise<{ shouldBlock: boolean; shouldAlert: boolean; reason?: string; count: number }> {
  const count = await incrementReopenCounter(instance);
  const check = await checkMassReopen(instance);

  if (check.isMassReopen) {
    console.warn(`🛑 [MassReopen] ALERTA CRÍTICO: Detectada reabertura em massa na instância "${instance}" (${count}/${check.threshold} em ${check.windowSeconds}s)`);
    console.warn(`   Conversa: ${conversationId}, ChatId: ${chatId}`);
    console.warn(`   ⚠️ Mensagem será processada mas marcada como suspeita`);
    
    return {
      shouldBlock: false,
      shouldAlert: true,
      reason: `mass_reopen_detected_${count}_in_${check.windowSeconds}s`,
      count,
    };
  }

  if (count >= MASS_REOPEN_ALERT_THRESHOLD) {
    console.log(`⚠️ [MassReopen] Alerta: ${count} reaberturas na instância "${instance}" nos últimos ${check.windowSeconds}s (limite: ${check.threshold})`);
    return {
      shouldBlock: false,
      shouldAlert: true,
      reason: `approaching_threshold_${count}`,
      count,
    };
  }

  return { shouldBlock: false, shouldAlert: false, count };
}

export async function getReopenStats(instance: string = 'global'): Promise<{ count: number; threshold: number; windowSeconds: number; instance: string }> {
  const check = await checkMassReopen(instance);
  return {
    instance,
    count: check.currentCount,
    threshold: check.threshold,
    windowSeconds: check.windowSeconds,
  };
}
