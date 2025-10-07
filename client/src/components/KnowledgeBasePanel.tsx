import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, FileText } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface KnowledgeChunk {
  id: string;
  content: string;
  source: string;
  relevance: number;
}

interface KnowledgeBasePanelProps {
  chunks: KnowledgeChunk[];
}

export function KnowledgeBasePanel({ chunks }: KnowledgeBasePanelProps) {
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
          <Accordion type="single" collapsible className="space-y-2">
            {chunks.map((chunk, index) => (
              <AccordionItem 
                key={chunk.id} 
                value={chunk.id}
                className="border rounded-lg px-3 bg-muted/30"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center justify-between w-full pr-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Contexto {index + 1}
                      </span>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary">
                      {chunk.relevance}% relevante
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-3">
                  <p className="text-sm text-muted-foreground mb-2">
                    {chunk.content}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    Fonte: {chunk.source}
                  </Badge>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
