---
'@aks-kickstart/web': patch
---

Fix chat auth-expiry behavior so expired-session redirects no longer leave a stale warning message and the interrupted request is automatically retried after returning authenticated. Also replace warning emoji rendering in chat assistant messages with a Fluent UI warning icon.
