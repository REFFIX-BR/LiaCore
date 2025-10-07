import { ConversationCard } from '../ConversationCard';
import { useState } from 'react';

export default function ConversationCardExample() {
  const [activeId, setActiveId] = useState('1');
  
  const mockConversation = {
    id: '1',
    chatId: 'chat-12345',
    clientName: 'João Silva',
    assistant: 'LIA Suporte',
    duration: 332,
    lastMessage: 'NÃO RESOLVEU NADA! QUERO FALAR COM ALGUÉM!!',
    sentiment: 'negative' as const,
    urgency: 'critical' as const,
    hasAlert: true,
    transferSuggested: false,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 2),
  };

  return (
    <div className="max-w-md">
      <ConversationCard 
        conversation={mockConversation} 
        isActive={activeId === '1'}
        onClick={() => setActiveId('1')}
      />
    </div>
  );
}
