import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, MessageSquare, Star, UserCheck, UserX, Users, BarChart3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Metrics() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["/api/metrics/nps"],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-metrics">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando métricas de satisfação...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="error-metrics">
        <div className="text-center">
          <p className="text-destructive mb-4">Erro ao carregar métricas de NPS</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  const overview = (metrics as any)?.overview || {};
  const byAssistant = (metrics as any)?.byAssistant || [];
  const timeline = (metrics as any)?.timeline || [];
  const comments = (metrics as any)?.comments || [];

  // Cor do NPS baseado no score
  const getNPSColor = (score: number) => {
    if (score >= 50) return "text-green-600 dark:text-green-400";
    if (score >= 0) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getNPSBadgeVariant = (category: string) => {
    if (category === "promoter") return "default";
    if (category === "neutral") return "secondary";
    return "destructive";
  };

  const assistantNames: Record<string, string> = {
    suporte: "Suporte",
    comercial: "Comercial",
    financeiro: "Financeiro",
    apresentacao: "Apresentação",
    ouvidoria: "Ouvidoria",
    cancelamento: "Cancelamento",
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6" data-testid="page-metrics">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-metrics">Métricas de Satisfação</h1>
        <p className="text-muted-foreground">Sistema de NPS e feedback dos clientes</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-nps-score">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getNPSColor(overview.npsScore || 0)}`} data-testid="text-nps-score">
              {overview.npsScore || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.npsScore >= 50 && "Excelente"}
              {overview.npsScore >= 0 && overview.npsScore < 50 && "Razoável"}
              {overview.npsScore < 0 && "Crítico"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-score">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score Médio</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-avg-score">
              {overview.avgScore || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">De 0 a 10</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-feedback">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Feedbacks</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-feedback">
              {overview.totalFeedback || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Taxa de resposta: {overview.responseRate || 0}%
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-resolved">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas Resolvidas</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-resolved">
              {overview.resolvedConversations || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.totalFeedback || 0} com feedback
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution */}
      <Card data-testid="card-distribution">
        <CardHeader>
          <CardTitle>Distribuição de Satisfação</CardTitle>
          <CardDescription>Classificação dos clientes por NPS</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium">Promotores (9-10)</span>
              </div>
              <span className="text-sm font-bold" data-testid="text-promoters">
                {overview.promoters || 0} ({overview.totalFeedback > 0 ? Math.round((overview.promoters / overview.totalFeedback) * 100) : 0}%)
              </span>
            </div>
            <Progress value={overview.totalFeedback > 0 ? (overview.promoters / overview.totalFeedback) * 100 : 0} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium">Neutros (7-8)</span>
              </div>
              <span className="text-sm font-bold" data-testid="text-neutrals">
                {overview.neutrals || 0} ({overview.totalFeedback > 0 ? Math.round((overview.neutrals / overview.totalFeedback) * 100) : 0}%)
              </span>
            </div>
            <Progress value={overview.totalFeedback > 0 ? (overview.neutrals / overview.totalFeedback) * 100 : 0} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium">Detratores (0-6)</span>
              </div>
              <span className="text-sm font-bold" data-testid="text-detractors">
                {overview.detractors || 0} ({overview.totalFeedback > 0 ? Math.round((overview.detractors / overview.totalFeedback) * 100) : 0}%)
              </span>
            </div>
            <Progress value={overview.totalFeedback > 0 ? (overview.detractors / overview.totalFeedback) * 100 : 0} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="assistants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assistants" data-testid="tab-assistants">Por Assistente</TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">Evolução</TabsTrigger>
          <TabsTrigger value="comments" data-testid="tab-comments">Comentários</TabsTrigger>
        </TabsList>

        <TabsContent value="assistants" className="space-y-4">
          {byAssistant.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Nenhum feedback por assistente disponível</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {byAssistant.map((assistant: any) => (
                <Card key={assistant.assistantType} data-testid={`card-assistant-${assistant.assistantType}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {assistantNames[assistant.assistantType] || assistant.assistantType}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">NPS Score</span>
                      <span className={`text-lg font-bold ${getNPSColor(assistant.npsScore)}`} data-testid={`text-nps-${assistant.assistantType}`}>
                        {assistant.npsScore}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Score Médio</span>
                      <span className="text-sm font-medium" data-testid={`text-avg-${assistant.assistantType}`}>
                        {assistant.avgScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Feedbacks</span>
                      <span className="text-sm font-medium" data-testid={`text-feedback-${assistant.assistantType}`}>
                        {assistant.totalFeedback}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="default" className="text-xs">
                        {assistant.promoters} promotores
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {assistant.neutrals} neutros
                      </Badge>
                      <Badge variant="destructive" className="text-xs">
                        {assistant.detractors} detratores
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          {timeline.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Nenhum dado de evolução disponível (últimos 30 dias)</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Evolução do Score Médio</CardTitle>
                <CardDescription>Score médio diário nos últimos 30 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {timeline.map((day: any, index: number) => (
                    <div key={index} className="flex items-center gap-4" data-testid={`timeline-${index}`}>
                      <span className="text-sm text-muted-foreground w-24">{day.date}</span>
                      <div className="flex-1">
                        <Progress value={(day.avgScore / 10) * 100} className="h-2" />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{day.avgScore.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground w-16">({day.count} votos)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comments" className="space-y-4">
          {comments.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Nenhum comentário disponível</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {comments.map((comment: any, index: number) => (
                <Card key={index} data-testid={`comment-${index}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted flex-shrink-0">
                        <span className="text-lg font-bold">{comment.score}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant={getNPSBadgeVariant(comment.category)} className="text-xs">
                            {comment.category === "promoter" && "Promotor"}
                            {comment.category === "neutral" && "Neutro"}
                            {comment.category === "detractor" && "Detrator"}
                          </Badge>
                          <span className="text-sm font-medium">{assistantNames[comment.assistantType]}</span>
                          <span className="text-xs text-muted-foreground">{comment.date}</span>
                        </div>
                        <p className="text-sm break-words">{comment.comment}</p>
                        {comment.clientName && (
                          <p className="text-xs text-muted-foreground mt-1">— {comment.clientName}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
