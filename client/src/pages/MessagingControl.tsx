import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Phone, Save, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface VoiceMessagingSettings {
  id: number;
  voiceEnabled: boolean;
  whatsappEnabled: boolean;
  defaultMethod: 'voice' | 'whatsapp' | 'hybrid';
  fallbackOrder: string[];
  description?: string;
  updatedBy?: string;
  updatedAt: Date;
  createdAt: Date;
}

interface VoiceStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalCalls: number;
  successfulCalls: number;
  successRate: string;
  promisesMade: number;
  promisesFulfilled: number;
  promiseFulfillmentRate: string;
}

export default function MessagingControl() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Partial<VoiceMessagingSettings>>({
    voiceEnabled: true,
    whatsappEnabled: true,
    defaultMethod: 'voice',
    fallbackOrder: ['voice', 'whatsapp'],
  });

  const { data: messagingConfig, isLoading: isLoadingConfig } = useQuery<VoiceMessagingSettings>({
    queryKey: ['/api/voice/messaging-config'],
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery<VoiceStats>({
    queryKey: ['/api/voice/stats'],
  });

  useEffect(() => {
    if (messagingConfig) {
      setSettings({
        voiceEnabled: messagingConfig.voiceEnabled,
        whatsappEnabled: messagingConfig.whatsappEnabled,
        defaultMethod: messagingConfig.defaultMethod,
        fallbackOrder: messagingConfig.fallbackOrder,
        description: messagingConfig.description,
      });
    }
  }, [messagingConfig]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/voice/messaging-config', 'PUT', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/messaging-config'] });
      toast({
        title: 'Configurações salvas',
        description: 'As configurações de mensagens foram atualizadas com sucesso.',
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

  const handleSave = () => {
    // Validar que pelo menos um método está habilitado
    if (!settings.voiceEnabled && !settings.whatsappEnabled) {
      toast({
        title: 'Erro de validação',
        description: 'Pelo menos um método de contato deve estar habilitado.',
        variant: 'destructive',
      });
      return;
    }

    saveConfigMutation.mutate();
  };

  const handleToggleVoice = (checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      voiceEnabled: checked,
      // Se desabilitar voice e ele estiver no fallback, remover
      fallbackOrder: !checked
        ? prev.fallbackOrder?.filter((m) => m !== 'voice')
        : prev.fallbackOrder,
    }));
  };

  const handleToggleWhatsApp = (checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      whatsappEnabled: checked,
      // Se desabilitar whatsapp e ele estiver no fallback, remover
      fallbackOrder: !checked
        ? prev.fallbackOrder?.filter((m) => m !== 'whatsapp')
        : prev.fallbackOrder,
    }));
  };

  const handleMethodChange = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      defaultMethod: value as 'voice' | 'whatsapp' | 'hybrid',
    }));
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            Gestão de Mensagens
          </h1>
          <p className="text-muted-foreground">
            Controle global dos métodos de contato disponíveis
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveConfigMutation.isPending}
          data-testid="button-save-config"
        >
          <Save className="h-4 w-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* KPIs Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Estatísticas Globais
            </CardTitle>
            <CardDescription>
              Métricas consolidadas de todas as campanhas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="text-sm text-muted-foreground">Carregando estatísticas...</div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Campanhas Ativas</div>
                  <div className="text-2xl font-bold" data-testid="stat-active-campaigns">
                    {stats.activeCampaigns}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Total de Contatos</div>
                  <div className="text-2xl font-bold" data-testid="stat-total-calls">
                    {stats.totalCalls}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Taxa de Sucesso</div>
                  <div className="text-2xl font-bold" data-testid="stat-success-rate">
                    {stats.successRate}%
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Promessas</div>
                  <div className="text-2xl font-bold" data-testid="stat-promises">
                    {stats.promisesMade}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Nenhuma estatística disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Métodos Habilitados Card */}
        <Card>
          <CardHeader>
            <CardTitle>Métodos de Contato Habilitados</CardTitle>
            <CardDescription>
              Ativar ou desativar métodos de contato globalmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <Label htmlFor="voice-enabled" className="font-medium">
                    Ligações por Voz
                  </Label>
                </div>
                <div className="text-sm text-muted-foreground">
                  Twilio + OpenAI Realtime API
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settings.voiceEnabled ? (
                  <Badge variant="default" data-testid="badge-voice-status">
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="outline" data-testid="badge-voice-status">
                    Inativo
                  </Badge>
                )}
                <Switch
                  id="voice-enabled"
                  checked={settings.voiceEnabled}
                  onCheckedChange={handleToggleVoice}
                  data-testid="switch-voice-enabled"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <Label htmlFor="whatsapp-enabled" className="font-medium">
                    WhatsApp AI
                  </Label>
                </div>
                <div className="text-sm text-muted-foreground">
                  Evolution API + IA Financeiro
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settings.whatsappEnabled ? (
                  <Badge variant="default" data-testid="badge-whatsapp-status">
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="outline" data-testid="badge-whatsapp-status">
                    Inativo
                  </Badge>
                )}
                <Switch
                  id="whatsapp-enabled"
                  checked={settings.whatsappEnabled}
                  onCheckedChange={handleToggleWhatsApp}
                  data-testid="switch-whatsapp-enabled"
                />
              </div>
            </div>

            {!settings.voiceEnabled && !settings.whatsappEnabled && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Aviso</AlertTitle>
                <AlertDescription>
                  Pelo menos um método de contato deve estar habilitado.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Método Padrão Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Método Padrão</CardTitle>
          <CardDescription>
            Defina qual método será usado por padrão nas novas campanhas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.defaultMethod}
            onValueChange={handleMethodChange}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="voice"
                id="default-voice"
                disabled={!settings.voiceEnabled}
                data-testid="radio-default-voice"
              />
              <Label
                htmlFor="default-voice"
                className={!settings.voiceEnabled ? 'text-muted-foreground' : ''}
              >
                Ligação por Voz (Twilio)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="whatsapp"
                id="default-whatsapp"
                disabled={!settings.whatsappEnabled}
                data-testid="radio-default-whatsapp"
              />
              <Label
                htmlFor="default-whatsapp"
                className={!settings.whatsappEnabled ? 'text-muted-foreground' : ''}
              >
                WhatsApp AI (Evolution API)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="hybrid"
                id="default-hybrid"
                disabled={!settings.voiceEnabled || !settings.whatsappEnabled}
                data-testid="radio-default-hybrid"
              />
              <Label
                htmlFor="default-hybrid"
                className={
                  !settings.voiceEnabled || !settings.whatsappEnabled
                    ? 'text-muted-foreground'
                    : ''
                }
              >
                Híbrido (escolha por campanha)
              </Label>
            </div>
          </RadioGroup>

          <Alert className="mt-4">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Informação</AlertTitle>
            <AlertDescription>
              O método padrão será aplicado automaticamente a novas campanhas, mas pode ser
              sobrescrito individualmente em cada campanha.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
