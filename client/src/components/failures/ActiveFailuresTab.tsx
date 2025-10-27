import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Plus, CheckCircle, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import FailureDialog from "./FailureDialog";
import TimeCounter from "./TimeCounter";

type MassiveFailure = {
  id: string;
  name: string;
  description: string;
  status: string;
  affectedRegions: any;
  notificationMessage: string;
  resolutionMessage: string | null;
  startTime: string;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export default function ActiveFailuresTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFailure, setSelectedFailure] = useState<MassiveFailure | null>(null);

  const { data: failures = [], isLoading } = useQuery<MassiveFailure[]>({
    queryKey: ["/api/failures/active"],
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/failures/${id}/resolve`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/failures/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/failures"] });
      toast({
        title: "Falha resolvida",
        description: "A falha foi marcada como resolvida com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível resolver a falha.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/failures/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/failures/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/failures"] });
      toast({
        title: "Falha deletada",
        description: "A falha foi removida com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível deletar a falha.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    setSelectedFailure(null);
    setDialogOpen(true);
  };

  const handleEdit = (failure: MassiveFailure) => {
    setSelectedFailure(failure);
    setDialogOpen(true);
  };

  const handleResolve = (id: string) => {
    if (confirm("Tem certeza que deseja resolver esta falha? Os clientes não serão mais notificados.")) {
      resolveMutation.mutate(id);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja deletar esta falha?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-active-failures-title">Falhas Ativas</h2>
          <p className="text-muted-foreground">Falhas em andamento que estão notificando clientes automaticamente</p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-failure">
          <Plus className="h-4 w-4 mr-2" />
          Nova Falha
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {failures.length} Falhas Ativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {failures.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma falha ativa no momento</p>
          ) : (
<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Regiões</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failures.map((failure) => (
                  <TableRow key={failure.id} data-testid={`row-failure-${failure.id}`}>
                    <TableCell className="font-medium">{failure.name}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="space-y-1">
                        <p className="text-sm">{failure.description}</p>
                        {failure.notificationMessage && (
                          <p className="text-xs text-muted-foreground italic">
                            "{failure.notificationMessage}"
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {format(new Date(failure.startTime), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(failure.startTime), "HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <TimeCounter startTime={failure.startTime} />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        {(() => {
                          // Extrair nomes dos bairros
                          const neighborhoods: string[] = [];
                          (failure.affectedRegions?.custom || []).forEach((region: any) => {
                            if (Array.isArray(region.neighborhoods)) {
                              region.neighborhoods.forEach((n: string) => neighborhoods.push(n));
                            }
                          });
                          const text = neighborhoods.length > 0 ? neighborhoods.join(', ') : 'Sem bairros';
                          return (
                            <Badge variant="outline" className="text-xs whitespace-normal h-auto py-1">
                              {text}
                            </Badge>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">Ativa</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(failure)}
                          data-testid={`button-edit-${failure.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResolve(failure.id)}
                          data-testid={`button-resolve-${failure.id}`}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(failure.id)}
                          data-testid={`button-delete-${failure.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FailureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        failure={selectedFailure}
      />
    </div>
  );
}
