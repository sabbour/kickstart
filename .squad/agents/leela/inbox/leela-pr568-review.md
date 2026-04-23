# Leela — PR #568 Architecture Review
**PR:** feat(pack-github): Step 9 — GitHub pack (#484)
**Branch:** squad/484-pack-github
**Date:** 2025-07-18
**Verdict: BLOCK**

---

## Summary

The pack structure is solid. Manifest is complete, token isolation is correct, `github-handoff.browser.ts` is properly isolated, all 6 user actions have typed `resultSchema`, the guardrail covers the right patterns, and 3 SKILL.md files have valid frontmatter. The bulk of the work is done right.

However, there are two **blocking** defects in `src/tools/api-get.ts` that must be fixed before merge. Both are in the same file; the fix is small.

---

## Blocking Issues

### B1 — `validateGithubPath` is dead code (never called in `execute()`)

`validateGithubPath` is defined and exported at line 27. It has 16 tests. It is **never called** in the `execute()` function.

`execute()` (line 73) builds the URL as:
```ts
const url = new URL(`${GITHUB_API_BASE}${input.path}`);
```

`input.path` goes in with zero validation. This defeats both Zapp's SSRF condition and Leela's C1.

**SSRF vector:** `input.path = '@evil.com/path'` → `new URL('https://api.github.com@evil.com/path')` resolves to host `evil.com`. The `@` character is not in `[\w\-. ]`, so `validateGithubPath` would catch it — but it's never called.

**Fix:**
```ts
execute: async (input, runCtx): Promise<unknown> => {
  const validatedPath = validateGithubPath(input.path);  // add this line
  const session = ...
  ...
  const url = new URL(`${GITHUB_API_BASE}${validatedPath}`);  // use validatedPath
```

### B2 — `GITHUB_PATH_ALLOWLIST` patterns are file-path patterns, not REST API endpoint patterns

The 7 patterns guard file paths like `README.md`, `src/index.ts`, `.github/workflows/ci.yml`. **None of them match GitHub REST API paths** because:

1. All patterns are anchored and require no leading `/`
2. None handle the `{owner}/{repo}` segment structure that all API paths use

Example: `/repos/acme/aks-deploy` fails every one of the 7 patterns because it starts with `/` and contains no file extension root. The tool's own parameter description says "Must start with /." — meaning `validateGithubPath` would always throw on a valid API path, which is why it was never connected.

**Fix:** Replace the 7 file-path patterns with REST API endpoint patterns. At minimum, the 4 patterns Leela required in C1 plus the base cases:

```ts
export const GITHUB_API_PATH_ALLOWLIST = [
  /^\/user$/,                                                // GET /user
  /^\/user\/repos(\?.*)?$/,                                 // C1: list user repos
  /^\/users\/[\w.\-]+$/,                                    // GET /users/{username}
  /^\/repos\/[\w.\-]+\/[\w.\-]+(\/[\w.\-/]*)?(\?.*)?$/,    // /repos/{owner}/{repo}/...
  /^\/repos\/[\w.\-]+\/[\w.\-]+\/pulls\/[0-9]+(\?.*)?$/,   // C1: PR detail
  /^\/repos\/[\w.\-]+\/[\w.\-]+\/actions\/runs\/[0-9]+(\?.*)?$/, // C1: run detail
  /^\/repos\/[\w.\-]+\/[\w.\-]+\/branches(\?.*)?$/,        // C1: branch list
];
```

The file-path allowlist (if still needed for a future file-content tool) belongs in that tool, not here.

---

## Passing Checks

| Check | Status | Notes |
|---|---|---|
| Pack manifest (`Pack` object) | ✅ | All agents/skills/tools/userActions/components/guardrails registered |
| `github-handoff.browser.ts` isolation | ✅ | Browser-only APIs; not imported from any `execute()` or server module |
| `tokens['github']` canonical key | ✅ | `session.tokens?.['github']` everywhere; no flat `githubToken` field |
| Token never in SSE/packs/LLM output | ✅ | Guardrail + no serialization in any handler |
| `decodeURIComponent` before checks | ✅ | Applied before both allowlist and FORBIDDEN_SEQ |
| FORBIDDEN_SEQ defined | ✅ | Covers `..`, `%2e%2e`, `%252e`, `//`, `\` |
| User actions: 6 approved actions | ✅ | login, pick_org, pick_repo, create_repo, create_pr, set_secret |
| All user actions have `resultSchema` | ✅ | Zod schemas present and tested |
| `github:create_pr` parameters schema | ✅ | C3 addressed: `owner`, `repo`, `targetBranch`, `files`, `prTitle` (max 255), `prBody` |
| `no-secret-exposure` guardrail | ✅ | Output stage; blocks `ghp_`, `github_pat_`, `gho_`, `ghs_`, `ghr_`, Bearer |
| 3 SKILL.md files with frontmatter | ✅ | `id`, `name`, `description`, `version`, `author`, `license`, `x-kickstart` |
| `@kickstart/pack-github` in monorepo | ✅ | In `package-lock.json` workspace |
| C4 (tokens shape coordination) | ✅ | `tokens: Record<string, string>` used throughout |

---

## Required Fix (both in `src/tools/api-get.ts`)

1. Replace `GITHUB_PATH_ALLOWLIST` (7 file-path patterns) with `GITHUB_API_PATH_ALLOWLIST` (REST API endpoint patterns, including the 4 from C1).
2. Call `validateGithubPath(input.path)` at the top of `execute()`, use the returned decoded path.
3. Update tests: the path validation tests currently pass file paths (`README.md`, `src/index.ts`); replace them with API path tests (`/user`, `/repos/acme/repo`, `/user/repos`, etc.).

Both B1 and B2 are in the same file; this is a focused, contained fix. The rest of the PR is merge-ready.

— Leela (Lead Architect)
