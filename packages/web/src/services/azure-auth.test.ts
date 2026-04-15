import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAzureSession, getAzureSignInUrl } from './azure-auth';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });
}

describe('azure-auth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('reads the current SWA Azure session and enriches it with subscription data when available', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        clientPrincipal: {
          identityProvider: 'aad',
          userDetails: 'fry@example.com',
          userClaims: [
            { typ: 'name', val: 'Philip J. Fry' },
            { typ: 'tid', val: 'tenant-123' },
          ],
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        subscriptions: [
          {
            subscriptionId: 'sub-123',
            displayName: 'Demo Subscription',
            state: 'Enabled',
            tenantId: 'tenant-123',
          },
        ],
      }));

    await expect(getAzureSession()).resolves.toEqual({
      configured: true,
      authenticated: true,
      user: {
        name: 'Philip J. Fry',
        username: 'fry@example.com',
        tenantId: 'tenant-123',
      },
      subscriptions: [
        {
          subscriptionId: 'sub-123',
          displayName: 'Demo Subscription',
          state: 'Enabled',
          tenantId: 'tenant-123',
        },
      ],
    });
  });

  it('keeps the SWA Azure session authenticated when backend subscription discovery is unavailable', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        clientPrincipal: {
          identityProvider: 'aad',
          userDetails: 'fry@example.com',
          userClaims: [
            { typ: 'name', val: 'Philip J. Fry' },
          ],
        },
      }))
      .mockResolvedValueOnce(new Response('not found', { status: 404 }));

    await expect(getAzureSession()).resolves.toMatchObject({
      configured: true,
      authenticated: true,
      user: {
        name: 'Philip J. Fry',
        username: 'fry@example.com',
      },
      subscriptions: [],
    });
  });

  it('builds the SWA Azure login URL from the current route', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          pathname: '/chat',
          search: '?session=301',
          hash: '#azure-auth',
          origin: 'https://kickstart.example',
        },
      },
    });

    expect(getAzureSignInUrl()).toBe('/.auth/login/aad?post_login_redirect_uri=%2Fchat%3Fsession%3D301%23azure-auth');
  });
});
