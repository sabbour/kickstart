import { describe, it, expect, beforeEach } from "vitest";
import { parseAppMessage, handleAppMessage, } from "../app/protocol.js";
// ── parseAppMessage ─────────────────────────────────────────────────
describe("parseAppMessage", () => {
    it("parses a valid kickstart message", () => {
        const result = parseAppMessage({ type: "kickstart" });
        expect(result).toEqual({ type: "kickstart" });
    });
    it("parses a valid converse message", () => {
        const result = parseAppMessage({
            type: "converse",
            sessionId: "abc-123",
            message: "Deploy my app",
        });
        expect(result).toEqual({
            type: "converse",
            sessionId: "abc-123",
            message: "Deploy my app",
        });
    });
    it("parses a valid action message", () => {
        const result = parseAppMessage({
            type: "action",
            sessionId: "abc-123",
            actionType: "advance",
            payload: { step: "next" },
        });
        expect(result).toEqual({
            type: "action",
            sessionId: "abc-123",
            actionType: "advance",
            payload: { step: "next" },
        });
    });
    it("returns null for unknown message type", () => {
        expect(parseAppMessage({ type: "unknown" })).toBeNull();
    });
    it("returns null for null input", () => {
        expect(parseAppMessage(null)).toBeNull();
    });
    it("returns null for non-object input", () => {
        expect(parseAppMessage("hello")).toBeNull();
    });
    it("returns null for converse missing sessionId", () => {
        expect(parseAppMessage({ type: "converse", message: "hi" })).toBeNull();
    });
    it("returns null for converse missing message", () => {
        expect(parseAppMessage({ type: "converse", sessionId: "x" })).toBeNull();
    });
    it("returns null for action missing sessionId", () => {
        expect(parseAppMessage({ type: "action", actionType: "advance" })).toBeNull();
    });
    it("returns null for action missing actionType", () => {
        expect(parseAppMessage({ type: "action", sessionId: "x" })).toBeNull();
    });
    it("defaults payload to empty object when missing for action", () => {
        const result = parseAppMessage({
            type: "action",
            sessionId: "x",
            actionType: "select",
        });
        expect(result).not.toBeNull();
        expect(result.payload).toEqual({});
    });
    it("defaults payload to empty object when payload is a non-object", () => {
        const result = parseAppMessage({
            type: "action",
            sessionId: "x",
            actionType: "select",
            payload: "invalid",
        });
        expect(result).not.toBeNull();
        expect(result.payload).toEqual({});
    });
});
// ── handleAppMessage ────────────────────────────────────────────────
describe("handleAppMessage", () => {
    let sessions;
    beforeEach(() => {
        sessions = new Map();
    });
    it("handles kickstart message and returns a response with sessionId", async () => {
        const msg = { type: "kickstart" };
        const result = await handleAppMessage(msg, sessions);
        expect(result.type).toBe("response");
        if (result.type === "response") {
            expect(result.sessionId).toBeTruthy();
            expect(result.phase).toBe("Discover");
            expect(result.text).toBeTruthy();
        }
    });
    it("stores a session after kickstart", async () => {
        expect(sessions.size).toBe(0);
        await handleAppMessage({ type: "kickstart" }, sessions);
        expect(sessions.size).toBe(1);
    });
    it("handles converse message for an existing session", async () => {
        // First create a session
        const kickResult = await handleAppMessage({ type: "kickstart" }, sessions);
        expect(kickResult.type).toBe("response");
        const sessionId = kickResult.sessionId;
        // Then converse
        const converseResult = await handleAppMessage({ type: "converse", sessionId, message: "I have a Node.js app" }, sessions);
        expect(converseResult.type).toBe("response");
        if (converseResult.type === "response") {
            expect(converseResult.sessionId).toBe(sessionId);
        }
    });
    it("returns error for converse with unknown session", async () => {
        const result = await handleAppMessage({ type: "converse", sessionId: "nonexistent", message: "hello" }, sessions);
        // The converse tool returns text with error message, not an error type
        expect(result.type).toBe("response");
        if (result.type === "response") {
            expect(result.text).toContain("not found");
        }
    });
    it("handles action message for an existing session", async () => {
        const kickResult = await handleAppMessage({ type: "kickstart" }, sessions);
        const sessionId = kickResult.sessionId;
        const result = await handleAppMessage({ type: "action", sessionId, actionType: "select", payload: { runtime: "nodejs" } }, sessions);
        expect(result.type).toBe("response");
    });
    it("returns A2UI component in kickstart response", async () => {
        const result = await handleAppMessage({ type: "kickstart" }, sessions, "kickstart");
        expect(result.type).toBe("response");
        if (result.type === "response") {
            expect(result.a2ui).toBeDefined();
            expect(result.a2ui.type).toBe("ConversationPhase");
        }
    });
    it("returns no A2UI when capability is none", async () => {
        const result = await handleAppMessage({ type: "kickstart" }, sessions, "none");
        expect(result.type).toBe("response");
        if (result.type === "response") {
            expect(result.a2ui).toBeUndefined();
        }
    });
});
//# sourceMappingURL=protocol.test.js.map