/**
 * Evolution API Diagnostics and Validation
 * 
 * Validates credentials and connectivity for all Evolution API instances
 */

interface EvolutionInstanceConfig {
  name: string;
  apiKey: string | undefined;
  required: boolean;
}

export async function validateEvolutionCredentials(): Promise<boolean> {
  console.log('🔍 [Evolution] Validating API credentials...');
  
  const instances: EvolutionInstanceConfig[] = [
    {
      name: 'Principal',
      apiKey: process.env.EVOLUTION_API_KEY_PRINCIPAL || process.env.EVOLUTION_API_KEY,
      required: true,
    },
    {
      name: 'Leads',
      apiKey: process.env.EVOLUTION_API_KEY_LEADS,
      required: false, // Optional instance
    },
    {
      name: 'Cobranca',
      apiKey: process.env.EVOLUTION_API_KEY_COBRANCA,
      required: true, // CRITICAL for collections module
    },
  ];

  const evolutionApiUrl = process.env.EVOLUTION_API_URL;
  
  if (!evolutionApiUrl) {
    console.error('❌ [Evolution] EVOLUTION_API_URL not configured');
    return false;
  }

  // Normalize URL
  let baseUrl = evolutionApiUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }

  let hasErrors = false;

  // Step 1: Check if API keys are configured
  for (const instance of instances) {
    if (!instance.apiKey) {
      if (instance.required) {
        console.error(`❌ [Evolution] CRITICAL: EVOLUTION_API_KEY_${instance.name.toUpperCase()} not configured`);
        hasErrors = true;
      } else {
        console.warn(`⚠️  [Evolution] Optional: EVOLUTION_API_KEY_${instance.name.toUpperCase()} not configured`);
      }
    } else {
      console.log(`✅ [Evolution] ${instance.name}: API key configured (${instance.apiKey.substring(0, 8)}...)`);
    }
  }

  if (hasErrors) {
    console.error('❌ [Evolution] Credential validation FAILED - missing required API keys');
    return false;
  }

  // Step 2: Test connectivity for REQUIRED instances only (boot-time optimization)
  console.log('🔍 [Evolution] Testing connectivity for required instances...');
  
  const requiredInstances = instances.filter(i => i.required && i.apiKey);
  
  for (const instance of requiredInstances) {
    try {
      const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': instance.apiKey!,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`❌ [Evolution] ${instance.name}: HTTP ${response.status} ${response.statusText}`);
        
        if (response.status === 401) {
          console.error(`   💡 API key is incorrect, expired, or lacks permissions`);
        } else if (response.status === 404) {
          console.error(`   💡 Instance "${instance.name}" may not exist in Evolution API`);
        }
        
        hasErrors = true;
      } else {
        // CRITICAL: Verify instance actually exists in the response payload
        const data = await response.json();
        const instances = Array.isArray(data) ? data : [];
        const instanceExists = instances.some((i: any) => 
          i.name === instance.name || 
          i.instanceName === instance.name || 
          i.instance?.instanceName === instance.name
        );
        
        if (!instanceExists) {
          console.error(`❌ [Evolution] ${instance.name}: Instance NOT FOUND in Evolution API`);
          console.error(`   API key is valid, but instance "${instance.name}" doesn't exist`);
          console.error(`   Available instances: ${instances.map((i: any) => i.name || i.instanceName || i.instance?.instanceName).filter(Boolean).join(', ') || 'none'}`);
          hasErrors = true;
        } else {
          console.log(`✅ [Evolution] ${instance.name}: Connectivity OK and instance exists`);
        }
      }
    } catch (error: any) {
      console.error(`❌ [Evolution] ${instance.name}: Connection failed - ${error.message}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('❌ [Evolution] Credential validation FAILED - connectivity issues detected');
    console.error('   Run `tsx scripts/test-evolution-connectivity.ts` for detailed diagnostics');
    return false;
  }

  console.log('✅ [Evolution] All required credentials validated successfully');
  return true;
}

export async function testEvolutionConnectivity(): Promise<void> {
  console.log('\n🧪 [Evolution Test] Starting connectivity test...\n');
  
  const instances = [
    { name: 'Principal', apiKey: process.env.EVOLUTION_API_KEY_PRINCIPAL || process.env.EVOLUTION_API_KEY },
    { name: 'Leads', apiKey: process.env.EVOLUTION_API_KEY_LEADS },
    { name: 'Cobranca', apiKey: process.env.EVOLUTION_API_KEY_COBRANCA },
  ];

  const evolutionApiUrl = process.env.EVOLUTION_API_URL;
  
  if (!evolutionApiUrl) {
    console.error('❌ [Evolution Test] EVOLUTION_API_URL not configured');
    return;
  }

  // Normalize URL
  let baseUrl = evolutionApiUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }

  console.log(`📡 [Evolution Test] Base URL: ${baseUrl}\n`);

  for (const instance of instances) {
    if (!instance.apiKey) {
      console.log(`⏭️  [Evolution Test] Skipping ${instance.name} (no API key)\n`);
      continue;
    }

    console.log(`🔍 [Evolution Test] Testing instance: ${instance.name}`);
    console.log(`   API Key: ${instance.apiKey.substring(0, 8)}...`);

    try {
      // Test 1: Instance info endpoint
      const infoUrl = `${baseUrl}/instance/fetchInstances`;
      console.log(`   Testing: GET ${infoUrl}`);

      const response = await fetch(infoUrl, {
        method: 'GET',
        headers: {
          'apikey': instance.apiKey,
          'Content-Type': 'application/json',
        },
      });

      console.log(`   Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`   ❌ FAILED: ${errorText.substring(0, 200)}`);
        
        if (response.status === 401) {
          console.error(`   💡 Possible causes:`);
          console.error(`      - API key is incorrect or expired`);
          console.error(`      - Instance "${instance.name}" doesn't exist in Evolution API`);
          console.error(`      - API key doesn't have permission for this instance`);
        }
      } else {
        const data = await response.json();
        console.log(`   ✅ SUCCESS: Connected to Evolution API`);
        
        // Check if this specific instance exists
        const instanceData = Array.isArray(data) ? data.find((i: any) => i.name === instance.name || i.instanceName === instance.name) : null;
        if (instanceData) {
          console.log(`   ✅ Instance "${instance.name}" exists and is active`);
          console.log(`      Status: ${instanceData.connectionStatus || instanceData.status || 'unknown'}`);
        } else {
          console.warn(`   ⚠️  Instance "${instance.name}" not found in response`);
          console.warn(`      Available instances: ${Array.isArray(data) ? data.map((i: any) => i.name || i.instanceName).join(', ') : 'none'}`);
        }
      }
    } catch (error: any) {
      console.error(`   ❌ FAILED: ${error.message}`);
      console.error(`   💡 Check network connectivity and Evolution API URL`);
    }

    console.log(''); // Empty line for readability
  }

  console.log('🧪 [Evolution Test] Connectivity test completed\n');
}
