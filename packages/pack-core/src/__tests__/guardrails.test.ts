/**
 * Pack-core guardrail tests — Step 11.
 *
 * Tests the real implementations (no mocks) for:
 *   token-budget          — input stage
 *   no-pii-in-logs        — output + tool stages (redact)
 *   no-secrets-in-artifacts — tool stage (block)
 *   no-credential-leak    — all 3 stages (always block)
 */

import { describe, it, expect } from 'vitest';
import { tokenBudgetGuardrail } from '../guardrails/token_budget.js';
import { noPiiInLogsGuardrail } from '../guardrails/no_pii_in_logs.js';
import { noSecretsInArtifactsGuardrail } from '../guardrails/no_secrets_in_artifacts.js';
import { noCredentialLeakGuardrail } from '../guardrails/no-credential-leak.js';
import type { GuardrailInput } from '@aks-kickstart/harness';

// ── token-budget ─────────────────────────────────────────────────────────────

describe('token-budget guardrail', () => {
  it('has correct id and stages', () => {
    expect(tokenBudgetGuardrail.id).toBe('core/token-budget');
    expect(tokenBudgetGuardrail.stages).toContain('input');
  });

  it('passes when no token budget exceeded', async () => {
    const result = await tokenBudgetGuardrail.evaluate({ stage: 'input', userMessage: 'hello' });
    expect(result.verdict).toBe('pass');
  });
});

// ── no-pii-in-logs ───────────────────────────────────────────────────────────

describe('no-pii-in-logs guardrail', () => {
  it('has correct id and stages', () => {
    expect(noPiiInLogsGuardrail.id).toBe('core/no-pii-in-logs');
    expect(noPiiInLogsGuardrail.stages).toContain('output');
    expect(noPiiInLogsGuardrail.stages).toContain('tool');
  });

  it('passes clean output', async () => {
    const result = await noPiiInLogsGuardrail.evaluate({
      stage: 'output',
      proposedOutput: 'Deployment successful for my-app',
    });
    expect(result.verdict).toBe('pass');
  });

  it('redacts email from output', async () => {
    const result = await noPiiInLogsGuardrail.evaluate({
      stage: 'output',
      proposedOutput: 'Contact user@example.com for details',
    });
    expect(result.verdict).toBe('redact');
    expect(result.redacted as string).toContain('[REDACTED-EMAIL]');
    expect(result.redacted as string).not.toContain('user@example.com');
  });

  it('redacts SSN from output', async () => {
    const result = await noPiiInLogsGuardrail.evaluate({
      stage: 'output',
      proposedOutput: 'SSN 123-45-6789',
    });
    expect(result.verdict).toBe('redact');
    expect(result.redacted as string).toContain('[REDACTED-SSN]');
  });

  it('redacts phone number from output', async () => {
    const result = await noPiiInLogsGuardrail.evaluate({
      stage: 'output',
      proposedOutput: 'Call 555-123-4567 for support',
    });
    expect(result.verdict).toBe('redact');
    expect(result.redacted as string).toContain('[REDACTED-PHONE]');
  });

  it('passes on tool stage without PII', async () => {
    const result = await noPiiInLogsGuardrail.evaluate({
      stage: 'tool',
      toolName: 'core.write_file',
      toolArgs: { content: 'clean content', path: 'output.txt' },
    });
    expect(result.verdict).toBe('pass');
  });
});

// ── no-secrets-in-artifacts ──────────────────────────────────────────────────

describe('no-secrets-in-artifacts guardrail', () => {
  it('has correct id and stages', () => {
    expect(noSecretsInArtifactsGuardrail.id).toBe('core/no-secrets-in-artifacts');
    expect(noSecretsInArtifactsGuardrail.stages).toContain('tool');
  });

  it('passes non-write_file tools', async () => {
    const result = await noSecretsInArtifactsGuardrail.evaluate({
      stage: 'tool',
      toolName: 'core.read_file',
      toolArgs: { path: 'file.txt' },
    });
    expect(result.verdict).toBe('pass');
  });

  it('blocks write with GitHub PAT', async () => {
    const result = await noSecretsInArtifactsGuardrail.evaluate({
      stage: 'tool',
      toolName: 'core.write_file',
      toolArgs: { content: 'token: ghp_abcdefghijklmnopqrstuvwxyz123456789', path: 'config.yaml' },
    });
    expect(result.verdict).toBe('block');
  });

  it('blocks write with private key', async () => {
    const result = await noSecretsInArtifactsGuardrail.evaluate({
      stage: 'tool',
      toolName: 'core.write_file',
      toolArgs: { content: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...', path: 'key.pem' },
    });
    expect(result.verdict).toBe('block');
  });

  it('passes clean file write', async () => {
    const result = await noSecretsInArtifactsGuardrail.evaluate({
      stage: 'tool',
      toolName: 'core.write_file',
      toolArgs: { content: 'name: myapp\nversion: 1.0.0', path: 'package.yaml' },
    });
    expect(result.verdict).toBe('pass');
  });
});

// ── no-credential-leak ────────────────────────────────────────────────────────

describe('no-credential-leak guardrail', () => {
  it('has correct id and all 3 stages', () => {
    expect(noCredentialLeakGuardrail.id).toBe('core/no-credential-leak');
    expect(noCredentialLeakGuardrail.stages).toContain('input');
    expect(noCredentialLeakGuardrail.stages).toContain('output');
    expect(noCredentialLeakGuardrail.stages).toContain('tool');
  });

  it('blocks input stage with GitHub PAT', async () => {
    const result = await noCredentialLeakGuardrail.evaluate({
      stage: 'input',
      userMessage: 'my token is ghp_abcdefghijklmnopqrstuvwxyz1234567',
    });
    expect(result.verdict).toBe('block');
  });

  it('blocks output stage with JWT Bearer token', async () => {
    const result = await noCredentialLeakGuardrail.evaluate({
      stage: 'output',
      proposedOutput: 'Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature',
    });
    expect(result.verdict).toBe('block');
  });

  it('blocks tool stage with SSH private key', async () => {
    const result = await noCredentialLeakGuardrail.evaluate({
      stage: 'tool',
      toolName: 'core.write_file',
      toolArgs: { content: '-----BEGIN OPENSSH PRIVATE KEY-----\nkeydata\n-----END OPENSSH PRIVATE KEY-----' },
    });
    expect(result.verdict).toBe('block');
  });

  it('blocks SAS token in tool args', async () => {
    const result = await noCredentialLeakGuardrail.evaluate({
      stage: 'tool',
      toolName: 'azure.upload',
      toolArgs: { url: 'https://storage.blob.core.windows.net/container?sv=2023-01-01&sp=r&sig=ABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234' },
    });
    expect(result.verdict).toBe('block');
  });

  it('passes clean input', async () => {
    const result = await noCredentialLeakGuardrail.evaluate({
      stage: 'input',
      userMessage: 'Deploy my app to production',
    });
    expect(result.verdict).toBe('pass');
  });

  it('always blocks (never redacts)', async () => {
    const result = await noCredentialLeakGuardrail.evaluate({
      stage: 'output',
      proposedOutput: 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signaturesig',
    });
    expect(result.verdict).toBe('block');
    expect(result.verdict).not.toBe('redact');
  });
});
