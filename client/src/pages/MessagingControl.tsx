import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface WhatsAppStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalContacts: number;
  successfulContacts: number;
  successRate: string;
  promisesMade: number;
  promisesFulfilled: number;
  promiseFulfillmentRate: string;
}

export default function MessagingControl() {
  const { toast } = useToast();
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);

  const { data: stats, isLoading: isLoadingStats } = useQuery<WhatsAppStats>({
    queryKey: ['/api/voice/stats'],
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/voice/messaging-config', 'PUT', {
        whatsappEnabled,
        defaultMethod: 'whatsapp',
      });
    },
    onSuccess: () => {
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
    saveConfigMutation.mutate();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            Gestão de Mensagens WhatsApp
          </h1>
          <p className="text-muted-foreground">
            Controle e estatísticas do sistema de cobrança via WhatsApp
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* KPIs Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Estatísticas Globais WhatsApp
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
                  <div className="text-2xl font-bold" data-testid="stat-total-contacts">
                    {stats.totalContacts || 0}
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

        {/* WhatsApp Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Status do Sistema WhatsApp</CardTitle>
            <CardDescription>
              Sistema de mensagens via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                <Badge variant="default" data-testid="badge-whatsapp-status">
                  Ativo
                </Badge>
                <Switch
                  id="whatsapp-enabled"
                  checked={whatsappEnabled}
                  onCheckedChange={setWhatsappEnabled}
                  data-testid="switch-whatsapp-enabled"
                />
              </div>
            </div>

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Informação</AlertTitle>
              <AlertDescription>
                Todas as campanhas de cobrança utilizam exclusivamente WhatsApp para contato com clientes.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
