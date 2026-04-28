---
"@aks-kickstart/pack-github": patch
---

Move the GitHub auth bridge's test-only reset helper (`__resetGitHubAuthHookForTests`) off the production `@aks-kickstart/pack-github/client` surface and onto a dedicated `@aks-kickstart/pack-github/testing` subpath export. Production consumers can no longer reach the helper that clears the single-assignment auth bridge; only test code that explicitly imports the `testing` subpath gets it. No functional change for the existing `setGitHubAuthHook` / `useGitHubAuthBridge` / `isGitHubAuthHookSet` API on `/client`.
