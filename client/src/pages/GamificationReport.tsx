import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Trophy, Crown, Award, Target, Zap, BarChart3 } from "lucide-react";
import { Link, useSearch } from "wouter";

interface GamificationScore {
  agentId: string;
  agentName: string;
  totalScore: number;
  totalConversations: number;
  avgNps: number;
  successRate: number;
  avgResponseTime: number; // Tempo da primeira resposta após atribuição
  avgServiceTime: number; // Tempo total de atendimento (atribuição até finalização)
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
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}min`;
  }
  return `${mins}min`;
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
        className="print-report max-w-4xl mx-auto p-8 print:p-4 print:max-w-none print:bg-[#0a1628]"
        data-testid="report-container"
      >
        <div className="report-header text-center mb-10 print:mb-8">
          <div className="flex items-center justify-center gap-4 mb-3">
            <Trophy className="w-10 h-10 text-yellow-500 print:text-yellow-400" />
            <h1 className="text-3xl font-bold tracking-wide print:text-2xl print:text-white" data-testid="report-title">
              RANKING DE DESEMPENHO
            </h1>
            <Trophy className="w-10 h-10 text-yellow-500 print:text-yellow-400" />
          </div>
          <h2 className="text-xl font-medium text-yellow-500 print:text-lg print:text-yellow-400 underline decoration-1 underline-offset-4" data-testid="report-period">
            {periodName}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm print:text-xs print:text-gray-400">
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
            <div className="champion-section mb-10 print:mb-8">
              {top5[0] && (
                <div 
                  className="champion-card bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-xl p-6 text-center text-white print:bg-blue-600"
                  data-testid="champion-card"
                >
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Crown className="w-7 h-7 text-yellow-400" />
                    <span className="text-lg font-bold text-yellow-400 uppercase tracking-wider">
                      Campeão do Mês
                    </span>
                    <Crown className="w-7 h-7 text-yellow-400" />
                  </div>
                  <h3 className="text-3xl font-bold mb-2 print:text-2xl" data-testid="champion-name">
                    {top5[0].agentName}
                  </h3>
                  <div className="text-4xl font-black text-white mb-6 print:text-3xl" data-testid="champion-score">
                    {top5[0].totalScore} pontos
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-xl font-bold">{top5[0].totalConversations}</div>
                      <div className="text-xs uppercase opacity-80">Conversas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold">{top5[0].avgNps.toFixed(1)}</div>
                      <div className="text-xs uppercase opacity-80">NPS Médio</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold">{top5[0].successRate.toFixed(0)}%</div>
                      <div className="text-xs uppercase opacity-80">Taxa Sucesso</div>
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
                            className="flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-sm font-medium"
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

            <div className="podium-section mb-10 print:mb-8">
              <h3 className="text-lg font-bold text-center mb-6 flex items-center justify-center gap-2 print:text-base print:text-white">
                <Trophy className="w-5 h-5 text-yellow-500" />
                PÓDIO DE VENCEDORES
                <Trophy className="w-5 h-5 text-yellow-500" />
              </h3>
              <div className="grid grid-cols-3 gap-4 items-end print:gap-3">
                {top5[1] && (
                  <div 
                    className="podium-card bg-gradient-to-b from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600 rounded-xl p-5 text-center text-white print:bg-slate-500"
                    style={{ minHeight: '200px' }}
                    data-testid="podium-card-2"
                  >
                    <Award className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <div className="text-3xl font-black mb-1">2º</div>
                    <h4 className="text-base font-bold mb-1 leading-tight" data-testid="podium-name-2">
                      {top5[1].agentName}
                    </h4>
                    <div className="text-2xl font-bold text-yellow-300 mb-2" data-testid="podium-score-2">
                      {top5[1].totalScore} pts
                    </div>
                    <div className="text-xs opacity-80 space-y-0.5">
                      <div>{top5[1].totalConversations} atendimentos</div>
                      <div>NPS {top5[1].avgNps.toFixed(1)} • {top5[1].successRate.toFixed(0)}% resolução</div>
                    </div>
                    {top5[1].badges.length > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-3">
                        {top5[1].badges.map((badge, idx) => {
                          const info = BADGE_INFO[badge.type as keyof typeof BADGE_INFO];
                          if (!info) return null;
                          const BadgeIcon = info.icon;
                          return (
                            <div key={idx} className="p-1.5 bg-white/20 rounded" title={info.name}>
                              <BadgeIcon className="w-4 h-4" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {top5[0] && (
                  <div 
                    className="podium-card bg-gradient-to-b from-yellow-500 to-yellow-600 dark:from-yellow-500 dark:to-yellow-600 rounded-xl p-5 text-center text-white border-4 border-yellow-400 print:bg-yellow-500"
                    style={{ minHeight: '240px' }}
                    data-testid="podium-card-1"
                  >
                    <Crown className="w-10 h-10 mx-auto mb-2 text-white" />
                    <div className="text-4xl font-black mb-1">1º</div>
                    <h4 className="text-lg font-bold mb-1 leading-tight" data-testid="podium-name-1">
                      {top5[0].agentName}
                    </h4>
                    <div className="text-3xl font-bold text-white mb-2" data-testid="podium-score-1">
                      {top5[0].totalScore} pts
                    </div>
                    <div className="text-xs opacity-90 space-y-0.5">
                      <div>{top5[0].totalConversations} atendimentos</div>
                      <div>NPS {top5[0].avgNps.toFixed(1)} • {top5[0].successRate.toFixed(0)}% resolução</div>
                    </div>
                    {top5[0].badges.length > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-3">
                        {top5[0].badges.map((badge, idx) => {
                          const info = BADGE_INFO[badge.type as keyof typeof BADGE_INFO];
                          if (!info) return null;
                          const BadgeIcon = info.icon;
                          return (
                            <div key={idx} className="p-1.5 bg-white/30 rounded" title={info.name}>
                              <BadgeIcon className="w-4 h-4" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {top5[2] && (
                  <div 
                    className="podium-card bg-gradient-to-b from-orange-500 to-orange-600 dark:from-orange-500 dark:to-orange-600 rounded-xl p-5 text-center text-white print:bg-orange-500"
                    style={{ minHeight: '180px' }}
                    data-testid="podium-card-3"
                  >
                    <Award className="w-8 h-8 mx-auto mb-2 text-orange-200" />
                    <div className="text-3xl font-black mb-1">3º</div>
                    <h4 className="text-base font-bold mb-1 leading-tight" data-testid="podium-name-3">
                      {top5[2].agentName}
                    </h4>
                    <div className="text-2xl font-bold text-yellow-300 mb-2" data-testid="podium-score-3">
                      {top5[2].totalScore} pts
                    </div>
                    <div className="text-xs opacity-80 space-y-0.5">
                      <div>{top5[2].totalConversations} atendimentos</div>
                      <div>NPS {top5[2].avgNps.toFixed(1)} • {top5[2].successRate.toFixed(0)}% resolução</div>
                    </div>
                    {top5[2].badges.length > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-3">
                        {top5[2].badges.map((badge, idx) => {
                          const info = BADGE_INFO[badge.type as keyof typeof BADGE_INFO];
                          if (!info) return null;
                          const BadgeIcon = info.icon;
                          return (
                            <div key={idx} className="p-1.5 bg-white/20 rounded" title={info.name}>
                              <BadgeIcon className="w-4 h-4" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {top5.length > 3 && (
              <div className="honorable-mentions mb-10 print:mb-8">
                <h3 className="text-lg font-bold text-center mb-5 print:text-base print:text-white">
                  MENÇÕES HONROSAS
                </h3>
                <div className="grid grid-cols-2 gap-4 print:gap-3">
                  {top5.slice(3).map((agent, idx) => (
                    <div 
                      key={agent.agentId}
                      className="flex items-center gap-4 p-4 bg-muted/30 dark:bg-slate-800/50 rounded-lg border border-border/50 print:bg-slate-800 print:border-slate-600"
                      data-testid={`mention-card-${idx + 4}`}
                    >
                      <div className="text-3xl font-bold text-muted-foreground print:text-gray-400">
                        {idx + 4}º
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate print:text-white" data-testid={`mention-name-${idx + 4}`}>
                          {agent.agentName}
                        </div>
                        <div className="text-sm text-muted-foreground print:text-gray-400">
                          {agent.totalScore} pts • {agent.totalConversations} atendimentos
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-primary print:text-blue-400">
                        {agent.totalScore}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats && (
              <div className="stats-section mb-8 print:mb-6">
                <h3 className="text-lg font-bold text-center mb-5 flex items-center justify-center gap-2 print:text-base print:text-white">
                  <BarChart3 className="w-5 h-5" />
                  ESTATÍSTICAS DO PERÍODO
                </h3>
                <div className="grid grid-cols-4 gap-4 print:gap-3">
                  <div className="stat-card bg-muted/30 dark:bg-slate-800/50 rounded-xl p-5 text-center border border-border/30 print:bg-slate-800 print:border-slate-600">
                    <div className="text-4xl font-bold text-primary print:text-3xl print:text-blue-400" data-testid="stat-top-score">
                      {stats.topScore}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 print:text-gray-400">Top Score</div>
                  </div>
                  <div className="stat-card bg-muted/30 dark:bg-slate-800/50 rounded-xl p-5 text-center border border-border/30 print:bg-slate-800 print:border-slate-600">
                    <div className="text-4xl font-bold text-primary print:text-3xl print:text-blue-400" data-testid="stat-avg-score">
                      {stats.avgTotalScore}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 print:text-gray-400">Média Geral</div>
                  </div>
                  <div className="stat-card bg-muted/30 dark:bg-slate-800/50 rounded-xl p-5 text-center border border-border/30 print:bg-slate-800 print:border-slate-600">
                    <div className="text-4xl font-bold text-primary print:text-3xl print:text-blue-400" data-testid="stat-participants">
                      {stats.totalAgents}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 print:text-gray-400">Participantes</div>
                  </div>
                  <div className="stat-card bg-muted/30 dark:bg-slate-800/50 rounded-xl p-5 text-center border border-border/30 print:bg-slate-800 print:border-slate-600">
                    <div className="text-4xl font-bold text-primary print:text-3xl print:text-blue-400" data-testid="stat-total-badges">
                      {stats.badgeDistribution.solucionador + stats.badgeDistribution.velocista + stats.badgeDistribution.campeao_volume}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 print:text-gray-400">Badges</div>
                  </div>
                </div>
              </div>
            )}

            <div className="footer mt-10 pt-4 border-t border-border/30 text-center text-xs text-muted-foreground print:mt-8 print:border-slate-600 print:text-gray-500">
              <p>Relatório gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              <p className="font-semibold mt-1">TR Telecom - LIA CORTEX</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
