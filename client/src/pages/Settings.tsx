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
  };
  assistants?: {
    [key: string]: boolean;
  };
  env?: {
    openai?: boolean;
    redis?: boolean;
    vector?: boolean;
  };
  learning?: {
    lastAnalysis?: string;
    nextAnalysis?: string;
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
  });

  // Query para buscar configurações do sistema
  const { data: systemConfig } = useQuery<SystemConfig>({
    queryKey: ['/api/system/config'],
  });

  // Sincronizar valores do backend quando dados carregarem
  useEffect(() => {
    if (systemConfig?.summarization) {
      setConfigValues({
        summarizeEvery: String(systemConfig.summarization.summarizeEvery || 12),
        keepRecent: String(systemConfig.summarization.keepRecent || 5),
        contextWindow: String(systemConfig.summarization.contextWindow || 7),
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
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Intervalo de Análise</span>
                  <Badge variant="outline">24 horas</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  O sistema executa análise automática de eventos de aprendizado a cada 24 horas
                </p>
              </div>

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
