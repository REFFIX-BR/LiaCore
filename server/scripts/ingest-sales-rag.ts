import { readFileSync } from "fs";
import { join } from "path";
import { addKnowledgeChunks } from "../lib/upstash";

/**
 * Script para ingerir documentos RAG de vendas no Upstash Vector
 * Baseado nos 6 documentos fornecidos para o assistente comercial
 */

interface RagDocument {
  filename: string;
  title: string;
  description: string;
}

const ragDocuments: RagDocument[] = [
  {
    filename: "GUIA_INTEGRACAO_RAG_IA_1760819362386.md",
    title: "Guia de Integração RAG para IA",
    description: "Guia técnico de integração e uso do sistema RAG"
  },
  {
    filename: "HAG_IA_CADASTRO_CLIENTES_1760819362474.md",
    title: "HAG - Cadastro de Clientes",
    description: "Documentação sobre cadastro de clientes e campos obrigatórios"
  },
  {
    filename: "EXEMPLOS_CONVERSAS_IA_VENDAS_1760819362544.md",
    title: "Exemplos de Conversas - Vendas",
    description: "Exemplos práticos de conversas de vendas bem-sucedidas"
  },
  {
    filename: "FICHA_COLETA_DADOS_IA_1760819362588.md",
    title: "Ficha de Coleta de Dados",
    description: "Checklist estruturado para coleta de dados de clientes"
  },
  {
    filename: "RAG_IA_VENDAS_CONVERSACIONAL_1760819362622.md",
    title: "RAG - Vendas Conversacional",
    description: "Estratégias e scripts de vendas conversacional humanizada"
  },
  {
    filename: "Pasted--COMBOS-TR-TELECOM-INTERNET-TELEFONIA-M-VEL-IMPORTANTE-Todos-os-planos-m-veis-oferecem-D-1760820131637_1760820131641.txt",
    title: "Combos TR Telecom - Internet + Telefonia Móvel",
    description: "Detalhes completos sobre combos com dupla operadora Vivo/Tim"
  }
];

function splitIntoChunks(text: string, maxChunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = "";
  
  for (const paragraph of paragraphs) {
    // Se o parágrafo sozinho já é maior que o limite, quebra por sentenças
    if (paragraph.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      
      const sentences = paragraph.split(/\.\s+/);
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkSize) {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence + ". ";
        } else {
          currentChunk += sentence + ". ";
        }
      }
    } else {
      // Se adicionar o parágrafo ultrapassar o limite, salva o chunk atual
      if (currentChunk.length + paragraph.length > maxChunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph + "\n\n";
      } else {
        currentChunk += paragraph + "\n\n";
      }
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function ingestSalesRagDocuments() {
  console.log("🚀 Iniciando ingestão de documentos RAG de vendas...\n");
  
  const allChunks: Array<{
    id: string;
    name: string;
    content: string;
    source: string;
    metadata: Record<string, any>;
  }> = [];
  
  for (const doc of ragDocuments) {
    const filePath = join(process.cwd(), "attached_assets", doc.filename);
    
    try {
      console.log(`📄 Processando: ${doc.title}`);
      const content = readFileSync(filePath, "utf-8");
      
      // Divide o documento em chunks
      const chunks = splitIntoChunks(content);
      console.log(`   ├─ Tamanho: ${(content.length / 1024).toFixed(2)} KB`);
      console.log(`   └─ Chunks: ${chunks.length}`);
      
      // Cria objetos de chunk para cada pedaço
      for (let i = 0; i < chunks.length; i++) {
        allChunks.push({
          id: `sales-rag-${doc.filename}-chunk-${i}`,
          name: `${doc.title} (Parte ${i + 1}/${chunks.length})`,
          content: chunks[i],
          source: doc.filename,
          metadata: {
            category: "sales",
            documentTitle: doc.title,
            documentDescription: doc.description,
            chunkIndex: i,
            totalChunks: chunks.length,
          }
        });
      }
    } catch (error) {
      console.error(`   ❌ Erro ao processar ${doc.filename}:`, error);
    }
  }
  
  console.log(`\n📊 Total de chunks gerados: ${allChunks.length}`);
  console.log(`\n⏳ Enviando chunks para Upstash Vector...`);
  
  // Processa em batches de 10 para não sobrecarregar a API
  const batchSize = 10;
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    console.log(`   📦 Processando batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allChunks.length / batchSize)} (${batch.length} chunks)`);
    
    try {
      await addKnowledgeChunks(batch);
      console.log(`   ✅ Batch enviado com sucesso`);
    } catch (error) {
      console.error(`   ❌ Erro ao enviar batch:`, error);
    }
  }
  
  console.log(`\n✅ Ingestão concluída! ${allChunks.length} chunks de vendas adicionados ao Upstash Vector`);
  console.log(`\n📋 Documentos processados:`);
  ragDocuments.forEach((doc, idx) => {
    console.log(`   ${idx + 1}. ${doc.title}`);
  });
}

// Executa o script
ingestSalesRagDocuments()
  .then(() => {
    console.log("\n🎉 Script finalizado com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro ao executar script:", error);
    process.exit(1);
  });
