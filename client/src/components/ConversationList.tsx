import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

export interface Conversation {
  id: string;
  clientName: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount?: number;
  assistant: "suporte" | "comercial" | "tecnico";
}

interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
}

const assistantColors = {
  suporte: "bg-chart-2/10 text-chart-2",
  comercial: "bg-chart-1/10 text-chart-1",
  tecnico: "bg-chart-4/10 text-chart-4",
};

const assistantLabels = {
  suporte: "Suporte",
  comercial: "Comercial",
  tecnico: "Técnico",
};

export function ConversationList({ conversations, activeId, onSelect }: ConversationListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            data-testid={`conversation-${conv.id}`}
            className={`w-full text-left p-3 rounded-lg hover-elevate active-elevate-2 transition-colors ${
              activeId === conv.id ? "bg-accent" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarFallback className="text-sm font-medium">
                  {conv.clientName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-medium text-sm truncate">{conv.clientName}</h4>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(conv.timestamp, { addSuffix: true })}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground truncate mb-2">
                  {conv.lastMessage}
                </p>
                
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`text-xs ${assistantColors[conv.assistant]}`}>
                    {assistantLabels[conv.assistant]}
                  </Badge>
                  {conv.unreadCount && conv.unreadCount > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
