import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Circle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Função para calcular cor do indicador baseado no tempo de espera
function getWaitTimeIndicator(lastMessageTime: Date): { color: string; label: string } {
  const now = new Date();
  const minutesWaiting = Math.floor((now.getTime() - lastMessageTime.getTime()) / (1000 * 60));
  
  if (minutesWaiting < 10) {
    return { color: "text-green-500", label: "Recente" };
  } else if (minutesWaiting < 20) {
    return { color: "text-yellow-500", label: "Aguardando" };
  } else {
    return { color: "text-red-500", label: "Crítico" };
  }
}

interface ConversationCardData {
  id: string;
  chatId: string;
  clientName: string;
  assistant: string;
  duration: number;
  lastMessage: string;
  lastClientMessage?: string;
  lastAIMessage?: string;
  sentiment: "positive" | "neutral" | "negative";
  urgency: "normal" | "high" | "critical";
  hasAlert: boolean;
  transferSuggested: boolean;
  lastMessageTime: Date;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  resolvedBy?: "ai" | "agent" | "auto" | null;
  resolvedByName?: string | null;
}

interface ConversationCardProps {
  conversation: ConversationCardData;
  isActive: boolean;
  onClick: () => void;
}

const sentimentEmoji = {
  positive: "😊",
  neutral: "😐",
  negative: "😠",
};

const sentimentColors = {
  positive: "bg-chart-2/10 text-chart-2",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-destructive/10 text-destructive",
};

const urgencyColors = {
  normal: "bg-muted text-muted-foreground",
  high: "bg-chart-3/10 text-chart-3",
  critical: "bg-destructive/10 text-destructive",
};

const urgencyLabels = {
  normal: "Normal",
  high: "Alta",
  critical: "Crítica",
};

export function ConversationCard({ conversation, isActive, onClick }: ConversationCardProps) {
  const minutes = Math.floor(conversation.duration / 60);
  const seconds = conversation.duration % 60;
  const durationStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const waitTimeIndicator = getWaitTimeIndicator(conversation.lastMessageTime);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border transition-colors hover-elevate active-elevate-2 ${
        isActive ? "bg-accent border-primary" : "border-border"
      }`}
      data-testid={`conversation-card-${conversation.chatId}`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Circle className={`h-3 w-3 fill-current flex-shrink-0 ${waitTimeIndicator.color}`} data-testid="wait-indicator" />
            {conversation.hasAlert && (
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
            )}
            {conversation.transferSuggested && (
              <span className="text-base flex-shrink-0">↪️</span>
            )}
            {conversation.verifiedAt && (
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" data-testid="verified-indicator" />
            )}
            <span className="text-sm font-medium truncate">
              Chat #{conversation.chatId}
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
            <Clock className="h-3 w-3" />
            <span className="text-xs">{durationStr}</span>
          </div>
        </div>

        <div>
          <Badge variant="outline" className="mb-2">
            {conversation.assistant}
          </Badge>
          <p className="text-sm font-medium mb-1">Cliente: {conversation.clientName}</p>
        </div>

        {conversation.lastClientMessage && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Cliente:</p>
            <div className="bg-muted/50 p-2 rounded text-xs italic line-clamp-2">
              "{conversation.lastClientMessage}"
            </div>
          </div>
        )}

        {conversation.lastAIMessage && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">IA:</p>
            <div className="bg-primary/5 p-2 rounded text-xs italic line-clamp-2">
              "{conversation.lastAIMessage}"
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge variant="outline" className={sentimentColors[conversation.sentiment]}>
            {sentimentEmoji[conversation.sentiment]} {conversation.sentiment === "positive" ? "Positivo" : conversation.sentiment === "neutral" ? "Neutro" : "Negativo"}
          </Badge>
          <Badge variant="outline" className={urgencyColors[conversation.urgency]}>
            Urgência: {urgencyLabels[conversation.urgency]}
          </Badge>
        </div>

        {conversation.resolvedBy && (
          <div className="flex gap-2">
            {conversation.resolvedBy === "ai" && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" data-testid="badge-resolved-ai">
                🤖 Finalizada pela IA
              </Badge>
            )}
            {conversation.resolvedBy === "agent" && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" data-testid="badge-resolved-agent">
                👤 {conversation.resolvedByName ? `Finalizada por ${conversation.resolvedByName}` : "Finalizada por Atendente"}
              </Badge>
            )}
            {conversation.resolvedBy === "auto" && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" data-testid="badge-resolved-auto">
                ⏰ Auto-fechada
              </Badge>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Última mensagem {formatDistanceToNow(conversation.lastMessageTime, { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </button>
  );
}
