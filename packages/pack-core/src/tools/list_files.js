import { tool } from '@openai/agents';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
const listFilesSchema = z.object({
    directory: z
        .string()
        .nullable()
        .optional()
        .describe('Relative path to list (defaults to workspace root). Must stay within the workspace.'),
    recursive: z
        .boolean()
        .nullable()
        .optional()
        .describe('List files recursively. Defaults to false.'),
});
const MAX_FILES = 500;
function listDir(dir, recursive, base) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(base, full);
        if (entry.isDirectory()) {
            if (recursive) {
                results.push(...listDir(full, true, base));
            }
        }
        else {
            results.push(rel);
        }
        if (results.length >= MAX_FILES)
            break;
    }
    return results;
}
export const listFilesTool = {
    name: 'core.list_files',
    tool: tool({
        name: 'core.list_files',
        description: 'List files in the workspace. Returns relative paths. Limited to 500 entries.',
        parameters: listFilesSchema,
        execute: async (input, runCtx) => {
            const session = runCtx?.context;
            // workspaceRoot is an extension field not yet in the base SessionCtx contract.
            const workspaceRoot = session?.workspaceRoot ?? process.cwd();
            const subdir = input.directory ?? '';
            const targetRaw = path.join(workspaceRoot, subdir);
            // Confinement: target must be within workspaceRoot
            const target = path.resolve(targetRaw);
            const root = path.resolve(workspaceRoot);
            if (!target.startsWith(root + path.sep) && target !== root) {
                return { error: 'Access denied: directory is outside the workspace.' };
            }
            if (!fs.existsSync(target)) {
                return { error: `Directory not found: ${subdir || '.'}` };
            }
            if (!fs.statSync(target).isDirectory()) {
                return { error: `Not a directory: ${subdir}` };
            }
            // Resolve symlinks to prevent symlink-based escape after logical check.
            const realRoot = fs.realpathSync(root);
            const realTarget = fs.realpathSync(target);
            if (!realTarget.startsWith(realRoot + path.sep) && realTarget !== realRoot) {
                return { error: 'Access denied: directory is outside the workspace.' };
            }
            const files = listDir(target, input.recursive ?? false, root);
            return { files, truncated: files.length >= MAX_FILES };
        },
    }),
};
//# sourceMappingURL=list_files.js.map