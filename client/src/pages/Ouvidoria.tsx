import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, CheckCircle, XCircle, Filter, User } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import type { Complaint } from "@shared/schema";

type ComplaintStatus = "novo" | "em_investigacao" | "resolvido" | "fechado";
type ComplaintSeverity = "baixa" | "media" | "alta" | "critica";

export default function Ouvidoria() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Defense in depth: verify user role
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPERVISOR")) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="access-denied-ouvidoria">
        <div className="text-center">
          <p className="text-destructive mb-4">Acesso Negado</p>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar a Ouvidoria.
          </p>
        </div>
      </div>
    );
  }

  const { data: complaints, isLoading, error } = useQuery<Complaint[]>({
    queryKey: ["/api/complaints"],
    refetchInterval: 15000,
  });

  const updateComplaintMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Complaint> }) => {
      return await apiRequest(`/api/complaints/${id}`, "PATCH", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
      toast({
        title: "Reclamação atualizada",
        description: "A reclamação foi atualizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Erro ao atualizar reclamação: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-ouvidoria">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando reclamações...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="error-ouvidoria">
        <div className="text-center">
          <p className="text-destructive mb-4">Erro ao carregar reclamações</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const filteredComplaints = complaints?.filter(complaint => {
    const statusMatch = filterStatus === "all" || complaint.status === filterStatus;
    const severityMatch = filterSeverity === "all" || complaint.severity === filterSeverity;
    const typeMatch = filterType === "all" || complaint.complaintType === filterType;
    return statusMatch && severityMatch && typeMatch;
  });

  const novasCount = complaints?.filter(c => c.status === "novo").length || 0;
  const investigacaoCount = complaints?.filter(c => c.status === "em_investigacao").length || 0;
  const resolvidasCount = complaints?.filter(c => c.status === "resolvido").length || 0;

  const getStatusBadge = (status: ComplaintStatus) => {
    const variants: Record<ComplaintStatus, { variant: "default" | "secondary" | "outline" | "destructive", icon: React.ReactNode, label: string }> = {
      novo: { variant: "destructive", icon: <AlertTriangle className="h-3 w-3" />, label: "Novo" },
      em_investigacao: { variant: "secondary", icon: <Clock className="h-3 w-3" />, label: "Em Investigação" },
      resolvido: { variant: "default", icon: <CheckCircle className="h-3 w-3" />, label: "Resolvido" },
      fechado: { variant: "outline", icon: <XCircle className="h-3 w-3" />, label: "Fechado" },
    };
    const config = variants[status];
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: ComplaintSeverity) => {
    const variants: Record<ComplaintSeverity, { variant: "default" | "secondary" | "outline" | "destructive", label: string }> = {
      baixa: { variant: "secondary", label: "Baixa" },
      media: { variant: "outline", label: "Média" },
      alta: { variant: "default", label: "Alta" },
      critica: { variant: "destructive", label: "Crítica" },
    };
    const config = variants[severity];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      atendimento: "Atendimento",
      produto: "Produto",
      tecnico: "Técnico",
      comercial: "Comercial",
      financeiro: "Financeiro",
      outro: "Outro",
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  const handleStatusChange = (complaintId: string, newStatus: ComplaintStatus) => {
    updateComplaintMutation.mutate({
      id: complaintId,
      updates: { status: newStatus },
    });
  };

  const handleTypeChange = (complaintId: string, newType: string) => {
    updateComplaintMutation.mutate({
      id: complaintId,
      updates: { complaintType: newType },
    });
  };

  const handleSeverityChange = (complaintId: string, newSeverity: ComplaintSeverity) => {
    updateComplaintMutation.mutate({
      id: complaintId,
      updates: { severity: newSeverity },
    });
  };

  return (
    <div className="h-full overflow-auto space-y-6" data-testid="page-ouvidoria">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-ouvidoria">Ouvidoria</h1>
        <p className="text-muted-foreground">Gerenciamento de reclamações e solicitações da Ouvidoria</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-novas">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive" data-testid="text-novas">
              {novasCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Reclamações aguardando análise</p>
          </CardContent>
        </Card>

        <Card data-testid="card-investigacao">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Investigação</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600" data-testid="text-investigacao">
              {investigacaoCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Reclamações sendo analisadas</p>
          </CardContent>
        </Card>

        <Card data-testid="card-resolvidas">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolvidas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="text-resolvidas">
              {resolvidasCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Reclamações resolvidas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Reclamações</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="em_investigacao">Em Investigação</SelectItem>
                  <SelectItem value="resolvido">Resolvido</SelectItem>
                  <SelectItem value="fechado">Fechado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-[180px]" data-testid="select-severity-filter">
                  <SelectValue placeholder="Filtrar por gravidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas gravidades</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="atendimento">Atendimento</SelectItem>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Gravidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComplaints?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma reclamação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredComplaints?.map((complaint) => (
                  <TableRow key={complaint.id} data-testid={`row-complaint-${complaint.id}`}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(complaint.createdAt!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={complaint.complaintType}
                        onValueChange={(value) => handleTypeChange(complaint.id, value)}
                        disabled={updateComplaintMutation.isPending}
                      >
                        <SelectTrigger className="w-[140px]" data-testid={`select-type-${complaint.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="atendimento">Atendimento</SelectItem>
                          <SelectItem value="produto">Produto</SelectItem>
                          <SelectItem value="tecnico">Técnico</SelectItem>
                          <SelectItem value="comercial">Comercial</SelectItem>
                          <SelectItem value="financeiro">Financeiro</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={complaint.severity}
                        onValueChange={(value) => handleSeverityChange(complaint.id, value as ComplaintSeverity)}
                        disabled={updateComplaintMutation.isPending}
                      >
                        <SelectTrigger className="w-[120px]" data-testid={`select-severity-${complaint.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="critica">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{getStatusBadge(complaint.status as ComplaintStatus)}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate" title={complaint.description}>
                        {complaint.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={complaint.status}
                        onValueChange={(value) => handleStatusChange(complaint.id, value as ComplaintStatus)}
                        disabled={updateComplaintMutation.isPending}
                      >
                        <SelectTrigger className="w-[160px]" data-testid={`select-status-${complaint.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="em_investigacao">Em Investigação</SelectItem>
                          <SelectItem value="resolvido">Resolvido</SelectItem>
                          <SelectItem value="fechado">Fechado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
