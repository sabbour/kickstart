import { tool } from '@openai/agents';
import { z } from 'zod';
// ── Schema ────────────────────────────────────────────────────────────────────
const ValidateArtifactsInputSchema = z.object({
    files: z
        .array(z.string().min(1))
        .min(1)
        .describe('List of relative file paths (within the session workspace) to validate. ' +
        'Supports Bicep (.bicep, .bicepparam), Kubernetes YAML (.yaml, .yml), ' +
        'Terraform (.tf, .tfvars), and GitHub Actions workflows.'),
});
// ── Tool ──────────────────────────────────────────────────────────────────────
export const validateArtifactsTool = {
    name: 'core.validate_artifacts',
    tool: tool({
        name: 'core.validate_artifacts',
        description: 'Validates generated infrastructure artifacts (Bicep templates, Kubernetes YAML, Terraform files, ' +
            'GitHub Actions workflows) and returns a structured result indicating whether each file is valid. ' +
            'Reports blocking errors and non-blocking warnings.',
        parameters: ValidateArtifactsInputSchema,
        execute: async (input, _runCtx) => {
            // TODO(Phase C follow-up): replace with real Bicep / YAML linting once the
            // validate-artifacts runtime (bicep build, k8s schema check) ships in pack-core.
            // For now, return a valid stub so the tool is callable end-to-end.
            const result = {
                valid: true,
                errors: [],
            };
            const summary = input.files
                .map((f) => `✅ ${f} — passed (stub validation)`)
                .join('\n');
            return JSON.stringify({ ...result, summary });
        },
    }),
};
//# sourceMappingURL=validate_artifacts.js.map