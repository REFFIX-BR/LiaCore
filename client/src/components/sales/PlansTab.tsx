import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { 
  Plus,
  Pencil,
  Wifi,
  Package2,
  Eye,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type Plan = {
  id: string;
  name: string;
  type: string;
  speed: number;
  price: number;
  description: string | null;
  features: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const planFormSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  type: z.string().min(1, "Tipo é obrigatório"),
  speed: z.string(),
  price: z.string().min(1, "Preço é obrigatório"),
  description: z.string().optional(),
  features: z.string().optional(),
  isActive: z.boolean().default(true),
});

export default function PlansTab() {
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const form = useForm<z.infer<typeof planFormSchema>>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      id: "",
      name: "",
      type: "internet",
      speed: "0",
      price: "",
      description: "",
      features: "",
      isActive: true,
    },
  });

  // Buscar todos os planos (incluindo inativos)
  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans/all"],
  });

  // Mutation para criar/atualizar plano
  const savePlanMutation = useMutation({
    mutationFn: async (data: z.infer<typeof planFormSchema>) => {
      const payload = {
        ...data,
        speed: parseInt(data.speed) || 0,
        price: parseFloat(data.price),
        features: data.features ? data.features.split("\n").filter(Boolean) : [],
      };

      if (isCreating) {
        return await apiRequest("/api/plans", "POST", payload);
      } else {
        return await apiRequest(`/api/plans/${selectedPlan?.id}`, "PUT", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setEditDialogOpen(false);
      setSelectedPlan(null);
      form.reset();
      toast({
        title: isCreating ? "Plano criado" : "Plano atualizado",
        description: `O plano foi ${isCreating ? "criado" : "atualizado"} com sucesso.`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: `Não foi possível ${isCreating ? "criar" : "atualizar"} o plano.`,
        variant: "destructive",
      });
    },
  });

  // Mutation para ativar/desativar plano
  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/plans/${id}/toggle-status`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({
        title: "Status alterado",
        description: "O status do plano foi alterado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do plano.",
        variant: "destructive",
      });
    },
  });

  const handleCreatePlan = () => {
    setIsCreating(true);
    setSelectedPlan(null);
    form.reset({
      id: "",
      name: "",
      type: "internet",
      speed: "0",
      price: "",
      description: "",
      features: "",
      isActive: true,
    });
    setEditDialogOpen(true);
  };

  const handleEditPlan = (plan: Plan) => {
    setIsCreating(false);
    setSelectedPlan(plan);
    form.reset({
      id: plan.id,
      name: plan.name,
      type: plan.type,
      speed: plan.speed.toString(),
      price: plan.price.toString(),
      description: plan.description || "",
      features: plan.features?.join("\n") || "",
      isActive: plan.isActive,
    });
    setEditDialogOpen(true);
  };

  const handleToggleStatus = (id: string) => {
    toggleStatusMutation.mutate(id);
  };

  const onSubmit = (data: z.infer<typeof planFormSchema>) => {
    savePlanMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando planos...</p>
      </div>
    );
  }

  const activePlans = plans.filter((p) => p.isActive);
  const inactivePlans = plans.filter((p) => !p.isActive);

  return (
    <div className="p-6 space-y-6">
      {/* Header com botão de criar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Planos e Serviços</h2>
          <p className="text-muted-foreground">
            Configure os planos disponíveis para venda
          </p>
        </div>
        <Button onClick={handleCreatePlan} data-testid="button-criar-plano">
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Planos</CardTitle>
            <Package2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-planos">{plans.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <ToggleRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-planos-ativos">{activePlans.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Inativos</CardTitle>
            <ToggleLeft className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-planos-inativos">{inactivePlans.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de planos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Planos ({plans.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Velocidade</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">Nenhum plano cadastrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => (
                    <TableRow key={plan.id} data-testid={`row-plano-${plan.id}`}>
                      <TableCell className="font-medium">{plan.id}</TableCell>
                      <TableCell>{plan.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {plan.type === "internet" ? "Internet" : plan.type === "combo" ? "Combo" : "Móvel"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {plan.speed > 0 ? `${plan.speed} Mbps` : "-"}
                      </TableCell>
                      <TableCell className="font-semibold">
                        R$ {plan.price.toFixed(2).replace(".", ",")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={plan.isActive ? "default" : "secondary"}
                          className={plan.isActive ? "bg-green-500" : "bg-gray-500"}
                        >
                          {plan.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditPlan(plan)}
                          data-testid={`button-editar-${plan.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(plan.id)}
                          data-testid={`button-toggle-${plan.id}`}
                        >
                          {plan.isActive ? (
                            <ToggleRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-red-500" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de criar/editar plano */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? "Criar Novo Plano" : "Editar Plano"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do plano. Os campos com * são obrigatórios.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Ex: 28" 
                          disabled={!isCreating}
                          data-testid="input-plano-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-plano-tipo">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="internet">Internet Pura</SelectItem>
                          <SelectItem value="combo">Combo (Internet + Móvel + TV)</SelectItem>
                          <SelectItem value="mobile">Móvel</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Plano *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: DIAMANTE - 1 Giga + 50GB + Telefonia Fixa"
                        data-testid="input-plano-nome"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="speed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Velocidade (Mbps)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          placeholder="Ex: 1000"
                          data-testid="input-plano-velocidade"
                        />
                      </FormControl>
                      <FormDescription>
                        Velocidade da internet (0 para planos móveis)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço (R$) *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="Ex: 249.90"
                          data-testid="input-plano-preco"
                        />
                      </FormControl>
                      <FormDescription>
                        Preço mensal em reais
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Descrição do plano"
                        rows={3}
                        data-testid="input-plano-descricao"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="features"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Benefícios/Features</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Um benefício por linha&#10;Wi-Fi 6 grátis&#10;Instalação gratuita&#10;Dupla operadora (Vivo + Tim)"
                        rows={5}
                        data-testid="input-plano-features"
                      />
                    </FormControl>
                    <FormDescription>
                      Um benefício por linha
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Plano Ativo
                      </FormLabel>
                      <FormDescription>
                        Planos inativos não aparecem para os clientes
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-plano-ativo"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)}
                  data-testid="button-cancelar-plano"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={savePlanMutation.isPending}
                  data-testid="button-salvar-plano"
                >
                  {savePlanMutation.isPending ? "Salvando..." : isCreating ? "Criar Plano" : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
