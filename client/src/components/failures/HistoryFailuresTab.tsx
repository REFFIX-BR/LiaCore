import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type MassiveFailure = {
  id: string;
  name: string;
  description: string;
  status: string;
  startTime: string;
  endTime: string | null;
  resolutionMessage: string | null;
};

export default function HistoryFailuresTab() {
  const { data: failures = [], isLoading } = useQuery<MassiveFailure[]>({
    queryKey: ["/api/failures"],
  });

  const resolvedFailures = failures.filter(f => f.status === "resolved");

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-history-failures-title">Histórico de Falhas</h2>
        <p className="text-muted-foreground">Falhas resolvidas e finalizadas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {resolvedFailures.length} Falhas Resolvidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resolvedFailures.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma falha no histórico</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedFailures.map((failure) => (
                  <TableRow key={failure.id} data-testid={`row-failure-${failure.id}`}>
                    <TableCell className="font-medium">{failure.name}</TableCell>
                    <TableCell className="max-w-md truncate">{failure.description}</TableCell>
                    <TableCell>{format(new Date(failure.startTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell>
                      {failure.endTime ? format(new Date(failure.endTime), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Resolvida</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
