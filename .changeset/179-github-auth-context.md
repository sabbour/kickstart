---
"@aks-kickstart/web": minor
---

Fix GitHub sign-in reactivity in the Playground: signing in on the GitHub Login Card now correctly updates the Repository Picker in the same view without requiring a page refresh. Implements `GitHubAuthContext` to share reactive auth state between components.
