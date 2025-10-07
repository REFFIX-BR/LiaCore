import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConversationList } from "@/components/ConversationList";
import { ChatMessage, type Message } from "@/components/ChatMessage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, CheckCircle2, Edit3, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { NPSFeedbackDialog } from "@/components/NPSFeedbackDialog";
import { useToast } from "@/hooks/use-toast";

interface Conversation {
  id: string;
  chatId: string;
  clientName: string;
  assistantType: string;
  lastMessage: string | null;
  lastMessageTime: Date;
  transferredToHuman: boolean;
  transferReason: string | null;
  transferredAt: Date | null;
  status: string;
}

export default function Conversations() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [isEditingAI, setIsEditingAI] = useState(false);
  const [showNPSDialog, setShowNPSDialog] = useState(false);
  const { toast } = useToast();

  // Query conversas transferidas
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations/transferred"],
    refetchInterval: 5000,
  });

  // Filtrar apenas conversas ATIVAS (conversas resolvidas devem aparecer só em "Finalizadas")
  const activeConversations = conversations.filter(conv => conv.status === 'active');

  // Query mensagens da conversa ativa
  const { data: conversationData } = useQuery<{ messages: Message[] }>({
    queryKey: ["/api/monitor/conversations", activeId],
    enabled: !!activeId,
    refetchInterval: 3000,
  });
  
  const messages = conversationData?.messages || [];

  // Mutation para pedir sugestão da IA
  const suggestMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await apiRequest("POST", `/api/conversations/${conversationId}/suggest-response`, { 
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
      
      const response = await apiRequest("POST", `/api/conversations/${activeId}/send-message`, {
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

  // Mutation para resolver conversa
  const resolveMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await apiRequest("POST", "/api/supervisor/resolve", { conversationId });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/transferred"] });
      setActiveId(null);
      toast({
        title: "Conversa finalizada!",
        description: "Atendimento encerrado com sucesso.",
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
      // Mostrar dialog NPS antes de resolver
      setShowNPSDialog(true);
    }
  };

  const handleNPSSubmit = async (score: number, comment: string) => {
    if (activeId && activeConversation) {
      try {
        // Enviar feedback
        await apiRequest("POST", "/api/feedback", {
          conversationId: activeId,
          assistantType: activeConversation.assistantType,
          npsScore: score,
          comment: comment || undefined,
          clientName: activeConversation.clientName,
        });
        
        // Marcar como resolvido
        resolveMutation.mutate(activeId);
      } catch (error) {
        throw error;
      }
    }
  };

  const activeConversation = activeConversations.find(c => c.id === activeId);
  const showAISuggestion = aiSuggestion && !isEditingAI;

  if (conversationsLoading) {
    return <div className="flex items-center justify-center h-full">Carregando...</div>;
  }

  if (activeConversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h3 className="font-semibold text-lg">Nenhuma conversa ativa transferida</h3>
          <p className="text-sm text-muted-foreground">
            As conversas encaminhadas pela IA ou supervisor aparecerão aqui
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Lista de conversas transferidas */}
      <Card className="w-80 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Conversas Transferidas</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {activeConversations.length} {activeConversations.length === 1 ? 'conversa ativa' : 'conversas ativas'}
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {activeConversations.map((conv) => (
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
              </div>
            </div>
            <Button
              onClick={handleResolve}
              variant="default"
              size="sm"
              data-testid="button-resolve"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Finalizar
            </Button>
          </div>

          {/* Mensagens */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
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

      {/* NPS Feedback Dialog */}
      {activeConversation && (
        <NPSFeedbackDialog
          open={showNPSDialog}
          onClose={() => {
            setShowNPSDialog(false);
            // Se fechar sem feedback, marcar como resolvido mesmo assim
            if (activeId) {
              resolveMutation.mutate(activeId);
            }
          }}
          conversationId={activeId!}
          assistantType={activeConversation.assistantType}
          clientName={activeConversation.clientName}
          onSubmit={handleNPSSubmit}
          isSubmitting={false}
        />
      )}
    </div>
  );
}
