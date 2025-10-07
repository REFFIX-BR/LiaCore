import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { monitorAPI } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Bot } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function TestChat() {
  const [chatId, setChatId] = useState(`chat-${Date.now()}`);
  const [clientName, setClientName] = useState("João Silva");
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const { toast } = useToast();

  const sendMessageMutation = useMutation({
    mutationFn: () => monitorAPI.sendChatMessage(chatId, clientName, message),
    onSuccess: (response: any) => {
      setConversation(prev => [
        ...prev,
        { role: "user", content: message },
        { role: "assistant", content: response.response },
      ]);
      setMessage("");
      toast({
        title: "Mensagem Enviada",
        description: `Roteado para ${response.assistantType}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem",
        variant: "destructive",
      });
      console.error("Error:", error);
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate();
  };

  const handleNewChat = () => {
    setChatId(`chat-${Date.now()}`);
    setConversation([]);
    setMessage("");
  };

  const exampleMessages = [
    "Minha internet está muito lenta!",
    "Quero contratar o plano Fibra Gamer",
    "Qual o valor da minha fatura?",
    "Como faço para cancelar meu plano?",
    "Gostaria de conhecer os planos disponíveis",
    "Quero fazer uma reclamação formal",
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Simulador de Chat TR</h1>
        <p className="text-sm text-muted-foreground">
          Simule conversas de clientes para testar o sistema LIA CORTEX
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Chat Ativo - {chatId}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-96 border rounded-lg p-4">
              {conversation.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Inicie uma conversa enviando uma mensagem
                </div>
              ) : (
                <div className="space-y-4">
                  {conversation.map((msg, idx) => (
                    <div key={idx} className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback>
                          {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="text-sm font-medium mb-1">
                          {msg.role === "user" ? clientName : "LIA"}
                        </div>
                        <div className="text-sm bg-muted p-3 rounded-lg">
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="space-y-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                data-testid="textarea-chat-message"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleSend} 
                  disabled={sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? "Enviando..." : "Enviar"}
                </Button>
                <Button variant="outline" onClick={handleNewChat} data-testid="button-new-chat">
                  Nova Conversa
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Chat ID</Label>
                <Input
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  data-testid="input-chat-id"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  data-testid="input-client-name"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensagens de Exemplo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {exampleMessages.map((msg, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => setMessage(msg)}
                    data-testid={`example-message-${idx}`}
                  >
                    {msg}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
