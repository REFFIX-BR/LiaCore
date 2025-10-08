import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, DollarSign, Users, Shield, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";

export function AdminDashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/admin"],
    refetchInterval: 60000, // 1 minute
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Carregando...</div>;
  }

  if (!metrics) {
    return <div className="flex items-center justify-center h-96">Erro ao carregar métricas</div>;
  }

  const getStatusBadge = (status: boolean) => {
    return status ? (
      <Badge variant="default" className="bg-green-600">Operacional</Badge>
    ) : (
      <Badge variant="destructive">Offline</Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Dashboard do Administrador</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral da saúde do sistema, custos e segurança
        </p>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate" data-testid="card-system">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
            <Monitor className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs">API</span>
                {getStatusBadge(metrics.systemStatus.api)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Database</span>
                {getStatusBadge(metrics.systemStatus.database)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Workers</span>
                {getStatusBadge(metrics.systemStatus.workers)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-cost">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Estimado (Mês)</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-cost">
              ${metrics.estimatedCost.total.toFixed(2)}
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">OpenAI: ${metrics.estimatedCost.openai.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Upstash: ${metrics.estimatedCost.upstash.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos (Hoje)</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-users">{metrics.activeUsers.total}</div>
            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">{metrics.activeUsers.admins} Admins</p>
              <p className="text-xs text-muted-foreground">{metrics.activeUsers.supervisors} Supervisors</p>
              <p className="text-xs text-muted-foreground">{metrics.activeUsers.agents} Agents</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-security">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos de Segurança (24h)</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-security-events">
              {metrics.securityEvents.total}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.securityEvents.failedLogins} tentativas de login falhas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tokens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Uso de Tokens da API OpenAI (Últimos 30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.tokenUsage}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs" 
                tick={{ fill: 'currentColor' }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
              />
              <Line 
                type="monotone" 
                dataKey="tokens" 
                stroke="#8b5cf6" 
                strokeWidth={2} 
                name="Tokens" 
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Atividade Recente */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.recentActivity.length > 0 ? (
            <div className="space-y-2">
              {metrics.recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover-elevate">
                  <Badge 
                    variant={
                      activity.type === 'error' ? 'destructive' : 
                      activity.type === 'warning' ? 'secondary' : 
                      'default'
                    }
                    className="mt-0.5"
                  >
                    {activity.type.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.timestamp ? new Date(activity.timestamp).toLocaleString('pt-BR') : 'Data desconhecida'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma atividade recente
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
