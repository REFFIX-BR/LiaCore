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
    Principal: process.env.EVOLUTION_API_KEY_PRINCIPAL || process.env.EVOLUTION_API_KEY || '',
    Leads: process.env.EVOLUTION_API_KEY_LEADS || '',
    Cobranca: process.env.EVOLUTION_API_KEY_COBRANCA || '',
  },
};

function validateEvolutionInstance(rawInstance: string): 'Principal' | 'Leads' | 'Cobranca' {
  // Remove accents and normalize (accepts both "Cobrança" and "Cobranca")
  const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalized = removeAccents(rawInstance.trim());
  
  if (normalized === 'Leads' || normalized === 'Cobranca' || normalized === 'Principal') {
    return normalized as 'Principal' | 'Leads' | 'Cobranca';
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
    
    // Ensure country code +55 (Brazil) is present
    // Remove any existing + or 55 prefix first to normalize
    normalizedNumber = normalizedNumber.replace(/^\+?55/, '');
    
    // Add 55 prefix (Evolution API expects numbers without +)
    normalizedNumber = `55${normalizedNumber}`;
    
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

export interface WhatsAppTemplateOptions {
  templateName: string;
  languageCode?: string;
  parameters: string[];
}

/**
 * Sends a WhatsApp template message via Evolution API
 * Uses Meta-approved templates to avoid number banning
 */
export async function sendWhatsAppTemplate(
  phoneNumber: string,
  options: WhatsAppTemplateOptions,
  instanceName?: string
): Promise<WhatsAppMessageResult> {
  const rawInstance = instanceName || EVOLUTION_CONFIG.instance;
  const instance = validateEvolutionInstance(rawInstance);
  const apiKey = getEvolutionApiKey(instance);
  
  if (!EVOLUTION_CONFIG.apiUrl || !apiKey || !instance) {
    console.error("❌ [WhatsApp Template] Credenciais não configuradas", { 
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
    
    // Ensure country code +55 (Brazil) is present
    normalizedNumber = normalizedNumber.replace(/^\+?55/, '');
    normalizedNumber = `55${normalizedNumber}`;
    
    // Ensure URL has protocol
    let baseUrl = EVOLUTION_CONFIG.apiUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    const url = `${baseUrl}/message/sendTemplate/${instance}`;
    
    console.log(`📋 [WhatsApp Template] Enviando template "${options.templateName}" para ${normalizedNumber} via ${instance}`);
    console.log(`📋 [WhatsApp Template] Parâmetros: ${JSON.stringify(options.parameters)}`);
    
    // Build template components with parameters
    const components = [];
    
    if (options.parameters && options.parameters.length > 0) {
      components.push({
        type: 'body',
        parameters: options.parameters.map(param => ({
          type: 'text',
          text: param
        }))
      });
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: normalizedNumber,
        template: {
          name: options.templateName,
          language: options.languageCode || 'en', // Default to 'en' as per your template
          components: components
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [WhatsApp Template] Erro ao enviar template (${response.status}):`, errorText);
      return { success: false };
    }

    const result = await response.json();
    console.log(`✅ [WhatsApp Template] Template "${options.templateName}" enviado para ${normalizedNumber} via ${instance}`);

    return {
      success: true,
      whatsappMessageId: result.key?.id,
      remoteJid: result.key?.remoteJid,
    };
  } catch (error) {
    console.error("❌ [WhatsApp Template] Erro ao enviar template:", error);
    return { success: false };
  }
}
