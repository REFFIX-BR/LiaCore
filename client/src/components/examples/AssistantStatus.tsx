import { AssistantStatus } from '../AssistantStatus';

export default function AssistantStatusExample() {
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

  return (
    <div className="max-w-md">
      <AssistantStatus assistants={mockAssistants} />
    </div>
  );
}
