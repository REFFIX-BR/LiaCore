import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, MessageSquare, CheckCircle2, Clock, TrendingUp, Activity, Filter, CalendarIcon } from "lucide-react";
import { format } from "date-fns";

type AgentStatus = {
  id: string;
  fullName: string;
  role: string;
  status: 'online' | 'idle' | 'offline';
  activeConversations: number;
  resolvedToday: number;
  avgResponseTime: number;
  successRate: number;
  sentimentAverage: string;
  lastActivity: Date | null;
};

type PeriodFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

export default function AgentMonitor() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  // Memoizar datas para evitar loop infinito de refetch
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (periodFilter) {
      case 'today':
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
        return {
          startDate: today.toISOString(),
          endDate: endOfToday.toISOString()
        };
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const endOfWeek = new Date();
        endOfWeek.setHours(23, 59, 59, 999);
        return {
          startDate: weekAgo.toISOString(),
          endDate: endOfWeek.toISOString()
        };
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const endOfMonth = new Date();
        endOfMonth.setHours(23, 59, 59, 999);
        return {
          startDate: monthAgo.toISOString(),
          endDate: endOfMonth.toISOString()
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
  }, [periodFilter, customStartDate, customEndDate]);

  const queryParams = new URLSearchParams();
  if (dateRange.startDate) queryParams.set('startDate', dateRange.startDate);
  if (dateRange.endDate) queryParams.set('endDate', dateRange.endDate);
  const queryString = queryParams.toString();
  
  const apiUrl = queryString 
    ? `/api/agents/status?${queryString}` 
    : '/api/agents/status';

  // Desabilitar query se período custom sem datas selecionadas
  const isQueryEnabled = periodFilter !== 'custom' || Boolean(customStartDate && customEndDate);

  const { data: agents = [], isLoading } = useQuery<AgentStatus[]>({
    queryKey: ['/api/agents/status', periodFilter, dateRange.startDate || null, dateRange.endDate || null],
    queryFn: async (): Promise<AgentStatus[]> => {
      const response = await fetch(apiUrl, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Erro ao carregar status: ${response.status}`);
      }
      return response.json();
    },
    enabled: isQueryEnabled,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Carregando status dos atendentes...</p>
      </div>
    );
  }

  const getStatusColor = (status: 'online' | 'idle' | 'offline') => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'idle':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-red-500';
    }
  };

  const getStatusLabel = (status: 'online' | 'idle' | 'offline') => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'idle':
        return 'Ocioso';
      case 'offline':
        return 'Offline';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  // Ordenar atendentes: Online → Ociosos → Offline
  const getStatusPriority = (status: 'online' | 'idle' | 'offline') => {
    switch (status) {
      case 'online': return 1;
      case 'idle': return 2;
      case 'offline': return 3;
    }
  };

  const sortedAgents = [...agents].sort((a, b) => {
    const priorityA = getStatusPriority(a.status);
    const priorityB = getStatusPriority(b.status);
    
    // Se mesma prioridade, ordenar por nome
    if (priorityA === priorityB) {
      return a.fullName.localeCompare(b.fullName);
    }
    
    return priorityA - priorityB;
  });

  const totalActive = agents.filter(a => a.status === 'online').length;
  const totalIdle = agents.filter(a => a.status === 'idle').length;
  const totalOffline = agents.filter(a => a.status === 'offline').length;
  const totalConversations = agents.reduce((sum, a) => sum + a.activeConversations, 0);
  const totalResolvedToday = agents.reduce((sum, a) => sum + a.resolvedToday, 0);

  return (
    <div className="space-y-6" data-testid="page-agent-monitor">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <Users className="h-6 w-6" />
          Dashboard de Atendentes
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitoramento em tempo real da equipe de atendimento humano
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
                        if (date && customEndDate) {
                          setPeriodFilter('custom');
                        }
                      }}
                      initialFocus
                      data-testid="calendar-start-date"
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-sm text-muted-foreground">até</span>

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
                        if (customStartDate && date) {
                          setPeriodFilter('custom');
                        }
                      }}
                      initialFocus
                      data-testid="calendar-end-date"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="hover-elevate" data-testid="card-total-agents">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Atendentes</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-agents">{agents.length}</div>
            <p className="text-xs text-muted-foreground">Equipe completa</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-online">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-online">{totalActive}</div>
            <p className="text-xs text-muted-foreground">Ativos agora</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-idle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ociosos</CardTitle>
            <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-idle">{totalIdle}</div>
            <p className="text-xs text-muted-foreground">Sem atividade</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-conversations">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
            <MessageSquare className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-conversations">{totalConversations}</div>
            <p className="text-xs text-muted-foreground">Conversas ativas</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-resolved">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizadas Hoje</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-resolved">{totalResolvedToday}</div>
            <p className="text-xs text-muted-foreground">Total da equipe</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cards Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Equipe de Atendimento</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedAgents.map((agent) => (
            <Card 
              key={agent.id} 
              className="hover-elevate relative overflow-hidden"
              data-testid={`card-agent-${agent.id}`}
            >
              {/* Status Indicator */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${getStatusColor(agent.status)}`}></div>
              
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{agent.fullName}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{agent.role}</p>
                  </div>
                  <Badge 
                    variant={agent.status === 'online' ? 'default' : 'secondary'}
                    className={
                      agent.status === 'online' 
                        ? 'bg-green-600' 
                        : agent.status === 'idle' 
                        ? 'bg-yellow-600' 
                        : 'bg-red-600'
                    }
                    data-testid={`badge-status-${agent.id}`}
                  >
                    {getStatusLabel(agent.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-blue-600" />
                      <span className="text-xs text-muted-foreground">Ativas</span>
                    </div>
                    <p className="text-lg font-semibold" data-testid={`text-active-${agent.id}`}>
                      {agent.activeConversations}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      <span className="text-xs text-muted-foreground">Finalizadas</span>
                    </div>
                    <p className="text-lg font-semibold" data-testid={`text-resolved-${agent.id}`}>
                      {agent.resolvedToday}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-purple-600" />
                      <span className="text-xs text-muted-foreground">Sucesso</span>
                    </div>
                    <p className="text-lg font-semibold">{agent.successRate}%</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Activity className={`h-3 w-3 ${getSentimentColor(agent.sentimentAverage)}`} />
                      <span className="text-xs text-muted-foreground">Sentimento</span>
                    </div>
                    <p className={`text-lg font-semibold capitalize ${getSentimentColor(agent.sentimentAverage)}`}>
                      {agent.sentimentAverage}
                    </p>
                  </div>
                </div>

                {/* Last Activity */}
                {agent.lastActivity && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        Última atividade: {new Date(agent.lastActivity).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {agents.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">Nenhum atendente encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
