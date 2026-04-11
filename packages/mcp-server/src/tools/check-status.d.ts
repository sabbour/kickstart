/**
 * @module @kickstart/mcp-server/tools/check-status
 *
 * Tool handler: Check deployment status for an active session.
 */
import type { SessionState } from "@kickstart/core";
/**
 * Check the deployment status for a session.
 *
 * Phase 1 stub — returns a placeholder progress component.
 * Future: poll Azure Resource Manager for actual deployment status.
 */
export declare function handleCheckStatus(sessions: Map<string, SessionState>, sessionId: string): Promise<{
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
//# sourceMappingURL=check-status.d.ts.map