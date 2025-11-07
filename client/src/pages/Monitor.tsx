import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConversationCard } from "@/components/ConversationCard";
import { ConversationDetails } from "@/components/ConversationDetails";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { monitorAPI } from "@/lib/api";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";

export default function Monitor() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDepartment, setActiveDepartment] = useState("all");
  const [resolvedSubFilter, setResolvedSubFilter] = useState("all"); // all, ai, agent, auto
  const [conversationSourceFilter, setConversationSourceFilter] = useState("all"); // all, inbound, whatsapp_campaign, voice_campaign
  const [viewMode, setViewMode] = useState<"todas" | "ia_atendendo" | "aguardando" | "em_atendimento" | "finalizadas" | "historico_completo">("todas"); // NEW: 6 estados
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreLocal, setHasMoreLocal] = useState(false);
  const [paginatedMessageIds, setPaginatedMessageIds] = useState<Set<string>>(new Set());
  
  // Estado de paginação para histórico completo
  const [historyPage, setHistoryPage] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const historyLimit = 50;

  // Resetar estado ao trocar de conversa
  useEffect(() => {
    setAllMessages([]);
    setHasMoreLocal(false);
    setIsLoadingMore(false);
    setPaginatedMessageIds(new Set());
  }, [activeConvId]);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ["/api/monitor/conversations"],
    queryFn: monitorAPI.getConversations,
    refetchInterval: 5000,
    enabled: viewMode !== "historico_completo",
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["/api/monitor/conversations/history/all", historyPage, historySearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: historyLimit.toString(),
        offset: (historyPage * historyLimit).toString(),
        ...(historySearch && { search: historySearch }),
      });
      const response = await fetch(`/api/monitor/conversations/history/all?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
    enabled: viewMode === "historico_completo",
    refetchInterval: false,
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
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations"] });
      toast({ title: "Nota Adicionada", description: "Nota interna registrada com sucesso" });
    },
    onError: (error: Error) => {
      console.error("❌ Erro ao adicionar nota:", error);
      toast({ 
        title: "Erro ao Adicionar Nota", 
        description: error.message || "Não foi possível adicionar a nota interna. Verifique suas permissões.",
        variant: "destructive"
      });
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

  const resetThreadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/conversations/${conversationId}/reset-thread`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao resetar contexto');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations", activeConvId] });
      toast({ 
        title: "Contexto Resetado", 
        description: `Histórico OpenAI limpo. ${data.messagesKept} mensagens mantidas no banco.`,
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao Resetar", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!activeConvId) throw new Error("Nenhuma conversa selecionada");
      const response = await apiRequest(
        `/api/conversations/${activeConvId}/verify`,
        "POST",
        {}
      );
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations"] });
      await queryClient.refetchQueries({ queryKey: ["/api/monitor/conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations", activeConvId] });
      await queryClient.refetchQueries({ queryKey: ["/api/monitor/conversations", activeConvId] });
      toast({
        title: "Conversa Verificada!",
        description: "Conversa marcada como verificada pelo supervisor",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao verificar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      if (!activeConvId) throw new Error("Nenhuma conversa selecionada");
      const response = await apiRequest(
        `/api/conversations/${activeConvId}/reopen`,
        "POST",
        {}
      );
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations"] });
      await queryClient.refetchQueries({ queryKey: ["/api/monitor/conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations", activeConvId] });
      await queryClient.refetchQueries({ queryKey: ["/api/monitor/conversations", activeConvId] });
      toast({
        title: "Conversa Reaberta!",
        description: "Conversa reativada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao reabrir",
        description: error.message,
        variant: "destructive",
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

  const filteredConversations = conversations.filter(conv => {
    let passesDepartmentFilter = true;
    let passesSearchFilter = true;
    let passesResolvedSubFilter = true;
    let passesViewModeFilter = true;
    let passesSourceFilter = true;

    // Apply viewMode filter (6 estados)
    if (viewMode === "ia_atendendo") {
      // IA Atendendo: SOMENTE conversas sendo atendidas pela IA
      // - Status: active
      // - NÃO transferidas (transferredToHuman === false ou null/undefined)
      // - SEM atendente atribuído (assignedTo === null)
      passesViewModeFilter = 
        conv.status === "active" && 
        conv.transferredToHuman !== true && 
        !conv.assignedTo;
    } else if (viewMode === "aguardando") {
      // Aguardando: transferidas mas sem atendente atribuído (fila de espera)
      // - Status: active ou queued
      // - Transferidas (transferredToHuman === true)
      // - SEM atendente (assignedTo === null)
      passesViewModeFilter = 
        (conv.status === "active" || conv.status === "queued") && 
        conv.transferredToHuman === true && 
        !conv.assignedTo;
    } else if (viewMode === "em_atendimento") {
      // Em Atendimento: transferidas E com atendente atribuído
      // - Status: active ou queued
      // - Transferidas (transferredToHuman === true)
      // - COM atendente (assignedTo !== null)
      passesViewModeFilter = 
        (conv.status === "active" || conv.status === "queued") && 
        conv.transferredToHuman === true && 
        !!conv.assignedTo;
    } else if (viewMode === "finalizadas") {
      // Finalizadas: conversas resolvidas nas últimas 12 horas
      passesViewModeFilter = conv.status === "resolved";
      
      // Apply sub-filter for resolved conversations
      if (resolvedSubFilter === "ai") {
        // Finalizadas pela IA (sem resolved_by)
        passesResolvedSubFilter = !conv.resolvedByName && !conv.autoClosed;
      } else if (resolvedSubFilter === "agent") {
        // Finalizadas por atendentes (tem resolved_by)
        passesResolvedSubFilter = !!conv.resolvedByName && !conv.autoClosed;
      } else if (resolvedSubFilter === "auto") {
        // Fechadas automaticamente por inatividade
        passesResolvedSubFilter = conv.autoClosed === true;
      }
      // resolvedSubFilter === "all" -> show all, passesResolvedSubFilter stays true
    } else if (viewMode === "todas") {
      // Todas: mostra apenas conversas ATIVAS, excluindo aguardando e finalizadas
      // - Status: active ou queued
      // - EXCLUI: aguardando (transferidas sem atendente)
      // - INCLUI: IA atendendo + Em atendimento
      const isAwaiting = conv.transferredToHuman === true && !conv.assignedTo;
      passesViewModeFilter = 
        (conv.status === "active" || conv.status === "queued") && 
        !isAwaiting;
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

    // Filtro por origem da conversa
    if (conversationSourceFilter !== "all") {
      const convSource = (conv as any).conversationSource || "inbound";
      passesSourceFilter = convSource === conversationSourceFilter;
    }

    return passesViewModeFilter && passesDepartmentFilter && passesSearchFilter && passesResolvedSubFilter && passesSourceFilter;
  });

  const getConversationCountByDepartment = (deptValue: string) => {
    return conversations.filter(c => {
      let passesDepartmentFilter = true;
      let passesViewModeFilter = true;
      let passesResolvedSubFilter = true;

      // ViewMode filter (consistente com lógica principal)
      if (viewMode === "ia_atendendo") {
        passesViewModeFilter = 
          c.status === "active" && 
          c.transferredToHuman !== true && 
          !c.assignedTo;
      } else if (viewMode === "aguardando") {
        passesViewModeFilter = 
          (c.status === "active" || c.status === "queued") && 
          c.transferredToHuman === true && 
          !c.assignedTo;
      } else if (viewMode === "em_atendimento") {
        passesViewModeFilter = 
          (c.status === "active" || c.status === "queued") && 
          c.transferredToHuman === true && 
          !!c.assignedTo;
      } else if (viewMode === "finalizadas") {
        passesViewModeFilter = c.status === "resolved";
        
        // Apply sub-filter for resolved conversations
        if (resolvedSubFilter === "ai") {
          passesResolvedSubFilter = !c.resolvedByName && !c.autoClosed;
        } else if (resolvedSubFilter === "agent") {
          passesResolvedSubFilter = !!c.resolvedByName && !c.autoClosed;
        } else if (resolvedSubFilter === "auto") {
          passesResolvedSubFilter = c.autoClosed === true;
        }
      } else if (viewMode === "todas") {
        const isAwaiting = c.transferredToHuman === true && !c.assignedTo;
        passesViewModeFilter = 
          (c.status === "active" || c.status === "queued") && 
          !isAwaiting;
      }

      // Department filter
      if (deptValue !== "all") {
        passesDepartmentFilter = c.assistantType === deptValue;
      }

      return passesViewModeFilter && passesDepartmentFilter && passesResolvedSubFilter;
    }).length;
  };


  const getResolvedCountByType = (type: string) => {
    const resolvedConvs = conversations.filter(c => c.status === "resolved");
    
    if (type === "all") {
      return resolvedConvs.length;
    } else if (type === "ai") {
      // Finalizadas pela IA (sem resolved_by e sem auto-close)
      return resolvedConvs.filter(c => !c.resolvedByName && !c.autoClosed).length;
    } else if (type === "agent") {
      // Finalizadas por atendentes (tem resolved_by)
      return resolvedConvs.filter(c => c.resolvedByName && !c.autoClosed).length;
    } else if (type === "auto") {
      // Fechadas automaticamente
      return resolvedConvs.filter(c => c.autoClosed === true).length;
    }
    return 0;
  };

  const conversationCards = filteredConversations
    .sort((a, b) => {
      // Ordenar por timestamp - mensagens mais recentes primeiro
      const timeA = new Date(a.lastMessageTime).getTime();
      const timeB = new Date(b.lastMessageTime).getTime();
      return timeB - timeA;
    })
    .map(conv => {
      // Determine who resolved the conversation
      let resolvedBy: "ai" | "agent" | "auto" | null = null;
      if (conv.status === "resolved") {
        if (conv.autoClosed) {
          resolvedBy = "auto";
        } else if (conv.resolvedByName) {
          // Se tem resolved_by, foi finalizada por um atendente
          resolvedBy = "agent";
        } else {
          resolvedBy = "ai";
        }
      }

      return {
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
        verifiedAt: (conv as any).verifiedAt ? new Date((conv as any).verifiedAt) : null,
        verifiedBy: (conv as any).verifiedBy || null,
        resolvedBy,
        resolvedByName: conv.resolvedByName || null,
      };
    });

  // Sincronizar mensagens quando conversationDetails mudar
  useEffect(() => {
    if (!conversationDetails?.messages) return;

    setAllMessages((prevMessages) => {
      const newMessages = conversationDetails.messages;
      
      // Se não há mensagens antigas, carregar as novas
      if (prevMessages.length === 0) {
        setHasMoreLocal(conversationDetails.hasMore || false);
        return newMessages;
      }

      // Criar Set de IDs das novas mensagens (sempre são as mais recentes do servidor)
      const newMessageIds = new Set(newMessages.map(m => m.id));
      
      // Se não há sobreposição, é uma nova conversa
      if (!newMessages.some(m => prevMessages.some(p => p.id === m.id))) {
        setHasMoreLocal(conversationDetails.hasMore || false);
        setPaginatedMessageIds(new Set());
        return newMessages;
      }
      
      // Mesma conversa: reconstruir usando rastreamento explícito de paginação
      // Encontrar timestamp mais antigo do servidor para determinar fronteira
      const oldestServerTimestamp = newMessages.length > 0
        ? Math.min(...newMessages.map(m => new Date(m.timestamp).getTime()))
        : Infinity;
      
      // Manter apenas mensagens paginadas que:
      // 1. Foram explicitamente carregadas via handleLoadMore E
      // 2. São mais antigas que todas as mensagens do servidor E
      // 3. Não estão na janela atual do servidor (para evitar duplicatas)
      const historicalPaginatedMessages = prevMessages.filter(m => {
        const msgTimestamp = new Date(m.timestamp).getTime();
        return (
          paginatedMessageIds.has(m.id) &&
          msgTimestamp < oldestServerTimestamp &&
          !newMessageIds.has(m.id)
        );
      });
      
      // Remover IDs do servidor do conjunto de paginados (foram alcançados pelo polling)
      setPaginatedMessageIds(prev => {
        const updated = new Set(prev);
        newMessages.forEach(m => updated.delete(m.id));
        return updated;
      });
      
      // Combinar histórico paginado + mensagens do servidor (sempre fonte da verdade)
      const mergedMessages = [...historicalPaginatedMessages, ...newMessages];
      
      return mergedMessages;
    });
  }, [conversationDetails?.messages, conversationDetails?.hasMore]);

  // Função para carregar mensagens anteriores
  const handleLoadMore = async () => {
    if (!activeConvId || isLoadingMore || !hasMoreLocal) return;
    
    setIsLoadingMore(true);
    try {
      // Pegar o ID da mensagem mais antiga atual
      const oldestMessageId = allMessages[0]?.id;
      
      // Buscar mensagens anteriores
      const olderData = await monitorAPI.getConversationDetails(activeConvId, oldestMessageId);
      
      // Atualizar flag hasMore local
      setHasMoreLocal(olderData.hasMore || false);
      
      // Adicionar IDs das mensagens paginadas ao conjunto de rastreamento
      setPaginatedMessageIds(prev => {
        const updated = new Set(prev);
        olderData.messages.forEach(m => updated.add(m.id));
        return updated;
      });
      
      // Adicionar mensagens antigas ao início do array
      setAllMessages(prev => [...olderData.messages, ...prev]);
      
      toast({
        title: "Mensagens Carregadas",
        description: `${olderData.messages.length} mensagens anteriores carregadas`,
      });
    } catch (error) {
      toast({
        title: "Erro ao Carregar",
        description: "Não foi possível carregar mensagens anteriores",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Buscar conversa ativa ou no histórico completo
  const activeConversation = conversations.find(c => c.id === activeConvId) || 
    (viewMode === "historico_completo" && historyData?.conversations?.find((c: any) => c.id === activeConvId));
  
  const activeMessages = allMessages.map(msg => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    timestamp: new Date(msg.timestamp),
    functionCall: msg.functionCall,
    pdfBase64: msg.pdfBase64,
    pdfName: msg.pdfName,
    imageBase64: msg.imageBase64,
    audioBase64: msg.audioBase64,
    audioMimeType: msg.audioMimeType,
  }));

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

  const handleReopen = () => {
    if (activeConvId) {
      reopenMutation.mutate();
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

      {/* NEW: Seletor de Modo de Visualização (6 Estados) */}
      <div className="flex gap-2 p-4 border-2 border-primary/20 rounded-lg bg-muted/30">
        <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground mr-2">
          Modo de Visualização:
        </div>
        <Button
          variant={viewMode === "todas" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("todas")}
          data-testid="viewmode-todas"
          className="gap-2"
        >
          🌐 Todas
        </Button>
        <Button
          variant={viewMode === "ia_atendendo" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("ia_atendendo")}
          data-testid="viewmode-ia-atendendo"
          className="gap-2"
        >
          🤖 IA Atendendo
        </Button>
        <Button
          variant={viewMode === "aguardando" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("aguardando")}
          data-testid="viewmode-aguardando"
          className="gap-2"
        >
          ⏳ Aguardando
        </Button>
        <Button
          variant={viewMode === "em_atendimento" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("em_atendimento")}
          data-testid="viewmode-em-atendimento"
          className="gap-2"
        >
          👤 Em Atendimento
        </Button>
        <Button
          variant={viewMode === "finalizadas" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setViewMode("finalizadas");
            setResolvedSubFilter("all"); // Reset sub-filter when entering finalizadas
          }}
          data-testid="viewmode-finalizadas"
          className="gap-2"
        >
          📋 Finalizadas
        </Button>
        <Button
          variant={viewMode === "historico_completo" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setViewMode("historico_completo");
            setHistoryPage(0);
            setHistorySearch("");
          }}
          data-testid="viewmode-historico"
          className="gap-2"
        >
          📜 Histórico Completo
        </Button>
      </div>

      {/* Menu Hierárquico de Cobranças */}
      <div className="flex gap-2 p-3 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground mr-2">
          Cobranças:
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-cobrancas-menu"
              className="gap-2"
            >
              {conversationSourceFilter === "all" && "📱 Todas"}
              {conversationSourceFilter === "inbound" && "📥 Entrada"}
              {conversationSourceFilter === "whatsapp_campaign" && "💬 Campanha WhatsApp"}
              {conversationSourceFilter === "voice_campaign" && "📞 Campanha Voz"}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" data-testid="menu-cobrancas-content">
            <DropdownMenuItem
              onClick={() => setConversationSourceFilter("all")}
              data-testid="source-filter-all"
              className="gap-2"
            >
              {conversationSourceFilter === "all" && <Check className="h-4 w-4" />}
              {conversationSourceFilter !== "all" && <div className="h-4 w-4" />}
              📱 Todas
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConversationSourceFilter("inbound")}
              data-testid="source-filter-inbound"
              className="gap-2"
            >
              {conversationSourceFilter === "inbound" && <Check className="h-4 w-4" />}
              {conversationSourceFilter !== "inbound" && <div className="h-4 w-4" />}
              📥 Entrada
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConversationSourceFilter("whatsapp_campaign")}
              data-testid="source-filter-whatsapp"
              className="gap-2"
            >
              {conversationSourceFilter === "whatsapp_campaign" && <Check className="h-4 w-4" />}
              {conversationSourceFilter !== "whatsapp_campaign" && <div className="h-4 w-4" />}
              💬 Campanha WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConversationSourceFilter("voice_campaign")}
              data-testid="source-filter-voice"
              className="gap-2"
            >
              {conversationSourceFilter === "voice_campaign" && <Check className="h-4 w-4" />}
              {conversationSourceFilter !== "voice_campaign" && <div className="h-4 w-4" />}
              📞 Campanha Voz
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {viewMode === "finalizadas" && (
        <div className="flex gap-2 p-3 border rounded-lg bg-muted/30">
          <Button
            variant={resolvedSubFilter === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setResolvedSubFilter("all")}
            data-testid="resolved-filter-all"
            className="gap-2"
          >
            Todas
            <Badge variant={resolvedSubFilter === "all" ? "secondary" : "outline"} className="ml-1">
              {getResolvedCountByType("all")}
            </Badge>
          </Button>
          <Button
            variant={resolvedSubFilter === "ai" ? "default" : "ghost"}
            size="sm"
            onClick={() => setResolvedSubFilter("ai")}
            data-testid="resolved-filter-ai"
            className="gap-2"
          >
            🤖 Pela IA
            <Badge variant={resolvedSubFilter === "ai" ? "secondary" : "outline"} className="ml-1">
              {getResolvedCountByType("ai")}
            </Badge>
          </Button>
          <Button
            variant={resolvedSubFilter === "agent" ? "default" : "ghost"}
            size="sm"
            onClick={() => setResolvedSubFilter("agent")}
            data-testid="resolved-filter-agent"
            className="gap-2"
          >
            👤 Por Atendentes
            <Badge variant={resolvedSubFilter === "agent" ? "secondary" : "outline"} className="ml-1">
              {getResolvedCountByType("agent")}
            </Badge>
          </Button>
          <Button
            variant={resolvedSubFilter === "auto" ? "default" : "ghost"}
            size="sm"
            onClick={() => setResolvedSubFilter("auto")}
            data-testid="resolved-filter-auto"
            className="gap-2"
          >
            ⏰ Auto-fechadas
            <Badge variant={resolvedSubFilter === "auto" ? "secondary" : "outline"} className="ml-1">
              {getResolvedCountByType("auto")}
            </Badge>
          </Button>
        </div>
      )}

      {viewMode === "historico_completo" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">📜 Histórico Completo de Conversas</h2>
              <p className="text-sm text-muted-foreground">
                Todas as conversas do banco de dados (ativas e finalizadas)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar por ID, cliente, telefone..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(0);
                }}
                className="w-80"
                data-testid="input-history-search"
              />
            </div>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-muted-foreground">Carregando histórico...</div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="outline">
                  {historyData?.total || 0} conversas no total
                </Badge>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                    disabled={historyPage === 0}
                    data-testid="button-history-prev"
                  >
                    ← Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {historyPage + 1} de {Math.ceil((historyData?.total || 0) / historyLimit)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setHistoryPage(p => p + 1)}
                    disabled={!historyData?.conversations || historyData.conversations.length < historyLimit}
                    data-testid="button-history-next"
                  >
                    Próxima →
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[calc(100vh-20rem)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-4">
                  {(historyData?.conversations || []).map((conv: any) => {
                    let resolvedBy: "ai" | "agent" | "auto" | null = null;
                    if (conv.status === "resolved") {
                      if (conv.autoClosed) {
                        resolvedBy = "auto";
                      } else if (conv.resolvedByName) {
                        resolvedBy = "agent";
                      } else {
                        resolvedBy = "ai";
                      }
                    }

                    return (
                      <ConversationCard
                        key={conv.id}
                        conversation={{
                          id: conv.id,
                          chatId: conv.chatId,
                          clientName: conv.clientName,
                          assistant: `LIA ${conv.assistantType.charAt(0).toUpperCase() + conv.assistantType.slice(1)}`,
                          duration: conv.duration,
                          lastMessage: conv.lastMessage || "",
                          lastClientMessage: conv.lastClientMessage || "",
                          lastAIMessage: conv.lastAIMessage || "",
                          sentiment: (conv.sentiment || "neutral") as "positive" | "neutral" | "negative",
                          urgency: (conv.urgency || "normal") as "normal" | "high" | "critical",
                          hasAlert: false,
                          transferSuggested: false,
                          lastMessageTime: new Date(conv.lastMessageTime),
                          verifiedAt: conv.verifiedAt ? new Date(conv.verifiedAt) : null,
                          verifiedBy: conv.verifiedBy || null,
                          resolvedBy,
                          resolvedByName: conv.resolvedByName || null,
                        }}
                        isActive={activeConvId === conv.id}
                        onClick={() => setActiveConvId(conv.id)}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      ) : (
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
      )}

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
                onResetThread={() => resetThreadMutation.mutate(activeConversation.id)}
                onVerify={(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') ? () => verifyMutation.mutate() : undefined}
                isVerified={!!(activeConversation as any).verifiedAt}
                onReopen={(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') ? handleReopen : undefined}
                conversationStatus={activeConversation.status}
                onLoadMore={handleLoadMore}
                hasMore={hasMoreLocal}
                isLoadingMore={isLoadingMore}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
