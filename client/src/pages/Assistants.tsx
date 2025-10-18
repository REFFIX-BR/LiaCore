import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bot,
  TrendingUp,
  Clock,
  MessageSquare,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Activity,
  BarChart3,
  History,
  CalendarIcon,
  Filter
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface AssistantMetrics {
  assistantType: string;
  totalConversations: number;
  resolvedConversations: number;
  transferredConversations: number;
  successRate: number;
  avgDuration: number;
  avgSentiment: string;
  lastUpdate?: string;
}

interface AssistantStats {
  overview: {
    totalConversations: number;
    totalResolved: number;
    totalTransferred: number;
    overallSuccessRate: number;
  };
  assistants: AssistantMetrics[];
  updates: Array<{
    assistantType: string;
    date: string;
    modificationType: string;
    appliedBy: string;
  }>;
  transfers: Array<{
    assistantType: string;
    count: number;
    reasons: string[];
  }>;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

export default function Assistants() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  // Calcular datas com base no filtro
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (periodFilter) {
      case 'today':
        return {
          startDate: today.toISOString(),
          endDate: now.toISOString()
        };
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return {
          startDate: weekAgo.toISOString(),
          endDate: now.toISOString()
        };
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return {
          startDate: monthAgo.toISOString(),
          endDate: now.toISOString()
        };
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            startDate: customStartDate.toISOString(),
            endDate: customEndDate.toISOString()
          };
        }
        return {};
      default:
        return {};
    }
  };

  const dateRange = getDateRange();
  const queryParams = new URLSearchParams();
  if (dateRange.startDate) queryParams.set('startDate', dateRange.startDate);
  if (dateRange.endDate) queryParams.set('endDate', dateRange.endDate);
  const queryString = queryParams.toString();
  
  // Construir URL com parâmetros
  const apiUrl = queryString 
    ? `/api/assistants/metrics?${queryString}` 
    : '/api/assistants/metrics';

  const { data: stats, isLoading, error} = useQuery<AssistantStats>({
    queryKey: [apiUrl],
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  const assistantConfig = [
    { type: "suporte", name: "Suporte Técnico", icon: "🔧", color: "bg-blue-500" },
    { type: "comercial", name: "Comercial", icon: "💼", color: "bg-green-500" },
    { type: "financeiro", name: "Financeiro", icon: "💰", color: "bg-yellow-500" },
    { type: "apresentacao", name: "Apresentação", icon: "👋", color: "bg-purple-500" },
    { type: "ouvidoria", name: "Ouvidoria", icon: "📢", color: "bg-red-500" },
    { type: "cancelamento", name: "Cancelamento", icon: "❌", color: "bg-gray-500" },
  ];

  const getAssistantMetrics = (type: string): AssistantMetrics | undefined => {
    return stats?.assistants?.find(a => a.assistantType === type);
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'text-green-500';
      case 'negative': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 mx-auto animate-pulse" />
          <p className="text-muted-foreground">Carregando métricas dos assistentes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Erro ao Carregar Métricas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Não foi possível carregar as métricas dos assistentes. Tente novamente.
            </p>
            <button 
              onClick={() => queryClient.invalidateQueries({ 
                predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/assistants/metrics') ?? false
              })} 
              className="w-full bg-primary text-primary-foreground py-2 rounded-md hover-elevate"
              data-testid="button-retry-metrics"
            >
              Tentar Novamente
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats || !stats.overview || !stats.assistants) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 mx-auto opacity-50" />
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-assistants-title">
          <Bot className="w-8 h-8" />
          Dashboard de Assistentes
        </h1>
        <p className="text-muted-foreground mt-2">
          Analytics e performance dos assistentes especializados da LIA CORTEX
        </p>
      </div>

      {/* Filtro de Período */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtrar por período:</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={periodFilter === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodFilter('today')}
                data-testid="button-filter-today"
              >
                Hoje
              </Button>
              <Button
                variant={periodFilter === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodFilter('week')}
                data-testid="button-filter-week"
              >
                Semana
              </Button>
              <Button
                variant={periodFilter === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodFilter('month')}
                data-testid="button-filter-month"
              >
                Mês
              </Button>
              <Button
                variant={periodFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodFilter('all')}
                data-testid="button-filter-all"
              >
                Todos
              </Button>

              {/* Date Pickers para período personalizado */}
              <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-custom-start-date">
                      <CalendarIcon className="w-4 h-4" />
                      {customStartDate ? format(customStartDate, 'dd/MM/yyyy') : 'Data inicial'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={(date) => {
                        setCustomStartDate(date);
                        setPeriodFilter('custom');
                      }}
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-muted-foreground">até</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-custom-end-date">
                      <CalendarIcon className="w-4 h-4" />
                      {customEndDate ? format(customEndDate, 'dd/MM/yyyy') : 'Data final'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={(date) => {
                        setCustomEndDate(date);
                        setPeriodFilter('custom');
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Conversas</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-conversations">
              {stats.overview.totalConversations}
            </div>
            <p className="text-xs text-muted-foreground">Atendimentos realizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resoluções</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-resolved">
              {stats.overview.totalResolved}
            </div>
            <p className="text-xs text-muted-foreground">Casos resolvidos pela IA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transferências</CardTitle>
            <ArrowRightLeft className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-transferred">
              {stats.overview.totalTransferred}
            </div>
            <p className="text-xs text-muted-foreground">Enviados para humano</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {stats.overview.overallSuccessRate?.toFixed(1) ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground">Resolvidos sem humano</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance" data-testid="tab-performance">
            <BarChart3 className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="updates" data-testid="tab-updates">
            <History className="w-4 h-4 mr-2" />
            Atualizações
          </TabsTrigger>
          <TabsTrigger value="transfers" data-testid="tab-transfers">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Transferências
          </TabsTrigger>
        </TabsList>

        {/* Tab: Performance */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assistantConfig.map((config) => {
              const metrics = getAssistantMetrics(config.type);
              const successRate = metrics?.successRate || 0;
              
              return (
                <Card key={config.type} className="hover-elevate" data-testid={`card-assistant-${config.type}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center text-2xl`}>
                          {config.icon}
                        </div>
                        <div>
                          <CardTitle className="text-base">{config.name}</CardTitle>
                          <CardDescription className="text-xs capitalize">{config.type}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={successRate >= 80 ? "default" : successRate >= 50 ? "secondary" : "destructive"}>
                        {successRate.toFixed(0)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Taxa de Sucesso</span>
                        <span className="font-medium">{successRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={successRate} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Conversas</p>
                        <p className="text-lg font-bold" data-testid={`text-conversations-${config.type}`}>
                          {metrics?.totalConversations || 0}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Resolvidas</p>
                        <p className="text-lg font-bold text-green-500">
                          {metrics?.resolvedConversations || 0}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Transferidas</p>
                        <p className="text-lg font-bold text-yellow-500">
                          {metrics?.transferredConversations || 0}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Tempo Médio</p>
                        <p className="text-lg font-bold">
                          {Math.round((metrics?.avgDuration || 0) / 60)}min
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Sentimento Médio</span>
                        <span className={`text-sm font-medium capitalize ${getSentimentColor(metrics?.avgSentiment || 'neutral')}`}>
                          {metrics?.avgSentiment || 'neutral'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab: Atualizações */}
        <TabsContent value="updates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Atualizações de Prompts</CardTitle>
              <CardDescription>
                Registro de todas as modificações aprovadas nos assistentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.updates && stats.updates.length > 0 ? (
                <div className="space-y-3">
                  {stats.updates.map((update, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover-elevate">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium capitalize" data-testid={`text-update-assistant-${idx}`}>
                            {update.assistantType}
                          </p>
                          <p className="text-sm text-muted-foreground">{update.modificationType}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{update.appliedBy}</p>
                        <p className="text-xs text-muted-foreground">{update.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma atualização de prompt registrada ainda</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Transferências */}
        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Transferências</CardTitle>
              <CardDescription>
                Assistentes que mais transferem casos para atendimento humano
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.transfers && stats.transfers.length > 0 ? (
                <div className="space-y-4">
                  {stats.transfers
                    .sort((a, b) => b.count - a.count)
                    .map((transfer, idx) => {
                      const config = assistantConfig.find(c => c.type === transfer.assistantType);
                      return (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{config?.icon}</span>
                              <div>
                                <p className="font-medium capitalize">{transfer.assistantType}</p>
                                <p className="text-xs text-muted-foreground">{config?.name}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-yellow-600">
                              {transfer.count} transferências
                            </Badge>
                          </div>
                          {transfer.reasons && transfer.reasons.length > 0 && (
                            <div className="ml-10 space-y-1">
                              {transfer.reasons.slice(0, 3).map((reason, rIdx) => (
                                <p key={rIdx} className="text-sm text-muted-foreground">
                                  • {reason}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma transferência registrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
