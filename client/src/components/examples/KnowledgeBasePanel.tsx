import { KnowledgeBasePanel } from '../KnowledgeBasePanel';

export default function KnowledgeBasePanelExample() {
  const mockChunks = [
    {
      id: '1',
      content: 'O plano Fibra Gamer é otimizado para baixa latência, com um ping esperado de 5-15ms para servidores locais. Ideal para jogos online competitivos.',
      source: 'Manual Técnico Planos 2024',
      relevance: 95,
    },
    {
      id: '2',
      content: 'Velocidade de download: até 500 Mbps. Upload simétrico de 500 Mbps. Conexão dedicada sem compartilhamento.',
      source: 'Especificações Fibra Gamer',
      relevance: 87,
    },
    {
      id: '3',
      content: 'Suporte prioritário 24/7 com técnicos especializados em gaming. SLA de 2 horas para resolução de problemas.',
      source: 'Políticas de Suporte Premium',
      relevance: 72,
    },
  ];

  return (
    <div className="max-w-lg">
      <KnowledgeBasePanel chunks={mockChunks} />
    </div>
  );
}
