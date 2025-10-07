import { ChatMessage } from '../ChatMessage';

export default function ChatMessageExample() {
  const messages = [
    {
      id: '1',
      role: 'user' as const,
      content: 'Minha internet está lenta no plano Fibra Gamer. O que as especificações dizem sobre a latência esperada?',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
    },
    {
      id: '2',
      role: 'assistant' as const,
      content: 'Verificando sua conexão e consultando as especificações técnicas...',
      timestamp: new Date(Date.now() - 1000 * 60 * 4),
      assistant: 'LIA Suporte',
      functionCall: {
        name: 'verificar_conexao',
        status: 'completed' as const,
      },
    },
    {
      id: '3',
      role: 'assistant' as const,
      content: 'Olá João! Verifiquei sua conexão e o sinal está excelente. De acordo com as especificações do plano Fibra Gamer, a latência esperada para servidores locais é de 5 a 15ms.',
      timestamp: new Date(Date.now() - 1000 * 60 * 3),
      assistant: 'LIA Suporte',
    },
  ];

  return (
    <div className="space-y-2 p-4 border rounded-lg">
      {messages.map(msg => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
    </div>
  );
}
