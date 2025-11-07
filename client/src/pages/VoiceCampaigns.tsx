import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, Plus, Upload, TrendingUp, Users, CheckCircle2, XCircle, Calendar } from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const campaignSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  systemPrompt: z.string().min(10, 'Prompt deve ter pelo menos 10 caracteres'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'paused';
  systemPrompt?: string;
  startDate?: string;
  endDate?: string;
  totalTargets?: number;
  contactedTargets?: number;
  successfulContacts?: number;
  promisesMade?: number;
  createdAt?: string;
}

export default function VoiceCampaigns() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/voice/campaigns'],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ['/api/voice/stats'],
  });

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      systemPrompt: '',
      startDate: '',
      endDate: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const response = await fetch('/api/voice/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/stats'] });
      toast({
        title: 'Campanha criada',
        description: 'A campanha foi criada com sucesso.',
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar campanha',
        description: error.message || 'Ocorreu um erro ao criar a campanha.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CampaignFormData) => {
    createMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      completed: 'secondary',
      paused: 'outline',
    } as const;
    const labels = {
      active: 'Ativa',
      completed: 'Concluída',
      paused: 'Pausada',
    };
    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">LIA VOICE</h1>
            <p className="text-muted-foreground">Campanhas de Cobrança por Voz</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                <div className="h-8 bg-muted rounded w-16"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Phone className="h-8 w-8" />
            LIA VOICE
          </h1>
          <p className="text-muted-foreground">Campanhas de Cobrança por Voz</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-campaign">
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha</DialogTitle>
              <DialogDescription>
                Configure uma nova campanha de cobrança por voz
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Campanha</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Cobrança Inadimplentes Novembro 2025"
                          data-testid="input-campaign-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="systemPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt do Sistema (Instruções para a IA)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Você é Lia, assistente de cobrança da TR Telecom..."
                          className="min-h-[200px]"
                          data-testid="input-system-prompt"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Início</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Término</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-end-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending ? 'Criando...' : 'Criar Campanha'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Campanhas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-campaigns">
              {stats?.totalCampaigns || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeCampaigns || 0} ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ligações</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-calls">
              {stats?.totalCalls || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.successRate || 0}% de sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promessas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-promises-made">
              {stats?.promisesMade || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.promisesFulfilled || 0} cumpridas ({stats?.promiseFulfillmentRate || 0}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {stats?.successRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.successfulCalls || 0} de {stats?.totalCalls || 0} ligações
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {campaigns && campaigns.length > 0 ? (
          campaigns.map((campaign) => (
            <Card key={campaign.id} data-testid={`card-campaign-${campaign.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{campaign.name}</CardTitle>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <CardDescription>
                      Criada {campaign.createdAt && formatDistanceToNow(new Date(campaign.createdAt), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" data-testid={`button-upload-${campaign.id}`}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Alvos
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Alvos Totais</p>
                    <p className="text-2xl font-bold">{campaign.totalTargets || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contatados</p>
                    <p className="text-2xl font-bold">{campaign.contactedTargets || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sucesso</p>
                    <p className="text-2xl font-bold">{campaign.successfulContacts || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Promessas</p>
                    <p className="text-2xl font-bold">{campaign.promisesMade || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Nenhuma campanha criada</CardTitle>
              <CardDescription>
                Crie sua primeira campanha de cobrança por voz clicando no botão "Nova Campanha"
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
