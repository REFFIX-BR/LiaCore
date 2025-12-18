import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MessageSquare, ExternalLink, Filter, X, User, Bot, ClipboardCheck, AlertCircle, Calendar, Headphones } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SatisfactionFeedback, Conversation, Message } from "@shared/schema";

type FeedbackWithConversation = SatisfactionFeedback & { conversation?: Conversation; agentName?: string };
type PeriodFilter = 'daily' | 'weekly' | 'monthly';

export default function Feedbacks() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("daily");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showHandlingDialog, setShowHandlingDialog] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackWithConversation | null>(null);
  const [handlingScore, setHandlingScore] = useState<number>(3);
  const [handlingStatus, setHandlingStatus] = useState<string>("pending");
  const [handlingNotes, setHandlingNotes] = useState<string>("");

  const { data: feedbacks, isLoading, error } = useQuery<FeedbackWithConversation[]>({
    queryKey: ["/api/satisfaction-feedback", periodFilter],
    queryFn: async () => {
      const response = await fetch(`/api/satisfaction-feedback?period=${periodFilter}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch feedbacks');
      return response.json();
    },
    refetchInterval: 10000,
  });

  const { 
    data: conversationData, 
    isLoading: isLoadingConversation,
    isError: isConversationError,
    error: conversationError
  } = useQuery<{ conversation: Conversation; messages: Message[] }>({
    queryKey: ["/api/monitor/conversations", selectedConversationId],
    enabled: !!selectedConversationId,
  });

  const handlingMutation = useMutation({
    mutationFn: ({ id, handlingScore, handlingStatus, handlingNotes }: any) =>
      apiRequest(`/api/satisfaction-feedback/${id}/handling`, 'PUT', {
        handlingScore,
        handlingStatus,
        handlingNotes
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/satisfaction-feedback'] });
      toast({
        title: 'Tratativa Registrada',
        description: 'As informações da tratativa foram salvas com sucesso.',
      });
      setShowHandlingDialog(false);
      setSelectedFeedback(null);
      setHandlingNotes("");
      setHandlingScore(3);
      setHandlingStatus("pending");
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao Registrar',
        description: 'Não foi possível salvar a tratativa. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const handleOpenHandlingDialog = (feedback: FeedbackWithConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFeedback(feedback);
    setHandlingScore(feedback.handlingScore || 3);
    setHandlingStatus(feedback.handlingStatus || "pending");
    setHandlingNotes(feedback.handlingNotes || "");
    setShowHandlingDialog(true);
  };

  const handleSubmitHandling = () => {
    if (!selectedFeedback) return;
    
    handlingMutation.mutate({
      id: selectedFeedback.id,
      handlingScore,
      handlingStatus,
      handlingNotes
    });
  };

  const getHandlingStatusBadge = (status: string | null) => {
    if (!status || status === "pending") {
      return <Badge variant="outline" className="text-orange-600 border-orange-600">Pendente</Badge>;
    }
    if (status === "in_progress") {
      return <Badge variant="outline" className="text-blue-600 border-blue-600">Em Andamento</Badge>;
    }
    return <Badge variant="outline" className="text-green-600 border-green-600">Resolvido</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-feedbacks">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando feedbacks NPS...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="error-feedbacks">
        <div className="text-center">
          <p className="text-destructive mb-4">Erro ao carregar feedbacks</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const filteredFeedbacks = filterCategory === "all" 
    ? feedbacks 
    : feedbacks?.filter(f => f.category === filterCategory);

  const detractorsCount = feedbacks?.filter(f => f.category === "detractor").length || 0;
  const neutralsCount = feedbacks?.filter(f => f.category === "neutral").length || 0;
  const promotersCount = feedbacks?.filter(f => f.category === "promoter").length || 0;

  const getCategoryBadgeVariant = (category: string) => {
    if (category === "promoter") return "default";
    if (category === "neutral") return "secondary";
    return "destructive";
  };

  const getCategoryLabel = (category: string) => {
    if (category === "promoter") return "Promotor";
    if (category === "neutral") return "Neutro";
    return "Detrator";
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) return "text-green-600 dark:text-green-400";
    if (score >= 7) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const assistantNames: Record<string, string> = {
    suporte: "Suporte",
    comercial: "Comercial",
    financeiro: "Financeiro",
    apresentacao: "Apresentação",
    ouvidoria: "Ouvidoria",
    cancelamento: "Cancelamento",
  };

  const handleOpenConversation = (feedback: FeedbackWithConversation) => {
    if (!feedback.conversation) {
      return; // Não abre se não há conversa associada
    }
    setSelectedConversationId(feedback.conversationId);
  };

  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setSelectedConversationId(null);
    }
  };

  const getPeriodLabel = (period: PeriodFilter) => {
    switch (period) {
      case 'daily': return 'Hoje';
      case 'weekly': return 'Últimos 7 dias';
      case 'monthly': return 'Este mês';
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6" data-testid="page-feedbacks">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="heading-feedbacks">Feedbacks NPS</h1>
          <p className="text-muted-foreground">Visualize e analise as avaliações dos clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            <Button
              variant={periodFilter === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodFilter('daily')}
              data-testid="filter-daily"
            >
              Hoje
            </Button>
            <Button
              variant={periodFilter === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodFilter('weekly')}
              data-testid="filter-weekly"
            >
              Semanal
            </Button>
            <Button
              variant={periodFilter === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodFilter('monthly')}
              data-testid="filter-monthly"
            >
              Mensal
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-detractors">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Detratores</CardTitle>
            <Star className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive" data-testid="text-detractors">
              {detractorsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Notas 0-6</p>
          </CardContent>
        </Card>

        <Card data-testid="card-neutrals">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Neutros</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-neutrals">
              {neutralsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Notas 7-8</p>
          </CardContent>
        </Card>

        <Card data-testid="card-promoters">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promotores</CardTitle>
            <Star className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary" data-testid="text-promoters">
              {promotersCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Notas 9-10</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filterCategory} onValueChange={setFilterCategory} data-testid="tabs-filter">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">Todos ({feedbacks?.length || 0})</TabsTrigger>
          <TabsTrigger value="detractor" data-testid="tab-detractors">Detratores ({detractorsCount})</TabsTrigger>
          <TabsTrigger value="neutral" data-testid="tab-neutrals">Neutros ({neutralsCount})</TabsTrigger>
          <TabsTrigger value="promoter" data-testid="tab-promoters">Promotores ({promotersCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={filterCategory} className="mt-6">
          <div className="space-y-3">
            {filteredFeedbacks && filteredFeedbacks.length > 0 ? (
              filteredFeedbacks.map((feedback) => (
                <Card 
                  key={feedback.id} 
                  className={`transition-all ${feedback.conversation ? 'hover-elevate cursor-pointer' : 'opacity-60'}`}
                  onClick={() => handleOpenConversation(feedback)}
                  data-testid={`feedback-card-${feedback.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className={`text-2xl font-bold ${getScoreColor(feedback.npsScore)}`} data-testid="text-score">
                            {feedback.npsScore}
                          </div>
                          <Badge variant={getCategoryBadgeVariant(feedback.category)} data-testid="badge-category">
                            {getCategoryLabel(feedback.category)}
                          </Badge>
                          <Badge variant="outline" data-testid="badge-assistant">
                            {assistantNames[feedback.assistantType] || feedback.assistantType}
                          </Badge>
                          {getHandlingStatusBadge(feedback.handlingStatus)}
                          {feedback.category === "detractor" && (!feedback.handlingStatus || feedback.handlingStatus === "pending") && (
                            <Badge variant="destructive" className="gap-1" data-testid="badge-needs-handling">
                              <AlertCircle className="h-3 w-3" />
                              Precisa Tratativa
                            </Badge>
                          )}
                          {!feedback.conversation && (
                            <Badge variant="secondary" data-testid="badge-no-conversation">
                              Conversa não disponível
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium" data-testid="text-client-name">
                            {feedback.clientName || "Cliente"}
                          </p>
                          {feedback.conversation?.chatId && (
                            <p className="text-xs text-muted-foreground" data-testid="text-contact">
                              {feedback.conversation.chatId.replace('whatsapp_', '')}
                            </p>
                          )}
                          {feedback.agentName && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="text-agent-name">
                              <Headphones className="h-3 w-3" />
                              <span>Atendido por: <span className="font-medium">{feedback.agentName}</span></span>
                            </div>
                          )}
                          {feedback.comment && (
                            <p className="text-sm text-muted-foreground" data-testid="text-comment">
                              "{feedback.comment}"
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground" data-testid="text-date">
                            {feedback.createdAt && format(new Date(feedback.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => handleOpenHandlingDialog(feedback, e)}
                          data-testid="button-add-handling"
                          title="Registrar Tratativa"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          disabled={!feedback.conversation}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenConversation(feedback);
                          }}
                          data-testid="button-open-conversation"
                          title="Ver Conversa"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {feedback.conversation && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          <span data-testid="text-conversation-preview">
                            {feedback.conversation.lastMessage?.substring(0, 100)}
                            {(feedback.conversation.lastMessage?.length || 0) > 100 ? "..." : ""}
                          </span>
                        </div>
                      </div>
                    )}

                    {feedback.handlingNotes && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium">Notas da Tratativa:</span>
                            {feedback.handlingScore && (
                              <div className="flex gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className={`h-3 w-3 ${i < feedback.handlingScore! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground" data-testid="text-handling-notes">
                            {feedback.handlingNotes}
                          </p>
                          {feedback.handledAt && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(feedback.handledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground" data-testid="text-no-feedbacks">
                    Nenhum feedback nesta categoria
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedConversationId} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Histórico da Conversa</span>
              {conversationData?.conversation && (
                <Badge variant="outline">
                  {assistantNames[conversationData.conversation.assistantType] || conversationData.conversation.assistantType}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Visualize todas as mensagens trocadas nesta conversa
            </DialogDescription>
          </DialogHeader>
          
          {isConversationError ? (
            <div className="flex flex-col items-center justify-center h-40 text-center p-4">
              <p className="text-destructive mb-2">Erro ao carregar conversa</p>
              <p className="text-sm text-muted-foreground mb-4">
                {(conversationError as Error)?.message || "Não foi possível carregar o histórico da conversa"}
              </p>
              <Button 
                variant="outline" 
                onClick={() => handleCloseDialog(false)}
                data-testid="button-close-error-dialog"
              >
                Fechar
              </Button>
            </div>
          ) : isLoadingConversation ? (
            <div className="flex flex-col items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            </div>
          ) : conversationData ? (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-4">
                {conversationData.messages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    data-testid={`message-${index}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={`rounded-lg p-3 max-w-[70%] ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.timestamp && (
                        <p className="text-xs mt-1 opacity-70">
                          {format(new Date(message.timestamp), "HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showHandlingDialog} onOpenChange={setShowHandlingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Tratativa</DialogTitle>
            <DialogDescription>
              Adicione informações sobre como este feedback foi tratado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="handling-status">Status da Tratativa</Label>
              <Select value={handlingStatus} onValueChange={setHandlingStatus}>
                <SelectTrigger id="handling-status" data-testid="select-handling-status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="handling-score">Nota da Tratativa (1-5 estrelas)</Label>
              <div className="flex gap-2 items-center">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setHandlingScore(score)}
                    className="focus:outline-none"
                    data-testid={`star-${score}`}
                  >
                    <Star 
                      className={`h-8 w-8 cursor-pointer transition-colors ${
                        score <= handlingScore 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : 'text-gray-300 hover:text-yellow-200'
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">{handlingScore}/5</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="handling-notes">Observações da Tratativa</Label>
              <Textarea
                id="handling-notes"
                placeholder="Descreva como o cliente foi tratado, quais ações foram tomadas, resultados obtidos..."
                value={handlingNotes}
                onChange={(e) => setHandlingNotes(e.target.value)}
                rows={5}
                data-testid="textarea-handling-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowHandlingDialog(false)}
              disabled={handlingMutation.isPending}
              data-testid="button-cancel-handling"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitHandling}
              disabled={handlingMutation.isPending}
              data-testid="button-submit-handling"
            >
              {handlingMutation.isPending ? 'Salvando...' : 'Salvar Tratativa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
