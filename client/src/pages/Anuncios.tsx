import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Info, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AnnouncementType = 'info' | 'warning' | 'alert' | 'success';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  priority: number;
  active: boolean;
  startDate: string;
  endDate?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

const announcementSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  message: z.string().min(10, "Mensagem deve ter no mínimo 10 caracteres"),
  type: z.enum(['info', 'warning', 'alert', 'success']),
  priority: z.number().min(0).max(100),
  active: z.boolean(),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
});

type AnnouncementFormData = z.infer<typeof announcementSchema>;

export default function Anuncios() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");

  // Query para listar anúncios
  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ['/api/announcements'],
  });

  // Mutation para criar
  const createMutation = useMutation({
    mutationFn: async (data: AnnouncementFormData) => {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erro ao criar anúncio');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/active'] });
      toast({
        title: "Anúncio criado com sucesso!",
        description: "O anúncio foi adicionado ao sistema.",
      });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Erro ao criar anúncio",
        description: "Não foi possível criar o anúncio. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AnnouncementFormData> }) => {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erro ao atualizar anúncio');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/active'] });
      toast({
        title: "Anúncio atualizado!",
        description: "As alterações foram salvas com sucesso.",
      });
      setIsDialogOpen(false);
      setEditingAnnouncement(null);
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar anúncio",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erro ao deletar anúncio');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/active'] });
      toast({
        title: "Anúncio deletado!",
        description: "O anúncio foi removido do sistema.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao deletar anúncio",
        description: "Não foi possível deletar o anúncio. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Form
  const form = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: "",
      message: "",
      type: "info",
      priority: 50,
      active: true,
      startDate: new Date().toISOString().slice(0, 16),
      endDate: null,
    },
  });

  // Abrir dialog para criar
  const handleCreate = () => {
    setEditingAnnouncement(null);
    form.reset({
      title: "",
      message: "",
      type: "info",
      priority: 50,
      active: true,
      startDate: new Date().toISOString().slice(0, 16),
      endDate: null,
    });
    setIsDialogOpen(true);
  };

  // Abrir dialog para editar
  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    form.reset({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type,
      priority: announcement.priority,
      active: announcement.active,
      startDate: new Date(announcement.startDate).toISOString().slice(0, 16),
      endDate: announcement.endDate ? new Date(announcement.endDate).toISOString().slice(0, 16) : null,
    });
    setIsDialogOpen(true);
  };

  // Deletar
  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja deletar este anúncio?")) {
      deleteMutation.mutate(id);
    }
  };

  // Submit do formulário
  const onSubmit = (data: AnnouncementFormData) => {
    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filtrar anúncios
  const filteredAnnouncements = announcements.filter((announcement) => {
    if (filterType !== "all" && announcement.type !== filterType) return false;
    if (filterActive === "active" && !announcement.active) return false;
    if (filterActive === "inactive" && announcement.active) return false;
    return true;
  });

  // Ícones e cores por tipo
  const typeConfig = {
    info: { icon: Info, label: "Informação", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
    warning: { icon: AlertTriangle, label: "Aviso", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    alert: { icon: AlertCircle, label: "Alerta", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
    success: { icon: CheckCircle, label: "Sucesso", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  };

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Anúncios</h1>
          <p className="text-muted-foreground">
            Gerencie comunicados e mensagens importantes para o sistema
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-announcement">
          <Plus className="h-4 w-4 mr-2" />
          Novo Anúncio
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Tipo</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger data-testid="select-filter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="info">Informação</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="alert">Alerta</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger data-testid="select-filter-active">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Anúncios</CardTitle>
          <CardDescription>
            {filteredAnnouncements.length} {filteredAnnouncements.length === 1 ? 'anúncio encontrado' : 'anúncios encontrados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum anúncio encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnnouncements.map((announcement) => {
                  const config = typeConfig[announcement.type];
                  const Icon = config.icon;

                  return (
                    <TableRow key={announcement.id} data-testid={`row-announcement-${announcement.id}`}>
                      <TableCell>
                        <Badge className={config.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{announcement.title}</TableCell>
                      <TableCell className="max-w-md truncate">{announcement.message}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{announcement.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={announcement.active ? "default" : "secondary"}>
                          {announcement.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(announcement.startDate), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {announcement.endDate 
                          ? format(new Date(announcement.endDate), "dd/MM/yyyy HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(announcement)}
                            data-testid={`button-edit-${announcement.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(announcement.id)}
                            data-testid={`button-delete-${announcement.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para criar/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? "Editar Anúncio" : "Novo Anúncio"}
            </DialogTitle>
            <DialogDescription>
              {editingAnnouncement 
                ? "Altere as informações do anúncio abaixo."
                : "Preencha as informações para criar um novo anúncio."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Manutenção Programada" data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Digite a mensagem completa do anúncio..."
                        rows={4}
                        data-testid="input-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="info">Informação</SelectItem>
                          <SelectItem value="warning">Aviso</SelectItem>
                          <SelectItem value="alert">Alerta</SelectItem>
                          <SelectItem value="success">Sucesso</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade (0-100)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          min={0}
                          max={100}
                          data-testid="input-priority"
                        />
                      </FormControl>
                      <FormDescription>Maior = mais importante</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Início</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field}
                          value={field.value || ""}
                          data-testid="input-start-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Fim (Opcional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field}
                          value={field.value || ""}
                          data-testid="input-end-date"
                        />
                      </FormControl>
                      <FormDescription>Deixe vazio para sem limite</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ativo</FormLabel>
                      <FormDescription>
                        Anúncios ativos serão exibidos no banner
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingAnnouncement ? "Salvar Alterações" : "Criar Anúncio"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
