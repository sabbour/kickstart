/**
 * @module @kickstart/api/functions/inspirations
 *
 * GET /api/inspirations — Returns carousel inspiration ideas for the landing page.
 * GET /api/inspirations?stream=true — Streams a single inspiration idea token-by-token.
 *
 * If Azure OpenAI is configured, generates creative app ideas via LLM.
 * Otherwise, returns a shuffled subset of hardcoded fallback ideas.
 *
 * Environment variables:
 *   AZURE_OPENAI_INSPIRE_DEPLOYMENT — Optional. Dedicated deployment for inspiration
 *     generation (e.g., gpt-5.4-nano for fast/cheap calls). Falls back to
 *     AZURE_OPENAI_CHAT_DEPLOYMENT → AZURE_OPENAI_DEPLOYMENT if not set.
 */
export {};
//# sourceMappingURL=inspirations.d.ts.map