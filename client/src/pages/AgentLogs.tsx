import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, AlertCircle, Pause, Play, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface AgentLog {
  id: string;
  timestamp: string;
  type: 'reasoning' | 'routing' | 'function_call' | 'decision' | 'error';
  assistantType: string;
  assistantName: string;
  event: string;
  message: string;
  details?: {
    conversationId?: string;
    chatId?: string;
    clientName?: string;
    fromAssistant?: string;
    toAssistant?: string;
    functionName?: string;
    functionArgs?: any;
    reasoning?: string;
    decision?: string;
    confidence?: number;
    [key: string]: any;
  };
}

export default function AgentLogs() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedLogsRef = useRef<AgentLog[]>([]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/agent-logs`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🤖 Conectado ao Agent Logs WebSocket');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'history') {
        setLogs(data.logs);
      } else if (data.type === 'new') {
        if (isPaused) {
          pausedLogsRef.current.push(data.log);
        } else {
          setLogs((prev) => [...prev, data.log]);
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }, 100);
        }
      } else if (data.type === 'clear') {
        setLogs([]);
      }
    };

    ws.onerror = (error) => {
      console.error('Agent Logs WebSocket error:', error);
      console.error('Agent Logs WebSocket URL was:', wsUrl);
      console.error('Agent Logs WebSocket readyState:', ws.readyState);
    };

    ws.onclose = () => {
      console.log('🤖 Desconectado do Agent Logs WebSocket');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (!isPaused && pausedLogsRef.current.length > 0) {
      setLogs((prev) => [...prev, ...pausedLogsRef.current]);
      pausedLogsRef.current = [];
    }
  }, [isPaused]);

  const handleClearLogs = async () => {
    try {
      await fetch('/api/agent-logs/clear', { method: 'POST' });
      setLogs([]);
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'reasoning': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'routing': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'function_call': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'decision': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'error': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reasoning': return '🧠';
      case 'routing': return '🔀';
      case 'function_call': return '🛠️';
      case 'decision': return '🎯';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  const getAssistantColor = (assistantType: string) => {
    const colors: Record<string, string> = {
      'apresentacao': 'bg-indigo-500/10 text-indigo-500',
      'comercial': 'bg-green-500/10 text-green-500',
      'financeiro': 'bg-blue-500/10 text-blue-500',
      'suporte': 'bg-orange-500/10 text-orange-500',
      'ouvidoria': 'bg-red-500/10 text-red-500',
      'cancelamento': 'bg-gray-500/10 text-gray-500',
      'cortex': 'bg-purple-500/10 text-purple-500',
    };
    return colors[assistantType] || 'bg-muted text-muted-foreground';
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.type === filter;
  });

  const stats = logs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8" />
            Agent Reasoning Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitore os raciocínios, decisões e ações dos assistentes de IA em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "destructive"} data-testid="badge-connection">
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Raciocínios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats['reasoning'] || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Roteamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats['routing'] || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Funções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats['function_call'] || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Decisões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats['decision'] || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filtros e Controles</CardTitle>
              <CardDescription>Filtre e controle a visualização dos logs</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
                data-testid="button-pause-logs"
              >
                {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                {isPaused ? "Retomar" : "Pausar"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearLogs}
                data-testid="button-clear-logs"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {["all", "reasoning", "routing", "function_call", "decision", "error"].map((type) => (
              <Button
                key={type}
                variant={filter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(type)}
                data-testid={`filter-${type}`}
              >
                {type === "all" ? "Todos" : 
                 type === "reasoning" ? "Raciocínios" :
                 type === "routing" ? "Roteamentos" :
                 type === "function_call" ? "Funções" :
                 type === "decision" ? "Decisões" : "Erros"}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Logs em Tempo Real</CardTitle>
          <CardDescription>
            {filteredLogs.length} log(s) {filter !== "all" && `filtrado(s) por ${filter}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]" data-testid="scroll-logs">
            <div className="space-y-3">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Brain className="w-12 h-12 mb-4 opacity-50" />
                  <p>Nenhum log de agente ainda</p>
                  <p className="text-sm">Os logs aparecerão quando os assistentes processarem mensagens</p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogs.has(log.id);
                  return (
                    <div
                      key={log.id}
                      className={`p-4 rounded-lg border ${getTypeColor(log.type)} transition-all`}
                      data-testid={`log-${log.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="text-2xl">{getTypeIcon(log.type)}</div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={getAssistantColor(log.assistantType)}>
                                {log.assistantName}
                              </Badge>
                              <Badge variant="outline" className={getTypeColor(log.type)}>
                                {log.event}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                              </span>
                            </div>
                            <p className="font-medium">{log.message}</p>
                            
                            {log.details && Object.keys(log.details).length > 0 && (
                              <div className="mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleExpand(log.id)}
                                  className="h-6 px-2"
                                  data-testid={`button-expand-${log.id}`}
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="w-3 h-3 mr-1" />
                                      Ocultar detalhes
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-3 h-3 mr-1" />
                                      Ver detalhes
                                    </>
                                  )}
                                </Button>
                                {isExpanded && (
                                  <div className="mt-2 p-3 bg-muted/30 rounded-md">
                                    <pre className="text-xs overflow-x-auto">
                                      {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {isPaused && pausedLogsRef.current.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm font-medium">
            {pausedLogsRef.current.length} novo(s) log(s) pausado(s)
          </p>
        </div>
      )}
    </div>
  );
}
