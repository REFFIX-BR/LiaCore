import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, CheckCircle2, Clock, TrendingUp, Activity } from "lucide-react";

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

export default function AgentMonitor() {
  const { data: agents = [], isLoading } = useQuery<AgentStatus[]>({
    queryKey: ["/api/agents/status"],
    refetchInterval: 5000, // Update every 5 seconds
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
          {agents.map((agent) => (
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
