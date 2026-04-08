### 2025-07-25: 6-phase engine with progressive K8s disclosure
**By:** Bender
**What:** Replaced 4-phase engine (Understand→Clarify→Needs→Plan) with 6 phases (Discover→Design→Generate→Review→Handoff→Deploy). All prompts rewritten to delay Kubernetes exposure — phases 1-3 frame AKS Automatic as "scalable app platform", K8s only surfaces in Review/Deploy. Added 4 GitHub-related A2UI components: RepoPicker, WorkflowStatus, CodespaceLink, AppOverview.
**Why:** User directive — core UX philosophy. Users should feel like they're deploying an app, not configuring Kubernetes. GitHub components needed for repo creation, CI/CD status, and Codespaces handoff flows.
