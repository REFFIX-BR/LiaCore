import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface FailedTarget {
  id: string;
  campaignId: string;
  clientName: string;
  phoneNumber: string;
  clientDocument?: string;
  debtAmount?: number;
  attemptCount?: number;
  outcome?: string;
  outcomeDetails?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CobrancaErrors() {
  const { toast } = useToast();
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const { data, isLoading, refetch } = useQuery<{ success: boolean; total: number; targets: FailedTarget[] }>({
    queryKey: ['/api/admin/cobranca/failed-targets'],
  });

  const retryMutation = useMutation({
    mutationFn: async (params: { targetIds?: string[]; retryAll?: boolean }) => {
      return await apiRequest('/api/admin/cobranca/retry-failed', 'POST', params);
    },
    onSuccess: (result: any) => {
      toast({
        title: "✅ Mensagens reenviadas",
        description: `${result.requeued} target(s) reenviado(s) com sucesso`,
      });
      setSelectedTargets([]);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cobranca/failed-targets'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "❌ Erro ao reenviar",
        description: error.message || "Erro ao reenviar mensagens",
      });
    },
  });

  const handleToggleTarget = (targetId: string) => {
    setSelectedTargets(prev => 
      prev.includes(targetId) 
        ? prev.filter(id => id !== targetId)
        : [...prev, targetId]
    );
  };

  const handleRetrySelected = () => {
    if (selectedTargets.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum target selecionado",
        description: "Selecione pelo menos um target para reenviar",
      });
      return;
    }
    retryMutation.mutate({ targetIds: selectedTargets });
  };

  const handleRetryAll = () => {
    retryMutation.mutate({ retryAll: true });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mensagens de Cobrança com Erro</h1>
          <p className="text-muted-foreground">
            Gerencie mensagens que falharam e reenvie para processamento
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          variant="outline" 
          size="sm"
          data-testid="button-refresh"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Targets Falhados</CardTitle>
          <CardDescription>
            {isLoading ? (
              "Carregando..."
            ) : (
              `${data?.total || 0} target(s) com erro encontrado(s)`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              onClick={handleRetrySelected}
              disabled={selectedTargets.length === 0 || retryMutation.isPending}
              size="sm"
              data-testid="button-retry-selected"
            >
              <Send className="mr-2 h-4 w-4" />
              Reenviar Selecionados ({selectedTargets.length})
            </Button>
            <Button
              onClick={handleRetryAll}
              disabled={!data?.total || retryMutation.isPending}
              variant="secondary"
              size="sm"
              data-testid="button-retry-all"
            >
              <Send className="mr-2 h-4 w-4" />
              Reenviar Todos
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !data?.total ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">Nenhum erro encontrado!</h3>
              <p className="text-muted-foreground">
                Todas as mensagens de cobrança foram enviadas com sucesso.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedTargets.length === data.targets.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTargets(data.targets.map(t => t.id));
                        } else {
                          setSelectedTargets([]);
                        }
                      }}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.targets.map((target) => (
                  <TableRow key={target.id} data-testid={`row-target-${target.id}`}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedTargets.includes(target.id)}
                        onChange={() => handleToggleTarget(target.id)}
                        data-testid={`checkbox-target-${target.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{target.clientName}</TableCell>
                    <TableCell>{target.phoneNumber}</TableCell>
                    <TableCell>{target.clientDocument || '-'}</TableCell>
                    <TableCell>
                      R$ {target.debtAmount?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{target.attemptCount || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {target.outcome || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={target.outcomeDetails}>
                      {target.outcomeDetails || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {retryMutation.isPending && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Reenviando mensagens...</span>
          </div>
        </div>
      )}
    </div>
  );
}
