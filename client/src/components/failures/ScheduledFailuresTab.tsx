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
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type MassiveFailure = {
  id: string;
  name: string;
  description: string;
  status: string;
  affectedRegions: any;
  startTime: string;
};

export default function ScheduledFailuresTab() {
  const { data: failures = [], isLoading } = useQuery<MassiveFailure[]>({
    queryKey: ["/api/failures/scheduled"],
  });

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
        <h2 className="text-2xl font-bold" data-testid="text-scheduled-failures-title">Falhas Agendadas</h2>
        <p className="text-muted-foreground">Falhas programadas para iniciar em momento futuro</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {failures.length} Falhas Agendadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {failures.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma falha agendada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Início Programado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failures.map((failure) => (
                  <TableRow key={failure.id} data-testid={`row-failure-${failure.id}`}>
                    <TableCell className="font-medium">{failure.name}</TableCell>
                    <TableCell className="max-w-md truncate">{failure.description}</TableCell>
                    <TableCell>{format(new Date(failure.startTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell>
                      <Badge>Agendada</Badge>
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
