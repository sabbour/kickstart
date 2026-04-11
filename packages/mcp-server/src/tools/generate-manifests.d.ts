/**
 * @module @kickstart/mcp-server/tools/generate-manifests
 *
 * Tool handler: Generate Kubernetes manifests from conversation state.
 * After generation, validates against deployment safeguards (D13) and
 * returns results as an A2UI Card with pass/fail indicators.
 */
import type { SessionState } from "@kickstart/core";
import type { A2UICapability } from "../a2ui.js";
/**
 * Generate deployment manifests from the accumulated conversation state.
 *
 * Requires the session to have a complete AppDefinition and AzureContext.
 * Returns generated files as A2UI CodeBlock components and validates
 * against deployment safeguards.
 */
export declare function handleGenerateManifests(sessions: Map<string, SessionState>, sessionId: string, capability?: A2UICapability): Promise<{
    content: Array<{
        type: "text";
        text: string;
    } | {
        type: "resource";
        resource: {
            uri: string;
            mimeType: string;
            text: string;
        };
    }>;
}>;
//# sourceMappingURL=generate-manifests.d.ts.map