import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RegionDialog } from "@/components/regions/RegionDialog";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface City {
  city: string;
  state: string;
  neighborhoodCount: number;
}

interface Region {
  id: string;
  state: string;
  city: string;
  neighborhood: string;
  createdAt: string;
}

export default function Regioes() {
  const { toast } = useToast();
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [regionToDelete, setRegionToDelete] = useState<Region | null>(null);

  // Buscar lista de cidades
  const { data: cities = [], isLoading: loadingCities } = useQuery<City[]>({
    queryKey: ["/api/regions/cities"],
  });

  // Buscar bairros da cidade selecionada
  const { data: neighborhoods = [], isLoading: loadingNeighborhoods, refetch: refetchNeighborhoods } = useQuery<Region[]>({
    queryKey: ["/api/regions/neighborhoods", selectedCity?.city, selectedCity?.state],
    enabled: !!selectedCity,
  });

  const handleCityClick = (city: City) => {
    setSelectedCity(city);
  };

  const handleAddNeighborhood = () => {
    if (!selectedCity) {
      toast({
        title: "Selecione uma cidade",
        description: "Selecione uma cidade antes de adicionar um bairro.",
        variant: "destructive",
      });
      return;
    }
    setEditingRegion(null);
    setDialogOpen(true);
  };

  const handleEditRegion = (region: Region) => {
    setEditingRegion(region);
    setDialogOpen(true);
  };

  const handleDeleteClick = (region: Region) => {
    setRegionToDelete(region);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!regionToDelete) return;

    try {
      const response = await fetch(`/api/regions/${regionToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erro ao deletar bairro");
      }

      toast({
        title: "Bairro removido",
        description: `O bairro "${regionToDelete.neighborhood}" foi removido com sucesso.`,
      });

      // Atualizar lista de bairros e cidades
      queryClient.invalidateQueries({ queryKey: ["/api/regions/cities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/regions/neighborhoods", selectedCity?.city, selectedCity?.state] });
      refetchNeighborhoods();
      
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o bairro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setRegionToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Regiões Atendidas</h1>
          <p className="text-muted-foreground mt-1">
            Gerenciar cidades e bairros atendidos pela operação
          </p>
        </div>
        <Button
          onClick={handleAddNeighborhood}
          disabled={!selectedCity}
          data-testid="button-add-neighborhood"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Bairro
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Cidades */}
        <Card>
          <CardHeader>
            <CardTitle>Cidades</CardTitle>
            <CardDescription>
              {cities.length} cidades atendidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCities ? (
              <div className="text-center text-muted-foreground py-8">
                Carregando cidades...
              </div>
            ) : cities.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Nenhuma cidade cadastrada
              </div>
            ) : (
              <div className="space-y-2">
                {cities.map((city) => (
                  <button
                    key={`${city.city}-${city.state}`}
                    onClick={() => handleCityClick(city)}
                    className={`
                      w-full text-left p-4 rounded-lg border transition-colors
                      hover-elevate active-elevate-2
                      ${selectedCity?.city === city.city && selectedCity?.state === city.state
                        ? "bg-accent border-accent-border"
                        : "bg-card border-border"
                      }
                    `}
                    data-testid={`button-city-${city.city}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{city.city}</div>
                          <div className="text-sm text-muted-foreground">{city.state}</div>
                        </div>
                      </div>
                      <Badge variant="secondary" data-testid={`badge-count-${city.city}`}>
                        {city.neighborhoodCount} {city.neighborhoodCount === 1 ? "bairro" : "bairros"}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Bairros */}
        <Card>
          <CardHeader>
            <CardTitle>Bairros</CardTitle>
            <CardDescription>
              {selectedCity ? `${selectedCity.city} - ${selectedCity.state}` : "Selecione uma cidade"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedCity ? (
              <div className="text-center text-muted-foreground py-8">
                Selecione uma cidade para ver seus bairros
              </div>
            ) : loadingNeighborhoods ? (
              <div className="text-center text-muted-foreground py-8">
                Carregando bairros...
              </div>
            ) : neighborhoods.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Nenhum bairro cadastrado para esta cidade
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {neighborhoods.map((region) => (
                  <div
                    key={region.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                    data-testid={`region-item-${region.neighborhood}`}
                  >
                    <span className="font-medium">{region.neighborhood}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditRegion(region)}
                        data-testid={`button-edit-${region.neighborhood}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(region)}
                        data-testid={`button-delete-${region.neighborhood}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para adicionar/editar bairro */}
      <RegionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        region={editingRegion}
        defaultCity={selectedCity?.city}
        defaultState={selectedCity?.state}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o bairro "{regionToDelete?.neighborhood}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
