import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Search, Users, ToggleLeft, ToggleRight, MessageSquare, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";

interface Group {
  id: string;
  groupId: string;
  name: string;
  avatar: string | null;
  aiEnabled: boolean;
  evolutionInstance: string | null;
  lastMessageTime: Date | null;
  lastMessage: string | null;
  participantsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function Groups() {
  const [search, setSearch] = useState("");
  const [aiFilter, setAiFilter] = useState<string>("all");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const { toast } = useToast();

  // Query all groups
  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups", { search, aiEnabled: aiFilter === "all" ? undefined : aiFilter === "enabled" }],
    refetchInterval: 10000,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (aiFilter === "enabled") params.append("aiEnabled", "true");
      if (aiFilter === "disabled") params.append("aiEnabled", "false");
      
      const url = `/api/groups${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      
      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }
      return response.json();
    },
  });

  // Mutation to toggle AI
  const toggleAiMutation = useMutation({
    mutationFn: async (data: { groupId: string; aiEnabled: boolean }) => {
      const response = await fetch(`/api/groups/${data.groupId}/toggle-ai`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ aiEnabled: data.aiEnabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle AI");
      }

      return response.json();
    },
    onSuccess: (data: Group) => {
      toast({
        title: data.aiEnabled ? "IA Ativada" : "IA Desativada",
        description: `IA ${data.aiEnabled ? "ativada" : "desativada"} para ${data.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setSelectedGroup(data);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao alterar status da IA",
        description: error.message || "Ocorreu um erro ao alterar o status",
        variant: "destructive",
      });
    },
  });

  const handleToggleAi = (group: Group) => {
    toggleAiMutation.mutate({
      groupId: group.id,
      aiEnabled: !group.aiEnabled,
    });
  };

  const filteredGroups = groups.filter(group => {
    if (aiFilter === "enabled" && !group.aiEnabled) return false;
    if (aiFilter === "disabled" && group.aiEnabled) return false;
    if (search && !group.name?.toLowerCase().includes(search.toLowerCase()) && 
        !group.groupId?.includes(search)) return false;
    return true;
  });

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 p-6">
      {/* Lista de Grupos */}
      <Card className="w-96 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle>Grupos WhatsApp</CardTitle>
          <CardDescription>Gerenciar IA em grupos</CardDescription>
          
          {/* Busca */}
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar grupos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-search-groups"
            />
          </div>

          {/* Filtros */}
          <Tabs value={aiFilter} onValueChange={setAiFilter} className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" data-testid="filter-all">Todos</TabsTrigger>
              <TabsTrigger value="enabled" data-testid="filter-enabled">IA Ativa</TabsTrigger>
              <TabsTrigger value="disabled" data-testid="filter-disabled">IA Inativa</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <ScrollArea className="flex-1">
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-4">Carregando...</div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">Nenhum grupo encontrado</div>
            ) : (
              filteredGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full text-left p-3 rounded-md border transition-colors hover-elevate ${
                    selectedGroup?.id === group.id ? "bg-accent" : ""
                  }`}
                  data-testid={`group-item-${group.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{group.name}</span>
                    </div>
                    <Badge 
                      variant={group.aiEnabled ? "default" : "secondary"}
                      className="ml-2 flex-shrink-0"
                      data-testid={`badge-ai-${group.id}`}
                    >
                      {group.aiEnabled ? "IA ON" : "IA OFF"}
                    </Badge>
                  </div>
                  {group.lastMessage && (
                    <div className="mt-1 text-sm text-muted-foreground truncate">
                      {group.lastMessage}
                    </div>
                  )}
                  {group.lastMessageTime && (
                    <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(group.lastMessageTime), "dd/MM/yyyy HH:mm")}
                    </div>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Detalhes do Grupo */}
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle>Detalhes do Grupo</CardTitle>
          <CardDescription>
            {selectedGroup ? `Gerenciar ${selectedGroup.name}` : "Selecione um grupo para ver os detalhes"}
          </CardDescription>
        </CardHeader>

        <ScrollArea className="flex-1">
          <CardContent className="space-y-6">
            {!selectedGroup ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Selecione um grupo para ver os detalhes</p>
                </div>
              </div>
            ) : (
              <>
                {/* Informações do Grupo */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Nome do Grupo</Label>
                    <p className="text-lg font-medium mt-1">{selectedGroup.name}</p>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">ID do WhatsApp</Label>
                    <p className="text-sm font-mono mt-1 bg-muted p-2 rounded">{selectedGroup.groupId}</p>
                  </div>

                  {selectedGroup.evolutionInstance && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Instância Evolution</Label>
                      <p className="text-sm mt-1">{selectedGroup.evolutionInstance}</p>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm text-muted-foreground">Participantes</Label>
                    <p className="text-sm mt-1">{selectedGroup.participantsCount || 0} membros</p>
                  </div>

                  {selectedGroup.lastMessage && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Última Mensagem</Label>
                      <p className="text-sm mt-1 p-2 bg-muted rounded">{selectedGroup.lastMessage}</p>
                      {selectedGroup.lastMessageTime && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(selectedGroup.lastMessageTime), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Controle de IA */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="ai-toggle" className="text-base font-medium">
                        Inteligência Artificial
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedGroup.aiEnabled 
                          ? "A IA está respondendo mensagens deste grupo" 
                          : "A IA não responderá mensagens deste grupo"}
                      </p>
                    </div>
                    <Switch
                      id="ai-toggle"
                      checked={selectedGroup.aiEnabled}
                      onCheckedChange={() => handleToggleAi(selectedGroup)}
                      disabled={toggleAiMutation.isPending}
                      data-testid={`switch-ai-${selectedGroup.id}`}
                    />
                  </div>
                </div>

                {/* Informações de Sistema */}
                <div className="border-t pt-6">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Criado em: {format(new Date(selectedGroup.createdAt), "dd/MM/yyyy 'às' HH:mm")}</p>
                    <p>Última atualização: {format(new Date(selectedGroup.updatedAt), "dd/MM/yyyy 'às' HH:mm")}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}
