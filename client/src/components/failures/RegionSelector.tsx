import { useState, useEffect } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

interface SelectedRegion {
  city: string;
  neighborhoods: string[];
}

interface RegionSelectorProps {
  value: SelectedRegion[];
  onChange: (value: SelectedRegion[]) => void;
}

export function RegionSelector({ value, onChange }: RegionSelectorProps) {
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  // Buscar cidades
  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ["/api/regions/cities"],
  });

  // Buscar todos os bairros de todas as cidades usando useQueries (plural)
  const neighborhoodsQueries = useQueries({
    queries: cities.map((city) => ({
      queryKey: ["/api/regions/neighborhoods", city.city, city.state],
      queryFn: async () => {
        const response = await fetch(`/api/regions/neighborhoods/${encodeURIComponent(city.city)}/${city.state}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch neighborhoods");
        }
        return response.json() as Promise<Region[]>;
      },
      enabled: true,
    })),
  });

  // Expandir cidades que têm bairros selecionados ao carregar
  useEffect(() => {
    if (value.length > 0) {
      const citiesToExpand = new Set(value.map(r => r.city));
      setExpandedCities(citiesToExpand);
    }
  }, []); // Executar apenas uma vez ao montar

  const toggleCity = (cityName: string) => {
    const newExpanded = new Set(expandedCities);
    if (newExpanded.has(cityName)) {
      newExpanded.delete(cityName);
    } else {
      newExpanded.add(cityName);
    }
    setExpandedCities(newExpanded);
  };

  const isNeighborhoodSelected = (city: string, neighborhood: string) => {
    const cityRegion = value.find(r => r.city === city);
    return cityRegion?.neighborhoods.includes(neighborhood) || false;
  };

  const toggleNeighborhood = (city: string, neighborhood: string) => {
    const newValue = [...value];
    const cityIndex = newValue.findIndex(r => r.city === city);

    if (cityIndex >= 0) {
      const neighborhoods = newValue[cityIndex].neighborhoods;
      const neighborhoodIndex = neighborhoods.indexOf(neighborhood);

      if (neighborhoodIndex >= 0) {
        // Remover bairro
        neighborhoods.splice(neighborhoodIndex, 1);
        if (neighborhoods.length === 0) {
          // Remover cidade se não houver mais bairros
          newValue.splice(cityIndex, 1);
        }
      } else {
        // Adicionar bairro
        neighborhoods.push(neighborhood);
      }
    } else {
      // Adicionar cidade com o bairro
      newValue.push({
        city,
        neighborhoods: [neighborhood],
      });
    }

    onChange(newValue);
  };

  const selectAllNeighborhoods = (city: string, allNeighborhoods: string[]) => {
    const newValue = value.filter(r => r.city !== city);
    newValue.push({
      city,
      neighborhoods: [...allNeighborhoods],
    });
    onChange(newValue);
  };

  const deselectAllNeighborhoods = (city: string) => {
    const newValue = value.filter(r => r.city !== city);
    onChange(newValue);
  };

  const getCitySelectedCount = (city: string, totalNeighborhoods: number) => {
    const cityRegion = value.find(r => r.city === city);
    const selectedCount = cityRegion?.neighborhoods.length || 0;
    return { selectedCount, totalNeighborhoods };
  };

  return (
    <div className="space-y-2">
      <ScrollArea className="h-[400px] border rounded-md p-4">
        <div className="space-y-2">
          {cities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma cidade cadastrada. Acesse Regiões para cadastrar.
            </p>
          ) : (
            cities.map((city, idx) => {
              const neighborhoods = neighborhoodsQueries[idx]?.data || [];
              const cityKey = `${city.city}-${city.state}`;
              const isExpanded = expandedCities.has(city.city);
              const { selectedCount, totalNeighborhoods } = getCitySelectedCount(
                city.city,
                neighborhoods.length
              );

              return (
                <Collapsible
                  key={cityKey}
                  open={isExpanded}
                  onOpenChange={() => toggleCity(city.city)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover-elevate">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">
                          {city.city} - {city.state}
                        </span>
                        {selectedCount > 0 && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                            {selectedCount}/{totalNeighborhoods}
                          </span>
                        )}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="p-3 border-t bg-muted/30">
                        <div className="flex gap-2 mb-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllNeighborhoods(
                                city.city,
                                neighborhoods.map(n => n.neighborhood)
                              );
                            }}
                          >
                            Selecionar Todos
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              deselectAllNeighborhoods(city.city);
                            }}
                          >
                            Limpar
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {neighborhoods.map((region) => (
                            <div key={region.id} className="flex items-center gap-2">
                              <Checkbox
                                id={region.id}
                                checked={isNeighborhoodSelected(city.city, region.neighborhood)}
                                onCheckedChange={() =>
                                  toggleNeighborhood(city.city, region.neighborhood)
                                }
                              />
                              <Label
                                htmlFor={region.id}
                                className="text-sm cursor-pointer"
                              >
                                {region.neighborhood}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>
      </ScrollArea>

      {value.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {value.length} {value.length === 1 ? "cidade selecionada" : "cidades selecionadas"} •{" "}
          {value.reduce((sum, r) => sum + r.neighborhoods.length, 0)} bairros afetados
        </div>
      )}
    </div>
  );
}
