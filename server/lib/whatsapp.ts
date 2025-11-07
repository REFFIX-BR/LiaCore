/**
 * WhatsApp Helper Functions - Evolution API Integration
 * 
 * Centralizes WhatsApp message sending logic for Evolution API
 */

// Evolution API Configuration
const EVOLUTION_CONFIG = {
  apiUrl: process.env.EVOLUTION_API_URL || '',
  instance: 'Principal', // Default instance
  apiKeys: {
    Principal: process.env.EVOLUTION_API_KEY || '',
    Leads: process.env.EVOLUTION_API_INSTANCE_LEADS || '',
    Cobranca: process.env.EVOLUTION_API_INSTANCE_COBRANCA || '',
  },
};

function validateEvolutionInstance(rawInstance: string): 'Principal' | 'Leads' | 'Cobranca' {
  const normalized = rawInstance.trim();
  
  if (normalized === 'Leads' || normalized === 'Cobranca' || normalized === 'Principal') {
    return normalized;
  }
  
  return 'Principal';
}

function getEvolutionApiKey(instance: 'Principal' | 'Leads' | 'Cobranca'): string {
  return EVOLUTION_CONFIG.apiKeys[instance] || '';
}

export interface WhatsAppMessageOptions {
  instance?: string;
  phoneNumber: string;
  message: string;
}

export interface WhatsAppMessageResult {
  success: boolean;
  whatsappMessageId?: string;
  remoteJid?: string;
}

/**
 * Sends a WhatsApp text message via Evolution API
 */
export async function sendWhatsAppMessage(
  phoneNumber: string, 
  text: string, 
  instanceName?: string
): Promise<WhatsAppMessageResult> {
  const rawInstance = instanceName || EVOLUTION_CONFIG.instance;
  const instance = validateEvolutionInstance(rawInstance);
  const apiKey = getEvolutionApiKey(instance);
  
  if (!EVOLUTION_CONFIG.apiUrl || !apiKey || !instance) {
    console.error("❌ [WhatsApp] Credenciais não configuradas", { 
      hasUrl: !!EVOLUTION_CONFIG.apiUrl, 
      hasKey: !!apiKey, 
      instance: instance || 'undefined' 
    });
    return { success: false };
  }

  try {
    // Normalize WhatsApp number
    let normalizedNumber = phoneNumber;
    
    if (phoneNumber.startsWith('whatsapp_')) {
      normalizedNumber = phoneNumber.replace('whatsapp_', '');
    } else if (phoneNumber.includes('@s.whatsapp.net')) {
      normalizedNumber = phoneNumber.split('@')[0];
    }
    
    // Ensure URL has protocol
    let baseUrl = EVOLUTION_CONFIG.apiUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    const url = `${baseUrl}/message/sendText/${instance}`;
    
    console.log(`📤 [WhatsApp] Enviando mensagem para ${normalizedNumber} via ${instance}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: normalizedNumber,
        text: text,
        delay: 1200, // Natural typing simulation
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [WhatsApp] Erro ao enviar mensagem (${response.status}):`, errorText);
      return { success: false };
    }

    const result = await response.json();
    console.log(`✅ [WhatsApp] Mensagem enviada para ${normalizedNumber} via ${instance}`);

    return {
      success: true,
      whatsappMessageId: result.key?.id,
      remoteJid: result.key?.remoteJid,
    };
  } catch (error) {
    console.error("❌ [WhatsApp] Erro ao enviar mensagem:", error);
    return { success: false };
  }
}
