import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, RefreshCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface UnansweredConversation {
  id: string;
  chat_id: string;
  client_name: string;
  status: string;
  last_message_time: string;
  last_message_role: string;
  last_message_preview: string;
  whatsapp_status: string | null;
  minutes_ago: number;
}

export default function SystemHealth() {
  const { toast } = useToast();
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const { data: unansweredConvs, isLoading, refetch } = useQuery<UnansweredConversation[]>({
    queryKey: ["/api/admin/unanswered-conversations"],
  });

  const handleReprocess = async (conv: UnansweredConversation) => {
    setProcessing(prev => new Set(prev).add(conv.id));
    
    try {
      const response = await fetch(`/api/admin/reprocess-conversation/${conv.id}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Falha ao reprocessar conversa");
      }

      toast({
        title: "Conversa reprocessada",
        description: `A conversa de ${conv.client_name} foi adicionada à fila para reprocessamento.`,
      });

      // Refresh after 2 seconds
      setTimeout(() => refetch(), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao reprocessar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setProcessing(prev => {
        const newSet = new Set(prev);
        newSet.delete(conv.id);
        return newSet;
      });
    }
  };

  const getSeverityBadge = (minutesAgo: number) => {
    if (minutesAgo < 5) {
      return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Recente</Badge>;
    } else if (minutesAgo < 15) {
      return <Badge variant="default" className="gap-1"><AlertTriangle className="w-3 h-3" /> Atenção</Badge>;
    } else {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Crítico</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const recentCount = unansweredConvs?.filter((c: UnansweredConversation) => c.minutes_ago < 5).length || 0;
  const warningCount = unansweredConvs?.filter((c: UnansweredConversation) => c.minutes_ago >= 5 && c.minutes_ago < 15).length || 0;
  const criticalCount = unansweredConvs?.filter((c: UnansweredConversation) => c.minutes_ago >= 15).length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Saúde do Sistema</h1>
          <p className="text-muted-foreground mt-1">
            Monitore conversas sem resposta da IA e reprocesse mensagens travadas
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          variant="outline" 
          className="gap-2"
          data-testid="button-refresh"
        >
          <RefreshCcw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unansweredConvs?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Conversas sem resposta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{recentCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{'< 5 minutos'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Atenção</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{warningCount}</div>
            <p className="text-xs text-muted-foreground mt-1">5-15 minutos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Críticos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{'>15 minutos'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Conversas Aguardando Resposta da IA
          </CardTitle>
          <CardDescription>
            Conversas ativas onde a última mensagem foi do cliente mas a IA não respondeu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!unansweredConvs || unansweredConvs.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium">Sistema Saudável!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Todas as conversas foram respondidas pela IA
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unansweredConvs.map((conv: UnansweredConversation) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`conv-${conv.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium truncate">{conv.client_name}</h3>
                      {getSeverityBadge(conv.minutes_ago)}
                      <Badge variant="outline" className="text-xs">
                        {conv.status}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground truncate mb-1">
                      {conv.last_message_preview}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(conv.last_message_time), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                      <span className="font-mono">{conv.chat_id}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleReprocess(conv)}
                    disabled={processing.has(conv.id)}
                    variant="outline"
                    size="sm"
                    className="ml-4"
                    data-testid={`button-reprocess-${conv.id}`}
                  >
                    {processing.has(conv.id) ? (
                      <>
                        <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Reprocessar
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
