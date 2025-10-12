import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, Phone, User, FileText, AlertCircle, MessageSquare, Clock } from "lucide-react";
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

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedContact, setSelectedContact] = useState<ContactWithHistory | null>(null);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [reopenMessage, setReopenMessage] = useState("");
  const { toast } = useToast();

  // Query all contacts
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts", { search, status: statusFilter === "all" ? undefined : statusFilter }],
    refetchInterval: 10000,
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

  // Mutation to reopen conversation
  const reopenMutation = useMutation({
    mutationFn: async (data: { contactId: string; message?: string }) => {
      return await apiRequest(`/api/contacts/reopen`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Conversa reaberta",
        description: "A conversa foi reaberta com sucesso via WhatsApp",
      });
      setIsReopenDialogOpen(false);
      setReopenMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reabrir conversa",
        description: error.message || "Ocorreu um erro ao reabrir a conversa",
        variant: "destructive",
      });
    },
  });

  const handleReopenConversation = () => {
    if (!selectedContact) return;

    reopenMutation.mutate({
      contactId: selectedContact.id,
      message: reopenMessage || undefined,
    });
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
          <CardTitle>Contatos</CardTitle>
          <CardDescription>Todos os clientes que já interagiram</CardDescription>
          
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
                  onClick={() => setSelectedContact(contact)}
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
              <Button
                onClick={() => setIsReopenDialogOpen(true)}
                size="sm"
                data-testid="button-reopen-conversation"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Reabrir Conversa
              </Button>
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

      {/* Dialog de Reabertura */}
      <Dialog open={isReopenDialogOpen} onOpenChange={setIsReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir Conversa</DialogTitle>
            <DialogDescription>
              Enviar mensagem via WhatsApp para {selectedContact?.name || selectedContact?.phoneNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="message">Mensagem (opcional)</Label>
              <Textarea
                id="message"
                value={reopenMessage}
                onChange={(e) => setReopenMessage(e.target.value)}
                placeholder="Olá! Estamos entrando em contato para dar continuidade ao seu atendimento."
                rows={4}
                data-testid="input-reopen-message"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se deixar em branco, será enviada uma mensagem padrão
              </p>
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
              {reopenMutation.isPending ? "Enviando..." : "Enviar e Reabrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
