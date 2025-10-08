import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MessageSquare, ExternalLink, Filter } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SatisfactionFeedback, Conversation } from "@shared/schema";

type FeedbackWithConversation = SatisfactionFeedback & { conversation?: Conversation };

export default function Feedbacks() {
  const [, setLocation] = useLocation();
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: feedbacks, isLoading, error } = useQuery<FeedbackWithConversation[]>({
    queryKey: ["/api/satisfaction-feedback"],
    refetchInterval: 10000,
  });

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

  const handleOpenConversation = (conversationId: string) => {
    setLocation(`/conversations?highlight=${conversationId}`);
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6" data-testid="page-feedbacks">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-feedbacks">Feedbacks NPS</h1>
        <p className="text-muted-foreground">Visualize e analise as avaliações dos clientes</p>
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
                  className="hover-elevate cursor-pointer transition-all"
                  onClick={() => handleOpenConversation(feedback.conversationId)}
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
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium" data-testid="text-client-name">
                            {feedback.clientName || "Cliente"}
                          </p>
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

                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenConversation(feedback.conversationId);
                        }}
                        data-testid="button-open-conversation"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
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
    </div>
  );
}
