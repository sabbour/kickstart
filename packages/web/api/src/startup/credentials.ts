/**
 * Centralized credential loading and validation for startup.
 * 
 * Loads Azure OpenAI and Azure Auth credentials from environment variables,
 * validates completeness, and logs non-secret diagnostic information.
 * 
 * Called once at application startup (in getRegistry) to fail fast if
 * credentials are misconfigured.
 */

export interface AzureOpenAICredentials {
  endpoint: string;
  apiKey: string;
  chatDeployment: string;
  codexDeployment: string;
}

export interface AzureAuthCredentials {
  clientId: string;
  tenantId: string;
  clientSecret: string | null;
}

export interface CredentialConfig {
  openai: AzureOpenAICredentials | null;
  auth: AzureAuthCredentials | null;
  provider: 'azure-openai' | 'standard-openai' | 'none';
}

/**
 * Load and validate Azure OpenAI credentials.
 * Returns null if not configured (allows fallback to standard OpenAI).
 * Logs validation steps.
 */
function loadAzureOpenAICredentials(): AzureOpenAICredentials | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const chatDeployment = process.env.KICKSTART_CHAT_MODEL?.trim();
  const codexDeployment = process.env.KICKSTART_CODEX_MODEL?.trim();

  console.log('[startup:credentials] Checking Azure OpenAI configuration...');

  if (endpoint) {
    console.log('[startup:credentials] ✓ AZURE_OPENAI_ENDPOINT configured');
  } else {
    console.log('[startup:credentials] ✗ AZURE_OPENAI_ENDPOINT not set');
  }

  if (apiKey) {
    console.log('[startup:credentials] ✓ AZURE_OPENAI_API_KEY configured');
  } else {
    console.log('[startup:credentials] ✗ AZURE_OPENAI_API_KEY not set');
  }

  if (chatDeployment) {
    console.log(`[startup:credentials] ✓ KICKSTART_CHAT_MODEL="${chatDeployment}"`);
  } else {
    console.log('[startup:credentials] ℹ KICKSTART_CHAT_MODEL not set (optional if KICKSTART_CODEX_MODEL set)');
  }

  if (codexDeployment) {
    console.log(`[startup:credentials] ✓ KICKSTART_CODEX_MODEL="${codexDeployment}"`);
  } else {
    console.log('[startup:credentials] ℹ KICKSTART_CODEX_MODEL not set (optional if KICKSTART_CHAT_MODEL set)');
  }

  const hasDeployment = !!(chatDeployment || codexDeployment);

  if (!endpoint || !apiKey || !hasDeployment) {
    console.log('[startup:credentials] Azure OpenAI: incomplete configuration');
    return null;
  }

  console.log('[startup:credentials] Azure OpenAI: ✓ all required fields configured');

  return {
    endpoint,
    apiKey,
    chatDeployment: chatDeployment || '',
    codexDeployment: codexDeployment || '',
  };
}

/**
 * Load and validate Azure Auth credentials.
 * Returns null if not configured (allows anonymous/user-token-only flow).
 * Logs validation steps.
 */
function loadAzureAuthCredentials(): AzureAuthCredentials | null {
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const tenantId = process.env.AZURE_TENANT_ID?.trim();
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();

  console.log('[startup:credentials] Checking Azure authentication configuration...');

  if (clientId) {
    console.log('[startup:credentials] ✓ AZURE_CLIENT_ID configured');
  } else {
    console.log('[startup:credentials] ✗ AZURE_CLIENT_ID not set');
  }

  if (tenantId) {
    console.log('[startup:credentials] ✓ AZURE_TENANT_ID configured');
  } else {
    console.log('[startup:credentials] ✗ AZURE_TENANT_ID not set');
  }

  if (clientSecret) {
    console.log('[startup:credentials] ✓ AZURE_CLIENT_SECRET configured');
  } else {
    console.log('[startup:credentials] ℹ AZURE_CLIENT_SECRET not set (optional for user token flow)');
  }

  if (!clientId || !tenantId) {
    console.log('[startup:credentials] Azure authentication: incomplete configuration');
    return null;
  }

  console.log('[startup:credentials] Azure authentication: ✓ all required fields configured');

  return {
    clientId,
    tenantId,
    clientSecret: clientSecret || null,
  };
}

/**
 * Load and validate all credentials at startup.
 * 
 * Throws with clear error message if critical configs are missing.
 * Returns validated config object with provider selection.
 * 
 * Called once by getRegistry() before registering packs.
 */
export function loadAndValidateCredentials(): CredentialConfig {
  console.log('[startup:credentials] === Credential Validation Start ===');

  const openai = loadAzureOpenAICredentials();
  const auth = loadAzureAuthCredentials();

  // Determine provider
  let provider: 'azure-openai' | 'standard-openai' | 'none' = 'none';

  if (openai) {
    console.log('[startup:credentials] LLM Provider: azure-openai (from AZURE_OPENAI_* env vars)');
    provider = 'azure-openai';
  } else {
    // Check if standard OpenAI is configured as fallback
    const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiApiKey) {
      console.log('[startup:credentials] LLM Provider: standard-openai (OPENAI_API_KEY set, AZURE_OPENAI_* not fully configured)');
      provider = 'standard-openai';
    } else {
      console.log('[startup:credentials] LLM Provider: none (neither Azure nor standard OpenAI configured)');
      provider = 'none';
    }
  }

  // Validate that at least one provider is available
  if (provider === 'none') {
    const error = new Error(
      'No LLM provider configured. Please set either:\n' +
      '  1. Azure OpenAI (required): AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and one of KICKSTART_CHAT_MODEL or KICKSTART_CODEX_MODEL\n' +
      '  2. Standard OpenAI (fallback): OPENAI_API_KEY\n' +
      '\nFor Azure deployments, see local.settings.json'
    );
    console.error(`[startup:credentials] ERROR: ${error.message}`);
    throw error;
  }

  console.log('[startup:credentials] === Credential Validation Complete ===');
  return {
    openai,
    auth,
    provider,
  };
}

/**
 * Cache the loaded config singleton for the lifetime of the process.
 */
let _config: CredentialConfig | null = null;
let _loadError: Error | null = null;

/**
 * Get the cached credential config, loading and validating on first call.
 * Throws if validation failed on a previous call.
 */
export function getCredentialConfig(): CredentialConfig {
  if (_loadError) {
    throw _loadError;
  }

  if (!_config) {
    try {
      _config = loadAndValidateCredentials();
    } catch (err) {
      _loadError = err instanceof Error ? err : new Error(String(err));
      throw _loadError;
    }
  }

  return _config;
}
