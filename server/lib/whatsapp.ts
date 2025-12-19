/**
 * WhatsApp Helper Functions - Evolution API Integration
 * 
 * Centralizes WhatsApp message sending logic for Evolution API
 */

// Evolution API Configuration
const EVOLUTION_CONFIG = {
  apiUrl: process.env.EVOLUTION_API_URL || '',
  instance: 'Principal', // Default instance
  apiKey: process.env.EVOLUTION_API_KEY_PRINCIPAL || process.env.EVOLUTION_API_KEY || '',
};

// Supported Evolution API instances
type EvolutionInstance = 'Principal' | 'abertura';

function validateEvolutionInstance(rawInstance: string): EvolutionInstance {
  const normalized = rawInstance.toLowerCase();
  if (normalized === 'abertura') {
    return 'abertura';
  }
  return 'Principal';
}

function getEvolutionApiKey(instance: EvolutionInstance): string {
  if (instance === 'abertura') {
    return process.env.EVOLUTION_API_KEY_ABERTURA || '';
  }
  return EVOLUTION_CONFIG.apiKey || '';
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
  errorStatus?: number;
  errorMessage?: string;
  isPermanentFailure?: boolean; // true for 401/403/404 that shouldn't retry
  rawResponse?: any; // Complete Evolution API response for debugging
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
    // CRITICAL FIX: Properly handle WhatsApp Business (@lid) vs regular phones
    // Business accounts MUST preserve @lid suffix and NOT add country code
    let normalizedNumber = phoneNumber;
    
    // Remove whatsapp_ prefix if present
    if (phoneNumber.startsWith('whatsapp_')) {
      normalizedNumber = phoneNumber.replace('whatsapp_', '');
    }
    
    // Handle different formats
    if (normalizedNumber.includes('@lid')) {
      // WhatsApp Business - preserve @lid suffix, NO country code
      // Evolution API expects: "277394942365881@lid" (as-is)
      normalizedNumber = normalizedNumber; // Keep as-is
    } else if (normalizedNumber.includes('@s.whatsapp.net')) {
      // Regular phone - remove suffix and add country code
      normalizedNumber = normalizedNumber.split('@')[0];
      
      // Ensure country code +55 (Brazil) is present
      // Remove any existing + or 55 prefix first to normalize
      normalizedNumber = normalizedNumber.replace(/^\+?55/, '');
      
      // Add 55 prefix (Evolution API expects numbers without +)
      normalizedNumber = `55${normalizedNumber}`;
    } else if (!normalizedNumber.includes('@')) {
      // Bare phone number (no suffix) - add country code
      // Ensure country code +55 (Brazil) is present
      normalizedNumber = normalizedNumber.replace(/^\+?55/, '');
      normalizedNumber = `55${normalizedNumber}`;
    }
    // else: Already has other suffix (@g.us, etc) - keep as-is
    
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

export interface WhatsAppTemplateParameter {
  value: string;
  parameterName?: string; // For named variables like {{texto}}
}

export interface WhatsAppTemplateOptions {
  templateName: string;
  languageCode?: string;
  headerParameters?: WhatsAppTemplateParameter[];
  bodyParameters?: WhatsAppTemplateParameter[];
  // Legacy support: string array maps to bodyParameters
  parameters?: string[];
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
    
    // Build template components with parameters
    const components = [];
    
    // Header parameters (supports named variables)
    if (options.headerParameters && options.headerParameters.length > 0) {
      const headerParams = options.headerParameters.map(param => {
        const paramObj: any = {
          type: 'text',
          text: param.value
        };
        
        // Add parameter_name if it's a named variable
        if (param.parameterName) {
          paramObj.parameter_name = param.parameterName;
        }
        
        return paramObj;
      });
      
      components.push({
        type: 'header',
        parameters: headerParams
      });
      
      console.log(`📋 [WhatsApp Template] Header params: ${JSON.stringify(options.headerParameters)}`);
    }
    
    // Body parameters (legacy + new format)
    const bodyParams: WhatsAppTemplateParameter[] = options.bodyParameters || 
      (options.parameters?.map(p => ({ value: p, parameterName: undefined })) || []);
    
    if (bodyParams.length > 0) {
      const bodyParamsFormatted = bodyParams.map(param => {
        const paramObj: any = {
          type: 'text',
          text: param.value
        };
        
        // Add parameter_name if it's a named variable
        if (param.parameterName) {
          paramObj.parameter_name = param.parameterName;
        }
        
        return paramObj;
      });
      
      components.push({
        type: 'body',
        parameters: bodyParamsFormatted
      });
      
      console.log(`📋 [WhatsApp Template] Body params: ${JSON.stringify(bodyParams)}`);
    }
    
    const payload = {
      number: normalizedNumber,
      name: options.templateName,
      language: options.languageCode || 'en',
      components: components
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;
      
      // Structured error logging
      console.error(`❌ [WhatsApp Template] HTTP ${statusCode} error sending template:`, {
        instance,
        templateName: options.templateName,
        phoneNumber: normalizedNumber,
        statusCode,
        error: errorText.substring(0, 500), // Limit log size
      });
      
      // Determine if error is permanent (shouldn't retry)
      const isPermanent = [401, 403, 404].includes(statusCode);
      
      if (isPermanent) {
        console.error(`🚫 [WhatsApp Template] PERMANENT FAILURE (${statusCode}) - Credentials or instance configuration issue`);
        if (statusCode === 401) {
          console.error(`   💡 Check: EVOLUTION_API_KEY_${instance.toUpperCase()} may be incorrect or expired`);
        } else if (statusCode === 404) {
          console.error(`   💡 Check: Instance "${instance}" may not exist in Evolution API`);
        }
      }
      
      return {
        success: false,
        errorStatus: statusCode,
        errorMessage: errorText,
        isPermanentFailure: isPermanent,
      };
    }

    const result = await response.json();
    
    // DEBUG: Log complete Evolution API response
    console.log(`📊 [WhatsApp Template DEBUG] Evolution API Response:`, JSON.stringify(result, null, 2));
    console.log(`✅ [WhatsApp Template] Template "${options.templateName}" enviado para ${normalizedNumber} via ${instance}`);

    return {
      success: true,
      whatsappMessageId: result.key?.id,
      remoteJid: result.key?.remoteJid,
      rawResponse: result, // Include full response for debugging
    };
  } catch (error) {
    console.error("❌ [WhatsApp Template] Erro ao enviar template:", error);
    return { success: false };
  }
}
