import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Activity, Clock, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KPIData {
  activeConversations: number;
  avgResponseTime: string;
  sentiment: {
    label: string;
    percentage: number;
    color: string;
  };
  resolutionRate: number;
}

interface Alert {
  id: string;
  type: "critical_sentiment" | "ai_loop" | "function_failure";
  chatId: string;
  clientName: string;
  message: string;
}

interface AssistantDistribution {
  name: string;
  percentage: number;
  color: string;
}

interface KPIPanelProps {
  kpis: KPIData;
  alerts: Alert[];
  assistantDistribution: AssistantDistribution[];
}

const alertIcons = {
  critical_sentiment: "🚩",
  ai_loop: "↪️",
  function_failure: "⚠️",
};

export function KPIPanel({ kpis, alerts, assistantDistribution }: KPIPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">KPIs em Tempo Real</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Conversas Ativas</p>
              <p className="text-3xl font-bold text-primary">{kpis.activeConversations}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tempo Médio de Resposta</p>
              <p className="text-3xl font-bold text-chart-2">{kpis.avgResponseTime}</p>
            </div>
          </div>
          
          <div>
            <p className="text-xs text-muted-foreground mb-1">Sentimento Médio (Última Hora)</p>
            <div className="flex items-center gap-2">
              <Badge className={kpis.sentiment.color}>
                {kpis.sentiment.label} ({kpis.sentiment.percentage}%)
              </Badge>
            </div>
          </div>
          
          <div>
            <p className="text-xs text-muted-foreground mb-1">Taxa de Resolução Automatizada</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{kpis.resolutionRate}%</p>
              <CheckCircle2 className="h-5 w-5 text-chart-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Distribuição de Assistentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {assistantDistribution.map((dist) => (
              <div key={dist.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{dist.name}</span>
                  <span className="font-medium">{dist.percentage}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={dist.color}
                    style={{ width: `${dist.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Alertas Críticos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum alerta crítico
                </p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{alertIcons[alert.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-destructive">
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Chat #{alert.chatId} ({alert.clientName})
                        </p>
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
