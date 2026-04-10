/**
 * @module @kickstart/core/tools/fetch-webpage
 *
 * Fetch a webpage and extract its text content.
 * Used by the LLM to read documentation, READMEs, and other web resources.
 */

import type { Tool } from "../types.js";

interface FetchWebpageArgs {
  url: string;
  maxLength?: number;
}

/** Allowed URL schemes — block file://, data://, etc. */
const ALLOWED_SCHEMES = ["http:", "https:"];

/** Maximum content length to return (characters). */
const DEFAULT_MAX_LENGTH = 8000;
const ABSOLUTE_MAX_LENGTH = 32000;

/** Request timeout in milliseconds. */
const FETCH_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// SSRF protection — block requests to private/internal networks
// ---------------------------------------------------------------------------

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|]$/g, "");
  if (normalized === "::1") return true;
  if (/^f[cd]/.test(normalized)) return true;
  if (normalized.startsWith("fe80")) return true;
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateIPv4(v4Mapped[1]);
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.azure.internal",
]);

function isBlockedHost(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return true;
  if (isPrivateIPv4(hostname)) return true;
  if (isPrivateIPv6(hostname)) return true;
  return false;
}

/**
 * Minimal HTML → plain text conversion.
 * Strips tags, decodes common entities, and collapses whitespace.
 */
function htmlToText(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Block elements → newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const fetchWebpage: Tool<FetchWebpageArgs> = {
  name: "fetch_webpage",
  description:
    "Fetch a webpage URL and return its text content. Use this to read documentation pages, README files, blog posts, or any public web content that helps answer user questions.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to fetch (must be http or https).",
      },
      maxLength: {
        type: "number",
        description: `Maximum number of characters to return. Defaults to ${DEFAULT_MAX_LENGTH}, max ${ABSOLUTE_MAX_LENGTH}.`,
      },
    },
    required: ["url"],
  },

  async execute(args: FetchWebpageArgs): Promise<unknown> {
    // Validate URL scheme
    let parsed: URL;
    try {
      parsed = new URL(args.url);
    } catch {
      return { error: `Invalid URL: ${args.url}` };
    }

    if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
      return { error: `URL scheme "${parsed.protocol}" is not allowed. Use http or https.` };
    }

    // SSRF protection: block private/internal hosts
    if (isBlockedHost(parsed.hostname)) {
      return { error: "Requests to private or internal network addresses are not allowed." };
    }

    const maxLen = Math.min(args.maxLength ?? DEFAULT_MAX_LENGTH, ABSOLUTE_MAX_LENGTH);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(args.url, {
        method: "GET",
        headers: {
          "User-Agent": "Kickstart-AI/1.0 (tool; fetch_webpage)",
          Accept: "text/html, text/plain, application/json, */*",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeout);

      // After redirect, validate the final URL is also not a private host
      if (res.url && res.url !== args.url) {
        try {
          const redirected = new URL(res.url);
          if (!ALLOWED_SCHEMES.includes(redirected.protocol) || isBlockedHost(redirected.hostname)) {
            return { error: "Redirect to a private or internal network address is not allowed." };
          }
        } catch {
          return { error: "Redirect resulted in an invalid URL." };
        }
      }

      if (!res.ok) {
        return {
          error: `HTTP ${res.status}: ${res.statusText}`,
          url: args.url,
        };
      }

      const contentType = res.headers.get("content-type") ?? "";
      const rawText = await res.text();

      let content: string;
      if (contentType.includes("text/html")) {
        content = htmlToText(rawText);
      } else {
        content = rawText;
      }

      const truncated = content.length > maxLen;
      if (truncated) {
        content = content.slice(0, maxLen);
      }

      return {
        url: args.url,
        contentType,
        content,
        length: content.length,
        truncated,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("abort")) {
        return { error: `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`, url: args.url };
      }
      return { error: message, url: args.url };
    }
  },
};
