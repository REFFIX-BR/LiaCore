import OpenAI from "openai";
import { webhookLogger } from "./webhook-logger";

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
 * Valida tamanho do áudio (máx 25MB para Whisper)
 */
export function isValidAudioSize(audioBase64: string): boolean {
  const audioSizeBytes = (audioBase64.length * 3) / 4;
  const maxSizeBytes = 25 * 1024 * 1024; // 25MB (limite do Whisper)
  return audioSizeBytes <= maxSizeBytes;
}
