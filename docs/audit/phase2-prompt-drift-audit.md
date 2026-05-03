# Phase 2 Prompt Drift Audit

**Author:** Hermes (Tester + Observability)  
**Date:** 2026-05-02  
**Issue:** #228  
**Scope:** All 9 `*.agent.md` files vs. AKS Automatic grounding decisions (D1–D14), constraint-spec v1.1.1, and tool registration state.

---

## Summary

| File | Drift Items | Severity | Status |
|------|-------------|----------|--------|
| `pack-azure/azure-architect.agent.md` | 1 | HIGH | ⏳ Fix in PR #375 (open) |
| `pack-github/github.publisher.agent.md` | 1 | MEDIUM | ✅ Fixed in this PR |
| `pack-aks-automatic/aks-manifests-author.agent.md` | 1 | LOW (informational) | ✅ No action needed |
| `pack-core/reviewer.agent.md` | 0 | — | ✅ Clean (PR #379) |
| `pack-core/codesmith.agent.md` | 0 | — | ✅ Clean |
| `pack-core/triage.agent.md` | 0 | — | ✅ Clean |
| `pack-aks-automatic/aks-architect.agent.md` | 0 | — | ✅ Clean |
| `pack-aks-automatic/aks-reviewer.agent.md` | 0 | — | ✅ Clean |
| `pack-azure/azure-ops.agent.md` | 0 | — | ✅ Clean |
| `pack-github/github.publisher.agent.md` | 0 remaining | — | ✅ Fixed |

---

## Per-File Findings

### 1. `packages/pack-azure/src/agents/azure-architect.agent.md`

**Drift item:** ArchitectureDiagram node in plan-summary exemplar uses deprecated label.

```json
{"id":"ingress","label":"Ingress Controller","type":"networking"}
```

This references the deprecated Ingress Controller pattern. AKS Automatic uses **App Routing (Gateway API)** as the networking layer. `ingress-nginx` was retired March 2026; AKS App Routing NGINX mode is EOL November 2026.

- **Severity:** HIGH  
- **Decision:** D2/D3 — Gateway API over Ingress; App Routing add-on (Gateway API) is the recommended path  
- **Status:** ⏳ Being fixed in PR #375 (`squad/202-azure-architect-rewrite`). **Do not re-fix** to avoid merge conflict.  
- **Phase 2 issue:** #202

---

### 2. `packages/pack-github/agents/github.publisher.agent.md`

**Drift item:** `github:update_pr_description` listed as "planned, not yet available" — tool was implemented and registered in PR #364 (`feat(pack-github): implement github.update_pr_description tool`).

Two locations affected:
- Line 21: `# github:update_pr_description — planned, not yet available in pack-github` (frontmatter comment)
- Lines 321–323: prose note instructing users to "manually paste the review pack"

- **Severity:** MEDIUM — agents reading this file would not use the available tool, falling back to a broken manual fallback  
- **Tool registration verified:** `packages/pack-github/src/tools/update-pr-description.ts` + registration test confirm `github.update_pr_description` is registered  
- **Fix applied:** Uncommented `github:update_pr_description` in `userActions`; updated prose to use the tool instead of manual paste  
- **Status:** ✅ Fixed in this PR

---

### 3. `packages/pack-aks-automatic/src/agents/aks-manifests-author.agent.md`

**Informational note:** `static_site` shape description says "nginx or static file server". This refers to a **container image** (e.g., `nginx:1.25-alpine` serving static files), NOT the ingress-nginx controller. Not a drift item.

- **Severity:** LOW (informational, no action)  
- **Rationale:** The sentence describes the workload container type, not the networking ingress path. Gateway API is correctly mandated in step 7 of the same file.

---

### 4. `packages/pack-aks-automatic/src/agents/aks-architect.agent.md`

**Clean.** Plan exemplar at line 83–89 correctly uses:
```json
{"id":"gateway","label":"Gateway API","type":"networking"}
{"from":"gateway","to":"aks","label":"HTTPS"}
```
All Gateway API, KAITO, Workload Identity, and hostPath guardrails are correct.

---

### 5. `packages/pack-aks-automatic/src/agents/aks-reviewer.agent.md`

**Clean.** Gateway API review step (step 4) correctly flags legacy `Ingress`. Workload identity review present. No deprecated patterns.

---

### 6. `packages/pack-core/src/agents/triage.agent.md`

**Clean.** Constraint-spec v1.1.1 propagated correctly. D1–D14 all encoded. `constraintSpec` typed slot pattern correct. No deprecated references.

---

### 7. `packages/pack-core/src/agents/reviewer.agent.md`

**Clean** (after PR #379 fixes scope boundary, R9 label, D8 citation). Scope correctly distinguishes reviewer from aks.reviewer.

---

### 8. `packages/pack-core/src/agents/codesmith.agent.md`

**Clean.** No Azure-specific networking or deprecated API references. Docker validation flow correct.

---

### 9. `packages/pack-azure/src/agents/azure-ops.agent.md`

**Clean.** `arm_proxy` removed from code in PR #321. No references to deprecated `/api/arm-proxy`. What-if gate correct.

---

## arm_proxy Tombstone Verification

`/api/arm-proxy` was retired (Issue #237, PR #321). Confirmed: no agent file references `arm_proxy` as a tool or API pattern. The tombstone is in the API layer only.

---

## Constraint-Spec v1.1.1 Coverage

| Constraint | Enforced in | Notes |
|-----------|-------------|-------|
| No `:latest` tags | `aks-manifests-author` (line 32), `aks-reviewer` (step 5) | ✅ |
| No `hostPath` | `aks-architect` (explicit "do not do") | ✅ |
| No `ingress-nginx` | `aks-manifests-author`, `aks-reviewer`, `aks-architect` | ✅ |
| No `secretKeyRef` for Azure creds | `aks-manifests-author` (line 28), `aks-architect` (line 42) | ✅ |
| Workload Identity mandatory | All aks-* agents | ✅ |
| KEDA for event-driven scaling | `aks-manifests-author` (KEDA scalers table) | ✅ |
| Gateway API over Ingress | `aks-architect`, `aks-manifests-author`, `aks-reviewer` | ✅ |
| ACR pinned references | `aks-manifests-author` (line 32) | ✅ |
| constraintSpec propagation (D8) | `triage` handoff briefing, `aks-reviewer` prompt | ✅ |

---

## Remaining Work

- **#202** (open, PR #375): Fix `azure-architect.agent.md` ArchitectureDiagram node.
- **No new issues created** — all remaining drift is already tracked in open PRs.
