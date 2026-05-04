/**
 * Tests for credential loading and validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAndValidateCredentials } from './credentials.js';

// Save original env vars
const originalEnv = { ...process.env };

function resetEnv() {
  // Clear all credential-related env vars
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.KICKSTART_CHAT_MODEL;
  delete process.env.KICKSTART_CODEX_MODEL;
  delete process.env.AZURE_CLIENT_ID;
  delete process.env.AZURE_TENANT_ID;
  delete process.env.AZURE_CLIENT_SECRET;
  delete process.env.OPENAI_API_KEY;
}

function restoreEnv() {
  Object.assign(process.env, originalEnv);
  resetEnv();
  // Restore original values
  for (const [key, val] of Object.entries(originalEnv)) {
    if (key.includes('AZURE') || key.includes('KICKSTART') || key === 'OPENAI_API_KEY') {
      if (val !== undefined) process.env[key] = val;
    }
  }
}

describe('credentials', () => {
  beforeEach(() => {
    resetEnv();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
  });

  describe('Azure OpenAI + Azure Auth fully configured', () => {
    it('should return valid config with azure-openai provider', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.KICKSTART_CHAT_MODEL = 'gpt-5.4-mini';
      process.env.AZURE_CLIENT_ID = 'test-id';
      process.env.AZURE_TENANT_ID = 'test-tenant';

      const config = loadAndValidateCredentials();

      expect(config.provider).toBe('azure-openai');
      expect(config.openai).not.toBeNull();
      expect(config.openai!.endpoint).toBe('https://test.openai.azure.com/');
      expect(config.openai!.chatDeployment).toBe('gpt-5.4-mini');
      expect(config.auth).not.toBeNull();
      expect(config.auth!.clientId).toBe('test-id');
    });
  });

  describe('Endpoint URL validation', () => {
    it('should throw if AZURE_OPENAI_ENDPOINT is not a valid URL', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'not-a-valid-url';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.KICKSTART_CHAT_MODEL = 'gpt-5.4-mini';

      expect(() => loadAndValidateCredentials()).toThrow(/not a valid URL/);
    });

    it('should accept valid HTTPS endpoints', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://my-resource.openai.azure.com';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.KICKSTART_CHAT_MODEL = 'gpt-5.4-mini';

      const config = loadAndValidateCredentials();
      expect(config.provider).toBe('azure-openai');
    });

    it('should accept endpoints with trailing slashes', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://my-resource.openai.azure.com/';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.KICKSTART_CHAT_MODEL = 'gpt-5.4-mini';

      const config = loadAndValidateCredentials();
      expect(config.provider).toBe('azure-openai');
    });
  });

  describe('Azure OpenAI with codex only', () => {
    it('should accept KICKSTART_CODEX_MODEL without KICKSTART_CHAT_MODEL', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.KICKSTART_CODEX_MODEL = 'gpt-5.4';

      const config = loadAndValidateCredentials();

      expect(config.provider).toBe('azure-openai');
      expect(config.openai).not.toBeNull();
      expect(config.openai!.codexDeployment).toBe('gpt-5.4');
      expect(config.openai!.chatDeployment).toBe('');
    });
  });

  describe('Azure OpenAI missing required fields', () => {
    it('should throw if endpoint is missing', () => {
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.KICKSTART_CHAT_MODEL = 'gpt-5.4-mini';

      expect(() => loadAndValidateCredentials()).toThrow('No LLM provider configured');
    });

    it('should throw if apiKey is missing', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
      process.env.KICKSTART_CHAT_MODEL = 'gpt-5.4-mini';

      expect(() => loadAndValidateCredentials()).toThrow('No LLM provider configured');
    });

    it('should throw if no deployments are configured', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';

      expect(() => loadAndValidateCredentials()).toThrow('No LLM provider configured');
    });
  });

  describe('Standard OpenAI fallback', () => {
    it('should use standard-openai if Azure OpenAI not configured but OPENAI_API_KEY set', () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const config = loadAndValidateCredentials();

      expect(config.provider).toBe('standard-openai');
      expect(config.openai).toBeNull();
    });
  });

  describe('Azure Auth optional (can be omitted)', () => {
    it('should allow Azure OpenAI without Azure Auth', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.KICKSTART_CHAT_MODEL = 'gpt-5.4-mini';

      const config = loadAndValidateCredentials();

      expect(config.provider).toBe('azure-openai');
      expect(config.openai).not.toBeNull();
      expect(config.auth).toBeNull();
    });

    it('should allow Azure Auth without clientSecret', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.KICKSTART_CHAT_MODEL = 'gpt-5.4-mini';
      process.env.AZURE_CLIENT_ID = 'test-id';
      process.env.AZURE_TENANT_ID = 'test-tenant';

      const config = loadAndValidateCredentials();

      expect(config.auth).not.toBeNull();
      expect(config.auth!.clientSecret).toBeNull();
    });
  });

  describe('No credentials at all', () => {
    it('should throw with helpful error message', () => {
      expect(() => loadAndValidateCredentials()).toThrow(
        /No LLM provider configured/
      );
    });

    it('error should mention AZURE_OPENAI configuration', () => {
      try {
        loadAndValidateCredentials();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(String(err)).toContain('AZURE_OPENAI');
      }
    });
  });

  describe('Whitespace handling', () => {
    it('should trim whitespace from env var values', () => {
      process.env.AZURE_OPENAI_ENDPOINT = '  https://test.openai.azure.com/  ';
      process.env.AZURE_OPENAI_API_KEY = '  test-key  ';
      process.env.KICKSTART_CHAT_MODEL = '  gpt-5.4-mini  ';

      const config = loadAndValidateCredentials();

      expect(config.openai!.endpoint).toBe('https://test.openai.azure.com/');
      expect(config.openai!.chatDeployment).toBe('gpt-5.4-mini');
    });
  });
});
