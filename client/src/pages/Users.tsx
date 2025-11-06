import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil, Power, Trash2, Search, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

const userFormSchema = z.object({
  username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "SUPERVISOR", "AGENT"]),
});

const updateUserFormSchema = z.object({
  fullName: z.string().min(1, "Nome completo é obrigatório").optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "SUPERVISOR", "AGENT"]).optional(),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional().or(z.literal("")),
});

type UserFormData = z.infer<typeof userFormSchema>;
type UpdateUserFormData = z.infer<typeof updateUserFormSchema>;

interface User {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: "ADMIN" | "SUPERVISOR" | "AGENT";
  status: "ACTIVE" | "INACTIVE";
  departments?: string[] | null;
  participatesInGamification?: boolean | null;
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [departmentsUser, setDepartmentsUser] = useState<User | null>(null);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Fetch all users
  const { data: usersData, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ["/api/users"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      return apiRequest("/api/users", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao criar usuário",
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserFormData }) => {
      return apiRequest(`/api/users/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao atualizar usuário",
        variant: "destructive",
      });
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest(`/api/users/${id}/status`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao atualizar status",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/users/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Sucesso",
        description: "Usuário deletado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao deletar usuário",
        variant: "destructive",
      });
    },
  });

  // Update departments mutation
  const updateDepartmentsMutation = useMutation({
    mutationFn: async ({ id, departments }: { id: string; departments: string[] }) => {
      return apiRequest(`/api/users/${id}/departments`, "PATCH", { departments });
    },
    onSuccess: () => {
      // Force refetch to ensure we get updated data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      setDepartmentsUser(null);
      toast({
        title: "Sucesso",
        description: "Departamentos atualizados com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao atualizar departamentos",
        variant: "destructive",
      });
    },
  });

  // Toggle gamification participation mutation
  const toggleGamificationMutation = useMutation({
    mutationFn: async ({ id, participates }: { id: string; participates: boolean }) => {
      return apiRequest(`/api/users/${id}`, "PATCH", { participatesInGamification: participates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Sucesso",
        description: "Participação na gamificação atualizada",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao atualizar participação",
        variant: "destructive",
      });
    },
  });

  const createForm = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      email: "",
      role: "AGENT",
    },
  });

  const updateForm = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserFormSchema),
  });

  // Filter users
  const filteredUsers = usersData?.users?.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  }) || [];

  const handleCreateUser = (data: UserFormData) => {
    createUserMutation.mutate(data);
  };

  const handleUpdateUser = (data: UpdateUserFormData) => {
    if (!editingUser) return;
    
    // Remove empty values
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== "" && v !== undefined)
    ) as UpdateUserFormData;

    updateUserMutation.mutate({ id: editingUser.id, data: cleanedData });
  };

  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    toggleStatusMutation.mutate({ id: user.id, status: newStatus });
  };

  const handleDeleteUser = (user: User) => {
    if (confirm(`Tem certeza que deseja deletar o usuário ${user.fullName}?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleOpenDepartmentsDialog = (user: User) => {
    setDepartmentsUser(user);
    setSelectedDepartments(user.departments || []);
  };

  const handleSaveDepartments = () => {
    if (!departmentsUser) return;
    updateDepartmentsMutation.mutate({
      id: departmentsUser.id,
      departments: selectedDepartments,
    });
  };

  const toggleDepartment = (department: string) => {
    setSelectedDepartments(prev => 
      prev.includes(department)
        ? prev.filter(d => d !== department)
        : [...prev, department]
    );
  };

  const DEPARTMENTS = [
    { value: "commercial", label: "Comercial" },
    { value: "support", label: "Suporte Técnico" },
    { value: "financial", label: "Financeiro" },
    { value: "cancellation", label: "Cancelamento" },
    { value: "general", label: "Geral" },
  ];

  const getDepartmentBadges = (departments: string[] | null | undefined) => {
    if (!departments || departments.length === 0) {
      return <span className="text-muted-foreground text-sm">-</span>;
    }

    const departmentLabels: Record<string, string> = {
      commercial: "Comercial",
      support: "Suporte",
      financial: "Financeiro",
      cancellation: "Cancelamento",
      general: "Geral",
    };

    return (
      <div className="flex flex-wrap gap-1">
        {departments.map(dept => (
          <Badge key={dept} variant="outline" className="text-xs">
            {departmentLabels[dept] || dept}
          </Badge>
        ))}
      </div>
    );
  };

  const getRoleBadge = (role: string) => {
    const variants = {
      ADMIN: "destructive",
      SUPERVISOR: "default",
      AGENT: "secondary",
    } as const;

    const labels = {
      ADMIN: "Administrador",
      SUPERVISOR: "Supervisor",
      AGENT: "Atendente",
    };

    return (
      <Badge variant={variants[role as keyof typeof variants]}>
        {labels[role as keyof typeof labels]}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    return status === "ACTIVE" ? (
      <Badge className="bg-chart-2 text-chart-2-foreground">Ativo</Badge>
    ) : (
      <Badge variant="outline">Inativo</Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Carregando usuários...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usuários e Acessos</CardTitle>
              <CardDescription>
                Gerencie os usuários da plataforma e seus níveis de permissão
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-invite-user">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar Novo Usuário</DialogTitle>
                  <DialogDescription>
                    Preencha os dados abaixo para criar um novo usuário
                  </DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-fullname" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuário (Login)</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-user-username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" data-testid="input-user-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nível de Acesso</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-role">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ADMIN">Administrador</SelectItem>
                              <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                              <SelectItem value="AGENT">Atendente</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                        data-testid="button-cancel-create"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={createUserMutation.isPending}
                        data-testid="button-submit-create"
                      >
                        {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, usuário ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-filter-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Papéis</SelectItem>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                <SelectItem value="AGENT">Atendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Departamentos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gamificação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">
                        {user.fullName}
                        {user.id === currentUser?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(Você)</span>
                        )}
                      </TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{user.username}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getDepartmentBadges(user.departments)}</TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.participatesInGamification ?? true}
                            onCheckedChange={(checked) => {
                              toggleGamificationMutation.mutate({
                                id: user.id,
                                participates: checked,
                              });
                            }}
                            disabled={toggleGamificationMutation.isPending}
                            data-testid={`switch-gamification-${user.id}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {user.participatesInGamification ?? true ? "Sim" : "Não"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog
                            open={editingUser?.id === user.id}
                            onOpenChange={(open) => {
                              if (open) {
                                setEditingUser(user);
                                updateForm.reset({
                                  fullName: user.fullName,
                                  email: user.email || "",
                                  role: user.role,
                                  password: "",
                                });
                              } else {
                                setEditingUser(null);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-edit-${user.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar Usuário</DialogTitle>
                                <DialogDescription>
                                  Atualize as informações do usuário {user.fullName}
                                </DialogDescription>
                              </DialogHeader>
                              <Form {...updateForm}>
                                <form
                                  onSubmit={updateForm.handleSubmit(handleUpdateUser)}
                                  className="space-y-4"
                                >
                                  <FormField
                                    control={updateForm.control}
                                    name="fullName"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Nome Completo</FormLabel>
                                        <FormControl>
                                          <Input {...field} data-testid="input-edit-fullname" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={updateForm.control}
                                    name="email"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>E-mail</FormLabel>
                                        <FormControl>
                                          <Input {...field} type="email" data-testid="input-edit-email" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={updateForm.control}
                                    name="role"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Nível de Acesso</FormLabel>
                                        <Select
                                          onValueChange={field.onChange}
                                          defaultValue={field.value}
                                        >
                                          <FormControl>
                                            <SelectTrigger data-testid="select-edit-role">
                                              <SelectValue />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="ADMIN">Administrador</SelectItem>
                                            <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                                            <SelectItem value="AGENT">Atendente</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={updateForm.control}
                                    name="password"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Nova Senha (opcional)</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="password"
                                            placeholder="Deixe em branco para não alterar"
                                            data-testid="input-edit-password"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setEditingUser(null)}
                                      data-testid="button-cancel-edit"
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      type="submit"
                                      disabled={updateUserMutation.isPending}
                                      data-testid="button-submit-edit"
                                    >
                                      {updateUserMutation.isPending ? "Salvando..." : "Salvar"}
                                    </Button>
                                  </div>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>

                          {user.role === "AGENT" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDepartmentsDialog(user)}
                              data-testid={`button-departments-${user.id}`}
                            >
                              <Building2 className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(user)}
                            disabled={user.id === currentUser?.id}
                            data-testid={`button-toggle-status-${user.id}`}
                          >
                            <Power
                              className={`h-4 w-4 ${user.status === "ACTIVE" ? "text-chart-2" : "text-muted-foreground"}`}
                            />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(user)}
                            disabled={user.id === currentUser?.id}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Departments Dialog */}
      <Dialog 
        open={departmentsUser !== null} 
        onOpenChange={(open) => !open && setDepartmentsUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Departamentos</DialogTitle>
            <DialogDescription>
              Selecione os departamentos aos quais {departmentsUser?.fullName} terá acesso. 
              Atendentes verão apenas conversas dos departamentos selecionados.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-3">
              {DEPARTMENTS.map((dept) => (
                <div key={dept.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dept-${dept.value}`}
                    checked={selectedDepartments.includes(dept.value)}
                    onCheckedChange={() => toggleDepartment(dept.value)}
                    data-testid={`checkbox-dept-${dept.value}`}
                  />
                  <Label 
                    htmlFor={`dept-${dept.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {dept.label}
                  </Label>
                </div>
              ))}
            </div>

            {selectedDepartments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Selecione pelo menos um departamento
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDepartmentsUser(null)}
              data-testid="button-cancel-departments"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveDepartments}
              disabled={updateDepartmentsMutation.isPending || selectedDepartments.length === 0}
              data-testid="button-save-departments"
            >
              {updateDepartmentsMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
