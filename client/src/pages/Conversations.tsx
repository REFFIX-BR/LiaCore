import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { ChatPanel } from "@/components/ChatPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { Circle, CheckCircle2, Search, X, LayoutGrid, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Função para calcular cor do indicador baseado no tempo de espera
function getWaitTimeIndicator(lastMessageTime: Date): { color: string; label: string } {
  const now = new Date();
  const minutesWaiting = Math.floor((now.getTime() - lastMessageTime.getTime()) / (1000 * 60));
  
  if (minutesWaiting < 10) {
    return { color: "text-green-500", label: "Recente" };
  } else if (minutesWaiting < 20) {
    return { color: "text-yellow-500", label: "Aguardando" };
  } else {
    return { color: "text-red-500", label: "Crítico" };
  }
}

// Função para retornar badge de departamento
function getDepartmentBadge(department: string | null | undefined) {
  if (!department) return null;

  const departmentLabels: Record<string, string> = {
    commercial: "Comercial",
    support: "Suporte",
    financial: "Financeiro",
    cancellation: "Cancelamento",
    general: "Geral",
  };

  const departmentColors: Record<string, string> = {
    commercial: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
    support: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
    financial: "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30",
    cancellation: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
    general: "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30",
  };

  return (
    <Badge 
      variant="outline" 
      className={`text-xs font-medium ${departmentColors[department] || ""}`}
      data-testid={`badge-department-${department}`}
    >
      {departmentLabels[department] || department}
    </Badge>
  );
}

interface Conversation {
  id: string;
  chatId: string;
  clientName: string;
  clientDocument: string | null;
  assistantType: string;
  department?: string | null;
  lastMessage: string | null;
  lastMessageTime: Date;
  transferredToHuman: boolean;
  transferReason: string | null;
  transferredAt: Date | null;
  status: string;
  assignedTo: string | null;
  assignedToName?: string | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  unreadCount?: number;
}

export default function Conversations() {
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"transferred" | "assigned">("transferred");
  const [searchQuery, setSearchQuery] = useState("");
  const [layoutMode, setLayoutMode] = useState<"single" | "dual">(() => {
    const saved = localStorage.getItem("conversationsLayoutMode");
    return (saved === "single" || saved === "dual") ? saved : "dual";
  });
  const [initialConversationLoaded, setInitialConversationLoaded] = useState(false);
  const { user, isAgent } = useAuth();
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  // Ler conversationId da URL
  const urlParams = new URLSearchParams(searchString);
  const conversationIdFromUrl = urlParams.get('conversationId');

  // Salvar preferência de layout no localStorage
  useEffect(() => {
    localStorage.setItem("conversationsLayoutMode", layoutMode);
  }, [layoutMode]);

  // Query conversas transferidas
  const { data: transferredConversations = [], isLoading: transferredLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations/transferred"],
    refetchInterval: 5000,
  });

  // Query conversas atribuídas
  const { data: assignedConversations = [], isLoading: assignedLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations/assigned"],
    refetchInterval: 5000,
  });

  // Query conversa específica (quando vem da URL)
  const { data: specificConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", conversationIdFromUrl],
    enabled: !!conversationIdFromUrl && !initialConversationLoaded,
  });

  // Carregar conversa da URL automaticamente
  useEffect(() => {
    if (conversationIdFromUrl && specificConversation && !initialConversationLoaded) {
      setActiveIds([conversationIdFromUrl]);
      setInitialConversationLoaded(true);
      // Limpar o parâmetro da URL
      setLocation("/conversations", { replace: true });
    }
  }, [conversationIdFromUrl, specificConversation, initialConversationLoaded, setLocation]);

  // Usar a lista correta baseada na aba ativa
  const conversations = activeTab === "transferred" ? transferredConversations : assignedConversations;
  const conversationsLoading = activeTab === "transferred" ? transferredLoading : assignedLoading;

  // Filtrar conversas ATIVAS (inclui resolved das últimas 24h, conforme backend)
  const activeConversations = conversations.filter(conv => 
    conv.status === 'active' || 
    conv.status === 'queued' ||
    conv.status === 'resolved'
  );

  // Função para selecionar conversa
  const handleSelectConversation = (id: string) => {
    if (activeIds.includes(id)) {
      return;
    }

    // Modo single: apenas uma conversa por vez
    if (layoutMode === "single") {
      setActiveIds([id]);
      return;
    }

    // Modo dual: até duas conversas
    if (activeIds.length < 2) {
      setActiveIds([...activeIds, id]);
    } else {
      setActiveIds([activeIds[0], id]);
    }
  };

  // Ajustar conversas ao mudar o modo de layout
  useEffect(() => {
    if (layoutMode === "single" && activeIds.length > 1) {
      // Manter apenas a primeira conversa ao mudar para modo single
      setActiveIds([activeIds[0]]);
    }
  }, [layoutMode]);

  // Função para fechar conversa
  const handleCloseConversation = (id: string) => {
    setActiveIds(activeIds.filter(activeId => activeId !== id));
  };

  // Obter conversas ativas
  const activeConversation1 = activeConversations.find(c => c.id === activeIds[0]);
  const activeConversation2 = activeConversations.find(c => c.id === activeIds[1]);

  // Função para filtrar por busca
  const filterBySearch = (conv: Conversation) => {
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.clientName?.toLowerCase().includes(searchLower) ||
      conv.chatId?.toLowerCase().includes(searchLower) ||
      conv.lastMessage?.toLowerCase().includes(searchLower) ||
      conv.clientDocument?.toLowerCase().includes(searchLower) ||
      conv.assignedToName?.toLowerCase().includes(searchLower)
    );
  };

  // Ordenar e filtrar conversas transferidas
  const transferredActiveConversations = transferredConversations
    .filter(conv => 
      conv.status === 'active' || 
      conv.status === 'queued' ||
      conv.status === 'resolved'
    )
    .filter(filterBySearch)
    .sort((a, b) => {
      // Ordenar por timestamp - mensagens mais recentes primeiro
      const timeA = new Date(a.lastMessageTime).getTime();
      const timeB = new Date(b.lastMessageTime).getTime();
      return timeB - timeA;
    });
  
  // Ordenar e filtrar conversas atribuídas
  const assignedActiveConversations = assignedConversations
    .filter(conv => 
      conv.status === 'active' || 
      conv.status === 'queued' ||
      conv.status === 'resolved'
    )
    .filter(filterBySearch)
    .sort((a, b) => {
      // Ordenar por timestamp - mensagens mais recentes primeiro
      const timeA = new Date(a.lastMessageTime).getTime();
      const timeB = new Date(b.lastMessageTime).getTime();
      return timeB - timeA;
    });

  // Verificar se conversas ainda estão ativas
  useEffect(() => {
    const stillActive = activeIds.filter(id => 
      activeConversations.some(conv => conv.id === id)
    );
    if (stillActive.length !== activeIds.length) {
      setActiveIds(stillActive);
    }
  }, [activeConversations, activeIds]);

  if (conversationsLoading) {
    return <div className="flex items-center justify-center h-full">Carregando...</div>;
  }

  return (
    <div className="h-full flex gap-4">
      {/* Lista de conversas */}
      <Card className="w-96 flex flex-col overflow-hidden">
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

          {/* Campo de Busca */}
          <div className="px-4 pt-3 pb-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, telefone, CPF..."
                className="pl-9 pr-9 h-9"
                data-testid="input-search-conversations"
              />
              {searchQuery && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="transferred" className="flex-1 mt-0 h-full">
            {transferredActiveConversations.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2 p-4">
                  <p className="text-sm text-muted-foreground">
                    {searchQuery 
                      ? `Nenhuma conversa encontrada para "${searchQuery}"`
                      : "Nenhuma conversa transferida disponível"}
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
                  {transferredActiveConversations.map((conv) => {
                    const waitTimeIndicator = getWaitTimeIndicator(new Date(conv.lastMessageTime));
                    return (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv.id)}
                        className={`p-3 rounded-md cursor-pointer transition-colors hover:bg-accent/50 ${
                          activeIds.includes(conv.id) ? "bg-accent" : ""
                        }`}
                        data-testid={`conversation-item-${conv.id}`}
                      >
                        <div className="flex items-start justify-between gap-3 w-full">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <Circle className={`h-3 w-3 fill-current flex-shrink-0 ${waitTimeIndicator.color}`} data-testid="wait-indicator" />
                              {conv.unreadCount && conv.unreadCount > 0 && (
                                <Badge 
                                  variant="default" 
                                  className="h-5 min-w-5 px-1.5 text-xs flex-shrink-0 bg-green-600 hover:bg-green-600"
                                  data-testid={`badge-unread-${conv.id}`}
                                >
                                  {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                                </Badge>
                              )}
                              <div className="font-medium truncate min-w-0">{conv.clientName}</div>
                              {conv.verifiedAt && (
                                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" data-testid="verified-indicator" />
                              )}
                            </div>
                            {conv.transferReason && (
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">
                                {conv.transferReason}
                              </div>
                            )}
                            {conv.lastMessage && (
                              <div className="text-sm text-muted-foreground mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap">
                                {conv.lastMessage}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <div className="text-xs text-muted-foreground">
                                {new Date(conv.transferredAt || conv.lastMessageTime).toLocaleString("pt-BR")}
                              </div>
                              {conv.department && getDepartmentBadge(conv.department)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div className="h-32" aria-hidden="true" />
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="assigned" className="flex-1 mt-0 h-full">
            {assignedActiveConversations.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2 p-4">
                  <p className="text-sm text-muted-foreground">
                    {searchQuery 
                      ? `Nenhuma conversa encontrada para "${searchQuery}"`
                      : "Nenhuma conversa atribuída"}
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
                  {assignedActiveConversations.map((conv) => {
                    const waitTimeIndicator = getWaitTimeIndicator(new Date(conv.lastMessageTime));
                    return (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv.id)}
                        className={`p-3 rounded-md cursor-pointer transition-colors hover:bg-accent/50 ${
                          activeIds.includes(conv.id) ? "bg-accent" : ""
                        }`}
                        data-testid={`conversation-item-${conv.id}`}
                      >
                        <div className="flex items-start justify-between gap-3 w-full">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <Circle className={`h-3 w-3 fill-current flex-shrink-0 ${waitTimeIndicator.color}`} data-testid="wait-indicator" />
                              {conv.unreadCount && conv.unreadCount > 0 && (
                                <Badge 
                                  variant="default" 
                                  className="h-5 min-w-5 px-1.5 text-xs flex-shrink-0 bg-green-600 hover:bg-green-600"
                                  data-testid={`badge-unread-${conv.id}`}
                                >
                                  {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                                </Badge>
                              )}
                              <div className="font-medium truncate min-w-0">{conv.clientName}</div>
                              {conv.verifiedAt && (
                                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" data-testid="verified-indicator" />
                              )}
                            </div>
                            {conv.assignedToName && (
                              <div className="text-xs text-muted-foreground mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap">
                                Atribuído por {conv.assignedToName}
                              </div>
                            )}
                            {conv.transferReason && (
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">
                                {conv.transferReason}
                              </div>
                            )}
                            {conv.lastMessage && (
                              <div className="text-sm text-muted-foreground mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap">
                                {conv.lastMessage}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <div className="text-xs text-muted-foreground">
                                {new Date(conv.transferredAt || conv.lastMessageTime).toLocaleString("pt-BR")}
                              </div>
                              {conv.department && getDepartmentBadge(conv.department)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div className="h-32" aria-hidden="true" />
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Área de chats - Split Screen */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Seletor de Layout */}
        <Card className="p-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Modo de Visualização:</span>
              <ToggleGroup 
                type="single" 
                value={layoutMode}
                onValueChange={(value) => value && setLayoutMode(value as "single" | "dual")}
                data-testid="layout-mode-selector"
              >
                <ToggleGroupItem value="single" aria-label="Uma caixa" data-testid="layout-mode-single">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  1 Caixa
                </ToggleGroupItem>
                <ToggleGroupItem value="dual" aria-label="Duas caixas" data-testid="layout-mode-dual">
                  <Columns2 className="h-4 w-4 mr-2" />
                  2 Caixas
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="text-xs text-muted-foreground">
              {layoutMode === "single" ? "Troca rápida entre conversas" : "Até 2 conversas simultâneas"}
            </div>
          </div>
        </Card>

        {/* Conversas */}
        <div className="flex-1 flex gap-4 min-h-0">
          {activeConversation1 ? (
            <>
              {/* Primeiro Chat */}
              <div className={activeConversation2 && layoutMode === "dual" ? "flex-1" : "flex-1"}>
                <ChatPanel
                  conversation={activeConversation1}
                  onClose={() => handleCloseConversation(activeConversation1.id)}
                  showCloseButton={true}
                />
              </div>

              {/* Segundo Chat (apenas no modo dual) */}
              {activeConversation2 && layoutMode === "dual" && (
                <div className="flex-1">
                  <ChatPanel
                    conversation={activeConversation2}
                    onClose={() => handleCloseConversation(activeConversation2.id)}
                    showCloseButton={true}
                  />
                </div>
              )}
            </>
          ) : (
            <Card className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <h3 className="font-semibold">Selecione uma conversa</h3>
                <p className="text-sm text-muted-foreground">
                  {layoutMode === "single" 
                    ? "Escolha uma conversa para atender (modo 1 caixa)" 
                    : "Escolha uma ou duas conversas para atender simultaneamente"}
                </p>
                {layoutMode === "dual" && (
                  <p className="text-xs text-muted-foreground">
                    Dica: Selecione uma segunda conversa para dividir a tela
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
