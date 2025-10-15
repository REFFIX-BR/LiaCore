import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LogIn, 
  LogOut, 
  Clock, 
  Globe, 
  Monitor,
  UserCheck,
  UserX,
  CheckCircle2,
  ArrowRightLeft,
  Users,
  Shield
} from "lucide-react";
import { format } from "date-fns";

type ActivityLog = {
  id: string;
  userId: string;
  action: 'LOGIN' | 'LOGOUT' | 'transfer_conversation' | 'resolve_conversation' | 'assign_conversation' | 'self_assign' | 'verify_conversation';
  ipAddress: string | null;
  userAgent: string | null;
  sessionDuration: number | null;
  conversationId: string | null;
  targetUserId: string | null;
  details: any;
  createdAt: Date;
  user?: {
    id: string;
    fullName: string;
    username: string;
    role: string;
  };
  conversation?: {
    id: string;
    clientName: string;
    chatId: string;
  };
  targetUser?: {
    id: string;
    fullName: string;
    username: string;
  };
};

export default function ActivityLogs() {
  const [activeTab, setActiveTab] = useState<'agents' | 'supervision'>('agents');
  
  const { data: logsData, isLoading, error } = useQuery<{ logs: ActivityLog[] }>({
    queryKey: ["/api/activity-logs"],
    refetchInterval: 10000,
  });

  const logs = logsData?.logs || [];

  // Separar logs por tipo
  const agentLogs = logs.filter(log => log.action === 'LOGIN' || log.action === 'LOGOUT');
  const supervisionLogs = logs.filter(log => 
    log.action === 'transfer_conversation' || 
    log.action === 'resolve_conversation' || 
    log.action === 'assign_conversation' || 
    log.action === 'self_assign' ||
    log.action === 'verify_conversation'
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Carregando logs de atividade...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-destructive">Erro ao carregar logs: {error.message}</p>
      </div>
    );
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const getBrowser = (userAgent: string | null) => {
    if (!userAgent) return 'Desconhecido';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Outro';
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, { text: string; icon: any; variant: any }> = {
      'transfer_conversation': { text: 'Transferir', icon: ArrowRightLeft, variant: 'default' },
      'resolve_conversation': { text: 'Finalizar', icon: CheckCircle2, variant: 'default' },
      'assign_conversation': { text: 'Atribuir', icon: UserCheck, variant: 'default' },
      'self_assign': { text: 'Auto-atribuir', icon: UserCheck, variant: 'secondary' },
      'verify_conversation': { text: 'Verificar', icon: Shield, variant: 'default' },
    };
    return labels[action] || { text: action, icon: Users, variant: 'secondary' };
  };

  return (
    <div className="space-y-6" data-testid="page-activity-logs">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logs de Atividade</h1>
        <p className="text-muted-foreground">
          Registro completo de auditoria das ações na plataforma
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Acessos Hoje
            </CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agentLogs.filter(log => 
                log.action === 'LOGIN' && 
                new Date(log.createdAt).toDateString() === new Date().toDateString()
              ).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Sessões Ativas
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                // Agrupar logins por usuário
                const userLogins = new Map<string, Date>();
                const userLogouts = new Map<string, Date>();
                
                agentLogs.forEach(log => {
                  const logDate = new Date(log.createdAt);
                  if (log.action === 'LOGIN') {
                    const currentLogin = userLogins.get(log.userId);
                    if (!currentLogin || logDate > currentLogin) {
                      userLogins.set(log.userId, logDate);
                    }
                  } else if (log.action === 'LOGOUT') {
                    const currentLogout = userLogouts.get(log.userId);
                    if (!currentLogout || logDate > currentLogout) {
                      userLogouts.set(log.userId, logDate);
                    }
                  }
                });
                
                // Contar sessões ativas (login mais recente que logout)
                let activeSessions = 0;
                userLogins.forEach((loginDate, userId) => {
                  const logoutDate = userLogouts.get(userId);
                  if (!logoutDate || loginDate > logoutDate) {
                    activeSessions++;
                  }
                });
                
                return activeSessions;
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ações Hoje
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {supervisionLogs.filter(log => 
                new Date(log.createdAt).toDateString() === new Date().toDateString()
              ).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tempo Médio
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const sessionsWithDuration = agentLogs.filter(log => log.action === 'LOGOUT' && log.sessionDuration);
                if (sessionsWithDuration.length === 0) return '-';
                const avgSeconds = sessionsWithDuration.reduce((sum, log) => sum + (log.sessionDuration || 0), 0) / sessionsWithDuration.length;
                return formatDuration(avgSeconds);
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'agents' | 'supervision')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="agents" data-testid="tab-agents">
            <Users className="h-4 w-4 mr-2" />
            Agentes ({agentLogs.length})
          </TabsTrigger>
          <TabsTrigger value="supervision" data-testid="tab-supervision">
            <Shield className="h-4 w-4 mr-2" />
            Supervisão ({supervisionLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Agentes */}
        <TabsContent value="agents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Login e Logout de Agentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Duração da Sessão</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Navegador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum log de agente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentLogs.map((log) => (
                      <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                        <TableCell className="font-medium">
                          {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{log.user?.fullName || 'Desconhecido'}</span>
                            <span className="text-xs text-muted-foreground">@{log.user?.username || 'unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={log.action === 'LOGIN' ? 'default' : 'secondary'}
                            className="gap-1"
                          >
                            {log.action === 'LOGIN' ? (
                              <><LogIn className="h-3 w-3" /> Login</>
                            ) : (
                              <><LogOut className="h-3 w-3" /> Logout</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.action === 'LOGOUT' ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {formatDuration(log.sessionDuration)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{log.ipAddress || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Monitor className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{getBrowser(log.userAgent)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Supervisão */}
        <TabsContent value="supervision" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Ações de Supervisão</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Atendente Alvo</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supervisionLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum log de supervisão encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    supervisionLogs.map((log) => {
                      const actionInfo = getActionLabel(log.action);
                      const ActionIcon = actionInfo.icon;
                      
                      return (
                        <TableRow key={log.id} data-testid={`supervision-log-${log.id}`}>
                          <TableCell className="font-medium">
                            {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{log.user?.fullName || 'Desconhecido'}</span>
                              <span className="text-xs text-muted-foreground">@{log.user?.username || 'unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={actionInfo.variant} className="gap-1">
                              <ActionIcon className="h-3 w-3" />
                              {actionInfo.text}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.conversation ? (
                              <div className="flex flex-col">
                                <span className="font-medium">{log.conversation.clientName}</span>
                                <span className="text-xs text-muted-foreground">{log.conversation.chatId}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.targetUser ? (
                              <div className="flex flex-col">
                                <span className="font-medium">{log.targetUser.fullName}</span>
                                <span className="text-xs text-muted-foreground">@{log.targetUser.username}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.details?.assistantType && (
                              <Badge variant="outline" className="text-xs">
                                {log.details.assistantType}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
