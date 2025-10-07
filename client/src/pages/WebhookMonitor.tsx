import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Wifi, 
  WifiOff, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  Trash2,
  RefreshCw,
  MessageSquare,
  Send,
  Clock
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";

interface WebhookLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  event: string;
  message: string;
  details?: any;
}

interface WebhookStats {
  total: number;
  last5Minutes: number;
  lastHour: number;
  byType: {
    info: number;
    success: number;
    error: number;
    warning: number;
  };
  connectedClients: number;
}

export default function WebhookMonitor() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [filter, setFilter] = useState<'all' | WebhookLog['type']>('all');
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Query webhook stats
  const { data: stats, refetch: refetchStats } = useQuery<WebhookStats>({
    queryKey: ['/api/webhook-logs/stats'],
    refetchInterval: 5000,
  });

  // Clear logs mutation
  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/webhook-logs/clear');
    },
    onSuccess: () => {
      setLogs([]);
      toast({
        title: "Logs limpos",
        description: "Histórico de logs foi apagado",
      });
      refetchStats();
    },
  });

  // Setup WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/webhook-logs`;
    
    console.log('🔌 Conectando ao WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket conectado');
      setWsConnected(true);
      toast({
        title: "Conectado",
        description: "Monitor em tempo real ativado",
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'history') {
          setLogs(data.logs);
        } else if (data.type === 'new') {
          setLogs(prev => [...prev, data.log]);
          refetchStats();
        } else if (data.type === 'clear') {
          setLogs([]);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ Erro no WebSocket:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket desconectado');
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.type === filter);

  const getLogIcon = (type: WebhookLog['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogBadgeVariant = (type: WebhookLog['type']) => {
    switch (type) {
      case 'success': return 'default';
      case 'error': return 'destructive';
      case 'warning': return 'outline';
      case 'info': return 'secondary';
    }
  };

  const getEventIcon = (event: string) => {
    if (event.includes('MESSAGE')) return <MessageSquare className="w-3 h-3" />;
    if (event.includes('SENT')) return <Send className="w-3 h-3" />;
    if (event.includes('CONNECTION')) return <Activity className="w-3 h-3" />;
    return <Activity className="w-3 h-3" />;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-webhook-title">
            <Activity className="w-8 h-8" />
            Monitor de Webhook
          </h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe eventos da Evolution API em tempo real
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {wsConnected ? (
            <Badge variant="default" className="gap-2" data-testid="badge-ws-connected">
              <Wifi className="w-3 h-3" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-2" data-testid="badge-ws-disconnected">
              <WifiOff className="w-3 h-3" />
              Desconectado
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-events">
              {stats?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Todos os eventos registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Últimos 5 Minutos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-recent-events">
              {stats?.last5Minutes || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Atividade recente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Última Hora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-hourly-events">
              {stats?.lastHour || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Eventos na última hora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-error-count">
              {stats?.byType.error || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Erros registrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Log de Eventos em Tempo Real</CardTitle>
              <CardDescription>
                Monitoramento instantâneo de webhooks e mensagens
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoScroll(!autoScroll)}
                data-testid="button-toggle-autoscroll"
              >
                {autoScroll ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                Auto-scroll
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStats()}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => clearLogsMutation.mutate()}
                disabled={clearLogsMutation.isPending}
                data-testid="button-clear-logs"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filtrar:</span>
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              data-testid="filter-all"
            >
              Todos ({logs.length})
            </Button>
            <Button
              variant={filter === 'success' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('success')}
              data-testid="filter-success"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Sucesso ({stats?.byType.success || 0})
            </Button>
            <Button
              variant={filter === 'error' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('error')}
              data-testid="filter-error"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Erro ({stats?.byType.error || 0})
            </Button>
            <Button
              variant={filter === 'warning' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('warning')}
              data-testid="filter-warning"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Aviso ({stats?.byType.warning || 0})
            </Button>
            <Button
              variant={filter === 'info' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('info')}
              data-testid="filter-info"
            >
              <Info className="w-3 h-3 mr-1" />
              Info ({stats?.byType.info || 0})
            </Button>
          </div>

          <Separator />

          {/* Logs List */}
          <ScrollArea className="h-[600px]" ref={scrollRef}>
            <div className="space-y-2 pr-4">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Activity className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Nenhum evento registrado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Os eventos aparecerão aqui em tempo real
                  </p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 border rounded-lg hover-elevate"
                    data-testid={`log-entry-${log.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        {getLogIcon(log.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={getLogBadgeVariant(log.type)} className="gap-1">
                              {getEventIcon(log.event)}
                              {log.event}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(log.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm mt-1 font-medium">
                            {log.message}
                          </p>
                          {log.details && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                              <pre className="overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
