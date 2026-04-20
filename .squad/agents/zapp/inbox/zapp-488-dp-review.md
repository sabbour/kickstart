**Zapp — Security Review of #488 DP**

**Working as:** Zapp (Security Architect)
**Verdict:** APPROVE_WITH_CONDITIONS

Security summary: low runtime risk because this is docs-only, but the cleanup scope still has two real security-hygiene gaps. I approve the DP provided the docs sweep also removes environment-specific Azure identifiers from existing docs and the new API/reference docs explicitly preserve the already-decided v2 security contracts.

## Findings

1. **🟡 Minor — environment-specific identifiers remain in docs and should be scrubbed during cleanup**
   - `DEVELOPMENT.md` currently shows a concrete `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`.
   - `infra/README.md` currently publishes a concrete subscription ID, tenant ID, client ID, object ID, issuer, and tenant domain.
   - These are not secrets in the same class as client secrets or API keys, but they are still unnecessary real environment identifiers and should be replaced with placeholders as part of the docs cleanup.

2. **🟡 Minor — `harness-api-reference.md` must carry forward explicit security constraints**
   The proposed API reference should document, not imply:
   - MCP/tool exposure is default-deny / explicit allowlist only.
   - `requiresSession:true` tools are excluded from the MCP manifest.
   - UserActions stay off the MCP manifest.
   - `SessionCtx.tokens` is never serialized to `/api/packs`, SSE events, or LLM context payloads.
   - Guardrail and validation failures fail closed.

3. **✅ No security-sensitive deletions identified in the listed v1 docs**
   - The proposed deletions are architecture/process docs for v1 concepts, plus temporary QA artifacts.
   - I did not find a threat model, security policy, responsible disclosure doc, or security decision record in the delete list that must be preserved verbatim.

4. **✅ Preserve security-relevant contribution guidance**
   - Keep the existing guidance that `local.settings.json` must never be committed.
   - Keep docs pointing secrets to app settings / Key Vault rather than repo files.

5. **⚪ Migration note if added**
   - If Step 13 introduces a migration guide, it should call out the security-significant contract changes: token storage/serialization boundary, stateless-only MCP exposure, and `requiresSession` exclusions.

## Threat model (docs step)

| Threat | Finding |
|--------|---------|
| Spoofing | No new auth surface in this DP. |
| Tampering | Risk is documentation drift if the new API docs omit security constraints. |
| Repudiation | No audit-path change. |
| Information Disclosure | Minor current risk from published real tenant/subscription/client identifiers in docs. |
| Denial of Service | None introduced by docs-only work. |
| Elevation of Privilege | None introduced if the MCP/API docs preserve default-deny + fail-closed guidance. |

## Conditions

- Scrub real Azure environment identifiers from `DEVELOPMENT.md` and `infra/README.md` during the cleanup sweep.
- Make `docs/harness-api-reference.md` explicitly document the v2 security invariants listed above.
- Preserve the "never commit local.settings.json" / secrets-out-of-repo guidance in `CONTRIBUTING.md` and docs-site equivalents.

— Zapp (Security Architect)
