import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar, TrendingUp, TrendingDown, Activity, MessageSquare, CheckCircle2, AlertTriangle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from "date-fns";

type PeriodPreset = "7days" | "15days" | "30days" | "4weeks" | "8weeks" | "12weeks" | "3months" | "6months" | "12months" | "custom";
type GroupBy = "day" | "week" | "month";

interface ReportData {
  period: string;
  agentId?: string;
  agentName?: string;
  totalConversations: number;
  resolvedConversations: number;
  successRate: number;
  avgResponseTime: number;
  avgSentiment: number;
  npsScore: number;
  transfersToHuman: number;
}

export default function AgentReports() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("30days");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Get all agents for selection
  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ["/api/agents/list"]
  });

  // Calculate date range based on preset
  const getDateRange = () => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let autoGroupBy: GroupBy = "day";

    if (periodPreset === "custom" && startDate && endDate) {
      return {
        startDate,
        endDate,
        groupBy
      };
    }

    switch (periodPreset) {
      case "7days":
        start = subDays(now, 7);
        autoGroupBy = "day";
        break;
      case "15days":
        start = subDays(now, 15);
        autoGroupBy = "day";
        break;
      case "30days":
        start = subDays(now, 30);
        autoGroupBy = "day";
        break;
      case "4weeks":
        start = subWeeks(now, 4);
        autoGroupBy = "week";
        break;
      case "8weeks":
        start = subWeeks(now, 8);
        autoGroupBy = "week";
        break;
      case "12weeks":
        start = subWeeks(now, 12);
        autoGroupBy = "week";
        break;
      case "3months":
        start = subMonths(now, 3);
        autoGroupBy = "month";
        break;
      case "6months":
        start = subMonths(now, 6);
        autoGroupBy = "month";
        break;
      case "12months":
        start = subMonths(now, 12);
        autoGroupBy = "month";
        break;
    }

    return {
      startDate: startOfDay(start).toISOString(),
      endDate: endOfDay(end).toISOString(),
      groupBy: autoGroupBy
    };
  };

  const dateRange = getDateRange();

  // Fetch reports
  const { data: reports = [], isLoading } = useQuery<ReportData[]>({
    queryKey: [
      "/api/reports/agents",
      dateRange.startDate,
      dateRange.endDate,
      selectedAgent === "all" ? undefined : selectedAgent,
      dateRange.groupBy
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        groupBy: dateRange.groupBy
      });
      
      if (selectedAgent !== "all") {
        params.append("agentId", selectedAgent);
      }

      const res = await fetch(`/api/reports/agents?${params}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    }
  });

  // Calculate summary metrics
  const summary = reports.reduce(
    (acc, r) => ({
      totalConversations: acc.totalConversations + r.totalConversations,
      resolvedConversations: acc.resolvedConversations + r.resolvedConversations,
      avgSuccessRate: acc.avgSuccessRate + r.successRate,
      avgNPS: acc.avgNPS + r.npsScore,
      transfersToHuman: acc.transfersToHuman + r.transfersToHuman,
    }),
    { totalConversations: 0, resolvedConversations: 0, avgSuccessRate: 0, avgNPS: 0, transfersToHuman: 0 }
  );

  const successRate = summary.totalConversations > 0
    ? Math.round((summary.resolvedConversations / summary.totalConversations) * 100)
    : 0;

  const avgNPS = reports.length > 0 ? Math.round(summary.avgNPS / reports.length) : 0;

  // Format chart data
  const chartData = reports.map(r => ({
    period: r.period,
    name: r.agentName || r.period,
    conversas: r.totalConversations,
    resolvidas: r.resolvedConversations,
    sucesso: r.successRate,
    nps: r.npsScore
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Relatórios de Atendentes</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Análise histórica de desempenho e evolução da equipe
        </p>
      </div>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros de Análise
          </CardTitle>
          <CardDescription>Configure o período e atendente para análise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period">Período</Label>
              <Select
                value={periodPreset}
                onValueChange={(value) => setPeriodPreset(value as PeriodPreset)}
                data-testid="select-period"
              >
                <SelectTrigger id="period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="15days">Últimos 15 dias</SelectItem>
                  <SelectItem value="30days">Últimos 30 dias</SelectItem>
                  <SelectItem value="4weeks">Últimas 4 semanas</SelectItem>
                  <SelectItem value="8weeks">Últimas 8 semanas</SelectItem>
                  <SelectItem value="12weeks">Últimas 12 semanas</SelectItem>
                  <SelectItem value="3months">Últimos 3 meses</SelectItem>
                  <SelectItem value="6months">Últimos 6 meses</SelectItem>
                  <SelectItem value="12months">Últimos 12 meses</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodPreset === "custom" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="start-date">Data Inicial</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">Data Final</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-by">Agrupar por</Label>
                  <Select
                    value={groupBy}
                    onValueChange={(value) => setGroupBy(value as GroupBy)}
                    data-testid="select-group-by"
                  >
                    <SelectTrigger id="group-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Dia</SelectItem>
                      <SelectItem value="week">Semana</SelectItem>
                      <SelectItem value="month">Mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="agent">Atendente</Label>
              <Select
                value={selectedAgent}
                onValueChange={setSelectedAgent}
                data-testid="select-agent"
              >
                <SelectTrigger id="agent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Atendentes</SelectItem>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-summary-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Conversas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-conversations">
              {summary.totalConversations}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.resolvedConversations} resolvidas
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-summary-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {successRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              {successRate >= 80 ? (
                <span className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="h-3 w-3" /> Excelente
                </span>
              ) : successRate >= 60 ? (
                <span className="flex items-center gap-1 text-yellow-600">
                  <Activity className="h-3 w-3" /> Bom
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600">
                  <TrendingDown className="h-3 w-3" /> Precisa melhorar
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-summary-nps">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NPS Médio</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-nps">
              {avgNPS}
            </div>
            <p className="text-xs text-muted-foreground">
              {avgNPS >= 9 ? "Promotores" : avgNPS >= 7 ? "Neutros" : "Detratores"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-summary-transfers">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transferências</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-transfers">
              {summary.transfersToHuman}
            </div>
            <p className="text-xs text-muted-foreground">
              Para atendimento humano
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-evolution-chart">
          <CardHeader>
            <CardTitle>Evolução Temporal</CardTitle>
            <CardDescription>Volume de conversas ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Carregando...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para o período selecionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="conversas" stroke="#8884d8" name="Total" />
                  <Line type="monotone" dataKey="resolvidas" stroke="#82ca9d" name="Resolvidas" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-performance-chart">
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>Taxa de sucesso e NPS por período</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Carregando...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para o período selecionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sucesso" fill="#8884d8" name="Sucesso %" />
                  <Bar dataKey="nps" fill="#82ca9d" name="NPS" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card data-testid="card-detailed-table">
        <CardHeader>
          <CardTitle>Dados Detalhados</CardTitle>
          <CardDescription>
            {selectedAgent === "all" 
              ? "Métricas agregadas de todos os atendentes"
              : `Métricas de ${agents.find((a: any) => a.id === selectedAgent)?.fullName || "atendente selecionado"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Período</th>
                  {selectedAgent === "all" && <th className="text-left py-2 px-4">Atendente</th>}
                  <th className="text-right py-2 px-4">Conversas</th>
                  <th className="text-right py-2 px-4">Resolvidas</th>
                  <th className="text-right py-2 px-4">Sucesso</th>
                  <th className="text-right py-2 px-4">NPS</th>
                  <th className="text-right py-2 px-4">Transferências</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      Sem dados para o período selecionado
                    </td>
                  </tr>
                ) : (
                  reports.map((report, idx) => (
                    <tr key={idx} className="border-b hover-elevate" data-testid={`row-report-${idx}`}>
                      <td className="py-2 px-4">{report.period}</td>
                      {selectedAgent === "all" && (
                        <td className="py-2 px-4">{report.agentName || "N/A"}</td>
                      )}
                      <td className="text-right py-2 px-4">{report.totalConversations}</td>
                      <td className="text-right py-2 px-4">{report.resolvedConversations}</td>
                      <td className="text-right py-2 px-4">{report.successRate}%</td>
                      <td className="text-right py-2 px-4">{report.npsScore}</td>
                      <td className="text-right py-2 px-4">{report.transfersToHuman}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
