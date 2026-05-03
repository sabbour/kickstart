import type { ComponentContribution, ToolContribution } from '@aks-kickstart/harness';
import { emitUiTool } from './tools/emit_ui.js';
import { showCardTool } from './tools/show_card.js';
import { showFormTool } from './tools/show_form.js';
import { confirmTool } from './tools/confirm.js';
import { navigateTool } from './tools/navigate.js';
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
import { helmTemplateTool } from './tools/helm_template.js';
import { createKustomizeBuildTool } from './tools/kustomize_build.js';
import { priorDeploymentContextTool } from './tools/prior_deployment_context.js';

export function createCoreTools(components: ComponentContribution[]): ToolContribution[] {
  return [
    // Focused UI tools (split from the deprecated core.emit_ui — #112)
    showCardTool,
    showFormTool,
    confirmTool,
    navigateTool,
    // Deprecated: retained for backward compatibility — remove in next major.
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
    helmTemplateTool,
    createKustomizeBuildTool(),
    priorDeploymentContextTool,
  ];
}
