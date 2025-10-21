import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Bot, Pause, Play, FileText, UserPlus, Trash2, RotateCcw, FolderOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect, useRef } from "react";
import { ChatMessage, type Message as ChatMessageType } from "@/components/ChatMessage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Usando o tipo Message do ChatMessage component
type Message = ChatMessageType;

interface Analysis {
  summary: string;
  intent: string;
  entities: Record<string, string>;
  actions: Array<{
    time: string;
    description: string;
  }>;
  sentimentHistory: Array<{
    time: string;
    score: number;
  }>;
}

interface ConversationDetailsProps {
  chatId: string;
  clientName: string;
  messages: Message[];
  analysis: Analysis;
  isPaused: boolean;
  onPauseToggle: () => void;
  onTransfer: (department: string, notes: string) => void;
  onAddNote: (note: string) => void;
  onMarkResolved: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onResetThread?: () => void;
  onVerify?: () => void;
  isVerified?: boolean;
  onReopen?: () => void;
  conversationStatus?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

const functionIcons: Record<string, string> = {
  verificar_conexao: "🔌",
  consultar_base_de_conhecimento: "📚",
  consultar_fatura: "📄",
  agendar_visita: "📅",
};

export function ConversationDetails({
  chatId,
  clientName,
  messages,
  analysis,
  isPaused,
  onPauseToggle,
  onTransfer,
  onAddNote,
  onMarkResolved,
  onDeleteMessage,
  onResetThread,
  onVerify,
  isVerified,
  onReopen,
  conversationStatus,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: ConversationDetailsProps) {
  const [transferDept, setTransferDept] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para última mensagem quando abrir ou mensagens mudarem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const handleTransfer = () => {
    if (transferDept && transferNotes) {
      onTransfer(transferDept, transferNotes);
      setShowTransferDialog(false);
      setTransferDept("");
      setTransferNotes("");
    }
  };

  const handleAddNote = () => {
    if (internalNote.trim()) {
      onAddNote(internalNote);
      setInternalNote("");
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="text-lg font-semibold">
          {clientName} - Chat #{chatId}
        </CardTitle>
      </CardHeader>
      
      <Tabs defaultValue="transcript" className="flex-1 flex flex-col">
        <TabsList className="mx-6 mt-4">
          <TabsTrigger value="transcript">Transcrição</TabsTrigger>
          <TabsTrigger value="analysis">Análise</TabsTrigger>
          <TabsTrigger value="actions">Ações</TabsTrigger>
        </TabsList>

        <TabsContent value="transcript" className="flex-1 px-6 pb-6">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4 pt-4">
              {hasMore && (
                <div className="flex justify-center pb-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                    data-testid="button-load-more"
                  >
                    {isLoadingMore ? "Carregando..." : "Carregar mensagens anteriores"}
                  </Button>
                </div>
              )}
              {messages.map((msg) => (
                <ChatMessage 
                  key={msg.id} 
                  message={msg}
                  showImageDescription={true}
                  canEdit={!!onDeleteMessage}
                  onDelete={onDeleteMessage ? () => onDeleteMessage(msg.id) : undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="analysis" className="flex-1 px-6 pb-6">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4 pt-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Resumo da Conversa</h4>
                <p className="text-sm text-muted-foreground">{analysis.summary}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Intenção Detectada</h4>
                <Badge>{analysis.intent}</Badge>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Entidades Extraídas</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(analysis.entities).map(([key, value]) => (
                    <Badge key={key} variant="outline">
                      {key}: {value}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Histórico de Ações da IA</h4>
                <div className="space-y-2">
                  {analysis.actions.map((action, idx) => (
                    <div key={idx} className="text-sm flex gap-2">
                      <span className="text-muted-foreground font-mono">{action.time}</span>
                      <span>{action.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Evolução do Sentimento</h4>
                <div className="h-32 border rounded-lg p-4 relative">
                  <svg className="w-full h-full">
                    <polyline
                      points={analysis.sentimentHistory.map((point, idx) => 
                        `${(idx / (analysis.sentimentHistory.length - 1)) * 100}%,${100 - point.score}%`
                      ).join(" ")}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="actions" className="flex-1 px-6 pb-6">
          <div className="space-y-4 pt-4">
            <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full" size="lg" data-testid="button-transfer-human">
                  <UserPlus className="h-4 w-4 mr-2" />
                  INICIAR TRANSFERÊNCIA HUMANA
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transferir para Atendimento Humano</DialogTitle>
                  <DialogDescription>
                    Selecione o departamento e adicione notas para o agente humano
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Departamento</Label>
                    <Select value={transferDept} onValueChange={setTransferDept}>
                      <SelectTrigger data-testid="select-department">
                        <SelectValue placeholder="Selecione o departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="suporte-n2">Suporte Nível 2</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notas (Sussurro para o agente)</Label>
                    <Textarea
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="Ex: Cliente muito irritado com problema de latência..."
                      data-testid="textarea-transfer-notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleTransfer} data-testid="button-confirm-transfer">
                    Confirmar Transferência
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={isPaused ? "default" : "outline"}
                onClick={onPauseToggle}
                data-testid="button-pause-ai"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Reativar IA
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar IA
                  </>
                )}
              </Button>
              
              <Button variant="outline" onClick={onMarkResolved} data-testid="button-mark-resolved">
                ✅ Marcar como Resolvido
              </Button>
              
              {onVerify && (
                <Button 
                  variant={isVerified ? "default" : "outline"}
                  onClick={onVerify}
                  disabled={isVerified}
                  data-testid="button-verify"
                  className={isVerified ? "text-green-600" : ""}
                >
                  {isVerified ? "✓ Verificada" : "Verificar Conversa"}
                </Button>
              )}
            </div>

            {onResetThread && (
              <Button 
                variant="secondary" 
                onClick={onResetThread} 
                className="w-full"
                data-testid="button-reset-thread"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Resetar Contexto OpenAI
              </Button>
            )}

            {onReopen && conversationStatus !== 'active' && (
              <Button 
                variant="default" 
                onClick={onReopen} 
                className="w-full"
                data-testid="button-reopen-conversation"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Reabrir Conversa
              </Button>
            )}

            <div className="space-y-2">
              <Label>Adicionar Nota Interna</Label>
              <Textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Nota visível apenas para supervisores..."
                data-testid="textarea-internal-note"
              />
              <Button onClick={handleAddNote} className="w-full" data-testid="button-add-note">
                <FileText className="h-4 w-4 mr-2" />
                Adicionar Nota
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
