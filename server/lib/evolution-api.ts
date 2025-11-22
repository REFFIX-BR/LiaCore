/**
 * Evolution API Helpers
 * 
 * Helper functions for fetching data from Evolution API
 * Used primarily for message recovery and location data extraction
 */

const EVOLUTION_CONFIG = {
  apiUrl: process.env.EVOLUTION_API_URL || 'https://evolutionapi.trtelecom.net',
  apiKeys: {
    Principal: process.env.EVOLUTION_API_KEY_PRINCIPAL || process.env.EVOLUTION_API_KEY || '',
    Leads: process.env.EVOLUTION_API_KEY_LEADS || '',
    Cobranca: process.env.EVOLUTION_API_KEY_COBRANCA || '',
  },
};

/**
 * Validate and normalize Evolution API instance name
 */
function validateEvolutionInstance(rawInstance: string): 'Principal' | 'Leads' | 'Cobranca' {
  // Remove accents for comparison - accepts both "Cobrança" and "Cobranca"
  const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalized = removeAccents(rawInstance.trim());
  
  // IMPORTANT: Always return WITHOUT accents - Evolution API requirement
  if (normalized === 'Leads') return 'Leads';
  if (normalized === 'Cobranca') return 'Cobranca'; // Return WITHOUT accent for API
  if (normalized === 'Principal') return 'Principal';
  
  return 'Principal';
}

/**
 * Get Evolution API key for a specific instance
 */
function getEvolutionApiKey(instance: 'Principal' | 'Leads' | 'Cobranca'): string {
  return EVOLUTION_CONFIG.apiKeys[instance] || '';
}

interface LocationMessage {
  degreesLatitude?: number;
  degreesLongitude?: number;
  name?: string;
  address?: string;
}

interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
    };
    locationMessage?: LocationMessage;
    imageMessage?: any;
    audioMessage?: any;
    videoMessage?: any;
    documentMessage?: any;
  };
  messageTimestamp?: number;
  pushName?: string;
}

interface FetchMessageResult {
  success: boolean;
  message?: EvolutionMessage;
  locationData?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  error?: string;
}

/**
 * Fetch a specific message by ID from Evolution API
 * 
 * This is used as a fallback when location messages don't trigger webhooks.
 * The Message Recovery system detects "[Localização compartilhada]" and uses
 * this function to fetch the full message data including coordinates.
 * 
 * @param messageId - WhatsApp message ID (e.g., "wamid.HBg...")
 * @param chatId - Chat ID (phone number or group ID)
 * @param instanceName - Evolution instance (Principal, Leads, Cobranca)
 * @returns Message data with location coordinates if available
 */
export async function fetchMessageById(
  messageId: string,
  chatId: string,
  instanceName?: string
): Promise<FetchMessageResult> {
  const rawInstance = instanceName || 'Principal';
  const instance = validateEvolutionInstance(rawInstance);
  const apiKey = getEvolutionApiKey(instance);
  
  if (!EVOLUTION_CONFIG.apiUrl || !apiKey) {
    console.error("❌ [Evolution API] Credenciais não configuradas", { 
      hasUrl: !!EVOLUTION_CONFIG.apiUrl, 
      hasKey: !!apiKey, 
      instance 
    });
    return { success: false, error: "Missing credentials" };
  }

  try {
    // Ensure URL has protocol
    let baseUrl = EVOLUTION_CONFIG.apiUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    // Evolution API endpoint: /message/findByKey/{instance}
    // Query params: key (message ID), remoteJid (chat ID)
    const url = `${baseUrl}/message/findByKey/${instance}?key=${encodeURIComponent(messageId)}&remoteJid=${encodeURIComponent(chatId)}`;
    
    console.log(`🔍 [Evolution API] Fetching message by ID:`, {
      messageId: messageId.substring(0, 30) + '...',
      chatId: chatId.substring(0, 20) + '...',
      instance,
      url: url.substring(0, 100) + '...'
    });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Evolution API] Failed to fetch message (${response.status}):`, errorText.substring(0, 200));
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` 
      };
    }

    const messageData: EvolutionMessage = await response.json();
    
    console.log(`✅ [Evolution API] Message fetched successfully:`, {
      messageId: messageData.key?.id?.substring(0, 30) + '...',
      hasLocationMessage: !!messageData.message?.locationMessage,
      messageKeys: messageData.message ? Object.keys(messageData.message) : []
    });

    // Extract location data if available
    if (messageData.message?.locationMessage) {
      const location = messageData.message.locationMessage;
      const latitude = location.degreesLatitude;
      const longitude = location.degreesLongitude;
      
      if (latitude && longitude) {
        console.log(`📍 [Evolution API] Location coordinates extracted:`, {
          latitude,
          longitude,
          name: location.name,
          address: location.address
        });
        
        return {
          success: true,
          message: messageData,
          locationData: {
            latitude,
            longitude,
            name: location.name,
            address: location.address
          }
        };
      } else {
        console.warn(`⚠️  [Evolution API] Location message found but missing coordinates`);
      }
    }

    return {
      success: true,
      message: messageData
    };

  } catch (error) {
    console.error(`❌ [Evolution API] Error fetching message:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}
