import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Bicep } from "bicep-node";
import type { CompileResponseDiagnostic } from "bicep-node";
import { AzureApiError } from "./azure-errors.js";

const BICEP_VERSION = process.env.BICEP_CLI_VERSION?.trim() || "0.42.1";

export interface DeploymentFileInput {
  path: string;
  content: string;
}

export interface CompiledBicepTemplate {
  template: Record<string, unknown>;
  diagnostics: CompileResponseDiagnostic[];
}

let cachedBicepPathPromise: Promise<string> | null = null;

function getWritableRoot(...segments: string[]): string {
  const base = os.homedir() || process.cwd();
  return path.join(base, ".kickstart", ...segments);
}

function normalizeRelativeFilePath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, "/").replace(/^\.\/+/, "");
  const candidate = path.posix.normalize(normalized);

  if (!candidate || candidate === "." || candidate === ".." || candidate.startsWith("../") || candidate.includes("/../")) {
    throw new AzureApiError(
      400,
      "invalid_bicep_file_path",
      `Bicep file path "${rawPath}" must stay within the deployment workspace.`,
    );
  }

  if (path.posix.isAbsolute(candidate)) {
    throw new AzureApiError(
      400,
      "invalid_bicep_file_path",
      `Bicep file path "${rawPath}" must be relative.`,
    );
  }

  return candidate;
}

function sanitizeDiagnosticPath(source: string, workspaceRoot: string): string {
  if (!source) return source;
  const relativePath = path.relative(workspaceRoot, source);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return path.basename(source) || source;
  }
  return relativePath.replace(/\\/g, "/");
}

function sanitizeDiagnostics(
  diagnostics: CompileResponseDiagnostic[],
  workspaceRoot: string,
): CompileResponseDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const source = sanitizeDiagnosticPath(diagnostic.source, workspaceRoot);
    const sourcePathVariants = [
      diagnostic.source,
      diagnostic.source.replace(/\\/g, "/"),
      diagnostic.source.replace(/\//g, "\\"),
    ].filter(Boolean);

    let message = diagnostic.message;
    for (const variant of sourcePathVariants) {
      message = message.split(variant).join(source);
    }
    message = message.split(workspaceRoot).join("<workspace>");
    message = message.split(workspaceRoot.replace(/\\/g, "/")).join("<workspace>");

    return {
      ...diagnostic,
      source,
      message,
    };
  });
}

async function ensureBicepPath(): Promise<string> {
  if (!cachedBicepPathPromise) {
    cachedBicepPathPromise = (async () => {
      if (process.env.BICEP_CLI_PATH?.trim()) {
        return process.env.BICEP_CLI_PATH.trim();
      }

      const installRoot = getWritableRoot("bicep-cli");
      await mkdir(installRoot, { recursive: true });

      try {
        return await Bicep.install(installRoot, BICEP_VERSION);
      } catch (error) {
        throw new AzureApiError(
          503,
          "bicep_cli_install_failed",
          "The server could not install the Bicep CLI required for deployment.",
          { message: error instanceof Error ? error.message : String(error), version: BICEP_VERSION },
          true,
          [
            "Ensure the runtime can write to its home directory.",
            "Ensure the runtime can reach downloads.bicep.azure.com.",
          ],
        );
      }
    })();
  }

  return cachedBicepPathPromise;
}

export async function compileBicepFiles(
  mainFile: string,
  files: DeploymentFileInput[],
): Promise<CompiledBicepTemplate> {
  const normalizedMainFile = normalizeRelativeFilePath(mainFile);

  if (!normalizedMainFile.endsWith(".bicep")) {
    throw new AzureApiError(
      400,
      "invalid_main_bicep_file",
      `Main deployment file "${mainFile}" must be a .bicep file.`,
    );
  }

  if (!files.length) {
    throw new AzureApiError(
      400,
      "missing_bicep_files",
      "At least one Bicep file is required to start a deployment.",
    );
  }

  const seen = new Set<string>();
  const workspaceRoot = getWritableRoot("bicep-work", randomUUID());
  await mkdir(workspaceRoot, { recursive: true });

  try {
    for (const file of files) {
      const normalizedPath = normalizeRelativeFilePath(file.path);
      if (seen.has(normalizedPath)) {
        throw new AzureApiError(
          400,
          "duplicate_bicep_file",
          `Bicep file "${normalizedPath}" was provided more than once.`,
        );
      }

      seen.add(normalizedPath);
      const targetPath = path.join(workspaceRoot, normalizedPath);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, file.content, "utf8");
    }

    if (!seen.has(normalizedMainFile)) {
      throw new AzureApiError(
        400,
        "main_bicep_file_missing",
        `Main deployment file "${normalizedMainFile}" was not included in the request.`,
      );
    }

    const bicepPath = await ensureBicepPath();
    const compiler = await Bicep.initialize(bicepPath);

    try {
      const result = await compiler.compile({
        path: path.join(workspaceRoot, normalizedMainFile),
      });
      const diagnostics = sanitizeDiagnostics(result.diagnostics, workspaceRoot);

      if (!result.success || !result.contents) {
        throw new AzureApiError(
          400,
          "bicep_compile_failed",
          "Bicep compilation failed.",
          { diagnostics },
          false,
          [
            "Ensure mainFile points to the entry Bicep file.",
            "Ensure module paths in main.bicep match the files sent to the API.",
          ],
        );
      }

      try {
        return {
          template: JSON.parse(result.contents) as Record<string, unknown>,
          diagnostics,
        };
      } catch (error) {
        throw new AzureApiError(
          500,
          "compiled_template_invalid",
          "The compiled Bicep template was not valid JSON.",
          { message: error instanceof Error ? error.message : String(error) },
        );
      }
    } finally {
      compiler.dispose();
    }
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
