---
"@aks-kickstart/pack-core": minor
---

Add core.check_safeguards and core.fix_safeguards tools

- **core.check_safeguards**: Static analysis tool for Kubernetes manifests against AKS-Automatic safeguard rules ported from Microsoft AKS-Copilot PRs #1837 and #1976. Returns structured violations with severity (high/medium/low), rule ID, MS PR attribution link, and auto-fix availability.
- **core.fix_safeguards**: Deterministic rewriter for auto-fixable violations. Supports privileged container, hostPath volume, hostNetwork/PID/IPC, and missing resource limits/requests fixes. Non-fixable violations (runAsRoot, readOnlyRootFilesystem) are returned for manual review.
- **9 safeguard rules**: 5 high-severity (PR #1837: privileged-container, hostpath-volume, host-network, host-pid, host-ipc), 3 medium-severity (PR #1976: missing-resource-limits, missing-resource-requests, run-as-root), 1 low-severity (mutable-root-filesystem).
- **Parser security**: Safe YAML loader with input bounds (2 MB byte cap, 50 document cap, 100 alias cap, 64 nesting depth cap) to prevent parser DoS.
- **Fix determinism**: Same manifest + violation IDs produces identical output across runs.
