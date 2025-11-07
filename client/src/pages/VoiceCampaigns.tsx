import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, Plus, Upload, TrendingUp, Users, CheckCircle2, XCircle, Calendar, FileUp, AlertCircle, MessageSquare } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const campaignSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  systemPrompt: z.string().min(10, 'Prompt deve ter pelo menos 10 caracteres'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'completed' | 'paused';
  systemPrompt?: string;
  startDate?: string;
  endDate?: string;
  totalTargets?: number;
  contactedTargets?: number;
  successfulContacts?: number;
  promisesMade?: number;
  createdAt?: string;
}

interface TargetData {
  debtorName: string;
  phoneNumber: string;
  debtAmount?: number;
  debtorDocument?: string;
  address?: string;
}

export default function VoiceCampaigns() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [togglingCampaignId, setTogglingCampaignId] = useState<string | null>(null);
  const [uploadedTargets, setUploadedTargets] = useState<TargetData[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [contactMethod, setContactMethod] = useState<'voice' | 'whatsapp'>('voice');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/voice/campaigns'],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ['/api/voice/stats'],
  });

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      systemPrompt: '',
      startDate: '',
      endDate: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const response = await fetch('/api/voice/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/stats'] });
      toast({
        title: 'Campanha criada',
        description: 'A campanha foi criada com sucesso.',
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar campanha',
        description: error.message || 'Ocorreu um erro ao criar a campanha.',
        variant: 'destructive',
      });
    },
  });

  const uploadTargetsMutation = useMutation({
    mutationFn: async ({ campaignId, targets, contactMethod }: { campaignId: string; targets: TargetData[]; contactMethod: 'voice' | 'whatsapp' }) => {
      const response = await fetch(`/api/voice/campaigns/${campaignId}/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets, contactMethod }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/targets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/stats'] });
      toast({
        title: 'Alvos importados',
        description: `${data.imported || uploadedTargets.length} alvos foram importados com sucesso.`,
      });
      setIsUploadDialogOpen(false);
      setUploadedTargets([]);
      setSelectedCampaignId('');
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao importar alvos',
        description: error.message || 'Ocorreu um erro ao importar os alvos.',
        variant: 'destructive',
      });
    },
  });

  const toggleCampaignStatusMutation = useMutation({
    mutationFn: async ({ campaignId, newStatus }: { campaignId: string; newStatus: 'active' | 'paused' | 'draft' }) => {
      setTogglingCampaignId(campaignId);
      return apiRequest(`/api/voice/campaigns/${campaignId}`, 'PATCH', { status: newStatus });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/stats'] });
      setTogglingCampaignId(null);
      
      if (variables.newStatus === 'active' && data.activationResult) {
        toast({
          title: 'Campanha Ativada',
          description: `${data.activationResult.enqueued} ligações agendadas. As chamadas começarão em instantes.`,
        });
      } else if (variables.newStatus === 'paused') {
        toast({
          title: 'Campanha Pausada',
          description: 'A campanha foi pausada com sucesso.',
        });
      } else {
        toast({
          title: 'Status Atualizado',
          description: 'O status da campanha foi atualizado.',
        });
      }
    },
    onError: (error: any) => {
      setTogglingCampaignId(null);
      toast({
        title: 'Erro ao atualizar campanha',
        description: error.message || 'Ocorreu um erro ao atualizar o status.',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(firstSheet);

        const parsedTargets: TargetData[] = jsonData.map((row: any) => {
          const phone = String(row.telefone || row.Telefone || row.phone || row.Phone || '');
          const formattedPhone = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`;
          
          const valorRaw = row.valorDivida || row['valor_divida'] || row.valor || row.Valor || row.Valor;
          const debtAmount = valorRaw 
            ? Math.round(parseFloat(String(valorRaw).replace(',', '.')) * 100)
            : undefined;
          
          return {
            debtorName: row.nome || row.Nome || row.name || row.Name || '',
            phoneNumber: formattedPhone,
            debtAmount,
            debtorDocument: row.cpf_cnpj || row.cpf || row.cnpj || row.document || undefined,
            address: row.endereco || row.address || undefined,
          };
        });

        const validTargets = parsedTargets.filter(t => t.debtorName && t.phoneNumber);

        if (validTargets.length === 0) {
          toast({
            title: 'Planilha inválida',
            description: 'Nenhum registro válido encontrado. Certifique-se de que há colunas "nome" e "telefone".',
            variant: 'destructive',
          });
          return;
        }

        setUploadedTargets(validTargets);
        toast({
          title: 'Planilha carregada',
          description: `${validTargets.length} alvos encontrados.`,
        });
      } catch (error) {
        toast({
          title: 'Erro ao ler planilha',
          description: 'Ocorreu um erro ao processar a planilha.',
          variant: 'destructive',
        });
      }
    };

    reader.readAsBinaryString(file);
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      handleFileSelect(file);
    } else {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV.',
        variant: 'destructive',
      });
    }
  }, [handleFileSelect, toast]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleUploadTargets = () => {
    if (!selectedCampaignId || uploadedTargets.length === 0) {
      toast({
        title: 'Dados incompletos',
        description: 'Selecione uma campanha e carregue uma planilha válida.',
        variant: 'destructive',
      });
      return;
    }

    uploadTargetsMutation.mutate({
      campaignId: selectedCampaignId,
      targets: uploadedTargets,
      contactMethod,
    });
  };

  const onSubmit = (data: CampaignFormData) => {
    createMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'outline',
      active: 'default',
      completed: 'secondary',
      paused: 'outline',
    } as const;
    const labels = {
      draft: 'Rascunho',
      active: 'Ativa',
      completed: 'Concluída',
      paused: 'Pausada',
    };
    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">LIA VOICE</h1>
            <p className="text-muted-foreground">Campanhas de Cobrança por Voz</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                <div className="h-8 bg-muted rounded w-16"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Phone className="h-8 w-8" />
            LIA VOICE
          </h1>
          <p className="text-muted-foreground">Campanhas de Cobrança por Voz</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-upload-targets">
                <Upload className="h-4 w-4 mr-2" />
                Importar Alvos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Importar Alvos de Planilha</DialogTitle>
                <DialogDescription>
                  Faça upload de uma planilha Excel (.xlsx) ou CSV com os alvos da campanha
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Selecionar Campanha</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    data-testid="select-campaign-upload"
                  >
                    <option value="">Selecione uma campanha...</option>
                    {campaigns?.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name} ({campaign.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Método de Contato</label>
                  <RadioGroup value={contactMethod} onValueChange={(value) => setContactMethod(value as 'voice' | 'whatsapp')}>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="voice" id="contact-voice" data-testid="radio-contact-voice" />
                        <Label htmlFor="contact-voice" className="flex items-center gap-2 cursor-pointer">
                          <Phone className="h-4 w-4" />
                          Ligação (Voice)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="whatsapp" id="contact-whatsapp" data-testid="radio-contact-whatsapp" />
                        <Label htmlFor="contact-whatsapp" className="flex items-center gap-2 cursor-pointer">
                          <MessageSquare className="h-4 w-4" />
                          WhatsApp (IA Financeiro)
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    {contactMethod === 'voice' 
                      ? 'Ligações automatizadas usando Twilio + OpenAI Realtime API'
                      : 'Mensagens via WhatsApp usando IA Financeiro da LIA CORTEX'
                    }
                  </p>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Formato da Planilha</AlertTitle>
                  <AlertDescription>
                    A planilha deve conter as colunas: <strong>nome</strong>, <strong>telefone</strong> e opcionalmente <strong>valorDivida</strong>
                  </AlertDescription>
                </Alert>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-upload"
                >
                  <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-1">
                    Arraste e solte sua planilha aqui
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ou clique para selecionar (Excel .xlsx ou CSV)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                </div>

                {uploadedTargets.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">
                        Preview ({uploadedTargets.length} alvos)
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadedTargets([])}
                        data-testid="button-clear-upload"
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="border rounded-md max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Valor da Dívida</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uploadedTargets.slice(0, 10).map((target, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{target.debtorName}</TableCell>
                              <TableCell>{target.phoneNumber}</TableCell>
                              <TableCell>
                                {target.debtAmount
                                  ? `R$ ${(target.debtAmount / 100).toFixed(2)}`
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                          {uploadedTargets.length > 10 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">
                                ... e mais {uploadedTargets.length - 10} alvos
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsUploadDialogOpen(false)}
                    data-testid="button-cancel-upload"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleUploadTargets}
                    disabled={
                      !selectedCampaignId ||
                      uploadedTargets.length === 0 ||
                      uploadTargetsMutation.isPending
                    }
                    data-testid="button-confirm-upload"
                  >
                    {uploadTargetsMutation.isPending ? 'Importando...' : 'Importar Alvos'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-campaign">
                <Plus className="h-4 w-4 mr-2" />
                Nova Campanha
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha</DialogTitle>
              <DialogDescription>
                Configure uma nova campanha de cobrança por voz
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Campanha</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Cobrança Inadimplentes Novembro 2025"
                          data-testid="input-campaign-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="systemPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt do Sistema (Instruções para a IA)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Você é Lia, assistente de cobrança da TR Telecom..."
                          className="min-h-[200px]"
                          data-testid="input-system-prompt"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Início</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-start-date" />
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
                        <FormLabel>Data de Término</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-end-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending ? 'Criando...' : 'Criar Campanha'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Campanhas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-campaigns">
              {stats?.totalCampaigns || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeCampaigns || 0} ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ligações</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-calls">
              {stats?.totalCalls || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.successRate || 0}% de sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promessas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-promises-made">
              {stats?.promisesMade || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.promisesFulfilled || 0} cumpridas ({stats?.promiseFulfillmentRate || 0}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {stats?.successRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.successfulCalls || 0} de {stats?.totalCalls || 0} ligações
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {campaigns && campaigns.length > 0 ? (
          campaigns.map((campaign) => (
            <Card key={campaign.id} data-testid={`card-campaign-${campaign.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{campaign.name}</CardTitle>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <CardDescription>
                      Criada {campaign.createdAt && formatDistanceToNow(new Date(campaign.createdAt), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {campaign.status !== 'active' && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        data-testid={`button-activate-${campaign.id}`}
                        onClick={() => toggleCampaignStatusMutation.mutate({ 
                          campaignId: campaign.id, 
                          newStatus: 'active' 
                        })}
                        disabled={togglingCampaignId === campaign.id}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        {togglingCampaignId === campaign.id ? 'Ativando...' : 'Ativar'}
                      </Button>
                    )}
                    {campaign.status === 'active' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        data-testid={`button-pause-${campaign.id}`}
                        onClick={() => toggleCampaignStatusMutation.mutate({ 
                          campaignId: campaign.id, 
                          newStatus: 'paused' 
                        })}
                        disabled={togglingCampaignId === campaign.id}
                      >
                        {togglingCampaignId === campaign.id ? 'Pausando...' : 'Pausar'}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      data-testid={`button-upload-${campaign.id}`}
                      onClick={() => {
                        setSelectedCampaignId(campaign.id);
                        setIsUploadDialogOpen(true);
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Alvos
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Alvos Totais</p>
                    <p className="text-2xl font-bold">{campaign.totalTargets || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contatados</p>
                    <p className="text-2xl font-bold">{campaign.contactedTargets || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sucesso</p>
                    <p className="text-2xl font-bold">{campaign.successfulContacts || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Promessas</p>
                    <p className="text-2xl font-bold">{campaign.promisesMade || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Nenhuma campanha criada</CardTitle>
              <CardDescription>
                Crie sua primeira campanha de cobrança por voz clicando no botão "Nova Campanha"
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
