import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Check, CheckCheck, FileText, Download } from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  functionCall?: {
    name: string;
    status: "pending" | "completed" | "failed";
  };
  assistant?: string;
  imageBase64?: string | null;
  pdfBase64?: string | null;
  pdfName?: string | null;
}

interface ChatMessageProps {
  message: Message;
}

const functionIcons: Record<string, string> = {
  verificar_conexao: "🔌",
  consultar_base_de_conhecimento: "📚",
  consultar_fatura: "📄",
  agendar_visita: "📅",
};

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center py-2">
        <Badge variant="outline" className="text-xs text-muted-foreground">
          {message.content}
        </Badge>
      </div>
    );
  }

  const isUser = message.role === "user";

  // Função para fazer download do PDF
  const downloadPdf = () => {
    if (!message.pdfBase64) return;
    
    // Remover prefixo data:application/pdf;base64, se houver
    const base64Data = message.pdfBase64.includes('base64,') 
      ? message.pdfBase64.split('base64,')[1] 
      : message.pdfBase64;
    
    // Converter base64 para blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    
    // Criar URL e fazer download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = message.pdfName || 'documento.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Detectar se mensagem tem imagem do WhatsApp (imageBase64)
  const hasWhatsAppImage = !!message.imageBase64;

  // Detectar se mensagem contém análise de imagem
  const hasImageAnalysis = message.content.includes('[Imagem enviada]') || 
                          message.content.includes('[Imagem analisada]') ||
                          message.content.includes('[Análise da Imagem]') || 
                          message.content.includes('📎 Análise automática');

  // Detectar se mensagem contém transcrição de áudio
  const hasAudioTranscription = message.content.includes('[Áudio enviado]') || 
                               message.content.includes('🎤 Transcrição automática');

  // Detectar se mensagem contém PDF enviado
  const hasPdfAttached = message.content.includes('[PDF enviado:');

  // Separar conteúdo e análise/transcrição se houver
  let messageContent = message.content;
  let imageAnalysis = null;
  let audioTranscription = null;
  let pdfFileName = null;

  if (hasImageAnalysis) {
    // Para imagens do WhatsApp, extrair análise se houver
    if (message.content.includes('[Imagem analisada]')) {
      const parts = message.content.split(/Análise da imagem:/);
      if (parts.length > 1) {
        messageContent = parts[0].replace('[Imagem analisada]', '').replace('Legenda:', '').trim();
        imageAnalysis = parts[1].trim();
      } else {
        messageContent = message.content.replace('[Imagem analisada]', '').trim();
      }
    } else {
      // Para imagens enviadas pelo supervisor/agente
      const parts = message.content.split(/📎 Análise automática[^:]*:/);
      if (parts.length > 1) {
        messageContent = parts[0].replace('[Imagem enviada]', '').trim();
        imageAnalysis = parts[1].trim();
      }
    }
  }

  if (hasAudioTranscription) {
    const parts = message.content.split(/🎤 Transcrição automática:/);
    if (parts.length > 1) {
      messageContent = parts[0].replace('[Áudio enviado]', '').trim();
      audioTranscription = parts[1].trim();
    }
  }

  if (hasPdfAttached) {
    // Extrair nome do PDF: [PDF enviado: nome_do_arquivo.pdf]
    const pdfMatch = message.content.match(/\[PDF enviado: ([^\]]+)\]/);
    if (pdfMatch) {
      pdfFileName = pdfMatch[1];
      // Remover a tag do PDF do conteúdo da mensagem
      messageContent = message.content.replace(/\[PDF enviado: [^\]]+\]/, '').trim();
    }
  }

  return (
    <div 
      className={`flex w-full mb-4 px-4 ${isUser ? 'justify-start' : 'justify-end'}`}
      data-testid={`message-${message.role}`}
    >
      <div className={`flex flex-col max-w-[70%] min-w-0 ${isUser ? 'items-start' : 'items-end'}`}>
        {/* Bubble da mensagem */}
        <div 
          className={`rounded-xl px-4 py-3 overflow-hidden ${
            isUser 
              ? 'bg-muted dark:bg-muted/80 text-foreground rounded-tl-sm' 
              : 'bg-primary dark:bg-primary/90 text-primary-foreground rounded-tr-sm'
          }`}
        >

          {/* Imagem do WhatsApp */}
          {hasWhatsAppImage && (
            <div className="mb-2">
              <img 
                src={`data:image/jpeg;base64,${message.imageBase64}`}
                alt="Imagem enviada pelo cliente"
                className="max-w-full rounded-md"
                data-testid="whatsapp-image"
              />
            </div>
          )}

          {/* Badge de imagem/áudio/PDF */}
          {hasImageAnalysis && !hasWhatsAppImage && (
            <Badge variant="outline" className="mb-2 text-xs">
              📸 Imagem enviada
            </Badge>
          )}
          {hasAudioTranscription && (
            <Badge variant="outline" className="mb-2 text-xs">
              🎤 Áudio enviado
            </Badge>
          )}
          {hasPdfAttached && pdfFileName && (
            <Badge variant="outline" className="mb-2 text-xs flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>{pdfFileName}</span>
            </Badge>
          )}

          {/* PDF com base64 salvo - mostrar botão de download */}
          {message.pdfBase64 && message.pdfName && (
            <Button
              variant="outline"
              size="sm"
              onClick={downloadPdf}
              className="mb-2 flex items-center gap-2"
              data-testid="button-download-pdf"
            >
              <FileText className="h-4 w-4" />
              <span>{message.pdfName}</span>
              <Download className="h-4 w-4" />
            </Button>
          )}

          {/* Conteúdo da mensagem */}
          {messageContent && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-all overflow-wrap-anywhere">
              {messageContent}
            </p>
          )}

          {/* Análise de imagem */}
          {imageAnalysis && (
            <div className={`mt-2 rounded-md p-2 ${isUser ? 'bg-background/50' : 'bg-primary-foreground/10'}`}>
              <p className="text-xs font-medium mb-1 opacity-80">
                📎 Análise automática da imagem
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-all">{imageAnalysis}</p>
            </div>
          )}

          {/* Transcrição de áudio */}
          {audioTranscription && (
            <div className={`mt-2 rounded-md p-2 ${isUser ? 'bg-background/50' : 'bg-primary-foreground/10'}`}>
              <p className="text-xs font-medium mb-1 opacity-80">
                🎤 Transcrição automática
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-all">{audioTranscription}</p>
            </div>
          )}

          {/* Function Call Badge */}
          {message.functionCall && (
            <Badge 
              variant="outline" 
              className={`mt-2 text-xs ${
                message.functionCall.status === "completed" 
                  ? "bg-chart-2/10 text-chart-2" 
                  : message.functionCall.status === "failed"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-chart-3/10 text-chart-3"
              }`}
            >
              {functionIcons[message.functionCall.name] || "⚙️"} {message.functionCall.name}
            </Badge>
          )}
        </div>

        {/* Timestamp e status */}
        <div className={`flex items-center gap-1 mt-1 px-2 ${isUser ? 'justify-start' : 'justify-end'}`}>
          <span className="text-xs text-muted-foreground">
            {format(message.timestamp, 'MMM dd, hh:mm a')}
          </span>
          {!isUser && (
            <CheckCheck className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}
