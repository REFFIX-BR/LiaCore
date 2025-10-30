import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, AlertTriangle, Info, TrendingUp, Clock, Sparkles, Copy, CheckCircle, Zap } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  assistantType?: string;
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

const ASSISTANT_OPTIONS = [
  { value: "apresentacao", label: "Apresentação (Recepcionista)" },
  { value: "financeiro", label: "Financeiro" },
  { value: "comercial", label: "Comercial" },
  { value: "suporte", label: "Suporte Técnico" },
  { value: "ouvidoria", label: "Ouvidoria" },
  { value: "cancelamento", label: "Cancelamento" },
];

const ASSISTANT_LABELS: Record<string, string> = {
  apresentacao: "Apresentação",
  financeiro: "Financeiro",
  comercial: "Comercial",
  suporte: "Suporte",
  ouvidoria: "Ouvidoria",
  cancelamento: "Cancelamento",
};

const ASSISTANT_COLORS: Record<string, string> = {
  apresentacao: "bg-purple-500",
  financeiro: "bg-blue-500",
  comercial: "bg-green-500",
  suporte: "bg-orange-500",
  ouvidoria: "bg-pink-500",
  cancelamento: "bg-red-500",
};

interface PromptSuggestion {
  assistantType: string;
  problemSummary: string;
  rootCause: string;
  suggestedFix: string;
  exampleBefore: string;
  exampleAfter: string;
  priority: "high" | "medium" | "low";
}

export default function ContextQuality() {
  const [period, setPeriod] = useState<string>("24");
  const [selectedAssistant, setSelectedAssistant] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<ContextQualityResponse>({
    queryKey: ["/api/monitor/context-quality", period],
    queryFn: async () => {
      const response = await fetch(`/api/monitor/context-quality?hours=${period}`);
      if (!response.ok) throw new Error("Failed to fetch context quality data");
      return response.json();
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  const suggestionMutation = useMutation({
    mutationFn: async (assistantType: string) => {
      return apiRequest(
        `/api/monitor/context-quality/suggest-fix`,
        "POST",
        { 
          assistantType, 
          hours: parseInt(period) 
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Sugestão Gerada!",
        description: "A IA analisou os alertas e criou uma sugestão de correção.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível gerar a sugestão. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateSuggestion = () => {
    if (!selectedAssistant) {
      toast({
        title: "Selecione um assistente",
        description: "Escolha qual assistente você quer corrigir.",
        variant: "destructive",
      });
      return;
    }
    suggestionMutation.mutate(selectedAssistant);
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência.`,
    });
  };

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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  data-testid="button-suggest-fix"
                >
                  <Sparkles className="h-4 w-4" />
                  Gerar Sugestão de Correção
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Sugestão Inteligente de Correção
                  </DialogTitle>
                  <DialogDescription>
                    A IA vai analisar os alertas detectados e sugerir correções específicas para o prompt do assistente
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Selecione o Assistente para Corrigir
                    </label>
                    <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
                      <SelectTrigger data-testid="select-assistant">
                        <SelectValue placeholder="Escolha o assistente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSISTANT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleGenerateSuggestion}
                    disabled={!selectedAssistant || suggestionMutation.isPending}
                    className="w-full"
                    data-testid="button-generate"
                  >
                    {suggestionMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Analisando alertas e gerando sugestão...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Gerar Sugestão com IA
                      </>
                    )}
                  </Button>

                  {suggestionMutation.data?.suggestion && (
                    <div className="space-y-4 mt-6 border-t pt-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Resultado da Análise</h3>
                        <Badge variant={
                          suggestionMutation.data.suggestion.priority === "high" ? "destructive" :
                          suggestionMutation.data.suggestion.priority === "medium" ? "default" : "secondary"
                        }>
                          Prioridade: {suggestionMutation.data.suggestion.priority.toUpperCase()}
                        </Badge>
                      </div>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">📋 Resumo do Problema</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm">{suggestionMutation.data.suggestion.problemSummary}</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">🔍 Causa Raiz</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm">{suggestionMutation.data.suggestion.rootCause}</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-base">✨ Correção Sugerida</CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyText(suggestionMutation.data.suggestion.suggestedFix, "Correção")}
                            className="gap-2"
                          >
                            {copiedText === "Correção" ? (
                              <><CheckCircle className="h-4 w-4" /> Copiado!</>
                            ) : (
                              <><Copy className="h-4 w-4" /> Copiar</>
                            )}
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-sm bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
                            {suggestionMutation.data.suggestion.suggestedFix}
                          </pre>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base text-destructive">❌ Antes (Errado)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-sm bg-destructive/10 p-3 rounded-md whitespace-pre-wrap">
                              {suggestionMutation.data.suggestion.exampleBefore}
                            </pre>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base text-green-600">✅ Depois (Correto)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-sm bg-green-100 dark:bg-green-950 p-3 rounded-md whitespace-pre-wrap">
                              {suggestionMutation.data.suggestion.exampleAfter}
                            </pre>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <CardContent className="pt-4">
                          <p className="text-sm text-blue-900 dark:text-blue-100">
                            <strong>💡 Próximos Passos:</strong><br />
                            1. Copie a "Correção Sugerida" acima<br />
                            2. Vá em <strong>Conhecimento & IA → Gerenciamento de Prompts</strong><br />
                            3. Selecione o assistente <strong>{ASSISTANT_OPTIONS.find(a => a.value === selectedAssistant)?.label}</strong><br />
                            4. Cole a correção no prompt<br />
                            5. Analise com IA e Publique<br />
                            6. Volte aqui em 24h para verificar se os alertas diminuíram
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {suggestionMutation.data && !suggestionMutation.data.suggestion && (
                    <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                      <CardContent className="pt-4">
                        <p className="text-sm text-yellow-900 dark:text-yellow-100">
                          {suggestionMutation.data.message || "Nenhum alerta encontrado para este assistente no período selecionado."}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </DialogContent>
            </Dialog>

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
          {/* Test Button (DEV ONLY) */}
          {import.meta.env.DEV && (
            <div className="mb-4">
              <Button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/monitor/context-quality/test', {
                      method: 'POST',
                      credentials: 'include',
                    });
                    if (!response.ok) throw new Error('Failed to inject test alerts');
                    await queryClient.invalidateQueries({ queryKey: ['/api/monitor/context-quality'] });
                    toast({
                      title: "Alertas de teste injetados",
                      description: "6 alertas simulados foram adicionados com sucesso!",
                    });
                  } catch (error) {
                    toast({
                      title: "Erro ao injetar alertas",
                      description: "Falha ao criar alertas de teste",
                      variant: "destructive",
                    });
                  }
                }}
                variant="outline"
                size="sm"
                data-testid="button-inject-test-alerts"
              >
                <Zap className="h-4 w-4 mr-2" />
                Injetar Alertas de Teste
              </Button>
            </div>
          )}

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
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge
                            variant={getSeverityBadgeVariant(alert.severity)}
                            data-testid={`badge-severity-${index}`}
                          >
                            {SEVERITY_LABELS[alert.severity] || alert.severity}
                          </Badge>
                          <Badge variant="outline" data-testid={`badge-type-${index}`}>
                            {ALERT_TYPE_LABELS[alert.alertType] || alert.alertType}
                          </Badge>
                          {alert.assistantType && (
                            <Badge 
                              className={`${ASSISTANT_COLORS[alert.assistantType] || 'bg-gray-500'} text-white`}
                              data-testid={`badge-assistant-${index}`}
                            >
                              {ASSISTANT_LABELS[alert.assistantType] || alert.assistantType}
                            </Badge>
                          )}
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
