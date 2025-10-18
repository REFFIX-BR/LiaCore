import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  DollarSign, 
  Users, 
  Shield, 
  TrendingUp, 
  Database,
  Cpu,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Server,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Zap,
  Bot,
  UserX,
  Smile,
  Frown,
  Meh
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminMetrics {
  systemStatus: {
    api: boolean;
    database: boolean;
    workers: boolean;
  };
  estimatedCost: {
    total: number;
    openai: number;
    upstash: number;
  };
  activeUsers: {
    total: number;
    admins: number;
    supervisors: number;
    agents: number;
  };
  securityEvents: {
    total: number;
    failedLogins: number;
  };
  tokenUsage: Array<{
    date: string;
    tokens: number;
  }>;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string | null;
  }>;
}

export function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: metrics, isLoading } = useQuery<AdminMetrics>({
    queryKey: ["/api/dashboard/admin"],
    refetchInterval: 30000, // 30 seconds
  });

  const { data: aiMetrics, isLoading: isLoadingAI } = useQuery({
    queryKey: ["/api/dashboard/ai-performance"],
    refetchInterval: 30000, // 30 seconds
  });

  const reprocessMutation = useMutation({
    mutationFn: async (params: { assistantType?: string; maxMinutesWaiting?: number }) => {
      const response = await fetch('/api/admin/reprocess-stuck-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Erro ao reprocessar mensagens');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Mensagens Reprocessadas",
        description: `${data.enqueued} mensagem(ns) enfileirada(s) para processamento`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Reprocessar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const closeAbandonedMutation = useMutation({
    mutationFn: async (params: { minMinutesInactive?: number }) => {
      const response = await fetch('/api/admin/close-abandoned-conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Erro ao fechar conversas abandonadas');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Conversas Fechadas com Sucesso",
        description: `${data.closed} conversa(s) fechada(s) e NPS agendado para envio`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/admin"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Fechar Conversas",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Erro ao carregar métricas</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-destructive" />
    );
  };

  const getStatusColor = (status: boolean) => {
    return status ? "text-green-600" : "text-destructive";
  };

  // Calcular % de mudança (mock)
  const costChange = 12.5;
  const usersChange = 8.3;
  const securityChange = -15.2;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-dashboard">
            Dashboard Administrativo
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral completa do sistema, performance e custos operacionais
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Activity className="h-3 w-3" />
          Atualização automática: 30s
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system" data-testid="tab-system">Sistema</TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">Performance IA</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-6">
          {/* System Health - Grid 3 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover-elevate" data-testid="card-api-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">API Status</CardTitle>
            {getStatusIcon(metrics.systemStatus.api)}
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={`text-2xl font-bold ${getStatusColor(metrics.systemStatus.api)}`}>
                {metrics.systemStatus.api ? 'Operacional' : 'Offline'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Express + Vite</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-database-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Database Status</CardTitle>
            {getStatusIcon(metrics.systemStatus.database)}
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={`text-2xl font-bold ${getStatusColor(metrics.systemStatus.database)}`}>
                {metrics.systemStatus.database ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">PostgreSQL (Neon)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-workers-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Workers Status</CardTitle>
            {getStatusIcon(metrics.systemStatus.workers)}
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={`text-2xl font-bold ${getStatusColor(metrics.systemStatus.workers)}`}>
                {metrics.systemStatus.workers ? 'Ativos' : 'Inativos'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">BullMQ + Redis</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Principais - Grid 4 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate" data-testid="card-total-cost">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total (Mês)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-cost">
              ${metrics.estimatedCost.total.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 mt-2">
              {costChange > 0 ? (
                <>
                  <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-medium text-destructive">+{costChange}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-600">{costChange}%</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">vs. mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-active-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-active-users">
              {metrics.activeUsers.total}
            </div>
            <div className="flex items-center gap-1 mt-2">
              {usersChange > 0 ? (
                <>
                  <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-600">+{usersChange}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-medium text-destructive">{usersChange}%</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">hoje</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-security">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos de Segurança</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-security-events">
              {metrics.securityEvents.total}
            </div>
            <div className="flex items-center gap-1 mt-2">
              {securityChange < 0 ? (
                <>
                  <ArrowDownRight className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-600">{securityChange}%</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-medium text-destructive">+{securityChange}%</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">últimas 24h</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-failed-logins">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logins Falhados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive" data-testid="text-failed-logins">
              {metrics.securityEvents.failedLogins}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Últimas 24 horas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Actions */}
      <Card className="border-primary/20" data-testid="card-admin-actions">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Ações Administrativas
          </CardTitle>
          <CardDescription>
            Ferramentas para manutenção e correção do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => reprocessMutation.mutate({ assistantType: 'apresentacao', maxMinutesWaiting: 120 })}
                disabled={reprocessMutation.isPending}
                variant="outline"
                className="flex items-center gap-2"
                data-testid="button-reprocess-messages"
              >
                {reprocessMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Reprocessando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Reprocessar Mensagens Travadas (Apresentação)
                  </>
                )}
              </Button>
              <Button
                onClick={() => reprocessMutation.mutate({ maxMinutesWaiting: 60 })}
                disabled={reprocessMutation.isPending}
                variant="outline"
                className="flex items-center gap-2"
                data-testid="button-reprocess-all"
              >
                {reprocessMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Reprocessando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Reprocessar Todas (Recentes)
                  </>
                )}
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => closeAbandonedMutation.mutate({ minMinutesInactive: 30 })}
                disabled={closeAbandonedMutation.isPending}
                variant="destructive"
                className="flex items-center gap-2"
                data-testid="button-close-abandoned"
              >
                {closeAbandonedMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    Fechando...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Fechar Conversas Abandonadas (+30min) + Enviar NPS
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <strong>Reprocessar:</strong> Reenfileira mensagens sem resposta da IA. <strong>Fechar Abandonadas:</strong> Finaliza conversas inativas (&gt;30min) e envia NPS automaticamente.
          </p>
        </CardContent>
      </Card>

      {/* Analytics Row - Costs & Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Breakdown de Custos
            </CardTitle>
            <CardDescription>Distribuição de gastos mensais estimados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#8b5cf6]" />
                    <span className="text-sm font-medium">OpenAI API</span>
                  </div>
                  <span className="text-sm font-bold">${metrics.estimatedCost.openai.toFixed(2)}</span>
                </div>
                <Progress 
                  value={metrics.estimatedCost.total > 0 ? (metrics.estimatedCost.openai / metrics.estimatedCost.total) * 100 : 0} 
                  className="h-2"
                  data-testid="progress-openai-cost"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.estimatedCost.total > 0 ? ((metrics.estimatedCost.openai / metrics.estimatedCost.total) * 100).toFixed(1) : 0}% do total
                </p>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#06b6d4]" />
                    <span className="text-sm font-medium">Upstash (Redis + Vector)</span>
                  </div>
                  <span className="text-sm font-bold">${metrics.estimatedCost.upstash.toFixed(2)}</span>
                </div>
                <Progress 
                  value={metrics.estimatedCost.total > 0 ? (metrics.estimatedCost.upstash / metrics.estimatedCost.total) * 100 : 0} 
                  className="h-2"
                  data-testid="progress-upstash-cost"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.estimatedCost.total > 0 ? ((metrics.estimatedCost.upstash / metrics.estimatedCost.total) * 100).toFixed(1) : 0}% do total
                </p>
              </div>

              <Separator />

              <div className="pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Custo por conversa (estimado)</span>
                  <span className="text-sm font-bold">~$0.15</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm font-medium">Projeção diária</span>
                  <span className="text-sm font-bold">${(metrics.estimatedCost.total / 30).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Distribuição de Usuários
            </CardTitle>
            <CardDescription>Usuários ativos hoje por função</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">ADMIN</Badge>
                    <span className="text-sm font-medium">Administradores</span>
                  </div>
                  <span className="text-sm font-bold" data-testid="text-admin-count">{metrics.activeUsers.admins}</span>
                </div>
                <Progress 
                  value={metrics.activeUsers.total > 0 ? (metrics.activeUsers.admins / metrics.activeUsers.total) * 100 : 0} 
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">SUPERVISOR</Badge>
                    <span className="text-sm font-medium">Supervisores</span>
                  </div>
                  <span className="text-sm font-bold" data-testid="text-supervisor-count">{metrics.activeUsers.supervisors}</span>
                </div>
                <Progress 
                  value={metrics.activeUsers.total > 0 ? (metrics.activeUsers.supervisors / metrics.activeUsers.total) * 100 : 0} 
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">AGENT</Badge>
                    <span className="text-sm font-medium">Agentes</span>
                  </div>
                  <span className="text-sm font-bold" data-testid="text-agent-count">{metrics.activeUsers.agents}</span>
                </div>
                <Progress 
                  value={metrics.activeUsers.total > 0 ? (metrics.activeUsers.agents / metrics.activeUsers.total) * 100 : 0} 
                  className="h-2"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium">Total de usuários ativos</span>
                <span className="text-2xl font-bold">{metrics.activeUsers.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Token Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Uso de Tokens OpenAI
          </CardTitle>
          <CardDescription>Consumo de tokens nos últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={metrics.tokenUsage}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                className="text-xs" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis 
                className="text-xs" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                formatter={(value: number) => [`${value.toLocaleString()} tokens`, 'Consumo']}
              />
              <Area 
                type="monotone" 
                dataKey="tokens" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorTokens)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Atividade Recente do Sistema
          </CardTitle>
          <CardDescription>Últimas 10 ações e eventos relevantes</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {metrics.recentActivity.map((activity, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start gap-3 p-3 rounded-lg hover-elevate border border-border/50"
                  data-testid={`activity-${idx}`}
                >
                  <Badge 
                    variant={
                      activity.type === 'error' ? 'destructive' : 
                      activity.type === 'warning' ? 'secondary' : 
                      'default'
                    }
                    className="mt-0.5 shrink-0"
                  >
                    {activity.type.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.message}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {activity.timestamp ? new Date(activity.timestamp).toLocaleString('pt-BR') : 'Data desconhecida'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente registrada</p>
            </div>
          )}
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
                As métricas de IA estão disponíveis na página <strong>"Conhecimento & IA" → "Assistentes"</strong> no menu lateral.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
