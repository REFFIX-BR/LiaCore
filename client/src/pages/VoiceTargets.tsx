import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Phone, Search, PhoneCall, PhoneOff, Clock, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface Target {
  id: string;
  campaignId: string;
  debtorName: string;
  debtorPhone: string;
  debtAmount?: number;
  status: 'pending' | 'in_progress' | 'contacted' | 'promise_made' | 'failed';
  attemptsMade?: number;
  maxAttempts?: number;
  lastAttemptAt?: string;
  nextScheduledAt?: string;
  promiseMade?: boolean;
  createdAt?: string;
}

export default function VoiceTargets() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [targetToDelete, setTargetToDelete] = useState<Target | null>(null);

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

  const filteredTargets = targets?.filter((target) => {
    const matchesSearch =
      target.debtorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      target.debtorPhone.includes(searchTerm);
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
        <CardHeader>
          <CardTitle>Lista de Alvos</CardTitle>
          <CardDescription>
            {filteredTargets?.length || 0} alvos encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Valor da Dívida</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Tentativa</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTargets && filteredTargets.length > 0 ? (
                  filteredTargets.map((target) => (
                    <TableRow key={target.id} data-testid={`row-target-${target.id}`}>
                      <TableCell className="font-medium" data-testid={`cell-name-${target.id}`}>
                        {target.debtorName}
                      </TableCell>
                      <TableCell data-testid={`cell-phone-${target.id}`}>
                        {target.debtorPhone}
                      </TableCell>
                      <TableCell data-testid={`cell-amount-${target.id}`}>
                        {target.debtAmount
                          ? `R$ ${(target.debtAmount / 100).toFixed(2)}`
                          : '-'}
                      </TableCell>
                      <TableCell data-testid={`cell-attempts-${target.id}`}>
                        {target.attemptsMade || 0} / {target.maxAttempts || 3}
                      </TableCell>
                      <TableCell data-testid={`cell-status-${target.id}`}>
                        {getStatusBadge(target.status)}
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
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum alvo encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
