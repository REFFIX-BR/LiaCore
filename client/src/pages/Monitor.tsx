import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConversationCard } from "@/components/ConversationCard";
import { ConversationDetails } from "@/components/ConversationDetails";
import { NPSFeedbackDialog } from "@/components/NPSFeedbackDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { monitorAPI } from "@/lib/api";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Monitor() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeDepartment, setActiveDepartment] = useState("all");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showNPSDialog, setShowNPSDialog] = useState(false);
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
      toast({ title: "Chat Resolvido", description: "Conversa marcada como resolvida" });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ conversationId, assistantType, npsScore, comment, clientName }: {
      conversationId: string;
      assistantType: string;
      npsScore: number;
      comment?: string;
      clientName?: string;
    }) => {
      return apiRequest("POST", "/api/feedback", {
        conversationId,
        assistantType,
        npsScore,
        comment,
        clientName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metrics/nps"] });
      toast({ title: "Feedback Enviado", description: "Obrigado pela avaliação!" });
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
      passesStatusFilter = conv.status === "active" && !conv.metadata?.transferred;
    } else if (activeFilter === "transfer") {
      passesStatusFilter = conv.metadata?.transferred === true;
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
    if (deptValue === "all") {
      return conversations.filter(c => c.status === "active").length;
    }
    return conversations.filter(c => c.assistantType === deptValue && c.status === "active").length;
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
      setShowNPSDialog(true);
    }
  };

  const handleNPSSubmit = async (score: number, comment: string) => {
    if (activeConvId && activeConversation) {
      try {
        await feedbackMutation.mutateAsync({
          conversationId: activeConvId,
          assistantType: activeConversation.assistantType,
          npsScore: score,
          comment: comment || undefined,
          clientName: activeConversation.clientName,
        });
        
        resolveMutation.mutate(activeConvId);
      } catch (error) {
        throw error;
      }
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
          >
            {filter.label}
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
            <div className="grid grid-cols-12 gap-4 h-[calc(100vh-18rem)]">
              <div className="col-span-4">
                <div className="border rounded-lg h-full flex flex-col">
                  <div className="p-4 border-b">
                    <h2 className="font-semibold">{dept.label}</h2>
                    <Badge variant="outline" className="mt-2">
                      {conversationCards.length} conversas
                    </Badge>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-2">
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
                </div>
              </div>

              <div className="col-span-8">
                {activeConversation ? (
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
                  />
                ) : (
                  <div className="border rounded-lg h-full flex items-center justify-center">
                    <p className="text-muted-foreground">Selecione uma conversa para ver os detalhes</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {activeConversation && (
        <NPSFeedbackDialog
          open={showNPSDialog}
          onClose={() => {
            setShowNPSDialog(false);
            if (activeConvId) {
              resolveMutation.mutate(activeConvId);
            }
          }}
          conversationId={activeConvId!}
          assistantType={activeConversation.assistantType}
          clientName={activeConversation.clientName}
          onSubmit={handleNPSSubmit}
          isSubmitting={feedbackMutation.isPending}
        />
      )}
    </div>
  );
}
