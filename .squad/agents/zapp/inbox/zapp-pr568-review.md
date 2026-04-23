**PR:** #568 — `feat(pack-github): Step 9 — GitHub pack (#484)`
**Reviewer:** Zapp (Security Architect)
**Verdict:** **BLOCK**

## Blocking findings

1. **High — `github.api_get` does not enforce the promised path allowlist**
   - `validateGithubPath()` is defined but never called from `apiGetTool.execute()`.
   - `execute()` builds `new URL(`${GITHUB_API_BASE}${input.path}`)` directly and returns `response.json()` raw.
   - Evidence: `packages/pack-github/src/tools/api-get.ts:27-44`, `73-105`.
   - Impact: the agent can query arbitrary GitHub API endpoints available to the session token, which violates the DP’s narrowed-tool-surface condition.

2. **High — the allowlist is the wrong control even on paper**
   - `GITHUB_PATH_ALLOWLIST` matches repo-style file paths like `README.md`, `docs/...`, `.github/...`, not GitHub REST API paths like `/repos/{owner}/{repo}`.
   - Evidence: `packages/pack-github/src/tools/api-get.ts:12-20`, tool schema description at `50-59`.
   - Impact: the claimed Zapp condition is not actually implemented for the exposed API tool.

3. **Critical — `setRepositorySecret()` does not encrypt secrets correctly**
   - The code uses `btoa(secretValue)` with a comment that real encryption still needs tweetnacl/libsodium.
   - Evidence: `packages/pack-github/src/services/github-handoff.ts:180-195`.
   - Impact: base64 is not encryption. If this path is wired, repository secrets would be mishandled and the GitHub API contract is not met.

4. **Medium — `no-secret-exposure` is fail-open on serialization error**
   - On `JSON.stringify(payload)` failure, the guardrail returns `{ kind: 'pass' }`.
   - Evidence: `packages/pack-github/src/guardrails/no-secret-exposure.ts:27-35`.
   - Impact: the secret-blocking guard does not fail closed as required.

## Additional notes

- **Token serialization:** good so far. Token access appears limited to `session.tokens?.['github']` inside the tool, and I did not find token props or tool parameters. Evidence: `packages/pack-github/src/tools/api-get.ts:74-80`.
- **Browser trust boundary:** `github-handoff.browser.ts` is browser-only and does not use localStorage/sessionStorage, but redirect-mode callback parsing (`parseOAuthCallback`) does not validate an expected `state`. Popup flow does compare `state`. Evidence: `packages/pack-github/src/services/github-handoff.browser.ts:65-116`.
- **`set_secret` user action:** the declared result schema excludes the secret value, which is good, but the PR does not include an implemented secret-capture/submit path to prove the “direct to resume endpoint” claim. Evidence: `packages/pack-github/src/user-actions/set-secret.ts`, `packages/pack-github/src/components/SecretSetter/index.tsx`.

## Validation

- `npx vitest run packages/pack-github/src/__tests__/registration.test.ts packages/pack-github/src/__tests__/github-handoff.test.ts packages/pack-github/src/__tests__/create-pr.test.ts packages/pack-github/src/tools/api-get.test.ts` ✅ (41 passed)
- `npm test` at repo root shows pre-existing unrelated failures in `packages/mcp-server` phase tests; not caused by this PR.
