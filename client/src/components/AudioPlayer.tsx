import { Volume2 } from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
  className?: string;
}

export function AudioPlayer({ audioUrl, className = "" }: AudioPlayerProps) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-md bg-muted/50 border ${className}`} data-testid="audio-player">
      <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <audio 
        controls 
        className="flex-1 h-8"
        data-testid="audio-element"
        preload="metadata"
      >
        <source src={audioUrl} type="audio/ogg" />
        <source src={audioUrl} type="audio/mpeg" />
        <source src={audioUrl} type="audio/wav" />
        Seu navegador não suporta o elemento de áudio.
      </audio>
    </div>
  );
}
