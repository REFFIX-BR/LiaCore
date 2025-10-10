import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

  // Separar conteúdo e análise/transcrição se houver
  let messageContent = message.content;
  let imageAnalysis = null;
  let audioTranscription = null;

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

  return (
    <div className={`flex gap-3 py-3 ${isUser ? "" : "bg-primary/5"} px-4 rounded-lg`}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isUser ? "Cliente" : message.assistant || "LIA"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(message.timestamp, { addSuffix: true })}
          </span>
        </div>
        
        {hasWhatsAppImage || hasImageAnalysis || hasAudioTranscription ? (
          <div className="space-y-2">
            {hasWhatsAppImage && (
              <div className="space-y-1">
                <Badge variant="outline" className="text-xs">
                  📸 Imagem do WhatsApp
                </Badge>
                <img 
                  src={`data:image/jpeg;base64,${message.imageBase64}`}
                  alt="Imagem enviada pelo cliente"
                  className="max-w-sm rounded-md border border-border"
                  data-testid="whatsapp-image"
                />
              </div>
            )}
            {hasImageAnalysis && !hasWhatsAppImage && (
              <Badge variant="outline" className="text-xs">
                📸 Imagem enviada
              </Badge>
            )}
            {hasAudioTranscription && (
              <Badge variant="outline" className="text-xs">
                🎤 Áudio enviado
              </Badge>
            )}
            {messageContent && (
              <p className="text-sm leading-relaxed">{messageContent}</p>
            )}
            {imageAnalysis && (
              <div className="bg-accent/50 rounded-md p-3 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  📎 Análise automática da imagem
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{imageAnalysis}</p>
              </div>
            )}
            {audioTranscription && (
              <div className="bg-accent/50 rounded-md p-3 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  🎤 Transcrição automática
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{audioTranscription}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        )}
        
        {message.functionCall && (
          <Badge 
            variant="outline" 
            className={`text-xs ${
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
    </div>
  );
}
