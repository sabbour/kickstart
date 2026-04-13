# Decision: IndexedDB VFS Architecture (Dual Filesystem + Sync Bridge)

**Author:** Fry (Frontend Dev)
**Date:** 2026-04-12
**Status:** Implemented
**Issue:** #39

## Context

The app has two virtual filesystems with different lifecycle concerns:
1. **VirtualFileSystem** (in-memory) — tracks streaming state ("generating" vs "complete"), used for real-time file generation feedback during conversation.
2. **VirtualFS** (IndexedDB) — persistent storage that survives page reloads.

## Decision

Keep both filesystems. Add a sync bridge in `App.tsx` that auto-persists "complete" files from the in-memory FS to IndexedDB. The UI shows both:
- In-memory `FileEditor` for streaming feedback (generating state)
- IndexedDB `FileTreePanel` for persistent file browsing with Monaco

## Rationale

- Merging into one system would complicate the streaming pipeline (can't await IndexedDB during synchronous useSyncExternalStore updates).
- The sync bridge is a clean one-way flow: in-memory → IndexedDB on completion.
- Session clear/new wipes both stores to prevent stale data.

## Files Affected

- `packages/web/src/services/virtual-fs.ts` — VFSFile records, buildFileTree, clear()
- `packages/web/src/contexts/VirtualFSContext.tsx` — tree + fileRecords exposure
- `packages/web/src/components/FileTreePanel.tsx` — Fluent UI panel with Monaco
- `packages/web/src/App.tsx` — sync bridge + dual panel rendering
