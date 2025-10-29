import { KnowledgeBasePanel } from "@/components/KnowledgeBasePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, Upload, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
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
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [newDocSource, setNewDocSource] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const { toast } = useToast();

  // Load all documents on mount
  useEffect(() => {
    loadAllDocuments();
  }, []);

  const loadAllDocuments = async () => {
    setIsLoadingAll(true);
    try {
      // Usar endpoint otimizado que faz queries paralelas
      const response = await fetch("/api/knowledge/list-all", {
        method: "GET",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Failed to load documents");
      }
      const data = await response.json();
      
      const documents = data.map((result: any) => ({
        id: result.chunk.id,
        name: result.chunk.name || "Documento sem nome",
        content: result.chunk.content,
        source: result.chunk.source,
        relevance: Math.round(result.score * 100),
      }));
      
      setAllDocuments(documents);
      setSearchResults(documents);
      
      toast({
        title: "Base de Conhecimento Carregada",
        description: `${documents.length} documentos encontrados`,
      });
    } catch (error) {
      console.error("Error loading all documents:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar base de conhecimento",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAll(false);
    }
  };

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("/api/knowledge/search", "POST", { query, topK: 50 });
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
      const response = await apiRequest("/api/knowledge/add", "POST", { chunks: [doc] });
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
      setAllDocuments(prev => [newDoc, ...prev]);
      
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

  const editDocumentMutation = useMutation({
    mutationFn: async (doc: any) => {
      const response = await apiRequest("/api/knowledge/add", "POST", { chunks: [doc] });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Sucesso",
        description: "Documento atualizado com sucesso",
      });
      
      const updatedDoc = {
        id: variables.id,
        name: variables.name,
        content: variables.content,
        source: variables.source,
        relevance: 100,
      };
      
      // Atualizar ambos os estados para manter consistência
      setSearchResults(prev => prev.map(doc => 
        doc.id === variables.id ? updatedDoc : doc
      ));
      setAllDocuments(prev => prev.map(doc => 
        doc.id === variables.id ? updatedDoc : doc
      ));
      
      setEditingDoc(null);
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar documento",
        variant: "destructive",
      });
    },
  });


  const handleSearch = () => {
    if (!searchQuery.trim()) {
      // Se busca vazia, mostrar todos os documentos
      setSearchResults(allDocuments);
      return;
    }
    searchMutation.mutate(searchQuery);
  };

  const handleShowAll = () => {
    setSearchQuery("");
    setSearchResults(allDocuments);
    toast({
      title: "Exibindo Todos",
      description: `${allDocuments.length} documentos na base`,
    });
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

  const handleEditDocument = () => {
    if (!editingDoc?.name?.trim() || !editingDoc?.content?.trim() || !editingDoc?.source?.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, conteúdo e fonte",
        variant: "destructive",
      });
      return;
    }

    editDocumentMutation.mutate({
      id: editingDoc.id,
      name: editingDoc.name,
      content: editingDoc.content,
      source: editingDoc.source,
      metadata: { 
        updatedAt: new Date().toISOString() 
      },
    });
  };

  const handleOpenEditDialog = (chunk: any) => {
    setEditingDoc(chunk);
    setIsEditDialogOpen(true);
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Pesquisar Conhecimento</CardTitle>
            {isLoadingAll && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Carregando...
              </span>
            )}
          </div>
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
              disabled={searchMutation.isPending || isLoadingAll}
              data-testid="button-search"
            >
              <Search className="h-4 w-4 mr-2" />
              {searchMutation.isPending ? "Buscando..." : "Buscar"}
            </Button>
            
            <Button 
              onClick={handleShowAll}
              disabled={isLoadingAll}
              variant="outline"
              data-testid="button-show-all"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Mostrar Todos
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

      {searchResults.length === 0 && !isLoadingAll && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Nenhum documento encontrado. Faça uma busca ou adicione novos documentos.
            </p>
          </CardContent>
        </Card>
      )}

      {searchResults.length > 0 && (
        <KnowledgeBasePanel 
          chunks={searchResults}
          onEdit={handleOpenEditDialog}
          onDelete={(id) => {
            apiRequest(`/api/knowledge/${id}`, "DELETE", {})
              .then(() => {
                setSearchResults(prev => prev.filter(c => c.id !== id));
                setAllDocuments(prev => prev.filter(c => c.id !== id));
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
      )}

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Documento</DialogTitle>
            <DialogDescription>
              Atualize as informações do documento na base de conhecimento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Problemas de Conexão"
                value={editingDoc?.name || ""}
                onChange={(e) => setEditingDoc({ ...editingDoc, name: e.target.value })}
                data-testid="input-edit-doc-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea
                placeholder="Digite o conteúdo do documento..."
                value={editingDoc?.content || ""}
                onChange={(e) => setEditingDoc({ ...editingDoc, content: e.target.value })}
                rows={6}
                data-testid="textarea-edit-doc-content"
              />
            </div>
            <div className="space-y-2">
              <Label>Fonte</Label>
              <Input
                placeholder="Ex: Manual Técnico 2024"
                value={editingDoc?.source || ""}
                onChange={(e) => setEditingDoc({ ...editingDoc, source: e.target.value })}
                data-testid="input-edit-doc-source"
              />
            </div>
            <Button 
              onClick={handleEditDocument}
              disabled={editDocumentMutation.isPending}
              className="w-full"
              data-testid="button-confirm-edit"
            >
              {editDocumentMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
