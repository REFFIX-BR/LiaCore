import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Brain, CheckCircle2, XCircle, Edit3, TrendingUp, Activity, FileText, GraduationCap, Play, Square } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PromptSuggestion, PromptUpdate, TrainingSession } from "@shared/schema";

export default function AgentEvolution() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("suggestions");
  const [selectedSuggestion, setSelectedSuggestion] = useState<PromptSuggestion | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  
  // Training session state
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);
  const [trainingTitle, setTrainingTitle] = useState("");
  const [trainingAssistant, setTrainingAssistant] = useState("suporte");
  const [trainingContent, setTrainingContent] = useState("");
  const [trainingNotes, setTrainingNotes] = useState("");

  // Fetch suggestions
  const { data: suggestions = [], isLoading: loadingSuggestions } = useQuery<PromptSuggestion[]>({
    queryKey: ['/api/learning/suggestions'],
  });

  // Fetch updates
  const { data: updates = [], isLoading: loadingUpdates } = useQuery<PromptUpdate[]>({
    queryKey: ['/api/learning/updates'],
  });

  // Fetch training sessions
  const { data: trainingSessions = [], isLoading: loadingTraining } = useQuery<TrainingSession[]>({
    queryKey: ['/api/training/sessions'],
  });

  // Trigger analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      console.log("🟢 Executando mutationFn...");
      const result = await apiRequest('/api/learning/analyze', 'POST', {});
      console.log("✅ Resposta recebida:", result);
      return result;
    },
    onSuccess: (data: any) => {
      console.log("✅ onSuccess chamado com:", data);
      queryClient.invalidateQueries({ queryKey: ['/api/learning/suggestions'] });
      const count = data.suggestions?.length || 0;
      
      toast({
        title: count > 0 ? 'Sugestões Geradas' : 'Análise Concluída',
        description: count > 0 
          ? `${count} sugestão(ões) gerada(s) e pronta(s) para revisão.`
          : 'Nenhuma sugestão gerada. Poucos eventos ou baixa confiança nos padrões.',
      });
    },
    onError: (error: any) => {
      console.error("❌ onError chamado com:", error);
      toast({
        title: 'Erro na Análise',
        description: 'Não foi possível executar a análise. Tente novamente.',
        variant: 'destructive',
      });
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

  // Create training session mutation
  const createTrainingMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/training/sessions', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training/sessions'] });
      setShowTrainingDialog(false);
      setTrainingTitle("");
      setTrainingAssistant("suporte");
      setTrainingContent("");
      setTrainingNotes("");
    },
  });

  // Complete training session mutation
  const completeTrainingMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/training/sessions/${id}/complete`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training/sessions'] });
    },
  });

  // Apply training session mutation
  const applyTrainingMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/training/sessions/${id}/apply`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/learning/updates'] });
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
      support: "LIA Suporte",
      comercial: "LIA Comercial",
      sales: "LIA Comercial",
      financeiro: "LIA Financeiro",
      finance: "LIA Financeiro",
      apresentacao: "LIA Apresentação",
      presentation: "LIA Apresentação",
      ouvidoria: "LIA Ouvidoria",
      ombudsman: "LIA Ouvidoria",
      cancelamento: "LIA Cancelamento",
      cancellation: "LIA Cancelamento",
    };
    return names[type] || type;
  };

  const handleCreateTraining = () => {
    createTrainingMutation.mutate({
      title: trainingTitle,
      assistantType: trainingAssistant,
      trainingType: 'manual',
      content: trainingContent,
      notes: trainingNotes,
    });
  };

  const handleCompleteTraining = (id: string) => {
    if (confirm("Marcar esta sessão como completa?")) {
      completeTrainingMutation.mutate(id);
    }
  };

  const handleApplyTraining = (id: string) => {
    if (confirm("Aplicar este treinamento e gerar melhorias nos prompts?")) {
      applyTrainingMutation.mutate(id);
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const reviewedSuggestions = suggestions.filter(s => s.status !== 'pending');
  
  const activeSessions = trainingSessions.filter(s => s.status === 'active');
  const completedSessions = trainingSessions.filter(s => s.status === 'completed');
  const appliedSessions = trainingSessions.filter(s => s.status === 'applied');

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
            onClick={async () => {
              console.log("🔵 Botão Analisar clicado!");
              try {
                const response = await fetch('/api/learning/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                });
                const data = await response.json();
                console.log("✅ Resposta:", data);
                
                queryClient.invalidateQueries({ queryKey: ['/api/learning/suggestions'] });
                
                const count = data.suggestions?.length || 0;
                toast({
                  title: count > 0 ? 'Sugestões Geradas' : 'Análise Concluída',
                  description: count > 0 
                    ? `${count} sugestão(ões) gerada(s) e pronta(s) para revisão.`
                    : 'Nenhuma sugestão gerada. Poucos eventos ou baixa confiança nos padrões.',
                });
              } catch (error) {
                console.error("❌ Erro:", error);
                toast({
                  title: 'Erro na Análise',
                  description: 'Não foi possível executar a análise. Tente novamente.',
                  variant: 'destructive',
                });
              }
            }}
            data-testid="button-analyze"
          >
            <Activity className="w-4 h-4 mr-2" />
            Analisar Eventos
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
            <TabsTrigger value="training" data-testid="tab-training">
              <GraduationCap className="w-4 h-4 mr-2" />
              Treinamento Manual ({activeSessions.length})
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

          <TabsContent value="training" className="flex-1 overflow-hidden mt-4 px-4">
            <ScrollArea className="h-full">
              <div className="mb-4">
                <Button
                  onClick={() => setShowTrainingDialog(true)}
                  data-testid="button-new-training"
                >
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Nova Sessão de Treinamento
                </Button>
              </div>

              {loadingTraining ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-loading-training">
                  Carregando sessões de treinamento...
                </div>
              ) : trainingSessions.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground" data-testid="text-no-training">
                      Nenhuma sessão de treinamento criada. Use "start" e "stop" durante conversas ou crie manualmente.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6 pb-4">
                  {/* Sessões Ativas */}
                  {activeSessions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Play className="w-5 h-5 text-primary" />
                        Sessões Ativas ({activeSessions.length})
                      </h3>
                      <div className="space-y-3">
                        {activeSessions.map((session) => (
                          <Card key={session.id} data-testid={`card-training-${session.id}`}>
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <CardTitle className="flex items-center gap-2">
                                    {session.title}
                                    <Badge variant="default">Ativa</Badge>
                                    {session.trainingType === 'keyword_triggered' && (
                                      <Badge variant="outline">Automática</Badge>
                                    )}
                                  </CardTitle>
                                  <CardDescription className="mt-1">
                                    {getAssistantName(session.assistantType)}
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {session.notes && (
                                <p className="text-sm text-muted-foreground">{session.notes}</p>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleCompleteTraining(session.id)}
                                  size="sm"
                                  variant="outline"
                                  disabled={completeTrainingMutation.isPending}
                                  data-testid={`button-complete-${session.id}`}
                                >
                                  <Square className="w-4 h-4 mr-2" />
                                  Completar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sessões Completadas */}
                  {completedSessions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Sessões Completadas ({completedSessions.length})</h3>
                      <div className="space-y-3">
                        {completedSessions.map((session) => (
                          <Card key={session.id} data-testid={`card-completed-${session.id}`}>
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <CardTitle className="flex items-center gap-2">
                                    {session.title}
                                    <Badge variant="secondary">Completa</Badge>
                                  </CardTitle>
                                  <CardDescription className="mt-1">
                                    {getAssistantName(session.assistantType)} • {new Date(session.completedAt!).toLocaleDateString('pt-BR')}
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {session.content && (
                                <details className="text-sm">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Ver conteúdo do treinamento
                                  </summary>
                                  <div className="mt-2 p-3 border rounded-md bg-muted/50 whitespace-pre-wrap max-h-64 overflow-y-auto">
                                    {session.content}
                                  </div>
                                </details>
                              )}
                              <Button
                                onClick={() => handleApplyTraining(session.id)}
                                size="sm"
                                disabled={applyTrainingMutation.isPending}
                                data-testid={`button-apply-${session.id}`}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Aplicar Treinamento
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sessões Aplicadas */}
                  {appliedSessions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Sessões Aplicadas ({appliedSessions.length})</h3>
                      <div className="space-y-3">
                        {appliedSessions.map((session) => (
                          <Card key={session.id} className="opacity-70" data-testid={`card-applied-${session.id}`}>
                            <CardContent className="py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{session.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {getAssistantName(session.assistantType)} • {new Date(session.appliedAt!).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                                <Badge variant="default">Aplicada</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
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

      {/* Training Dialog */}
      <Dialog open={showTrainingDialog} onOpenChange={setShowTrainingDialog}>
        <DialogContent data-testid="dialog-training">
          <DialogHeader>
            <DialogTitle>Nova Sessão de Treinamento</DialogTitle>
            <DialogDescription>
              Crie uma sessão manual de treinamento para melhorar o comportamento dos assistentes LIA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="training-title">Título *</Label>
              <Input
                id="training-title"
                value={trainingTitle}
                onChange={(e) => setTrainingTitle(e.target.value)}
                placeholder="Ex: Atendimento ao cliente com problemas técnicos"
                data-testid="input-training-title"
              />
            </div>
            <div>
              <Label htmlFor="training-assistant">Assistente *</Label>
              <Select value={trainingAssistant} onValueChange={setTrainingAssistant}>
                <SelectTrigger id="training-assistant" data-testid="select-training-assistant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suporte">LIA Suporte</SelectItem>
                  <SelectItem value="comercial">LIA Comercial</SelectItem>
                  <SelectItem value="financeiro">LIA Financeiro</SelectItem>
                  <SelectItem value="apresentacao">LIA Apresentação</SelectItem>
                  <SelectItem value="ouvidoria">LIA Ouvidoria</SelectItem>
                  <SelectItem value="cancelamento">LIA Cancelamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="training-content">Conteúdo do Treinamento *</Label>
              <Textarea
                id="training-content"
                value={trainingContent}
                onChange={(e) => setTrainingContent(e.target.value)}
                placeholder="Cole aqui exemplos de conversas, procedimentos corretos ou instruções..."
                rows={6}
                data-testid="textarea-training-content"
              />
            </div>
            <div>
              <Label htmlFor="training-notes">Notas (opcional)</Label>
              <Textarea
                id="training-notes"
                value={trainingNotes}
                onChange={(e) => setTrainingNotes(e.target.value)}
                placeholder="Observações adicionais sobre este treinamento..."
                rows={3}
                data-testid="textarea-training-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTrainingDialog(false);
                setTrainingTitle("");
                setTrainingAssistant("support");
                setTrainingContent("");
                setTrainingNotes("");
              }}
              data-testid="button-cancel-training"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateTraining}
              disabled={!trainingTitle || !trainingContent || createTrainingMutation.isPending}
              data-testid="button-create-training"
            >
              {createTrainingMutation.isPending ? "Criando..." : "Criar Sessão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
