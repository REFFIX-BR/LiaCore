import { KPIPanel } from '../KPIPanel';

export default function KPIPanelExample() {
  const mockKPIs = {
    activeConversations: 37,
    avgResponseTime: "2.1s",
    sentiment: {
      label: "Neutro",
      percentage: 85,
      color: "bg-muted text-muted-foreground",
    },
    resolutionRate: 88,
  };

  const mockAlerts = [
    {
      id: '1',
      type: 'critical_sentiment' as const,
      chatId: 'chat-12345',
      clientName: 'João S.',
      message: 'Sentimento Crítico',
    },
    {
      id: '2',
      type: 'ai_loop' as const,
      chatId: 'chat-67890',
      clientName: 'Maria P.',
      message: 'IA Presa em Loop',
    },
  ];

  const mockDistribution = [
    { name: 'LIA Suporte', percentage: 45, color: 'bg-chart-1' },
    { name: 'LIA Financeiro', percentage: 30, color: 'bg-chart-2' },
    { name: 'LIA Comercial', percentage: 20, color: 'bg-chart-3' },
    { name: 'Outros', percentage: 5, color: 'bg-chart-4' },
  ];

  return (
    <div className="max-w-sm">
      <KPIPanel kpis={mockKPIs} alerts={mockAlerts} assistantDistribution={mockDistribution} />
    </div>
  );
}
