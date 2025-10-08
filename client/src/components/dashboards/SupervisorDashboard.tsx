import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Users, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SupervisorDashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/supervisor"],
    refetchInterval: 30000, // 30 seconds
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Carregando...</div>;
  }

  if (!metrics) {
    return <div className="flex items-center justify-center h-96">Erro ao carregar métricas</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Dashboard do Supervisor</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral da saúde do atendimento, performance da IA e da equipe
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">Performance IA</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* KPIs Globais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover-elevate" data-testid="card-active">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
                <MessageSquare className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-count">{metrics.activeConversations}</div>
                <p className="text-xs text-muted-foreground">Em atendimento</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-queue">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fila de Transferência</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600" data-testid="text-queue-count">
                  {metrics.queuedForTransfer}
                </div>
                <p className="text-xs text-muted-foreground">Aguardando atendente</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-tma">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">T.M.A. Global</CardTitle>
                <Clock className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-tma">
                  {metrics.avgResponseTime > 0 ? `${Math.floor(metrics.avgResponseTime / 60)}m ${metrics.avgResponseTime % 60}s` : '--'}
                </div>
                <p className="text-xs text-muted-foreground">Tempo médio</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-nps">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">NPS Global</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-nps">{metrics.globalNPS}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.globalNPS >= 75 ? 'Bom' : metrics.globalNPS >= 50 ? 'Regular' : 'Atenção'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico Volume vs Sucesso */}
          <Card>
            <CardHeader>
              <CardTitle>Volume de Conversas vs. Taxa de Sucesso da IA (Últimas 24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.volumeVsSuccess}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" tick={{ fill: 'currentColor' }} />
                  <YAxis yAxisId="left" className="text-xs" tick={{ fill: 'currentColor' }} />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" tick={{ fill: 'currentColor' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="volume" fill="#3b82f6" name="Volume" />
                  <Line yAxisId="right" type="monotone" dataKey="successRate" stroke="#10b981" strokeWidth={2} name="Taxa de Sucesso (%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance dos Assistentes IA</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Métricas detalhadas de cada assistente estarão disponíveis em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {/* Tabela da Equipe */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Status da Equipe em Tempo Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atendente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Ativas</TableHead>
                    <TableHead className="text-center">Finalizadas Hoje</TableHead>
                    <TableHead className="text-center">T.M.A.</TableHead>
                    <TableHead className="text-center">NPS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.teamStatus.map((agent) => (
                    <TableRow key={agent.userId}>
                      <TableCell className="font-medium">{agent.userName}</TableCell>
                      <TableCell>
                        <Badge variant={agent.status === 'Online' ? 'default' : 'secondary'}>
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{agent.activeConversations}</TableCell>
                      <TableCell className="text-center">{agent.finishedToday}</TableCell>
                      <TableCell className="text-center">
                        {agent.avgTime > 0 ? `${Math.floor(agent.avgTime / 60)}m` : '--'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={agent.nps >= 80 ? 'default' : agent.nps >= 50 ? 'secondary' : 'destructive'}>
                          {agent.nps || '--'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {metrics.teamStatus.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum agente disponível
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
