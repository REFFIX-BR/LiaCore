import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, CheckCircle2, Clock, Star, TrendingUp, Calendar } from "lucide-react";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function AgentDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/agent", { period }],
    refetchInterval: 30000, // 30 seconds
  });

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
              {period === 'today' ? 'Seu progresso do dia' : period === 'week' ? 'Últimos 7 dias' : 'Últimos 30 dias'}
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
                <Tooltip 
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
    </div>
  );
}
