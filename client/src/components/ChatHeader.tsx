import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ChatHeaderProps {
  clientName: string;
  clientDocument: string | null;
  assistantType: string;
  status: string;
  chatId: string;
}

const assistantColors = {
  suporte: "bg-chart-2/10 text-chart-2",
  comercial: "bg-chart-1/10 text-chart-1",
  tecnico: "bg-chart-4/10 text-chart-4",
  financeiro: "bg-chart-3/10 text-chart-3",
  recepcao: "bg-primary/10 text-primary",
};

const assistantLabels = {
  suporte: "Suporte Técnico",
  comercial: "Comercial",
  tecnico: "Técnico",
  financeiro: "Financeiro",
  recepcao: "Recepção",
};

const statusColors = {
  active: "bg-chart-2/10 text-chart-2",
  queued: "bg-chart-3/10 text-chart-3",
  resolved: "bg-muted text-muted-foreground",
};

const statusLabels = {
  active: "Ativo",
  queued: "Aguardando",
  resolved: "Resolvido",
};

export function ChatHeader({ clientName, clientDocument, assistantType, status, chatId }: ChatHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!clientDocument) return;
    
    try {
      await navigator.clipboard.writeText(clientDocument);
      setCopied(true);
      toast({
        title: "CPF copiado!",
        description: "CPF copiado para a área de transferência",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o CPF",
        variant: "destructive",
      });
    }
  };

  const handleCopyId = async () => {
    const chatIdFormatted = formatChatId(chatId);
    if (!chatIdFormatted) return;
    
    try {
      await navigator.clipboard.writeText(chatIdFormatted);
      setCopiedPhone(true);
      toast({
        title: "ID copiado!",
        description: "ID do WhatsApp copiado para a área de transferência",
      });
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o ID",
        variant: "destructive",
      });
    }
  };

  const formatDocument = (doc: string) => {
    // Formatar CPF: 000.000.000-00 ou CNPJ: 00.000.000/0000-00
    if (doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (doc.length === 14) {
      return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return doc;
  };

  const extractPhoneNumber = (chatId: string): string => {
    // Extrair número do chatId (formato: 5564991317201@s.whatsapp.net)
    const match = chatId.match(/^(\d+)@/);
    return match ? match[1] : chatId;
  };

  const formatChatId = (chatId: string): string => {
    // Remover apenas o sufixo @s.whatsapp.net, mantendo o formato whatsapp_
    return chatId.replace(/@.*$/, '');
  };

  return (
    <div className="flex items-center justify-between p-3 border-b">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate" data-testid="chat-client-name">
              {clientName}
            </h3>
            <span className="text-xs text-muted-foreground" data-testid="chat-client-id">
              ({formatChatId(chatId)})
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyId}
              className="h-5 px-1.5"
              data-testid="button-copy-id"
              title="Copiar ID"
            >
              {copiedPhone ? (
                <Check className="h-3 w-3 text-chart-2" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className={`text-xs ${assistantColors[assistantType as keyof typeof assistantColors] || "bg-muted"}`}
              data-testid="chat-assistant-badge"
            >
              {assistantLabels[assistantType as keyof typeof assistantLabels] || assistantType}
            </Badge>
            <Badge 
              variant="outline" 
              className={`text-xs ${statusColors[status as keyof typeof statusColors] || "bg-muted"}`}
              data-testid="chat-status-badge"
            >
              {statusLabels[status as keyof typeof statusLabels] || status}
            </Badge>
            {clientDocument && (
              <>
                <span className="text-xs text-muted-foreground" data-testid="chat-client-cpf">
                  {formatDocument(clientDocument)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="h-6 px-2"
                  data-testid="button-copy-cpf"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-chart-2" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
