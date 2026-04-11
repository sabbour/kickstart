/**
 * @module @kickstart/api/lib/response-processor
 *
 * Post-processes LLM responses to extract A2UI components.
 *
 * Two strategies:
 * 1. Explicit: The LLM includes a ~~~a2ui fenced block → parsed and extracted.
 * 2. Heuristic: No block found → phase-aware analysis generates components
 *    (suggestion buttons, option cards) from the response text.
 */
export interface ProcessedResponse {
    /** Clean text with A2UI markers stripped. */
    text: string;
    /** Extracted or inferred A2UI components. */
    components: Record<string, unknown>[];
}
/**
 * Process an LLM response: extract A2UI components and clean the text.
 */
export declare function processLLMResponse(rawText: string, phase: string): ProcessedResponse;
//# sourceMappingURL=response-processor.d.ts.map