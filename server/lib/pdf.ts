import { webhookLogger } from "./webhook-logger";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Extrai texto de um PDF em base64 usando pdf-parse
 * 
 * @param pdfBase64 - PDF em base64 (sem prefixo data:application/pdf;base64,)
 * @returns Texto extraído do PDF ou null se falhar
 */
export async function extractPdfText(pdfBase64: string): Promise<string | null> {
  try {
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    
    console.log(`📄 [PDF] Iniciando extração de texto do PDF (${(pdfBuffer.length / 1024).toFixed(2)}KB)`);

    // Import pdf-parse (v1.1.1 - classic functional API)
    const pdfParse = require("pdf-parse");
    
    // Call pdf-parse as a function with the buffer
    const data = await pdfParse(pdfBuffer);

    if (!data.text || data.text.trim().length === 0) {
      console.log(`⚠️ [PDF] PDF não contém texto extraível (pode ser imagem escaneada)`);
      webhookLogger.warning("PDF_NO_TEXT", "PDF sem texto extraível", {
        pdfSize: pdfBuffer.length,
        pages: data.numpages,
      });
      return null;
    }

    const extractedText = data.text.trim();
    
    console.log(`✅ [PDF] Texto extraído com sucesso:`, {
      pages: data.numpages,
      textLength: extractedText.length,
      preview: extractedText.substring(0, 200),
    });
    
    webhookLogger.success("PDF_TEXT_EXTRACTED", "Texto extraído de PDF", {
      pdfSize: pdfBuffer.length,
      pages: data.numpages,
      textLength: extractedText.length,
    });

    return extractedText;
  } catch (error) {
    console.error("❌ [PDF] Erro ao extrair texto do PDF:", error);
    
    webhookLogger.error("PDF_EXTRACTION_ERROR", "Erro na extração de PDF", {
      error: error instanceof Error ? error.message : String(error),
      pdfSize: pdfBase64.length,
    });

    return null;
  }
}

/**
 * Valida tamanho do PDF (máx 10MB para evitar problemas de memória)
 */
export function isValidPdfSize(pdfBase64: string): boolean {
  const pdfSizeBytes = (pdfBase64.length * 3) / 4;
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB
  return pdfSizeBytes <= maxSizeBytes;
}

/**
 * Trunca texto muito longo para evitar exceder limite de tokens da IA
 * Limite aproximado: 15.000 caracteres (~3.750 tokens GPT-4)
 */
export function truncatePdfText(text: string, maxChars: number = 15000): { text: string; wasTruncated: boolean } {
  if (text.length <= maxChars) {
    return { text, wasTruncated: false };
  }

  const truncated = text.substring(0, maxChars);
  console.log(`⚠️ [PDF] Texto truncado de ${text.length} para ${maxChars} caracteres`);
  
  return {
    text: truncated + "\n\n[... documento continua, texto truncado para evitar limite de tokens ...]",
    wasTruncated: true,
  };
}
