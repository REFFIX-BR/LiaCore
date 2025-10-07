import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Brain, CheckCircle2, XCircle, Edit3, TrendingUp, Activity, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { PromptSuggestion, PromptUpdate } from "@shared/schema";

export default function AgentEvolution() {
  const [selectedTab, setSelectedTab] = useState("suggestions");
  const [selectedSuggestion, setSelectedSuggestion] = useState<PromptSuggestion | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  // Fetch suggestions
  const { data: suggestions = [], isLoading: loadingSuggestions } = useQuery<PromptSuggestion[]>({
    queryKey: ['/api/learning/suggestions'],
  });

  // Fetch updates
  const { data: updates = [], isLoading: loadingUpdates } = useQuery<PromptUpdate[]>({
    queryKey: ['/api/learning/updates'],
  });

  // Trigger analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: () => apiRequest('/api/learning/analyze', 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/learning/suggestions'] });
    },
  });

  // Review suggestion mutation
  const reviewMutation = useMutation({
    mutationFn: ({ id, status, reviewedBy, reviewNotes }: any) =>
      apiRequest(`/api/learning/suggestions/${id}`, 'PUT', { status, reviewedBy, reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/learning/suggestions'] });
      setShowReviewDialog(false);
      setSelectedSuggestion(null);
      setReviewNotes("");
    },
  });

  // Apply suggestion mutation
  const applyMutation = useMutation({
    mutationFn: ({ id, appliedBy }: any) =>
      apiRequest(`/api/learning/suggestions/${id}/apply`, 'POST', { appliedBy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/learning/suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/learning/updates'] });
      setShowReviewDialog(false);
      setSelectedSuggestion(null);
    },
  });

  const handleApprove = (suggestion: PromptSuggestion) => {
    setSelectedSuggestion(suggestion);
    setShowReviewDialog(true);
  };

  const handleReject = (suggestion: PromptSuggestion) => {
    if (confirm("Tem certeza que deseja rejeitar esta sugestão?")) {
      reviewMutation.mutate({
        id: suggestion.id,
        status: "rejected",
        reviewedBy: "Supervisor",
        reviewNotes: "Rejeitada pelo supervisor",
      });
    }
  };

  const handleApplyConfirm = () => {
    if (selectedSuggestion) {
      applyMutation.mutate({
        id: selectedSuggestion.id,
        appliedBy: "Supervisor",
      });
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 90) return <Badge variant="default">Alta ({score}%)</Badge>;
    if (score >= 70) return <Badge variant="secondary">Média ({score}%)</Badge>;
    return <Badge variant="outline">Baixa ({score}%)</Badge>;
  };

  const getAssistantName = (type: string) => {
    const names: Record<string, string> = {
      suporte: "LIA Suporte",
      comercial: "LIA Comercial",
      financeiro: "LIA Financeiro",
      apresentacao: "LIA Apresentação",
      ouvidoria: "LIA Ouvidoria",
      cancelamento: "LIA Cancelamento",
    };
    return names[type] || type;
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const reviewedSuggestions = suggestions.filter(s => s.status !== 'pending');

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-primary" data-testid="icon-brain" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-title">Evolução dos Agentes</h1>
              <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
                Sistema de aprendizagem contínua baseado em feedback
              </p>
            </div>
          </div>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            data-testid="button-analyze"
          >
            <Activity className="w-4 h-4 mr-2" />
            {analyzeMutation.isPending ? "Analisando..." : "Analisar Eventos"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="h-full flex flex-col">
          <TabsList className="mx-4 mt-4" data-testid="tabs-list">
            <TabsTrigger value="suggestions" data-testid="tab-suggestions">
              <TrendingUp className="w-4 h-4 mr-2" />
              Sugestões ({pendingSuggestions.length})
            </TabsTrigger>
            <TabsTrigger value="updates" data-testid="tab-updates">
              <FileText className="w-4 h-4 mr-2" />
              Log de Atualizações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="flex-1 overflow-hidden mt-4 px-4">
            <ScrollArea className="h-full">
              {loadingSuggestions ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">
                  Carregando sugestões...
                </div>
              ) : pendingSuggestions.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground" data-testid="text-no-suggestions">
                      Nenhuma sugestão pendente. Execute uma análise para gerar novas sugestões.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4 pb-4">
                  {pendingSuggestions.map((suggestion) => (
                    <Card key={suggestion.id} data-testid={`card-suggestion-${suggestion.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2" data-testid={`text-assistant-${suggestion.id}`}>
                              {getAssistantName(suggestion.assistantType)}
                              {getConfidenceBadge(suggestion.confidenceScore)}
                            </CardTitle>
                            <CardDescription className="mt-2" data-testid={`text-problem-${suggestion.id}`}>
                              {suggestion.problemIdentified}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2 text-sm">Análise da Causa Raiz:</h4>
                          <p className="text-sm text-muted-foreground" data-testid={`text-analysis-${suggestion.id}`}>
                            {suggestion.rootCauseAnalysis}
                          </p>
                        </div>

                        <div className="border rounded-md p-3 bg-muted/50">
                          <h4 className="font-semibold mb-2 text-sm">Alteração Sugerida:</h4>
                          <div className="space-y-2 text-sm font-mono">
                            <div className="text-red-600 dark:text-red-400">
                              <span className="mr-2">-</span>
                              <span data-testid={`text-current-${suggestion.id}`}>{suggestion.currentPrompt}</span>
                            </div>
                            <div className="text-green-600 dark:text-green-400">
                              <span className="mr-2">+</span>
                              <span data-testid={`text-suggested-${suggestion.id}`}>{suggestion.suggestedPrompt}</span>
                            </div>
                          </div>
                        </div>

                        {suggestion.affectedConversations && suggestion.affectedConversations.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Baseado em {suggestion.affectedConversations.length} conversas afetadas
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => handleApprove(suggestion)}
                            variant="default"
                            data-testid={`button-approve-${suggestion.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Aprovar e Aplicar
                          </Button>
                          <Button
                            onClick={() => handleReject(suggestion)}
                            variant="outline"
                            data-testid={`button-reject-${suggestion.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Rejeitar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {reviewedSuggestions.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Sugestões Revisadas</h3>
                  <div className="space-y-2">
                    {reviewedSuggestions.map((suggestion) => (
                      <Card key={suggestion.id} className="opacity-60">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{getAssistantName(suggestion.assistantType)}</p>
                              <p className="text-sm text-muted-foreground">{suggestion.problemIdentified}</p>
                            </div>
                            <Badge variant={suggestion.status === 'applied' ? 'default' : 'secondary'}>
                              {suggestion.status === 'applied' ? 'Aplicada' : 
                               suggestion.status === 'approved' ? 'Aprovada' : 'Rejeitada'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="updates" className="flex-1 overflow-hidden mt-4 px-4">
            <ScrollArea className="h-full">
              {loadingUpdates ? (
                <div className="text-center py-8 text-muted-foreground">Carregando atualizações...</div>
              ) : updates.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground" data-testid="text-no-updates">
                      Nenhuma atualização registrada ainda.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3 pb-4">
                  {updates.map((update) => (
                    <Card key={update.id} data-testid={`card-update-${update.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold" data-testid={`text-update-assistant-${update.id}`}>
                              {getAssistantName(update.assistantType)}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {update.modificationType} • {new Date(update.createdAt!).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <Badge variant="outline">{update.appliedBy}</Badge>
                        </div>
                        <p className="text-sm mb-3">{update.reason}</p>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Ver alterações
                          </summary>
                          <div className="mt-2 space-y-1 font-mono border rounded-md p-2 bg-muted/50">
                            <div className="text-red-600 dark:text-red-400">
                              <span className="mr-2">-</span>{update.previousValue}
                            </div>
                            <div className="text-green-600 dark:text-green-400">
                              <span className="mr-2">+</span>{update.newValue}
                            </div>
                          </div>
                        </details>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent data-testid="dialog-review">
          <DialogHeader>
            <DialogTitle>Aplicar Sugestão</DialogTitle>
            <DialogDescription>
              Esta ação irá atualizar o prompt do assistente {selectedSuggestion && getAssistantName(selectedSuggestion.assistantType)} imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notas da Revisão (opcional)</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Adicione observações sobre esta alteração..."
                data-testid="textarea-review-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReviewDialog(false);
                setSelectedSuggestion(null);
                setReviewNotes("");
              }}
              data-testid="button-cancel-review"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleApplyConfirm}
              disabled={applyMutation.isPending}
              data-testid="button-confirm-apply"
            >
              {applyMutation.isPending ? "Aplicando..." : "Confirmar e Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
