import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Save, 
  Send, 
  History, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  RefreshCw,
  GitBranch,
  Rocket
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type AssistantType = "apresentacao" | "comercial" | "financeiro" | "suporte" | "ouvidoria" | "cancelamento";

interface PromptTemplate {
  id: string;
  assistantType: AssistantType;
  assistantId: string;
  name: string;
  content: string;
  version: string;
  tokenCount: number;
  lastSyncedAt: Date | null;
  hasDraft?: boolean;
  draftLastEditedAt?: Date;
  draftLastEditedBy?: string;
}

interface PromptDraft {
  id: string;
  promptId: string;
  draftContent: string;
  tokenCount: number;
  aiSuggestions: any;
  lastEditedAt: Date;
  lastEditedBy: string;
}

interface PromptVersion {
  id: string;
  promptId: string;
  content: string;
  version: string;
  versionNotes: string | null;
  tokenCount: number;
  aiSuggestions: any;
  createdAt: Date;
  createdBy: string;
}

const assistantNames: Record<AssistantType, string> = {
  apresentacao: "Apresentação",
  comercial: "Comercial",
  financeiro: "Financeiro",
  suporte: "Suporte Técnico",
  ouvidoria: "Ouvidoria",
  cancelamento: "Cancelamento",
};

const assistantColors: Record<AssistantType, string> = {
  apresentacao: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  comercial: "bg-green-500/10 text-green-700 dark:text-green-400",
  financeiro: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  suporte: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  ouvidoria: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  cancelamento: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export default function PromptManagement() {
  const { toast } = useToast();
  const [selectedAssistant, setSelectedAssistant] = useState<AssistantType>("apresentacao");
  const [draftContent, setDraftContent] = useState("");
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showVersionsDialog, setShowVersionsDialog] = useState(false);
  const [versionNotes, setVersionNotes] = useState("");
  const [versionBump, setVersionBump] = useState<"major" | "minor" | "patch">("patch");

  // Fetch all prompts
  const { data: prompts = [], isLoading: loadingPrompts } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompts"],
  });

  // Fetch selected prompt details
  const { data: promptDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["/api/prompts", selectedAssistant],
    enabled: !!selectedAssistant,
  });

  const currentPrompt = promptDetails as PromptTemplate & { draft?: PromptDraft; versions?: PromptVersion[] };

  // Update draft content when prompt changes
  useState(() => {
    if (currentPrompt?.draft) {
      setDraftContent(currentPrompt.draft.draftContent);
    } else if (currentPrompt?.content) {
      setDraftContent(currentPrompt.content);
    }
  });

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/prompts/${currentPrompt.id}/draft`, "POST", {
        draftContent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prompts", selectedAssistant] });
      toast({
        title: "Rascunho salvo",
        description: "Suas alterações foram salvas com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o rascunho",
      });
    },
  });

  // Request AI review mutation
  const aiReviewMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/prompts/${currentPrompt.id}/ai-review`, "POST", {
        context: "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts", selectedAssistant] });
      toast({
        title: "Análise da IA solicitada",
        description: "A IA está analisando o prompt...",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro na análise",
        description: error.message || "Não foi possível solicitar análise da IA",
      });
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/prompts/${currentPrompt.id}/publish`, "POST", {
        versionNotes,
        versionBump,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prompts", selectedAssistant] });
      setShowPublishDialog(false);
      setVersionNotes("");
      toast({
        title: "Versão publicada",
        description: "O prompt foi publicado e sincronizado com o OpenAI",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao publicar",
        description: error.message || "Não foi possível publicar a versão",
      });
    },
  });

  // Restore version mutation
  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      return await apiRequest(`/api/prompts/${currentPrompt.id}/restore/${versionId}`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts", selectedAssistant] });
      setShowVersionsDialog(false);
      toast({
        title: "Versão restaurada",
        description: "A versão foi restaurada como rascunho",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao restaurar",
        description: error.message || "Não foi possível restaurar a versão",
      });
    },
  });

  const hasChanges = currentPrompt && draftContent !== currentPrompt.content;
  const hasDraft = currentPrompt?.draft;

  if (loadingPrompts) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar with prompt list */}
      <div className="w-80 border-r bg-muted/30 p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Gerenciamento de Prompts</h2>
          <p className="text-sm text-muted-foreground">
            Edite e versione os prompts dos assistentes
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <Card
                key={prompt.id}
                className={`cursor-pointer transition-colors hover-elevate active-elevate-2 ${
                  selectedAssistant === prompt.assistantType ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => {
                  setSelectedAssistant(prompt.assistantType);
                  setDraftContent("");
                }}
                data-testid={`card-prompt-${prompt.assistantType}`}
              >
                <CardHeader className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {assistantNames[prompt.assistantType]}
                    </CardTitle>
                    <Badge className={`text-xs ${assistantColors[prompt.assistantType]}`}>
                      v{prompt.version}
                    </Badge>
                  </div>
                  {prompt.hasDraft && (
                    <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
                      <AlertCircle className="w-3 h-3" />
                      <span>Rascunho não publicado</span>
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {currentPrompt && (
          <>
            {/* Header */}
            <div className="border-b bg-background p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5" />
                  <div>
                    <h1 className="text-xl font-semibold">
                      {assistantNames[currentPrompt.assistantType]}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Versão {currentPrompt.version} • {currentPrompt.tokenCount} tokens
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVersionsDialog(true)}
                    data-testid="button-show-versions"
                  >
                    <History className="w-4 h-4 mr-2" />
                    Histórico
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => aiReviewMutation.mutate()}
                    disabled={!hasDraft || aiReviewMutation.isPending}
                    data-testid="button-ai-review"
                  >
                    {aiReviewMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Analisar com IA
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveDraftMutation.mutate()}
                    disabled={!hasChanges || saveDraftMutation.isPending}
                    data-testid="button-save-draft"
                  >
                    {saveDraftMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Salvar Rascunho
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowPublishDialog(true)}
                    disabled={!hasDraft}
                    data-testid="button-publish"
                  >
                    <Rocket className="w-4 h-4 mr-2" />
                    Publicar
                  </Button>
                </div>
              </div>

              {hasDraft && currentPrompt.draft && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    Última edição:{" "}
                    {formatDistanceToNow(new Date(currentPrompt.draft.lastEditedAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="edit" className="h-full flex flex-col">
                <TabsList className="mx-4 mt-4 w-fit">
                  <TabsTrigger value="edit" data-testid="tab-edit">
                    <FileText className="w-4 h-4 mr-2" />
                    Edição
                  </TabsTrigger>
                  <TabsTrigger value="diff" data-testid="tab-diff">
                    <GitBranch className="w-4 h-4 mr-2" />
                    Comparação
                  </TabsTrigger>
                  {currentPrompt.draft?.aiSuggestions && (
                    <TabsTrigger value="ai" data-testid="tab-ai">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Sugestões da IA
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="edit" className="flex-1 overflow-hidden mt-4 px-4">
                  <Card className="h-full flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-base">Conteúdo do Prompt</CardTitle>
                      <CardDescription>
                        Edite as instruções do assistente. Alterações não serão aplicadas até você publicar.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                      <Textarea
                        value={draftContent || currentPrompt.content}
                        onChange={(e) => setDraftContent(e.target.value)}
                        className="h-full resize-none font-mono text-sm"
                        placeholder="Digite as instruções do assistente..."
                        data-testid="textarea-prompt-content"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="diff" className="flex-1 overflow-hidden mt-4 px-4">
                  <div className="grid grid-cols-2 gap-4 h-full">
                    <Card className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Produção (v{currentPrompt.version})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {currentPrompt.content}
                        </pre>
                      </CardContent>
                    </Card>

                    <Card className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          Rascunho (não publicado)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {draftContent || currentPrompt.content}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {currentPrompt.draft?.aiSuggestions && (
                  <TabsContent value="ai" className="flex-1 overflow-hidden mt-4 px-4">
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-purple-600" />
                          Análise e Sugestões da IA
                        </CardTitle>
                        <CardDescription>
                          Recomendações automáticas para otimização do prompt
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-auto">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Análise</h4>
                            <p className="text-sm text-muted-foreground">
                              {currentPrompt.draft.aiSuggestions.analysis || "Nenhuma análise disponível"}
                            </p>
                          </div>
                          {currentPrompt.draft.aiSuggestions.recommendations?.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Recomendações</h4>
                              <ul className="space-y-2">
                                {currentPrompt.draft.aiSuggestions.recommendations.map((rec: any, idx: number) => (
                                  <li key={idx} className="text-sm flex gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </>
        )}
      </div>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent data-testid="dialog-publish">
          <DialogHeader>
            <DialogTitle>Publicar Nova Versão</DialogTitle>
            <DialogDescription>
              Isso irá sincronizar o prompt com o OpenAI e limpar o cache dos assistentes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="version-bump">Tipo de Atualização</Label>
              <Select value={versionBump} onValueChange={(v: any) => setVersionBump(v)}>
                <SelectTrigger id="version-bump" data-testid="select-version-bump">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patch">Patch (correção de bugs)</SelectItem>
                  <SelectItem value="minor">Minor (nova funcionalidade)</SelectItem>
                  <SelectItem value="major">Major (mudança significativa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version-notes">Notas da Versão</Label>
              <Textarea
                id="version-notes"
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                placeholder="Descreva as mudanças feitas nesta versão..."
                rows={4}
                data-testid="textarea-version-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPublishDialog(false)}
              data-testid="button-cancel-publish"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              data-testid="button-confirm-publish"
            >
              {publishMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4 mr-2" />
              )}
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Versions History Dialog */}
      <Dialog open={showVersionsDialog} onOpenChange={setShowVersionsDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-versions">
          <DialogHeader>
            <DialogTitle>Histórico de Versões</DialogTitle>
            <DialogDescription>
              Visualize e restaure versões anteriores do prompt
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-96">
            <div className="space-y-3">
              {currentPrompt?.versions?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma versão anterior disponível
                </p>
              )}
              {currentPrompt?.versions?.map((version) => (
                <Card key={version.id} className="hover-elevate">
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">v{version.version}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(version.createdAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        {version.versionNotes && (
                          <p className="text-sm text-muted-foreground">{version.versionNotes}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{version.tokenCount} tokens</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restoreVersionMutation.mutate(version.id)}
                        disabled={restoreVersionMutation.isPending}
                        data-testid={`button-restore-${version.id}`}
                      >
                        <RefreshCw className="w-3 h-3 mr-2" />
                        Restaurar
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
