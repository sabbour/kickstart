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

const A2UI_FENCE_RE = /\n?~~~a2ui\s*\n([\s\S]*?)\n~~~\s*$/;

/**
 * Process an LLM response: extract A2UI components and clean the text.
 */
export function processLLMResponse(
  rawText: string,
  phase: string,
): ProcessedResponse {
  // 1. Try to extract explicit ~~~a2ui block
  const match = rawText.match(A2UI_FENCE_RE);

  let text = rawText;
  let components: Record<string, unknown>[] = [];

  if (match) {
    text = rawText.slice(0, match.index!).trim();
    try {
      const parsed = JSON.parse(match[1]);
      components = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // JSON parse failed — keep text as-is, no explicit components
    }
  }

  // 2. Fallback: generate phase-appropriate components via heuristics
  if (components.length === 0) {
    components = inferComponents(text, phase);
  }

  return { text, components };
}

// ---------------------------------------------------------------------------
// Phase-based component inference
// ---------------------------------------------------------------------------

function inferComponents(
  text: string,
  phase: string,
): Record<string, unknown>[] {
  switch (phase) {
    case "discover":
      return inferDiscoverComponents(text);
    case "design":
      return inferDesignComponents(text);
    default:
      return [];
  }
}

function inferDiscoverComponents(
  text: string,
): Record<string, unknown>[] {
  const lower = text.toLowerCase();

  // Detect language/runtime/framework question
  if (
    lower.match(
      /what\s+(language|runtime|framework|tech)|built\s+(with|in|using)|written\s+in|which\s+(language|framework)/,
    )
  ) {
    return [
      {
        type: "Row",
        gap: "8px",
        wrap: true,
        children: [
          btn("Node.js", "It's a Node.js application"),
          btn("Python", "It's a Python application"),
          btn(".NET / C#", "It's a .NET / C# application"),
          btn("Java", "It's a Java application"),
          btn("Go", "It's a Go application"),
          btn("Rust", "It's a Rust application"),
        ],
      },
    ];
  }

  // Detect existing code / repo question
  if (
    lower.match(
      /existing\s+(code|repo|project)|already\s+have|have\s+a?\s*repo|starting\s+fresh|from\s+scratch|where.+(code|source)/,
    )
  ) {
    return [
      {
        type: "Row",
        gap: "8px",
        wrap: true,
        children: [
          btn("I have a GitHub repo", "I have an existing GitHub repository"),
          btn("I have local code", "I have local code on my machine"),
          btn("Starting fresh", "I'm starting fresh — no existing code yet"),
        ],
      },
    ];
  }

  // Detect "what does it do" / description question (first question typically)
  if (
    lower.match(
      /what\s+(are\s+you\s+building|does\s+(it|your\s+app)\s+do|kind\s+of\s+app)|tell\s+me\s+about\s+your\s+app|describe/,
    )
  ) {
    return [
      {
        type: "Row",
        gap: "8px",
        wrap: true,
        children: [
          btn("Web API / backend service", "I'm building a web API / backend service"),
          btn("Full-stack web app", "I'm building a full-stack web application"),
          btn("AI-powered agent", "I'm building an AI-powered agent or chatbot"),
          btn("Microservices", "I'm building a microservices architecture"),
        ],
      },
    ];
  }

  return [];
}

function inferDesignComponents(
  text: string,
): Record<string, unknown>[] {
  const lower = text.toLowerCase();

  if (lower.match(/database|data\s+store|persistence|storage.*data/)) {
    return [
      {
        type: "Row",
        gap: "8px",
        wrap: true,
        children: [
          btn("PostgreSQL", "I need PostgreSQL"),
          btn("MongoDB / Cosmos DB", "I need MongoDB or Cosmos DB"),
          btn("MySQL", "I need MySQL"),
          btn("No database", "No database needed"),
        ],
      },
    ];
  }

  if (lower.match(/cache|caching|redis/)) {
    return [
      {
        type: "Row",
        gap: "8px",
        wrap: true,
        children: [
          btn("Yes, Redis", "Yes, I need Redis for caching"),
          btn("No caching needed", "No caching needed"),
        ],
      },
    ];
  }

  if (lower.match(/public\s+url|accessible.*internet|external.*traffic|public.*endpoint/)) {
    return [
      {
        type: "Row",
        gap: "8px",
        wrap: true,
        children: [
          btn("Yes, public URL", "Yes, it needs a public URL"),
          btn("Internal only", "No, internal only — no public access"),
        ],
      },
    ];
  }

  if (lower.match(/ai|llm|openai|language\s+model|machine\s+learning/)) {
    return [
      {
        type: "Row",
        gap: "8px",
        wrap: true,
        children: [
          btn("Azure OpenAI", "I want to use Azure OpenAI"),
          btn("Self-hosted models with Kubernetes AI Toolkit Operator (KAITO)", "I want to self-host an open model with the Kubernetes AI Toolkit Operator (KAITO)"),
          btn("No AI features", "No AI/LLM features needed"),
        ],
      },
    ];
  }

  return [];
}

// Helper: create a suggestion button using A2UI v0.9 ActionSchema format.
// Note: This targets the web surface's ActionSchema (event.context), not
// @kickstart/harness's ButtonAction type (event.data). Keep in sync with
// packages/web/src/vendor/a2ui/web_core/schema/common-types.ts.
function btn(
  label: string,
  replyText: string,
): Record<string, unknown> {
  return {
    type: "Button",
    label,
    action: {
      event: {
        name: "reply",
        context: { text: replyText },
      },
    },
  };
}
