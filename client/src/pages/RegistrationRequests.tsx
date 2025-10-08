import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Clock, Mail, User } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface RegistrationRequest {
  id: string;
  username: string;
  fullName: string;
  email: string;
  requestedRole: string;
  status: string;
  createdAt: Date;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
}

export default function RegistrationRequests() {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ requests: RegistrationRequest[] }>({
    queryKey: ["/api/registration-requests"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/registration-requests/${id}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registration-requests"] });
      toast({
        title: "Solicitação aprovada",
        description: "Usuário criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar",
        description: error?.message || "Erro ao aprovar solicitação",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", `/api/registration-requests/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registration-requests"] });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
      toast({
        title: "Solicitação rejeitada",
        description: "A solicitação foi rejeitada",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao rejeitar",
        description: error?.message || "Erro ao rejeitar solicitação",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (request: RegistrationRequest) => {
    if (confirm(`Aprovar solicitação de ${request.fullName}?`)) {
      approveMutation.mutate(request.id);
    }
  };

  const handleReject = (request: RegistrationRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (selectedRequest) {
      rejectMutation.mutate({
        id: selectedRequest.id,
        reason: rejectionReason || "Não especificado",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case "approved":
        return <Badge className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" /> Aprovado</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, string> = {
      ADMIN: "Administrador",
      SUPERVISOR: "Supervisor",
      AGENT: "Atendente",
    };
    return <Badge variant="secondary">{roleLabels[role] || role}</Badge>;
  };

  const pendingRequests = data?.requests?.filter(r => r.status === "pending") || [];
  const processedRequests = data?.requests?.filter(r => r.status !== "pending") || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Solicitações de Registro</h1>
        <p className="text-muted-foreground">
          Gerencie solicitações de novos usuários
        </p>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitações Pendentes</CardTitle>
          <CardDescription>
            {pendingRequests.length} solicitação(ões) aguardando aprovação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma solicitação pendente
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {request.fullName}
                      </div>
                    </TableCell>
                    <TableCell>{request.username}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {request.email}
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(request.requestedRole)}</TableCell>
                    <TableCell>{format(new Date(request.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApprove(request)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${request.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(request)}
                          disabled={rejectMutation.isPending}
                          data-testid={`button-reject-${request.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rejeitar
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

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>
              Solicitações já processadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Data Solicitação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.fullName}</TableCell>
                    <TableCell>{request.username}</TableCell>
                    <TableCell>{request.email}</TableCell>
                    <TableCell>{getRoleBadge(request.requestedRole)}</TableCell>
                    <TableCell>{format(new Date(request.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.status === "rejected" && request.rejectionReason 
                        ? request.rejectionReason 
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição da solicitação de {selectedRequest?.fullName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo da Rejeição</Label>
              <Textarea
                id="rejection-reason"
                data-testid="textarea-rejection-reason"
                placeholder="Digite o motivo da rejeição..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setSelectedRequest(null);
                setRejectionReason("");
              }}
              data-testid="button-cancel-reject"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejeitando..." : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
