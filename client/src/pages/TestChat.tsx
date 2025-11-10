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
import { User, Bot, Image as ImageIcon, Mic, X, Download, AlertTriangle, FlaskConical, UserCircle, Briefcase, Wrench, DollarSign, XCircle, Megaphone, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function TestChat() {
  const [chatId, setChatId] = useState(`chat-${Date.now()}`);
  const [clientName, setClientName] = useState("João Silva");
  const [selectedAssistant, setSelectedAssistant] = useState<string>("apresentacao");
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null);
  const { toast } = useToast();

  const sendMessageMutation = useMutation({
    mutationFn: () => monitorAPI.sendChatMessage(
      chatId, 
      clientName, 
      message,
      imageBase64 || undefined,
      audioBase64 || undefined,
      audioMimeType || undefined,
      selectedAssistant
    ),
    onSuccess: (response: any) => {
      // Extract response text (handle both string and nested object)
      const responseText = typeof response.response === 'string' 
        ? response.response 
        : response.response?.response || response.response;
      
      // Use processed message from backend (includes image analysis/audio transcription)
      const userMessageContent = response.userMessage || message || '[Conteúdo enviado]';
      
      setConversation(prev => [
        ...prev,
        { role: "user", content: userMessageContent },
        { role: "assistant", content: responseText },
      ]);
      setMessage("");
      setImagePreview(null);
      setImageBase64(null);
      setAudioPreview(null);
      setAudioBase64(null);
      setAudioMimeType(null);
      
      // Show transfer notification if transferred
      if (response.transferred) {
        toast({
          title: "Transferido para Atendente Humano",
          description: `Departamento: ${response.transferredTo}`,
        });
      } else {
        toast({
          title: "Mensagem Enviada",
          description: `Roteado para ${response.assistantType}`,
        });
      }
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
    if (!message.trim() && !imageBase64 && !audioBase64) return;
    sendMessageMutation.mutate();
  };

  const handleNewChat = () => {
    setChatId(`chat-${Date.now()}`);
    setConversation([]);
    setMessage("");
    setImagePreview(null);
    setImageBase64(null);
    setAudioPreview(null);
    setAudioBase64(null);
    setAudioMimeType(null);
    setSelectedAssistant("apresentacao");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, envie uma imagem JPEG, PNG, WebP ou GIF",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 20MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
      toast({
        title: "Imagem carregada",
        description: "Imagem pronta para envio",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/m4a'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, envie um áudio MP3, OGG, WAV, WebM, MP4 ou M4A",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (1KB-25MB)
    if (file.size < 1024) {
      toast({
        title: "Arquivo muito pequeno",
        description: "O áudio deve ter no mínimo 1KB",
        variant: "destructive",
      });
      return;
    }
    
    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O áudio deve ter no máximo 25MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAudioPreview(file.name);
      setAudioBase64(base64);
      setAudioMimeType(file.type);
      toast({
        title: "Áudio carregado",
        description: "Áudio pronto para envio",
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageBase64(null);
  };

  const removeAudio = () => {
    setAudioPreview(null);
    setAudioBase64(null);
    setAudioMimeType(null);
  };

  const exampleMessages = [
    "Minha internet está muito lenta!",
    "Quero contratar o plano Fibra Gamer",
    "Qual o valor da minha fatura?",
    "Como faço para cancelar meu plano?",
    "Gostaria de conhecer os planos disponíveis",
    "Quero fazer uma reclamação formal",
  ];

  const exportConversation = () => {
    if (conversation.length === 0) {
      toast({
        title: "Sem conversa para exportar",
        description: "Inicie uma conversa antes de exportar",
        variant: "destructive",
      });
      return;
    }

    const exportData = {
      chatId,
      clientName,
      assistant: selectedAssistant,
      timestamp: new Date().toISOString(),
      messages: conversation,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulacao-${chatId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Conversa exportada",
      description: "Arquivo JSON salvo com sucesso",
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold">Simulador de Chat TR</h1>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20" data-testid="badge-simulation">
              <FlaskConical className="h-3 w-3 mr-1" />
              SIMULAÇÃO
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Simule conversas de clientes para testar o sistema LIA CORTEX
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={exportConversation}
          disabled={conversation.length === 0}
          data-testid="button-export-conversation"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar Conversa
        </Button>
      </div>

      <Alert className="bg-blue-500/10 border-blue-500/20">
        <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-500" />
        <AlertDescription className="text-sm text-blue-600 dark:text-blue-500">
          Esta é uma simulação isolada. Nenhuma conversa real será criada no banco de dados.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Chat Ativo - {chatId}</CardTitle>
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 dark:text-orange-500 border-orange-500/20">
              Modo Teste
            </Badge>
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
              {imagePreview && (
                <div className="relative inline-block">
                  <Badge variant="outline" className="mb-2">
                    <ImageIcon className="h-3 w-3 mr-1" />
                    Imagem anexada
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeImage}
                    data-testid="button-remove-image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="max-w-xs rounded-md border"
                    data-testid="image-preview"
                  />
                </div>
              )}
              
              {audioPreview && (
                <div className="flex items-center gap-2 p-2 border rounded-md">
                  <Badge variant="outline">
                    <Mic className="h-3 w-3 mr-1" />
                    Áudio anexado
                  </Badge>
                  <span className="text-sm text-muted-foreground flex-1" data-testid="audio-preview">
                    {audioPreview}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={removeAudio}
                    data-testid="button-remove-audio"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
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
                <div className="flex-1" />
                <div className="relative">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                    data-testid="input-image-upload"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => document.getElementById('image-upload')?.click()}
                    data-testid="button-upload-image"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    type="file"
                    accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4,audio/m4a"
                    onChange={handleAudioUpload}
                    className="hidden"
                    id="audio-upload"
                    data-testid="input-audio-upload"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => document.getElementById('audio-upload')?.click()}
                    data-testid="button-upload-audio"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </div>
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
                <Label>Agente LIA</Label>
                <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
                  <SelectTrigger data-testid="select-assistant">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apresentacao">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4" />
                        <span>Cortex (Recepcionista - Auto-roteamento)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="comercial">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        <span>Comercial (Vendas)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="suporte">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        <span>Suporte Técnico</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="financeiro">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        <span>Financeiro</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="cancelamento">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        <span>Cancelamento</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ouvidoria">
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4" />
                        <span>Ouvidoria</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="cobranca">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Cobrança (Negociação de Dívidas)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedAssistant === "apresentacao" 
                    ? "A recepcionista irá rotear automaticamente para o agente correto"
                    : "Falar diretamente com este agente (sem roteamento)"}
                </p>
              </div>
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
