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
