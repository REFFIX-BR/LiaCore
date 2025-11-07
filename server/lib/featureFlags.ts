import { db } from '../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

export type FeatureFlagKey = 
  | 'voice_outbound_enabled'
  | 'voice_scheduler_enabled'
  | 'voice_dashboard_enabled';

const cache = new Map<FeatureFlagKey, { value: boolean; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minuto

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const envOverride = process.env[`FEATURE_${key.toUpperCase()}`];
  if (envOverride !== undefined) {
    return envOverride === 'true';
  }

  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  const flags = await db.select()
    .from(schema.voiceFeatureFlags)
    .where(eq(schema.voiceFeatureFlags.key, key))
    .limit(1);

  const isEnabled = flags.length > 0 ? flags[0].isEnabled : false;
  
  cache.set(key, { value: isEnabled, timestamp: Date.now() });
  
  return isEnabled;
}

export async function setFeatureFlag(
  key: FeatureFlagKey,
  isEnabled: boolean,
  updatedBy?: string,
  metadata?: any
): Promise<void> {
  await db.insert(schema.voiceFeatureFlags)
    .values({
      key,
      isEnabled,
      updatedBy,
      metadata,
    })
    .onConflictDoUpdate({
      target: schema.voiceFeatureFlags.key,
      set: {
        isEnabled,
        updatedBy,
        metadata,
        updatedAt: new Date(),
      },
    });

  cache.delete(key);
}

export async function getAllFeatureFlags(): Promise<schema.VoiceFeatureFlag[]> {
  return await db.select()
    .from(schema.voiceFeatureFlags);
}

export function clearFeatureFlagCache(): void {
  cache.clear();
}
