/**
 * @module @aks-kickstart/api/lib/content-safety
 *
 * Lightweight LLM-based content safety pre-flight check for user input.
 * Uses minimal tokens to keep the check fast and cheap.
 * Gracefully skips if Azure OpenAI is not configured.
 */

import { chatCompletion, isConfigured } from "./openai-client.js";

export interface ContentSafetyResult {
  safe: boolean;
  error?: string;
}

/**
 * Check whether a user message is appropriate for a professional
 * software development context. Returns `{ safe: true }` if the
 * message passes, or `{ safe: false, error }` if it doesn't.
 *
 * If Azure OpenAI is not configured, the check is skipped (returns safe).
 */
export async function checkContentSafety(
  message: string,
): Promise<ContentSafetyResult> {
  if (!isConfigured()) {
    return { safe: true };
  }

  try {
    const result = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are a content safety classifier. Determine if the user message is requesting to build something harmful, illegal, violent, sexually explicit, or otherwise inappropriate for a professional software development context. Reply with ONLY the word 'safe' or 'unsafe'. No explanation.",
        },
        {
          role: "user",
          content: message,
        },
      ],
      { temperature: 0, maxTokens: 10 },
    );

    const verdict = result.content.trim().toLowerCase();
    if (verdict === "unsafe") {
      return {
        safe: false,
        error:
          "Your request contains content that falls outside our acceptable use guidelines. Please describe a software application or service idea.",
      };
    }

    return { safe: true };
  } catch {
    // If the safety check itself fails, don't block the user
    return { safe: true };
  }
}
