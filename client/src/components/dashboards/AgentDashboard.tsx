import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Inbox, CheckCircle2, Clock, Star, TrendingUp, Calendar, Trophy, Target, Zap, Crown, TrendingDown, AlertCircle, Calculator, Info, Flame, Users, Heart, Lightbulb, BarChart3 } from "lucide-react";
import { Line, LineChart, Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AgentInsights {
  badgeProgress: {
    [key: string]: {
      name: string;
      current: number;
      target: number;
      progress: number;
      remaining: number;
      unlocked: boolean;
    };
  };
  teamComparison: {
    volumePercentile: number;
    npsPercentile: number;
    volumeRank: number;
    npsRank: number;
    teamSize: number;
    volumeMessage: string;
    npsMessage: string;
  };
  streakData: {
    currentStreak: number;
    minDailyGoal: number;
    message: string;
  };
  weeklyEvolution: Array<{
    week: string;
    volume: number;
    nps: number;
    startDate: string;
  }>;
  dailyProgress: {
    current: number;
    goal: number;
    progress: number;
    remaining: number;
    completed: boolean;
  };
  tipOfTheDay: {
    category: string;
    title: string;
    tip: string;
    icon: string;
  };
}

interface GamificationScore {
  agentId: string;
  agentName: string;
  totalScore: number;
  totalConversations: number;
  avgNps: number;
  successRate: number;
  avgResponseTime: number;
  volumeScore: number;
  npsScore: number;
  resolutionScore: number;
  timeScore: number;
  ranking?: number;
  badges: {
    type: string;
    earnedAt: string;
    metric: number;
  }[];
}

const BADGE_INFO = {
  solucionador: {
    name: "Solucionador",
    icon: Target,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900",
    description: "Alto NPS + Taxa de Resolução"
  },
  velocista: {
    name: "Velocista",
    icon: Zap,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900",
    description: "Menor Tempo de Resposta"
  },
  campeao_volume: {
    name: "Campeão do Volume",
    icon: Crown,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900",
    description: "Maior Número de Atendimentos"
  }
};

export function AgentDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/agent", period],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/agent?period=${period}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    refetchInterval: 30000, // 30 seconds
  });

  // Buscar dados de gamificação do mês atual
  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const { data: gamificationData, isLoading: isLoadingGamification } = useQuery<GamificationScore[]>({
    queryKey: ["/api/gamification/ranking", currentPeriod],
    queryFn: async () => {
      const params = new URLSearchParams({ period: currentPeriod });
      const res = await fetch(`/api/gamification/ranking?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar ranking");
      return res.json();
    },
    refetchInterval: 60000, // 1 minuto
  });

  // Buscar insights avançados (badges, streak, comparativo, etc)
  const { data: insights } = useQuery<AgentInsights>({
    queryKey: ["/api/dashboard/agent/insights"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/agent/insights", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar insights");
      return res.json();
    },
    refetchInterval: 60000, // 1 minuto
  });

  // Encontrar meus dados no ranking
  const myGamificationScore = gamificationData?.find(score => score.agentId === user?.id);

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Carregando...</div>;
  }

  if (!metrics) {
    return <div className="flex items-center justify-center h-96">Erro ao carregar métricas</div>;
  }

  const periodLabels = {
    today: 'Hoje',
    week: 'Semana',
    month: 'Mês'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Dashboard de Atendimento: {user?.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do seu desempenho e atendimentos atuais
          </p>
        </div>
        
        {/* Filtros de Período */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            {(['today', 'week', 'month'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? "default" : "outline"}
                onClick={() => setPeriod(p)}
                data-testid={`button-period-${p}`}
              >
                {periodLabels[p]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate" data-testid="card-queue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas na Fila</CardTitle>
            <Inbox className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-queue-count">{metrics.conversationsInQueue}</div>
            <p className="text-xs text-muted-foreground">Aguardando sua ação</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-finished">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Finalizadas {period === 'today' ? 'Hoje' : period === 'week' ? 'na Semana' : 'no Mês'}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-finished-count">{metrics.conversationsFinishedToday}</div>
            <p className="text-xs text-muted-foreground">
              {period === 'today' ? 'Seu progresso do dia' : period === 'week' ? 'Últimos 7 dias' : 'Mês corrente desde 01/' + new Date().toLocaleDateString('pt-BR', { month: 'short' })}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-tma">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seu T.M.A.</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-tma">
              {metrics.avgResponseTime > 0 ? `${Math.floor(metrics.avgResponseTime / 60)}m ${metrics.avgResponseTime % 60}s` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">Tempo médio de atendimento</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-nps">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seu NPS Score</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-nps">{metrics.personalNPS}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.personalNPS >= 80 ? 'Excelente' : metrics.personalNPS >= 50 ? 'Bom' : 'Precisa melhorar'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ===== NOVOS INSIGHTS ===== */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Meta Diária */}
          <Card className="hover-elevate" data-testid="card-daily-goal">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meta do Dia</CardTitle>
              <Target className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold" data-testid="text-daily-current">
                  {insights.dailyProgress.current}
                </span>
                <span className="text-lg text-muted-foreground">/ {insights.dailyProgress.goal}</span>
                {insights.dailyProgress.completed && (
                  <Badge variant="default" className="bg-green-600">Meta batida!</Badge>
                )}
              </div>
              <Progress value={insights.dailyProgress.progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {insights.dailyProgress.completed 
                  ? 'Parabéns! Continue o bom trabalho!' 
                  : `Faltam ${insights.dailyProgress.remaining} para bater a meta`}
              </p>
            </CardContent>
          </Card>

          {/* Streak */}
          <Card className="hover-elevate" data-testid="card-streak">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sequência</CardTitle>
              <Flame className={`h-4 w-4 ${insights.streakData.currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" data-testid="text-streak">
                  {insights.streakData.currentStreak}
                </span>
                <span className="text-sm text-muted-foreground">dias</span>
                {insights.streakData.currentStreak >= 5 && (
                  <Flame className="h-5 w-5 text-orange-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {insights.streakData.message}
              </p>
              <p className="text-xs text-muted-foreground">
                (Min. {insights.streakData.minDailyGoal} atendimentos/dia)
              </p>
            </CardContent>
          </Card>

          {/* Comparativo Volume */}
          <Card className="hover-elevate" data-testid="card-team-volume">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ranking Volume</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-bold text-purple-600" data-testid="text-volume-rank">
                  #{insights.teamComparison.volumeRank}
                </span>
                <span className="text-sm text-muted-foreground">de {insights.teamComparison.teamSize}</span>
              </div>
              <Progress value={insights.teamComparison.volumePercentile} className="h-2 mb-1" />
              <p className="text-xs text-muted-foreground">
                {insights.teamComparison.volumeMessage}
              </p>
            </CardContent>
          </Card>

          {/* Comparativo NPS */}
          <Card className="hover-elevate" data-testid="card-team-nps">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ranking NPS</CardTitle>
              <Heart className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-bold text-red-500" data-testid="text-nps-rank">
                  #{insights.teamComparison.npsRank}
                </span>
                <span className="text-sm text-muted-foreground">de {insights.teamComparison.teamSize}</span>
              </div>
              <Progress value={insights.teamComparison.npsPercentile} className="h-2 mb-1" />
              <p className="text-xs text-muted-foreground">
                {insights.teamComparison.npsMessage}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dica do Dia + Progresso de Badges */}
      {insights && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Dica do Dia */}
          <Card className="lg:col-span-1 border-l-4 border-l-yellow-500" data-testid="card-tip">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <Lightbulb className="h-5 w-5" />
                Dica do Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className="font-semibold mb-2">{insights.tipOfTheDay.title}</h4>
              <p className="text-sm text-muted-foreground">{insights.tipOfTheDay.tip}</p>
            </CardContent>
          </Card>

          {/* Progresso para Badges */}
          <Card className="lg:col-span-2" data-testid="card-badge-progress">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-600" />
                Progresso para Badges
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">Complete os objetivos para desbloquear badges e subir no ranking!</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(insights.badgeProgress).map(([key, badge]) => {
                  const icons = {
                    campeao_volume: Crown,
                    velocista: Zap,
                    solucionador: Target
                  };
                  const colors = {
                    campeao_volume: 'text-purple-600',
                    velocista: 'text-yellow-600',
                    solucionador: 'text-blue-600'
                  };
                  const BadgeIcon = icons[key as keyof typeof icons] || Trophy;
                  const color = colors[key as keyof typeof colors] || 'text-gray-600';
                  
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BadgeIcon className={`h-4 w-4 ${color}`} />
                          <span className="text-sm font-medium">{badge.name}</span>
                          {badge.unlocked && <Badge variant="default" className="text-xs">Conquistado!</Badge>}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {badge.current} / {badge.target}
                        </span>
                      </div>
                      <Progress value={badge.progress} className="h-2" />
                      {!badge.unlocked && badge.remaining > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Faltam {badge.remaining} para desbloquear
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráfico de Evolução Semanal */}
      {insights && insights.weeklyEvolution.length > 0 && (
        <Card data-testid="card-weekly-evolution">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Evolução Semanal (Últimas 4 semanas)
            </CardTitle>
            <CardDescription>Acompanhe seu progresso ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={insights.weeklyEvolution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" className="text-xs" tick={{ fill: 'currentColor' }} />
                <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="volume" fill="#8b5cf6" name="Atendimentos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico de Sentimento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução do Sentimento (Últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics.sentimentTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="positive" stroke="#10b981" name="Positivo" strokeWidth={2} />
                <Line type="monotone" dataKey="neutral" stroke="#f59e0b" name="Neutro" strokeWidth={2} />
                <Line type="monotone" dataKey="negative" stroke="#ef4444" name="Negativo" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Feedbacks Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Meus Feedbacks Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.recentFeedbacks.length > 0 ? (
              <div className="space-y-3">
                {metrics.recentFeedbacks.map((feedback, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-shrink-0">
                      <Badge 
                        variant={feedback.score >= 9 ? "default" : feedback.score >= 7 ? "secondary" : "destructive"}
                        className="font-semibold"
                      >
                        ⭐ {feedback.score}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{feedback.comment || "Sem comentário"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {feedback.createdAt ? new Date(feedback.createdAt).toLocaleDateString('pt-BR') : 'Data desconhecida'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum feedback recente
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção de Gamificação e Performance */}
      {myGamificationScore && (
        <div className="space-y-6 mt-6 pt-6 border-t">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <h2 className="text-xl font-semibold">Minha Performance e Gamificação</h2>
          </div>

          {/* Cards de Ranking e Pontuação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover-elevate" data-testid="card-ranking">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Minha Posição</CardTitle>
                <Trophy className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-500" data-testid="text-my-ranking">
                  #{myGamificationScore.ranking || '?'}
                </div>
                <p className="text-xs text-muted-foreground">No ranking do mês</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-total-score">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pontuação Total</CardTitle>
                <Star className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-total-score">
                  {myGamificationScore.totalScore}
                </div>
                <p className="text-xs text-muted-foreground">
                  De {gamificationData?.length ? Math.max(...gamificationData.map(s => s.totalScore)) : 100} pontos
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-badges">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Badges Conquistados</CardTitle>
                <Trophy className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                {myGamificationScore.badges.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {myGamificationScore.badges.map((badge, idx) => {
                      const info = BADGE_INFO[badge.type as keyof typeof BADGE_INFO];
                      const BadgeIcon = info?.icon || Star;
                      return (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className={`${info?.bgColor} flex items-center gap-1`}
                          data-testid={`badge-my-${badge.type}`}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          {info?.name}
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum badge conquistado ainda</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Análise de Pontos Fortes e Áreas de Melhoria */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pontos Fortes */}
            <Card data-testid="card-strengths">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                  Seus Pontos Fortes
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="font-semibold mb-1">Como funciona:</p>
                      <p className="text-xs mb-2">Métricas com score acima de 70 pontos aparecem aqui. Os scores são calculados comparando seu desempenho com as metas do mês.</p>
                      <p className="font-semibold mb-1">Atualização:</p>
                      <p className="text-xs">Dados atualizados a cada nova conversa finalizada (tempo real).</p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <CardDescription>Áreas onde você se destaca (Score ≥ 70)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myGamificationScore.npsScore >= 70 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium">Satisfação do Cliente (NPS)</span>
                        </div>
                        <span className="text-sm font-bold text-green-600">{myGamificationScore.npsScore}/100</span>
                      </div>
                      <Progress value={myGamificationScore.npsScore} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Excelente! Seus clientes estão muito satisfeitos. NPS médio: {myGamificationScore.avgNps.toFixed(1)}
                      </p>
                    </div>
                  )}

                  {myGamificationScore.volumeScore >= 70 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium">Volume de Atendimentos</span>
                        </div>
                        <span className="text-sm font-bold text-green-600">{myGamificationScore.volumeScore}/100</span>
                      </div>
                      <Progress value={myGamificationScore.volumeScore} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Ótima produtividade! Você finalizou {myGamificationScore.totalConversations} conversas neste mês.
                      </p>
                    </div>
                  )}

                  {myGamificationScore.resolutionScore >= 70 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Taxa de Resolução</span>
                        </div>
                        <span className="text-sm font-bold text-green-600">{myGamificationScore.resolutionScore}/100</span>
                      </div>
                      <Progress value={myGamificationScore.resolutionScore} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Parabéns! {myGamificationScore.successRate.toFixed(1)}% das conversas foram resolvidas com sucesso.
                      </p>
                    </div>
                  )}

                  {myGamificationScore.timeScore >= 70 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium">Velocidade de Atendimento</span>
                        </div>
                        <span className="text-sm font-bold text-green-600">{myGamificationScore.timeScore}/100</span>
                      </div>
                      <Progress value={myGamificationScore.timeScore} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Muito rápido! Tempo médio: {Math.floor(myGamificationScore.avgResponseTime / 60)}m {myGamificationScore.avgResponseTime % 60}s
                      </p>
                    </div>
                  )}

                  {myGamificationScore.npsScore < 70 && 
                   myGamificationScore.volumeScore < 70 && 
                   myGamificationScore.resolutionScore < 70 && 
                   myGamificationScore.timeScore < 70 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Continue se dedicando! Seus pontos fortes aparecerão aqui quando atingir 70+ pontos em alguma métrica.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Áreas de Melhoria */}
            <Card data-testid="card-improvements">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="h-5 w-5" />
                  Áreas para Melhorar
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="font-semibold mb-1">Como funciona:</p>
                      <p className="text-xs mb-2">Métricas com score abaixo de 50 pontos aparecem aqui com dicas de como melhorar.</p>
                      <p className="font-semibold mb-1">Métricas avaliadas:</p>
                      <p className="text-xs mb-1">• NPS: Nota média dos clientes (0-10)</p>
                      <p className="text-xs mb-1">• Volume: Quantidade de atendimentos no mês</p>
                      <p className="text-xs mb-1">• Resolução: % de conversas finalizadas com sucesso</p>
                      <p className="text-xs mb-2">• Velocidade: Tempo médio de atendimento</p>
                      <p className="font-semibold mb-1">Atualização:</p>
                      <p className="text-xs">Dados atualizados a cada nova conversa finalizada.</p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <CardDescription>Onde você pode crescer ainda mais (Score &lt; 50)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myGamificationScore.npsScore < 50 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium">Satisfação do Cliente (NPS)</span>
                        </div>
                        <span className="text-sm font-bold text-orange-600">{myGamificationScore.npsScore}/100</span>
                      </div>
                      <Progress value={myGamificationScore.npsScore} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        💡 Dica: Seja mais empático e certifique-se de resolver completamente o problema do cliente.
                      </p>
                    </div>
                  )}

                  {myGamificationScore.volumeScore < 50 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium">Volume de Atendimentos</span>
                        </div>
                        <span className="text-sm font-bold text-orange-600">{myGamificationScore.volumeScore}/100</span>
                      </div>
                      <Progress value={myGamificationScore.volumeScore} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        💡 Dica: Tente atender mais conversas mantendo a qualidade. Foco e organização são fundamentais.
                      </p>
                    </div>
                  )}

                  {myGamificationScore.resolutionScore < 50 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Taxa de Resolução</span>
                        </div>
                        <span className="text-sm font-bold text-orange-600">{myGamificationScore.resolutionScore}/100</span>
                      </div>
                      <Progress value={myGamificationScore.resolutionScore} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        💡 Dica: Certifique-se de entender completamente o problema antes de finalizar o atendimento.
                      </p>
                    </div>
                  )}

                  {myGamificationScore.timeScore < 50 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium">Velocidade de Atendimento</span>
                        </div>
                        <span className="text-sm font-bold text-orange-600">{myGamificationScore.timeScore}/100</span>
                      </div>
                      <Progress value={myGamificationScore.timeScore} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        💡 Dica: Use templates e atalhos para responder mais rápido mantendo a qualidade.
                      </p>
                    </div>
                  )}

                  {myGamificationScore.npsScore >= 50 && 
                   myGamificationScore.volumeScore >= 50 && 
                   myGamificationScore.resolutionScore >= 50 && 
                   myGamificationScore.timeScore >= 50 && (
                    <div className="text-center py-4">
                      <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-semibold">Excelente Performance!</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Parabéns! Todas as suas métricas estão em bom nível. Continue assim! 🎉
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumo da Fórmula de Pontuação */}
          <Card data-testid="card-scoring-formula">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Como sua pontuação é calculada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">40%</div>
                  <div className="text-xs text-muted-foreground mt-1">Satisfação (NPS)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">30%</div>
                  <div className="text-xs text-muted-foreground mt-1">Volume</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">20%</div>
                  <div className="text-xs text-muted-foreground mt-1">Resolução</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">10%</div>
                  <div className="text-xs text-muted-foreground mt-1">Velocidade</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mensagem quando não há dados de gamificação */}
      {!isLoadingGamification && !myGamificationScore && (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sistema de Gamificação</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              As pontuações de gamificação são calculadas mensalmente. 
              Continue atendendo e seus dados aparecerão aqui em breve!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
