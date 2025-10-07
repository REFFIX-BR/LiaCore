import { useState } from "react";
import { KPIPanel } from "@/components/KPIPanel";
import { ConversationCard } from "@/components/ConversationCard";
import { ConversationDetails } from "@/components/ConversationDetails";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

//todo: remove mock functionality
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

//todo: remove mock functionality
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
  {
    id: '3',
    type: 'function_failure' as const,
    chatId: 'chat-55555',
    clientName: 'Carlos R.',
    message: "Falha na Function: 'verificar_conexao'",
  },
];

//todo: remove mock functionality
const mockDistribution = [
  { name: 'LIA Suporte', percentage: 45, color: 'bg-chart-1' },
  { name: 'LIA Financeiro', percentage: 30, color: 'bg-chart-2' },
  { name: 'LIA Comercial', percentage: 20, color: 'bg-chart-3' },
  { name: 'Outros', percentage: 5, color: 'bg-chart-4' },
];

//todo: remove mock functionality
const mockConversations = [
  {
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
  },
  {
    id: '2',
    chatId: 'chat-67890',
    clientName: 'Maria Paula',
    assistant: 'LIA Financeiro',
    duration: 187,
    lastMessage: 'Quando vence minha fatura?',
    sentiment: 'neutral' as const,
    urgency: 'normal' as const,
    hasAlert: false,
    transferSuggested: true,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: '3',
    chatId: 'chat-55555',
    clientName: 'Carlos Roberto',
    assistant: 'LIA Técnico',
    duration: 445,
    lastMessage: 'A conexão caiu novamente',
    sentiment: 'negative' as const,
    urgency: 'high' as const,
    hasAlert: true,
    transferSuggested: false,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 8),
  },
];

//todo: remove mock functionality
const mockMessages = {
  '1': [
    {
      id: '1',
      role: 'user' as const,
      content: 'Minha internet está muito lenta no plano Fibra Gamer!',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
    },
    {
      id: '2',
      role: 'assistant' as const,
      content: 'Vou verificar sua conexão e consultar as especificações...',
      timestamp: new Date(Date.now() - 1000 * 60 * 4),
      functionCall: { name: 'verificar_conexao', status: 'completed' },
    },
    {
      id: '3',
      role: 'assistant' as const,
      content: 'Sua conexão está normal. A latência esperada é de 5-15ms.',
      timestamp: new Date(Date.now() - 1000 * 60 * 3),
    },
    {
      id: '4',
      role: 'user' as const,
      content: 'NÃO RESOLVEU NADA! QUERO FALAR COM ALGUÉM!!',
      timestamp: new Date(Date.now() - 1000 * 60 * 2),
    },
  ],
};

//todo: remove mock functionality
const mockAnalysis = {
  summary: 'Cliente reportando lentidão persistente na conexão apesar da IA confirmar conexão normal. Alto nível de frustração.',
  intent: 'Resolução de problema técnico de conexão',
  entities: {
    Plano: 'Fibra Gamer',
    Protocolo: '#987654',
  },
  actions: [
    { time: '14:31:02', description: 'Chamou Function: verificar_conexao()' },
    { time: '14:31:15', description: "Chamou Function: consultar_base_de_conhecimento(query: 'latência Fibra Gamer')" },
  ],
  sentimentHistory: [
    { time: '14:30', score: 50 },
    { time: '14:31', score: 45 },
    { time: '14:32', score: 30 },
    { time: '14:33', score: 15 },
  ],
};

export default function Monitor() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeConvId, setActiveConvId] = useState<string | null>("1");
  const [isPaused, setIsPaused] = useState(false);
  const { toast } = useToast();

  const filters = [
    { id: "all", label: "Todos" },
    { id: "active", label: "Ativos" },
    { id: "alerts", label: "Alertas 🚩" },
    { id: "transfer", label: "Transferência ↪️" },
    { id: "resolved", label: "Finalizados" },
  ];

  const filteredConversations = mockConversations.filter(conv => {
    if (activeFilter === "alerts") return conv.hasAlert;
    if (activeFilter === "transfer") return conv.transferSuggested;
    return true;
  });

  const activeConversation = mockConversations.find(c => c.id === activeConvId);
  const activeMessages = activeConvId ? mockMessages[activeConvId as keyof typeof mockMessages] || [] : [];

  const handleTransfer = (dept: string, notes: string) => {
    toast({
      title: "Transferência Iniciada",
      description: `Chat transferido para ${dept}`,
    });
    console.log('Transfer to:', dept, 'Notes:', notes);
  };

  const handleAddNote = (note: string) => {
    toast({
      title: "Nota Adicionada",
      description: "Nota interna registrada com sucesso",
    });
    console.log('Note added:', note);
  };

  const handleMarkResolved = () => {
    toast({
      title: "Chat Resolvido",
      description: "Conversa marcada como resolvida",
    });
    console.log('Marked as resolved');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Monitor de Atendimento</h1>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-chart-2" />
            <span className="text-sm text-muted-foreground">Sistema Online</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por Chat ID, cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-80"
            data-testid="input-monitor-search"
          />
          <Button size="icon" data-testid="button-search">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(filter.id)}
            data-testid={`filter-${filter.id}`}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-16rem)]">
        <div className="col-span-3">
          <KPIPanel 
            kpis={mockKPIs} 
            alerts={mockAlerts} 
            assistantDistribution={mockDistribution} 
          />
        </div>

        <div className="col-span-3">
          <div className="border rounded-lg h-full flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold">Fila de Conversas</h2>
              <Badge variant="outline" className="mt-2">
                {filteredConversations.length} conversas
              </Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {filteredConversations.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    isActive={activeConvId === conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="col-span-6">
          {activeConversation ? (
            <ConversationDetails
              chatId={activeConversation.chatId}
              clientName={activeConversation.clientName}
              messages={activeMessages}
              analysis={mockAnalysis}
              isPaused={isPaused}
              onPauseToggle={() => setIsPaused(!isPaused)}
              onTransfer={handleTransfer}
              onAddNote={handleAddNote}
              onMarkResolved={handleMarkResolved}
            />
          ) : (
            <div className="border rounded-lg h-full flex items-center justify-center">
              <p className="text-muted-foreground">Selecione uma conversa para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
