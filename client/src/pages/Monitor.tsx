import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConversationCard } from "@/components/ConversationCard";
import { ConversationDetails } from "@/components/ConversationDetails";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { monitorAPI } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export default function Monitor() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeDepartment, setActiveDepartment] = useState("all");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const { toast } = useToast();

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ["/api/monitor/conversations"],
    queryFn: monitorAPI.getConversations,
    refetchInterval: 5000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["/api/monitor/alerts"],
    queryFn: monitorAPI.getAlerts,
    refetchInterval: 3000,
  });

  const { data: conversationDetails } = useQuery({
    queryKey: ["/api/monitor/conversations", activeConvId],
    queryFn: () => monitorAPI.getConversationDetails(activeConvId!),
    enabled: !!activeConvId,
    refetchInterval: 3000, // Atualiza detalhes a cada 3 segundos
  });

  const transferMutation = useMutation({
    mutationFn: ({ conversationId, dept, notes }: { conversationId: string; dept: string; notes: string }) =>
      monitorAPI.transferToHuman(conversationId, dept, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations"] });
      toast({ title: "Transferência Iniciada", description: "Chat transferido com sucesso" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: monitorAPI.pauseAI,
    onSuccess: () => {
      setIsPaused(!isPaused);
      toast({ title: isPaused ? "IA Reativada" : "IA Pausada" });
    },
  });

  const noteMutation = useMutation({
    mutationFn: ({ conversationId, note }: { conversationId: string; note: string }) =>
      monitorAPI.addNote(conversationId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations", activeConvId] });
      toast({ title: "Nota Adicionada", description: "Nota interna registrada com sucesso" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: monitorAPI.markResolved,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations"] });
      setActiveConvId(null);
      toast({ title: "Chat Resolvido", description: "Conversa finalizada. Pesquisa NPS enviada ao cliente via WhatsApp." });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao deletar mensagem');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations", activeConvId] });
      toast({ 
        title: "Mensagem Deletada", 
        description: data.message || "Mensagem removida com sucesso"
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao Deletar", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const departments = [
    { id: "all", label: "Todos", value: "all" },
    { id: "apresentacao", label: "Apresentação", value: "apresentacao" },
    { id: "financeiro", label: "Financeiro", value: "financeiro" },
    { id: "suporte", label: "Suporte Técnico", value: "suporte" },
    { id: "comercial", label: "Comercial", value: "comercial" },
    { id: "ouvidoria", label: "Ouvidoria", value: "ouvidoria" },
    { id: "cancelamento", label: "Cancelamento", value: "cancelamento" },
  ];

  const filters = [
    { id: "all", label: "Todas" },
    { id: "transfer", label: "Transferidas" },
    { id: "ouvidoria", label: "Ouvidoria" },
    { id: "alerts", label: "Com Alertas" },
    { id: "resolved", label: "Finalizadas" },
  ];

  const filteredConversations = conversations.filter(conv => {
    let passesStatusFilter = true;
    let passesDepartmentFilter = true;
    let passesSearchFilter = true;

    if (activeFilter === "alerts") {
      passesStatusFilter = alerts.some(alert => alert.conversationId === conv.id);
    } else if (activeFilter === "all") {
      passesStatusFilter = conv.status === "active" && !conv.transferredToHuman;
    } else if (activeFilter === "transfer") {
      passesStatusFilter = conv.status === "active" && conv.transferredToHuman === true && conv.assignedTo === null;
    } else if (activeFilter === "ouvidoria") {
      passesStatusFilter = conv.assistantType === "ouvidoria";
    } else if (activeFilter === "resolved") {
      passesStatusFilter = conv.status === "resolved";
    }

    if (activeDepartment !== "all") {
      passesDepartmentFilter = conv.assistantType === activeDepartment;
    }

    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      passesSearchFilter = 
        conv.chatId.toLowerCase().includes(searchLower) ||
        conv.clientName.toLowerCase().includes(searchLower);
    }

    return passesStatusFilter && passesDepartmentFilter && passesSearchFilter;
  });

  const getConversationCountByDepartment = (deptValue: string) => {
    return conversations.filter(c => {
      let passesDepartmentFilter = true;
      let passesStatusFilter = true;

      // Department filter
      if (deptValue !== "all") {
        passesDepartmentFilter = c.assistantType === deptValue;
      }

      // Status filter (same logic as main filter)
      if (activeFilter === "alerts") {
        passesStatusFilter = alerts.some(alert => alert.conversationId === c.id);
      } else if (activeFilter === "all") {
        passesStatusFilter = c.status === "active" && !c.transferredToHuman;
      } else if (activeFilter === "transfer") {
        passesStatusFilter = c.status === "active" && c.transferredToHuman === true && c.assignedTo === null;
      } else if (activeFilter === "ouvidoria") {
        passesStatusFilter = c.assistantType === "ouvidoria";
      } else if (activeFilter === "resolved") {
        passesStatusFilter = c.status === "resolved";
      }

      return passesDepartmentFilter && passesStatusFilter;
    }).length;
  };

  const getConversationCountByFilter = (filterId: string) => {
    if (filterId === "all") {
      return conversations.filter(c => c.status === "active" && !c.transferredToHuman).length;
    } else if (filterId === "transfer") {
      return conversations.filter(c => c.status === "active" && c.transferredToHuman === true && c.assignedTo === null).length;
    } else if (filterId === "ouvidoria") {
      return conversations.filter(c => c.assistantType === "ouvidoria").length;
    } else if (filterId === "alerts") {
      return alerts.length;
    } else if (filterId === "resolved") {
      return conversations.filter(c => c.status === "resolved").length;
    }
    return 0;
  };

  const conversationCards = filteredConversations.map(conv => ({
    id: conv.id,
    chatId: conv.chatId,
    clientName: conv.clientName,
    assistant: `LIA ${conv.assistantType.charAt(0).toUpperCase() + conv.assistantType.slice(1)}`,
    duration: conv.duration,
    lastMessage: conv.lastMessage || "",
    lastClientMessage: (conv as any).lastClientMessage || "",
    lastAIMessage: (conv as any).lastAIMessage || "",
    sentiment: (conv.sentiment || "neutral") as "positive" | "neutral" | "negative",
    urgency: (conv.urgency || "normal") as "normal" | "high" | "critical",
    hasAlert: alerts.some(a => a.conversationId === conv.id),
    transferSuggested: false,
    lastMessageTime: new Date(conv.lastMessageTime),
  }));

  const activeConversation = conversations.find(c => c.id === activeConvId);
  const activeMessages = conversationDetails?.messages.map(msg => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    timestamp: new Date(msg.timestamp),
    functionCall: msg.functionCall,
  })) || [];

  const mockAnalysis = {
    summary: conversationDetails?.messages.slice(0, 3).map(m => m.content).join(" ") || "Aguardando análise...",
    intent: "Resolução de problema técnico",
    entities: {
      Plano: "N/A",
      Protocolo: activeConversation?.chatId || "N/A",
    },
    actions: conversationDetails?.messages
      .filter(m => m.functionCall)
      .map((m, idx) => ({
        time: new Date(m.timestamp).toLocaleTimeString(),
        description: `Chamou Function: ${m.functionCall?.name || 'unknown'}()`,
      })) || [],
    sentimentHistory: [
      { time: "14:30", score: 50 },
      { time: "14:31", score: 40 },
      { time: "14:32", score: 30 },
    ],
  };

  const handleTransfer = (dept: string, notes: string) => {
    if (activeConvId) {
      transferMutation.mutate({ conversationId: activeConvId, dept, notes });
    }
  };

  const handlePauseToggle = () => {
    if (activeConvId) {
      pauseMutation.mutate(activeConvId);
    }
  };

  const handleAddNote = (note: string) => {
    if (activeConvId) {
      noteMutation.mutate({ conversationId: activeConvId, note });
    }
  };

  const handleMarkResolved = () => {
    if (activeConvId) {
      resolveMutation.mutate(activeConvId);
    }
  };

  if (conversationsLoading) {
    return <div className="flex items-center justify-center h-full">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Monitor de Atendimento</h1>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-chart-2" />
            <span className="text-sm text-muted-foreground">Sistema Online</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por Chat ID, cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-80"
            data-testid="input-monitor-search"
          />
          <Button size="icon" data-testid="button-search">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(filter.id)}
            data-testid={`filter-${filter.id}`}
            className="gap-2"
          >
            {filter.label}
            <Badge variant={activeFilter === filter.id ? "secondary" : "outline"} className="ml-1">
              {getConversationCountByFilter(filter.id)}
            </Badge>
          </Button>
        ))}
      </div>

      <Tabs value={activeDepartment} onValueChange={setActiveDepartment} className="w-full">
        <TabsList className="w-full justify-start">
          {departments.map((dept) => (
            <TabsTrigger 
              key={dept.id} 
              value={dept.value}
              data-testid={`tab-${dept.id}`}
            >
              {dept.label}
              <Badge variant="secondary" className="ml-2">
                {getConversationCountByDepartment(dept.value)}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {departments.map((dept) => (
          <TabsContent key={dept.id} value={dept.value} className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{dept.label}</h2>
              <Badge variant="outline">
                {conversationCards.length} conversas
              </Badge>
            </div>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-4">
                {conversationCards.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    isActive={activeConvId === conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!activeConvId} onOpenChange={(open) => !open && setActiveConvId(null)}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {activeConversation && `Chat ${activeConversation.chatId} - ${activeConversation.clientName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {activeConversation && (
              <ConversationDetails
                chatId={activeConversation.chatId}
                clientName={activeConversation.clientName}
                messages={activeMessages}
                analysis={mockAnalysis}
                isPaused={isPaused}
                onPauseToggle={handlePauseToggle}
                onTransfer={handleTransfer}
                onAddNote={handleAddNote}
                onMarkResolved={handleMarkResolved}
                onDeleteMessage={(messageId) => deleteMessageMutation.mutate(messageId)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
