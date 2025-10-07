import { KnowledgeBasePanel } from "@/components/KnowledgeBasePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, Upload, Database, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Knowledge() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [newDocName, setNewDocName] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [newDocSource, setNewDocSource] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/knowledge/search", { query, topK: 20 });
      return response.json();
    },
    onSuccess: (data: any) => {
      const formattedResults = data.map((result: any) => ({
        id: result.chunk.id,
        name: result.chunk.name || "Documento sem nome",
        content: result.chunk.content,
        source: result.chunk.source,
        relevance: Math.round(result.score * 100),
      }));
      setSearchResults(formattedResults);
      toast({
        title: "Busca Concluída",
        description: `Encontrados ${formattedResults.length} resultados`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao buscar conhecimento",
        variant: "destructive",
      });
    },
  });

  const addDocumentMutation = useMutation({
    mutationFn: async (doc: any) => {
      const response = await apiRequest("POST", "/api/knowledge/add", { chunks: [doc] });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Sucesso",
        description: "Documento adicionado à base",
      });
      
      const newDoc = {
        id: variables.id,
        name: variables.name || "Novo documento",
        content: variables.content,
        source: variables.source,
        relevance: 100,
      };
      setSearchResults(prev => [newDoc, ...prev]);
      
      setNewDocName("");
      setNewDocContent("");
      setNewDocSource("");
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao adicionar documento",
        variant: "destructive",
      });
    },
  });

  const populateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/knowledge/populate", {});
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Base Populada",
        description: `${data.count} documentos adicionados`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao popular base",
        variant: "destructive",
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/knowledge/clear", {});
      return response.json();
    },
    onSuccess: () => {
      setSearchResults([]);
      toast({
        title: "Base Limpa",
        description: "Todos os documentos foram removidos",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao limpar base",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Campo vazio",
        description: "Digite algo para buscar",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate(searchQuery);
  };

  const handleAddDocument = () => {
    if (!newDocName.trim() || !newDocContent.trim() || !newDocSource.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, conteúdo e fonte",
        variant: "destructive",
      });
      return;
    }

    addDocumentMutation.mutate({
      id: `kb-${Date.now()}`,
      name: newDocName,
      content: newDocContent,
      source: newDocSource,
      metadata: { 
        addedAt: new Date().toISOString() 
      },
    });
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              data-testid="input-knowledge-search"
              className="flex-1"
            />
            <Button 
              onClick={handleSearch}
              disabled={searchMutation.isPending}
              data-testid="button-search"
            >
              <Search className="h-4 w-4 mr-2" />
              {searchMutation.isPending ? "Buscando..." : "Buscar"}
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Documento</DialogTitle>
                  <DialogDescription>
                    Adicione um novo documento à base de conhecimento
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      placeholder="Ex: Problemas de Conexão"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      data-testid="input-doc-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conteúdo</Label>
                    <Textarea
                      placeholder="Digite o conteúdo do documento..."
                      value={newDocContent}
                      onChange={(e) => setNewDocContent(e.target.value)}
                      rows={6}
                      data-testid="textarea-doc-content"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fonte</Label>
                    <Input
                      placeholder="Ex: Manual Técnico 2024"
                      value={newDocSource}
                      onChange={(e) => setNewDocSource(e.target.value)}
                      data-testid="input-doc-source"
                    />
                  </div>
                  <Button 
                    onClick={handleAddDocument}
                    disabled={addDocumentMutation.isPending}
                    className="w-full"
                    data-testid="button-confirm-add"
                  >
                    {addDocumentMutation.isPending ? "Adicionando..." : "Adicionar Documento"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <KnowledgeBasePanel 
            chunks={searchResults} 
            onDelete={(id) => {
              apiRequest("DELETE", `/api/knowledge/${id}`, {})
                .then(() => {
                  setSearchResults(prev => prev.filter(c => c.id !== id));
                  toast({ title: "Documento excluído" });
                })
                .catch(() => {
                  toast({ 
                    title: "Erro", 
                    description: "Falha ao excluir documento",
                    variant: "destructive" 
                  });
                });
            }}
          />
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gerenciar Base</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="default"
              className="w-full"
              onClick={() => populateMutation.mutate()}
              disabled={populateMutation.isPending}
              data-testid="button-populate-knowledge"
            >
              <Database className="h-4 w-4 mr-2" />
              {populateMutation.isPending ? "Populando..." : "Popular Base"}
            </Button>
            
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              data-testid="button-clear-knowledge"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {clearMutation.isPending ? "Limpando..." : "Limpar Base"}
            </Button>

            <div className="pt-2 space-y-2 text-sm text-muted-foreground">
              <p className="font-medium">Ações:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Popular: Adiciona 10 documentos de exemplo</li>
                <li>Limpar: Remove todos os documentos</li>
                <li>Adicionar: Insere documento customizado</li>
                <li>Buscar: Consulta semântica RAG</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
