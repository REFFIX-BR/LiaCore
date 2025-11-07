import twilio from 'twilio';

interface TwilioCredentials {
  accountSid: string;
  apiKey: string;
  apiKeySecret: string;
  phoneNumber: string;
}

let connectionSettings: any;

async function getCredentials(): Promise<TwilioCredentials> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
    throw new Error('Twilio not connected - please configure the Twilio integration in Replit');
  }
  
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

export async function validateTwilioConnection(): Promise<{ valid: boolean; error?: string; details?: any }> {
  try {
    const client = await getTwilioClient();
    const phoneNumber = await getTwilioFromPhoneNumber();
    
    const account = await client.api.accounts(client.accountSid).fetch();
    
    return {
      valid: true,
      details: {
        accountSid: account.sid,
        accountStatus: account.status,
        phoneNumber: phoneNumber,
        accountFriendlyName: account.friendlyName
      }
    };
  } catch (error: any) {
    console.error('❌ [Twilio Integration] Validation failed:', error.message);
    return {
      valid: false,
      error: error.message
    };
  }
}
