import axios from 'axios';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

export interface EvolutionMessageKey {
  id: string;
  remoteJid: string;
  fromMe: boolean;
}

export async function downloadImageFromEvolution(
  messageKey: EvolutionMessageKey,
  instance: string
): Promise<string | null> {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('❌ [Vision] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados');
      return null;
    }

    console.log(`📥 [Vision] Baixando imagem da Evolution API para mensagem ${messageKey.id}`);

    const response = await axios.post(
      `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instance}`,
      {
        message: {
          key: messageKey,
        },
        convertToMp4: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        timeout: 30000,
      }
    );

    if (response.data?.base64) {
      console.log(`✅ [Vision] Imagem baixada com sucesso (${response.data.base64.length} bytes)`);
      return response.data.base64;
    } else {
      console.error('❌ [Vision] Resposta da Evolution API não contém base64:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ [Vision] Erro ao baixar imagem da Evolution API:', error);
    if (axios.isAxiosError(error)) {
      console.error('Detalhes:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
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
      imageUrl = `data:image/jpeg;base64,${base64Image}`;
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
  caption?: string
): Promise<ProcessedWhatsAppImage> {
  console.log(`📸 [Vision] Processando imagem do WhatsApp...`);

  const base64Image = await downloadImageFromEvolution(messageKey, instance);

  if (!base64Image) {
    console.log('⚠️  [Vision] Não foi possível baixar a imagem - retornando placeholder');
    const text = caption 
      ? `[Imagem recebida] ${caption}` 
      : '[Imagem recebida]';
    return { text };
  }

  // NÃO processar com IA - apenas retornar imagem com legenda se houver
  const text = caption 
    ? `[Imagem recebida] ${caption}` 
    : '[Imagem recebida]';

  console.log(`✅ [Vision] Imagem baixada e salva (sem análise de IA)`);
  return { text, base64: base64Image };
}
