import OpenAI from "openai";
import { webhookLogger } from "./webhook-logger";
import { trackTokenUsage } from "./openai-usage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcreve áudio usando Whisper API da OpenAI
 * 
 * @param audioBase64 - Áudio em base64 (sem prefixo data:audio/...)
 * @param mimeType - Tipo MIME do áudio (audio/mpeg, audio/ogg, audio/wav, etc.)
 * @returns Transcrição do áudio ou null se falhar
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string = "audio/mpeg"
): Promise<string | null> {
  try {
    // Converter base64 para Buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");
    
    // Determinar extensão do arquivo baseado no MIME type
    const extensionMap: Record<string, string> = {
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/ogg": "ogg",
      "audio/wav": "wav",
      "audio/webm": "webm",
      "audio/mp4": "mp4",
      "audio/m4a": "m4a",
    };
    
    const extension = extensionMap[mimeType.toLowerCase()] || "mp3";
    
    // Criar um File-like object para a API
    const audioFile = new File([audioBuffer], `audio.${extension}`, {
      type: mimeType,
    });

    console.log(`🎤 [Audio] Iniciando transcrição de áudio (${(audioBuffer.length / 1024).toFixed(2)}KB, ${extension})`);

    // Chamar Whisper API para transcrição
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "pt", // Português
      response_format: "text",
    });

    if (!transcription) {
      console.error("❌ [Audio] Whisper API retornou resposta vazia");
      webhookLogger.error("AUDIO_TRANSCRIPTION_FAILED", "Whisper retornou vazio", {
        audioSize: audioBuffer.length,
        mimeType,
      });
      return null;
    }

    console.log(`✅ [Audio] Transcrição concluída: ${transcription.substring(0, 100)}...`);
    
    // Estima duração do áudio em minutos (aproximação: 1MB ≈ 60 segundos de áudio)
    const audioSizeKB = audioBuffer.length / 1024;
    const estimatedMinutes = Math.max(0.1, (audioSizeKB / 1024)); // KB/1024 = MB, e 1MB ≈ 1 minuto de áudio
    
    // Track usage (Whisper cobra $0.006 por minuto)
    // Armazenamos como "tokens" para aproveitar infraestrutura existente
    // 1 minuto = 1 "token" (será multiplicado pelo preço correto no cálculo)
    const estimatedTokens = Math.ceil(estimatedMinutes);
    await trackTokenUsage("whisper-1", estimatedTokens, 0);
    
    webhookLogger.success("AUDIO_TRANSCRIBED", "Áudio transcrito com sucesso", {
      audioSize: audioBuffer.length,
      mimeType,
      transcriptionLength: transcription.length,
    });

    return transcription;
  } catch (error) {
    console.error("❌ [Audio] Erro ao transcrever áudio:", error);
    
    webhookLogger.error("AUDIO_TRANSCRIPTION_ERROR", "Erro na transcrição", {
      error: error instanceof Error ? error.message : String(error),
      audioSize: audioBase64.length,
      mimeType,
    });

    return null;
  }
}

/**
 * Valida se o formato de áudio é suportado
 */
export function isValidAudioFormat(mimeType: string): boolean {
  const supportedFormats = [
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/mp4",
    "audio/m4a",
  ];
  
  return supportedFormats.includes(mimeType.toLowerCase());
}

/**
 * Valida tamanho do áudio (mín 1KB, máx 25MB para Whisper)
 */
export function isValidAudioSize(audioBase64: string): boolean {
  const audioSizeBytes = (audioBase64.length * 3) / 4;
  const minSizeBytes = 1024; // 1KB (mínimo para ser um áudio válido)
  const maxSizeBytes = 25 * 1024 * 1024; // 25MB (limite do Whisper)
  return audioSizeBytes >= minSizeBytes && audioSizeBytes <= maxSizeBytes;
}
