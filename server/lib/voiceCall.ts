import { WebSocket } from 'ws';
import { getTwilioClient, getTwilioFromPhoneNumber } from './twilioIntegration';

export interface VoiceCallOptions {
  phoneNumber: string;
  clientName: string;
  debtAmount: number;
  debtDetails?: string;
  campaignId: string;
  targetId: string;
  attemptNumber: number;
}

export interface VoiceCallResult {
  success: boolean;
  callSid?: string;
  duration?: number;
  status?: string;
  transcript?: string;
  conversationData?: {
    promiseMade?: boolean;
    wontPay?: boolean;
    promise?: {
      amount?: number;
      dueDate?: string;
      paymentMethod?: string;
    };
  };
  error?: string;
}

export async function initiateVoiceCall(
  options: VoiceCallOptions
): Promise<VoiceCallResult> {
  const {
    phoneNumber,
    clientName,
    debtAmount,
    debtDetails,
    campaignId,
    targetId,
    attemptNumber,
  } = options;

  console.log(`📞 [Voice Call] Initiating call to ${phoneNumber} (${clientName})`);

  try {
    const twilioClient = await getTwilioClient();
    const twilioPhoneNumber = await getTwilioFromPhoneNumber();

    const baseUrl = process.env.WEBHOOK_BASE_URL;
    
    if (!baseUrl) {
      throw new Error('WEBHOOK_BASE_URL environment variable not configured');
    }

    const webhookUrl = `${baseUrl}/api/voice/webhook/twiml`;
    console.log(`🔗 [Voice Call] Using webhook URL: ${webhookUrl}`);

    const call = await twilioClient.calls.create({
      to: phoneNumber,
      from: twilioPhoneNumber,
      url: `${webhookUrl}?targetId=${targetId}&campaignId=${campaignId}&attemptNumber=${attemptNumber}`,
      statusCallback: `${webhookUrl.replace('/twiml', '/status')}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: true,
      recordingStatusCallback: `${webhookUrl.replace('/twiml', '/recording')}`,
      timeout: 60,
    });

    console.log(`✅ [Voice Call] Call initiated: ${call.sid}`);

    return {
      success: true,
      callSid: call.sid,
      status: call.status,
    };
  } catch (error: any) {
    console.error('❌ [Voice Call] Error initiating call:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export interface OpenAIConversationOptions {
  systemPrompt: string;
  clientName: string;
  debtAmount: number;
  debtDetails?: string;
}

export async function createOpenAIRealtimeSession(
  options: OpenAIConversationOptions
): Promise<{ sessionId: string; wsUrl: string; clientSecret: string; expiresAt: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const systemPrompt = options.systemPrompt || `
Você é Lia, assistente virtual de cobrança da TR Telecom.

INFORMAÇÕES DO CLIENTE:
- Nome: ${options.clientName}
- Valor da dívida: R$ ${(options.debtAmount / 100).toFixed(2)}
${options.debtDetails ? `- Detalhes: ${options.debtDetails}` : ''}

INSTRUÇÕES:
1. Seja educada, empática e profissional
2. Apresente-se brevemente e explique o motivo da ligação
3. Ofereça opções de pagamento flexíveis
4. Se o cliente concordar em pagar, confirme:
   - Valor que irá pagar
   - Data do pagamento
   - Forma de pagamento (Pix, boleto, cartão)
5. Se o cliente recusar, pergunte o motivo e tente entender a situação
6. Mantenha a conversa focada e objetiva (máximo 3 minutos)

IMPORTANTE:
- Use linguagem natural e conversacional
- Não seja insistente ou agressiva
- Respeite se o cliente pedir para encerrar a ligação
`;

  const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: 'nova',
      instructions: systemPrompt,
      modalities: ['text', 'audio'],
      temperature: 0.7,
    }),
  });

  if (!sessionResponse.ok) {
    throw new Error(`Failed to create OpenAI session: ${sessionResponse.statusText}`);
  }

  const sessionData = await sessionResponse.json();
  
  const sessionId = sessionData.id;
  const wsUrl = sessionData.client_secret.url;
  const clientSecret = sessionData.client_secret.value;
  const expiresAt = sessionData.client_secret.expires_at;

  try {
    const { redis } = await import('./redis-config');
    const ttl = Math.max(60, expiresAt - Math.floor(Date.now() / 1000));
    await redis.setex(
      `openai-session:${sessionId}`,
      ttl,
      JSON.stringify({ wsUrl, clientSecret, expiresAt })
    );
    console.log(`✅ [Voice Call] OpenAI session cached: ${sessionId} (TTL: ${ttl}s)`);
  } catch (error) {
    console.warn('⚠️ [Voice Call] Failed to cache session in Redis:', error);
  }
  
  return {
    sessionId,
    wsUrl,
    clientSecret,
    expiresAt,
  };
}

export function generateTwiMLForCall(streamUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
}

export class RealtimeConversationHandler {
  private ws: WebSocket | null = null;
  private transcript: string[] = [];
  private conversationData: any = {};

  constructor(private wsUrl: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('✅ [OpenAI Realtime] WebSocket connected');
        resolve();
      });

      this.ws.on('message', (data: any) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ [OpenAI Realtime] Error parsing message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ [OpenAI Realtime] WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('🔌 [OpenAI Realtime] WebSocket closed');
      });
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'conversation.item.created':
        if (message.item.type === 'message' && message.item.role === 'assistant') {
          const text = message.item.content?.find((c: any) => c.type === 'text')?.text;
          if (text) {
            this.transcript.push(`AI: ${text}`);
          }
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (message.transcript) {
          this.transcript.push(`Cliente: ${message.transcript}`);
        }
        break;

      case 'response.function_call_arguments.done':
        if (message.name === 'confirm_payment_promise') {
          this.conversationData.promiseMade = true;
          this.conversationData.promise = JSON.parse(message.arguments);
        } else if (message.name === 'mark_as_unwilling_to_pay') {
          this.conversationData.wontPay = true;
        }
        break;
    }
  }

  sendAudio(audioData: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioData.toString('base64'),
      }));
    }
  }

  getTranscript(): string {
    return this.transcript.join('\n');
  }

  getConversationData(): any {
    return this.conversationData;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
