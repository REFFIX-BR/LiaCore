import { useState } from "react";
import { ConversationList } from "@/components/ConversationList";
import { ChatMessage, type Message } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

//todo: remove mock functionality
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

//todo: remove mock functionality
const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: '1',
      role: 'user',
      content: 'Minha internet está lenta no plano Fibra Gamer. O que as especificações dizem sobre a latência esperada?',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
    },
    {
      id: '2',
      role: 'assistant',
      content: 'Verificando sua conexão e consultando as especificações técnicas...',
      timestamp: new Date(Date.now() - 1000 * 60 * 4),
      assistant: 'LIA Suporte',
      functionCall: {
        name: 'verificar_conexao',
        status: 'completed',
      },
    },
    {
      id: '3',
      role: 'assistant',
      content: 'Olá João! Verifiquei sua conexão e o sinal está excelente. De acordo com as especificações do plano Fibra Gamer, a latência esperada para servidores locais é de 5 a 15ms.',
      timestamp: new Date(Date.now() - 1000 * 60 * 3),
      assistant: 'LIA Suporte',
    },
  ],
};

export default function Conversations() {
  const [activeId, setActiveId] = useState('1');
  const [messages, setMessages] = useState(mockMessages);

  const handleSend = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    setMessages(prev => ({
      ...prev,
      [activeId]: [...(prev[activeId] || []), newMessage],
    }));
    
    console.log('Message sent:', content);
  };

  const activeMessages = messages[activeId] || [];

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      <Card className="w-80 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Conversas</h2>
        </div>
        <ConversationList
          conversations={mockConversations}
          activeId={activeId}
          onSelect={setActiveId}
        />
      </Card>

      <Card className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">
            {mockConversations.find(c => c.id === activeId)?.clientName || 'Conversa'}
          </h2>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {activeMessages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
        </ScrollArea>

        <ChatInput onSend={handleSend} />
      </Card>
    </div>
  );
}
