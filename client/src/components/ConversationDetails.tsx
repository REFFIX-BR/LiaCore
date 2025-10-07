import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Bot, Pause, Play, FileText, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  functionCall?: {
    name: string;
    status: string;
  };
}

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
}: ConversationDetailsProps) {
  const [transferDept, setTransferDept] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [showTransferDialog, setShowTransferDialog] = useState(false);

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
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback>
                      {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {msg.role === "user" ? clientName : "LIA"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(msg.timestamp, { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                    </p>
                    {msg.functionCall && (
                      <Badge variant="outline" className="text-xs">
                        {functionIcons[msg.functionCall.name] || "⚙️"} {msg.functionCall.name}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
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
            </div>

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
