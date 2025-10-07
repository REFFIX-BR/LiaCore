import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  functionCall?: {
    name: string;
    status: "pending" | "completed" | "failed";
  };
  assistant?: string;
}

interface ChatMessageProps {
  message: Message;
}

const functionIcons: Record<string, string> = {
  verificar_conexao: "🔌",
  consultar_base_de_conhecimento: "📚",
  consultar_fatura: "📄",
  agendar_visita: "📅",
};

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center py-2">
        <Badge variant="outline" className="text-xs text-muted-foreground">
          {message.content}
        </Badge>
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 py-3 ${isUser ? "" : "bg-primary/5"} px-4 rounded-lg`}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isUser ? "Cliente" : message.assistant || "LIA"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(message.timestamp, { addSuffix: true })}
          </span>
        </div>
        
        <p className="text-sm leading-relaxed">{message.content}</p>
        
        {message.functionCall && (
          <Badge 
            variant="outline" 
            className={`text-xs ${
              message.functionCall.status === "completed" 
                ? "bg-chart-2/10 text-chart-2" 
                : message.functionCall.status === "failed"
                ? "bg-destructive/10 text-destructive"
                : "bg-chart-3/10 text-chart-3"
            }`}
          >
            {functionIcons[message.functionCall.name] || "⚙️"} {message.functionCall.name}
          </Badge>
        )}
      </div>
    </div>
  );
}
