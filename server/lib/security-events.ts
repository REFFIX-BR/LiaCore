import { redisConnection } from "./redis-config";

export enum SecurityEventType {
  FAILED_LOGIN = "failed_login",
  SUCCESSFUL_LOGIN = "successful_login",
  UNAUTHORIZED_ACCESS = "unauthorized_access",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
}

export interface SecurityEvent {
  type: SecurityEventType;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: number;
  details?: string;
}

/**
 * Registra um evento de segurança no Redis
 */
export async function trackSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `security:events:${today}`;
    
    const eventData = {
      ...event,
      timestamp: Date.now()
    };
    
    // Armazena no Redis
    await redisConnection.rpush(key, JSON.stringify(eventData));
    
    // Expira após 90 dias (requisitos de compliance)
    await redisConnection.expire(key, 90 * 24 * 60 * 60);
    
    // Log especial para tentativas de login falhadas
    if (event.type === SecurityEventType.FAILED_LOGIN) {
      console.warn(`🔐 [Security] Login falho: ${event.username || 'unknown'} de ${event.ipAddress || 'unknown IP'}`);
    }
  } catch (error) {
    console.error("❌ [Security] Error tracking security event:", error);
  }
}

/**
 * Obtém estatísticas de segurança dos últimos N dias
 */
export async function getSecurityStats(days: number = 30): Promise<{
  total: number;
  failedLogins: number;
  unauthorizedAccess: number;
  suspiciousActivity: number;
  recentEvents: SecurityEvent[];
}> {
  try {
    const now = new Date();
    let total = 0;
    let failedLogins = 0;
    let unauthorizedAccess = 0;
    let suspiciousActivity = 0;
    const recentEvents: SecurityEvent[] = [];
    
    // Coleta eventos dos últimos N dias
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const key = `security:events:${dateStr}`;
      
      const events = await redisConnection.lrange(key, 0, -1);
      
      for (const eventStr of events) {
        const event = JSON.parse(eventStr) as SecurityEvent;
        total++;
        
        if (event.type === SecurityEventType.FAILED_LOGIN) {
          failedLogins++;
        } else if (event.type === SecurityEventType.UNAUTHORIZED_ACCESS) {
          unauthorizedAccess++;
        } else if (event.type === SecurityEventType.SUSPICIOUS_ACTIVITY) {
          suspiciousActivity++;
        }
        
        // Mantém os 50 eventos mais recentes
        if (recentEvents.length < 50) {
          recentEvents.push(event);
        }
      }
    }
    
    // Ordena por timestamp decrescente (mais recentes primeiro)
    recentEvents.sort((a, b) => b.timestamp - a.timestamp);
    
    return {
      total,
      failedLogins,
      unauthorizedAccess,
      suspiciousActivity,
      recentEvents: recentEvents.slice(0, 20) // Retorna apenas os 20 mais recentes
    };
  } catch (error) {
    console.error("❌ [Security] Error getting security stats:", error);
    return {
      total: 0,
      failedLogins: 0,
      unauthorizedAccess: 0,
      suspiciousActivity: 0,
      recentEvents: []
    };
  }
}

/**
 * Verifica se um IP está sob ataque (muitos failed logins)
 */
export async function isIpUnderAttack(ipAddress: string, threshold: number = 5): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `security:events:${today}`;
    const events = await redisConnection.lrange(key, 0, -1);
    
    let failedCount = 0;
    for (const eventStr of events) {
      const event = JSON.parse(eventStr) as SecurityEvent;
      if (
        event.type === SecurityEventType.FAILED_LOGIN &&
        event.ipAddress === ipAddress &&
        Date.now() - event.timestamp < 15 * 60 * 1000 // últimos 15 minutos
      ) {
        failedCount++;
      }
    }
    
    return failedCount >= threshold;
  } catch (error) {
    console.error("❌ [Security] Error checking IP attack:", error);
    return false;
  }
}
