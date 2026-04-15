import { describe, expect, it } from 'vitest';
import {
  sanitizeAzureDeploymentErrorMessage,
  sanitizeAzureDeploymentStatusMessage,
  sanitizeAzureDeploymentStepDetail,
  sanitizeAzureExternalUrl,
  sanitizeAzureUiErrorMessage,
} from '../utils/azure-ui-safety';

describe('azure-ui-safety', () => {
  it('maps raw Azure permission errors to safe deployment copy', () => {
    expect(
      sanitizeAzureDeploymentErrorMessage(
        'AuthorizationFailed',
        "The client 'abc' with object id '123' does not have authorization to perform action 'Microsoft.ContainerService/managedClusters/write'.",
      ),
    ).toBe('Azure rejected the deployment permissions for this session. Reconnect Azure or confirm access to the target subscription.');
  });

  it('drops raw deployment status payload text in favor of safe copy', () => {
    expect(
      sanitizeAzureDeploymentStatusMessage(
        '{"stderr":"deployment failed","requestId":"123"}',
        'running',
      ),
    ).toBe('Azure deployment is in progress.');
  });

  it('strips unsafe step detail content', () => {
    expect(
      sanitizeAzureDeploymentStepDetail(
        'stderr: kubectl apply failed\nat deployCluster (/app/dist/index.js:42:5)',
      ),
    ).toBeUndefined();
  });

  it('rejects non-http Azure deployment URLs', () => {
    expect(sanitizeAzureExternalUrl('javascript:alert(1)', 'app')).toBeUndefined();
    expect(sanitizeAzureExternalUrl('https://portal.azure.com/#view/HubsExtension/BrowseResource', 'portal')).toBe(
      'https://portal.azure.com/#view/HubsExtension/BrowseResource',
    );
  });

  it('sanitizes Azure sign-in errors instead of surfacing raw auth diagnostics', () => {
    expect(
      sanitizeAzureUiErrorMessage(
        new Error('AADSTS65001: The user or administrator has not consented to use the application. Correlation ID: 123'),
        'auth-signin',
      ),
    ).toBe('Azure sign-in needs additional permissions before Kickstart can continue.');
  });
});
