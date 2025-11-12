import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Phone, Search, PhoneCall, PhoneOff, Clock, CheckCircle2, XCircle, Trash2, Upload, Calendar, Edit, Check, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import CRMImportTab from '@/components/voice/CRMImportTab';
import { Checkbox } from '@/components/ui/checkbox';

interface Target {
  id: string;
  campaignId: string;
  debtorName: string;
  phoneNumber: string; // Alinhado com backend
  debtAmount?: number;
  status: 'pending' | 'in_progress' | 'contacted' | 'promise_made' | 'failed';
  attemptCount?: number; // Alinhado com backend
  maxAttempts?: number;
  lastAttemptAt?: string;
  nextScheduledAt?: string;
  promiseMade?: boolean;
  enabled?: boolean; // Controle de envio
  createdAt?: string;
}

// Schema de validação do formulário
const updateTargetSchema = z.object({
  debtorName: z.string().min(1, "Nome é obrigatório"),
  phoneNumber: z.string().regex(/^\d{10,11}$/, "Telefone deve ter 10 ou 11 dígitos (apenas números)"),
  debtAmount: z.string().optional().transform((val) => {
    if (!val || val === '') return undefined;
    const num = parseFloat(val);
    return isNaN(num) ? undefined : Math.round(num * 100); // Converter reais para centavos
  }),
  maxAttempts: z.string().optional().transform((val) => {
    if (!val || val === '') return undefined;
    const num = parseInt(val);
    return isNaN(num) ? undefined : num;
  }),
  nextScheduledAt: z.string().optional().transform((val) => {
    // Normalize empty/placeholder strings to undefined
    if (!val || val === '' || val.trim() === '' || val.includes('mm/dd/yyyy') || val.includes('--:--')) {
      return undefined;
    }
    return val;
  }),
});

export default function VoiceTargets() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [targetToDelete, setTargetToDelete] = useState<Target | null>(null);
  const [targetToEdit, setTargetToEdit] = useState<Target | null>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());

  const { data: targets, isLoading } = useQuery<Target[]>({
    queryKey: ['/api/voice/targets'],
  });

  const { data: campaigns } = useQuery<any[]>({
    queryKey: ['/api/voice/campaigns'],
  });

  const deleteTargetMutation = useMutation({
    mutationFn: async (targetId: string) => {
      return apiRequest(`/api/voice/targets/${targetId}`, 'DELETE', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/targets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/stats'] });
      toast({
        title: 'Alvo excluído',
        description: 'O alvo foi excluído com sucesso.',
      });
      setTargetToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir alvo',
        description: error.message || 'Ocorreu um erro ao excluir o alvo.',
        variant: 'destructive',
      });
    },
  });

  const updateTargetMutation = useMutation({
    mutationFn: async ({ targetId, data }: { targetId: string; data: any }) => {
      return apiRequest(`/api/voice/targets/${targetId}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/targets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/stats'] });
      toast({
        title: 'Alvo atualizado',
        description: 'Os dados do alvo foram atualizados com sucesso.',
      });
      setTargetToEdit(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar alvo',
        description: error.message || 'Ocorreu um erro ao atualizar o alvo.',
        variant: 'destructive',
      });
    },
  });

  const bulkToggleMutation = useMutation({
    mutationFn: async ({ targetIds, enabled }: { targetIds: string[]; enabled: boolean }) => {
      return apiRequest('/api/voice/targets/bulk-toggle', 'POST', { targetIds, enabled });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/targets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/stats'] });
      toast({
        title: data.message || 'Alvos atualizados',
        description: `${data.updated} alvos foram atualizados com sucesso.`,
      });
      setSelectedTargetIds(new Set());
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar alvos',
        description: error.message || 'Ocorreu um erro ao atualizar os alvos em massa.',
        variant: 'destructive',
      });
    },
  });

  // Funções auxiliares de seleção
  const toggleTargetSelection = (targetId: string) => {
    const newSelection = new Set(selectedTargetIds);
    if (newSelection.has(targetId)) {
      newSelection.delete(targetId);
    } else {
      newSelection.add(targetId);
    }
    setSelectedTargetIds(newSelection);
  };

  const toggleAllTargetsSelection = () => {
    if (!filteredTargets) return;
    
    if (selectedTargetIds.size === filteredTargets.length) {
      setSelectedTargetIds(new Set());
    } else {
      setSelectedTargetIds(new Set(filteredTargets.map(t => t.id)));
    }
  };

  const handleBulkEnable = () => {
    if (selectedTargetIds.size === 0) return;
    bulkToggleMutation.mutate({ targetIds: Array.from(selectedTargetIds), enabled: true });
  };

  const handleBulkDisable = () => {
    if (selectedTargetIds.size === 0) return;
    bulkToggleMutation.mutate({ targetIds: Array.from(selectedTargetIds), enabled: false });
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { variant: 'outline' as const, icon: Clock, label: 'Pendente' },
      in_progress: { variant: 'default' as const, icon: PhoneCall, label: 'Em Progresso' },
      contacted: { variant: 'secondary' as const, icon: CheckCircle2, label: 'Contatado' },
      promise_made: { variant: 'default' as const, icon: CheckCircle2, label: 'Promessa' },
      failed: { variant: 'destructive' as const, icon: XCircle, label: 'Falhou' },
    };

    const { variant, icon: Icon, label } = config[status as keyof typeof config] || config.pending;

    return (
      <Badge variant={variant}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const EditTargetDialog = ({ 
    target, 
    open, 
    onOpenChange, 
    onSubmit, 
    isPending 
  }: { 
    target: Target | null; 
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
    onSubmit: (data: any) => void; 
    isPending: boolean; 
  }) => {
    const form = useForm({
      resolver: zodResolver(updateTargetSchema),
      defaultValues: {
        debtorName: '',
        phoneNumber: '',
        debtAmount: '',
        maxAttempts: '',
        nextScheduledAt: '',
      },
    });

    // Reset form when target changes
    useEffect(() => {
      if (target) {
        form.reset({
          debtorName: target.debtorName || '',
          phoneNumber: target.phoneNumber || '',
          debtAmount: target.debtAmount ? (target.debtAmount / 100).toFixed(2) : '',
          maxAttempts: target.maxAttempts?.toString() || '',
          nextScheduledAt: target.nextScheduledAt 
            ? format(new Date(target.nextScheduledAt), "yyyy-MM-dd'T'HH:mm")
            : '',
        });
      }
    }, [target, form]);

    const handleSubmit = form.handleSubmit((data) => {
      // Schema já faz as conversões necessárias (debtAmount → centavos, maxAttempts → number)
      // Apenas validar maxAttempts >= attemptCount
      if (data.maxAttempts) {
        const maxAttempts = typeof data.maxAttempts === 'number' ? data.maxAttempts : parseInt(data.maxAttempts);
        if (target && target.attemptCount && maxAttempts < target.attemptCount) {
          form.setError('maxAttempts', {
            message: `Máximo de tentativas deve ser maior ou igual a ${target.attemptCount} (tentativas atuais)`,
          });
          return;
        }
      }

      // Remove undefined fields from payload
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );

      onSubmit(cleanedData);
    });

    if (!target) return null;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Alvo</DialogTitle>
            <DialogDescription>
              Atualize as informações do alvo de cobrança
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="debtorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Devedor</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Nome completo"
                        data-testid="input-edit-debtor-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        placeholder="DDD + Número (apenas dígitos)"
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                        data-testid="input-edit-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="debtAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Dívida (R$)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="input-edit-debt-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxAttempts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máximo de Tentativas</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="number"
                        min={target.attemptCount || 0}
                        placeholder="3"
                        data-testid="input-edit-max-attempts"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nextScheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Próxima Tentativa Agendada</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="datetime-local"
                        data-testid="input-edit-next-scheduled"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  data-testid="button-cancel-edit"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isPending}
                  data-testid="button-submit-edit"
                >
                  {isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  };

  const filteredTargets = targets?.filter((target) => {
    const matchesSearch =
      target.debtorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      target.phoneNumber.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || target.status === statusFilter;
    const matchesCampaign = campaignFilter === 'all' || target.campaignId === campaignFilter;

    return matchesSearch && matchesStatus && matchesCampaign;
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Alvos de Cobrança</h1>
            <p className="text-muted-foreground">Gerenciar clientes das campanhas</p>
          </div>
        </div>
        <Card>
          <CardHeader className="animate-pulse">
            <div className="h-4 bg-muted rounded w-48 mb-2"></div>
            <div className="h-4 bg-muted rounded w-64"></div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Phone className="h-8 w-8" />
            Alvos de Cobrança
          </h1>
          <p className="text-muted-foreground">Gerenciar clientes das campanhas</p>
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-4" data-testid="tabs-voice-targets">
        <TabsList data-testid="tablist-voice-targets">
          <TabsTrigger value="list" data-testid="tab-list">
            <Search className="h-4 w-4 mr-2" />
            Lista de Alvos
          </TabsTrigger>
          <TabsTrigger value="import" data-testid="tab-import">
            <Upload className="h-4 w-4 mr-2" />
            Importação CRM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" data-testid="tabcontent-list">
          <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Busque e filtre os alvos das campanhas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search"
              />
            </div>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger data-testid="select-campaign">
                <SelectValue placeholder="Todas as campanhas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {campaigns?.map((campaign: any) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="in_progress">Em Progresso</SelectItem>
                <SelectItem value="contacted">Contatado</SelectItem>
                <SelectItem value="promise_made">Promessa Feita</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Lista de Alvos</CardTitle>
            <CardDescription>
              {filteredTargets?.length || 0} alvos encontrados
              {selectedTargetIds.size > 0 && ` | ${selectedTargetIds.size} selecionados`}
            </CardDescription>
          </div>
          {selectedTargetIds.size > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkEnable}
                disabled={bulkToggleMutation.isPending}
                data-testid="button-enable-selected"
              >
                <Check className="h-4 w-4 mr-1" />
                Habilitar Selecionados
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkDisable}
                disabled={bulkToggleMutation.isPending}
                data-testid="button-disable-selected"
              >
                <X className="h-4 w-4 mr-1" />
                Desabilitar Selecionados
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={filteredTargets && filteredTargets.length > 0 && selectedTargetIds.size === filteredTargets.length}
                      onCheckedChange={toggleAllTargetsSelection}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Valor da Dívida</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Habilitado</TableHead>
                  <TableHead>Última Tentativa</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTargets && filteredTargets.length > 0 ? (
                  filteredTargets.map((target) => (
                    <TableRow key={target.id} data-testid={`row-target-${target.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTargetIds.has(target.id)}
                          onCheckedChange={() => toggleTargetSelection(target.id)}
                          data-testid={`checkbox-select-${target.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`cell-name-${target.id}`}>
                        {target.debtorName}
                      </TableCell>
                      <TableCell data-testid={`cell-phone-${target.id}`}>
                        {target.phoneNumber}
                      </TableCell>
                      <TableCell data-testid={`cell-amount-${target.id}`}>
                        {target.debtAmount
                          ? `R$ ${(target.debtAmount / 100).toFixed(2)}`
                          : '-'}
                      </TableCell>
                      <TableCell data-testid={`cell-attempts-${target.id}`}>
                        {target.attemptCount || 0} / {target.maxAttempts || 3}
                      </TableCell>
                      <TableCell data-testid={`cell-status-${target.id}`}>
                        {getStatusBadge(target.status)}
                      </TableCell>
                      <TableCell data-testid={`cell-enabled-${target.id}`}>
                        <Badge variant={target.enabled !== false ? "default" : "outline"}>
                          {target.enabled !== false ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`cell-last-attempt-${target.id}`}>
                        {target.lastAttemptAt
                          ? formatDistanceToNow(new Date(target.lastAttemptAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-details-${target.id}`}
                          >
                            Ver Detalhes
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTargetToEdit(target)}
                            data-testid={`button-edit-${target.id}`}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTargetToDelete(target)}
                            data-testid={`button-delete-${target.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhum alvo encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="import" data-testid="tabcontent-import">
          <CRMImportTab campaigns={campaigns || []} />
        </TabsContent>
      </Tabs>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!targetToDelete} onOpenChange={(open) => !open && setTargetToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o alvo "{targetToDelete?.debtorName}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setTargetToDelete(null)}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => targetToDelete && deleteTargetMutation.mutate(targetToDelete.id)}
              disabled={deleteTargetMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteTargetMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Target Dialog */}
      <EditTargetDialog
        target={targetToEdit}
        open={!!targetToEdit}
        onOpenChange={(open) => !open && setTargetToEdit(null)}
        onSubmit={(data) => targetToEdit && updateTargetMutation.mutate({ targetId: targetToEdit.id, data })}
        isPending={updateTargetMutation.isPending}
      />
    </div>
  );
}
