## 🧪 Nibbler — Per-diff PR Review

**PR #1056** · `fix(ops): SWA smoke gate hard-gate + PR preview` · Closes #1049

Two blockers prevent approval.

---

### 🔴 BLOCK 1 — Regression guard runs on PRs only, not `push` to main

**File:** `.github/workflows/ci.yml` (top of diff)

The `ci.yml` `on:` block is `pull_request` only (line 4 on the PR branch). The approved v2 pattern required the guard step to run on **pushes to main AND on PRs**. A direct commit to `main` (e.g., a hotfix, a Scribe merge) bypasses the guard entirely — exactly the regression vector the guard was designed to catch.

**Fix:** Add a `push: branches: [main]` trigger to `ci.yml`.

---

### 🔴 BLOCK 2 — `/api/packs` endpoint absent from both production and preview smoke

**File:** `.github/workflows/deploy-swa.yml`, lines 96 and 156

Both the production smoke step (line 96) and the preview smoke step (line 156) only hit `/api/health`. The approved DP required parity across both endpoints: `/api/health` **and** `/api/packs`. Neither job adds the second step.

`check-swa-health.mjs` accepts a single `SWA_HEALTHCHECK_URL` env var — a second invocation step is needed for `/api/packs` in both jobs.

**Fix:** Add a `Smoke check packs endpoint` step after each health step, with `SWA_HEALTHCHECK_URL: .../api/packs`.

---

### ✅ PASSED

| Criterion | Result |
|---|---|
| Hard-gate flip: `exit 0` → `exit 1` + `::error::` annotation | ✅ Line 89 |
| `if: base_url != ''` guard removed from production smoke step | ✅ Lines 93-97 |
| `continue-on-error: true` absent from deploy-swa.yml | ✅ grep returns none |
| Fork-safety guard on preview job | ✅ Line 103 |
| Retry knobs configurable via env (ATTEMPTS, DELAY_MS) | ✅ Lines 157-158 |
| E2 (regression guard exits 0 on clean file), E3 (YAML valid), E4 (fork gate), E5 (no COE) | ✅ |

---

**Verdict:** `nibbler:changes-requested` — address both blockers and re-request review.
