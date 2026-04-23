# Zapp PR #556 Security Review

Verdict: BLOCK

## Scope reviewed
- PR #556 (`feat(pack-aks-automatic): Step 8 — AKS pack (#483)`)
- DP security thread on issue #483, including Zapp's blocked review and re-check conditions

## What passed
- `kubectl` invocation uses `execFile` with an argument array, not `exec` / shell interpolation (`packages/pack-aks-automatic/src/tools/validate-manifests.ts:141-147`).
- The manifest path passed to `kubectl` is generated internally via `mkdtemp(...)/manifest.yaml`, so there is no user-controlled path traversal into `execFile` (`packages/pack-aks-automatic/src/tools/validate-manifests.ts:134-139`).
- `safeguards.json` is loaded at module init and frozen with `Object.freeze()` on both the array and each copied rule object (`packages/pack-aks-automatic/src/tools/validate-safeguards.ts:20-27`).
- `ArchitectureDiagram` does not use `dangerouslySetInnerHTML`; it sanitizes Mermaid input, uses Mermaid `securityLevel: 'antiscript'`, strips `<script>` tags and `on*` attributes before inserting the SVG (`packages/pack-aks-automatic/src/components/ArchitectureDiagram/architectureDiagramUtils.ts:268-307`, `packages/pack-aks-automatic/src/components/ArchitectureDiagram/index.tsx:212-223`).
- I found no `eval()`, `new Function`, or pack-local `fetch()` calls with user-controlled URLs in `packages/pack-aks-automatic`.
- I found no pack-local reads of deployment credentials from browser props or action payloads; Azure token handling remains in `pack-azure` session context helpers.

## Blocking findings

### 1. High — `kubectl` absence fails open
`validate-manifests` explicitly downgrades missing `kubectl` to a warning instead of a hard failure (`packages/pack-aks-automatic/src/tools/validate-manifests.ts:179-193`). That means the tool can return `valid: true` even when the server lacks the binary required for the server-side dry-run check.

Security impact: this weakens the DP condition around safe `kubectl` validation. In environments without `kubectl`, malformed or dangerous manifests can appear successfully validated as long as the lightweight regex checks do not catch them.

Required fix: if `kubectl` is unavailable, return `valid: false` (or otherwise fail closed) for this validation path.

### 2. High — privileged-escalation coverage is incomplete
The pack's tool-stage guardrail named `no-privileged-containers` only blocks `securityContext.privileged: true` (`packages/pack-aks-automatic/src/guardrails/no-privileged-containers.ts:38-47`). It does not block `securityContext.allowPrivilegeEscalation: true`, and neither the guardrails nor `safeguards.json` cover `capabilities.add` escalation paths (`packages/pack-aks-automatic/src/safeguards.json:2-50`).

Security impact: an agent can still write a manifest that materially escalates privileges without tripping the guardrail layer. This leaves a real pre-deploy enforcement gap for Restricted-style AKS posture.

Required fix: extend enforcement to cover at least:
- `securityContext.allowPrivilegeEscalation: true`
- `securityContext.capabilities.add`
- any equivalent container-level privilege-escalation paths the pack intends to prohibit

## Non-blocking note
- `aks:deploy` requires `clusterName`, `resourceGroup`, and `subscription` in `resultSchema`, but the fields are still free-form strings (`packages/pack-aks-automatic/src/user-actions/deploy.ts:15-53`). I did not find a server-side `az aks` implementation in this PR, so cluster/resource-group/subscription format validation is still outstanding at the eventual deployment execution layer.

## Validation run
- `npx vitest run packages/pack-aks-automatic/src/tools/*.test.ts` ✅ (19/19)
- `npm run build --workspace @kickstart/pack-aks-automatic` ✅
