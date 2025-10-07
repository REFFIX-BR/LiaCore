import { ConversationDetails } from '../ConversationDetails';
import { useState } from 'react';

export default function ConversationDetailsExample() {
  const [isPaused, setIsPaused] = useState(false);

  const mockMessages = [
    {
      id: '1',
      role: 'user' as const,
      content: 'Minha internet está muito lenta!',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
    },
    {
      id: '2',
      role: 'assistant' as const,
      content: 'Vou verificar sua conexão...',
      timestamp: new Date(Date.now() - 1000 * 60 * 4),
      functionCall: { name: 'verificar_conexao', status: 'completed' },
    },
  ];

  const mockAnalysis = {
    summary: 'Cliente reportando lentidão na conexão de internet.',
    intent: 'Resolução de problema técnico de conexão',
    entities: {
      Plano: 'Fibra Gamer',
      Protocolo: '#987654',
    },
    actions: [
      { time: '14:31:02', description: 'Chamou Function: verificar_conexao()' },
      { time: '14:31:15', description: 'Chamou Function: consultar_base_de_conhecimento()' },
    ],
    sentimentHistory: [
      { time: '14:30', score: 50 },
      { time: '14:31', score: 40 },
      { time: '14:32', score: 20 },
    ],
  };

  return (
    <div className="h-96">
      <ConversationDetails
        chatId="chat-12345"
        clientName="João Silva"
        messages={mockMessages}
        analysis={mockAnalysis}
        isPaused={isPaused}
        onPauseToggle={() => setIsPaused(!isPaused)}
        onTransfer={(dept, notes) => console.log('Transfer:', dept, notes)}
        onAddNote={(note) => console.log('Note:', note)}
        onMarkResolved={() => console.log('Resolved')}
      />
    </div>
  );
}
