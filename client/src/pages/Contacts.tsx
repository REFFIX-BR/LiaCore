import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Phone, User, FileText, AlertCircle, MessageSquare, Clock, UserPlus, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface Contact {
  id: string;
  phoneNumber: string;
  name: string | null;
  document: string | null;
  lastConversationId: string | null;
  lastConversationDate: Date | null;
  totalConversations: number;
  hasRecurringIssues: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Conversation {
  id: string;
  chatId: string;
  clientName: string;
  assistantType: string;
  status: string;
  lastMessageTime: Date;
}

interface ContactWithHistory extends Contact {
  conversations: Conversation[];
}

interface User {
  id: string;
  fullName: string;
  role: string;
  status: string;
}

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedContact, setSelectedContact] = useState<ContactWithHistory | null>(null);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newContactData, setNewContactData] = useState({
    phoneNumber: "",
    name: "",
    document: "",
    assignedTo: "",
    department: "",
  });
  const [editContactData, setEditContactData] = useState({
    name: "",
    document: "",
  });
  const { toast } = useToast();

  // Query all contacts
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts", { search, status: statusFilter === "all" ? undefined : statusFilter }],
    refetchInterval: 10000,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      
      const url = `/api/contacts${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      
      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }
      return response.json();
    },
  });

  // Query selected contact details
  const { data: contactDetails, isLoading: detailsLoading } = useQuery<ContactWithHistory>({
    queryKey: ["/api/contacts", selectedContact?.id],
    enabled: !!selectedContact,
    queryFn: async () => {
      const response = await fetch(`/api/contacts/${selectedContact?.id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch contact details");
      }
      return response.json();
    },
  });

  // Query available agents for assignment
  const { data: availableAgents } = useQuery<{ users: User[] }>({
    queryKey: ["/api/users/available-agents"],
  });

  // Mutation to create new contact
  const createMutation = useMutation({
    mutationFn: async (data: typeof newContactData) => {
      return await apiRequest("/api/contacts/create", "POST", data);
    },
    onSuccess: (data: any) => {
      const isAssigned = newContactData.assignedTo && newContactData.assignedTo !== 'none';
      toast({
        title: "Contato criado",
        description: isAssigned 
          ? "Conversa criada e atribuída. Você pode enviar mensagens agora."
          : "Conversa movida para 'Transferidas'. Você pode enviar mensagens agora.",
      });
      setIsCreateDialogOpen(false);
      setNewContactData({
        phoneNumber: "",
        name: "",
        document: "",
        department: "",
        assignedTo: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/transferred"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/assigned"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar contato",
        description: error.message || "Ocorreu um erro ao criar o contato",
        variant: "destructive",
      });
    },
  });

  // Mutation to reopen conversation
  const reopenMutation = useMutation({
    mutationFn: async (data: { contactId: string; message?: string }) => {
      return await apiRequest("/api/contacts/reopen", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Conversa reaberta",
        description: "A conversa foi movida para 'Transferidas'. Você pode enviar mensagens agora.",
      });
      setIsReopenDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/transferred"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reabrir conversa",
        description: error.message || "Ocorreu um erro ao reabrir a conversa",
        variant: "destructive",
      });
    },
  });

  // Mutation to update contact
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: { name?: string; document?: string } }) => {
      return await apiRequest(`/api/contacts/${data.id}`, "PATCH", data.updates);
    },
    onSuccess: () => {
      toast({
        title: "Contato atualizado",
        description: "As informações do contato foram atualizadas com sucesso.",
      });
      setIsEditDialogOpen(false);
      // Invalidar tanto a lista quanto os detalhes do contato específico
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      if (selectedContact) {
        queryClient.invalidateQueries({ queryKey: ["/api/contacts", selectedContact.id] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar contato",
        description: error.message || "Ocorreu um erro ao atualizar o contato",
        variant: "destructive",
      });
    },
  });

  const handleCreateContact = () => {
    if (!newContactData.phoneNumber) {
      toast({
        title: "Telefone obrigatório",
        description: "Por favor, informe o número de telefone",
        variant: "destructive",
      });
      return;
    }

    if (!newContactData.department) {
      toast({
        title: "Departamento obrigatório",
        description: "Por favor, selecione um departamento",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(newContactData);
  };

  const handleReopenConversation = () => {
    if (!selectedContact) return;

    reopenMutation.mutate({
      contactId: selectedContact.id,
    });
  };

  const handleEditContact = () => {
    if (!selectedContact) return;

    updateMutation.mutate({
      id: selectedContact.id,
      updates: {
        name: editContactData.name || undefined,
        document: editContactData.document || undefined,
      },
    });
  };

  const openEditDialog = () => {
    if (!selectedContact) return;
    
    setEditContactData({
      name: selectedContact.name || "",
      document: selectedContact.document || "",
    });
    setIsEditDialogOpen(true);
  };

  const filteredContacts = contacts.filter(contact => {
    if (statusFilter !== "all" && contact.status !== statusFilter) return false;
    if (search && !contact.name?.toLowerCase().includes(search.toLowerCase()) && 
        !contact.phoneNumber.includes(search) && 
        !contact.document?.includes(search)) return false;
    return true;
  });

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 p-6">
      {/* Lista de Contatos */}
      <Card className="w-96 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <CardTitle>Contatos</CardTitle>
              <CardDescription>Todos os clientes que já interagiram</CardDescription>
            </div>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              size="sm"
              data-testid="button-new-contact"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Novo
            </Button>
          </div>
          
          {/* Busca */}
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-search-contacts"
            />
          </div>

          {/* Filtros */}
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" data-testid="filter-all">Todos</TabsTrigger>
              <TabsTrigger value="active" data-testid="filter-active">Ativos</TabsTrigger>
              <TabsTrigger value="inactive" data-testid="filter-inactive">Inativos</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <ScrollArea className="flex-1">
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-4">Carregando...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">Nenhum contato encontrado</div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact as ContactWithHistory)}
                  className={`w-full text-left p-3 rounded-md border transition-colors hover-elevate ${
                    selectedContact?.id === contact.id ? "bg-accent" : ""
                  }`}
                  data-testid={`contact-item-${contact.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium truncate">
                          {contact.name || contact.phoneNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="truncate">{contact.phoneNumber}</span>
                      </div>
                      {contact.document && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <span className="truncate">{contact.document}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {contact.totalConversations} conversas
                        </Badge>
                        {contact.hasRecurringIssues && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Recorrente
                          </Badge>
                        )}
                      </div>
                      {contact.lastConversationDate && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            Último contato: {format(new Date(contact.lastConversationDate), "dd/MM/yyyy HH:mm")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Detalhes do Contato */}
      {selectedContact ? (
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{(contactDetails || selectedContact).name || (contactDetails || selectedContact).phoneNumber}</CardTitle>
                <CardDescription>Histórico completo de atendimentos</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={openEditDialog}
                  size="sm"
                  variant="outline"
                  data-testid="button-edit-contact"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  onClick={() => setIsReopenDialogOpen(true)}
                  size="sm"
                  data-testid="button-reopen-conversation"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Reabrir Conversa
                </Button>
              </div>
            </div>

            {/* Informações do Contato */}
            <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-muted/50 rounded-md">
              <div>
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <p className="text-sm font-medium">{(contactDetails || selectedContact).phoneNumber}</p>
              </div>
              {(contactDetails || selectedContact).document && (
                <div>
                  <Label className="text-xs text-muted-foreground">CPF/CNPJ</Label>
                  <p className="text-sm font-medium">{(contactDetails || selectedContact).document}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Total de Conversas</Label>
                <p className="text-sm font-medium">{(contactDetails || selectedContact).totalConversations}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Badge variant={(contactDetails || selectedContact).status === "active" ? "default" : "secondary"}>
                  {(contactDetails || selectedContact).status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <ScrollArea className="flex-1">
            <CardContent>
              <h3 className="font-semibold mb-3">Histórico de Conversas</h3>
              
              {detailsLoading ? (
                <div className="text-center text-muted-foreground py-4">Carregando histórico...</div>
              ) : contactDetails?.conversations && contactDetails.conversations.length > 0 ? (
                <div className="space-y-2">
                  {contactDetails.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3 border rounded-md"
                      data-testid={`conversation-${conv.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{conv.assistantType}</Badge>
                          <Badge variant={conv.status === "active" ? "default" : "secondary"}>
                            {conv.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(conv.lastMessageTime), "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        ID: {conv.chatId}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  Nenhuma conversa encontrada
                </div>
              )}
            </CardContent>
          </ScrollArea>
        </Card>
      ) : (
        <Card className="flex-1 flex items-center justify-center">
          <CardContent className="text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Selecione um contato para ver os detalhes</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Criação de Contato */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Contato</DialogTitle>
            <DialogDescription>
              Criar um novo contato e iniciar uma conversa via WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="phoneNumber">Telefone (WhatsApp) *</Label>
              <Input
                id="phoneNumber"
                value={newContactData.phoneNumber}
                onChange={(e) => setNewContactData({ ...newContactData, phoneNumber: e.target.value })}
                placeholder="5511999999999"
                data-testid="input-phone-number"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Apenas números (com DDD)
              </p>
            </div>

            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={newContactData.name}
                onChange={(e) => setNewContactData({ ...newContactData, name: e.target.value })}
                placeholder="Nome do cliente"
                data-testid="input-contact-name"
              />
            </div>

            <div>
              <Label htmlFor="document">CPF/CNPJ</Label>
              <Input
                id="document"
                value={newContactData.document}
                onChange={(e) => setNewContactData({ ...newContactData, document: e.target.value })}
                placeholder="000.000.000-00"
                data-testid="input-document"
              />
            </div>

            <div>
              <Label htmlFor="assignedTo">Atribuir a Atendente (Opcional)</Label>
              <Select
                value={newContactData.assignedTo}
                onValueChange={(value) => setNewContactData({ ...newContactData, assignedTo: value })}
              >
                <SelectTrigger data-testid="select-assigned-agent">
                  <SelectValue placeholder="Não atribuir - vai para 'Transferidas'" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não atribuir - vai para "Transferidas"</SelectItem>
                  {availableAgents?.users?.map((agent: User) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.fullName} ({agent.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Se não atribuir, ficará disponível na aba "Transferidas" para qualquer atendente
              </p>
            </div>

            <div>
              <Label htmlFor="department">Departamento *</Label>
              <Select
                value={newContactData.department}
                onValueChange={(value) => setNewContactData({ ...newContactData, department: value })}
              >
                <SelectTrigger data-testid="select-department-create">
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commercial" data-testid="department-create-commercial">
                    🔵 Comercial
                  </SelectItem>
                  <SelectItem value="support" data-testid="department-create-support">
                    🟢 Suporte
                  </SelectItem>
                  <SelectItem value="financial" data-testid="department-create-financial">
                    🟠 Financeiro
                  </SelectItem>
                  <SelectItem value="cancellation" data-testid="department-create-cancellation">
                    🔴 Cancelamento
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione o departamento responsável por esta conversa
              </p>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Nenhuma mensagem será enviada automaticamente
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    A conversa será criada e você poderá escrever e enviar sua mensagem manualmente quando quiser.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              data-testid="button-cancel-create"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateContact}
              disabled={createMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? "Criando..." : "Criar Contato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Reabertura */}
      <Dialog open={isReopenDialogOpen} onOpenChange={setIsReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir Conversa</DialogTitle>
            <DialogDescription>
              A conversa com {selectedContact?.name || selectedContact?.phoneNumber} será movida para "Transferidas"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Nenhuma mensagem será enviada automaticamente
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    A conversa aparecerá na aba "Transferidas". Você poderá escrever e enviar sua mensagem quando quiser.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReopenDialogOpen(false)}
              data-testid="button-cancel-reopen"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReopenConversation}
              disabled={reopenMutation.isPending}
              data-testid="button-confirm-reopen"
            >
              {reopenMutation.isPending ? "Reabrindo..." : "Reabrir Conversa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Contato */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
            <DialogDescription>
              Atualizar informações de {selectedContact?.name || selectedContact?.phoneNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editContactData.name}
                onChange={(e) => setEditContactData({ ...editContactData, name: e.target.value })}
                placeholder="Nome do cliente"
                data-testid="input-edit-name"
              />
            </div>

            <div>
              <Label htmlFor="edit-document">CPF/CNPJ</Label>
              <Input
                id="edit-document"
                value={editContactData.document}
                onChange={(e) => setEditContactData({ ...editContactData, document: e.target.value })}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                data-testid="input-edit-document"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Apenas números, com ou sem formatação
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Telefone</Label>
              <p className="text-sm font-medium text-muted-foreground">
                {selectedContact?.phoneNumber} (não editável)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditContact}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
