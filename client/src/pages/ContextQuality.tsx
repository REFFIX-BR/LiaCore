import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, AlertTriangle, Info, TrendingUp, Clock } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ContextQualityStats {
  totalAlerts: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  period: string;
}

interface ContextAlert {
  conversationId: string;
  alertType: string;
  severity: string;
  description: string;
  detectedAt: string;
  metadata?: Record<string, any>;
}

interface ContextQualityResponse {
  stats: ContextQualityStats;
  recentAlerts: ContextAlert[];
  period: string;
}

const COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  duplicate_data_request: "Dados Duplicados",
  ignored_history: "Histórico Ignorado",
  duplicate_routing: "Roteamento Duplicado",
  context_reset: "Reset de Contexto",
};

const SEVERITY_LABELS: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export default function ContextQuality() {
  const [period, setPeriod] = useState<string>("24");

  const { data, isLoading, refetch } = useQuery<ContextQualityResponse>({
    queryKey: ["/api/monitor/context-quality", period],
    queryFn: async () => {
      const response = await fetch(`/api/monitor/context-quality?hours=${period}`);
      if (!response.ok) throw new Error("Failed to fetch context quality data");
      return response.json();
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Preparar dados para o gráfico de barras (por tipo)
  const typeChartData = data?.stats.byType
    ? Object.entries(data.stats.byType).map(([type, count]) => ({
        name: ALERT_TYPE_LABELS[type] || type,
        value: count,
      }))
    : [];

  // Preparar dados para o gráfico de pizza (por severidade)
  const severityChartData = data?.stats.bySeverity
    ? Object.entries(data.stats.bySeverity).map(([severity, count]) => ({
        name: SEVERITY_LABELS[severity] || severity,
        value: count,
        color: COLORS[severity as keyof typeof COLORS] || "#6b7280",
      }))
    : [];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <AlertCircle className="h-4 w-4" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4" />;
      case "low":
        return <Info className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados de qualidade...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b bg-card">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              Qualidade de Contexto
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitore a qualidade do contexto das conversas e identifique problemas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]" data-testid="select-period">
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24" data-testid="option-24h">Últimas 24h</SelectItem>
                <SelectItem value="48" data-testid="option-48h">Últimas 48h</SelectItem>
                <SelectItem value="168" data-testid="option-7d">Últimos 7 dias</SelectItem>
                <SelectItem value="720" data-testid="option-30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card data-testid="card-total-alerts">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Alertas</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-alerts">
                  {data?.stats.totalAlerts || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.period}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-high-severity">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alta Severidade</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive" data-testid="text-high-severity">
                  {data?.stats.bySeverity?.high || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Requer atenção imediata
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-medium-severity">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Média Severidade</CardTitle>
                <AlertTriangle className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-medium-severity">
                  {data?.stats.bySeverity?.medium || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Monitorar evolução
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-low-severity">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Baixa Severidade</CardTitle>
                <Info className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-low-severity">
                  {data?.stats.bySeverity?.low || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Informativo
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart - Alertas por Tipo */}
            <Card>
              <CardHeader>
                <CardTitle>Alertas por Tipo</CardTitle>
                <CardDescription>Distribuição dos problemas detectados</CardDescription>
              </CardHeader>
              <CardContent>
                {typeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={typeChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pie Chart - Alertas por Severidade */}
            <Card>
              <CardHeader>
                <CardTitle>Alertas por Severidade</CardTitle>
                <CardDescription>Proporção de criticidade dos alertas</CardDescription>
              </CardHeader>
              <CardContent>
                {severityChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={severityChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {severityChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Alerts Table */}
          <Card>
            <CardHeader>
              <CardTitle>Alertas Recentes</CardTitle>
              <CardDescription>
                Últimos {data?.recentAlerts.length || 0} alertas detectados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.recentAlerts && data.recentAlerts.length > 0 ? (
                <div className="space-y-3">
                  {data.recentAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-4 border rounded-lg hover-elevate"
                      data-testid={`alert-item-${index}`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getSeverityIcon(alert.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={getSeverityBadgeVariant(alert.severity)}
                            data-testid={`badge-severity-${index}`}
                          >
                            {SEVERITY_LABELS[alert.severity] || alert.severity}
                          </Badge>
                          <Badge variant="outline" data-testid={`badge-type-${index}`}>
                            {ALERT_TYPE_LABELS[alert.alertType] || alert.alertType}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(alert.detectedAt)}
                          </span>
                        </div>
                        <p className="text-sm mb-1" data-testid={`text-description-${index}`}>
                          {alert.description}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          Conversa: {alert.conversationId}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum alerta detectado no período selecionado</p>
                  <p className="text-sm mt-2">O sistema está funcionando corretamente! 🎉</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
