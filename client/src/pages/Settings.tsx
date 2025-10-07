import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Settings as SettingsIcon, 
  Bot, 
  Database, 
  Key, 
  Brain, 
  RefreshCw,
  Trash2,
  Download,
  Upload,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface SystemConfig {
  apiStatus?: {
    openai?: boolean;
    redis?: boolean;
    vector?: boolean;
    evolution?: boolean;
  };
  assistants?: {
    [key: string]: boolean;
  };
  env?: {
    openai?: boolean;
    redis?: boolean;
    vector?: boolean;
    evolution?: boolean;
  };
  evolution?: {
    configured?: boolean;
    url?: string;
    instance?: string;
    hasKey?: boolean;
  };
  learning?: {
    lastAnalysis?: string;
    nextAnalysis?: string;
    analysisIntervalHours?: number;
  };
  stats?: {
    totalConversations?: number;
    knowledgeChunks?: number;
    learningEvents?: number;
    promptUpdates?: number;
  };
  summarization?: {
    summarizeEvery?: number;
    keepRecent?: number;
    contextWindow?: number;
  };
}

export default function Settings() {
  const { toast } = useToast();
  const [configValues, setConfigValues] = useState({
    summarizeEvery: "12",
    keepRecent: "5",
    contextWindow: "7",
    analysisInterval: "2",
  });
  
  const [evolutionConfig, setEvolutionConfig] = useState({
    url: "",
    apiKey: "",
    instance: "",
  });
  
  const [isEditingEvolution, setIsEditingEvolution] = useState(false);

  // Query para buscar configurações do sistema
  const { data: systemConfig } = useQuery<SystemConfig>({
    queryKey: ['/api/system/config'],
  });

  // Sincronizar valores do backend quando dados carregarem
  useEffect(() => {
    if (systemConfig?.summarization || systemConfig?.learning) {
      setConfigValues({
        summarizeEvery: String(systemConfig.summarization?.summarizeEvery || 12),
        keepRecent: String(systemConfig.summarization?.keepRecent || 5),
        contextWindow: String(systemConfig.summarization?.contextWindow || 7),
        analysisInterval: String(systemConfig.learning?.analysisIntervalHours || 2),
      });
    }
    
    if (systemConfig?.evolution) {
      setEvolutionConfig({
        url: systemConfig.evolution.url || "",
        apiKey: "", // Nunca expor a chave atual
        instance: systemConfig.evolution.instance || "",
      });
    }
  }, [systemConfig]);

  // Mutation para atualizar configurações
  const updateConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/system/config', data);
    },
    onSuccess: () => {
      toast({
        title: "Configurações atualizadas",
        description: "As alterações foram salvas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system/config'] });
    },
  });

  // Mutation para trigger de análise manual
  const triggerAnalysisMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/learning/analyze');
    },
    onSuccess: () => {
      toast({
        title: "Análise iniciada",
        description: "A análise de aprendizado foi disparada com sucesso.",
      });
    },
  });

  // Mutation para limpar cache
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/system/clear-cache');
    },
    onSuccess: () => {
      toast({
        title: "Cache limpo",
        description: "O cache do Redis foi limpo com sucesso.",
      });
    },
  });

  // Mutation para atualizar configurações da Evolution API
  const updateEvolutionMutation = useMutation({
    mutationFn: async (data: { url: string; apiKey: string; instance: string }) => {
      return apiRequest('POST', '/api/system/evolution-config', data);
    },
    onSuccess: (response: any) => {
      // Mostrar instruções detalhadas
      const instructions = response.instructions || "Configurações salvas!";
      
      toast({
        title: "✅ Configuração Validada",
        description: (
          <div className="space-y-2 mt-2">
            <p className="font-medium">Próximos passos:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Abra a aba "Secrets" do Replit (ícone 🔑)</li>
              <li>Adicione as 3 variáveis com os valores fornecidos</li>
              <li>Reinicie o servidor para aplicar</li>
            </ol>
          </div>
        ),
        duration: 10000,
      });
      
      // Log das instruções completas no console
      console.log("📋 Instruções Evolution API:", instructions);
      
      queryClient.invalidateQueries({ queryKey: ['/api/system/config'] });
      setIsEditingEvolution(false);
      setEvolutionConfig(prev => ({ ...prev, apiKey: "" })); // Limpar campo de senha
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: error.message || "Não foi possível atualizar as configurações.",
      });
    },
  });

  const assistantIds = [
    { name: "Suporte", env: "OPENAI_SUPORTE_ASSISTANT_ID", key: "suporte" },
    { name: "Comercial", env: "OPENAI_COMMRCIAL_ASSISTANT_ID", key: "comercial" },
    { name: "Financeiro", env: "OPENAI_FINANCEIRO_ASSISTANT_ID", key: "financeiro" },
    { name: "Apresentação", env: "OPENAI_APRESENTACAO_ASSISTANT_ID", key: "apresentacao" },
    { name: "Ouvidoria", env: "OPENAI_OUVIDOIRA_ASSISTANT_ID", key: "ouvidoria" },
    { name: "Cancelamento", env: "OPENAI_CANCELAMENTO_ASSISTANT_ID", key: "cancelamento" },
  ];

  const apiServices = [
    { name: "OpenAI API", key: "openai", status: systemConfig?.apiStatus?.openai || false },
    { name: "Upstash Redis", key: "redis", status: systemConfig?.apiStatus?.redis || false },
    { name: "Upstash Vector", key: "vector", status: systemConfig?.apiStatus?.vector || false },
    { name: "Evolution API", key: "evolution", status: systemConfig?.apiStatus?.evolution || false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-settings-title">
          <SettingsIcon className="w-8 h-8" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie todas as configurações e ferramentas da LIA CORTEX
        </p>
      </div>

      <Tabs defaultValue="assistants" className="w-full">
        <TabsList className="grid w-full grid-cols-5" data-testid="tabs-settings">
          <TabsTrigger value="assistants" data-testid="tab-assistants">
            <Bot className="w-4 h-4 mr-2" />
            Assistentes
          </TabsTrigger>
          <TabsTrigger value="summarization" data-testid="tab-summarization">
            <Brain className="w-4 h-4 mr-2" />
            Resumos
          </TabsTrigger>
          <TabsTrigger value="apis" data-testid="tab-apis">
            <Key className="w-4 h-4 mr-2" />
            APIs
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-learning">
            <Clock className="w-4 h-4 mr-2" />
            Aprendizado
          </TabsTrigger>
          <TabsTrigger value="tools" data-testid="tab-tools">
            <Database className="w-4 h-4 mr-2" />
            Ferramentas
          </TabsTrigger>
        </TabsList>

        {/* Tab: Assistentes OpenAI */}
        <TabsContent value="assistants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assistentes Especializados</CardTitle>
              <CardDescription>
                Gerenciamento dos 6 assistentes OpenAI que compõem a LIA CORTEX
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assistantIds.map((assistant) => (
                <div key={assistant.key} className="flex items-center justify-between p-4 border rounded-lg hover-elevate">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-primary" />
                      <span className="font-medium" data-testid={`text-assistant-${assistant.key}`}>{assistant.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{assistant.env}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" data-testid={`badge-status-${assistant.key}`}>
                      {systemConfig?.assistants?.[assistant.key] ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          Configurado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-destructive" />
                          Não configurado
                        </span>
                      )}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      data-testid={`button-manage-${assistant.key}`}
                      onClick={() => window.open('https://platform.openai.com/assistants', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assistant Cortex (Análise)</CardTitle>
              <CardDescription>
                Assistente responsável pela análise de aprendizado contínuo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    <span className="font-medium">LIA Cortex Analysis</span>
                  </div>
                  <p className="text-sm text-muted-foreground">CORTEX_ASSISTANT_ID</p>
                </div>
                <Badge variant="outline">
                  {systemConfig?.assistants?.cortex ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Configurado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-destructive" />
                      Não configurado
                    </span>
                  )}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Resumo Automático */}
        <TabsContent value="summarization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Resumo Automático</CardTitle>
              <CardDescription>
                Ajuste o comportamento do sistema de resumos inteligentes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="summarize-every">Resumir a cada (mensagens)</Label>
                <Input
                  id="summarize-every"
                  type="number"
                  min="1"
                  value={configValues.summarizeEvery}
                  onChange={(e) => setConfigValues({ ...configValues, summarizeEvery: e.target.value })}
                  data-testid="input-summarize-every"
                />
                <p className="text-sm text-muted-foreground">
                  Número de mensagens antes de gerar um resumo automático (padrão: 12)
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="keep-recent">Manter mensagens recentes</Label>
                <Input
                  id="keep-recent"
                  type="number"
                  min="1"
                  value={configValues.keepRecent}
                  onChange={(e) => setConfigValues({ ...configValues, keepRecent: e.target.value })}
                  data-testid="input-keep-recent"
                />
                <p className="text-sm text-muted-foreground">
                  Quantas mensagens recentes manter intactas para contexto (padrão: 5)
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="context-window">Janela de contexto (roteamento)</Label>
                <Input
                  id="context-window"
                  type="number"
                  min="1"
                  value={configValues.contextWindow}
                  onChange={(e) => setConfigValues({ ...configValues, contextWindow: e.target.value })}
                  data-testid="input-context-window"
                />
                <p className="text-sm text-muted-foreground">
                  Tamanho da janela de mensagens usada para roteamento (padrão: 7)
                </p>
              </div>

              <Button 
                onClick={() => updateConfigMutation.mutate(configValues)}
                disabled={updateConfigMutation.isPending}
                data-testid="button-save-summarization"
                className="w-full"
              >
                {updateConfigMutation.isPending ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Como Funciona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary" />
                <p>
                  <strong>Resumo Automático:</strong> A cada X mensagens, o sistema gera um resumo estruturado em background sem bloquear respostas
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary" />
                <p>
                  <strong>Mensagens Recentes:</strong> As últimas N mensagens são mantidas intactas para fornecer contexto fresco ao roteamento
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary" />
                <p>
                  <strong>Acumulação:</strong> Resumos são mesclados preservando fatos-chave, ações, datas e histórico de assistentes sem duplicação
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: APIs */}
        <TabsContent value="apis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status de Conexões</CardTitle>
              <CardDescription>
                Monitoramento das APIs e serviços externos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiServices.map((service) => (
                <div key={service.key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${service.status ? 'bg-green-500' : 'bg-destructive'}`} />
                    <div>
                      <p className="font-medium" data-testid={`text-api-${service.key}`}>{service.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {service.status ? 'Conectado' : 'Desconectado'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={service.status ? "default" : "destructive"}>
                    {service.status ? "Online" : "Offline"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuração Evolution API</CardTitle>
              <CardDescription>
                Integração com WhatsApp via Evolution API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${systemConfig?.evolution?.configured ? 'bg-green-500' : 'bg-destructive'}`} />
                    <span className="font-medium">Status da Integração</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {systemConfig?.evolution?.configured ? 'Integração WhatsApp ativa' : 'Configuração incompleta'}
                  </p>
                </div>
                <Badge variant={systemConfig?.evolution?.configured ? "default" : "destructive"}>
                  {systemConfig?.evolution?.configured ? "Configurada" : "Pendente"}
                </Badge>
              </div>

              <Separator />

              {!isEditingEvolution ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">URL da API</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-sm">
                        {systemConfig?.evolution?.url || "Não configurado"}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Instância</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-sm">
                        {systemConfig?.evolution?.instance || "Não configurado"}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">API Key</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-sm">
                        {systemConfig?.evolution?.hasKey ? "••••••••••••••••" : "Não configurada"}
                      </code>
                    </div>
                  </div>

                  <Button
                    onClick={() => setIsEditingEvolution(true)}
                    className="w-full"
                    data-testid="button-edit-evolution"
                  >
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Editar Configurações
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="evolution-url">URL da API *</Label>
                    <Input
                      id="evolution-url"
                      type="url"
                      placeholder="https://sua-evolution-api.com"
                      value={evolutionConfig.url}
                      onChange={(e) => setEvolutionConfig({ ...evolutionConfig, url: e.target.value })}
                      data-testid="input-evolution-url"
                    />
                    <p className="text-sm text-muted-foreground">
                      URL base da sua instância Evolution API
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="evolution-instance">Nome da Instância *</Label>
                    <Input
                      id="evolution-instance"
                      type="text"
                      placeholder="minha-instancia"
                      value={evolutionConfig.instance}
                      onChange={(e) => setEvolutionConfig({ ...evolutionConfig, instance: e.target.value })}
                      data-testid="input-evolution-instance"
                    />
                    <p className="text-sm text-muted-foreground">
                      Nome da instância configurada no Evolution API
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="evolution-key">API Key *</Label>
                    <Input
                      id="evolution-key"
                      type="password"
                      placeholder="Digite a API Key"
                      value={evolutionConfig.apiKey}
                      onChange={(e) => setEvolutionConfig({ ...evolutionConfig, apiKey: e.target.value })}
                      data-testid="input-evolution-key"
                    />
                    <p className="text-sm text-muted-foreground">
                      Chave de autenticação da Evolution API (será armazenada com segurança)
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateEvolutionMutation.mutate(evolutionConfig)}
                      disabled={updateEvolutionMutation.isPending || !evolutionConfig.url || !evolutionConfig.instance || !evolutionConfig.apiKey}
                      className="flex-1"
                      data-testid="button-save-evolution"
                    >
                      {updateEvolutionMutation.isPending ? "Salvando..." : "Salvar Configurações"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingEvolution(false);
                        setEvolutionConfig({
                          url: systemConfig?.evolution?.url || "",
                          apiKey: "",
                          instance: systemConfig?.evolution?.instance || "",
                        });
                      }}
                      disabled={updateEvolutionMutation.isPending}
                      data-testid="button-cancel-evolution"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variáveis de Ambiente</CardTitle>
              <CardDescription>
                Chaves de API e tokens configurados no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-muted rounded-lg">
                  <code>OPENAI_API_KEY</code>
                  <p className="text-muted-foreground mt-1">
                    {systemConfig?.env?.openai ? "✓ Configurada" : "✗ Não configurada"}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <code>UPSTASH_REDIS_REST_URL / TOKEN</code>
                  <p className="text-muted-foreground mt-1">
                    {systemConfig?.env?.redis ? "✓ Configurado" : "✗ Não configurado"}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <code>UPSTASH_VECTOR_REST_URL / TOKEN</code>
                  <p className="text-muted-foreground mt-1">
                    {systemConfig?.env?.vector ? "✓ Configurado" : "✗ Não configurado"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Aprendizado Contínuo */}
        <TabsContent value="learning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sistema de Aprendizado Contínuo</CardTitle>
              <CardDescription>
                Configurações de análise e evolução automática dos assistentes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="analysis-interval">Intervalo de Análise (horas)</Label>
                <Input
                  id="analysis-interval"
                  type="number"
                  min="1"
                  max="24"
                  value={configValues.analysisInterval}
                  onChange={(e) => setConfigValues({ ...configValues, analysisInterval: e.target.value })}
                  data-testid="input-analysis-interval"
                />
                <p className="text-sm text-muted-foreground">
                  O sistema executa análise automática de eventos de aprendizado a cada X horas (padrão: 2h para resposta rápida)
                </p>
              </div>
              
              <Button 
                onClick={() => updateConfigMutation.mutate(configValues)}
                disabled={updateConfigMutation.isPending}
                className="w-full"
                data-testid="button-save-learning-config"
              >
                {updateConfigMutation.isPending ? "Salvando..." : "Salvar Configurações"}
              </Button>

              <Separator />

              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Última Análise</span>
                  <Badge variant="outline">
                    {systemConfig?.learning?.lastAnalysis || "Nunca executada"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Próxima análise agendada: {systemConfig?.learning?.nextAnalysis || "Em breve"}
                </p>
              </div>

              <Button 
                onClick={() => triggerAnalysisMutation.mutate()}
                disabled={triggerAnalysisMutation.isPending}
                className="w-full"
                data-testid="button-trigger-analysis"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${triggerAnalysisMutation.isPending ? 'animate-spin' : ''}`} />
                {triggerAnalysisMutation.isPending ? "Executando..." : "Executar Análise Agora"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Critérios de Análise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary" />
                <p>Mínimo de 2 correções explícitas antes de gerar sugestões</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary" />
                <p>Identificação de padrões recorrentes em falhas e transferências</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary" />
                <p>Deduplicação automática para evitar sugestões repetidas</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Ferramentas do Sistema */}
        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manutenção do Sistema</CardTitle>
              <CardDescription>
                Ferramentas para gerenciamento e manutenção da LIA CORTEX
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => clearCacheMutation.mutate()}
                disabled={clearCacheMutation.isPending}
                data-testid="button-clear-cache"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Cache Redis
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start"
                data-testid="button-reindex-knowledge"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-indexar Base de Conhecimento
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start"
                data-testid="button-export-config"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Configurações
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start"
                data-testid="button-import-config"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar Configurações
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estatísticas do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold" data-testid="text-total-conversations">
                  {systemConfig?.stats?.totalConversations || 0}
                </p>
                <p className="text-sm text-muted-foreground">Conversas Totais</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold" data-testid="text-knowledge-chunks">
                  {systemConfig?.stats?.knowledgeChunks || 0}
                </p>
                <p className="text-sm text-muted-foreground">Chunks de Conhecimento</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold" data-testid="text-learning-events">
                  {systemConfig?.stats?.learningEvents || 0}
                </p>
                <p className="text-sm text-muted-foreground">Eventos de Aprendizado</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold" data-testid="text-prompt-updates">
                  {systemConfig?.stats?.promptUpdates || 0}
                </p>
                <p className="text-sm text-muted-foreground">Atualizações de Prompt</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
