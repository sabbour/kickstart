/**
 * @module @kickstart/api/functions/converse
 *
 * POST /api/converse — Main LLM proxy endpoint for the web surface.
 *
 * Accepts a user message, manages session state, calls Azure OpenAI with
 * response_format: json_object, and returns the response as typed SSE events.
 * The LLM outputs a JSON envelope: { message, a2ui, actions }.
 */
export {};
//# sourceMappingURL=converse.d.ts.map