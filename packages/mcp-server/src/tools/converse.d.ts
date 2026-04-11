/**
 * @module @kickstart/mcp-server/tools/converse
 *
 * Tool handler: Multi-turn conversation within an existing Kickstart session.
 * Processes user messages through the phase machine, composes the
 * phase-appropriate system prompt, and returns A2UI phase indicators.
 */
import type { SessionState } from "@kickstart/core";
import type { A2UICapability } from "../a2ui.js";
/** MCP tool result content item. */
type ContentItem = {
    type: "text";
    text: string;
} | {
    type: "resource";
    resource: {
        uri: string;
        mimeType: string;
        text: string;
    };
};
/**
 * Process a user message in an existing conversation session.
 *
 * Records the message, recomposes the system prompt for the current phase,
 * handles phase transitions via the engine state machine, and returns
 * the prompt + phase indicator as A2UI.
 */
export declare function handleConverse(sessions: Map<string, SessionState>, sessionId: string, message: string, capability?: A2UICapability): Promise<{
    content: ContentItem[];
}>;
export {};
//# sourceMappingURL=converse.d.ts.map