import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";

interface NPSFeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  assistantType: string;
  clientName: string;
  onSubmit: (score: number, comment: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function NPSFeedbackDialog({
  open,
  onClose,
  conversationId,
  assistantType,
  clientName,
  onSubmit,
  isSubmitting = false,
}: NPSFeedbackDialogProps) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (selectedScore !== null) {
      try {
        setError(null);
        await onSubmit(selectedScore, comment);
        // Reset state after successful submit
        setSelectedScore(null);
        setComment("");
        onClose();
      } catch (err) {
        setError("Erro ao enviar feedback. Tente novamente.");
        console.error("Submit NPS error:", err);
      }
    }
  };

  const handleSkip = async () => {
    try {
      setError(null);
      // Mark as resolved without feedback (onSubmit with null score could handle skip differently)
      // For now, we'll just close and let parent handle resolve
      setSelectedScore(null);
      setComment("");
      onClose();
    } catch (err) {
      setError("Erro ao pular feedback. Tente novamente.");
      console.error("Skip NPS error:", err);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0 && score <= 6) return "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700";
    if (score >= 7 && score <= 8) return "bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700";
    return "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700";
  };

  const getScoreLabel = (score: number | null) => {
    if (score === null) return "";
    if (score >= 0 && score <= 6) return "Detrator - Cliente insatisfeito";
    if (score >= 7 && score <= 8) return "Neutro - Experiência regular";
    return "Promotor - Cliente satisfeito";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-nps-feedback">
        <DialogHeader>
          <DialogTitle>Pesquisa de Satisfação</DialogTitle>
          <DialogDescription>
            Avalie o atendimento de {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Em uma escala de 0 a 10, qual a probabilidade de você recomendar nosso atendimento?
            </label>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <Button
                  key={i}
                  variant={selectedScore === i ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedScore(i)}
                  className={`h-12 ${selectedScore === i ? getScoreColor(i) : ""}`}
                  data-testid={`button-nps-${i}`}
                >
                  {i}
                </Button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Muito improvável</span>
              <span>Muito provável</span>
            </div>
          </div>

          {selectedScore !== null && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Star className="h-4 w-4" />
              <span className="text-sm font-medium">{getScoreLabel(selectedScore)}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Comentário (opcional)
            </label>
            <Textarea
              placeholder="Conte-nos mais sobre sua experiência..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[100px]"
              data-testid="textarea-nps-comment"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isSubmitting}
              data-testid="button-nps-skip"
            >
              Pular
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedScore === null || isSubmitting}
              data-testid="button-nps-submit"
            >
              {isSubmitting ? "Enviando..." : "Enviar Feedback"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
