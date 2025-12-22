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
  DollarSign, 
  ShoppingCart, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Phone,
  Mail,
  MapPin,
  User,
  FileText,
  Filter,
  Eye,
  StickyNote,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Sale = {
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
  notes: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTIONS = [
  "Aguardando Análise",
  "Em Negociação",
  "Aprovado",
  "Agendado para Instalação",
  "Instalado",
  "Cancelado",
  "Inadimplente",
  "Sem Contato"
];

const STATUS_COLORS: Record<string, string> = {
  "Aguardando Análise": "bg-yellow-500",
  "Em Negociação": "bg-purple-500",
  "Aprovado": "bg-green-500",
  "Agendado para Instalação": "bg-blue-500",
  "Instalado": "bg-emerald-600",
  "Cancelado": "bg-red-500",
  "Inadimplente": "bg-orange-500",
  "Sem Contato": "bg-gray-500",
};

type SalesTabProps = {
  startDate?: string;
  endDate?: string;
};

export default function SalesTab({ startDate, endDate }: SalesTabProps) {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusObservations, setStatusObservations] = useState("");
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [newPlanId, setNewPlanId] = useState("");

  // Buscar planos disponíveis
  type PlanResponse = { plans: Array<{ id: string; name: string; type: string; price: number }> };
  const { data: plansResponse } = useQuery<PlanResponse>({
    queryKey: ["/api/plans"],
  });
  const plans = plansResponse?.plans || [];

  // Buscar vendas
  const { data: allSales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  // Filtrar por data
  const sales = allSales.filter((sale) => {
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

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, observations }: { id: string; status: string; observations?: string }) => {
      return await apiRequest(`/api/sales/${id}/status`, "PATCH", { status, observations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      setStatusDialogOpen(false);
      setSelectedSale(null);
      setNewStatus("");
      setStatusObservations("");
      toast({
        title: "Status atualizado",
        description: "O status da venda foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da venda.",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar notas
  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return await apiRequest(`/api/sales/${id}/notes`, "PATCH", { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      setNotesDialogOpen(false);
      setSelectedSale(null);
      setNotes("");
      toast({
        title: "Notas atualizadas",
        description: "As notas foram salvas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as notas.",
        variant: "destructive",
      });
    },
  });

  // Filtrar vendas
  const filteredSales = sales.filter((sale) => {
    if (filterStatus === "todos") return true;
    return sale.status === filterStatus;
  });

  // Estatísticas
  const stats = {
    total: sales.length,
    aguardando: sales.filter((s) => s.status === "Aguardando Análise").length,
    aprovado: sales.filter((s) => s.status === "Aprovado").length,
    instalado: sales.filter((s) => s.status === "Instalado").length,
  };

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setDetailsOpen(true);
  };

  const handleChangeStatus = (sale: Sale) => {
    setSelectedSale(sale);
    setNewStatus(sale.status);
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = () => {
    if (!selectedSale || !newStatus) return;
    updateStatusMutation.mutate({
      id: selectedSale.id,
      status: newStatus,
      observations: statusObservations || undefined,
    });
  };

  const handleEditNotes = (sale: Sale) => {
    setSelectedSale(sale);
    setNotes(sale.notes || "");
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = () => {
    if (!selectedSale) return;
    updateNotesMutation.mutate({
      id: selectedSale.id,
      notes: notes,
    });
  };

  // Mutation para atualizar plano
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, planId }: { id: string; planId: string }) => {
      return await apiRequest(`/api/sales/${id}/plan`, "PATCH", { planId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      setPlanDialogOpen(false);
      setSelectedSale(null);
      setNewPlanId("");
      toast({
        title: "Plano atualizado",
        description: "O plano foi alterado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o plano.",
        variant: "destructive",
      });
    },
  });

  const handleChangePlan = (sale: Sale) => {
    setSelectedSale(sale);
    setNewPlanId(sale.plan?.id || "");
    setPlanDialogOpen(true);
  };

  const handleUpdatePlan = () => {
    if (!selectedSale || !newPlanId) return;
    updatePlanMutation.mutate({
      id: selectedSale.id,
      planId: newPlanId,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando vendas...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-vendas">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Análise</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-aguardando">{stats.aguardando}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-aprovados">{stats.aprovado}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instalados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-instalados">{stats.instalado}</div>
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
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filterStatus === "todos" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("todos")}
              data-testid="button-filter-todos"
            >
              Todos ({sales.length})
            </Button>
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(status)}
                data-testid={`button-filter-${status.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {status} ({sales.filter((s) => s.status === status).length})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de vendas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Vendas ({filteredSales.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <p className="text-muted-foreground">Nenhuma venda encontrada</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                      <TableCell className="font-medium">
                        <div>
                          <p data-testid={`text-customer-name-${sale.id}`}>{sale.customerName}</p>
                          {sale.email && (
                            <p className="text-xs text-muted-foreground">{sale.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-phone-${sale.id}`}>{sale.phone}</TableCell>
                      <TableCell>
                        {sale.plan ? (
                          <div>
                            <p className="font-medium" data-testid={`text-plan-name-${sale.id}`}>{sale.plan.name}</p>
                            <p className="text-xs text-muted-foreground">
                              R$ {sale.plan.price.toFixed(2)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-type-${sale.id}`}>
                          {sale.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={STATUS_COLORS[sale.status] || "bg-gray-500"}
                          data-testid={`badge-status-${sale.id}`}
                        >
                          {sale.status}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-source-${sale.id}`}>{sale.source}</TableCell>
                      <TableCell data-testid={`text-date-${sale.id}`}>
                        {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditNotes(sale)}
                          data-testid={`button-notes-${sale.id}`}
                          className="relative"
                        >
                          <StickyNote className={`h-4 w-4 ${sale.notes ? "text-yellow-500" : "text-muted-foreground"}`} />
                          {sale.notes && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 bg-yellow-500 rounded-full"></span>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(sale)}
                            data-testid={`button-view-details-${sale.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleChangePlan(sale)}
                            data-testid={`button-change-plan-${sale.id}`}
                            title="Trocar Plano"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleChangeStatus(sale)}
                            data-testid={`button-change-status-${sale.id}`}
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
            <DialogTitle>Detalhes da Venda</DialogTitle>
            <DialogDescription>
              Informações completas do cadastro #{selectedSale?.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
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
                    <p className="font-medium">{selectedSale.customerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CPF/CNPJ:</p>
                    <p className="font-medium">{selectedSale.cpfCnpj || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tipo:</p>
                    <p className="font-medium">{selectedSale.type}</p>
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
                    <p className="font-medium">{selectedSale.phone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email:</p>
                    <p className="font-medium">{selectedSale.email || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Localização */}
              {(selectedSale.city || selectedSale.state) && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4" />
                    Localização
                  </h3>
                  <div className="text-sm">
                    <p className="font-medium">
                      {selectedSale.city && selectedSale.state
                        ? `${selectedSale.city} - ${selectedSale.state}`
                        : selectedSale.city || selectedSale.state || "-"}
                    </p>
                  </div>
                </div>
              )}

              {/* Plano */}
              {selectedSale.plan && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4" />
                    Plano Contratado
                  </h3>
                  <div className="text-sm">
                    <p className="font-medium">{selectedSale.plan.name}</p>
                    <p className="text-muted-foreground">
                      Tipo: {selectedSale.plan.type} | R$ {selectedSale.plan.price.toFixed(2)}/mês
                    </p>
                  </div>
                </div>
              )}

              {/* Observações */}
              {selectedSale.observations && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    Observações
                  </h3>
                  <p className="text-sm">{selectedSale.observations}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p>Origem: {selectedSale.source}</p>
                    <p>Criado em: {format(new Date(selectedSale.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p>Status: {selectedSale.status}</p>
                    <p>Atualizado: {format(new Date(selectedSale.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Alterar Status */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Status da Venda</DialogTitle>
            <DialogDescription>
              Cliente: {selectedSale?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Novo Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-new-status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
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
                data-testid="textarea-status-observations"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
              data-testid="button-cancel-status"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateStatus}
              disabled={updateStatusMutation.isPending || !newStatus}
              data-testid="button-confirm-status"
            >
              {updateStatusMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Notas */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas Internas</DialogTitle>
            <DialogDescription>
              Cliente: {selectedSale?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Notas do comercial</label>
              <Textarea
                placeholder="Digite aqui as informações importantes sobre este lead/oportunidade..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                data-testid="textarea-notes"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Utilize este espaço para registrar informações importantes sobre negociações, preferências do cliente, observações técnicas, etc.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNotesDialogOpen(false)}
              data-testid="button-cancel-notes"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={updateNotesMutation.isPending}
              data-testid="button-save-notes"
            >
              {updateNotesMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Trocar Plano */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar Plano</DialogTitle>
            <DialogDescription>
              Cliente: {selectedSale?.customerName}
              {selectedSale?.plan && (
                <span className="block text-xs mt-1">
                  Plano atual: {selectedSale.plan.name} - R$ {selectedSale.plan.price.toFixed(2)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Novo Plano</label>
              <Select value={newPlanId} onValueChange={setNewPlanId}>
                <SelectTrigger data-testid="select-new-plan">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {plan.type} - R$ {(plan.price / 100).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPlanDialogOpen(false)}
              data-testid="button-cancel-plan"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdatePlan}
              disabled={updatePlanMutation.isPending || !newPlanId}
              data-testid="button-confirm-plan"
            >
              {updatePlanMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
