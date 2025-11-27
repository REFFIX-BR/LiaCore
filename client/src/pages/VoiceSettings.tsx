import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Settings, Power, Save, AlertCircle, MessageSquare, Clock } from 'lucide-react';
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
    WHATSAPP_COLLECTION_DELAY_MS: '300000',
    WHATSAPP_MAX_ATTEMPTS: '3',
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
        description: `COBRANÇAS foi ${isModuleEnabled ? 'desativado' : 'ativado'} com sucesso.`,
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

  const delayMinutes = Math.round(parseInt(configs.WHATSAPP_COLLECTION_DELAY_MS || '300000') / 60000);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Configurações COBRANÇAS
          </h1>
          <p className="text-muted-foreground">Gerenciar configurações do módulo de cobrança via WhatsApp</p>
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
                <CardDescription>Ativar ou desativar o módulo COBRANÇAS</CardDescription>
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
                automaticamente via WhatsApp. As mensagens são enviadas através da
                instância "Cobranca" do Evolution API.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Configurações WhatsApp
            </CardTitle>
            <CardDescription>
              Configure os parâmetros de envio de mensagens de cobrança via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delay-ms" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Intervalo entre mensagens (ms)
              </Label>
              <Input
                id="delay-ms"
                type="number"
                placeholder="300000"
                value={configs.WHATSAPP_COLLECTION_DELAY_MS}
                onChange={(e) => handleConfigChange('WHATSAPP_COLLECTION_DELAY_MS', e.target.value)}
                data-testid="input-delay-ms"
              />
              <p className="text-xs text-muted-foreground">
                Intervalo de {delayMinutes} minuto(s) entre cada mensagem enviada.
                Recomendado: 300000ms (5 minutos) para evitar bloqueios do WhatsApp.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-attempts">Máximo de Tentativas por Cliente</Label>
              <Input
                id="max-attempts"
                type="number"
                placeholder="3"
                min="1"
                max="10"
                value={configs.WHATSAPP_MAX_ATTEMPTS}
                onChange={(e) => handleConfigChange('WHATSAPP_MAX_ATTEMPTS', e.target.value)}
                data-testid="input-max-attempts"
              />
              <p className="text-xs text-muted-foreground">
                Número máximo de tentativas de contato por cliente antes de marcar como falha.
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
            <CardDescription>Status e configurações do sistema de cobrança</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Canal de Envio</span>
                <Badge variant="default">WhatsApp (Evolution API)</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Instância</span>
                <Badge variant="outline">Cobranca</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Workers Ativos</span>
                <Badge variant="outline">WhatsApp Collection, Retry, Promise Monitor</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Compliance ANATEL</span>
                <Badge variant="default">Seg-Sex: 08:00-20:00 | Sáb: 08:00-18:00</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">IA Assistente</span>
                <Badge variant="outline">Lia Cobrança (GPT-5)</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
