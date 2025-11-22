import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Check, CheckCheck, FileText, Download, Trash2, MoreVertical, Copy, Reply, MapPin } from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useEffect } from "react";

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
  audioUrl?: string | null;
  videoUrl?: string | null;
  videoName?: string | null;
  videoMimetype?: string | null;
  locationLatitude?: string | null;
  locationLongitude?: string | null;
  deletedAt?: Date | null;
  deletedBy?: string | null;
}

interface ChatMessageProps {
  message: Message;
  canEdit?: boolean;
  onDelete?: () => void;
  onReply?: (message: Message) => void; // Callback para responder/citar mensagem
  showImageDescription?: boolean; // Se true, mostra descrição da imagem. Se false (padrão), mostra só a imagem
}

const functionIcons: Record<string, string> = {
  verificar_conexao: "🔌",
  consultar_base_de_conhecimento: "📚",
  consultar_fatura: "📄",
  agendar_visita: "📅",
};

export function ChatMessage({ message, canEdit = false, onDelete, onReply, showImageDescription = false }: ChatMessageProps) {
  const { toast } = useToast();
  
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
  const isAssistant = message.role === "assistant";

  // Função para copiar texto da mensagem
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      toast({
        title: "Copiado!",
        description: "Texto copiado para a área de transferência",
      });
    }).catch(() => {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o texto",
        variant: "destructive",
      });
    });
  };

  // Função para responder/citar mensagem
  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };

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

  // Função para fazer download da imagem
  const downloadImage = () => {
    if (!message.imageBase64) return;
    
    // Detectar formato da imagem pelo prefixo base64
    let imageType = 'image/jpeg';
    let extension = 'jpg';
    
    const base64Data = message.imageBase64.includes('base64,') 
      ? message.imageBase64.split('base64,')[1] 
      : message.imageBase64;
    
    // Detectar formato pela assinatura base64
    if (base64Data.startsWith('iVBORw')) {
      imageType = 'image/png';
      extension = 'png';
    } else if (base64Data.startsWith('R0lGOD')) {
      imageType = 'image/gif';
      extension = 'gif';
    } else if (base64Data.startsWith('UklGR')) {
      imageType = 'image/webp';
      extension = 'webp';
    }
    
    // Converter base64 para blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: imageType });
    
    // Criar URL e fazer download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `imagem_whatsapp_${format(message.timestamp, 'yyyyMMdd_HHmmss')}.${extension}`;
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

  // Detectar se mensagem contém vídeo enviado
  const hasVideoAttached = message.content.includes('[Vídeo enviado]');

  // Detectar se mensagem contém localização compartilhada
  const hasLocationShared = message.content.includes('[Localização compartilhada]') && 
                             !!message.locationLatitude && 
                             !!message.locationLongitude;

  // Separar conteúdo e análise/transcrição se houver
  let messageContent = message.content;
  let imageAnalysis = null;
  let audioTranscription = null;
  let pdfFileName = null;
  let videoCaption = null;

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

  // Se tiver imagem do WhatsApp e não deve mostrar descrição, limpar o messageContent
  if (hasWhatsAppImage && !showImageDescription) {
    // Remover toda a descrição que vem após "[Imagem enviada - "
    if (messageContent.includes('[Imagem enviada - ')) {
      messageContent = '';
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

  if (hasVideoAttached) {
    // Extrair legenda do vídeo se houver
    const parts = message.content.split('[Vídeo enviado]');
    if (parts.length > 1) {
      messageContent = '';
      videoCaption = parts[1].trim();
    } else {
      messageContent = message.content.replace('[Vídeo enviado]', '').trim();
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

          {/* Imagem do WhatsApp - exibir imagem real */}
          {hasWhatsAppImage && message.imageBase64 && (
            <div className="mb-2">
              <img 
                src={message.imageBase64.startsWith('data:') ? message.imageBase64 : `data:image/jpeg;base64,${message.imageBase64}`}
                alt="Imagem enviada pelo WhatsApp"
                className="max-w-full rounded-md border"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
                data-testid="whatsapp-image"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadImage}
                className={`mt-2 flex items-center gap-2 ${
                  isUser 
                    ? 'hover:bg-background/50' 
                    : 'hover:bg-primary-foreground/20 text-primary-foreground'
                }`}
                data-testid="button-download-image"
              >
                <Download className="h-4 w-4" />
                <span>Baixar Imagem</span>
              </Button>
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
          {hasVideoAttached && !message.videoUrl && (
            <Badge variant="outline" className="mb-2 text-xs">
              🎬 Vídeo enviado
            </Badge>
          )}

          {/* PDF com base64 salvo - mostrar visualização inline SEMPRE que tiver dados */}
          {(() => {
            if (!message.pdfBase64) return null;
            
            // Criar Blob URL para evitar bloqueio do Chrome com data: URLs
            const pdfBlobUrl = useMemo(() => {
              try {
                const base64Data = message.pdfBase64!.startsWith('data:') 
                  ? message.pdfBase64!.split(',')[1] 
                  : message.pdfBase64!;
                
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                
                const blob = new Blob([bytes], { type: 'application/pdf' });
                return URL.createObjectURL(blob);
              } catch (error) {
                console.error('Erro ao criar Blob URL:', error);
                return null;
              }
            }, [message.pdfBase64]);

            // Limpar Blob URL quando componente desmontar
            useEffect(() => {
              return () => {
                if (pdfBlobUrl) {
                  URL.revokeObjectURL(pdfBlobUrl);
                }
              };
            }, [pdfBlobUrl]);

            if (!pdfBlobUrl) return null;

            return (
              <div className="mb-2">
                <Badge variant="outline" className="mb-2 text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>{message.pdfName || 'Documento PDF'}</span>
                </Badge>
                <object
                  data={pdfBlobUrl}
                  type="application/pdf"
                  className="w-full rounded-md border"
                  style={{ height: '400px' }}
                  title={message.pdfName || 'Documento PDF'}
                  data-testid="pdf-viewer"
                >
                  <p className="p-4 text-sm text-muted-foreground">
                    Seu navegador não suporta visualização de PDF inline.
                    <br />
                    <button
                      onClick={downloadPdf}
                      className="underline hover:no-underline text-primary"
                    >
                      Clique aqui para baixar o arquivo
                    </button>
                  </p>
                </object>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadPdf}
                  className="mt-2 flex items-center gap-2"
                  data-testid="button-download-pdf"
                >
                  <Download className="h-4 w-4" />
                  <span>Baixar {message.pdfName || 'documento.pdf'}</span>
                </Button>
              </div>
            );
          })()}

          {/* Áudio do WhatsApp - player de áudio */}
          {message.audioUrl && (
            <div className="mb-2">
              <AudioPlayer audioUrl={message.audioUrl} />
            </div>
          )}

          {/* Vídeo do WhatsApp - player de vídeo */}
          {message.videoUrl && (
            <div className="mb-2">
              <video 
                controls 
                className="max-w-full rounded-md border"
                style={{ maxHeight: '400px' }}
                data-testid="video-player"
              >
                <source src={message.videoUrl} type={message.videoMimetype || 'video/mp4'} />
                Seu navegador não suporta reprodução de vídeos.
              </video>
              {videoCaption && (
                <div className={`mt-2 rounded-md p-2 ${isUser ? 'bg-background/50' : 'bg-primary-foreground/10'}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-all">{videoCaption}</p>
                </div>
              )}
            </div>
          )}

          {/* Localização compartilhada - Link do Google Maps */}
          {hasLocationShared && message.locationLatitude && message.locationLongitude && (
            <div className="mb-2">
              <a
                href={`https://www.google.com/maps?q=${message.locationLatitude},${message.locationLongitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover-elevate active-elevate-2"
                data-testid="link-location"
              >
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium">Ver localização no Google Maps</span>
              </a>
            </div>
          )}

          {/* Badge de mensagem excluída */}
          {message.deletedAt && (
            <Badge 
              variant="outline" 
              className="mb-2 text-xs bg-destructive/10 text-destructive border-destructive/30"
            >
              🗑️ Mensagem excluída
            </Badge>
          )}

          {/* Conteúdo da mensagem */}
          {messageContent && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-all overflow-wrap-anywhere">
              {messageContent}
            </p>
          )}

          {/* Análise de imagem - mostrar se showImageDescription=true OU se não tiver imagem base64 */}
          {imageAnalysis && (showImageDescription || !hasWhatsAppImage) && (
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

        {/* Timestamp, status e menu de ações */}
        <div className={`flex items-center gap-1 mt-1 px-2 ${isUser ? 'justify-start' : 'justify-end'}`}>
          {/* Menu de três pontos */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                data-testid="button-message-menu"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isUser ? "start" : "end"}>
              <DropdownMenuItem onClick={handleCopy} data-testid="menu-item-copy">
                <Copy className="h-4 w-4 mr-2" />
                Copiar mensagem
              </DropdownMenuItem>
              {onReply && (
                <DropdownMenuItem onClick={handleReply} data-testid="menu-item-reply">
                  <Reply className="h-4 w-4 mr-2" />
                  Responder
                </DropdownMenuItem>
              )}
              {isAssistant && canEdit && onDelete && (
                <DropdownMenuItem 
                  onClick={onDelete} 
                  className="text-destructive focus:text-destructive"
                  data-testid="menu-item-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir mensagem
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
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
