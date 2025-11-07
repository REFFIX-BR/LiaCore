import { useQuery } from '@tanstack/react-query';

export type FeatureFlagKey = 
  | 'voice_outbound_enabled'
  | 'voice_scheduler_enabled'
  | 'voice_dashboard_enabled';

interface FeatureFlag {
  key: string;
  isEnabled: boolean;
  metadata?: any;
}

export function useFeatureFlag(key: FeatureFlagKey) {
  const { data, isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/voice/feature-flags'],
    staleTime: 60000, // 1 minuto
  });

  const flag = data?.find(f => f.key === key);
  
  return {
    isEnabled: flag?.isEnabled ?? false,
    isLoading,
    metadata: flag?.metadata,
  };
}

export function useAllFeatureFlags() {
  return useQuery<FeatureFlag[]>({
    queryKey: ['/api/voice/feature-flags'],
    staleTime: 60000,
  });
}
