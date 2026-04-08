/**
 * @module @kickstart/core/generators/types
 *
 * Types for the code generation pipeline.
 */

import type { AppDefinition, AzureContext, GitHubContext } from "../types.js";

/** Input to any code generator. */
export interface GeneratorInput {
  /** Application definition gathered from conversation */
  app: AppDefinition;
  /** Azure resource context */
  azure: AzureContext;
  /** GitHub repository context (optional — not all generators need it) */
  github?: GitHubContext;
}

/** A single generated file. */
export interface GeneratedFile {
  /** Relative path (e.g., "k8s/deployment.yaml") */
  path: string;
  /** File contents */
  content: string;
  /** Language for syntax highlighting */
  language: string;
}

/** Output from a code generator. */
export interface GeneratorOutput {
  /** Generator name (e.g., "kubernetes", "github-actions") */
  generator: string;
  /** Generated files */
  files: GeneratedFile[];
  /** Human-readable summary of what was generated */
  summary: string;
}
