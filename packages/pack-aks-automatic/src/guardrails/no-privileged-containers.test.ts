import { describe, it, expect } from 'vitest';
import { noPrivilegedContainersGuardrail } from './no-privileged-containers.js';

const BASE = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
spec:
  template:
    spec:
      containers:
        - name: app
          image: myacr.azurecr.io/app:1.0.0
`;

function makePayload(securityContextYaml: string) {
  return {
    parameters: {
      content: BASE + securityContextYaml,
    },
  };
}

describe('no-privileged-containers guardrail', () => {
  it('passes a clean manifest with no security issues', async () => {
    const result = await noPrivilegedContainersGuardrail.check(
      {} as never,
      makePayload('')
    );
    expect(result.kind).toBe('pass');
  });

  it('blocks container with privileged: true', async () => {
    const result = await noPrivilegedContainersGuardrail.check(
      {} as never,
      makePayload('          securityContext:\n            privileged: true\n')
    );
    expect(result.kind).toBe('block');
    expect((result as { reason: string }).reason).toMatch(/privileged/i);
  });

  it('blocks container with allowPrivilegeEscalation: true', async () => {
    const result = await noPrivilegedContainersGuardrail.check(
      {} as never,
      makePayload('          securityContext:\n            allowPrivilegeEscalation: true\n')
    );
    expect(result.kind).toBe('block');
    expect((result as { reason: string }).reason).toMatch(/allowPrivilegeEscalation/);
  });

  it('blocks container with SYS_ADMIN capability', async () => {
    const result = await noPrivilegedContainersGuardrail.check(
      {} as never,
      makePayload(
        '          securityContext:\n            capabilities:\n              add:\n                - SYS_ADMIN\n'
      )
    );
    expect(result.kind).toBe('block');
    expect((result as { reason: string }).reason).toMatch(/SYS_ADMIN/);
  });

  it('blocks container with NET_ADMIN capability', async () => {
    const result = await noPrivilegedContainersGuardrail.check(
      {} as never,
      makePayload(
        '          securityContext:\n            capabilities:\n              add:\n                - NET_ADMIN\n'
      )
    );
    expect(result.kind).toBe('block');
    expect((result as { reason: string }).reason).toMatch(/NET_ADMIN/);
  });

  it('blocks container with ALL capabilities', async () => {
    const result = await noPrivilegedContainersGuardrail.check(
      {} as never,
      makePayload(
        '          securityContext:\n            capabilities:\n              add:\n                - ALL\n'
      )
    );
    expect(result.kind).toBe('block');
    expect((result as { reason: string }).reason).toMatch(/ALL/);
  });

  it('allows container with only safe read capabilities (NET_BIND_SERVICE)', async () => {
    const result = await noPrivilegedContainersGuardrail.check(
      {} as never,
      makePayload(
        '          securityContext:\n            capabilities:\n              add:\n                - NET_BIND_SERVICE\n'
      )
    );
    expect(result.kind).toBe('pass');
  });

  it('passes non-kubernetes content without blocking', async () => {
    const result = await noPrivilegedContainersGuardrail.check(
      {} as never,
      { parameters: { content: 'console.log("hello")' } }
    );
    expect(result.kind).toBe('pass');
  });
});
