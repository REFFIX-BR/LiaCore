import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Trophy, Crown, Award, Medal, Target, Zap, Star, TrendingUp, Users, BarChart3, ArrowLeft } from "lucide-react";
import { Link, useSearch } from "wouter";

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
  };
}

const BADGE_INFO = {
  solucionador: {
    name: "Solucionador",
    icon: Target,
    description: "Excelência em NPS e Resolução"
  },
  velocista: {
    name: "Velocista",
    icon: Zap,
    description: "Rapidez no Atendimento"
  },
  campeao_volume: {
    name: "Campeão do Volume",
    icon: Crown,
    description: "Maior Produtividade"
  }
};

function formatPeriodName(period: string): string {
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase());
}

function formatResponseTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export default function GamificationReport() {
  const printRef = useRef<HTMLDivElement>(null);
  const searchString = useSearch();
  
  const getInitialPeriod = () => {
    const params = new URLSearchParams(searchString);
    const urlPeriod = params.get('period');
    if (urlPeriod && /^\d{4}-\d{2}$/.test(urlPeriod)) {
      return urlPeriod;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  
  const [selectedPeriod, setSelectedPeriod] = useState(getInitialPeriod);

  const { data: ranking = [], isLoading: isLoadingRanking } = useQuery<GamificationScore[]>({
    queryKey: ["/api/gamification/ranking", selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams({ period: selectedPeriod });
      const res = await fetch(`/api/gamification/ranking?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar ranking");
      return res.json();
    }
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery<GamificationStats>({
    queryKey: ["/api/gamification/stats", selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams({ period: selectedPeriod });
      const res = await fetch(`/api/gamification/stats?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar estatísticas");
      return res.json();
    }
  });

  const periodOptions = Array.from({ length: 13 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });

  const handlePrint = () => {
    window.print();
  };

  const top5 = ranking.slice(0, 5);
  const isLoading = isLoadingRanking || isLoadingStats;
  const periodName = formatPeriodName(selectedPeriod);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Carregando relatório...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden p-4 border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/gamification">
              <Button variant="outline" size="sm" data-testid="button-back">
                Voltar
              </Button>
            </Link>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48" data-testid="select-report-period">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handlePrint} data-testid="button-print">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Relatório
          </Button>
        </div>
      </div>

      <div 
        ref={printRef} 
        className="print-report max-w-4xl mx-auto p-8 print:p-0 print:max-w-none"
        data-testid="report-container"
      >
        <div className="report-header text-center mb-8 print:mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-yellow-500 print:text-yellow-600" />
            <h1 className="text-4xl font-bold tracking-tight print:text-3xl" data-testid="report-title">
              RANKING DE DESEMPENHO
            </h1>
            <Trophy className="w-12 h-12 text-yellow-500 print:text-yellow-600" />
          </div>
          <h2 className="text-2xl font-semibold text-primary print:text-xl" data-testid="report-period">
            {periodName}
          </h2>
          <p className="text-muted-foreground mt-2 print:text-sm">
            LIA CORTEX - Sistema de Gamificação
          </p>
        </div>

        {top5.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">
              Nenhum dado encontrado para este período.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Acesse a página de Gamificação e clique em "Recalcular" para gerar o ranking.
            </p>
          </div>
        ) : (
          <>
            <div className="champion-section mb-8 print:mb-6">
              {top5[0] && (
                <div 
                  className="champion-card bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/20 border-2 border-yellow-400 rounded-xl p-6 text-center print:bg-yellow-50 print:border-yellow-500"
                  data-testid="champion-card"
                >
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Crown className="w-10 h-10 text-yellow-500" />
                    <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
                      Campeão do Mês
                    </span>
                    <Crown className="w-10 h-10 text-yellow-500" />
                  </div>
                  <h3 className="text-4xl font-bold mb-2 print:text-3xl" data-testid="champion-name">
                    {top5[0].agentName}
                  </h3>
                  <div className="text-5xl font-black text-yellow-600 dark:text-yellow-400 mb-4 print:text-4xl" data-testid="champion-score">
                    {top5[0].totalScore} pontos
                  </div>
                  <div className="flex items-center justify-center gap-6 text-sm print:text-xs">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span><strong>{top5[0].totalConversations}</strong> atendimentos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      <span>NPS <strong>{top5[0].avgNps.toFixed(1)}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      <span><strong>{top5[0].successRate.toFixed(0)}%</strong> resolução</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      <span><strong>{formatResponseTime(top5[0].avgResponseTime)}</strong> resposta</span>
                    </div>
                  </div>
                  {top5[0].badges.length > 0 && (
                    <div className="flex items-center justify-center gap-3 mt-4">
                      {top5[0].badges.map((badge, idx) => {
                        const info = BADGE_INFO[badge.type as keyof typeof BADGE_INFO];
                        if (!info) return null;
                        const BadgeIcon = info.icon;
                        return (
                          <div 
                            key={idx}
                            className="flex items-center gap-1 px-3 py-1 bg-white/80 dark:bg-black/20 rounded-full text-sm font-medium print:bg-white"
                            data-testid={`champion-badge-${badge.type}`}
                          >
                            <BadgeIcon className="w-4 h-4" />
                            <span>{info.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="podium-section mb-8 print:mb-6">
              <h3 className="text-xl font-bold text-center mb-6 flex items-center justify-center gap-2 print:text-lg">
                <Medal className="w-6 h-6" />
                PÓDIO DE VENCEDORES
                <Medal className="w-6 h-6" />
              </h3>
              <div className="grid grid-cols-3 gap-4 print:gap-2">
                {[1, 0, 2].map((podiumIdx) => {
                  const agent = top5[podiumIdx];
                  if (!agent) return <div key={podiumIdx} />;
                  
                  const isFirst = podiumIdx === 0;
                  const isSecond = podiumIdx === 1;
                  const isThird = podiumIdx === 2;
                  
                  const bgClass = isFirst 
                    ? "bg-gradient-to-b from-yellow-100 to-yellow-200 dark:from-yellow-900/40 dark:to-yellow-800/30 border-yellow-400 print:from-yellow-100 print:to-yellow-200"
                    : isSecond 
                    ? "bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800/40 dark:to-gray-700/30 border-gray-400 print:from-gray-100 print:to-gray-200"
                    : "bg-gradient-to-b from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/30 border-orange-400 print:from-orange-100 print:to-orange-200";
                  
                  const placeColor = isFirst ? "text-yellow-600" : isSecond ? "text-gray-600" : "text-orange-600";
                  const PlaceIcon = isFirst ? Crown : Award;
                  
                  return (
                    <div 
                      key={podiumIdx}
                      className={`podium-card ${bgClass} border-2 rounded-xl p-4 text-center ${isFirst ? 'order-2' : isSecond ? 'order-1' : 'order-3'}`}
                      data-testid={`podium-card-${podiumIdx + 1}`}
                    >
                      <PlaceIcon className={`w-8 h-8 mx-auto mb-2 ${placeColor} print:w-6 print:h-6`} />
                      <div className={`text-3xl font-black ${placeColor} mb-1 print:text-2xl`}>
                        {podiumIdx + 1}º
                      </div>
                      <h4 className="text-lg font-bold mb-1 print:text-base" data-testid={`podium-name-${podiumIdx + 1}`}>
                        {agent.agentName}
                      </h4>
                      <div className={`text-2xl font-bold ${placeColor} mb-2 print:text-xl`} data-testid={`podium-score-${podiumIdx + 1}`}>
                        {agent.totalScore} pts
                      </div>
                      <div className="text-xs space-y-1 text-muted-foreground print:text-[10px]">
                        <div>{agent.totalConversations} atendimentos</div>
                        <div>NPS {agent.avgNps.toFixed(1)} • {agent.successRate.toFixed(0)}% resolução</div>
                      </div>
                      {agent.badges.length > 0 && (
                        <div className="flex items-center justify-center gap-1 mt-2">
                          {agent.badges.map((badge, idx) => {
                            const info = BADGE_INFO[badge.type as keyof typeof BADGE_INFO];
                            if (!info) return null;
                            const BadgeIcon = info.icon;
                            return (
                              <div 
                                key={idx}
                                className="p-1 bg-white/60 dark:bg-black/20 rounded print:bg-white"
                                title={info.name}
                              >
                                <BadgeIcon className="w-4 h-4" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {top5.length > 3 && (
              <div className="honorable-mentions mb-8 print:mb-6">
                <h3 className="text-lg font-bold text-center mb-4 print:text-base">
                  MENÇÕES HONROSAS
                </h3>
                <div className="grid grid-cols-2 gap-4 print:gap-2">
                  {top5.slice(3).map((agent, idx) => (
                    <div 
                      key={agent.agentId}
                      className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg print:p-3"
                      data-testid={`mention-card-${idx + 4}`}
                    >
                      <div className="text-3xl font-bold text-muted-foreground print:text-2xl">
                        {idx + 4}º
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold print:text-sm" data-testid={`mention-name-${idx + 4}`}>
                          {agent.agentName}
                        </div>
                        <div className="text-sm text-muted-foreground print:text-xs">
                          {agent.totalScore} pontos • {agent.totalConversations} atendimentos
                        </div>
                      </div>
                      {agent.badges.length > 0 && (
                        <div className="flex gap-1">
                          {agent.badges.map((badge, badgeIdx) => {
                            const info = BADGE_INFO[badge.type as keyof typeof BADGE_INFO];
                            if (!info) return null;
                            const BadgeIcon = info.icon;
                            return (
                              <div key={badgeIdx} className="p-1 bg-background rounded" title={info.name}>
                                <BadgeIcon className="w-4 h-4" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats && (
              <div className="stats-section mb-8 print:mb-6">
                <h3 className="text-lg font-bold text-center mb-4 flex items-center justify-center gap-2 print:text-base">
                  <BarChart3 className="w-5 h-5" />
                  ESTATÍSTICAS DO PERÍODO
                </h3>
                <div className="grid grid-cols-4 gap-4 print:gap-2">
                  <div className="stat-card bg-muted/30 rounded-lg p-4 text-center print:p-3">
                    <div className="text-3xl font-bold text-primary print:text-2xl" data-testid="stat-top-score">
                      {stats.topScore}
                    </div>
                    <div className="text-sm text-muted-foreground print:text-xs">Top Score</div>
                  </div>
                  <div className="stat-card bg-muted/30 rounded-lg p-4 text-center print:p-3">
                    <div className="text-3xl font-bold text-primary print:text-2xl" data-testid="stat-avg-score">
                      {stats.avgTotalScore}
                    </div>
                    <div className="text-sm text-muted-foreground print:text-xs">Média Geral</div>
                  </div>
                  <div className="stat-card bg-muted/30 rounded-lg p-4 text-center print:p-3">
                    <div className="text-3xl font-bold text-primary print:text-2xl" data-testid="stat-participants">
                      {stats.totalAgents}
                    </div>
                    <div className="text-sm text-muted-foreground print:text-xs">Participantes</div>
                  </div>
                  <div className="stat-card bg-muted/30 rounded-lg p-4 text-center print:p-3">
                    <div className="text-3xl font-bold text-primary print:text-2xl" data-testid="stat-total-badges">
                      {stats.badgeDistribution.solucionador + stats.badgeDistribution.velocista + stats.badgeDistribution.campeao_volume}
                    </div>
                    <div className="text-sm text-muted-foreground print:text-xs">Badges</div>
                  </div>
                </div>
              </div>
            )}

            <div className="badges-legend border-t pt-6 print:pt-4">
              <h3 className="text-lg font-bold text-center mb-4 print:text-base">
                LEGENDA DE CONQUISTAS
              </h3>
              <div className="grid grid-cols-3 gap-4 print:gap-2">
                {Object.entries(BADGE_INFO).map(([type, info]) => {
                  const BadgeIcon = info.icon;
                  return (
                    <div 
                      key={type}
                      className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg print:p-2"
                      data-testid={`legend-${type}`}
                    >
                      <BadgeIcon className="w-8 h-8 text-primary print:w-6 print:h-6" />
                      <div>
                        <div className="font-semibold print:text-sm">{info.name}</div>
                        <div className="text-xs text-muted-foreground print:text-[10px]">{info.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="formula-section mt-6 text-center text-sm text-muted-foreground print:text-xs print:mt-4">
              <p className="font-medium">Fórmula de Pontuação:</p>
              <p>40% NPS + 30% Volume de Atendimentos + 20% Taxa de Resolução + 10% Tempo de Resposta</p>
            </div>

            <div className="footer mt-8 pt-4 border-t text-center text-xs text-muted-foreground print:mt-6">
              <p>Relatório gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              <p className="font-semibold mt-1">TR Telecom - LIA CORTEX</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
