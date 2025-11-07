import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Settings, Power, Save, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FeatureFlag {
  key: string;
  isEnabled: boolean;
  metadata?: {
    enabledBy?: string;
    enabledAt?: string;
  };
}

interface VoiceConfig {
  key: string;
  value: string;
}

export default function VoiceSettings() {
  const { toast } = useToast();
  const [isModuleEnabled, setIsModuleEnabled] = useState(false);
  const [configs, setConfigs] = useState<Record<string, string>>({
    TWILIO_ACCOUNT_SID: '',
    TWILIO_AUTH_TOKEN: '',
    TWILIO_PHONE_NUMBER: '',
    VOICE_WEBHOOK_BASE_URL: '',
  });

  const { data: featureFlags } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/voice/feature-flags'],
  });

  const { data: voiceConfigs } = useQuery<VoiceConfig[]>({
    queryKey: ['/api/voice/configs'],
  });

  useEffect(() => {
    const voiceFlag = featureFlags?.find((f) => f.key === 'voice_outbound_enabled');
    if (voiceFlag) {
      setIsModuleEnabled(voiceFlag.isEnabled);
    }
  }, [featureFlags]);

  useEffect(() => {
    if (voiceConfigs) {
      const configMap: Record<string, string> = {};
      voiceConfigs.forEach((config) => {
        configMap[config.key] = config.value;
      });
      setConfigs((prev) => ({ ...prev, ...configMap }));
    }
  }, [voiceConfigs]);

  const toggleModuleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch('/api/voice/feature-flags/voice_outbound_enabled', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: enabled,
          metadata: {},
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/feature-flags'] });
      toast({
        title: isModuleEnabled ? 'Módulo desativado' : 'Módulo ativado',
        description: `LIA VOICE foi ${isModuleEnabled ? 'desativado' : 'ativado'} com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar módulo',
        description: error.message || 'Ocorreu um erro ao atualizar o módulo.',
        variant: 'destructive',
      });
    },
  });

  const saveConfigsMutation = useMutation({
    mutationFn: async () => {
      const promises = Object.entries(configs).map(([key, value]) =>
        fetch('/api/voice/configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        }).then(r => { if (!r.ok) throw new Error('Failed to save config'); return r.json(); })
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/configs'] });
      toast({
        title: 'Configurações salvas',
        description: 'As configurações foram salvas com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao salvar configurações',
        description: error.message || 'Ocorreu um erro ao salvar as configurações.',
        variant: 'destructive',
      });
    },
  });

  const handleToggleModule = () => {
    toggleModuleMutation.mutate(!isModuleEnabled);
  };

  const handleSaveConfigs = () => {
    saveConfigsMutation.mutate();
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfigs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Configurações LIA VOICE
          </h1>
          <p className="text-muted-foreground">Gerenciar configurações do módulo de voz</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Power className="h-5 w-5" />
                  Status do Módulo
                </CardTitle>
                <CardDescription>Ativar ou desativar o módulo LIA VOICE</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {isModuleEnabled ? (
                  <Badge variant="default" data-testid="badge-module-status">
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="outline" data-testid="badge-module-status">
                    Inativo
                  </Badge>
                )}
                <Switch
                  checked={isModuleEnabled}
                  onCheckedChange={handleToggleModule}
                  disabled={toggleModuleMutation.isPending}
                  data-testid="switch-module-enabled"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                Quando o módulo está ativo, as campanhas agendadas serão executadas
                automaticamente. Certifique-se de que as credenciais Twilio estão
                configuradas corretamente antes de ativar.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credenciais Twilio</CardTitle>
            <CardDescription>
              Configure as credenciais da sua conta Twilio para realizar chamadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="twilio-sid">Account SID</Label>
              <Input
                id="twilio-sid"
                type="password"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={configs.TWILIO_ACCOUNT_SID}
                onChange={(e) => handleConfigChange('TWILIO_ACCOUNT_SID', e.target.value)}
                data-testid="input-twilio-sid"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-token">Auth Token</Label>
              <Input
                id="twilio-token"
                type="password"
                placeholder="••••••••••••••••••••••••••••••••"
                value={configs.TWILIO_AUTH_TOKEN}
                onChange={(e) => handleConfigChange('TWILIO_AUTH_TOKEN', e.target.value)}
                data-testid="input-twilio-token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-phone">Número de Telefone Twilio</Label>
              <Input
                id="twilio-phone"
                type="tel"
                placeholder="+5511999999999"
                value={configs.TWILIO_PHONE_NUMBER}
                onChange={(e) => handleConfigChange('TWILIO_PHONE_NUMBER', e.target.value)}
                data-testid="input-twilio-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook Base URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-app.replit.app"
                value={configs.VOICE_WEBHOOK_BASE_URL}
                onChange={(e) => handleConfigChange('VOICE_WEBHOOK_BASE_URL', e.target.value)}
                data-testid="input-webhook-url"
              />
              <p className="text-xs text-muted-foreground">
                URL base da aplicação para receber webhooks do Twilio
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSaveConfigs}
                disabled={saveConfigsMutation.isPending}
                data-testid="button-save-configs"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveConfigsMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Sistema</CardTitle>
            <CardDescription>Status e configurações do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Workers Ativos</span>
                <Badge variant="outline">5 workers</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Filas BullMQ</span>
                <Badge variant="outline">
                  ingest, scheduling, dialer, post-call, promise-monitor
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Compliance ANATEL</span>
                <Badge variant="default">08:00 - 20:00</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Max Tentativas por Cliente</span>
                <Badge variant="outline">3 tentativas</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
