/**
 * B-23 — Wire A2UI action handler
 *
 * Tests for the extended action dispatch that handles A2UI ActionSchema events:
 *   • "reply"    → converts to conversation message (re-prompt LLM)
 *   • "navigate" → triggers phase transitions
 *   • "api"      → stubbed but must not crash
 *   • unknown    → handled gracefully (no crash, error message)
 *   • past-turn  → actions from expired/past turns are ignored
 *
 * These tests are written ahead of implementation (TDD).
 * They will fail until Bender lands the action handler wiring.
 */
export {};
//# sourceMappingURL=action-handler.test.d.ts.map