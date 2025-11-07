import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Clock, XCircle, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Promise {
  id: string;
  targetId: string;
  campaignId: string;
  debtorName?: string;
  amount?: number;
  dueDate?: string;
  paymentMethod?: string;
  status: 'pending' | 'fulfilled' | 'broken';
  monitoredUntil?: string;
  createdAt?: string;
}

export default function VoicePromises() {
  const { data: promises, isLoading } = useQuery<Promise[]>({
    queryKey: ['/api/voice/promises'],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ['/api/voice/stats'],
  });

  const pendingPromises = promises?.filter((p) => p.status === 'pending') || [];
  const fulfilledPromises = promises?.filter((p) => p.status === 'fulfilled') || [];
  const brokenPromises = promises?.filter((p) => p.status === 'broken') || [];
  const overduePromises =
    promises?.filter(
      (p) => p.status === 'pending' && p.dueDate && isPast(new Date(p.dueDate))
    ) || [];

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { variant: 'outline' as const, icon: Clock, label: 'Pendente' },
      fulfilled: { variant: 'default' as const, icon: CheckCircle2, label: 'Cumprida' },
      broken: { variant: 'destructive' as const, icon: XCircle, label: 'Quebrada' },
    };

    const { variant, icon: Icon, label } = config[status as keyof typeof config] || config.pending;

    return (
      <Badge variant={variant}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Promessas de Pagamento</h1>
            <p className="text-muted-foreground">Monitoramento de compromissos</p>
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
            <CheckCircle2 className="h-8 w-8" />
            Promessas de Pagamento
          </h1>
          <p className="text-muted-foreground">Monitoramento de compromissos</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Promessas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-promises">
              {promises?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.promisesMade || 0} este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-promises">
              {pendingPromises.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {overduePromises.length} vencidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cumpridas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-fulfilled-promises">
              {fulfilledPromises.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.promisesFulfilled || 0} este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Cumprimento</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-fulfillment-rate">
              {stats?.promiseFulfillmentRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {fulfilledPromises.length} de {promises?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Promessas</CardTitle>
          <CardDescription>
            Todas as promessas de pagamento registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Método de Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promises && promises.length > 0 ? (
                  promises.map((promise) => {
                    const isOverdue =
                      promise.status === 'pending' &&
                      promise.dueDate &&
                      isPast(new Date(promise.dueDate));

                    return (
                      <TableRow
                        key={promise.id}
                        data-testid={`row-promise-${promise.id}`}
                        className={isOverdue ? 'bg-destructive/5' : ''}
                      >
                        <TableCell className="font-medium" data-testid={`cell-name-${promise.id}`}>
                          {promise.debtorName || '-'}
                        </TableCell>
                        <TableCell data-testid={`cell-amount-${promise.id}`}>
                          {promise.amount
                            ? `R$ ${(promise.amount / 100).toFixed(2)}`
                            : '-'}
                        </TableCell>
                        <TableCell data-testid={`cell-due-date-${promise.id}`}>
                          {promise.dueDate ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(promise.dueDate), 'dd/MM/yyyy')}
                              {isOverdue && (
                                <Badge variant="destructive" className="ml-2">
                                  Vencida
                                </Badge>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell data-testid={`cell-payment-method-${promise.id}`}>
                          {promise.paymentMethod || '-'}
                        </TableCell>
                        <TableCell data-testid={`cell-status-${promise.id}`}>
                          {getStatusBadge(promise.status)}
                        </TableCell>
                        <TableCell data-testid={`cell-created-${promise.id}`}>
                          {promise.createdAt
                            ? formatDistanceToNow(new Date(promise.createdAt), {
                                addSuffix: true,
                                locale: ptBR,
                              })
                            : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma promessa registrada
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
