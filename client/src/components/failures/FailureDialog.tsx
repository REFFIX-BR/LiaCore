import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RegionSelector } from "./RegionSelector";

type MassiveFailure = {
  id: string;
  name: string;
  description: string;
  status: string;
  affectedRegions: any;
  notificationMessage: string;
  resolutionMessage: string | null;
  startTime: string;
};

type FailureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  failure: MassiveFailure | null;
};

export default function FailureDialog({ open, onOpenChange, failure }: FailureDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [selectedRegions, setSelectedRegions] = useState<Array<{city: string; neighborhoods: string[]}>>([]);

  useEffect(() => {
    if (failure) {
      setName(failure.name);
      setDescription(failure.description);
      setStatus(failure.status);
      setNotificationMessage(failure.notificationMessage);
      setSelectedRegions(failure.affectedRegions?.custom || []);
    } else {
      setName("");
      setDescription("");
      setStatus("active");
      setNotificationMessage("");
      setSelectedRegions([]);
    }
  }, [failure, open]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/failures", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/failures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/failures/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/failures/scheduled"] });
      toast({
        title: "Falha criada",
        description: "A falha foi criada com sucesso.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar a falha.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/failures/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/failures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/failures/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/failures/scheduled"] });
      toast({
        title: "Falha atualizada",
        description: "A falha foi atualizada com sucesso.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a falha.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRegions.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma região afetada.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      name,
      description,
      status,
      affectedRegions: {
        type: "custom",
        custom: selectedRegions,
      },
      notificationMessage,
      startTime: new Date(),
    };

    if (failure) {
      updateMutation.mutate({ id: failure.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">
            {failure ? "Editar Falha" : "Nova Falha Massiva"}
          </DialogTitle>
          <DialogDescription>
            {failure ? "Atualize as informações da falha." : "Crie uma nova falha massiva para notificar clientes afetados."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Falha *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Falha de Fibra - Centro"
              required
              data-testid="input-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema técnico"
              required
              rows={3}
              data-testid="input-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="scheduled">Agendada</SelectItem>
                <SelectItem value="resolved">Resolvida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notificationMessage">Mensagem de Notificação *</Label>
            <Textarea
              id="notificationMessage"
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
              placeholder="Mensagem que será enviada aos clientes afetados"
              required
              rows={4}
              data-testid="input-notification"
            />
          </div>

          <div className="space-y-2">
            <Label>Regiões Afetadas *</Label>
            <RegionSelector
              value={selectedRegions}
              onChange={setSelectedRegions}
            />
            <p className="text-xs text-muted-foreground">
              Selecione as cidades e bairros afetados pela falha
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : (failure ? "Atualizar" : "Criar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
