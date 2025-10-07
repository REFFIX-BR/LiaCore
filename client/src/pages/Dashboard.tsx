import { MetricsCard } from "@/components/MetricsCard";
import { AssistantStatus } from "@/components/AssistantStatus";
import { MessageSquare, Users, Clock, Zap } from "lucide-react";

//todo: remove mock functionality
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
          value="127"
          change={{ value: 12, trend: 'up' }}
          icon={MessageSquare}
        />
        <MetricsCard
          title="Assistentes Online"
          value="3"
          icon={Users}
        />
        <MetricsCard
          title="Tempo Médio Resposta"
          value="1.2s"
          change={{ value: 8, trend: 'down' }}
          icon={Clock}
        />
        <MetricsCard
          title="Taxa de Sucesso"
          value="94%"
          change={{ value: 3, trend: 'up' }}
          icon={Zap}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AssistantStatus assistants={mockAssistants} />
      </div>
    </div>
  );
}
