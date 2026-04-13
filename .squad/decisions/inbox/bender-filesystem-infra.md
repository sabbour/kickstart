### Decision: Filesystem Abstraction is Infrastructure, Not a Kit
**Author:** Bender (Backend Dev)
**Date:** 2026-07-27
**Status:** Proposed (PR #123)
**Issue:** #47

**Context:** The filesystem abstraction (FileSystemProvider) needed a home in the architecture. Options were: (1) separate IntegrationKit, (2) infrastructure module with tools in default registry.

**Decision:** Filesystem is infrastructure, not a kit. The `filesystem/` module lives alongside `artifacts/`, `connectors/`, etc. The four FS tools are registered directly in the default ToolRegistry. No separate kit is created.

**Rationale:**
- Kits represent integration surfaces (Azure, GitHub) with auth, connectors, and prompts. Filesystem is a lower-level concern.
- FS providers use the existing connector pattern for auth (CloudShellProvider takes an APIConnector) rather than declaring their own auth requirements.
- ToolContext.fileSystem is optional — web-only contexts don't have real filesystems, so tools degrade gracefully.

**Impact:** Future filesystem providers (local FS, codespaces, etc.) should follow the same pattern: implement FileSystemProvider, register in FileSystemProviderRegistry.
