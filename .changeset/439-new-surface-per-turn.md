---
"@aks-kickstart/web": patch
---

fix(B5): force surface remount on ownership transfer to prevent stale RadioGroup state

When a surface transfers ownership between turns (e.g. `shared:triage-main` handed off from
triage to a downstream agent), React previously reused the same mounted component because the
surface ID key was unchanged. This left `hasFiredActionRef` and `localValues` in
`ChoicePicker` pointing at stale data from the prior turn.

Fix: add a per-surface generation counter (`surfaceRenderGens`) to `useA2UI`. When a surface
ownership transfer is detected in `claimSurfaceIdsForAssistantMessage`, the generation is
incremented via `bumpSurfaceRenderKey`. React keys for surface divs now include the generation
(`${surfaceId}#gen:${gen}`), forcing unmount + remount of the component tree so all local state
resets cleanly.
