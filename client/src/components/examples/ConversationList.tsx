import { ConversationList } from '../ConversationList';
import { useState } from 'react';

export default function ConversationListExample() {
  const [activeId, setActiveId] = useState('1');
  
  const mockConversations = [
    {
      id: '1',
      clientName: 'João Silva',
      lastMessage: 'Minha internet está lenta no plano Fibra Gamer',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      unreadCount: 2,
      assistant: 'suporte' as const,
    },
    {
      id: '2',
      clientName: 'Maria Santos',
      lastMessage: 'Gostaria de saber sobre o plano empresarial',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      assistant: 'comercial' as const,
    },
    {
      id: '3',
      clientName: 'Pedro Costa',
      lastMessage: 'Qual a diferença entre os planos?',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      unreadCount: 1,
      assistant: 'comercial' as const,
    },
  ];

  return (
    <div className="h-96 border rounded-lg">
      <ConversationList 
        conversations={mockConversations} 
        activeId={activeId}
        onSelect={setActiveId}
      />
    </div>
  );
}
