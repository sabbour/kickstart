import { describe, it, expect } from 'vitest';

/**
 * what-if URL construction tests.
 *
 * The what-if endpoint path differs for resource-group scope vs subscription scope.
 * Both use the same URL template since `safePath` encodes the full scope prefix,
 * but the subscription-scoped call adds `$expand=resourceChanges` for richer output.
 */

const ARM_BASE_URL = 'https://management.azure.com';

function buildWhatIfUrl(safePath: string, deploymentName: string): string {
  const isRgScope = safePath.toLowerCase().includes('/resourcegroups/');
  return isRgScope
    ? `${ARM_BASE_URL}${safePath}/providers/Microsoft.Resources/deployments/${deploymentName}/whatIf?api-version=2021-04-01`
    : `${ARM_BASE_URL}${safePath}/providers/Microsoft.Resources/deployments/${deploymentName}/whatIf?api-version=2021-04-01&%24expand=resourceChanges`;
}

const SUB_ID = '00000000-0000-0000-0000-000000000000';
const RG_SCOPE = `/subscriptions/${SUB_ID}/resourceGroups/my-rg`;
const SUB_SCOPE = `/subscriptions/${SUB_ID}`;
const DEPLOYMENT = 'test-deployment';

describe('what-if URL construction', () => {
  it('resource-group scope path includes resourceGroups segment', () => {
    const url = buildWhatIfUrl(RG_SCOPE, DEPLOYMENT);
    expect(url).toContain('/resourceGroups/my-rg/providers/Microsoft.Resources/deployments/');
    expect(url).toContain('/whatIf?api-version=2021-04-01');
  });

  it('subscription scope path does NOT include resourceGroups segment', () => {
    const url = buildWhatIfUrl(SUB_SCOPE, DEPLOYMENT);
    expect(url).not.toContain('/resourceGroups/');
    expect(url).toContain(`/subscriptions/${SUB_ID}/providers/Microsoft.Resources/deployments/`);
  });

  it('resource-group scope and subscription scope produce different URLs', () => {
    const rgUrl = buildWhatIfUrl(RG_SCOPE, DEPLOYMENT);
    const subUrl = buildWhatIfUrl(SUB_SCOPE, DEPLOYMENT);
    expect(rgUrl).not.toBe(subUrl);
  });

  it('subscription scope URL includes $expand=resourceChanges', () => {
    const url = buildWhatIfUrl(SUB_SCOPE, DEPLOYMENT);
    expect(url).toContain('expand=resourceChanges');
  });

  it('resource-group scope URL does not include $expand', () => {
    const url = buildWhatIfUrl(RG_SCOPE, DEPLOYMENT);
    expect(url).not.toContain('expand');
  });

  it('both scope URLs include deployment name', () => {
    const rgUrl = buildWhatIfUrl(RG_SCOPE, DEPLOYMENT);
    const subUrl = buildWhatIfUrl(SUB_SCOPE, DEPLOYMENT);
    expect(rgUrl).toContain(`/deployments/${DEPLOYMENT}/`);
    expect(subUrl).toContain(`/deployments/${DEPLOYMENT}/`);
  });
});
