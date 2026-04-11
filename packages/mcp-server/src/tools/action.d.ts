/**
 * @module @kickstart/mcp-server/tools/action
 *
 * Tool handler: Process user actions from the A2UI interface.
 * Handles phase advancement, resource selection, and form submissions.
 */
import type { SessionState } from "@kickstart/core";
type ActionType = "advance" | "skip" | "select" | "submit" | "reply" | "navigate" | "api";
/**
 * Handle a user action from the A2UI interface.
 *
 * Dispatches to the conversation state machine and returns
 * updated A2UI components reflecting the new state.
 */
export declare function handleAction(sessions: Map<string, SessionState>, sessionId: string, actionType: ActionType, payload?: Record<string, unknown>): Promise<{
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
export {};
//# sourceMappingURL=action.d.ts.map