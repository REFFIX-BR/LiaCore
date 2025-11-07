import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, MessageSquare, CheckCircle2, Clock, TrendingUp, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VoiceMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalCalls: number;
  totalWhatsAppMessages: number;
  successfulCalls: number;
  successfulMessages: number;
  pendingPromises: number;
  fulfilledPromises: number;
  conversionRate: number;
  channelBreakdown: {
    voice: {
      total: number;
      successful: number;
      failed: number;
      pending: number;
    };
    whatsapp: {
      total: number;
      successful: number;
      failed: number;
      pending: number;
    };
  };
}

interface Conversation {
  id: string;
  chatId: string;
  clientName: string;
  clientDocument: string | null;
  status: string;
  conversationSource: string;
  lastMessage: string | null;
  lastMessageTime: Date | null;
  createdAt: Date;
  department: string;
  assistantType: string;
  transferredToHuman: boolean;
  assignedTo: string | null;
}

type ConversationFilter = 'all' | 'inbound' | 'whatsapp_campaign' | 'voice_campaign';

export default function CobrancasMonitor() {
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>('all');

  // Fetch unified metrics
  const { data: metrics, isLoading: isLoadingMetrics } = useQuery<VoiceMetrics>({
    queryKey: ['/api/voice/metrics'],
  });

  // Fetch conversations related to cobrancas
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations/cobrancas', conversationFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (conversationFilter !== 'all') {
        params.append('source', conversationFilter);
      }
      const response = await fetch(`/api/conversations/cobrancas?${params.toString()}`);
      if (!response.ok) throw new Error('Erro ao carregar conversas');
      return response.json();
    },
  });

  const handleTransferToHuman = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo: 'Transferência manual do monitor de cobranças',
          urgente: false,
        }),
      });

      if (!response.ok) throw new Error('Erro ao transferir conversa');
      
      // Refresh conversations
      window.location.reload();
    } catch (error) {
      console.error('Erro ao transferir:', error);
      alert('Erro ao transferir conversa');
    }
  };

  if (isLoadingMetrics) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Monitor de Cobranças</h1>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
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
            Monitor de Cobranças
          </h1>
          <p className="text-muted-foreground">
            Acompanhamento unificado de campanhas de voz e WhatsApp
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ligações</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalCalls || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.successfulCalls || 0} com sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens WhatsApp</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalWhatsAppMessages || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.successfulMessages || 0} com sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promessas Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.pendingPromises || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.fulfilledPromises || 0} cumpridas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.conversionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.activeCampaigns || 0} campanhas ativas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Channel Breakdown */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Canal: Voz
            </CardTitle>
            <CardDescription>Estatísticas de ligações telefônicas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total de ligações:</span>
                <span className="font-medium">{metrics?.channelBreakdown.voice.total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Bem-sucedidas:</span>
                <span className="font-medium text-green-600">{metrics?.channelBreakdown.voice.successful || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Falhadas:</span>
                <span className="font-medium text-red-600">{metrics?.channelBreakdown.voice.failed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pendentes:</span>
                <span className="font-medium text-yellow-600">{metrics?.channelBreakdown.voice.pending || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Canal: WhatsApp
            </CardTitle>
            <CardDescription>Estatísticas de mensagens automáticas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total de mensagens:</span>
                <span className="font-medium">{metrics?.channelBreakdown.whatsapp.total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Bem-sucedidas:</span>
                <span className="font-medium text-green-600">{metrics?.channelBreakdown.whatsapp.successful || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Falhadas:</span>
                <span className="font-medium text-red-600">{metrics?.channelBreakdown.whatsapp.failed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pendentes:</span>
                <span className="font-medium text-yellow-600">{metrics?.channelBreakdown.whatsapp.pending || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Conversas de Cobrança
              </CardTitle>
              <CardDescription>
                Acompanhe todas as interações de cobrança em um só lugar
              </CardDescription>
            </div>
            <Select
              value={conversationFilter}
              onValueChange={(value) => setConversationFilter(value as ConversationFilter)}
            >
              <SelectTrigger className="w-[200px]" data-testid="select-conversation-filter">
                <SelectValue placeholder="Filtrar por origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📱 Todas</SelectItem>
                <SelectItem value="inbound">📥 Entrada</SelectItem>
                <SelectItem value="whatsapp_campaign">💬 Campanha WhatsApp</SelectItem>
                <SelectItem value="voice_campaign">📞 Campanha Voz</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingConversations ? (
            <div className="text-center py-8 text-muted-foreground">Carregando conversas...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma conversa encontrada com o filtro selecionado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Mensagem</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conv) => (
                  <TableRow key={conv.id} data-testid={`row-conversation-${conv.id}`}>
                    <TableCell>
                      <div className="font-medium">{conv.clientName}</div>
                      {conv.clientDocument && (
                        <div className="text-xs text-muted-foreground">{conv.clientDocument}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {conv.conversationSource === 'voice_campaign' && (
                        <Badge variant="outline" className="gap-1">
                          <Phone className="h-3 w-3" />
                          Voz
                        </Badge>
                      )}
                      {conv.conversationSource === 'whatsapp_campaign' && (
                        <Badge variant="outline" className="gap-1">
                          <MessageSquare className="h-3 w-3" />
                          WhatsApp
                        </Badge>
                      )}
                      {conv.conversationSource === 'inbound' && (
                        <Badge variant="outline" className="gap-1">
                          📥 Entrada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {conv.status === 'active' && !conv.transferredToHuman && (
                        <Badge variant="default">IA Atendendo</Badge>
                      )}
                      {conv.status === 'active' && conv.transferredToHuman && !conv.assignedTo && (
                        <Badge variant="secondary">Aguardando Atendente</Badge>
                      )}
                      {conv.status === 'active' && conv.transferredToHuman && conv.assignedTo && (
                        <Badge variant="default">Em Atendimento</Badge>
                      )}
                      {conv.status === 'resolved' && (
                        <Badge variant="outline">Resolvida</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {conv.lastMessageTime && (
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.lastMessageTime), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/supervisor?conversationId=${conv.id}`, '_blank')}
                          data-testid={`button-view-${conv.id}`}
                        >
                          Ver Conversa
                        </Button>
                        {!conv.transferredToHuman && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleTransferToHuman(conv.id)}
                            data-testid={`button-transfer-${conv.id}`}
                          >
                            Transferir
                          </Button>
                        )}
                      </div>
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
