import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, TrendingUp, Award, Target, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface GamificationSettings {
  id: number;
  npsWeight: number;
  volumeWeight: number;
  resolutionWeight: number;
  responseTimeWeight: number;
  solucionadorNpsMin: number;
  solucionadorResolutionMin: number;
  velocistaNpsMin: number;
  velocistaTopN: number;
  campeaoVolumeTopN: number;
  targetNps: number | null;
  targetResolution: number | null;
  targetResponseTime: number | null;
  targetVolume: number | null;
  calculationPeriod: string;
  autoCalculate: boolean;
  calculationFrequency: string;
  calculationDayOfMonth: number;
  calculationDayOfWeek: number;
  calculationTime: string;
  updatedBy: string | null;
  updatedAt: Date | null;
  createdAt: Date | null;
}

export default function GamificationSettings() {
  const { toast } = useToast();
  
  // Estados locais para edição
  const [weights, setWeights] = useState({
    nps: 40,
    volume: 30,
    resolution: 20,
    responseTime: 10,
  });

  const [badges, setBadges] = useState({
    solucionadorNpsMin: 7,
    solucionadorResolutionMin: 70,
    velocistaNpsMin: 7,
    velocistaTopN: 1,
    campeaoVolumeTopN: 1,
  });

  const [goals, setGoals] = useState({
    targetNps: 8,
    targetResolution: 85,
    targetResponseTime: 120,
    targetVolume: 500,
  });

  const [automation, setAutomation] = useState({
    calculationPeriod: "monthly",
    autoCalculate: false,
    calculationFrequency: "monthly",
    calculationDayOfMonth: 1,
    calculationDayOfWeek: 1,
    calculationTime: "00:00",
  });

  // Busca configurações atuais
  const { data: settings, isLoading } = useQuery<GamificationSettings>({
    queryKey: ["/api/gamification/settings"],
  });

  // Sincroniza estados locais quando dados chegam
  useEffect(() => {
    if (settings) {
      setWeights({
        nps: settings.npsWeight,
        volume: settings.volumeWeight,
        resolution: settings.resolutionWeight,
        responseTime: settings.responseTimeWeight,
      });
      setBadges({
        solucionadorNpsMin: settings.solucionadorNpsMin,
        solucionadorResolutionMin: settings.solucionadorResolutionMin,
        velocistaNpsMin: settings.velocistaNpsMin,
        velocistaTopN: settings.velocistaTopN,
        campeaoVolumeTopN: settings.campeaoVolumeTopN,
      });
      setGoals({
        targetNps: settings.targetNps || 8,
        targetResolution: settings.targetResolution || 85,
        targetResponseTime: settings.targetResponseTime || 120,
        targetVolume: settings.targetVolume || 500,
      });
      setAutomation({
        calculationPeriod: settings.calculationPeriod,
        autoCalculate: settings.autoCalculate,
        calculationFrequency: settings.calculationFrequency || "monthly",
        calculationDayOfMonth: settings.calculationDayOfMonth,
        calculationDayOfWeek: settings.calculationDayOfWeek,
        calculationTime: settings.calculationTime || "00:00",
      });
    }
  }, [settings]);

  // Mutação para salvar
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<GamificationSettings>) => {
      return apiRequest("/api/gamification/settings", "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/settings"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as configurações",
      });
    },
  });

  // Atualiza peso individual e redistribui automaticamente
  const updateWeight = (key: keyof typeof weights, value: number) => {
    const newWeights = { ...weights, [key]: value };
    
    // Calcula a diferença
    const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
    
    if (total === 100) {
      setWeights(newWeights);
      return;
    }

    // Redistribui proporcionalmente nos outros pesos
    const diff = 100 - total;
    const otherKeys = (Object.keys(weights) as Array<keyof typeof weights>).filter(k => k !== key);
    const otherTotal = otherKeys.reduce((sum, k) => sum + newWeights[k], 0);

    if (otherTotal > 0) {
      // Redistribui proporcionalmente
      otherKeys.forEach(k => {
        const proportion = newWeights[k] / otherTotal;
        newWeights[k] = Math.max(0, Math.round(newWeights[k] + (diff * proportion)));
      });
    } else {
      // Se todos os outros estão em 0, distribui igualmente
      const perKey = Math.floor(diff / otherKeys.length);
      const remainder = diff % otherKeys.length;
      otherKeys.forEach((k, index) => {
        newWeights[k] = perKey + (index < remainder ? 1 : 0);
      });
    }

    // Ajuste fino para garantir soma exata de 100
    const finalTotal = Object.values(newWeights).reduce((a, b) => a + b, 0);
    if (finalTotal !== 100) {
      const firstOtherKey = otherKeys[0];
      newWeights[firstOtherKey] += (100 - finalTotal);
    }

    setWeights(newWeights);
  };

  const handleSave = () => {
    // Validação: pesos devem somar 100
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    if (totalWeight !== 100) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "A soma dos pesos deve ser exatamente 100%",
      });
      return;
    }

    saveMutation.mutate({
      npsWeight: weights.nps,
      volumeWeight: weights.volume,
      resolutionWeight: weights.resolution,
      responseTimeWeight: weights.responseTime,
      solucionadorNpsMin: badges.solucionadorNpsMin,
      solucionadorResolutionMin: badges.solucionadorResolutionMin,
      velocistaNpsMin: badges.velocistaNpsMin,
      velocistaTopN: badges.velocistaTopN,
      campeaoVolumeTopN: badges.campeaoVolumeTopN,
      targetNps: goals.targetNps,
      targetResolution: goals.targetResolution,
      targetResponseTime: goals.targetResponseTime,
      targetVolume: goals.targetVolume,
      calculationPeriod: automation.calculationPeriod,
      autoCalculate: automation.autoCalculate,
      calculationFrequency: automation.calculationFrequency,
      calculationDayOfMonth: automation.calculationDayOfMonth,
      calculationDayOfWeek: automation.calculationDayOfWeek,
      calculationTime: automation.calculationTime,
    });
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-gamification-settings">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Configurações de Gamificação</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Personalize a fórmula de pontuação, critérios dos badges e automação do sistema
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending || totalWeight !== 100}
          data-testid="button-save-settings"
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>

      {/* Alerta de validação */}
      {totalWeight !== 100 && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
          <p className="text-sm text-destructive font-medium">
            ⚠️ A soma dos pesos está em {totalWeight}%. Ajuste para exatamente 100% antes de salvar.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card: Pesos da Fórmula */}
        <Card data-testid="card-formula-weights">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Pesos da Fórmula de Pontuação
            </CardTitle>
            <CardDescription>
              Ajuste a importância de cada métrica (soma deve ser 100%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* NPS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="nps-weight">NPS (Satisfação do Cliente)</Label>
                <span className="text-sm font-medium text-primary">{weights.nps}%</span>
              </div>
              <Slider
                id="nps-weight"
                data-testid="slider-nps-weight"
                value={[weights.nps]}
                onValueChange={([value]) => updateWeight('nps', value)}
                max={100}
                step={1}
              />
            </div>

            {/* Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="volume-weight">Volume de Atendimentos</Label>
                <span className="text-sm font-medium text-primary">{weights.volume}%</span>
              </div>
              <Slider
                id="volume-weight"
                data-testid="slider-volume-weight"
                value={[weights.volume]}
                onValueChange={([value]) => updateWeight('volume', value)}
                max={100}
                step={1}
              />
            </div>

            {/* Resolução */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="resolution-weight">Taxa de Resolução</Label>
                <span className="text-sm font-medium text-primary">{weights.resolution}%</span>
              </div>
              <Slider
                id="resolution-weight"
                data-testid="slider-resolution-weight"
                value={[weights.resolution]}
                onValueChange={([value]) => updateWeight('resolution', value)}
                max={100}
                step={1}
              />
            </div>

            {/* Tempo de Resposta */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="time-weight">Tempo de Resposta</Label>
                <span className="text-sm font-medium text-primary">{weights.responseTime}%</span>
              </div>
              <Slider
                id="time-weight"
                data-testid="slider-time-weight"
                value={[weights.responseTime]}
                onValueChange={([value]) => updateWeight('responseTime', value)}
                max={100}
                step={1}
              />
            </div>

            <div className="pt-2 border-t">
              <p className="text-sm font-medium">
                Total: <span className={totalWeight === 100 ? "text-green-600" : "text-destructive"}>{totalWeight}%</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card: Critérios dos Badges */}
        <Card data-testid="card-badge-criteria">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Critérios dos Badges
            </CardTitle>
            <CardDescription>
              Defina as regras para conquistar cada badge
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">🎯 Solucionador</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sol-nps" className="text-xs">NPS Mínimo</Label>
                  <Input
                    id="sol-nps"
                    data-testid="input-solucionador-nps"
                    type="number"
                    min={0}
                    max={10}
                    value={badges.solucionadorNpsMin}
                    onChange={(e) => setBadges(prev => ({ ...prev, solucionadorNpsMin: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sol-res" className="text-xs">Resolução Mín. (%)</Label>
                  <Input
                    id="sol-res"
                    data-testid="input-solucionador-resolution"
                    type="number"
                    min={0}
                    max={100}
                    value={badges.solucionadorResolutionMin}
                    onChange={(e) => setBadges(prev => ({ ...prev, solucionadorResolutionMin: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">⚡ Velocista</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="vel-nps" className="text-xs">NPS Mínimo</Label>
                  <Input
                    id="vel-nps"
                    data-testid="input-velocista-nps"
                    type="number"
                    min={0}
                    max={10}
                    value={badges.velocistaNpsMin}
                    onChange={(e) => setBadges(prev => ({ ...prev, velocistaNpsMin: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vel-top" className="text-xs">Top N Vencedores</Label>
                  <Input
                    id="vel-top"
                    data-testid="input-velocista-topn"
                    type="number"
                    min={1}
                    max={10}
                    value={badges.velocistaTopN}
                    onChange={(e) => setBadges(prev => ({ ...prev, velocistaTopN: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">👑 Campeão do Volume</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cam-top" className="text-xs">Top N Vencedores</Label>
                  <Input
                    id="cam-top"
                    data-testid="input-campeao-topn"
                    type="number"
                    min={1}
                    max={10}
                    value={badges.campeaoVolumeTopN}
                    onChange={(e) => setBadges(prev => ({ ...prev, campeaoVolumeTopN: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">Badges Automáticos</h4>
              <div className="grid gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="text-pink-500">💖</span>
                  <span><strong>Encantador:</strong> 3+ NPS 10 consecutivos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">🛡️</span>
                  <span><strong>Zero Reclamação:</strong> 5+ feedbacks sem NPS negativo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-indigo-500">🎓</span>
                  <span><strong>Especialista:</strong> Líder em departamento (10+ atendimentos)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-orange-500">🔥</span>
                  <span><strong>Maratonista:</strong> 10+ dias consecutivos trabalhando</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-500">⏱️</span>
                  <span><strong>Pontualidade:</strong> Resposta média &lt; 2 min (20+ conversas)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-teal-500">📅</span>
                  <span><strong>Regularidade:</strong> 3 meses consecutivos com NPS &gt;= 7</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card: Metas Mensais */}
        <Card data-testid="card-monthly-goals">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Metas Mensais Individuais
            </CardTitle>
            <CardDescription>
              Objetivos individuais para cada atendente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="goal-nps">NPS Médio Alvo</Label>
              <Input
                id="goal-nps"
                data-testid="input-goal-nps"
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={goals.targetNps}
                onChange={(e) => setGoals(prev => ({ ...prev, targetNps: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="goal-res">Taxa de Resolução Alvo (%)</Label>
              <Input
                id="goal-res"
                data-testid="input-goal-resolution"
                type="number"
                min={0}
                max={100}
                value={goals.targetResolution}
                onChange={(e) => setGoals(prev => ({ ...prev, targetResolution: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="goal-time">Tempo Médio Alvo (segundos)</Label>
              <Input
                id="goal-time"
                data-testid="input-goal-time"
                type="number"
                min={0}
                value={goals.targetResponseTime}
                onChange={(e) => setGoals(prev => ({ ...prev, targetResponseTime: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="goal-vol">Volume Total Alvo</Label>
              <Input
                id="goal-vol"
                data-testid="input-goal-volume"
                type="number"
                min={0}
                value={goals.targetVolume}
                onChange={(e) => setGoals(prev => ({ ...prev, targetVolume: Number(e.target.value) }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card: Período e Automação */}
        <Card data-testid="card-automation">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Período e Automação
            </CardTitle>
            <CardDescription>
              Configure o período de avaliação e cálculo automático
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="calc-period">Período de Avaliação</Label>
              <Select
                value={automation.calculationPeriod}
                onValueChange={(value) => setAutomation(prev => ({ ...prev, calculationPeriod: value }))}
              >
                <SelectTrigger id="calc-period" data-testid="select-calculation-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="custom">Customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label htmlFor="auto-calc">Cálculo Automático</Label>
                <p className="text-xs text-muted-foreground">
                  Calcular pontuações automaticamente
                </p>
              </div>
              <Switch
                id="auto-calc"
                data-testid="switch-auto-calculate"
                checked={automation.autoCalculate}
                onCheckedChange={(checked) => setAutomation(prev => ({ ...prev, autoCalculate: checked }))}
              />
            </div>

            {automation.autoCalculate && (
              <div className="space-y-4 pt-2 border-t">
                <div className="space-y-1">
                  <Label htmlFor="calc-freq">Frequência</Label>
                  <Select
                    value={automation.calculationFrequency}
                    onValueChange={(value) => setAutomation(prev => ({ ...prev, calculationFrequency: value }))}
                  >
                    <SelectTrigger id="calc-freq" data-testid="select-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {automation.calculationFrequency === "monthly" && (
                  <div className="space-y-1">
                    <Label htmlFor="day-month">Dia do Mês</Label>
                    <Input
                      id="day-month"
                      data-testid="input-day-of-month"
                      type="number"
                      min={1}
                      max={31}
                      value={automation.calculationDayOfMonth}
                      onChange={(e) => setAutomation(prev => ({ ...prev, calculationDayOfMonth: Number(e.target.value) }))}
                    />
                  </div>
                )}

                {automation.calculationFrequency === "weekly" && (
                  <div className="space-y-1">
                    <Label htmlFor="day-week">Dia da Semana</Label>
                    <Select
                      value={String(automation.calculationDayOfWeek)}
                      onValueChange={(value) => setAutomation(prev => ({ ...prev, calculationDayOfWeek: Number(value) }))}
                    >
                      <SelectTrigger id="day-week" data-testid="select-day-of-week">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Segunda-feira</SelectItem>
                        <SelectItem value="2">Terça-feira</SelectItem>
                        <SelectItem value="3">Quarta-feira</SelectItem>
                        <SelectItem value="4">Quinta-feira</SelectItem>
                        <SelectItem value="5">Sexta-feira</SelectItem>
                        <SelectItem value="6">Sábado</SelectItem>
                        <SelectItem value="7">Domingo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="calc-time">Horário (HH:MM)</Label>
                  <Input
                    id="calc-time"
                    data-testid="input-calculation-time"
                    type="time"
                    value={automation.calculationTime}
                    onChange={(e) => setAutomation(prev => ({ ...prev, calculationTime: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
