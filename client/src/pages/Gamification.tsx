import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, Star, TrendingUp, Users, Calculator, Crown, Zap, Target, Printer, Heart, ShieldCheck, GraduationCap, Flame, Clock, Calendar } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface GamificationScore {
  agentId: string;
  agentName: string;
  totalScore: number;
  totalConversations: number;
  avgNps: number;
  successRate: number;
  avgResponseTime: number;
  badges: {
    type: string;
    earnedAt: string;
    metric: number;
  }[];
}

interface GamificationStats {
  period: string;
  totalAgents: number;
  avgTotalScore: number;
  topScore: number;
  badgeDistribution: {
    solucionador: number;
    velocista: number;
    campeao_volume: number;
    encantador: number;
    zero_reclamacao: number;
    especialista: number;
    maratonista: number;
    pontualidade: number;
    regularidade: number;
  };
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
  },
  encantador: {
    name: "Encantador",
    icon: Heart,
    color: "text-pink-600",
    bgColor: "bg-pink-100 dark:bg-pink-900",
    description: "3+ NPS 10 consecutivos"
  },
  zero_reclamacao: {
    name: "Zero Reclamação",
    icon: ShieldCheck,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900",
    description: "Sem feedback negativo"
  },
  especialista: {
    name: "Especialista",
    icon: GraduationCap,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900",
    description: "Líder em departamento"
  },
  maratonista: {
    name: "Maratonista",
    icon: Flame,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900",
    description: "10+ dias consecutivos"
  },
  pontualidade: {
    name: "Pontualidade",
    icon: Clock,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100 dark:bg-cyan-900",
    description: "Resposta rápida (< 2 min)"
  },
  regularidade: {
    name: "Regularidade",
    icon: Calendar,
    color: "text-teal-600",
    bgColor: "bg-teal-100 dark:bg-teal-900",
    description: "3 meses consistente"
  }
};

export default function Gamification() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch ranking
  const { data: ranking = [], isLoading: isLoadingRanking } = useQuery<GamificationScore[]>({
    queryKey: ["/api/gamification/ranking", selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams({ period: selectedPeriod });
      const res = await fetch(`/api/gamification/ranking?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar ranking");
      return res.json();
    }
  });

  // Fetch stats
  const { data: stats, isLoading: isLoadingStats } = useQuery<GamificationStats>({
    queryKey: ["/api/gamification/stats", selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams({ period: selectedPeriod });
      const res = await fetch(`/api/gamification/stats?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar estatísticas");
      return res.json();
    }
  });

  // Calculate mutation
  const calculateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/gamification/calculate", "POST", { period: selectedPeriod });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: `Gamificação calculada para ${selectedPeriod}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao calcular gamificação",
        variant: "destructive",
      });
    }
  });

  const top5 = ranking.slice(0, 5);
  const isLoading = isLoadingRanking || isLoadingStats;

  // Generate period options (last 12 months + current)
  const periodOptions = Array.from({ length: 13 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-gamification-title">
            Gamificação
          </h1>
          <p className="text-muted-foreground">
            Ranking mensal de desempenho dos atendentes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48" data-testid="select-period">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} data-testid={`option-period-${opt.value}`}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => calculateMutation.mutate()}
            disabled={calculateMutation.isPending}
            data-testid="button-calculate"
          >
            <Calculator className="w-4 h-4 mr-2" />
            {calculateMutation.isPending ? "Calculando..." : "Recalcular"}
          </Button>
          <Link href={`/gamification/report?period=${selectedPeriod}`}>
            <Button variant="outline" data-testid="button-print-report">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-stats-top-score">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Score</CardTitle>
            <Trophy className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-top-score">
              {isLoading ? "..." : stats?.topScore || 0}
            </div>
            <p className="text-xs text-muted-foreground">Pontuação máxima do período</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stats-participants">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participantes</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-agents">
              {isLoading ? "..." : stats?.totalAgents || 0}
            </div>
            <p className="text-xs text-muted-foreground">Atendentes no ranking</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stats-avg-score">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-score">
              {isLoading ? "..." : stats?.avgTotalScore || 0}
            </div>
            <p className="text-xs text-muted-foreground">Pontuação média</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Podium */}
      <Card data-testid="card-top5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top 5 do Mês
          </CardTitle>
          <CardDescription>
            Fórmula: 40% NPS + 30% Volume + 20% Resolução + 10% Tempo de Resposta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Carregando ranking...</div>
            </div>
          ) : top5.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">
                Nenhum dado encontrado. Clique em "Recalcular" para gerar o ranking.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Podium visual para top 3 */}
              <div className="flex items-end justify-center gap-4 py-8">
                {/* 2nd Place */}
                {top5[1] && (
                  <div className="flex flex-col items-center" data-testid="podium-2">
                    <Award className="w-8 h-8 text-gray-400 mb-2" />
                    <div className="text-sm font-semibold">{top5[1].agentName}</div>
                    <div className="text-2xl font-bold text-gray-400">{top5[1].totalScore}</div>
                    <div className="flex gap-1 mt-2">
                      {top5[1].badges.map((badge, idx) => {
                        const BadgeIcon = BADGE_INFO[badge.type as keyof typeof BADGE_INFO]?.icon || Star;
                        return (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className={BADGE_INFO[badge.type as keyof typeof BADGE_INFO]?.bgColor}
                            data-testid={`badge-${badge.type}-${top5[1].agentId}`}
                          >
                            <BadgeIcon className="w-3 h-3" />
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="w-24 h-20 bg-gray-200 dark:bg-gray-700 rounded-t-lg mt-3 flex items-center justify-center">
                      <span className="text-3xl font-bold text-gray-400">2</span>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {top5[0] && (
                  <div className="flex flex-col items-center" data-testid="podium-1">
                    <Crown className="w-10 h-10 text-yellow-500 mb-2" />
                    <div className="text-sm font-semibold">{top5[0].agentName}</div>
                    <div className="text-3xl font-bold text-yellow-500">{top5[0].totalScore}</div>
                    <div className="flex gap-1 mt-2">
                      {top5[0].badges.map((badge, idx) => {
                        const BadgeIcon = BADGE_INFO[badge.type as keyof typeof BADGE_INFO]?.icon || Star;
                        return (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className={BADGE_INFO[badge.type as keyof typeof BADGE_INFO]?.bgColor}
                            data-testid={`badge-${badge.type}-${top5[0].agentId}`}
                          >
                            <BadgeIcon className="w-3 h-3" />
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="w-24 h-28 bg-yellow-500 rounded-t-lg mt-3 flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">1</span>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {top5[2] && (
                  <div className="flex flex-col items-center" data-testid="podium-3">
                    <Award className="w-8 h-8 text-orange-600 mb-2" />
                    <div className="text-sm font-semibold">{top5[2].agentName}</div>
                    <div className="text-2xl font-bold text-orange-600">{top5[2].totalScore}</div>
                    <div className="flex gap-1 mt-2">
                      {top5[2].badges.map((badge, idx) => {
                        const BadgeIcon = BADGE_INFO[badge.type as keyof typeof BADGE_INFO]?.icon || Star;
                        return (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className={BADGE_INFO[badge.type as keyof typeof BADGE_INFO]?.bgColor}
                            data-testid={`badge-${badge.type}-${top5[2].agentId}`}
                          >
                            <BadgeIcon className="w-3 h-3" />
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="w-24 h-16 bg-orange-600 rounded-t-lg mt-3 flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">3</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 4th and 5th place */}
              {top5.slice(3, 5).map((agent, idx) => (
                <div
                  key={agent.agentId}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  data-testid={`rank-${idx + 4}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-muted-foreground w-8">
                      {idx + 4}
                    </div>
                    <div>
                      <div className="font-semibold">{agent.agentName}</div>
                      <div className="text-sm text-muted-foreground">
                        {agent.totalConversations} conversas • NPS {agent.avgNps.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {agent.badges.map((badge, badgeIdx) => {
                        const BadgeIcon = BADGE_INFO[badge.type as keyof typeof BADGE_INFO]?.icon || Star;
                        return (
                          <Badge
                            key={badgeIdx}
                            variant="secondary"
                            className={BADGE_INFO[badge.type as keyof typeof BADGE_INFO]?.bgColor}
                            data-testid={`badge-${badge.type}-${agent.agentId}`}
                          >
                            <BadgeIcon className="w-3 h-3" />
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="text-2xl font-bold">{agent.totalScore}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badge Legend */}
      <Card data-testid="card-badges">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Badges Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
            {Object.entries(BADGE_INFO).map(([type, info]) => {
              const Icon = info.icon;
              const count = stats?.badgeDistribution?.[type as keyof typeof stats.badgeDistribution] || 0;
              return (
                <div
                  key={type}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                  data-testid={`badge-info-${type}`}
                >
                  <div className={`p-2 rounded-lg ${info.bgColor}`}>
                    <Icon className={`w-5 h-5 ${info.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{info.name}</div>
                    <div className="text-sm text-muted-foreground">{info.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {isLoading ? "..." : `${count} conquistado${count !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* All Agents Table */}
      {ranking.length > 5 && (
        <Card data-testid="card-all-agents">
          <CardHeader>
            <CardTitle>Ranking Completo</CardTitle>
            <CardDescription>Todos os atendentes do período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ranking.slice(5).map((agent, idx) => (
                <div
                  key={agent.agentId}
                  className="flex items-center justify-between p-3 rounded-lg hover-elevate"
                  data-testid={`rank-${idx + 6}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-semibold text-muted-foreground w-8">
                      {idx + 6}
                    </div>
                    <div>
                      <div className="font-medium">{agent.agentName}</div>
                      <div className="text-sm text-muted-foreground">
                        {agent.totalConversations} conversas • Taxa de sucesso {agent.successRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {agent.badges.map((badge, badgeIdx) => {
                        const BadgeIcon = BADGE_INFO[badge.type as keyof typeof BADGE_INFO]?.icon || Star;
                        return (
                          <Badge
                            key={badgeIdx}
                            variant="secondary"
                            className={BADGE_INFO[badge.type as keyof typeof BADGE_INFO]?.bgColor}
                            data-testid={`badge-${badge.type}-${agent.agentId}`}
                          >
                            <BadgeIcon className="w-3 h-3" />
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="text-xl font-bold">{agent.totalScore}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
