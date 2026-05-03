# Phase 2.1 Prompt Drift Audit

Systematic audit of all source `*.agent.md` files against the AKS Automatic grounding constraints
(decisions D1–D14, deployment-safeguards skill, gateway-api-mandatory skill, workload-identity-mandatory skill).

**Audit date:** 2026-05-04  
**Files audited:** 9 source agent files (excluding `dist/` and `.worktrees/` copies)  
**Grounding reference:** deployment-safeguards.SKILL.md, gateway-api-mandatory.SKILL.md, workload-identity-mandatory.SKILL.md, kaito-gpu-models.SKILL.md, acr-integration.SKILL.md

---

## Summary Table

| File | Item | Severity | Decision | Issue |
|------|------|----------|----------|-------|
| `aks-reviewer.agent.md` | Missing `hostPath` check in readiness checklist | **HIGH** | deployment-safeguards (`no-hostpath`) | Check #7 covers `hostNetwork`/`hostPID`/`hostIPC` but omits `hostPath` volumes — a HIGH-severity safeguard violation goes undetected |
| `aks-manifests-author.agent.md` | `gpu_inference` shape generates vanilla Deployment, not KAITO Workspace CRD | **HIGH** | D6 / D12 | Shape uses a standard `Deployment` with GPU resource requests; KAITO uses a `Workspace` CRD — manifests generated for KAITO workloads would be structurally wrong |
| `aks-reviewer.agent.md` | `:latest` tag in Helm `values.yaml` severity is `WARN` instead of `FAIL` | **MEDIUM** | deployment-safeguards (image hygiene) | The Helm chart review path flags `:latest` as WARN only; grounding requires FAIL for any mutable tag regardless of pull policy |
| `core/triage.agent.md` | `constraintSpec` string literal in handoff label prompt | **MEDIUM** | D7 / D8 | Line 21 uses `constraintSpec = AKS_AUTOMATIC_V1_1_1` (freeform string); must be the typed schema `{ safeguardSpecVersion: "v1.1.1", aksVersion: "2026-03-15" }` to survive schema validation downstream |
| `aks-manifests-author.agent.md` | `static_site` shape names "nginx or static file server" with no pinned-image exemplar | **LOW** | D2 / deployment-safeguards (image hygiene) | Shape template description doesn't include a concrete pinned-image example; developers may default to `:latest` for the nginx container |
| `core/codesmith.agent.md` | No explicit AKS Automatic guardrails | **LOW** | D2 / D10 | Codesmith relies on the generic code standard ("Pin all external dependencies") rather than explicit `hostPath` ban, Gateway API requirement, or Workload Identity requirement; leaves gap if review gate is skipped |

---

## Per-file Findings

### `packages/pack-aks-automatic/src/agents/aks-reviewer.agent.md`

#### Finding 1 — Missing `hostPath` volume check (HIGH)

**Violation:** deployment-safeguards `no-hostpath` rule (HIGH severity)

The readiness checklist defines 10 checks. Check #7 reads:

```
| 7 | hostNetwork / hostPID / hostIPC | Any of these set to true | — |
```

`hostPath` volumes are absent from this check and from every other check in the checklist.

The `deployment-safeguards.SKILL.md` and `acr-integration.SKILL.md` both state:

> **`hostPath` volumes are prohibited** by AKS safeguards and the Restricted pod security standard.

The safeguard rule ID `no-hostpath` is classified as **high** severity. A reviewer agent that does not flag `hostPath` volumes will approve manifests that AKS Automatic would reject at admission time.

**Fix:** Add Check #11 to the readiness checklist:

| # | Check | FAIL condition | WARN condition |
|---|-------|----------------|----------------|
| 11 | **hostPath volumes** | Any container or init container mounts a `hostPath` volume | — |

Also add `hostPath` detection to the Helm chart review path (currently only covers `anti-affinity`, `resources`, `replicaCount`, and image tag).

---

#### Finding 2 — `:latest` severity in Helm chart review path is `WARN` instead of `FAIL` (MEDIUM)

**Violation:** deployment-safeguards image hygiene; grounding constraint "never `:latest`"

The Helm chart review path (§Helm chart review path) flags:

```
| Image tag hardcoded in values.yaml as :latest or a bare word (not a digest) | WARN | Mutable tags bypass image immutability guarantees |
```

The readiness checklist check #8 also permits `:latest` with `imagePullPolicy: Always` as WARN only:

```
| 8 | Image pull policy | Mutable tag (:latest or no digest) with imagePullPolicy: IfNotPresent or absent | Pinned digest with imagePullPolicy: Always (wasteful, not blocking) |
```

The grounding constraint (deployment-safeguards.SKILL.md and acr-integration.SKILL.md) states:

> Always pin images by digest or immutable tag — **never** use `:latest`.

This is an unconditional prohibition. The reviewer must classify any `:latest` usage — regardless of `imagePullPolicy` — as **FAIL**, not WARN. AKS Automatic deployment safeguards will reject mutable tags at admission.

**Fix:** Update check #8 FAIL condition to: "Mutable tag (`:latest` or unqualified bare word, regardless of `imagePullPolicy`)". Update the Helm chart flag from WARN to FAIL for image tags that are `:latest` or unqualified.

---

### `packages/pack-aks-automatic/src/agents/aks-manifests-author.agent.md`

#### Finding 3 — `gpu_inference` shape generates vanilla Deployment, not KAITO Workspace CRD (HIGH)

**Violation:** D6 / D12 (KAITO auto-include for GPU inference workloads)

The `gpu_inference` shape is defined as:

```
### `gpu_inference`
- Deployment (single container with GPU resource requests)
- Service (ClusterIP or internal LoadBalancer)
- ServiceAccount (workload identity annotated)
- ScaledObject (Prometheus trigger on request queue depth, or HTTP trigger)
- PriorityClass (high-priority for GPU scheduling)
```

KAITO — the default inference runtime for AKS Automatic per D6/D12 — uses a `Workspace` custom resource, **not** a standard `Deployment`. KAITO manages GPU node provisioning and model loading via the `Workspace` CRD:

```yaml
apiVersion: kaito.sh/v1alpha1
kind: Workspace
metadata:
  name: workspace-llama-3-1
spec:
  resource:
    instanceType: "Standard_NC96ads_A100_v4"
    labelSelector:
      matchLabels:
        app: llama-3-1
  inference:
    preset:
      name: llama-3.1-70b-instruct
```

Authoring a vanilla `Deployment` for a KAITO inference workload is structurally incorrect and will not integrate with KAITO's model lifecycle management. The `aks.architect` recommends KAITO (with quota preflight per D13) but the manifests-author has no `kaito_workspace` shape to produce the correct `Workspace` CRD.

**Fix:** Add a `kaito_workspace` shape:

```
### `kaito_workspace`
- Workspace (kaito.sh/v1alpha1) — preset model name, instance type, resource labels
- Service (ClusterIP) targeting the Workspace's inference endpoint
- ServiceAccount (workload identity annotated)
- Note: KAITO manages GPU node provisioning; do NOT author NodePool or Deployment resources for the model pod
```

Keep `gpu_inference` for non-KAITO GPU workloads (custom model servers, custom containers), and explicitly note that KAITO workloads use `kaito_workspace` instead.

---

#### Finding 4 — `static_site` shape lacks pinned-image exemplar (LOW)

**Violation:** D2 / deployment-safeguards image hygiene

The `static_site` shape description reads:

```
- Deployment (single container, nginx or static file server)
```

There is no concrete image reference example showing a pinned tag or digest. The `:latest` prohibition is stated at the top of the file (§Core responsibilities, point 8), but the shape template does not reinforce it with a positive example. Practitioners who consult the shape template in isolation may use `nginx:latest`.

**Fix:** Add a brief image reference note to the `static_site` shape:

```
- Deployment (single container, nginx or static file server; pin image — e.g., `nginx:1.27.3` or digest — never `:latest`)
```

---

### `packages/pack-core/src/agents/triage.agent.md`

#### Finding 5 — `constraintSpec` string literal in handoff label prompt (MEDIUM)

**Violation:** D7 / D8 (typed constraint-spec propagation)

The AKS readiness review handoff label prompt (line 21) reads:

```
Pass the typed handoff briefing with constraintSpec = AKS_AUTOMATIC_V1_1_1 and skillIdsLoaded
including azure-kubernetes-automatic-readiness (D8).
```

`constraintSpec = AKS_AUTOMATIC_V1_1_1` is a freeform string, not the typed schema. The Handoff Briefing v1 section (§Handoff Briefing v1, D7/D8/Z1) defines the canonical shape as:

```json
"constraintSpec": { "safeguardSpecVersion": "v1.1.1", "aksVersion": "2026-03-15" }
```

The schema (packages/pack-core/src/triage/handoff-schema.ts) rejects alternative shapes. A routing agent or LLM reading only the handoff label prompt (line 21) may emit the string form, which the downstream schema validator will reject.

**Fix:** Update line 21 to use the canonical typed form:

```
Pass the typed handoff briefing with constraintSpec: { safeguardSpecVersion: "v1.1.1", aksVersion: "2026-03-15" }
and skillIdsLoaded including azure-kubernetes-automatic-readiness (D8).
```

---

### `packages/pack-core/src/agents/codesmith.agent.md`

#### Finding 6 — No explicit AKS Automatic guardrails (LOW)

**Violation:** D2 / D10 (weak coverage)

`core.codesmith` is invoked for file generation across all tracks, including Kubernetes manifests. Its code standards section contains:

> Pin all external dependencies to specific versions.

This is the only constraint that indirectly prevents `:latest`. There are no explicit prohibitions on:
- `hostPath` volumes (HIGH safeguard violation)
- Legacy `Ingress` resources (use Gateway API per D2/D3)
- `secretKeyRef` for Azure credentials (use Workload Identity per D10)

The downstream `aks.reviewer` provides the enforcement gate. However, if codesmith generates non-compliant manifests, an entire review-and-fix round trip is required. Adding explicit AKS Automatic guardrails to codesmith would reduce remediation load.

**Fix:** Add an "AKS Automatic manifest constraints" section to the code standards:

```markdown
When generating Kubernetes manifests for AKS Automatic:
- Never use `hostPath` volumes — use PVCs backed by `managed-csi` or `azurefile-csi`.
- Never use legacy `Ingress` resources — emit `Gateway` + `HTTPRoute` (Gateway API).
- Never use `secretKeyRef` for Azure credentials — use Azure Workload Identity.
- Never use `:latest` image tags — pin to digest or immutable semver.
```

---

## Agents With No Drift Found

| File | Notes |
|------|-------|
| `packages/pack-aks-automatic/src/agents/aks-architect.agent.md` | Gateway API (App Routing primary, AGC alternative), KAITO quota preflight (D13), Workload Identity, `hostPath` and `ingress-nginx` bans all present. No drift detected. |
| `packages/pack-aks-automatic/src/agents/aks-reviewer.agent.md` (base) | Core review responsibilities correctly cover Gateway API, `:latest` detection, identity review. Drift found only in Helm path and hostPath gap (see above). |
| `packages/pack-azure/src/agents/azure-architect.agent.md` | Explicitly bans `ingress-nginx` and AKS App Routing NGINX mode (EOL March/Nov 2026). Recommends App Routing + Gateway API or managed Istio. D1 CodeBlock guardrail present. No drift. |
| `packages/pack-azure/src/agents/azure-ops.agent.md` | Azure ARM-scoped; no AKS Automatic manifest constraints apply. What-if-then-deploy chain is correctly implemented. No drift. |
| `packages/pack-core/src/agents/reviewer.agent.md` | Generic post-generation reviewer; AKS-specific review is explicitly delegated to `aks.reviewer`. Scope boundary is correct. No drift. |
| `packages/pack-github/agents/github.publisher.agent.md` | GitHub publishing scope; no AKS Automatic manifest constraints apply. No drift. |

---

## Recommended Fix Priority

1. **P1 (Block-level)** — Add `hostPath` check to `aks-reviewer.agent.md` readiness checklist. Manifests with `hostPath` pass review today and fail at AKS admission.
2. **P1 (Block-level)** — Add `kaito_workspace` shape to `aks-manifests-author.agent.md`. KAITO workloads currently produce structurally incorrect manifests.
3. **P2 (Quality)** — Elevate `:latest` Helm check from WARN to FAIL in `aks-reviewer.agent.md`.
4. **P2 (Quality)** — Fix `constraintSpec` string literal in `triage.agent.md` line 21.
5. **P3 (Hygiene)** — Add pinned-image note to `static_site` shape in `aks-manifests-author.agent.md`.
6. **P3 (Hygiene)** — Add AKS Automatic manifest guardrails section to `codesmith.agent.md`.
