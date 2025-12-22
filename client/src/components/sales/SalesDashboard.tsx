import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  XCircle,
  TrendingUp,
  MapPin,
  Package,
  Megaphone,
  Target,
  BarChart3
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

type DashboardMetrics = {
  totals: {
    total: number;
    installed: number;
    pending: number;
    cancelled: number;
    prospection: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  byNeighborhood: Array<{ neighborhood: string; city: string; count: number }>;
  byPlan: Array<{ planId: string; planName: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  byHowDidYouKnow: Array<{ howDidYouKnow: string; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
  conversionRate: number;
};

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const STATUS_COLORS: Record<string, string> = {
  "Aguardando Análise": "#f59e0b",
  "Aprovado": "#22c55e",
  "Agendado para Instalação": "#3b82f6",
  "Instalado": "#059669",
  "Cancelado": "#ef4444",
  "Inadimplente": "#f97316",
  "Prospecção": "#8b5cf6",
};

const SOURCE_LABELS: Record<string, string> = {
  "chat": "Chat WhatsApp",
  "site": "Site",
  "manual": "Cadastro Manual",
  "Não informado": "Não informado",
};

type SalesDashboardProps = {
  startDate?: string;
  endDate?: string;
};

export default function SalesDashboard({ startDate, endDate }: SalesDashboardProps) {
  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append("startDate", startDate);
  if (endDate) queryParams.append("endDate", endDate);
  const queryString = queryParams.toString();
  
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/sales/dashboard", startDate, endDate],
    queryFn: async () => {
      const url = queryString ? `/api/sales/dashboard?${queryString}` : "/api/sales/dashboard";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Nenhum dado disponível
      </div>
    );
  }

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(m) - 1]}/${year.slice(2)}`;
  };

  const monthData = metrics.byMonth.map(item => ({
    ...item,
    monthLabel: formatMonth(item.month),
  }));

  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-total-sales">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cadastros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sales">{metrics.totals.total}</div>
            <p className="text-xs text-muted-foreground">Leads + Vendas</p>
          </CardContent>
        </Card>

        <Card data-testid="card-installed">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instalados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600" data-testid="text-installed">{metrics.totals.installed}</div>
            <p className="text-xs text-muted-foreground">Clientes ativos</p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending">{metrics.totals.pending}</div>
            <p className="text-xs text-muted-foreground">Aguardando/Aprovado/Agendado</p>
          </CardContent>
        </Card>

        <Card data-testid="card-cancelled">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-cancelled">{metrics.totals.cancelled}</div>
            <p className="text-xs text-muted-foreground">Desistências</p>
          </CardContent>
        </Card>

        <Card data-testid="card-conversion">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-conversion">{metrics.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">Instalados / Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card data-testid="card-monthly-trend">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cadastros por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="monthLabel" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    name="Cadastros"
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card data-testid="card-status-distribution">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {metrics.byStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.byStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ status, percent }) => percent > 0 ? `${status}: ${(percent * 100).toFixed(0)}%` : ''}
                      labelLine={false}
                    >
                      {metrics.byStatus.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum cadastro registrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Neighborhoods */}
        <Card data-testid="card-neighborhoods">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Top 10 Bairros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {metrics.byNeighborhood.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.byNeighborhood} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="neighborhood" 
                      width={120}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value, name, props) => [value, `${props.payload.neighborhood} - ${props.payload.city}`]}
                    />
                    <Bar dataKey="count" name="Cadastros" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum bairro registrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Plans */}
        <Card data-testid="card-plans">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Planos Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {metrics.byPlan.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.byPlan} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="planName" 
                      width={120}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" name="Vendas" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum plano registrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Distribution */}
        <Card data-testid="card-sources">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Origem dos Cadastros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {metrics.bySource.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.bySource.map(s => ({
                        ...s,
                        sourceLabel: SOURCE_LABELS[s.source] || s.source,
                      }))}
                      dataKey="count"
                      nameKey="sourceLabel"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ sourceLabel, percent }) => percent > 0 ? `${sourceLabel}: ${(percent * 100).toFixed(0)}%` : ''}
                      labelLine={false}
                    >
                      {metrics.bySource.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum dado registrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* How Did You Know Distribution */}
        <Card data-testid="card-how-did-you-know">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Como Conheceu a TR Telecom
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {metrics.byHowDidYouKnow.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.byHowDidYouKnow.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="howDidYouKnow" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" name="Cadastros" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum dado registrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
