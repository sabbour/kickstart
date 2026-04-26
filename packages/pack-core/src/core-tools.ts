import type { ComponentContribution, ToolContribution } from '@aks-kickstart/harness';
import { emitUiTool } from './tools/emit_ui.js';
import { fetchWebpageTool } from './tools/fetch_webpage.js';
import { searchKaitoModelsTool } from './tools/search_kaito_models.js';
import { readFileTool } from './tools/read_file.js';
import { writeFileTool } from './tools/write_file.js';
import { listFilesTool } from './tools/list_files.js';
import { validateArtifactsTool } from './tools/validate_artifacts.js';
import { checkSafeguardsTool } from './tools/check_safeguards.js';
import { fixSafeguardsTool } from './tools/fix_safeguards.js';
import { createSearchComponentsTool } from './tools/search_components.js';
import { createInspectRepoTool } from './tools/inspect_repo.js';

export function createCoreTools(components: ComponentContribution[]): ToolContribution[] {
  return [
    emitUiTool,
    fetchWebpageTool,
    searchKaitoModelsTool,
    readFileTool,
    writeFileTool,
    listFilesTool,
    validateArtifactsTool,
    checkSafeguardsTool,
    fixSafeguardsTool,
    createInspectRepoTool(),
    createSearchComponentsTool({ components }),
  ];
}
