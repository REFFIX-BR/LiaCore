import { MetricsCard } from '../MetricsCard';
import { MessageSquare, Users, Zap, Clock } from 'lucide-react';

export default function MetricsCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
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
  );
}
