/**
 * Seeded-failure meta-test — verifies the golden gate actually blocks.
 *
 * This test intentionally exercises a broken fixture to confirm
 * the test harness detects failures and surfaces them correctly.
 * If this test passes, the gate is functioning.
 */
import { test, expect } from '@playwright/test';
import { validateNoSecrets, checkFreshness, type FixtureMeta } from './golden-fixture';

test.describe('Golden gate meta-tests', () => {
  test('seeded secret detection blocks commit', () => {
    const contentWithSecret = '{"token": "FAKE_TOKEN_FOR_TESTING_00000000"}';
    const violations = validateNoSecrets(contentWithSecret);
    expect(violations.length).toBeGreaterThan(0);
  });

  test('seeded github_pat detection blocks commit', () => {
    const contentWithPat = '{"token": "test-not-a-real-secret-00000000000000000000"}';
    const violations = validateNoSecrets(contentWithPat);
    expect(violations.length).toBeGreaterThan(0);
  });

  test('stale fixture (> 30 days) triggers warning', () => {
    const staleMeta: FixtureMeta = {
      recorded_at: '2020-01-01T00:00:00Z',
      model_version: 'gpt-4',
      prompt_hash: 'abc123',
      tool_schema_hash: 'def456',
      track: 'web-app',
    };
    const result = checkFreshness(staleMeta);
    expect(result).not.toBeNull();
    expect(result).toContain('days old');
  });

  test('fresh fixture passes freshness check', () => {
    const freshMeta: FixtureMeta = {
      recorded_at: new Date().toISOString(),
      model_version: 'gpt-5.4',
      prompt_hash: 'abc123',
      tool_schema_hash: 'def456',
      track: 'web-app',
    };
    const result = checkFreshness(freshMeta);
    expect(result).toBeNull();
  });

  test('clean content passes secret validation', () => {
    const cleanContent = '{"content": "Hello, this is a safe response about Kubernetes."}';
    const violations = validateNoSecrets(cleanContent);
    expect(violations).toHaveLength(0);
  });

  test('scrubbed placeholder UUIDs are allowed', () => {
    const scrubbedContent = '{"subscription": "00000000-0000-0000-0000-000000000000", "tenant": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
    const violations = validateNoSecrets(scrubbedContent);
    expect(violations).toHaveLength(0);
  });
});
