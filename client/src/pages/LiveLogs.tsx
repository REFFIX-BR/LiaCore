import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, Pause, Play, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WebhookLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  event: string;
  message: string;
  details?: any;
}

export default function LiveLogs() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/webhook-logs`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('🔌 Conectado ao monitor de logs');
    };
    
    websocket.onmessage = (event) => {
      if (isPaused) return;
      
      const data = JSON.parse(event.data);
      
      if (data.type === 'history') {
        setLogs(data.logs);
      } else if (data.type === 'new') {
        setLogs(prev => [...prev, data.log].slice(-500)); // Manter últimos 500
      }
    };
    
    websocket.onerror = (error) => {
      console.error('❌ Erro no WebSocket:', error);
    };
    
    websocket.onclose = () => {
      console.log('🔌 Desconectado do monitor de logs');
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, [isPaused]);

  const filteredLogs = eventFilter === "all" 
    ? logs 
    : logs.filter(log => {
        if (eventFilter === "routing") {
          return log.event.includes('ROUTED') || log.event.includes('TRANSFER');
        }
        if (eventFilter === "messages") {
          return log.event.includes('MESSAGE') || log.event.includes('AI_RESPONSE');
        }
        if (eventFilter === "errors") {
          return log.type === 'error';
        }
        return log.event === eventFilter;
      });

  const getTypeColor = (type: WebhookLog['type']) => {
    switch (type) {
      case 'success': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'error': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'warning': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'info': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getTypeEmoji = (type: WebhookLog['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Logs em Tempo Real</h1>
          <p className="text-muted-foreground">
            Monitoramento de eventos do sistema via WebSocket
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-filter">
              <SelectValue placeholder="Filtrar eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              <SelectItem value="routing">🔀 Roteamento</SelectItem>
              <SelectItem value="messages">💬 Mensagens</SelectItem>
              <SelectItem value="errors">❌ Erros</SelectItem>
              <SelectItem value="MESSAGE_RECEIVED">📥 Recebidas</SelectItem>
              <SelectItem value="AI_RESPONSE">🤖 Respostas IA</SelectItem>
              <SelectItem value="CONVERSATION_ROUTED">🎯 Roteadas</SelectItem>
              <SelectItem value="TRANSFER_TO_HUMAN">👤 Transferências</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={isPaused ? "default" : "outline"}
            size="icon"
            onClick={togglePause}
            data-testid="button-pause-toggle"
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={clearLogs}
            data-testid="button-clear-logs"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total">{filteredLogs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sucessos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-success">
              {logs.filter(l => l.type === 'success').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-errors">
              {logs.filter(l => l.type === 'error').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={ws?.readyState === WebSocket.OPEN ? "default" : "destructive"} data-testid="status-connection">
              {ws?.readyState === WebSocket.OPEN ? '🟢 Conectado' : '🔴 Desconectado'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isPaused && <Badge variant="secondary">⏸️ Pausado</Badge>}
            Eventos do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum log disponível
                </div>
              ) : (
                filteredLogs.slice().reverse().map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${getTypeColor(log.type)}`}
                    data-testid={`log-${log.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{getTypeEmoji(log.type)}</span>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.event}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        
                        <p className="text-sm font-medium">{log.message}</p>
                        
                        {log.details && (
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">
                              Ver detalhes
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
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
