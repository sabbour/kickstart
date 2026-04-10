/**
 * @module @kickstart/core/__tests__/github-security
 *
 * Tests for the two security hardening additions:
 *   1. Path/ref input validation (github-input-validation.ts)
 *   2. GitHub API rate-limit guard (github-rate-limit.ts)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { validatePath, validateRef } from "../tools/github-input-validation.js";
import { gitHubRateLimiter } from "../connectors/github-rate-limit.js";

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

describe("validatePath", () => {
  it("accepts a simple file name", () => {
    expect(validatePath("Dockerfile")).toEqual({ valid: true });
  });

  it("accepts a nested path", () => {
    expect(validatePath("src/index.ts")).toEqual({ valid: true });
  });

  it("accepts a deeply nested path", () => {
    expect(validatePath(".github/workflows/ci.yml")).toEqual({ valid: true });
  });

  it("rejects empty path", () => {
    const r = validatePath("");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("empty");
  });

  it("rejects path traversal with ../", () => {
    const r = validatePath("../../../etc/passwd");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("traversal");
  });

  it("rejects path traversal in the middle", () => {
    const r = validatePath("src/../../../etc/shadow");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("traversal");
  });

  it("rejects absolute paths", () => {
    const r = validatePath("/etc/passwd");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("relative");
  });

  it("rejects null bytes", () => {
    const r = validatePath("file\x00.txt");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("forbidden");
  });

  it("rejects current-directory segment", () => {
    const r = validatePath("./src/index.ts");
    expect(r.valid).toBe(false);
    expect(r.error).toContain(".");
  });

  it("rejects control characters", () => {
    const r = validatePath("file\x07name");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("forbidden");
  });
});

// ---------------------------------------------------------------------------
// Ref validation
// ---------------------------------------------------------------------------

describe("validateRef", () => {
  it("accepts HEAD", () => {
    expect(validateRef("HEAD")).toEqual({ valid: true });
  });

  it("accepts a 40-char lowercase hex SHA", () => {
    expect(validateRef("abc123def456789012345678901234567890abcd")).toEqual({
      valid: true,
    });
  });

  it("accepts a simple branch name", () => {
    expect(validateRef("main")).toEqual({ valid: true });
  });

  it("accepts branch names with slashes", () => {
    expect(validateRef("feature/my-thing")).toEqual({ valid: true });
  });

  it("accepts branch names with dots", () => {
    expect(validateRef("release-1.0")).toEqual({ valid: true });
  });

  it("accepts a tag name like v1.0.0", () => {
    expect(validateRef("v1.0.0")).toEqual({ valid: true });
  });

  it("rejects empty ref", () => {
    const r = validateRef("");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("empty");
  });

  it("rejects double-dot path traversal", () => {
    const r = validateRef("main/../secrets");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("..");
  });

  it("rejects .lock suffix", () => {
    const r = validateRef("branch.lock");
    expect(r.valid).toBe(false);
    expect(r.error).toContain(".lock");
  });

  it("rejects leading slash", () => {
    const r = validateRef("/main");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("start or end with '/'");
  });

  it("rejects trailing slash", () => {
    const r = validateRef("main/");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("start or end with '/'");
  });

  it("rejects leading dot", () => {
    const r = validateRef(".hidden");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("start or end with '.'");
  });

  it("rejects whitespace", () => {
    const r = validateRef("main branch");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("forbidden");
  });

  it("rejects null bytes", () => {
    const r = validateRef("main\x00");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("forbidden");
  });

  it("rejects special characters like ~", () => {
    const r = validateRef("main~1");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("invalid characters");
  });
});

// ---------------------------------------------------------------------------
// Rate-limit tracker
// ---------------------------------------------------------------------------

describe("gitHubRateLimiter", () => {
  beforeEach(() => {
    gitHubRateLimiter.reset();
  });

  it("allows requests when no state has been recorded", () => {
    const check = gitHubRateLimiter.check();
    expect(check.allowed).toBe(true);
    expect(check.state).toBeNull();
  });

  it("allows requests when remaining is high", () => {
    const resetAt = Math.floor(Date.now() / 1000) + 3600;
    const headers = new Headers({
      "X-RateLimit-Limit": "5000",
      "X-RateLimit-Remaining": "4500",
      "X-RateLimit-Reset": String(resetAt),
    });
    gitHubRateLimiter.update({ headers } as unknown as Response);

    const check = gitHubRateLimiter.check();
    expect(check.allowed).toBe(true);
    expect(check.warning).toBeUndefined();
    expect(check.state?.remaining).toBe(4500);
  });

  it("warns when remaining is below threshold", () => {
    const resetAt = Math.floor(Date.now() / 1000) + 3600;
    const headers = new Headers({
      "X-RateLimit-Limit": "5000",
      "X-RateLimit-Remaining": "30",
      "X-RateLimit-Reset": String(resetAt),
    });
    gitHubRateLimiter.update({ headers } as unknown as Response);

    const check = gitHubRateLimiter.check();
    expect(check.allowed).toBe(true);
    expect(check.warning).toContain("low");
    expect(check.warning).toContain("30");
  });

  it("blocks when remaining is 0 and reset is in the future", () => {
    const resetAt = Math.floor(Date.now() / 1000) + 3600;
    const headers = new Headers({
      "X-RateLimit-Limit": "5000",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(resetAt),
    });
    gitHubRateLimiter.update({ headers } as unknown as Response);

    const check = gitHubRateLimiter.check();
    expect(check.allowed).toBe(false);
    expect(check.warning).toContain("exhausted");
  });

  it("allows requests after the reset window has passed", () => {
    const resetAt = Math.floor(Date.now() / 1000) - 10; // 10 seconds ago
    const headers = new Headers({
      "X-RateLimit-Limit": "5000",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(resetAt),
    });
    gitHubRateLimiter.update({ headers } as unknown as Response);

    const check = gitHubRateLimiter.check();
    expect(check.allowed).toBe(true);
  });

  it("ignores responses without rate-limit headers", () => {
    const headers = new Headers({ "Content-Type": "application/json" });
    gitHubRateLimiter.update({ headers } as unknown as Response);

    expect(gitHubRateLimiter.state).toBeNull();
  });

  it("reset() clears internal state", () => {
    const resetAt = Math.floor(Date.now() / 1000) + 3600;
    const headers = new Headers({
      "X-RateLimit-Limit": "5000",
      "X-RateLimit-Remaining": "100",
      "X-RateLimit-Reset": String(resetAt),
    });
    gitHubRateLimiter.update({ headers } as unknown as Response);
    expect(gitHubRateLimiter.state).not.toBeNull();

    gitHubRateLimiter.reset();
    expect(gitHubRateLimiter.state).toBeNull();
  });
});
