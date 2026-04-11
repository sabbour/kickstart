/**
 * @module @kickstart/mcp-server/tools/kickstart
 *
 * Tool handler: Start a new Kickstart conversation.
 * Returns A2UI ConversationPhase component + intro text.
 * Composes the system prompt dynamically based on the current phase.
 */
import type { SessionState, ConversationState } from "@kickstart/core";
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
/** Retrieve the engine state for a session. */
export declare function getEngineState(sessionId: string): ConversationState | undefined;
/** Store engine state for a session. */
export declare function setEngineState(sessionId: string, state: ConversationState): void;
/** Delete engine state for a session. */
export declare function deleteEngineState(sessionId: string): void;
/**
 * Start a new Kickstart conversation session.
 *
 * Creates a session, initialises the conversation state machine,
 * composes a dynamic system prompt for the Discover phase, and
 * returns an A2UI ConversationPhase UI with welcome text.
 */
export declare function handleKickstart(sessions: Map<string, SessionState>, initialMessage?: string, capability?: A2UICapability): Promise<{
    content: ContentItem[];
}>;
export {};
//# sourceMappingURL=kickstart.d.ts.map