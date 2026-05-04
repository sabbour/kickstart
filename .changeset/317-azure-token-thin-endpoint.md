---
"@aks-kickstart/api": patch
---

Verifies the `GET /api/azure/token` thin endpoint against the Wave 1 acceptance contract from issue #317 (parent #237). The endpoint itself was shipped in PR #239; this change adds two missing test cases that lock in the contract:

- Empty / whitespace-only `x-ms-token-aad-access-token` header returns `401` (fail-closed), matching the missing-header behaviour.
- The route is registered as `GET`-only at `azure/token`, so the Functions runtime returns `405` for any other method.

No user-visible change.
