---
updated_at: 2026-04-15T10:11:35.848Z
mode: burndown-before-ceremony
focus_area: Complete in-flight demo lanes, then stop for process reset and sprint-start ceremony/system review
active_issues: [297, 298, 299, 274, 301, 265, 300]
---

# What We're Focused On

**IMPORTANT: Sprint-start ceremony was skipped. Process drift acknowledged. After burning down current in-flight work, the team will stop and rebuild the operating system.**

Current sprint focus is the real no-mock demo path for Kickstart: stabilize chat rendering, unblock the Review terminal safety-net PR, start the real GitHub handoff, and queue the Azure deployment lane behind it.

After these lanes complete, all new work stops. The team will conduct:
1. **Sprint-start ceremony** (skipped at last sprint begin)
2. **Process review** — address RCA-1 through RCA-5 from decisions.md
3. **System rebuild** — implement C1, C2, C3 improvements
4. **Board discipline reset** — restore triage, assignment, and milestone ceremony

## Reference Projects

- [adaptive-ui-try-aks](https://github.com/sabbour/adaptive-ui-try-aks) — Existing "Ship It" prototype (TypeScript/Vite, conversational AI guide for AKS deployment)
- [portal-prototyper](https://github.com/azure-management-and-platforms/portal-prototyper) — Azure Portal UX framework (zero-dependency static HTML/CSS/JS)
