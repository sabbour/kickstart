/**
 * @file rich-components-url-sanitization.test.ts
 * @suite URL sanitization on SummaryCard link field
 *
 * Ensures that malicious URLs (javascript:, data:, etc.) are rejected at
 * the schema level, and that only HTTPS URLs are allowed for SummaryCard items.
 */

import { describe, it, expect } from 'vitest';
import { SummaryCardSchema } from '../../schemas/rich-component-schemas.js';

describe('SummaryCard URL sanitization', () => {
  it('should accept valid HTTPS URLs', () => {
    const validCard = {
      id: 'test',
      component: 'SummaryCard',
      title: null,
      items: [
        {
          label: 'GitHub PR',
          value: 'PR #42',
          badge: null,
          link: 'https://github.com/octocat/kickstart-sample/pull/42',
        },
      ],
      children: null,
    };

    const result = SummaryCardSchema.safeParse(validCard);
    expect(result.success).toBe(true);
  });

  it('should reject javascript: URLs', () => {
    const maliciousCard = {
      id: 'test',
      component: 'SummaryCard',
      title: null,
      items: [
        {
          label: 'Malicious Link',
          value: 'Click me',
          badge: null,
          link: 'javascript:alert("xss")',
        },
      ],
      children: null,
    };

    const result = SummaryCardSchema.safeParse(maliciousCard);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => 
        issue.message.includes('Only HTTPS URLs allowed')
      )).toBe(true);
    }
  });

  it('should reject data: URLs', () => {
    const maliciousCard = {
      id: 'test',
      component: 'SummaryCard',
      title: null,
      items: [
        {
          label: 'Data URL',
          value: 'Phishing',
          badge: null,
          link: 'data:text/html,<script>alert("xss")</script>',
        },
      ],
      children: null,
    };

    const result = SummaryCardSchema.safeParse(maliciousCard);
    expect(result.success).toBe(false);
  });

  it('should reject HTTP URLs (only HTTPS allowed)', () => {
    const httpCard = {
      id: 'test',
      component: 'SummaryCard',
      title: null,
      items: [
        {
          label: 'HTTP Link',
          value: 'Insecure',
          badge: null,
          link: 'http://example.com',
        },
      ],
      children: null,
    };

    const result = SummaryCardSchema.safeParse(httpCard);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => 
        issue.message.includes('Only HTTPS URLs allowed')
      )).toBe(true);
    }
  });

  it('should reject invalid URLs', () => {
    const invalidUrlCard = {
      id: 'test',
      component: 'SummaryCard',
      title: null,
      items: [
        {
          label: 'Invalid URL',
          value: 'Not a URL',
          badge: null,
          link: 'not a valid url',
        },
      ],
      children: null,
    };

    const result = SummaryCardSchema.safeParse(invalidUrlCard);
    expect(result.success).toBe(false);
  });

  it('should allow null links', () => {
    const cardWithNullLink = {
      id: 'test',
      component: 'SummaryCard',
      title: null,
      items: [
        {
          label: 'No Link',
          value: 'Plain Text',
          badge: null,
          link: null,
        },
      ],
      children: null,
    };

    const result = SummaryCardSchema.safeParse(cardWithNullLink);
    expect(result.success).toBe(true);
  });

  it('should allow data-binding link references', () => {
    const cardWithDataBinding = {
      id: 'test',
      component: 'SummaryCard',
      title: null,
      items: [
        {
          label: 'Dynamic Link',
          value: 'PR Link',
          badge: null,
          link: { path: 'variables.prUrl' },
        },
      ],
      children: null,
    };

    const result = SummaryCardSchema.safeParse(cardWithDataBinding);
    expect(result.success).toBe(true);
  });
});


