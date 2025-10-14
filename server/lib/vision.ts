import axios from 'axios';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface EvolutionMessageKey {
  id: string;
  remoteJid: string;
  fromMe: boolean;
}

/**
 * Get Evolution API key for a specific instance
 */
function getEvolutionApiKey(instance?: string): string | undefined {
  // Tenta API key específica da instância primeiro, senão usa global
  return instance
    ? (process.env[`EVOLUTION_API_KEY_${instance}`] || process.env.EVOLUTION_API_KEY)
    : process.env.EVOLUTION_API_KEY;
}

/**
 * Get Evolution API URL for a specific instance
 */
function getEvolutionApiUrl(instance?: string): string | undefined {
  // Tenta URL específica da instância primeiro, senão usa global
  return instance
    ? (process.env[`EVOLUTION_API_URL_${instance}`] || process.env.EVOLUTION_API_URL)
    : process.env.EVOLUTION_API_URL;
}

/**
 * Download media from S3/MinIO URL and convert to base64
 */
export async function downloadMediaFromUrl(
  mediaUrl: string
): Promise<string | null> {
  try {
    console.log(`📥 [Vision] Baixando mídia de URL S3/MinIO...`);
    console.log(`🔍 [Vision] URL: ${mediaUrl.substring(0, 100)}...`);

    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    
    console.log(`✅ [Vision] Mídia baixada com sucesso de S3 (${base64.length} caracteres base64)`);
    return base64;
  } catch (error) {
    console.error('❌ [Vision] Erro ao baixar mídia de URL S3:', error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error - Response status:', error.response?.status);
      console.error('Axios error - URL:', error.config?.url?.substring(0, 100));
    }
    return null;
  }
}

export async function downloadImageFromEvolution(
  messageKey: EvolutionMessageKey,
  instance: string
): Promise<string | null> {
  try {
    const apiKey = getEvolutionApiKey(instance);
    const apiUrl = getEvolutionApiUrl(instance);
    
    if (!apiUrl || !apiKey) {
      console.error('❌ [Vision] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados', {
        instance,
        triedKey: `EVOLUTION_API_KEY_${instance}`,
        triedUrl: `EVOLUTION_API_URL_${instance}`
      });
      return null;
    }

    console.log(`📥 [Vision] Iniciando download de imagem da Evolution API...`);
    console.log(`🔍 [Vision] MessageKey:`, JSON.stringify(messageKey));
    console.log(`🔍 [Vision] Instance: ${instance}`);
    console.log(`🔍 [Vision] URL: ${apiUrl}/chat/getBase64FromMediaMessage/${instance}`);

    const response = await axios.post(
      `${apiUrl}/chat/getBase64FromMediaMessage/${instance}`,
      {
        message: {
          key: messageKey,
        },
        convertToMp4: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        timeout: 30000,
      }
    );

    console.log(`🔍 [Vision] Response status: ${response.status}`);
    console.log(`🔍 [Vision] Response keys:`, Object.keys(response.data || {}));

    if (response.data?.base64) {
      console.log(`✅ [Vision] Imagem baixada com sucesso (${response.data.base64.length} caracteres base64)`);
      return response.data.base64;
    } else {
      console.error('❌ [Vision] Resposta da Evolution API não contém base64');
      console.error('Response completa:', JSON.stringify(response.data).substring(0, 500));
      return null;
    }
  } catch (error) {
    console.error('❌ [Vision] Erro ao baixar imagem da Evolution API:', error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error - Response data:', error.response?.data);
      console.error('Axios error - Response status:', error.response?.status);
      console.error('Axios error - Request URL:', error.config?.url);
    }
    return null;
  }
}

export async function analyzeImageWithVision(
  base64Image: string,
  prompt: string = 'Analise esta imagem em detalhes e extraia todas as informações relevantes. Se for um boleto, extraia identificador, vencimento, valor, multa e juros. Se for um documento, extraia CPF/CNPJ e demais dados. Se for um print de tela ou mensagem, transcreva o conteúdo.'
): Promise<string | null> {
  try {
    console.log(`🔍 [Vision] Analisando imagem com GPT-4o Vision...`);

    let imageUrl = base64Image;
    
    if (!base64Image.startsWith('data:image/')) {
      console.log(`🔧 [Vision] Adicionando prefixo data URI ao base64...`);
      
      // Detectar formato da imagem pela assinatura base64
      let imageFormat = 'jpeg'; // Padrão
      
      if (base64Image.startsWith('iVBORw')) {
        imageFormat = 'png';
      } else if (base64Image.startsWith('/9j/')) {
        imageFormat = 'jpeg';
      } else if (base64Image.startsWith('R0lGOD')) {
        imageFormat = 'gif';
      } else if (base64Image.startsWith('UklGR')) {
        imageFormat = 'webp';
      }
      
      console.log(`🔍 [Vision] Formato detectado: ${imageFormat}`);
      imageUrl = `data:image/${imageFormat};base64,${base64Image}`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const analysis = response.choices[0]?.message?.content;

    if (analysis) {
      console.log(`✅ [Vision] Análise concluída: ${analysis.substring(0, 100)}...`);
      return analysis;
    } else {
      console.error('❌ [Vision] GPT-4o não retornou análise');
      return null;
    }
  } catch (error: unknown) {
    console.error('❌ [Vision] Erro ao analisar imagem com GPT-4o:', error);
    return null;
  }
}

export interface ProcessedWhatsAppImage {
  text: string;
  base64?: string;
}

export async function processWhatsAppImage(
  messageKey: EvolutionMessageKey,
  instance: string,
  caption?: string,
  mediaUrl?: string
): Promise<ProcessedWhatsAppImage> {
  console.log(`📸 [Vision] Processando imagem do WhatsApp...`);

  let base64Image: string | null = null;

  // Priorizar URL S3/MinIO se disponível
  if (mediaUrl) {
    console.log(`🔗 [Vision] Tentando download via URL S3/MinIO...`);
    base64Image = await downloadMediaFromUrl(mediaUrl);
    
    // Fallback para Evolution API se S3 falhar
    if (!base64Image) {
      console.log(`⚠️  [Vision] Falha no download S3 - tentando Evolution API como fallback...`);
      base64Image = await downloadImageFromEvolution(messageKey, instance);
    }
  } else {
    console.log(`🔗 [Vision] Usando Evolution API para download...`);
    base64Image = await downloadImageFromEvolution(messageKey, instance);
  }

  console.log(`🔍 [DEBUG Vision] Resultado do download:`, {
    hasBase64: !!base64Image,
    length: base64Image?.length || 0,
    startsWithData: base64Image?.startsWith('data:') || false,
    preview: base64Image?.substring(0, 50) || 'null'
  });

  if (!base64Image) {
    console.log('⚠️  [Vision] Não foi possível baixar a imagem - retornando placeholder');
    const text = caption 
      ? `[Imagem recebida] ${caption}` 
      : '[Imagem recebida]';
    return { text };
  }

  // Analisar imagem com Vision
  const promptWithContext = caption 
    ? `${caption}\n\nPor favor, analise a imagem considerando a mensagem do cliente acima.`
    : 'Analise esta imagem em detalhes e extraia todas as informações relevantes. Se for um boleto, extraia identificador, vencimento, valor. Se for um documento, extraia CPF/CNPJ.';
  
  const visionAnalysis = await analyzeImageWithVision(base64Image, promptWithContext);

  const text = visionAnalysis 
    ? (caption ? `${caption}\n\n[Análise da imagem: ${visionAnalysis}]` : `[Imagem enviada - ${visionAnalysis}]`)
    : (caption ? `[Imagem recebida] ${caption}` : '[Imagem recebida]');

  console.log(`✅ [Vision] Imagem processada com análise de IA`, {
    base64Length: base64Image.length,
    hasAnalysis: !!visionAnalysis,
    returning: { text, hasBase64: true }
  });
  
  return { text, base64: base64Image };
}

export interface ProcessedWhatsAppDocument {
  text: string;
  base64?: string;
  fileName?: string;
}

export async function processWhatsAppDocument(
  messageKey: EvolutionMessageKey,
  instance: string,
  fileName?: string,
  mediaUrl?: string
): Promise<ProcessedWhatsAppDocument> {
  console.log(`📄 [Document] Processando documento do WhatsApp...`);

  let base64Document: string | null = null;

  // Priorizar URL S3/MinIO se disponível
  if (mediaUrl) {
    console.log(`🔗 [Document] Tentando download via URL S3/MinIO...`);
    base64Document = await downloadMediaFromUrl(mediaUrl);
    
    // Fallback para Evolution API se S3 falhar
    if (!base64Document) {
      console.log(`⚠️  [Document] Falha no download S3 - tentando Evolution API como fallback...`);
      base64Document = await downloadImageFromEvolution(messageKey, instance);
    }
  } else {
    console.log(`🔗 [Document] Usando Evolution API para download...`);
    base64Document = await downloadImageFromEvolution(messageKey, instance);
  }

  console.log(`🔍 [DEBUG Document] Resultado do download:`, {
    hasBase64: !!base64Document,
    length: base64Document?.length || 0,
    fileName: fileName || 'sem nome'
  });

  if (!base64Document) {
    console.log('⚠️  [Document] Não foi possível baixar o documento - retornando placeholder');
    const text = fileName 
      ? `[Documento] ${fileName}` 
      : '[Documento recebido]';
    return { text, fileName };
  }

  const text = fileName 
    ? `[Documento] ${fileName}` 
    : '[Documento recebido]';

  console.log(`✅ [Document] Documento baixado e salvo`, {
    base64Length: base64Document.length,
    fileName: fileName || 'documento',
    returning: { text, hasBase64: true, fileName }
  });
  
  return { text, base64: base64Document, fileName };
}
