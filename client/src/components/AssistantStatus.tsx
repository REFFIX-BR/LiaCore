import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Headphones, Briefcase, Wrench } from "lucide-react";

export interface Assistant {
  id: string;
  name: string;
  type: "suporte" | "comercial" | "tecnico";
  status: "online" | "processing" | "offline";
  activeChats: number;
  successRate: number;
}

interface AssistantStatusProps {
  assistants: Assistant[];
}

const assistantIcons = {
  suporte: Headphones,
  comercial: Briefcase,
  tecnico: Wrench,
};

const statusColors = {
  online: "bg-chart-2 text-white",
  processing: "bg-chart-3 text-white",
  offline: "bg-muted text-muted-foreground",
};

export function AssistantStatus({ assistants }: AssistantStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Status dos Assistentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {assistants.map((assistant) => {
          const Icon = assistantIcons[assistant.type];
          return (
            <div
              key={assistant.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover-elevate"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-card flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">{assistant.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {assistant.activeChats} conversas ativas
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {assistant.successRate}%
                </span>
                <Badge className={`text-xs ${statusColors[assistant.status]}`}>
                  {assistant.status === "online" ? "Online" : 
                   assistant.status === "processing" ? "Processando" : "Offline"}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
