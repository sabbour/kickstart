---
"@aks-kickstart/web": patch
---

Fix infinite auth redirect loop when accessing chat while unauthenticated.

When a `SessionExpiredError` is thrown during the auth-retry attempt (i.e. the
browser returns from the AAD login page still unauthenticated due to SSO
auto-redirect or a broken auth flow), the app now surfaces the error in the
chat UI instead of redirecting to the login page again — breaking the cycle
that produced 1244+ rapid requests.

The `SessionExpiredError` handling branch in `useStreaming.send()` is extracted
into an exported `_handleSessionExpiredError` helper so the redirect-loop guard
logic can be unit-tested without a React rendering context.
