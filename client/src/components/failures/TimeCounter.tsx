import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface TimeCounterProps {
  startTime: string;
  className?: string;
}

export default function TimeCounter({ startTime, className = "" }: TimeCounterProps) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const calculateElapsed = () => {
      const start = new Date(startTime);
      const now = new Date();
      const diff = now.getTime() - start.getTime();

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    };

    // Calcular imediatamente
    setElapsed(calculateElapsed());

    // Atualizar a cada segundo
    const interval = setInterval(() => {
      setElapsed(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className={`flex items-center gap-1.5 ${className}`} data-testid="time-counter">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="font-mono text-sm font-medium">{elapsed}</span>
    </div>
  );
}
