import { useState, useEffect } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { useTokenCount } from "@/hooks/use-token-count";

type AssistantType = "apresentacao" | "comercial" | "financeiro" | "suporte" | "ouvidoria" | "cancelamento";

interface PromptTemplate {
  id: string;
  assistantType: AssistantType;
  assistantId: string;
  title: string;
  content: string;
  version: string;
  tokenCount: number;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  hasDraft?: boolean;
  draftLastEditedAt?: Date;
  draftLastEditedBy?: string;
  pendingEvolutionsCount?: number;
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
  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);
  const [versionNotes, setVersionNotes] = useState("");
  const [versionBump, setVersionBump] = useState<"major" | "minor" | "patch">("patch");
  const [consolidationResult, setConsolidationResult] = useState<any>(null);
  
  // Token counter
  const { count: tokenCount, isLoading: countingTokens } = useTokenCount(draftContent);

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

  // Sync draft content when prompt changes
  useEffect(() => {
    if (currentPrompt?.draft?.draftContent) {
      setDraftContent(currentPrompt.draft.draftContent);
    } else if (currentPrompt?.content) {
      setDraftContent(currentPrompt.content);
    }
  }, [currentPrompt?.id, currentPrompt?.draft?.draftContent, currentPrompt?.content]);

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

  // Mark evolutions as applied mutation
  const markEvolutionsAppliedMutation = useMutation({
    mutationFn: async (data: { version: string; appliedIds: string[] }) => {
      return await apiRequest(`/api/prompts/${currentPrompt.id}/mark-evolutions-applied`, "POST", {
        version: data.version,
        appliedSuggestionIds: data.appliedIds,
        duplicateGroups: consolidationResult?.duplicateGroups || [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prompts", selectedAssistant] });
      setConsolidationResult(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Aviso: Sugestões não foram marcadas",
        description: `A versão foi publicada, mas houve um erro ao marcar as sugestões como aplicadas: ${error.message}`,
        duration: 8000,
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
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prompts", selectedAssistant] });
      setShowPublishDialog(false);
      setVersionNotes("");
      
      toast({
        title: "Versão publicada",
        description: "O prompt foi publicado e sincronizado com o OpenAI",
      });

      // If there were consolidated evolutions, mark them as applied
      if (consolidationResult && consolidationResult.appliedSuggestions.length > 0) {
        const appliedIds = consolidationResult.appliedSuggestions
          .filter((s: any) => s.applied)
          .map((s: any) => s.suggestionId);
        
        if (appliedIds.length > 0) {
          markEvolutionsAppliedMutation.mutate({
            version: result.version,
            appliedIds,
          });
        }
      }
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

  // Consolidate evolutions mutation
  const consolidateEvolutionsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/prompts/${currentPrompt.id}/consolidate-evolutions`, "POST", {});
    },
    onSuccess: (result: any) => {
      if (!result?.consolidation) {
        toast({
          variant: "destructive",
          title: "Erro ao consolidar",
          description: "Resposta inválida do servidor",
        });
        return;
      }

      setConsolidationResult(result.consolidation);
      
      // Update draft content with the consolidated prompt
      if (result.consolidation.updatedPrompt) {
        setDraftContent(result.consolidation.updatedPrompt);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prompts", selectedAssistant] });
      setShowConsolidationDialog(true);
      
      const appliedCount = result.consolidation.summary?.appliedCount || 0;
      toast({
        title: "Evoluções consolidadas",
        description: `${appliedCount} sugestões aplicadas ao rascunho`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao consolidar",
        description: error.message || "Não foi possível consolidar as evoluções",
      });
    },
  });

  // Apply AI suggestions function
  const handleApplyAISuggestions = () => {
    if (!currentPrompt?.draft?.aiSuggestions?.optimizations) {
      toast({
        variant: "destructive",
        title: "Nenhuma otimização disponível",
        description: "Execute 'Analisar com IA' primeiro",
      });
      return;
    }

    let updatedContent = draftContent;
    let appliedCount = 0;
    let skippedCount = 0;

    // Helper function to normalize whitespace for comparison
    const normalizeWhitespace = (text: string) => {
      return text.replace(/\s+/g, ' ').trim();
    };

    // Apply each optimization (before -> after) preserving whitespace
    currentPrompt.draft.aiSuggestions.optimizations.forEach((opt: any) => {
      if (opt.before && opt.after) {
        // Try exact match first
        if (updatedContent.includes(opt.before)) {
          updatedContent = updatedContent.replace(opt.before, opt.after);
          appliedCount++;
        } else {
          // Try normalized match (for cases where AI normalized whitespace)
          const normalizedBefore = normalizeWhitespace(opt.before);
          const normalizedCurrent = normalizeWhitespace(updatedContent);
          
          // Skip if before is whitespace-only (would match everywhere)
          if (!normalizedBefore) {
            skippedCount++;
            return;
          }
          
          if (normalizedCurrent.includes(normalizedBefore)) {
            // Find the actual text in the draft that matches (preserving original formatting)
            // Create a regex that matches the text with flexible whitespace
            // Trim the pattern to ignore leading/trailing whitespace differences
            const trimmedBefore = opt.before.trim();
            
            // Extra safety: skip if trimmed is empty
            if (!trimmedBefore) {
              skippedCount++;
              return;
            }
            
            const regexPattern = trimmedBefore
              .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
              .replace(/\s+/g, '\\s+'); // Match any whitespace with \s+
            
            // Make leading/trailing whitespace optional
            const regex = new RegExp(`\\s*${regexPattern}\\s*`);
            const match = updatedContent.match(regex);
            
            if (match) {
              // Replace the matched text (with original formatting) with the 'after' text
              updatedContent = updatedContent.replace(match[0], opt.after);
              appliedCount++;
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        }
      }
    });

    if (appliedCount > 0) {
      setDraftContent(updatedContent);
      toast({
        title: "Sugestões aplicadas",
        description: `${appliedCount} otimização(ões) aplicada(s) ao rascunho${skippedCount > 0 ? ` (${skippedCount} não encontrada(s))` : ''}`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Nenhuma otimização aplicada",
        description: "Os trechos 'antes' não foram encontrados no rascunho atual",
      });
    }
  };

  const hasChanges = currentPrompt && draftContent !== currentPrompt.content;
  const hasDraft = currentPrompt?.draft;
  const hasPendingEvolutions = currentPrompt?.pendingEvolutionsCount && currentPrompt.pendingEvolutionsCount > 0;

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
                  {prompt.pendingEvolutionsCount && prompt.pendingEvolutionsCount > 0 && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                      <Sparkles className="w-3 h-3" />
                      <span>{prompt.pendingEvolutionsCount} sugestões pendentes</span>
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        Versão {currentPrompt.version} • {currentPrompt.tokenCount} tokens
                      </p>
                      {currentPrompt.lastSyncError && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="destructive" className="h-5 text-xs cursor-help" data-testid="badge-sync-error">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Erro de Sincronização
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-xs">{currentPrompt.lastSyncError}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
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
                  {hasPendingEvolutions && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => consolidateEvolutionsMutation.mutate()}
                      disabled={consolidateEvolutionsMutation.isPending}
                      data-testid="button-consolidate-evolutions"
                    >
                      {consolidateEvolutionsMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Consolidar Evoluções ({currentPrompt?.pendingEvolutionsCount})
                    </Button>
                  )}
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
                    <CardContent className="flex-1 overflow-hidden flex flex-col gap-2">
                      <Textarea
                        value={draftContent || currentPrompt.content}
                        onChange={(e) => setDraftContent(e.target.value)}
                        className="flex-1 resize-none font-mono text-sm"
                        placeholder="Digite as instruções do assistente..."
                        data-testid="textarea-prompt-content"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                        <div className="flex items-center gap-4">
                          <span data-testid="text-token-count">
                            {countingTokens ? (
                              <span className="flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Contando tokens...
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                <strong>{tokenCount.toLocaleString()}</strong> tokens
                              </span>
                            )}
                          </span>
                          {tokenCount > 8000 && (
                            <Badge variant="destructive" className="h-5">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Limite recomendado: 8000 tokens
                            </Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground/60">
                          {draftContent.length.toLocaleString()} caracteres
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="diff" className="flex-1 overflow-hidden mt-4 px-4">
                  <div className="grid grid-cols-2 gap-4 h-full max-h-[calc(100vh-240px)]">
                    <Card className="flex flex-col h-full">
                      <CardHeader className="flex-shrink-0">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Produção (v{currentPrompt.version})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-auto min-h-0">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {currentPrompt.content}
                        </pre>
                      </CardContent>
                    </Card>

                    <Card className="flex flex-col h-full">
                      <CardHeader className="flex-shrink-0">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          Rascunho (não publicado)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-auto min-h-0">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {draftContent || currentPrompt.content}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {currentPrompt.draft?.aiSuggestions && (
                  <TabsContent value="ai" className="flex-1 overflow-hidden mt-4 px-4" data-testid="ai-analysis-panel">
                    <ScrollArea className="h-full">
                      <div className="space-y-6 pr-4">
                        {/* Score */}
                        {currentPrompt.draft.aiSuggestions.score !== undefined && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <Sparkles className="w-5 h-5 text-purple-600" />
                                  Pontuação Geral
                                </span>
                                <Badge variant={currentPrompt.draft.aiSuggestions.score >= 80 ? "default" : "secondary"} className="text-lg px-3">
                                  {currentPrompt.draft.aiSuggestions.score}/100
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                          </Card>
                        )}

                        {/* Analysis */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Análise Geral</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {currentPrompt.draft.aiSuggestions.analysis || "Nenhuma análise disponível"}
                            </p>
                          </CardContent>
                        </Card>

                        {/* Strengths */}
                        {currentPrompt.draft.aiSuggestions.strengths?.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                Pontos Fortes
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2">
                                {currentPrompt.draft.aiSuggestions.strengths.map((strength: string, idx: number) => (
                                  <li key={idx} className="text-sm flex gap-2">
                                    <span className="text-green-600 flex-shrink-0">✓</span>
                                    <span>{strength}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}

                        {/* Weaknesses */}
                        {currentPrompt.draft.aiSuggestions.weaknesses?.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-orange-600" />
                                Pontos a Melhorar
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2">
                                {currentPrompt.draft.aiSuggestions.weaknesses.map((weakness: string, idx: number) => (
                                  <li key={idx} className="text-sm flex gap-2">
                                    <span className="text-orange-600 flex-shrink-0">!</span>
                                    <span>{weakness}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}

                        {/* Recommendations */}
                        {currentPrompt.draft.aiSuggestions.recommendations?.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Recomendações</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                {currentPrompt.draft.aiSuggestions.recommendations.map((rec: any, idx: number) => (
                                  <div key={idx} className="border-l-2 border-purple-600 pl-4 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                                        {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground capitalize">{rec.category}</span>
                                    </div>
                                    <p className="text-sm">{rec.suggestion}</p>
                                    {rec.example && (
                                      <pre className="text-xs bg-muted p-2 rounded mt-2 whitespace-pre-wrap">
                                        {rec.example}
                                      </pre>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Optimizations */}
                        {currentPrompt.draft.aiSuggestions.optimizations?.length > 0 && (
                          <Card>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Otimizações Sugeridas</CardTitle>
                                <Button
                                  size="sm"
                                  onClick={handleApplyAISuggestions}
                                  data-testid="button-apply-ai-suggestions"
                                  className="gap-2"
                                >
                                  <Rocket className="w-4 h-4" />
                                  Aplicar Sugestões
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                {currentPrompt.draft.aiSuggestions.optimizations.map((opt: any, idx: number) => (
                                  <div key={idx} className="space-y-2">
                                    <h5 className="font-medium text-sm">{opt.title}</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Antes:</p>
                                        <pre className="text-xs bg-red-500/10 p-2 rounded whitespace-pre-wrap border border-red-500/20">
                                          {opt.before}
                                        </pre>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Depois:</p>
                                        <pre className="text-xs bg-green-500/10 p-2 rounded whitespace-pre-wrap border border-green-500/20">
                                          {opt.after}
                                        </pre>
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground italic">{opt.rationale}</p>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </ScrollArea>
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

      {/* Consolidation Result Dialog */}
      <Dialog open={showConsolidationDialog} onOpenChange={setShowConsolidationDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]" data-testid="dialog-consolidation">
          <DialogHeader>
            <DialogTitle>Evoluções Consolidadas</DialogTitle>
            <DialogDescription>
              As sugestões de evolução foram processadas e consolidadas no rascunho
            </DialogDescription>
          </DialogHeader>

          {consolidationResult && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-4 gap-3">
                  <Card>
                    <CardHeader className="p-3">
                      <CardDescription className="text-xs">Total</CardDescription>
                      <CardTitle className="text-2xl">{consolidationResult.summary.totalSuggestions}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="p-3">
                      <CardDescription className="text-xs">Aplicadas</CardDescription>
                      <CardTitle className="text-2xl text-green-600 dark:text-green-400">
                        {consolidationResult.summary.appliedCount}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="p-3">
                      <CardDescription className="text-xs">Duplicadas</CardDescription>
                      <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">
                        {consolidationResult.summary.duplicatesCount}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="p-3">
                      <CardDescription className="text-xs">Conflitos</CardDescription>
                      <CardTitle className="text-2xl text-orange-600 dark:text-orange-400">
                        {consolidationResult.summary.conflictsCount}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* Changes by Category */}
                {consolidationResult.changes && consolidationResult.changes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Mudanças por Categoria</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {consolidationResult.changes.map((change: any, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <Badge variant="outline" className="mt-0.5">{change.count}</Badge>
                          <div>
                            <p className="font-medium text-sm">{change.category}</p>
                            <p className="text-xs text-muted-foreground">{change.description}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Applied Suggestions */}
                {consolidationResult.appliedSuggestions && consolidationResult.appliedSuggestions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sugestões Aplicadas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {consolidationResult.appliedSuggestions.map((suggestion: any, i: number) => (
                        <div key={i} className="border-l-2 border-green-500 pl-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <Badge variant="outline" className="text-xs">{suggestion.category}</Badge>
                          </div>
                          <p className="text-sm">{suggestion.howApplied}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Duplicate Groups */}
                {consolidationResult.duplicateGroups && consolidationResult.duplicateGroups.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sugestões Duplicadas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {consolidationResult.duplicateGroups.map((group: any, i: number) => (
                        <div key={i} className="border-l-2 border-blue-500 pl-3 space-y-1">
                          <p className="text-sm font-medium">
                            {group.duplicateIds.length} sugestões similares consolidadas
                          </p>
                          <p className="text-xs text-muted-foreground">{group.reason}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Not Applied */}
                {consolidationResult.notApplied && consolidationResult.notApplied.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Não Aplicadas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {consolidationResult.notApplied.map((item: any, i: number) => (
                        <div key={i} className="border-l-2 border-orange-500 pl-3">
                          <p className="text-xs text-muted-foreground">{item.reason}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConsolidationDialog(false)}
              data-testid="button-close-consolidation"
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                setShowConsolidationDialog(false);
                toast({
                  title: "Próximo passo",
                  description: "Revise o rascunho e publique quando estiver pronto",
                });
              }}
              data-testid="button-continue-consolidation"
            >
              Continuar Editando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
