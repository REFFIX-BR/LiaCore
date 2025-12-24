import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, AlertTriangle, CheckCircle, Shield, TrendingUp, Clock, Ban } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

interface ValidationViolation {
  id: string;
  conversationId: string | null;
  chatId: string | null;
  assistantType: string | null;
  rule: string;
  severity: string;
  status: string;
  message: string;
  originalResponse: string | null;
  correctedResponse: string | null;
  createdAt: string;
}

interface ValidationMetrics {
  total: number;
  byRule: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byAssistant: Record<string, number>;
  recentViolations: ValidationViolation[];
  hourlyTrend: Array<{ hour: string; count: number }>;
}

const SEVERITY_COLORS: Record<string, string> = {
  block: "#ef4444",
  auto_correct: "#f59e0b",
  warn: "#3b82f6",
};

const SEVERITY_LABELS: Record<string, string> = {
  block: "Bloqueio",
  auto_correct: "Correção",
  warn: "Aviso",
};

const STATUS_LABELS: Record<string, string> = {
  blocked: "Bloqueado",
  corrected: "Corrigido",
  ok: "OK (aviso)",
};

const RULE_LABELS: Record<string, string> = {
  no_empty_promises: "Promessa Vazia",
  client_name_mismatch: "Nome Incorreto",
  false_transfer_claim: "Transferência Falsa",
  ambiguous_transfer_claim: "Transferência Ambígua",
  inability_without_alternative: "Incapacidade s/ Alternativa",
  scope_violation: "Fora de Escopo",
  response_too_long: "Resposta Longa",
  appointment_confirmation_without_api: "Agendamento Inventado",
  boleto_status_without_api: "Boleto s/ Consulta",
  address_not_found_without_api: "Endereço s/ Consulta",
};

const ASSISTANT_LABELS: Record<string, string> = {
  apresentacao: "Apresentação",
  financeiro: "Financeiro",
  comercial: "Comercial",
  suporte: "Suporte",
  ouvidoria: "Ouvidoria",
  cancelamento: "Cancelamento",
  cobranca: "Cobrança",
};

const ASSISTANT_COLORS: Record<string, string> = {
  apresentacao: "#8b5cf6",
  financeiro: "#3b82f6",
  comercial: "#22c55e",
  suporte: "#f97316",
  ouvidoria: "#ec4899",
  cancelamento: "#ef4444",
  cobranca: "#06b6d4",
};

export default function ValidationDashboard() {
  const [period, setPeriod] = useState<string>("24");

  const { data, isLoading } = useQuery<ValidationMetrics>({
    queryKey: ["/api/dashboard/validation-metrics", period],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/validation-metrics?hours=${period}`);
      if (!response.ok) throw new Error("Failed to fetch validation metrics");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "block":
        return <Ban className="h-4 w-4 text-red-500" />;
      case "auto_correct":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "warn":
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "destructive" | "secondary" | "outline"> = {
      block: "destructive",
      auto_correct: "secondary",
      warn: "outline",
    };
    return (
      <Badge variant={variants[severity] || "outline"}>
        {SEVERITY_LABELS[severity] || severity}
      </Badge>
    );
  };

  const ruleChartData = data?.byRule
    ? Object.entries(data.byRule).map(([rule, count]) => ({
        name: RULE_LABELS[rule] || rule,
        count,
        fill: "#8884d8",
      }))
    : [];

  const severityChartData = data?.bySeverity
    ? Object.entries(data.bySeverity).map(([severity, count]) => ({
        name: SEVERITY_LABELS[severity] || severity,
        value: count,
        fill: SEVERITY_COLORS[severity] || "#8884d8",
      }))
    : [];

  const assistantChartData = data?.byAssistant
    ? Object.entries(data.byAssistant).map(([assistant, count]) => ({
        name: ASSISTANT_LABELS[assistant] || assistant,
        value: count,
        fill: ASSISTANT_COLORS[assistant] || "#8884d8",
      }))
    : [];

  const trendData = data?.hourlyTrend?.map(item => ({
    ...item,
    hora: item.hour.slice(11, 16),
  })) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="validation-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-6 w-6 text-primary" />
            Validador Anti-Alucinação
          </h1>
          <p className="text-muted-foreground">
            Monitoramento de violações detectadas nas respostas da IA
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]" data-testid="select-period">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Última hora</SelectItem>
            <SelectItem value="6">Últimas 6 horas</SelectItem>
            <SelectItem value="24">Últimas 24 horas</SelectItem>
            <SelectItem value="168">Últimos 7 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total de Violações</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-violations">{data?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              últimas {period}h
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Bloqueios</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-blocks">
              {data?.bySeverity?.block || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              respostas bloqueadas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Correções</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-corrections">
              {data?.bySeverity?.auto_correct || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              respostas corrigidas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Avisos</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-warnings">
              {data?.bySeverity?.warn || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              avisos (não bloqueados)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Violações por Regra
            </CardTitle>
            <CardDescription>
              Distribuição de violações por tipo de regra
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ruleChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ruleChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <CheckCircle className="h-8 w-8 mr-2 text-green-500" />
                Nenhuma violação no período
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Por Severidade
            </CardTitle>
            <CardDescription>
              Distribuição de violações por nível de severidade
            </CardDescription>
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
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {severityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <CheckCircle className="h-8 w-8 mr-2 text-green-500" />
                Nenhuma violação no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tendência Horária
            </CardTitle>
            <CardDescription>
              Violações ao longo do tempo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hora" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Nenhuma violação no período
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por Assistente</CardTitle>
            <CardDescription>
              Distribuição de violações por assistente IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assistantChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={assistantChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {assistantChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Nenhuma violação no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas Violações</CardTitle>
          <CardDescription>
            As 10 violações mais recentes detectadas pelo sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.recentViolations && data.recentViolations.length > 0 ? (
            <div className="space-y-4">
              {data.recentViolations.map((violation) => (
                <div
                  key={violation.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card"
                  data-testid={`card-violation-${violation.id}`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getSeverityIcon(violation.severity)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getSeverityBadge(violation.severity)}
                      <Badge variant="outline">
                        {RULE_LABELS[violation.rule] || violation.rule}
                      </Badge>
                      {violation.assistantType && (
                        <Badge 
                          variant="secondary"
                          style={{ backgroundColor: ASSISTANT_COLORS[violation.assistantType] + '20', color: ASSISTANT_COLORS[violation.assistantType] }}
                        >
                          {ASSISTANT_LABELS[violation.assistantType] || violation.assistantType}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(violation.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {violation.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
              <p className="text-lg font-medium">Sistema funcionando perfeitamente!</p>
              <p className="text-sm">Nenhuma violação detectada no período selecionado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
