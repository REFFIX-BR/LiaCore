import { KnowledgeBasePanel } from "@/components/KnowledgeBasePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Upload } from "lucide-react";
import { useState } from "react";

//todo: remove mock functionality
const mockChunks = [
  {
    id: '1',
    content: 'O plano Fibra Gamer é otimizado para baixa latência, com um ping esperado de 5-15ms para servidores locais. Ideal para jogos online competitivos.',
    source: 'Manual Técnico Planos 2024',
    relevance: 95,
  },
  {
    id: '2',
    content: 'Velocidade de download: até 500 Mbps. Upload simétrico de 500 Mbps. Conexão dedicada sem compartilhamento.',
    source: 'Especificações Fibra Gamer',
    relevance: 87,
  },
  {
    id: '3',
    content: 'Suporte prioritário 24/7 com técnicos especializados em gaming. SLA de 2 horas para resolução de problemas.',
    source: 'Políticas de Suporte Premium',
    relevance: 72,
  },
];

export default function Knowledge() {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    console.log('Searching:', searchQuery);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Base de Conhecimento</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie documentos e consulte a base RAG
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pesquisar Conhecimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Digite sua consulta para busca semântica..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-knowledge-search"
              className="flex-1"
            />
            <Button onClick={handleSearch} data-testid="button-search">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button variant="outline" data-testid="button-upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KnowledgeBasePanel chunks={mockChunks} />
      </div>
    </div>
  );
}
