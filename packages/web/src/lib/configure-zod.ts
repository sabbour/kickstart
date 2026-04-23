// Disable Zod v4's JIT (`new Function`) path so the app boots under
// `script-src 'self'` with no `'unsafe-eval'`. Must run before ANY v4
// schema constructor executes. See issue #1042.
//
// IMPORTANT: this file imports `zod/v4` — `vite.config.ts` aliases
// `zod/v4` to the project-root `node_modules/zod/v4` so we mutate the
// SAME `globalConfig` singleton that `openai` + `zod-to-json-schema`
// (hoisted to root) resolve and bundle. Without the alias, web-local
// `packages/web/node_modules/zod`'s v4 subpath is a different module
// instance, and setting `jitless` there has no effect on the v4 code
// actually shipped in the web bundle.

import { config } from 'zod/v4';

config({ jitless: true });
