import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

const STATES = [
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "MG", label: "Minas Gerais" },
  { value: "SP", label: "São Paulo" },
  { value: "ES", label: "Espírito Santo" },
];

const regionSchema = z.object({
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(1, "Estado é obrigatório"),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
});

type RegionFormData = z.infer<typeof regionSchema>;

interface RegionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  region?: {
    id: string;
    city: string;
    state: string;
    neighborhood: string;
  } | null;
  defaultCity?: string;
  defaultState?: string;
}

export function RegionDialog({ open, onOpenChange, region, defaultCity, defaultState }: RegionDialogProps) {
  const { toast } = useToast();

  const form = useForm<RegionFormData>({
    resolver: zodResolver(regionSchema),
    defaultValues: {
      city: defaultCity || "",
      state: defaultState || "",
      neighborhood: "",
    },
  });

  // Reset form quando dialog abre/fecha ou quando região muda
  useEffect(() => {
    if (open) {
      if (region) {
        // Editando
        form.reset({
          city: region.city,
          state: region.state,
          neighborhood: region.neighborhood,
        });
      } else {
        // Adicionando novo
        form.reset({
          city: defaultCity || "",
          state: defaultState || "",
          neighborhood: "",
        });
      }
    }
  }, [open, region, defaultCity, defaultState, form]);

  const createMutation = useMutation({
    mutationFn: async (data: RegionFormData) => {
      return await apiRequest("/api/regions", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Bairro adicionado",
        description: "O bairro foi adicionado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/regions/cities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/regions/neighborhoods"] });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erro ao adicionar",
        description: "Não foi possível adicionar o bairro. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: RegionFormData) => {
      if (!region) throw new Error("No region to update");
      return await apiRequest(`/api/regions/${region.id}`, "PATCH", data);
    },
    onSuccess: () => {
      toast({
        title: "Bairro atualizado",
        description: "O bairro foi atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/regions/cities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/regions/neighborhoods"] });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o bairro. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegionFormData) => {
    if (region) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">
            {region ? "Editar Bairro" : "Adicionar Bairro"}
          </DialogTitle>
          <DialogDescription>
            {region
              ? "Atualize as informações do bairro"
              : "Adicione um novo bairro à lista de regiões atendidas"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-state">
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Três Rios"
                      {...field}
                      data-testid="input-city"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="neighborhood"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bairro</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Centro"
                      {...field}
                      data-testid="input-neighborhood"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save"
              >
                {isPending ? "Salvando..." : region ? "Atualizar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
