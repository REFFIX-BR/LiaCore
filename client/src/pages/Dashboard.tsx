import { useQuery } from "@tanstack/react-query";
import { MetricsCard } from "@/components/MetricsCard";
import { AssistantStatus } from "@/components/AssistantStatus";
import { KPIPanel } from "@/components/KPIPanel";
import { MessageSquare, Users, Clock, Zap } from "lucide-react";
import { monitorAPI } from "@/lib/api";

const mockAssistants = [
  {
    id: '1',
    name: 'LIA Suporte',
    type: 'suporte' as const,
    status: 'online' as const,
    activeChats: 42,
    successRate: 96,
  },
  {
    id: '2',
    name: 'LIA Comercial',
    type: 'comercial' as const,
    status: 'processing' as const,
    activeChats: 28,
    successRate: 94,
  },
  {
    id: '3',
    name: 'LIA Técnico',
    type: 'tecnico' as const,
    status: 'online' as const,
    activeChats: 15,
    successRate: 98,
  },
];

export default function Dashboard() {
  const { data: conversations = [] } = useQuery({
    queryKey: ["/api/monitor/conversations"],
    queryFn: monitorAPI.getConversations,
    refetchInterval: 5000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["/api/monitor/alerts"],
    queryFn: monitorAPI.getAlerts,
    refetchInterval: 3000,
  });

  const activeConversations = conversations.filter(c => c.status === "active");

  const kpis = {
    activeConversations: activeConversations.length,
    avgResponseTime: "2.1s",
    sentiment: {
      label: "Neutro",
      percentage: 85,
      color: "bg-muted text-muted-foreground",
    },
    resolutionRate: 88,
  };

  const assistantCounts = conversations.reduce((acc, conv) => {
    const type = conv.assistantType;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const total = conversations.length || 1;
  const assistantDistribution = [
    { 
      name: 'LIA Suporte', 
      percentage: Math.round(((assistantCounts['suporte'] || 0) / total) * 100), 
      color: 'bg-chart-1' 
    },
    { 
      name: 'LIA Financeiro', 
      percentage: Math.round(((assistantCounts['financeiro'] || 0) / total) * 100), 
      color: 'bg-chart-2' 
    },
    { 
      name: 'LIA Comercial', 
      percentage: Math.round(((assistantCounts['comercial'] || 0) / total) * 100), 
      color: 'bg-chart-3' 
    },
    { 
      name: 'Outros', 
      percentage: Math.round((
        (assistantCounts['cancelamento'] || 0) +
        (assistantCounts['ouvidoria'] || 0) +
        (assistantCounts['apresentacao'] || 0)
      ) / total * 100), 
      color: 'bg-chart-4' 
    },
  ];

  const criticalAlerts = alerts.slice(0, 5).map(alert => ({
    id: alert.id,
    type: alert.type as "critical_sentiment" | "ai_loop" | "function_failure",
    chatId: conversations.find(c => c.id === alert.conversationId)?.chatId || "unknown",
    clientName: conversations.find(c => c.id === alert.conversationId)?.clientName || "Unknown",
    message: alert.message,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral do sistema LIA CORTEX
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Conversas Ativas"
          value={activeConversations.length.toString()}
          change={{ value: 12, trend: 'up' }}
          icon={MessageSquare}
          data-testid="metric-active-conversations"
        />
        <MetricsCard
          title="Assistentes Online"
          value="3"
          icon={Users}
          data-testid="metric-assistants-online"
        />
        <MetricsCard
          title="Tempo Médio Resposta"
          value="1.2s"
          change={{ value: 8, trend: 'down' }}
          icon={Clock}
          data-testid="metric-avg-response-time"
        />
        <MetricsCard
          title="Taxa de Sucesso"
          value="94%"
          change={{ value: 3, trend: 'up' }}
          icon={Zap}
          data-testid="metric-success-rate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <KPIPanel 
            kpis={kpis} 
            alerts={criticalAlerts} 
            assistantDistribution={assistantDistribution} 
          />
        </div>
        <div className="lg:col-span-2">
          <AssistantStatus assistants={mockAssistants} />
        </div>
      </div>
    </div>
  );
}
