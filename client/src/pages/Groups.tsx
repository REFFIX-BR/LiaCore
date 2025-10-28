import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Users, ToggleLeft, ToggleRight, MessageSquare, Clock, Send, Bot, User as UserIcon, Sparkles, Loader2, Paperclip, X, Image as ImageIcon, FileText, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";

interface Group {
  id: string;
  groupId: string;
  name: string;
  avatar: string | null;
  aiEnabled: boolean;
  evolutionInstance: string | null;
  lastMessageTime: Date | null;
  lastMessage: string | null;
  participantsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sendBy?: string;
  assistant?: string;
  imageBase64?: string | null;
  pdfBase64?: string | null;
  pdfName?: string | null;
  audioBase64?: string | null;
  functionCall?: {
    name: string;
    status: 'pending' | 'completed' | 'failed';
  };
}

const functionIcons: Record<string, string> = {
  verificar_conexao: "🔌",
  consultar_base_de_conhecimento: "📚",
  consultar_fatura: "📄",
  agendar_visita: "📅",
  consultar_isencao_cpf: "🔍",
  transferir_para_humano: "👤",
  rotear_para_assistente: "🎭",
};

export default function Groups() {
  const [search, setSearch] = useState("");
  const [aiFilter, setAiFilter] = useState<string>("all");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messageText, setMessageText] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoadedOlder, setHasLoadedOlder] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast} = useToast();
  const { user } = useAuth();

  // Query all groups
  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups", { search, aiEnabled: aiFilter === "all" ? undefined : aiFilter === "enabled" }],
    refetchInterval: 10000,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (aiFilter === "enabled") params.append("aiEnabled", "true");
      if (aiFilter === "disabled") params.append("aiEnabled", "false");
      
      const url = `/api/groups${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      
      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }
      return response.json();
    },
  });

  // Mutation to toggle AI
  const toggleAiMutation = useMutation({
    mutationFn: async (data: { groupId: string; aiEnabled: boolean }) => {
      const response = await fetch(`/api/groups/${data.groupId}/toggle-ai`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ aiEnabled: data.aiEnabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle AI");
      }

      return response.json();
    },
    onSuccess: (data: Group) => {
      toast({
        title: data.aiEnabled ? "IA Ativada" : "IA Desativada",
        description: `IA ${data.aiEnabled ? "ativada" : "desativada"} para ${data.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setSelectedGroup(data);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao alterar status da IA",
        description: error.message || "Ocorreu um erro ao alterar o status",
        variant: "destructive",
      });
    },
  });

  // Query group messages with pagination
  const { data: conversationData } = useQuery<{ messages: Message[]; hasMore: boolean }>({
    queryKey: ["/api/groups", selectedGroup?.id, "messages"],
    enabled: !!selectedGroup,
    refetchInterval: 5000, // Refresh every 5 seconds
    queryFn: async () => {
      if (!selectedGroup) return { messages: [], hasMore: false };
      const response = await fetch(`/api/groups/${selectedGroup.id}/messages`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      return response.json();
    },
  });

  // Resetar mensagens quando grupo muda
  useEffect(() => {
    setAllMessages([]);
    setHasMore(false);
    setHasLoadedOlder(false);
    setAiSuggestion(null);
    setSuggestionId(null);
    setMessageText("");
  }, [selectedGroup?.id]);

  // Atualizar mensagens quando conversationData muda
  useEffect(() => {
    if (!conversationData) return;
    
    // Se não carregou mensagens antigas, substitui tudo
    if (!hasLoadedOlder) {
      setAllMessages(conversationData.messages);
      setHasMore(conversationData.hasMore);
      return;
    }
    
    // Se carregou antigas, adiciona apenas as novas
    const existingIds = new Set(allMessages.map(m => m.id));
    const newMessages = conversationData.messages.filter(m => !existingIds.has(m.id));
    
    setAllMessages(prev => {
      return [...prev, ...newMessages];
    });
    
    if (!hasLoadedOlder) {
      setHasMore(conversationData.hasMore);
    }
  }, [conversationData, hasLoadedOlder]);

  // Carregar mensagens anteriores
  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore || !selectedGroup) return;
    
    setLoadingMore(true);
    setHasLoadedOlder(true);
    
    // Salvar posição de scroll atual ANTES de carregar mais mensagens
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    const previousScrollHeight = scrollContainer?.scrollHeight || 0;
    const previousScrollTop = scrollContainer?.scrollTop || 0;
    
    try {
      const oldestMessageId = allMessages[0]?.id;
      if (!oldestMessageId) {
        setHasMore(false);
        return;
      }
      
      const response = await fetch(`/api/groups/${selectedGroup.id}/messages?before=${oldestMessageId}&limit=15`, {
        credentials: "include",
      });
      const data = await response.json();
      
      setHasMore(data.hasMore);
      
      if (data.messages && data.messages.length > 0) {
        setAllMessages(prev => [...data.messages, ...prev]);
        
        // Restaurar posição de scroll após adicionar mensagens antigas
        setTimeout(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            const scrollDiff = newScrollHeight - previousScrollHeight;
            scrollContainer.scrollTop = previousScrollTop + scrollDiff;
          }
        }, 0);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar mensagens antigas",
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
  };

  // Mutation to request AI suggestion
  const suggestMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup) throw new Error("No group selected");
      const response = await apiRequest(
        `/api/groups/${selectedGroup.id}/suggest-response`, 
        "POST",
        { supervisorName: user?.fullName }
      );
      return response.json();
    },
    onSuccess: (data) => {
      setAiSuggestion(data.suggestedResponse);
      setSuggestionId(data.suggestionId);
      setMessageText(data.suggestedResponse);
      toast({
        title: "Sugestão gerada!",
        description: "Você pode editar ou enviar a sugestão",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao gerar sugestão",
        variant: "destructive",
      });
    },
  });

  // Mutation to send message
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { groupId: string; message: string }) => {
      return await apiRequest(`/api/groups/${data.groupId}/send`, "POST", { message: data.message });
    },
    onSuccess: () => {
      setMessageText("");
      setAiSuggestion(null);
      setSuggestionId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/groups", selectedGroup?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Mensagem Enviada",
        description: "Mensagem enviada com sucesso para o grupo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Ocorreu um erro ao enviar a mensagem",
        variant: "destructive",
      });
    },
  });

  // Mutation to send media
  const sendMediaMutation = useMutation({
    mutationFn: async (data: { groupId: string; mediaBase64: string; mediaType: 'image' | 'document' | 'audio'; caption?: string; fileName?: string }) => {
      return await apiRequest(`/api/groups/${data.groupId}/send-media`, "POST", data);
    },
    onSuccess: () => {
      setAttachedFile(null);
      setFilePreview(null);
      setCaption("");
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/groups", selectedGroup?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Mídia Enviada",
        description: "Mídia enviada com sucesso para o grupo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mídia",
        description: error.message || "Ocorreu um erro ao enviar a mídia",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when messages change (only for new messages, not when loading older)
  useEffect(() => {
    if (!hasLoadedOlder) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages, hasLoadedOlder]);

  const handleToggleAi = (group: Group) => {
    toggleAiMutation.mutate({
      groupId: group.id,
      aiEnabled: !group.aiEnabled,
    });
  };

  const handleRequestSuggestion = () => {
    if (!selectedGroup) return;
    suggestMutation.mutate();
  };

  const handleSendMessage = () => {
    if (!selectedGroup || !messageText.trim()) return;

    sendMessageMutation.mutate({
      groupId: selectedGroup.id,
      message: messageText.trim(),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (attachedFile) {
        handleSendMedia();
      } else {
        handleSendMessage();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validDocTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];

    if (![...validImageTypes, ...validDocTypes, ...validAudioTypes].includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Envie imagens (JPG, PNG, GIF, WebP), documentos (PDF, DOC, DOCX) ou áudio (MP3, WAV, OGG, M4A)",
        variant: "destructive",
      });
      return;
    }

    // Limitar tamanho: 10MB para imagens/documentos, 16MB para áudio
    const maxSize = validAudioTypes.includes(file.type) ? 16 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: `O arquivo deve ter no máximo ${maxSize / 1024 / 1024}MB`,
        variant: "destructive",
      });
      return;
    }

    setAttachedFile(file);

    // Criar preview para imagens
    if (validImageTypes.includes(file.type)) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    setFilePreview(null);
    setCaption("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendMedia = async () => {
    if (!selectedGroup || !attachedFile) return;

    try {
      // Converter arquivo para base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]; // Remove "data:image/png;base64," prefix
        
        // Determinar tipo de mídia
        let mediaType: 'image' | 'document' | 'audio' = 'document';
        if (attachedFile.type.startsWith('image/')) {
          mediaType = 'image';
        } else if (attachedFile.type.startsWith('audio/')) {
          mediaType = 'audio';
        }

        sendMediaMutation.mutate({
          groupId: selectedGroup.id,
          mediaBase64: base64,
          mediaType,
          caption: caption || undefined,
          fileName: attachedFile.name,
        });
      };
      reader.readAsDataURL(attachedFile);
    } catch (error) {
      console.error("Error converting file to base64:", error);
      toast({
        title: "Erro ao processar arquivo",
        description: "Não foi possível processar o arquivo selecionado",
        variant: "destructive",
      });
    }
  };

  const filteredGroups = groups.filter(group => {
    if (aiFilter === "enabled" && !group.aiEnabled) return false;
    if (aiFilter === "disabled" && group.aiEnabled) return false;
    if (search && !group.name?.toLowerCase().includes(search.toLowerCase()) && 
        !group.groupId?.includes(search)) return false;
    return true;
  });

  return (
    <div className="h-full flex gap-4">
      {/* Lista de Grupos */}
      <Card className="w-80 flex flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle>Grupos WhatsApp</CardTitle>
          <CardDescription>Gerenciar IA em grupos</CardDescription>
          
          {/* Busca */}
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar grupos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-search-groups"
            />
          </div>

          {/* Filtros */}
          <Tabs value={aiFilter} onValueChange={setAiFilter} className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" data-testid="filter-all">Todos</TabsTrigger>
              <TabsTrigger value="enabled" data-testid="filter-enabled">IA Ativa</TabsTrigger>
              <TabsTrigger value="disabled" data-testid="filter-disabled">IA Inativa</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <ScrollArea className="flex-1 min-h-0">
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-4">Carregando...</div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">Nenhum grupo encontrado</div>
            ) : (
              filteredGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full text-left p-3 rounded-md border transition-colors hover-elevate ${
                    selectedGroup?.id === group.id ? "bg-accent" : ""
                  }`}
                  data-testid={`group-item-${group.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{group.name}</span>
                    </div>
                    <Badge 
                      variant={group.aiEnabled ? "default" : "secondary"}
                      className="ml-2 flex-shrink-0"
                      data-testid={`badge-ai-${group.id}`}
                    >
                      {group.aiEnabled ? "IA ON" : "IA OFF"}
                    </Badge>
                  </div>
                  {group.lastMessage && (
                    <div className="mt-1 text-sm text-muted-foreground truncate">
                      {group.lastMessage}
                    </div>
                  )}
                  {group.lastMessageTime && (
                    <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(group.lastMessageTime), "dd/MM/yyyy HH:mm")}
                    </div>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Detalhes do Grupo */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!selectedGroup ? (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Selecione um grupo para ver os detalhes</p>
            </div>
          </CardContent>
        ) : (
          <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
            <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0 gap-0">
              <div className="px-6 pt-6 pb-0">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chat" data-testid="tab-chat">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="info" data-testid="tab-info">
                    <Users className="h-4 w-4 mr-2" />
                    Informações
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Aba Chat */}
              <TabsContent value="chat" className="flex-1 flex flex-col mt-0 min-h-0 overflow-hidden data-[state=inactive]:hidden data-[state=active]:flex">
                {/* Área de mensagens com scroll */}
                <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
                  <div className="space-y-3 py-4 px-6">
                    {!conversationData ? (
                      <div className="text-center text-muted-foreground py-8">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
                        <p className="text-sm">Carregando mensagens...</p>
                      </div>
                    ) : allMessages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma mensagem ainda</p>
                        <p className="text-sm mt-1">Envie a primeira mensagem para o grupo</p>
                      </div>
                    ) : (
                      <>
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
                                "Carregar mensagens anteriores"
                              )}
                            </Button>
                          </div>
                        )}
                        
                        {allMessages.map((msg: Message) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                            data-testid={`message-${msg.id}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg p-3 overflow-hidden ${
                                msg.role === 'user'
                                  ? 'bg-muted'
                                  : 'bg-primary text-primary-foreground'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {msg.role === 'user' ? (
                                  <UserIcon className="h-3 w-3" />
                                ) : (
                                  <Bot className="h-3 w-3" />
                                )}
                                <span className="text-xs font-medium">
                                  {msg.role === 'user' ? 'Cliente' : msg.sendBy === 'supervisor' ? 'Você' : 'IA'}
                                </span>
                                <span className="text-xs opacity-70">
                                  {format(new Date(msg.timestamp), "HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              {msg.content && (
                                <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</p>
                              )}
                              
                              {/* Renderizar imagem se presente */}
                              {msg.imageBase64 && (
                                <div className="mt-2">
                                  <img 
                                    src={`data:image/jpeg;base64,${msg.imageBase64}`} 
                                    alt="Imagem enviada" 
                                    className="max-w-full rounded-lg max-h-96 object-contain"
                                  />
                                </div>
                              )}
                              
                              {/* Renderizar documento PDF se presente */}
                              {msg.pdfBase64 && (
                                <div className="mt-2 flex items-center gap-2 p-2 bg-muted/50 rounded">
                                  <FileText className="h-5 w-5" />
                                  <span className="text-xs">{msg.pdfName || 'documento.pdf'}</span>
                                </div>
                              )}
                              
                              {/* Renderizar áudio se presente */}
                              {msg.audioBase64 && (
                                <div className="mt-2">
                                  <audio controls className="max-w-full">
                                    <source src={`data:audio/mpeg;base64,${msg.audioBase64}`} type="audio/mpeg" />
                                    Seu navegador não suporta o elemento de áudio.
                                  </audio>
                                </div>
                              )}
                              
                              {msg.functionCall && (
                                <Badge 
                                  variant="outline" 
                                  className={`mt-2 text-xs ${
                                    msg.functionCall.status === "completed" 
                                      ? "bg-chart-2/10 text-chart-2" 
                                      : msg.functionCall.status === "failed"
                                      ? "bg-destructive/10 text-destructive"
                                      : "bg-chart-3/10 text-chart-3"
                                  }`}
                                >
                                  {functionIcons[msg.functionCall.name] || "⚙️"} {msg.functionCall.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>
                </ScrollArea>

                {/* Campo de envio fixo no rodapé */}
                <div className="border-t p-4 space-y-3">
                {!aiSuggestion && allMessages.length > 0 && (
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

                {/* File attachment preview */}
                {attachedFile && (
                  <div className="border rounded-lg p-3 bg-muted/50">
                    <div className="flex items-start gap-3">
                      {/* Preview */}
                      <div className="flex-shrink-0">
                        {filePreview ? (
                          <img src={filePreview} alt="Preview" className="w-16 h-16 rounded object-cover" />
                        ) : attachedFile.type.startsWith('audio/') ? (
                          <div className="w-16 h-16 rounded bg-primary/10 flex items-center justify-center">
                            <Mic className="h-6 w-6 text-primary" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded bg-primary/10 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                        )}
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(attachedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <Input
                          placeholder="Legenda (opcional)..."
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          className="mt-2 h-8"
                          data-testid="input-media-caption"
                        />
                      </div>

                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveFile}
                        className="flex-shrink-0"
                        data-testid="button-remove-attachment"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,audio/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-file-upload"
                  />

                  {/* Attach button */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sendMessageMutation.isPending || sendMediaMutation.isPending}
                    className="flex-shrink-0"
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>

                  <Textarea
                    placeholder={attachedFile ? "Enviar mídia..." : "Escrever mensagem para o grupo..."}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={sendMessageMutation.isPending || sendMediaMutation.isPending}
                    className="resize-none"
                    rows={2}
                    data-testid="input-group-message"
                  />
                  <Button
                    onClick={attachedFile ? handleSendMedia : handleSendMessage}
                    disabled={attachedFile ? sendMediaMutation.isPending : (!messageText.trim() || sendMessageMutation.isPending)}
                    size="icon"
                    className="flex-shrink-0"
                    data-testid="button-send-message"
                  >
                    {sendMessageMutation.isPending || sendMediaMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

              {/* Aba Informações */}
              <TabsContent value="info" className="flex-1 flex flex-col -mt-2 min-h-0 overflow-hidden data-[state=inactive]:hidden data-[state=active]:flex">
                <ScrollArea className="flex-1 min-h-0 !pt-0">
                <div className="space-y-6 py-4 px-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Nome do Grupo</Label>
                      <p className="text-lg font-medium mt-1">{selectedGroup.name}</p>
                    </div>

                    <div>
                      <Label className="text-sm text-muted-foreground">ID do WhatsApp</Label>
                      <p className="text-sm font-mono mt-1 bg-muted p-2 rounded">{selectedGroup.groupId}</p>
                    </div>

                    {selectedGroup.evolutionInstance && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Instância Evolution</Label>
                        <p className="text-sm mt-1">{selectedGroup.evolutionInstance}</p>
                      </div>
                    )}

                    <div>
                      <Label className="text-sm text-muted-foreground">Participantes</Label>
                      <p className="text-sm mt-1">{selectedGroup.participantsCount || 0} membros</p>
                    </div>

                    {selectedGroup.lastMessage && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Última Mensagem</Label>
                        <p className="text-sm mt-1 p-2 bg-muted rounded">{selectedGroup.lastMessage}</p>
                        {selectedGroup.lastMessageTime && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(selectedGroup.lastMessageTime), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="ai-toggle" className="text-base font-medium">
                          Inteligência Artificial
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {selectedGroup.aiEnabled 
                            ? "A IA está respondendo mensagens deste grupo" 
                            : "A IA não responderá mensagens deste grupo"}
                        </p>
                      </div>
                      <Switch
                        id="ai-toggle"
                        checked={selectedGroup.aiEnabled}
                        onCheckedChange={() => handleToggleAi(selectedGroup)}
                        disabled={toggleAiMutation.isPending}
                        data-testid={`switch-ai-${selectedGroup.id}`}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <Label className="text-sm font-medium mb-3 block">Estatísticas</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Mensagens recebidas</p>
                        <p className="text-2xl font-bold">-</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Mensagens hoje</p>
                        <p className="text-2xl font-bold">-</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Criado em: {format(new Date(selectedGroup.createdAt), "dd/MM/yyyy 'às' HH:mm")}</p>
                      <p>Última atualização: {format(new Date(selectedGroup.updatedAt), "dd/MM/yyyy 'às' HH:mm")}</p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
