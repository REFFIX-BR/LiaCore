import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChatMessage, type Message } from "@/components/ChatMessage";
import { ChatHeader } from "@/components/ChatHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, CheckCircle2, Edit3, Loader2, UserPlus, ChevronDown, X, Image as ImageIcon } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

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

interface ChatPanelProps {
  conversation: Conversation;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function ChatPanel({ conversation, onClose, showCloseButton = false }: ChatPanelProps) {
  const [messageContent, setMessageContent] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [isEditingAI, setIsEditingAI] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoadedOlder, setHasLoadedOlder] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; preview: string } | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, isAgent } = useAuth();

  // Query mensagens da conversa
  const { data: conversationData } = useQuery<{ messages: Message[]; hasMore: boolean }>({
    queryKey: ["/api/monitor/conversations", conversation.id],
    enabled: !!conversation.id,
    refetchInterval: 3000,
  });

  // Resetar mensagens quando conversa muda
  useEffect(() => {
    setAllMessages([]);
    setHasMore(false);
    setHasLoadedOlder(false);
    setAiSuggestion(null);
    setSuggestionId(null);
    setIsEditingAI(false);
    setMessageContent("");
    setSelectedImage(null);
  }, [conversation.id]);

  // Função para converter imagem para base64
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem válida (JPEG, PNG, WebP, GIF)",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (máx 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 20MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage({
        base64: base64.split(',')[1], // Remove o prefixo "data:image/...;base64,"
        preview: base64,
      });
      toast({
        title: "Imagem carregada",
        description: "Imagem pronta para análise com IA",
      });
    };
    reader.readAsDataURL(file);
  };

  // Atualizar mensagens quando dados mudam
  useEffect(() => {
    if (!conversationData) return;

    setAllMessages(prev => {
      if (prev.length === 0) {
        return conversationData.messages;
      }

      const existingIds = new Set(prev.map(m => m.id));
      const newMessages = conversationData.messages.filter(m => !existingIds.has(m.id));
      
      if (newMessages.length === 0) {
        return prev;
      }

      return [...prev, ...newMessages];
    });
    
    if (!hasLoadedOlder) {
      setHasMore(conversationData.hasMore);
    }
  }, [conversationData, hasLoadedOlder]);

  // Scroll automático
  useEffect(() => {
    if (!messagesEndRef.current) return;

    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isNearBottom || allMessages.length <= 15) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages]);

  // Carregar mensagens anteriores
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    
    setLoadingMore(true);
    setHasLoadedOlder(true);
    
    try {
      const oldestMessageId = allMessages[0]?.id;
      if (!oldestMessageId) {
        setHasMore(false);
        return;
      }
      
      const response = await fetch(`/api/monitor/conversations/${conversation.id}?before=${oldestMessageId}&limit=15`);
      const data = await response.json();
      
      setHasMore(data.hasMore);
      
      if (data.messages && data.messages.length > 0) {
        setAllMessages(prev => [...data.messages, ...prev]);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [conversation.id, hasMore, loadingMore, allMessages]);

  // Sugestão da IA
  const suggestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/conversations/${conversation.id}/suggest-response`, 
        "POST",
        { supervisorName: user?.fullName }
      );
      return response.json();
    },
    onSuccess: (data) => {
      setAiSuggestion(data.suggestedResponse);
      setSuggestionId(data.suggestionId);
      setMessageContent(data.suggestedResponse);
      toast({
        title: "Sugestão gerada!",
        description: "Você pode editar ou aprovar a sugestão",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao gerar sugestão",
        variant: "destructive",
      });
    },
  });

  // Enviar mensagem
  const sendMutation = useMutation({
    mutationFn: async ({ content, suggestionId, wasEdited, imageBase64 }: { content: string; suggestionId?: string | null; wasEdited?: boolean; imageBase64?: string }) => {
      const response = await apiRequest(
        `/api/conversations/${conversation.id}/send-message`, 
        "POST",
        { 
          content, 
          suggestionId,
          wasEdited,
          supervisorName: user?.fullName || 'Atendente',
          imageBase64
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      setMessageContent("");
      setAiSuggestion(null);
      setSuggestionId(null);
      setIsEditingAI(false);
      setSelectedImage(null);
      if (data.imageAnalyzed) {
        toast({
          title: "Mensagem enviada!",
          description: "Imagem analisada pela IA com sucesso",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/assigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/transferred"] });
    },
    onError: () => {
      toast({
        title: "Erro ao enviar mensagem",
        variant: "destructive",
      });
    },
  });

  // Resolver conversa
  const resolveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/conversations/${conversation.id}/resolve`, 
        "POST",
        { resolvedBy: user?.fullName }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Conversa finalizada!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/assigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/transferred"] });
      if (onClose) onClose();
    },
  });

  // Auto-atribuir
  const assignMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/conversations/${conversation.id}/assign`, 
        "POST",
        {} // Body vazio para auto-atribuição (backend usa currentUser.userId)
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Conversa atribuída!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/assigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/transferred"] });
    },
  });

  const showAISuggestion = aiSuggestion && !isEditingAI;

  const handleRequestSuggestion = () => {
    suggestMutation.mutate();
  };

  const handleApprove = () => {
    if (aiSuggestion) {
      sendMutation.mutate({ 
        content: aiSuggestion, 
        suggestionId, 
        wasEdited: false,
        imageBase64: selectedImage?.base64
      });
    }
  };

  const handleEditAndSend = () => {
    if (messageContent.trim()) {
      sendMutation.mutate({ 
        content: messageContent, 
        suggestionId, 
        wasEdited: true,
        imageBase64: selectedImage?.base64
      });
    }
  };

  const handleManualSend = () => {
    if (messageContent.trim() || selectedImage) {
      sendMutation.mutate({ 
        content: messageContent || '', 
        suggestionId: null,
        imageBase64: selectedImage?.base64
      });
    }
  };

  const handleResolve = () => {
    resolveMutation.mutate();
  };

  const handleSelfAssign = () => {
    assignMutation.mutate();
  };

  return (
    <Card className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b">
        <div className="flex-1">
          <ChatHeader
            clientName={conversation.clientName}
            clientDocument={conversation.clientDocument}
            assistantType={conversation.assistantType}
            status={conversation.status}
          />
        </div>
        <div className="flex items-center gap-2 px-3">
          {!conversation.assignedTo && isAgent && (
            <Button
              onClick={handleSelfAssign}
              variant="outline"
              size="sm"
              disabled={assignMutation.isPending}
              data-testid="button-self-assign"
            >
              {assignMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            onClick={handleResolve}
            variant="default"
            size="sm"
            disabled={isAgent && conversation.assignedTo !== user?.id}
            data-testid="button-resolve"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          {showCloseButton && onClose && (
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              data-testid="button-close-chat"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
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
          {allMessages.map((msg) => (
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
                  onClick={() => setIsEditingAI(true)}
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

        {/* Image Preview */}
        {selectedImage && (
          <div className="relative">
            <img 
              src={selectedImage.preview} 
              alt="Preview" 
              className="max-h-32 rounded-md border"
            />
            <Button
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={() => setSelectedImage(null)}
              data-testid="button-remove-image"
            >
              <X className="h-3 w-3" />
            </Button>
            <Badge className="absolute bottom-2 left-2" variant="secondary">
              Imagem será analisada pela IA
            </Badge>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex flex-col gap-2 flex-1">
            <Textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if ((messageContent.trim() || selectedImage) && !sendMutation.isPending) {
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
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              data-testid="input-image"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={sendMutation.isPending}
              data-testid="button-upload-image"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button
              onClick={isEditingAI ? handleEditAndSend : handleManualSend}
              disabled={(!messageContent.trim() && !selectedImage) || sendMutation.isPending}
              data-testid="button-send"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {isEditingAI && (
          <p className="text-xs text-muted-foreground">
            ✨ Editando sugestão da IA - suas alterações serão usadas para aprendizado
          </p>
        )}
      </div>
    </Card>
  );
}
