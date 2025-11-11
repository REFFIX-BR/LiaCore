import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, Calendar as CalendarIcon, Check, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface CRMImportTabProps {
  campaigns: Array<{ id: string; name: string }>;
}

interface SyncHistory {
  id: string;
  campaignId: string;
  lastSyncAt?: Date;
  lastSyncStatus?: string;
  lastSyncImported?: number;
  lastSyncSkipped?: number;
  lastSyncError?: string | null;
}

export default function CRMImportTab({ campaigns }: CRMImportTabProps) {
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [dateRangeType, setDateRangeType] = useState<'relative' | 'custom'>('relative');
  const [relativeDays, setRelativeDays] = useState<string>('30');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [minDebt, setMinDebt] = useState<string>('');
  const [maxDebt, setMaxDebt] = useState<string>('');
  const [deduplicateBy, setDeduplicateBy] = useState<string>('both');
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);

  // Query para buscar configuração de sincronização existente
  const { data: syncConfigResponse } = useQuery<{ success: boolean; config?: SyncHistory }>({
    queryKey: ['/api/admin/cobranca/crm-sync', selectedCampaign],
    queryFn: async () => {
      if (!selectedCampaign) return { success: false };
      const response = await fetch(`/api/admin/cobranca/crm-sync/${selectedCampaign}`);
      if (!response.ok) {
        if (response.status === 404) return { success: false };
        throw new Error('Erro ao buscar configuração');
      }
      return response.json();
    },
    enabled: !!selectedCampaign,
  });
  const syncConfig = syncConfigResponse?.config;

  // Query para buscar histórico de sincronizações
  const { data: syncHistoryResponse } = useQuery<{ success: boolean; history: SyncHistory[] }>({
    queryKey: ['/api/admin/cobranca/crm-sync-history'],
  });
  const syncHistory = syncHistoryResponse?.history || [];

  // Mutation para executar sincronização manual
  const triggerSyncMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) {
        throw new Error('Selecione uma campanha');
      }

      const payload: any = {
        deduplicateBy,
        updateExisting,
      };

      // Adicionar filtros de data
      if (dateRangeType === 'relative') {
        payload.relativeDays = parseInt(relativeDays);
      } else {
        if (!startDate || !endDate) {
          throw new Error('Selecione as datas de início e fim');
        }
        payload.startDate = startDate.toISOString();
        payload.endDate = endDate.toISOString();
      }

      // Adicionar filtros de valor
      if (minDebt) {
        payload.minDebtAmount = Math.round(parseFloat(minDebt) * 100);
      }
      if (maxDebt) {
        payload.maxDebtAmount = Math.round(parseFloat(maxDebt) * 100);
      }

      return apiRequest(`/api/admin/cobranca/crm-sync/${selectedCampaign}/trigger`, 'POST', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cobranca/crm-sync', selectedCampaign] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cobranca/crm-sync-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/targets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/campaigns'] });
      
      toast({
        title: 'Sincronização Iniciada',
        description: 'A importação de alvos do CRM foi iniciada. Os resultados aparecerão no histórico em breve.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro na Sincronização',
        description: error.message || 'Ocorreu um erro ao iniciar a sincronização.',
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">Nunca executado</Badge>;
    
    const configs = {
      success: { variant: 'default' as const, label: 'Sucesso' },
      failed: { variant: 'destructive' as const, label: 'Erro' },
      running: { variant: 'secondary' as const, label: 'Executando' },
    };
    
    const config = configs[status as keyof typeof configs] || configs.success;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Configuração de Importação
          </CardTitle>
          <CardDescription>
            Configure e execute a importação de clientes inadimplentes do CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seleção de Campanha */}
          <div className="space-y-2">
            <Label htmlFor="campaign-select">Campanha Destino</Label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger id="campaign-select" data-testid="select-campaign">
                <SelectValue placeholder="Selecione uma campanha..." />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Período */}
          <div className="space-y-2">
            <Label>Período de Importação</Label>
            <ToggleGroup
              type="single"
              value={dateRangeType}
              onValueChange={(value) => value && setDateRangeType(value as 'relative' | 'custom')}
              data-testid="toggle-date-type"
            >
              <ToggleGroupItem value="relative" data-testid="toggle-relative">
                Período Relativo
              </ToggleGroupItem>
              <ToggleGroupItem value="custom" data-testid="toggle-custom">
                Datas Personalizadas
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Período Relativo */}
          {dateRangeType === 'relative' && (
            <div className="space-y-2">
              <Label htmlFor="relative-days">Importar inadimplentes dos últimos:</Label>
              <Select value={relativeDays} onValueChange={setRelativeDays}>
                <SelectTrigger id="relative-days" data-testid="select-relative-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="180">180 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Datas Personalizadas */}
          {dateRangeType === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !startDate && 'text-muted-foreground'
                      )}
                      data-testid="button-start-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP', { locale: ptBR }) : 'Selecione...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !endDate && 'text-muted-foreground'
                      )}
                      data-testid="button-end-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP', { locale: ptBR }) : 'Selecione...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Filtros de Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-debt">Valor Mínimo (R$)</Label>
              <Input
                id="min-debt"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={minDebt}
                onChange={(e) => setMinDebt(e.target.value)}
                data-testid="input-min-debt"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-debt">Valor Máximo (R$)</Label>
              <Input
                id="max-debt"
                type="number"
                step="0.01"
                placeholder="Sem limite"
                value={maxDebt}
                onChange={(e) => setMaxDebt(e.target.value)}
                data-testid="input-max-debt"
              />
            </div>
          </div>

          {/* Estratégia de Deduplicação */}
          <div className="space-y-2">
            <Label>Estratégia de Deduplicação</Label>
            <RadioGroup value={deduplicateBy} onValueChange={setDeduplicateBy}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="document" id="dedupe-document" data-testid="radio-document" />
                <Label htmlFor="dedupe-document">Por Documento (CPF/CNPJ)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="phone" id="dedupe-phone" data-testid="radio-phone" />
                <Label htmlFor="dedupe-phone">Por Telefone</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="dedupe-both" data-testid="radio-both" />
                <Label htmlFor="dedupe-both">Por Documento OU Telefone (Recomendado)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Atualizar Existentes */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="update-existing"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="rounded border-gray-300"
              data-testid="checkbox-update-existing"
            />
            <Label htmlFor="update-existing">
              Atualizar alvos existentes (se desabilitado, apenas novos alvos serão importados)
            </Label>
          </div>

          {/* Botão de Executar */}
          <Button
            onClick={() => triggerSyncMutation.mutate()}
            disabled={!selectedCampaign || triggerSyncMutation.isPending}
            className="w-full"
            data-testid="button-trigger-sync"
          >
            {triggerSyncMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Executar Importação
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico de Sincronizações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Importações</CardTitle>
          <CardDescription>
            Últimas sincronizações realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Importados</TableHead>
                  <TableHead>Ignorados</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncHistory && syncHistory.length > 0 ? (
                  syncHistory.map((sync) => {
                    const campaign = campaigns.find(c => c.id === sync.campaignId);
                    return (
                      <TableRow key={sync.id} data-testid={`row-sync-${sync.id}`}>
                        <TableCell className="font-medium">
                          {campaign?.name || 'Campanha Desconhecida'}
                        </TableCell>
                        <TableCell>
                          {sync.lastSyncAt
                            ? format(new Date(sync.lastSyncAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(sync.lastSyncStatus)}</TableCell>
                        <TableCell>{sync.lastSyncImported || 0}</TableCell>
                        <TableCell>{sync.lastSyncSkipped || 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {sync.lastSyncError || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma sincronização realizada ainda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
