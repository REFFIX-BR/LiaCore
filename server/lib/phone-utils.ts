/**
 * Phone Number Utilities
 * Centralizes phone normalization logic for the entire system
 */

/**
 * Normalizes a phone number to canonical format: 55XXXXXXXXXXX (digits only with 55 prefix)
 * 
 * Handles various input formats:
 * - "(24) 99920-7033" -> "5524999207033"
 * - "24 99920-7033" -> "5524999207033"
 * - "2499207033" -> "5524999207033"
 * - "+55 24 99920-7033" -> "5524999207033"
 * - "55 24 99920-7033" -> "5524999207033"
 * 
 * @param phone - Raw phone number in any format
 * @returns Normalized phone number (digits only with 55 prefix) or null if invalid
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  if (!digitsOnly) {
    console.warn(`[Phone Normalization] Invalid phone (no digits): "${phone}"`);
    return null;
  }

  // Remove ALL repeated leading "55" prefixes until we reach the correct format
  // CRM sometimes sends duplicated country codes: "555524992630536" (15 digits) -> "5524992630536" (13 digits)
  let normalized = digitsOnly;
  
  // Keep removing "55" while number is too long (> 13 digits)
  while (normalized.startsWith('55') && normalized.length > 13) {
    const withoutPrefix = normalized.substring(2);
    console.log(`[Phone Normalization] Removed duplicate "55": "${normalized}" -> "${withoutPrefix}"`);
    normalized = withoutPrefix;
  }
  
  // If number doesn't start with "55" but has correct length, add it
  if (!normalized.startsWith('55')) {
    // Validate length (should be 10 or 11 digits for Brazilian numbers)
    // 10 digits: landline (e.g., 2499207033)
    // 11 digits: mobile (e.g., 24999207033)
    if (normalized.length < 10 || normalized.length > 11) {
      console.warn(`[Phone Normalization] Invalid length (${normalized.length} digits): "${phone}" -> "${normalized}"`);
      return null;
    }
    normalized = `55${normalized}`;
  }
  
  // Final validation: must be exactly 12 or 13 digits (55 + 10/11 digits)
  if (normalized.length !== 12 && normalized.length !== 13) {
    console.warn(`[Phone Normalization] Invalid final length (${normalized.length} digits): "${phone}" -> "${normalized}"`);
    return null;
  }
  
  const final = normalized;

  // Log normalization for debugging
  if (phone !== final) {
    console.log(`[Phone Normalization] "${phone}" -> "${final}"`);
  }

  return final;
}

/**
 * Formats a normalized phone number for display
 * 
 * @param phone - Normalized phone (55XXXXXXXXXXX)
 * @returns Formatted phone "+55 (XX) XXXXX-XXXX" or original if invalid
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) {
    return '';
  }

  const digitsOnly = phone.replace(/\D/g, '');

  // Expect format: 55XXXXXXXXXXX (13 or 12 digits)
  if (!digitsOnly.startsWith('55') || (digitsOnly.length !== 12 && digitsOnly.length !== 13)) {
    return phone; // Return as-is if not normalized
  }

  const withoutCountry = digitsOnly.substring(2);
  const ddd = withoutCountry.substring(0, 2);
  const number = withoutCountry.substring(2);

  if (number.length === 9) {
    // Mobile: +55 (XX) XXXXX-XXXX
    return `+55 (${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
  } else if (number.length === 8) {
    // Landline: +55 (XX) XXXX-XXXX
    return `+55 (${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
  }

  return phone;
}

/**
 * Validates if a phone number is in canonical format
 * 
 * @param phone - Phone number to validate
 * @returns True if phone is normalized (55XXXXXXXXXXX digits only)
 */
export function isPhoneNormalized(phone: string | null | undefined): boolean {
  if (!phone) {
    return false;
  }

  // Must be digits only
  if (!/^\d+$/.test(phone)) {
    return false;
  }

  // Must start with 55
  if (!phone.startsWith('55')) {
    return false;
  }

  // Must be 12 or 13 digits total (55 + 10/11 digits)
  return phone.length === 12 || phone.length === 13;
}

/**
 * Builds a WhatsApp chat ID from a normalized phone number
 * 
 * CRITICAL: The input phone must already be normalized (55XXXXXXXXXXX format)
 * This function does NOT add an extra "55" prefix
 * 
 * @param normalizedPhone - Phone number in normalized format (55XXXXXXXXXXX)
 * @returns WhatsApp chat ID in format "whatsapp_55XXXXXXXXXXX"
 * 
 * @example
 * buildWhatsAppChatId('5524992504803') // Returns: "whatsapp_5524992504803"
 * buildWhatsAppChatId('555524992504803') // Throws error (duplicate 55)
 */
export function buildWhatsAppChatId(normalizedPhone: string): string {
  // Validate input is normalized
  if (!isPhoneNormalized(normalizedPhone)) {
    throw new Error(`buildWhatsAppChatId requires normalized phone (55XXXXXXXXXXX), got: "${normalizedPhone}"`);
  }
  
  // Simply prefix with "whatsapp_" - do NOT add extra "55"
  return `whatsapp_${normalizedPhone}`;
}

/**
 * Extracts Evolution API number/identifier from a WhatsApp chat ID or raw phone
 * 
 * CRITICAL CONTRACT: Uses EXPLICIT prefix detection only (NO heuristics)
 * - LIDs MUST have "lid_" or "whatsapp_lid_" prefix to be detected
 * - Raw inputs without prefix are treated as regular phones (bare format)
 * - This prevents misclassification of international phones (15+ digits) as LIDs
 * 
 * Evolution API Format Expectations:
 * - Regular phones: bare digits (e.g., "5524992504803")
 * - WhatsApp Business (LID): with @lid suffix (e.g., "145853079679217@lid")
 * - Groups: with @g.us suffix (e.g., "120363123456789@g.us")
 * 
 * @param chatIdOrPhone - Chat ID ("whatsapp_55XXX" or "whatsapp_lid_XXX") or raw phone/LID
 * @returns Number/ID string ready for Evolution API
 * 
 * @example
 * // Regular phones (12-13 digits)
 * extractNumberFromChatId('whatsapp_5524992504803') // Returns: '5524992504803'
 * extractNumberFromChatId('5524992504803') // Returns: '5524992504803'
 * 
 * // WhatsApp Business (LID) - REQUIRES explicit prefix
 * extractNumberFromChatId('whatsapp_lid_145853079679217') // Returns: '145853079679217@lid'
 * extractNumberFromChatId('lid_145853079679217') // Returns: '145853079679217@lid'
 * extractNumberFromChatId('145853079679217@lid') // Returns: '145853079679217@lid' (passthrough)
 * 
 * // International phones (15+ digits) - NOT misclassified as LID
 * extractNumberFromChatId('561833012345678') // Returns: '561833012345678' (bare phone, safe!)
 * 
 * // Groups
 * extractNumberFromChatId('whatsapp_120363@g.us') // Returns: '120363@g.us'
 * extractNumberFromChatId('120363@g.us') // Returns: '120363@g.us' (passthrough)
 */
export function extractNumberFromChatId(chatIdOrPhone: string): string {
  if (!chatIdOrPhone) {
    console.warn(`[Extract Number] Empty input`);
    return chatIdOrPhone;
  }
  
  // If it starts with "whatsapp_", extract the identifier
  if (chatIdOrPhone.startsWith('whatsapp_')) {
    const withoutPrefix = chatIdOrPhone.replace('whatsapp_', '');
    
    // Check if it's a LID (Business account)
    if (withoutPrefix.startsWith('lid_')) {
      // Extract LID and add @lid suffix for Evolution API
      const lid = withoutPrefix.replace('lid_', '');
      return `${lid}@lid`;
    }
    
    // If already has a suffix (@g.us, @s.whatsapp.net), return as-is
    if (withoutPrefix.includes('@')) {
      return withoutPrefix;
    }
    
    // Regular phone without suffix - return bare number for Evolution API
    return withoutPrefix;
  }
  
  // CRITICAL: For raw inputs (no whatsapp_ prefix), we need to detect LIDs carefully
  // We can safely detect:
  // 1. Inputs with "lid_" prefix (from parseRemoteJid's rawId field)
  // 2. Inputs already with @lid suffix
  
  // If already has a suffix (@lid, @s.whatsapp.net, @g.us), return as-is
  if (chatIdOrPhone.includes('@')) {
    return chatIdOrPhone;
  }
  
  // Check if it starts with "lid_" prefix (from parseRemoteJid)
  // This is the phoneNumber field passed to workers: "lid_145853079679217"
  if (chatIdOrPhone.startsWith('lid_')) {
    const lid = chatIdOrPhone.replace('lid_', '');
    console.log(`🏢 [Extract Number] Detected LID with prefix: "${chatIdOrPhone}" -> "${lid}@lid"`);
    return `${lid}@lid`;
  }
  
  // CRITICAL: For raw inputs WITHOUT prefix, we CANNOT reliably distinguish LID from phones
  // - International phones (e.g., 561833012345678) can have 15+ digits and look like LIDs
  // - Heuristics based on digit count or patterns are too fragile
  // 
  // SAFE APPROACH: Only treat as LID if explicitly prefixed with "lid_" or already has "@lid"
  // - All webhook inputs are processed via parseRemoteJid() which adds "lid_" prefix ✅
  // - All database records migrated to use "lid_" prefix ✅
  // - If raw LID number comes from legacy/manual source WITHOUT prefix, it will fail
  //   → This is SAFER than misclassifying international phones as LIDs
  
  console.log(`📱 [Extract Number] Raw phone number detected (no lid_ prefix): "${chatIdOrPhone}" - returning as-is (bare phone)`);
  return chatIdOrPhone;
}

/**
 * Result of parsing a WhatsApp remoteJid from Evolution API
 */
export interface ParsedRemoteJid {
  /** Type of WhatsApp ID */
  type: 'phone' | 'lid' | 'group';
  /** Original remoteJid from Evolution API */
  originalJid: string;
  /** Normalized phone (for type='phone') or null */
  normalizedPhone: string | null;
  /** WhatsApp chat ID for storage/routing */
  chatId: string;
  /** Display name suggestion */
  displayName: string;
  /** Raw identifier (phone, LID, or group ID) without suffix */
  rawId: string;
}

/**
 * Parses Evolution API remoteJid into structured format
 * Handles three formats:
 * - Regular phones: "5524992504803@s.whatsapp.net" 
 * - WhatsApp Business (LID): "145853079679217@lid"
 * - Groups: "120363123456789@g.us"
 * 
 * CRITICAL: Business accounts (@lid) use non-phone identifiers that CANNOT be normalized
 * These are stored as "whatsapp_lid_<id>" to preserve fidelity
 * 
 * @param remoteJid - Raw remoteJid from Evolution API webhook
 * @param pushName - Optional display name from Evolution API
 * @returns Parsed structure with chatId, type, and normalized phone (if applicable)
 * 
 * @example
 * parseRemoteJid('5524992504803@s.whatsapp.net', 'João')
 * // { type: 'phone', normalizedPhone: '5524992504803', chatId: 'whatsapp_5524992504803', ... }
 * 
 * parseRemoteJid('145853079679217@lid', 'Ana Business')
 * // { type: 'lid', normalizedPhone: null, chatId: 'whatsapp_lid_145853079679217', ... }
 * 
 * parseRemoteJid('120363123456789@g.us')
 * // { type: 'group', normalizedPhone: null, chatId: 'whatsapp_120363123456789@g.us', ... }
 */
export function parseRemoteJid(remoteJid: string, pushName?: string): ParsedRemoteJid {
  if (!remoteJid) {
    throw new Error('remoteJid is required');
  }

  // Detect type based on suffix
  if (remoteJid.endsWith('@g.us')) {
    // WhatsApp Group
    const rawId = remoteJid; // Keep full ID for groups
    return {
      type: 'group',
      originalJid: remoteJid,
      normalizedPhone: null,
      chatId: `whatsapp_${rawId}`,
      displayName: pushName || `Grupo ${rawId.slice(0, 8)}`,
      rawId,
    };
  }
  
  if (remoteJid.endsWith('@lid')) {
    // WhatsApp Business (Linked ID) - NOT a phone number
    // These are special identifiers that cannot be normalized as phones
    const lidNumber = remoteJid.replace('@lid', '');
    const lidChatId = `whatsapp_lid_${lidNumber}`;
    
    // CRITICAL: rawId must have "lid_" prefix so extractNumberFromChatId can detect it
    // and add "@lid" suffix when sending to Evolution API
    const rawId = `lid_${lidNumber}`;
    
    console.log(`🏢 [Parse RemoteJid] WhatsApp Business detected: "${remoteJid}" -> chatId: "${lidChatId}", rawId: "${rawId}"`);
    
    return {
      type: 'lid',
      originalJid: remoteJid,
      normalizedPhone: null,
      chatId: lidChatId,
      displayName: pushName || `Business ${lidNumber.slice(-4)}`,
      rawId,
    };
  }
  
  if (remoteJid.endsWith('@s.whatsapp.net')) {
    // Regular WhatsApp phone number
    const rawPhone = remoteJid.replace('@s.whatsapp.net', '');
    const normalized = normalizePhone(rawPhone);
    
    if (normalized) {
      const chatId = buildWhatsAppChatId(normalized);
      console.log(`📞 [Parse RemoteJid] Phone normalized: "${remoteJid}" -> "${normalized}" -> "${chatId}"`);
      
      return {
        type: 'phone',
        originalJid: remoteJid,
        normalizedPhone: normalized,
        chatId,
        displayName: pushName || `Cliente ${normalized.slice(-4)}`,
        rawId: rawPhone,
      };
    } else {
      // Normalization failed - treat as raw
      console.warn(`⚠️ [Parse RemoteJid] Failed to normalize phone "${rawPhone}" from "${remoteJid}"`);
      return {
        type: 'phone',
        originalJid: remoteJid,
        normalizedPhone: null,
        chatId: `whatsapp_${rawPhone}`,
        displayName: pushName || `Cliente ${rawPhone.slice(-4)}`,
        rawId: rawPhone,
      };
    }
  }
  
  // Unknown format - treat as raw
  console.warn(`⚠️ [Parse RemoteJid] Unknown format: "${remoteJid}" - using raw ID`);
  return {
    type: 'phone',
    originalJid: remoteJid,
    normalizedPhone: null,
    chatId: `whatsapp_${remoteJid}`,
    displayName: pushName || `Cliente ${remoteJid.slice(-4)}`,
    rawId: remoteJid,
  };
}
