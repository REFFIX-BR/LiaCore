import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConversationList } from "@/components/ConversationList";
import { ChatMessage, type Message } from "@/components/ChatMessage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Send, CheckCircle2, Edit3, Loader2, UserPlus, ChevronDown } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";

interface Agent {
  id: string;
  fullName: string;
  username: string;
  role: string;
}

interface Conversation {
  id: string;
  chatId: string;
  clientName: string;
  clientDocument: string | null;
  assistantType: string;
  lastMessage: string | null;
  lastMessageTime: Date;
  transferredToHuman: boolean;
  transferReason: string | null;
  transferredAt: Date | null;
  status: string;
  assignedTo: string | null;
}

export default function Conversations() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"transferred" | "assigned">("transferred");
  const [messageContent, setMessageContent] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [isEditingAI, setIsEditingAI] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoadedOlder, setHasLoadedOlder] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, isAgent, isSupervisor, isAdmin } = useAuth();

  // Query conversas transferidas (não atribuídas)
  const { data: transferredConversations = [], isLoading: transferredLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations/transferred"],
    refetchInterval: 5000,
  });

  // Query conversas atribuídas
  const { data: assignedConversations = [], isLoading: assignedLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations/assigned"],
    refetchInterval: 5000,
  });

  // Usar a lista correta baseada na aba ativa
  const conversations = activeTab === "transferred" ? transferredConversations : assignedConversations;
  const conversationsLoading = activeTab === "transferred" ? transferredLoading : assignedLoading;

  // Filtrar conversas ATIVAS e AGUARDANDO atribuição (conversas resolvidas aparecem apenas como histórico)
  const activeConversations = conversations.filter(conv => conv.status === 'active' || conv.status === 'queued');

  // Query mensagens da conversa ativa (últimas 15)
  const { data: conversationData } = useQuery<{ messages: Message[]; hasMore: boolean }>({
    queryKey: ["/api/monitor/conversations", activeId],
    enabled: !!activeId,
    refetchInterval: 3000,
  });
  
  // Resetar mensagens quando conversa ativa muda
  useEffect(() => {
    if (activeId) {
      setAllMessages([]);
      setHasMore(false);
      setHasLoadedOlder(false);
    }
  }, [activeId]);

  // Atualizar mensagens quando dados mudam (mesclar novas sem perder antigas)
  useEffect(() => {
    if (!conversationData) return;

    setAllMessages(prev => {
      // Se não há mensagens anteriores, usar as novas diretamente
      if (prev.length === 0) {
        return conversationData.messages;
      }

      // Pegar IDs das mensagens que já temos
      const existingIds = new Set(prev.map(m => m.id));
      
      // Adicionar apenas mensagens novas que não temos ainda
      const newMessages = conversationData.messages.filter(m => !existingIds.has(m.id));
      
      if (newMessages.length === 0) {
        return prev; // Nenhuma mensagem nova
      }

      // Adicionar novas mensagens ao final
      return [...prev, ...newMessages];
    });
    
    // Só atualizar hasMore do refetch automático se não carregamos mensagens antigas manualmente
    // Se já carregamos manualmente, preservar o valor atual (pode ser false)
    if (!hasLoadedOlder) {
      setHasMore(conversationData.hasMore);
    }
  }, [conversationData, hasLoadedOlder]);

  // Scroll automático APENAS quando: conversa muda OU novas mensagens chegam
  useEffect(() => {
    if (!activeId || !messagesEndRef.current) return;

    // Verificar se estamos próximos do final antes de fazer scroll
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) {
      // Se não conseguimos acessar o container, fazer scroll sempre (primeira vez)
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    // Só fazer scroll se estiver próximo do final (para não interromper leitura de mensagens antigas)
    if (isNearBottom || allMessages.length <= 15) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages, activeId]);

  // Função para carregar mensagens anteriores
  const loadMoreMessages = useCallback(async () => {
    if (!activeId || !hasMore || loadingMore) return;
    
    setLoadingMore(true);
    setHasLoadedOlder(true); // Marcar que carregamos manualmente
    
    try {
      const oldestMessageId = allMessages[0]?.id;
      if (!oldestMessageId) {
        setHasMore(false);
        return;
      }
      
      const response = await fetch(`/api/monitor/conversations/${activeId}?before=${oldestMessageId}&limit=15`);
      const data = await response.json();
      
      // Sempre atualizar hasMore, mesmo se não houver mensagens
      setHasMore(data.hasMore);
      
      if (data.messages && data.messages.length > 0) {
        setAllMessages(prev => [...data.messages, ...prev]);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [activeId, hasMore, loadingMore, allMessages]);

  const messages = allMessages;

  // Mutation para pedir sugestão da IA
  const suggestMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await apiRequest(`/api/conversations/${conversationId}/suggest-response`, "POST", { 
        supervisorName: "Supervisor" 
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      setAiSuggestion(data.suggestedResponse);
      setSuggestionId(data.suggestionId);
      setMessageContent(data.suggestedResponse);
      toast({
        title: "Sugestão gerada!",
        description: "A IA analisou o contexto e sugeriu uma resposta.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível gerar sugestão.",
        variant: "destructive",
      });
    },
  });

  // Mutation para enviar mensagem
  const sendMutation = useMutation({
    mutationFn: async ({ content, wasEdited }: { content: string; wasEdited: boolean }) => {
      if (!activeId) return null;
      
      const response = await apiRequest(`/api/conversations/${activeId}/send-message`, "POST", {
        content,
        suggestionId,
        wasEdited,
        supervisorName: "Supervisor",
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations", activeId] });
      setMessageContent("");
      setAiSuggestion(null);
      setSuggestionId(null);
      setIsEditingAI(false);
      
      if (data?.learningEventCreated) {
        toast({
          title: "Mensagem enviada!",
          description: "✨ Aprendizado registrado - a IA vai melhorar com sua edição!",
        });
      } else {
        toast({
          title: "Mensagem enviada!",
        });
      }
    },
  });

  // Mutation para resolver conversa (AGENT pode resolver suas próprias conversas)
  const resolveMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await apiRequest(`/api/conversations/${conversationId}/resolve`, "POST", {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/transferred"] });
      setActiveId(null);
      toast({
        title: "Conversa finalizada!",
        description: "Atendimento encerrado com sucesso. Cliente receberá pesquisa de satisfação.",
      });
    },
  });

  // Query para buscar agentes ativos
  const { data: agentsData } = useQuery<{ agents: Agent[] }>({
    queryKey: ["/api/agents/list"],
    enabled: showAssignDialog,
  });

  const agents = agentsData?.agents || [];

  // Mutation para atribuir conversa (auto-atribuição ou atribuição manual)
  const assignMutation = useMutation({
    mutationFn: async ({ conversationId, agentId }: { conversationId: string; agentId?: string }) => {
      const body = agentId ? { agentId } : {};
      const response = await apiRequest(`/api/conversations/${conversationId}/assign`, "POST", body);
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/transferred"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/assigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations", activeId] });
      setShowAssignDialog(false);
      setSelectedAgentId("");
      
      // Mudar para aba "Atribuídas" automaticamente
      setActiveTab("assigned");
      
      toast({
        title: "Conversa atribuída!",
        description: `${data.agent.fullName} assumiu a conversa e o cliente foi notificado.`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atribuir a conversa.",
        variant: "destructive",
      });
    },
  });

  const handleRequestSuggestion = () => {
    if (activeId) {
      suggestMutation.mutate(activeId);
    }
  };

  const handleApprove = () => {
    if (!messageContent.trim()) return;
    sendMutation.mutate({ 
      content: messageContent, 
      wasEdited: false,
    });
  };

  const handleEditAndSend = () => {
    if (!messageContent.trim()) return;
    sendMutation.mutate({ 
      content: messageContent, 
      wasEdited: true,
    });
  };

  const handleManualSend = () => {
    if (!messageContent.trim()) return;
    sendMutation.mutate({ 
      content: messageContent, 
      wasEdited: false,
    });
  };

  const handleResolve = () => {
    if (activeId) {
      // Supervisor apenas finaliza - NPS será enviado ao cliente via WhatsApp
      resolveMutation.mutate(activeId);
    }
  };

  // Auto-atribuição (AGENT)
  const handleSelfAssign = () => {
    if (!activeId) return;
    assignMutation.mutate({ conversationId: activeId });
  };

  // Atribuição manual (SUPERVISOR/ADMIN)
  const handleManualAssign = () => {
    if (!activeId || !selectedAgentId) return;
    assignMutation.mutate({ conversationId: activeId, agentId: selectedAgentId });
  };

  const activeConversation = activeConversations.find(c => c.id === activeId);
  const showAISuggestion = aiSuggestion && !isEditingAI;

  if (conversationsLoading) {
    return <div className="flex items-center justify-center h-full">Carregando...</div>;
  }

  const transferredActiveConversations = transferredConversations.filter(conv => conv.status === 'active' || conv.status === 'queued');
  const assignedActiveConversations = assignedConversations.filter(conv => conv.status === 'active' || conv.status === 'queued');

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Lista de conversas com abas */}
      <Card className="w-80 flex flex-col">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "transferred" | "assigned")} className="flex flex-col h-full">
          <div className="p-4 pb-0 border-b">
            <TabsList className="grid w-full grid-cols-2" data-testid="tabs-conversations">
              <TabsTrigger value="transferred" data-testid="tab-transferred">
                Transferidas
                {transferredActiveConversations.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {transferredActiveConversations.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="assigned" data-testid="tab-assigned">
                Atribuídas
                {assignedActiveConversations.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {assignedActiveConversations.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="transferred" className="flex-1 mt-0 h-full">
            {transferredActiveConversations.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2 p-4">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma conversa transferida disponível
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
                  {transferredActiveConversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setActiveId(conv.id)}
                      className={`p-3 rounded-md cursor-pointer transition-colors hover-elevate ${
                        activeId === conv.id ? "bg-accent" : ""
                      }`}
                      data-testid={`conversation-item-${conv.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{conv.clientName}</div>
                          {conv.transferReason && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {conv.transferReason}
                            </div>
                          )}
                          {conv.lastMessage && (
                            <div className="text-sm text-muted-foreground mt-1 truncate">
                              {conv.lastMessage}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {conv.assistantType}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(conv.transferredAt || conv.lastMessageTime).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="assigned" className="flex-1 mt-0 h-full">
            {assignedActiveConversations.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2 p-4">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma conversa atribuída
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
                  {assignedActiveConversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setActiveId(conv.id)}
                      className={`p-3 rounded-md cursor-pointer transition-colors hover-elevate ${
                        activeId === conv.id ? "bg-accent" : ""
                      }`}
                      data-testid={`conversation-item-${conv.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{conv.clientName}</div>
                          {conv.transferReason && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {conv.transferReason}
                            </div>
                          )}
                          {conv.lastMessage && (
                            <div className="text-sm text-muted-foreground mt-1 truncate">
                              {conv.lastMessage}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {conv.assistantType}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(conv.transferredAt || conv.lastMessageTime).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Área de chat */}
      {activeConversation ? (
        <Card className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{activeConversation.clientName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {activeConversation.assistantType}
                </Badge>
                {activeConversation.transferReason && (
                  <span className="text-xs text-muted-foreground">
                    • {activeConversation.transferReason}
                  </span>
                )}
                {activeConversation.assignedTo && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400">
                    Atribuído
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!activeConversation.assignedTo && (
                <>
                  {isAgent ? (
                    /* Auto-atribuição para AGENT */
                    <Button
                      onClick={handleSelfAssign}
                      variant="outline"
                      size="sm"
                      disabled={assignMutation.isPending}
                      data-testid="button-self-assign"
                    >
                      {assignMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-1" />
                      )}
                      Atribuir
                    </Button>
                  ) : (
                    /* Atribuição manual para SUPERVISOR/ADMIN */
                    <Button
                      onClick={() => setShowAssignDialog(true)}
                      variant="outline"
                      size="sm"
                      data-testid="button-manual-assign"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Atribuir Atendente
                    </Button>
                  )}
                </>
              )}
              <Button
                onClick={handleResolve}
                variant="default"
                size="sm"
                disabled={isAgent && activeConversation.assignedTo !== user?.id}
                data-testid="button-resolve"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Finalizar
              </Button>
            </div>
          </div>

          {/* Mensagens */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-2">
              {hasMore && (
                <div className="flex justify-center py-2">
                  <Button
                    onClick={loadMoreMessages}
                    variant="ghost"
                    size="sm"
                    disabled={loadingMore}
                    data-testid="button-load-more"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2 rotate-180" />
                        Carregar mensagens anteriores
                      </>
                    )}
                  </Button>
                </div>
              )}
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* AI Suggestion Panel */}
          {showAISuggestion && (
            <div className="p-4 border-t bg-accent/50">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="text-sm font-medium">Sugestão da IA</div>
                  <div className="text-sm bg-background rounded-md p-3 border">
                    {aiSuggestion}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleApprove}
                      size="sm"
                      disabled={sendMutation.isPending}
                      data-testid="button-approve-suggestion"
                    >
                      {sendMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Aprovar
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditingAI(true);
                      }}
                      size="sm"
                      variant="outline"
                      data-testid="button-edit-suggestion"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-4 border-t space-y-3">
            {!showAISuggestion && (
              <Button
                onClick={handleRequestSuggestion}
                variant="outline"
                size="sm"
                disabled={suggestMutation.isPending}
                className="w-full"
                data-testid="button-request-suggestion"
              >
                {suggestMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {suggestMutation.isPending ? "Gerando sugestão..." : "Pedir Sugestão da IA"}
              </Button>
            )}

            <div className="flex gap-2">
              <Textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (messageContent.trim() && !sendMutation.isPending) {
                      if (isEditingAI) {
                        handleEditAndSend();
                      } else {
                        handleManualSend();
                      }
                    }
                  }
                }}
                placeholder={
                  isEditingAI
                    ? "Edite a sugestão da IA..."
                    : "Digite sua resposta ou peça uma sugestão da IA..."
                }
                className="resize-none"
                rows={3}
                disabled={sendMutation.isPending}
                data-testid="input-message"
              />
              <Button
                onClick={isEditingAI ? handleEditAndSend : handleManualSend}
                disabled={!messageContent.trim() || sendMutation.isPending}
                data-testid="button-send"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {isEditingAI && (
              <p className="text-xs text-muted-foreground">
                ✨ Editando sugestão da IA - suas alterações serão usadas para aprendizado
              </p>
            )}
          </div>
        </Card>
      ) : (
        <Card className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <h3 className="font-semibold">Selecione uma conversa</h3>
            <p className="text-sm text-muted-foreground">
              Escolha uma conversa transferida para atender
            </p>
          </div>
        </Card>
      )}

      {/* Dialog de atribuição */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent data-testid="dialog-assign">
          <DialogHeader>
            <DialogTitle>Atribuir Conversa a Atendente</DialogTitle>
            <DialogDescription>
              Selecione um atendente para assumir esta conversa. O cliente será notificado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Atendente</label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger data-testid="select-agent">
                  <SelectValue placeholder="Selecione um atendente" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id} data-testid={`agent-option-${agent.id}`}>
                      {agent.fullName} ({agent.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignDialog(false);
                setSelectedAgentId("");
              }}
              data-testid="button-cancel-assign"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleManualAssign}
              disabled={!selectedAgentId || assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Atribuindo...
                </>
              ) : (
                "Atribuir Conversa"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
