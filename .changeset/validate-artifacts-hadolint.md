---
"@aks-kickstart/pack-core": minor
---

Harden core.validate_artifacts tool with input caps, fix hints, and supply-chain verification

- **Input caps (Zapp):** max 20 files, 50 MB aggregate byte limit, 10 MB per file
- **Fix hints:** well-known hadolint rules (DL3007, DL3008, DL3015, etc.) now include one-line fix suggestions in violations
- **Output sanitization:** violation messages capped at 256 chars, ANSI/control chars stripped
- **Supply-chain integrity:** hadolint binary download now verified with SHA256 checksum; cached binary re-verified on load
- **Violations capped** at 25 per file to prevent unbounded output
- **Skipped-state surfacing:** `skipped` status always includes a reason string; codesmith prompt updated to surface "⚠️ Dockerfile lint skipped" when validator unavailable
- **Retry exhaustion UX:** codesmith prompt clarified — after 2 failed retries, violations are surfaced as "Unable to auto-fix — manual review recommended"
- **CI:** hadolint binary installed with checksum verification in GitHub Actions workflow
