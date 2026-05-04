---
"@aks-kickstart/pack-github": patch
"@aks-kickstart/web": patch
---

Wire `github/CreatePRFlow` into the publisher PR-creation flow (#328)

The phase-D publisher specs now render end-to-end. When the agent publishes
a kickstart, you'll see the three-stage flow on a single shared canvas card:

1. **Sign in** — an `AuthCard` prompts you to authenticate with GitHub.
2. **Review the PR** — `github/CreatePRFlow` shows the target repo and
   branch, the list of files about to be committed, and the proposed PR
   title (now displayed as readable text rather than a disabled input).
3. **Done** — a `SummaryCard` surfaces the new PR with a clickable link
   that opens GitHub in a new tab.

The chat composer also gained an `aria-label="Type a message"` so screen
readers can identify it after the first message is sent.
