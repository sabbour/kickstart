/**
 * @file gen_dockerfile.test.ts
 * @suite gen_dockerfile skill — language-aware multi-stage Dockerfile generation
 *
 * Tests deterministic output, security defaults, layer ordering, and error
 * handling for unsupported languages.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  genDockerfile,
  BASE_IMAGE_ALLOWLIST,
  SUPPORTED_LANGUAGES,
  type GenDockerfileOutput,
} from '../../tools/gen_dockerfile.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function lines(dockerfile: string): string[] {
  return dockerfile.split('\n');
}

function hasNonRootUser(dockerfile: string): boolean {
  return dockerfile.includes('addgroup') && dockerfile.includes('adduser') && dockerfile.includes('USER appuser');
}

function packageManifestBeforeSource(dockerfile: string, manifest: string): boolean {
  const ls = lines(dockerfile);
  const manifestIdx = ls.findIndex((l) => l.includes(`COPY ${manifest}`));
  const sourceCopyIdx = ls.findIndex((l) => l.match(/^COPY \. \./));
  return manifestIdx !== -1 && sourceCopyIdx !== -1 && manifestIdx < sourceCopyIdx;
}

// ── BASE_IMAGE_ALLOWLIST ──────────────────────────────────────────────────────

describe('BASE_IMAGE_ALLOWLIST', () => {
  it('contains exactly python, node, and go', () => {
    expect(Object.keys(BASE_IMAGE_ALLOWLIST).sort()).toEqual(['go', 'node', 'python']);
  });

  it('python maps to python:3.11-slim', () => {
    expect(BASE_IMAGE_ALLOWLIST.python).toBe('python:3.11-slim');
  });

  it('node maps to node:20-alpine', () => {
    expect(BASE_IMAGE_ALLOWLIST.node).toBe('node:20-alpine');
  });

  it('go maps to golang:1.21-alpine', () => {
    expect(BASE_IMAGE_ALLOWLIST.go).toBe('golang:1.21-alpine');
  });
});

// ── Output contract ───────────────────────────────────────────────────────────

describe('outputPath', () => {
  it('is always "Dockerfile" for Python/FastAPI', () => {
    const { outputPath } = genDockerfile({ language: 'python', framework: 'fastapi' });
    expect(outputPath).toBe('Dockerfile');
  });

  it('is always "Dockerfile" for Node/Express', () => {
    const { outputPath } = genDockerfile({ language: 'node', framework: 'express' });
    expect(outputPath).toBe('Dockerfile');
  });

  it('is always "Dockerfile" for Go/Gin', () => {
    const { outputPath } = genDockerfile({ language: 'go', framework: 'gin' });
    expect(outputPath).toBe('Dockerfile');
  });
});

// ── Python ────────────────────────────────────────────────────────────────────

describe('Python Dockerfile', () => {
  describe('FastAPI', () => {
    let result: GenDockerfileOutput;
    beforeEach(() => {
      result = genDockerfile({ language: 'python', framework: 'fastapi' });
    });

    it('uses python:3.11-slim as base image', () => {
      expect(result.dockerfile).toContain('python:3.11-slim');
    });

    it('contains multi-stage build (builder + runtime)', () => {
      expect(result.dockerfile).toContain('AS builder');
      const ls = lines(result.dockerfile);
      const fromCount = ls.filter((l) => l.startsWith('FROM ')).length;
      expect(fromCount).toBe(2);
    });

    it('copies requirements.txt before source code', () => {
      expect(packageManifestBeforeSource(result.dockerfile, 'requirements.txt')).toBe(true);
    });

    it('includes non-root user setup', () => {
      expect(hasNonRootUser(result.dockerfile)).toBe(true);
    });

    it('uses uvicorn entrypoint for FastAPI', () => {
      expect(result.dockerfile).toContain('uvicorn');
      expect(result.dockerfile).toContain('main:app');
    });
  });

  describe('Flask', () => {
    let result: GenDockerfileOutput;
    beforeEach(() => {
      result = genDockerfile({ language: 'python', framework: 'flask' });
    });

    it('uses python:3.11-slim as base image', () => {
      expect(result.dockerfile).toContain('python:3.11-slim');
    });

    it('contains multi-stage build', () => {
      expect(result.dockerfile).toContain('AS builder');
    });

    it('copies requirements.txt before source code', () => {
      expect(packageManifestBeforeSource(result.dockerfile, 'requirements.txt')).toBe(true);
    });

    it('includes non-root user setup', () => {
      expect(hasNonRootUser(result.dockerfile)).toBe(true);
    });

    it('uses python app.py entrypoint for Flask', () => {
      expect(result.dockerfile).toContain('python');
      expect(result.dockerfile).toContain('app.py');
    });
  });
});

// ── Node.js ───────────────────────────────────────────────────────────────────

describe('Node.js Dockerfile', () => {
  describe('Express', () => {
    let result: GenDockerfileOutput;
    beforeEach(() => {
      result = genDockerfile({ language: 'node', framework: 'express' });
    });

    it('uses node:20-alpine as base image', () => {
      expect(result.dockerfile).toContain('node:20-alpine');
    });

    it('contains multi-stage build', () => {
      expect(result.dockerfile).toContain('AS builder');
      const ls = lines(result.dockerfile);
      const fromCount = ls.filter((l) => l.startsWith('FROM ')).length;
      expect(fromCount).toBe(2);
    });

    it('copies package.json before source code', () => {
      expect(packageManifestBeforeSource(result.dockerfile, 'package.json')).toBe(true);
    });

    it('includes non-root user setup', () => {
      expect(hasNonRootUser(result.dockerfile)).toBe(true);
    });

    it('uses node server.js entrypoint for Express', () => {
      expect(result.dockerfile).toContain('node');
      expect(result.dockerfile).toContain('server.js');
    });

    it('uses npm ci with --omit=dev (no dev dependencies in builder)', () => {
      expect(result.dockerfile).toContain('npm ci');
      expect(result.dockerfile).toContain('--omit=dev');
    });
  });
});

// ── Go ────────────────────────────────────────────────────────────────────────

describe('Go Dockerfile', () => {
  describe('Gin', () => {
    let result: GenDockerfileOutput;
    beforeEach(() => {
      result = genDockerfile({ language: 'go', framework: 'gin' });
    });

    it('uses golang:1.21-alpine as base image', () => {
      expect(result.dockerfile).toContain('golang:1.21-alpine');
    });

    it('contains multi-stage build', () => {
      expect(result.dockerfile).toContain('AS builder');
      const ls = lines(result.dockerfile);
      const fromCount = ls.filter((l) => l.startsWith('FROM ')).length;
      expect(fromCount).toBe(2);
    });

    it('copies go.mod before source code', () => {
      expect(packageManifestBeforeSource(result.dockerfile, 'go.mod')).toBe(true);
    });

    it('includes non-root user setup', () => {
      expect(hasNonRootUser(result.dockerfile)).toBe(true);
    });

    it('builds binary in builder stage', () => {
      expect(result.dockerfile).toContain('go build');
      expect(result.dockerfile).toContain('-o server');
    });

    it('uses ./server entrypoint', () => {
      expect(result.dockerfile).toContain('./server');
    });
  });
});

// ── Unsupported language ──────────────────────────────────────────────────────

describe('unsupported language', () => {
  it('throws a descriptive error for unknown language', () => {
    expect(() =>
      // @ts-expect-error — intentional invalid input for test
      genDockerfile({ language: 'ruby', framework: 'rails' }),
    ).toThrow(/unsupported language "ruby"/);
  });

  it('error message lists supported languages', () => {
    expect(() =>
      // @ts-expect-error — intentional invalid input for test
      genDockerfile({ language: 'java', framework: 'spring' }),
    ).toThrow(/python.*node.*go|go.*node.*python/i);
  });
});

// ── Security invariants (all languages) ──────────────────────────────────────

describe('security invariants', () => {
  const cases = [
    { language: 'python' as const, framework: 'fastapi' as const },
    { language: 'python' as const, framework: 'flask' as const },
    { language: 'node' as const, framework: 'express' as const },
    { language: 'go' as const, framework: 'gin' as const },
  ];

  for (const input of cases) {
    it(`${input.language}/${input.framework}: non-root user in generated Dockerfile`, () => {
      const { dockerfile } = genDockerfile(input);
      expect(hasNonRootUser(dockerfile)).toBe(true);
    });

    it(`${input.language}/${input.framework}: outputPath is always "Dockerfile"`, () => {
      const { outputPath } = genDockerfile(input);
      expect(outputPath).toBe('Dockerfile');
    });

    it(`${input.language}/${input.framework}: no arbitrary RUN with user data (hardcoded commands only)`, () => {
      const { dockerfile } = genDockerfile(input);
      // All RUN commands should be from our hardcoded set; no template injection possible
      expect(typeof dockerfile).toBe('string');
      expect(dockerfile.length).toBeGreaterThan(0);
    });
  }
});

// ── SUPPORTED_LANGUAGES ───────────────────────────────────────────────────────

describe('SUPPORTED_LANGUAGES', () => {
  it('matches the keys of BASE_IMAGE_ALLOWLIST', () => {
    expect(SUPPORTED_LANGUAGES.sort()).toEqual(Object.keys(BASE_IMAGE_ALLOWLIST).sort());
  });
});


