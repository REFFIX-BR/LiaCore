import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Users, Clock, TrendingUp, AlertTriangle, Bot, CheckCircle2, UserX, Smile, Frown, Meh, Phone } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocation } from "wouter";

export function SupervisorDashboard() {
  const [, setLocation] = useLocation();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/supervisor"],
    refetchInterval: 30000, // 30 seconds
  });

  const { data: aiMetrics, isLoading: isLoadingAI } = useQuery({
    queryKey: ["/api/dashboard/ai-performance"],
    refetchInterval: 30000, // 30 seconds
  });

  // Fetch voice metrics for cobranças badge
  const { data: voiceMetrics } = useQuery({
    queryKey: ["/api/voice/metrics"],
    refetchInterval: 60000, // 1 minute
    retry: false, // Don't retry if feature is disabled
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Carregando...</div>;
  }

  if (!metrics) {
    return <div className="flex items-center justify-center h-96">Erro ao carregar métricas</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Dashboard do Supervisor</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral da saúde do atendimento, performance da IA e da equipe
          </p>
        </div>
        
        {/* Cobranças Badge - Only show if there are pending promises */}
        {voiceMetrics && voiceMetrics.pendingPromises > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation('/voice/monitor')}
            className="gap-2"
            data-testid="button-cobrancas-alert"
          >
            <Phone className="h-4 w-4" />
            <span>Cobranças</span>
            <Badge variant="destructive" className="ml-1">
              {voiceMetrics.pendingPromises}
            </Badge>
          </Button>
        )}
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
          {isLoadingAI ? (
            <div className="flex items-center justify-center h-96">Carregando métricas de IA...</div>
          ) : !aiMetrics || aiMetrics.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Performance dos Assistentes IA</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Nenhuma métrica disponível ainda. Aguarde conversas serem processadas.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Cards dos Assistentes */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiMetrics.map((assistant: any) => {
                  const sentimentIcon = assistant.avgSentiment > 0.3 ? (
                    <Smile className="h-4 w-4 text-green-600" />
                  ) : assistant.avgSentiment < -0.3 ? (
                    <Frown className="h-4 w-4 text-red-600" />
                  ) : (
                    <Meh className="h-4 w-4 text-yellow-600" />
                  );

                  return (
                    <Card key={assistant.assistantType} className="hover-elevate" data-testid={`card-assistant-${assistant.assistantType}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Bot className="h-5 w-5 text-blue-600" />
                          {assistant.assistantName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Total de conversas */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total de conversas</span>
                          <span className="font-semibold" data-testid={`text-total-${assistant.assistantType}`}>
                            {assistant.totalConversations}
                          </span>
                        </div>

                        {/* Resolvidas pela IA */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            Resolvidas pela IA
                          </span>
                          <span className="font-semibold text-green-600" data-testid={`text-resolved-${assistant.assistantType}`}>
                            {assistant.resolvedByAI}
                          </span>
                        </div>

                        {/* Transferidas */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <UserX className="h-3 w-3 text-orange-600" />
                            Transferidas
                          </span>
                          <span className="font-semibold text-orange-600" data-testid={`text-transferred-${assistant.assistantType}`}>
                            {assistant.transferredToHuman}
                          </span>
                        </div>

                        {/* Taxa de sucesso */}
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Taxa de Sucesso</span>
                            <Badge 
                              variant={assistant.successRate >= 70 ? 'default' : assistant.successRate >= 50 ? 'secondary' : 'destructive'}
                              data-testid={`badge-success-${assistant.assistantType}`}
                            >
                              {assistant.successRate}%
                            </Badge>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                assistant.successRate >= 70 ? 'bg-green-600' :
                                assistant.successRate >= 50 ? 'bg-yellow-600' :
                                'bg-red-600'
                              }`}
                              style={{ width: `${assistant.successRate}%` }}
                            />
                          </div>
                        </div>

                        {/* Sentimento e NPS */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-1">
                            {sentimentIcon}
                            <span className="text-xs text-muted-foreground">Sentimento</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">NPS:</span>
                            <Badge variant={assistant.avgNPS >= 8 ? 'default' : assistant.avgNPS >= 6 ? 'secondary' : 'destructive'}>
                              {assistant.avgNPS || '--'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Gráfico Comparativo */}
              <Card>
                <CardHeader>
                  <CardTitle>Comparativo de Performance dos Assistentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={aiMetrics}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="assistantName" 
                        className="text-xs" 
                        tick={{ fill: 'currentColor' }}
                        angle={-15}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="resolvedByAI" fill="#10b981" name="Resolvidas pela IA" />
                      <Bar dataKey="transferredToHuman" fill="#f59e0b" name="Transferidas" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tabela Detalhada */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento Completo</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assistente</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Resolvidas IA</TableHead>
                        <TableHead className="text-center">Transferidas</TableHead>
                        <TableHead className="text-center">Taxa Sucesso</TableHead>
                        <TableHead className="text-center">NPS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiMetrics.map((assistant: any) => (
                        <TableRow key={assistant.assistantType}>
                          <TableCell className="font-medium">{assistant.assistantName}</TableCell>
                          <TableCell className="text-center">{assistant.totalConversations}</TableCell>
                          <TableCell className="text-center text-green-600 font-semibold">
                            {assistant.resolvedByAI}
                          </TableCell>
                          <TableCell className="text-center text-orange-600 font-semibold">
                            {assistant.transferredToHuman}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={assistant.successRate >= 70 ? 'default' : assistant.successRate >= 50 ? 'secondary' : 'destructive'}
                            >
                              {assistant.successRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={assistant.avgNPS >= 8 ? 'default' : assistant.avgNPS >= 6 ? 'secondary' : 'destructive'}>
                              {assistant.avgNPS || '--'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
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
