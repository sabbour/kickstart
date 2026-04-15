import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readText(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

describe('azure auth boundary', () => {
  it('keeps the web workspace free of msal-browser', () => {
    const packageJson = JSON.parse(readText('../../package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies ?? {}).not.toHaveProperty('@azure/msal-browser');
    expect(packageJson.devDependencies ?? {}).not.toHaveProperty('@azure/msal-browser');
  });

  it('uses SWA session endpoints instead of browser-owned Azure token flow', () => {
    const source = readText('./azure-auth.ts');

    expect(source).toContain("fetch('/.auth/me'");
    expect(source).toContain("const AZURE_LOGIN_PATH = '/.auth/login/aad'");
    expect(source).toContain("const AZURE_LOGOUT_PATH = '/.auth/logout'");
    expect(source).not.toMatch(/@azure\/msal-browser/);
    expect(source).not.toMatch(/PublicClientApplication/);
    expect(source).not.toMatch(/acquireToken/i);
    expect(source).not.toMatch(/loginPopup/);
    expect(source).not.toMatch(/handleRedirectPromise/);
    expect(source).not.toMatch(/setTokenProvider/);
    expect(source).not.toMatch(/Authorization/i);
  });

  it('limits browser-side Azure access to first-party api routes', () => {
    const resourceSource = readText('./azure-resources.ts');
    const deploymentSource = readText('./azure-deployments.ts');

    expect(resourceSource).toContain("apiFetch('/api/azure/subscriptions')");
    expect(resourceSource).toContain('apiFetch(`/api/azure/resource-groups?${query.toString()}`)');
    expect(resourceSource).toContain('apiFetch(`/api/azure/locations?${query.toString()}`)');
    expect(resourceSource).not.toMatch(/Authorization/i);

    expect(deploymentSource).toContain("apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/azure-target`");
    expect(deploymentSource).toContain("apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/azure-deployments`");
    expect(deploymentSource).toContain("apiFetch(`/api/azure-deployments/${encodeURIComponent(runId)}`)");
    expect(deploymentSource).not.toMatch(/Authorization/i);
  });
});
