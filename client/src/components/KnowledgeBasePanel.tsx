import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Book, FileText, Trash2, Edit } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface KnowledgeChunk {
  id: string;
  name?: string;
  content: string;
  source: string;
  relevance: number;
}

interface KnowledgeBasePanelProps {
  chunks: KnowledgeChunk[];
  onDelete?: (id: string) => void;
  onEdit?: (chunk: KnowledgeChunk) => void;
}

export function KnowledgeBasePanel({ chunks, onDelete, onEdit }: KnowledgeBasePanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Book className="h-5 w-5" />
          Base de Conhecimento RAG
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {chunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground mb-1">
                Nenhum resultado encontrado
              </p>
              <p className="text-xs text-muted-foreground">
                Faça uma busca ou adicione documentos à base
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {chunks.map((chunk) => (
                <AccordionItem 
                  key={chunk.id} 
                  value={chunk.id}
                  className="border rounded-lg px-3 bg-muted/30"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center justify-between w-full pr-3">
                      <div className="flex items-center gap-2 flex-1">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">
                          {chunk.name || "Documento sem nome"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary">
                          {chunk.relevance}% relevante
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-3 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {chunk.content}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        Fonte: {chunk.source}
                      </Badge>
                      <div className="flex gap-2">
                        {onEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(chunk)}
                            data-testid={`button-edit-${chunk.id}`}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(chunk.id)}
                            data-testid={`button-delete-${chunk.id}`}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Excluir
                          </Button>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
