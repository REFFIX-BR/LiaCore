import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogIn, LogOut, Clock, Globe, Monitor } from "lucide-react";
import { format } from "date-fns";

type ActivityLog = {
  id: string;
  userId: string;
  action: 'LOGIN' | 'LOGOUT';
  ipAddress: string | null;
  userAgent: string | null;
  sessionDuration: number | null;
  createdAt: Date;
  user?: {
    id: string;
    fullName: string;
    username: string;
    role: string;
  };
};

export default function ActivityLogs() {
  const { data: logsData, isLoading, error } = useQuery<{ logs: ActivityLog[] }>({
    queryKey: ["/api/activity-logs"],
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  const logs = logsData?.logs || [];

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

  return (
    <div className="space-y-6" data-testid="page-activity-logs">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logs de Atividade</h1>
        <p className="text-muted-foreground">
          Registro de login e logout dos usuários da plataforma
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Acessos Hoje
            </CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter(log => 
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
              {logs.filter((log, index) => {
                if (log.action !== 'LOGIN') return false;
                // Check if there's a logout after this login
                const hasLogout = logs.slice(0, index).some(
                  l => l.action === 'LOGOUT' && l.userId === log.userId && l.createdAt > log.createdAt
                );
                return !hasLogout;
              }).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tempo Médio de Sessão
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const sessionsWithDuration = logs.filter(log => log.action === 'LOGOUT' && log.sessionDuration);
                if (sessionsWithDuration.length === 0) return '-';
                const avgSeconds = sessionsWithDuration.reduce((sum, log) => sum + (log.sessionDuration || 0), 0) / sessionsWithDuration.length;
                return formatDuration(avgSeconds);
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Atividades</CardTitle>
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
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum log de atividade encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
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
    </div>
  );
}
