/**
 * SSE event recorder and ActualOutput extractor.
 *
 * Collects all SSE events emitted during a harness run and produces an
 * `ActualOutput` suitable for `scoreSimRun()`.
 *
 * ## Recipe detection (Phase 1 heuristics)
 *
 * Recipe IDs are inferred from the text content of `a2ui` component payloads
 * using keyword patterns derived from `config/recipes.json`. This is
 * intentionally fuzzy for Phase 1 — the human reviewer is the final judge.
 * Phase 2+ will wire in explicit recipe metadata from the agent's `emit_ui`
 * call once the harness exposes that signal.
 *
 * ## Question counting
 *
 * A question is counted when a `chunk` event contains a sentence that ends
 * with `?`. Chunks are accumulated and scanned per-turn.
 *
 * ## Behaviour detection
 *
 * Behaviours are detected from the accumulated output using text patterns:
 *   - `zero-questions`: questionCount === 0 at turn end
 *   - `r17-close`: recipe R17 detected
 *   - Any recipe emission triggers a matching `r{id}-close` behaviour
 */

import type { ActualOutput, ActualToolCall, ActualRecipeEmission } from './types.js';

// SSEEventType is a string union; define it inline here to avoid a build-time
// dependency on the harness dist/ artefacts when running with tsx.
type SSEEventType = string;

/** One recorded SSE event (type + raw data). */
export interface RecordedEvent {
  type: SSEEventType;
  data: unknown;
  turn: number;
}

// ---------------------------------------------------------------------------
// Recipe detection patterns
// ---------------------------------------------------------------------------

/**
 * Maps recipe IDs to keyword patterns found in their rendered text content.
 * Lower-case for case-insensitive matching.
 */
const RECIPE_PATTERNS: Array<{ id: string; patterns: string[] }> = [
  { id: 'R17', patterns: ['where to next', 'where do you want to go', 'next surface', 'what you can do next'] },
  { id: 'R7',  patterns: ["what i'm doing for you", 'what i am doing for you', 'invisible work'] },
  { id: 'R20', patterns: ['cold start', 'cold-start', 'scale to zero latency', 'wake-up latency', 'keda scale'] },
  { id: 'R1',  patterns: ['plan summary', 'deployment plan', 'here is the plan', "here's the plan"] },
  { id: 'R2',  patterns: ['multi-card plan', 'multiple services', 'architecture overview'] },
  { id: 'R3',  patterns: ['migration mapping', 'paas to azure', 'render → azure', 'heroku → azure', 'vercel → azure'] },
  { id: 'R5',  patterns: ['diff plan', 'what changes', 'what will change'] },
  { id: 'R6',  patterns: ['why this stack', 'why aks', 'rationale', 'why we chose'] },
  { id: 'R8',  patterns: ['reshape', 'switching track', 'track flip'] },
  { id: 'R9',  patterns: ['review pack', 'handover pack', 'for review'] },
  { id: 'R16', patterns: ['quota check', 'quota preflight', 'subscription quota'] },
  { id: 'R18', patterns: ['cross-artifact', 'dependency check', 'also affects'] },
  { id: 'R19', patterns: ['honest substitution', 'substitution card', 'not available', 'not supported'] },
];

/** Extract plain text from any component/data payload (recursive). */
function extractText(obj: unknown, depth = 0): string {
  if (depth > 10) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) return obj.map((item) => extractText(item, depth + 1)).join(' ');
  if (obj && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>)
      .map((v) => extractText(v, depth + 1))
      .join(' ');
  }
  return '';
}

/** Detect recipe IDs from a single a2ui event payload. */
function detectRecipesFromA2UI(data: unknown): string[] {
  const text = extractText(data).toLowerCase();
  const found: string[] = [];
  for (const { id, patterns } of RECIPE_PATTERNS) {
    if (patterns.some((p) => text.includes(p))) {
      found.push(id);
    }
  }
  return found;
}

/** Count questions in accumulated chunk text (sentences ending with `?`). */
function countQuestionsInText(text: string): number {
  // Split on sentence-ending punctuation and count '?' terminators
  const sentences = text.split(/(?<=[.!?])\s+|(?<=[.!?])$/);
  return sentences.filter((s) => s.trim().endsWith('?')).length;
}

// ---------------------------------------------------------------------------
// Recorder
// ---------------------------------------------------------------------------

export class SimRecorder {
  private events: RecordedEvent[] = [];
  private currentTurn = 0;
  private toolCallIndex = 0;

  // Accumulated state
  private toolCalls: ActualToolCall[] = [];
  private recipeIds = new Set<string>();
  private chunkBuffer = '';
  private questionCount = 0;

  /**
   * Returns an SSEWriter-compatible function that records all events.
   * Pass this as the `sseWrite` argument to `runner.run()`.
   */
  writer(): (event: SSEEventType, data: unknown) => void {
    return (event, data) => {
      this.events.push({ type: event, data, turn: this.currentTurn });
      this.processEvent(event, data);
    };
  }

  private processEvent(event: SSEEventType, data: unknown): void {
    switch (event) {
      case 'start':
        this.chunkBuffer = '';
        break;

      case 'tool_start': {
        const d = data as { toolName?: string; name?: string };
        const name = d.toolName ?? d.name ?? 'unknown';
        this.toolCalls.push({ name, index: this.toolCallIndex++ });
        break;
      }

      case 'a2ui': {
        const found = detectRecipesFromA2UI(data);
        for (const id of found) this.recipeIds.add(id);
        break;
      }

      case 'chunk': {
        const d = data as { delta?: string; content?: string };
        const text = d.delta ?? d.content ?? (typeof data === 'string' ? data : '');
        this.chunkBuffer += text;
        break;
      }

      case 'end': {
        // Count questions in the accumulated chunk buffer for this turn
        this.questionCount += countQuestionsInText(this.chunkBuffer);
        this.chunkBuffer = '';
        this.currentTurn++;
        break;
      }

      default:
        break;
    }
  }

  /**
   * Finalise the recording and derive the `ActualOutput`.
   * May be called at any point; subsequent events are still processed.
   */
  toActualOutput(): ActualOutput {
    // Flush any remaining chunks
    if (this.chunkBuffer) {
      this.questionCount += countQuestionsInText(this.chunkBuffer);
      this.chunkBuffer = '';
    }

    const recipesEmitted: ActualRecipeEmission[] = Array.from(this.recipeIds)
      .map((recipeId) => ({ recipeId }));

    // Auto-derive behaviours from collected signals
    const behaviorsObserved: string[] = [];
    if (this.questionCount === 0) behaviorsObserved.push('zero-questions');
    if (this.recipeIds.has('R17')) behaviorsObserved.push('r17-close');
    if (this.recipeIds.has('R20')) behaviorsObserved.push('cold-start-card');
    if (this.recipeIds.has('R7')) behaviorsObserved.push('invisible-work-surface');

    // Behaviour for migration-readiness: aks.reviewer was called
    const reviewerCalled = this.toolCalls.some((tc) =>
      tc.name.includes('reviewer') || tc.name.includes('review'),
    );
    if (reviewerCalled) behaviorsObserved.push('review-card-emitted');

    return {
      toolCalls: [...this.toolCalls],
      recipesEmitted,
      questionCount: this.questionCount,
      behaviorsObserved,
    };
  }

  /** All recorded SSE events (for full transcript logging). */
  allEvents(): readonly RecordedEvent[] {
    return this.events;
  }

  /** Reset the recorder for a new conversation turn. */
  reset(): void {
    this.events = [];
    this.currentTurn = 0;
    this.toolCallIndex = 0;
    this.toolCalls = [];
    this.recipeIds.clear();
    this.chunkBuffer = '';
    this.questionCount = 0;
  }
}
