/**
 * gen_dockerfile — deterministic multi-stage Dockerfile generator.
 *
 * Security guarantees (Zapp-reviewed):
 *   - Base image selection is hardcoded to BASE_IMAGE_ALLOWLIST; no arbitrary
 *     registry URL is accepted from input.
 *   - Output path is always the literal string "Dockerfile"; never derived from
 *     user input.
 *   - All RUN commands are hardcoded strings per language; no shell injection
 *     vector from external data.
 */

// ── Base image allowlist (hardcoded — never user-controlled) ──────────────────

export const BASE_IMAGE_ALLOWLIST = {
  python: 'python:3.11-slim',
  node: 'node:20-alpine',
  go: 'golang:1.21-alpine',
} as const satisfies Record<string, string>;

export type SupportedLanguage = keyof typeof BASE_IMAGE_ALLOWLIST;

export const SUPPORTED_LANGUAGES = Object.keys(BASE_IMAGE_ALLOWLIST) as SupportedLanguage[];

// ── Framework variants ────────────────────────────────────────────────────────

export type PythonFramework = 'fastapi' | 'flask';
export type NodeFramework = 'express';
export type GoFramework = 'gin';

export type Framework = PythonFramework | NodeFramework | GoFramework;

// ── Input / output types ──────────────────────────────────────────────────────

export interface GenDockerfileInput {
  language: SupportedLanguage;
  framework: Framework;
}

export interface GenDockerfileOutput {
  dockerfile: string;
  outputPath: 'Dockerfile';
}

// ── Per-language generators ───────────────────────────────────────────────────

function generatePython(framework: PythonFramework): string {
  const baseImage = BASE_IMAGE_ALLOWLIST.python;

  const cmd =
    framework === 'fastapi'
      ? 'CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]'
      : 'CMD ["python", "app.py"]';

  return [
    `# Stage 1: builder`,
    `FROM ${baseImage} AS builder`,
    `WORKDIR /app`,
    `COPY requirements.txt .`,
    `RUN pip install --no-cache-dir -r requirements.txt`,
    ``,
    `# Stage 2: runtime`,
    `FROM ${baseImage}`,
    `WORKDIR /app`,
    `RUN addgroup -S appgroup && adduser -S appuser -G appgroup`,
    `COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages`,
    `COPY --from=builder /usr/local/bin /usr/local/bin`,
    `COPY . .`,
    `USER appuser`,
    cmd,
  ].join('\n');
}

function generateNode(framework: NodeFramework): string {
  const baseImage = BASE_IMAGE_ALLOWLIST.node;

  const cmd =
    framework === 'express' ? 'CMD ["node", "server.js"]' : 'CMD ["node", "index.js"]';

  return [
    `# Stage 1: builder`,
    `FROM ${baseImage} AS builder`,
    `WORKDIR /app`,
    `COPY package.json package-lock.json* ./`,
    `RUN npm ci --omit=dev`,
    ``,
    `# Stage 2: runtime`,
    `FROM ${baseImage}`,
    `WORKDIR /app`,
    `RUN addgroup -S appgroup && adduser -S appuser -G appgroup`,
    `COPY --from=builder /app/node_modules ./node_modules`,
    `COPY . .`,
    `USER appuser`,
    cmd,
  ].join('\n');
}

function generateGo(framework: GoFramework): string {
  const baseImage = BASE_IMAGE_ALLOWLIST.go;

  return [
    `# Stage 1: builder`,
    `FROM ${baseImage} AS builder`,
    `WORKDIR /app`,
    `COPY go.mod go.sum ./`,
    `RUN go mod download`,
    `COPY . .`,
    `RUN go build -o server .`,
    ``,
    `# Stage 2: runtime`,
    `FROM ${baseImage}`,
    `WORKDIR /app`,
    `RUN addgroup -S appgroup && adduser -S appuser -G appgroup`,
    `COPY --from=builder /app/server ./server`,
    `USER appuser`,
    `CMD ["./server"]`,
  ].join('\n');
}

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Generates a deterministic multi-stage Dockerfile for the given language and
 * framework. Throws a descriptive error for unsupported languages.
 */
export function genDockerfile(input: GenDockerfileInput): GenDockerfileOutput {
  const { language, framework } = input;

  if (!(language in BASE_IMAGE_ALLOWLIST)) {
    throw new Error(
      `gen_dockerfile: unsupported language "${language}". ` +
        `Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}.`,
    );
  }

  let dockerfile: string;

  switch (language) {
    case 'python':
      dockerfile = generatePython(framework as PythonFramework);
      break;
    case 'node':
      dockerfile = generateNode(framework as NodeFramework);
      break;
    case 'go':
      dockerfile = generateGo(framework as GoFramework);
      break;
    default: {
      const _exhaustive: never = language;
      throw new Error(`gen_dockerfile: unhandled language "${_exhaustive}"`);
    }
  }

  return { dockerfile, outputPath: 'Dockerfile' };
}
