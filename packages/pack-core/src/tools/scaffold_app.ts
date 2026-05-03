import { tool } from '@openai/agents';
import { resolve, sep } from 'node:path';
import { z } from 'zod';
import type { ToolContribution, SessionCtx } from '@aks-kickstart/harness';
import { A2UI_VERSION } from '@aks-kickstart/harness';

// ── Skill allowlist (hardcoded — never user-controlled) ───────────────────────

export const ALLOWED_SKILLS = [
  'gen-dockerfile',
  'gen-helm',
  'gen-kaito-crd',
  'gen-foundry-wiring',
  'gen-gha-workflow',
] as const;

export type AllowedSkill = (typeof ALLOWED_SKILLS)[number];

// ── Path validation ───────────────────────────────────────────────────────────

/**
 * Validates a skill output path. When `workspaceRoot` is provided the resolved
 * path is also checked to be within the root (server-side confinement). Without
 * a root only the relative-path rules are enforced (in-browser mode).
 *
 * Returns the resolved absolute path when `workspaceRoot` is given, or the
 * original `relativePath` when running without a workspace.
 */
export function validateOutputPath(workspaceRoot: string | undefined, relativePath: string): string {
  if (!relativePath || relativePath.trim() === '') {
    throw new Error(`scaffold_app: output path must not be empty`);
  }

  if (relativePath.includes('\0')) {
    throw new Error(`scaffold_app: output path must not contain null bytes`);
  }

  if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
    throw new Error(`scaffold_app: output path must be relative, got "${relativePath}"`);
  }

  const segments = relativePath.replace(/\\/g, '/').split('/');
  for (const seg of segments) {
    if (seg === '..') {
      throw new Error(`scaffold_app: output path must not contain ".." traversal: "${relativePath}"`);
    }
  }

  if (!workspaceRoot) {
    // In-browser mode: relative-path checks are sufficient; return as-is.
    return relativePath;
  }

  const resolved = resolve(workspaceRoot, relativePath);

  if (!resolved.startsWith(workspaceRoot + sep) && resolved !== workspaceRoot) {
    throw new Error(`scaffold_app: output path escapes workspace root: "${relativePath}"`);
  }

  return resolved;
}

// ── SkillDispatcher (injectable for tests) ────────────────────────────────────

export interface SkillDispatchInput {
  plan: unknown;
  proposed_services: unknown;
}

export interface SkillResult {
  skillId: AllowedSkill;
  outputPaths: string[];
  detail?: string;
}

export type SkillDispatcher = (
  skillId: AllowedSkill,
  input: SkillDispatchInput,
) => Promise<SkillResult>;

// ── GenerationProgress step IDs ───────────────────────────────────────────────

const STEP_IDS = ['dockerfile', 'helm', 'iac', 'cicd', 'finalize'] as const;
type StepId = (typeof STEP_IDS)[number];

const STEP_LABELS: Record<StepId, string> = {
  dockerfile: 'Generate Dockerfile',
  helm: 'Generate Helm charts',
  iac: 'Generate IaC manifests',
  cicd: 'Generate CI/CD workflow',
  finalize: 'Finalize artifacts',
};

// ── Input schema ──────────────────────────────────────────────────────────────

const ProposedServicesSchema = z.object({
  track: z.enum(['kaito', 'foundry']).describe('Deployment track from azure.propose_services'),
});

const PlanSchema = z.object({
  clusterName: z.string().max(1000).nullable(),
});

export const ScaffoldAppInputSchema = z.object({
  plan: PlanSchema.describe('AKS plan from Phase A/B'),
  proposed_services: ProposedServicesSchema.describe('Output of azure.propose_services'),
});

export type ScaffoldAppInput = z.infer<typeof ScaffoldAppInputSchema>;

// ── Output type ───────────────────────────────────────────────────────────────

export interface ScaffoldAppOutput {
  status: 'complete';
  skillsRun: AllowedSkill[];
  outputPaths: string[];
  surfaceId: string;
}

// ── Core orchestrator (exported for unit tests) ───────────────────────────────

export async function orchestrateScaffoldApp(
  input: ScaffoldAppInput,
  workspaceRoot: string | undefined,
  dispatcher: SkillDispatcher,
  session: Pick<SessionCtx, 'recordA2UIEmission' | 'liveSurfaceIds' | 'maxLiveSurfaces' | 'sessionId' | 'negotiatedCatalog'>,
): Promise<ScaffoldAppOutput> {
  const track = input.proposed_services.track;

  // Determine which skills to run (order is deterministic)
  const skillsToRun: AllowedSkill[] = ['gen-dockerfile', 'gen-helm'];
  if (track === 'kaito') {
    skillsToRun.push('gen-kaito-crd');
  } else {
    skillsToRun.push('gen-foundry-wiring');
  }
  skillsToRun.push('gen-gha-workflow');

  const surfaceId = `scaffold-app-${session.sessionId}`;
  const catalogId = session.negotiatedCatalog.id;

  // ── Build initial progress steps ────────────────────────────────────────────

  const stepMap: Record<AllowedSkill, StepId> = {
    'gen-dockerfile': 'dockerfile',
    'gen-helm': 'helm',
    'gen-kaito-crd': 'iac',
    'gen-foundry-wiring': 'iac',
    'gen-gha-workflow': 'cicd',
  };

  const steps: Array<{ id: StepId; label: string; status: 'pending' | 'running' | 'complete' | 'skipped' }> =
    STEP_IDS.map((id) => ({ id, label: STEP_LABELS[id], status: 'pending' as const }));

  function emitProgress(overallStatus: 'running' | 'complete', statusMessage: string) {
    session.recordA2UIEmission({
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId,
        components: [
          {
            id: 'root',
            component: 'GenerationProgress',
            title: 'Generating deployment artifacts',
            overallStatus,
            statusMessage,
            lastUpdated: new Date().toISOString(),
            steps: steps.map((s) => ({ id: s.id, label: s.label, status: s.status })),
          },
        ],
      },
    } as Parameters<typeof session.recordA2UIEmission>[0]);
  }

  // ── Create the surface ───────────────────────────────────────────────────────

  if (!session.liveSurfaceIds.has(surfaceId)) {
    session.recordA2UIEmission({
      version: A2UI_VERSION,
      createSurface: { surfaceId, catalogId },
    } as Parameters<typeof session.recordA2UIEmission>[0]);
  }

  // ── Dispatch skills in sequence ──────────────────────────────────────────────

  const allOutputPaths: string[] = [];
  const seenResolved = new Map<string, AllowedSkill>();
  const skillsRun: AllowedSkill[] = [];

  for (const skillId of skillsToRun) {
    const stepId = stepMap[skillId];
    const stepIdx = steps.findIndex((s) => s.id === stepId);

    // Mark step running
    if (stepIdx >= 0) steps[stepIdx]!.status = 'running';
    emitProgress('running', `Running ${skillId}…`);

    const result = await dispatcher(skillId, {
      plan: input.plan,
      proposed_services: input.proposed_services,
    });

    // Validate and register output paths
    for (const relPath of result.outputPaths) {
      const resolved = validateOutputPath(workspaceRoot, relPath);
      const prior = seenResolved.get(resolved);
      if (prior !== undefined) {
        throw new Error(
          `scaffold_app: output path collision — both "${prior}" and "${skillId}" emit "${relPath}"`,
        );
      }
      seenResolved.set(resolved, skillId);
      allOutputPaths.push(relPath);
    }

    skillsRun.push(skillId);

    // Mark step complete
    if (stepIdx >= 0) steps[stepIdx]!.status = 'complete';

    // Tick finalize step after last skill
    const finalizeIdx = steps.findIndex((s) => s.id === 'finalize');
    if (skillId === 'gen-gha-workflow' && finalizeIdx >= 0) {
      steps[finalizeIdx]!.status = 'complete';
    }

    const isLast = skillId === skillsToRun[skillsToRun.length - 1];
    emitProgress(
      isLast ? 'complete' : 'running',
      isLast ? 'All artifacts generated.' : `Completed ${skillId}.`,
    );
  }

  // Mark skipped IaC step for the other track
  const iacIdx = steps.findIndex((s) => s.id === 'iac');
  const wasIacRun = skillsToRun.some((s) => s === 'gen-kaito-crd' || s === 'gen-foundry-wiring');
  if (!wasIacRun && iacIdx >= 0) {
    steps[iacIdx]!.status = 'skipped';
  }

  return { status: 'complete', skillsRun, outputPaths: allOutputPaths, surfaceId };
}

// ── Tool factory ─────────────────────────────────────────────────────────────

export function createScaffoldAppTool(dispatcher: SkillDispatcher): ToolContribution {
  return {
    name: 'core.scaffold_app',
    tool: tool({
      name: 'core.scaffold_app',
      description:
        'Orchestrates Generation Phase C: dispatches gen-dockerfile, gen-helm, gen-kaito-crd ' +
        '(KAITO track only), gen-foundry-wiring (Foundry track only), and gen-gha-workflow in ' +
        'deterministic order. Validates all output paths (no traversal, no collisions) and emits ' +
        'a GenerationProgress UI component after each skill completes. ' +
        'Works in both server-side (disk + browser) and in-browser (browser only) modes.',
      parameters: ScaffoldAppInputSchema,
      execute: async (input, runCtx) => {
        const session = runCtx?.context as SessionCtx | undefined;

        if (!session) {
          throw new Error('scaffold_app: no session context available');
        }

        // workspaceRoot is optional — absent in pure in-browser deployments.
        const workspaceRoot =
          (session as unknown as { workspaceRoot?: string })?.workspaceRoot;

        const result = await orchestrateScaffoldApp(
          input,
          workspaceRoot,
          dispatcher,
          session,
        );

        return JSON.stringify(result);
      },
    }),
  };
}
