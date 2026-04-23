import { describe, it, expect } from 'vitest';
import { assertArmPollingUrl } from '../services/azure-auth.js';

describe('assertArmPollingUrl — LRO SSRF host validation (Zapp)', () => {
  it('passes a valid ARM polling URL (public cloud)', () => {
    expect(() =>
      assertArmPollingUrl(
        'https://management.azure.com/subscriptions/00000000-0000-0000-0000-000000000000/operationresults/abc?api-version=2021-04-01',
      ),
    ).not.toThrow();
  });

  it('passes an Azure Government Cloud polling URL', () => {
    expect(() =>
      assertArmPollingUrl(
        'https://management.usgovcloudapi.net/subscriptions/00000000-0000-0000-0000-000000000000/operationresults/abc',
      ),
    ).not.toThrow();
  });

  it('passes an Azure China Cloud polling URL', () => {
    expect(() =>
      assertArmPollingUrl('https://management.chinacloudapi.cn/operationresults/abc'),
    ).not.toThrow();
  });

  it('passes an Azure Germany Cloud polling URL', () => {
    expect(() =>
      assertArmPollingUrl('https://management.microsoftazure.de/operationresults/abc'),
    ).not.toThrow();
  });

  it('throws for a non-HTTPS URL (http)', () => {
    expect(() =>
      assertArmPollingUrl('http://management.azure.com/operationresults/abc'),
    ).toThrow('HTTPS');
  });

  it('throws for a non-ARM host (SSRF attacker URL)', () => {
    expect(() =>
      assertArmPollingUrl('https://attacker.com/steal-token'),
    ).toThrow('allowlist');
  });

  it('throws for an invalid URL string', () => {
    expect(() => assertArmPollingUrl('not-a-url')).toThrow('Invalid LRO polling URL');
  });

  it('throws for an empty URL string', () => {
    expect(() => assertArmPollingUrl('')).toThrow('Invalid LRO polling URL');
  });

  it('throws for a lookalike subdomain attack', () => {
    expect(() =>
      assertArmPollingUrl('https://management.azure.com.attacker.com/steal'),
    ).toThrow('allowlist');
  });
});
