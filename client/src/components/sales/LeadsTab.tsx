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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  UserPlus, 
  Clock, 
  XCircle, 
  MapPin,
  Phone,
  Mail,
  User,
  FileText,
  Filter,
  Eye,
  MessageSquare,
  Wifi
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Lead = {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  cpfCnpj: string;
  type: string;
  status: string;
  source: string;
  plan: {
    id: string;
    name: string;
    type: string;
    price: number;
  } | null;
  city: string;
  state: string;
  observations: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
};

const LEAD_STATUS_OPTIONS = [
  "Prospecção",
  "Cliente",
  "Cancelado",
  "Lead Sem Cobertura"
];

const STATUS_COLORS: Record<string, string> = {
  "Prospecção": "bg-blue-500",
  "Cliente": "bg-green-500",
  "Aguardando Análise": "bg-yellow-500",
  "Aprovado": "bg-green-500",
  "Cancelado": "bg-red-500",
  "Lead Sem Cobertura": "bg-gray-500",
};

const SOURCE_LABELS: Record<string, string> = {
  "chat": "WhatsApp",
  "site": "Site",
  "manual": "Manual",
};

type LeadsTabProps = {
  startDate?: string;
  endDate?: string;
};

export default function LeadsTab({ startDate, endDate }: LeadsTabProps) {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterSource, setFilterSource] = useState<string>("todos");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusObservations, setStatusObservations] = useState("");

  // Buscar todas as vendas
  const { data: allSalesRaw = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/sales"],
  });

  // Filtrar por data primeiro
  const allSales = allSalesRaw.filter((sale) => {
    if (!startDate && !endDate) return true;
    const saleDate = new Date(sale.createdAt);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (saleDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (saleDate > end) return false;
    }
    return true;
  });

  // Leads = apenas clientes com interesse inicial que NÃO completaram a contratação
  // (Prospecção = dados incompletos, cliente não deu continuidade)
  // (Lead Sem Cobertura = cliente interessado mas região sem cobertura)
  const leads = allSales.filter((sale) => 
    sale.status === "Prospecção" || 
    sale.status === "Cancelado" ||
    sale.status === "Lead Sem Cobertura"
  );

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, observations }: { id: string; status: string; observations?: string }) => {
      return await apiRequest(`/api/sales/${id}/status`, "PATCH", { status, observations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      setStatusDialogOpen(false);
      setSelectedLead(null);
      setNewStatus("");
      setStatusObservations("");
      toast({
        title: "Status atualizado",
        description: "O status do lead foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do lead.",
        variant: "destructive",
      });
    },
  });

  // Filtrar leads
  const filteredLeads = leads.filter((lead) => {
    const matchStatus = filterStatus === "todos" || lead.status === filterStatus;
    const matchSource = filterSource === "todos" || lead.source === filterSource;
    return matchStatus && matchSource;
  });

  // Estatísticas de leads (apenas prospects não concluídos)
  const stats = {
    total: leads.length,
    prospeccao: leads.filter((l) => l.status === "Prospecção").length,
    cancelado: leads.filter((l) => l.status === "Cancelado").length,
    semCobertura: leads.filter((l) => l.status === "Lead Sem Cobertura").length,
    whatsapp: leads.filter((l) => l.source === "chat").length,
    site: leads.filter((l) => l.source === "site").length,
    manual: leads.filter((l) => l.source === "manual").length,
  };

  // Taxa de abandono (leads cancelados / total)
  const abandonRate = stats.total > 0 
    ? ((stats.cancelado / stats.total) * 100).toFixed(1) 
    : "0.0";

  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailsOpen(true);
  };

  const handleChangeStatus = (lead: Lead) => {
    setSelectedLead(lead);
    setNewStatus(lead.status);
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = () => {
    if (!selectedLead || !newStatus) return;
    updateStatusMutation.mutate({
      id: selectedLead.id,
      status: newStatus,
      observations: statusObservations || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando leads...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-leads">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pipeline completo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Prospecção</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-prospeccao-leads">{stats.prospeccao}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Interesse sem conclusão
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-cancelado-leads">{stats.cancelado}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Desistiram do processo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Cobertura</CardTitle>
            <MapPin className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-sem-cobertura-leads">{stats.semCobertura}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Região sem atendimento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle>Filtros</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtro por Status */}
          <div>
            <p className="text-sm font-medium mb-2">Status</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterStatus === "todos" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("todos")}
                data-testid="button-filter-status-todos"
              >
                Todos ({leads.length})
              </Button>
              {LEAD_STATUS_OPTIONS.map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                  data-testid={`button-filter-status-${status.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {status} ({leads.filter((l) => l.status === status).length})
                </Button>
              ))}
            </div>
          </div>

          {/* Filtro por Origem */}
          <div>
            <p className="text-sm font-medium mb-2">Origem</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterSource === "todos" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSource("todos")}
                data-testid="button-filter-source-todos"
              >
                Todas ({leads.length})
              </Button>
              <Button
                variant={filterSource === "chat" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSource("chat")}
                data-testid="button-filter-source-chat"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                WhatsApp ({stats.whatsapp})
              </Button>
              <Button
                variant={filterSource === "site" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSource("site")}
                data-testid="button-filter-source-site"
              >
                Site ({stats.site})
              </Button>
              <Button
                variant={filterSource === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSource("manual")}
                data-testid="button-filter-source-manual"
              >
                Manual ({stats.manual})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de leads */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Leads ({filteredLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Plano de Interesse</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-muted-foreground">Nenhum lead encontrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                      <TableCell className="font-medium">
                        <div>
                          <p data-testid={`text-customer-name-${lead.id}`}>{lead.customerName}</p>
                          {lead.email && (
                            <p className="text-xs text-muted-foreground">{lead.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-phone-${lead.id}`}>{lead.phone}</TableCell>
                      <TableCell>
                        {lead.plan ? (
                          <div>
                            <p className="font-medium" data-testid={`text-plan-name-${lead.id}`}>{lead.plan.name}</p>
                            <p className="text-xs text-muted-foreground">
                              R$ {lead.plan.price.toFixed(2)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.city && lead.state ? (
                          <div className="text-sm">
                            <p data-testid={`text-location-${lead.id}`}>{lead.city} - {lead.state}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={STATUS_COLORS[lead.status] || "bg-gray-500"}
                          data-testid={`badge-status-${lead.id}`}
                        >
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-source-${lead.id}`}>
                          {SOURCE_LABELS[lead.source] || lead.source}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-date-${lead.id}`}>
                        {format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(lead)}
                            data-testid={`button-view-details-${lead.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleChangeStatus(lead)}
                            data-testid={`button-change-status-${lead.id}`}
                          >
                            Alterar Status
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Lead</DialogTitle>
            <DialogDescription>
              Informações completas do cadastro #{selectedLead?.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              {/* Cliente */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <User className="h-4 w-4" />
                  Informações do Cliente
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nome:</p>
                    <p className="font-medium">{selectedLead.customerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CPF/CNPJ:</p>
                    <p className="font-medium">{selectedLead.cpfCnpj || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tipo:</p>
                    <p className="font-medium">{selectedLead.type}</p>
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4" />
                  Contato
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Telefone:</p>
                    <p className="font-medium">{selectedLead.phone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email:</p>
                    <p className="font-medium">{selectedLead.email || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Localização */}
              {(selectedLead.city || selectedLead.state) && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4" />
                    Localização
                  </h3>
                  <div className="text-sm">
                    <p className="font-medium">
                      {selectedLead.city && selectedLead.state
                        ? `${selectedLead.city} - ${selectedLead.state}`
                        : selectedLead.city || selectedLead.state || "-"}
                    </p>
                  </div>
                </div>
              )}

              {/* Plano */}
              {selectedLead.plan && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <Wifi className="h-4 w-4" />
                    Plano de Interesse
                  </h3>
                  <div className="text-sm">
                    <p className="font-medium">{selectedLead.plan.name}</p>
                    <p className="text-muted-foreground">
                      Tipo: {selectedLead.plan.type} | R$ {selectedLead.plan.price.toFixed(2)}/mês
                    </p>
                  </div>
                </div>
              )}

              {/* Observações */}
              {selectedLead.observations && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    Observações
                  </h3>
                  <p className="text-sm">{selectedLead.observations}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p>Origem: {SOURCE_LABELS[selectedLead.source] || selectedLead.source}</p>
                    <p>Criado em: {format(new Date(selectedLead.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p>Status: {selectedLead.status}</p>
                    <p>Atualizado: {format(new Date(selectedLead.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                </div>
              </div>

              {/* Link para conversa (se origem WhatsApp) */}
              {selectedLead.conversationId && selectedLead.source === "chat" && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    💬 Lead capturado via WhatsApp - ID da conversa: {selectedLead.conversationId.slice(0, 8)}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Alterar Status */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Status do Lead</DialogTitle>
            <DialogDescription>
              Cliente: {selectedLead?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Novo Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-new-status-lead">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Textarea
                placeholder="Adicione observações sobre a mudança de status..."
                value={statusObservations}
                onChange={(e) => setStatusObservations(e.target.value)}
                rows={3}
                data-testid="textarea-status-observations-lead"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
              data-testid="button-cancel-status-lead"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateStatus}
              disabled={updateStatusMutation.isPending || !newStatus}
              data-testid="button-confirm-status-lead"
            >
              {updateStatusMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
