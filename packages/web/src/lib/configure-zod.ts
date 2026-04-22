import { config } from 'zod/v4';

// CSP hardening (#1042 round 5): even though our source uses Zod v3
// (`import { z } from 'zod'` resolves to `zod/v3` in the web package),
// a transitive dependency pulls Zod v4 into the `vendor-zod` chunk — the
// CI CSP smoke reports the violation at `vendor-zod-*.js:1:116024`,
// which is the `Function(\`\`)` feature-probe inside v4's `allowsEval`.
//
// Zod v4 object schemas opportunistically JIT-compile a fast parser using
// `new Function(...)`. The probe trips the browser CSP smoke scenario
// (`script-src 'self'` with no `'unsafe-eval'`) the moment the first v4
// `z.object({...})` constructor runs. Calling v4's `config` with
// `jitless: true` short-circuits the JIT path before `allowsEval.value`
// is ever read — see `node_modules/zod/v4/core/schemas.js`:
//
//     const jit = !core.globalConfig.jitless;
//     const fastEnabled = jit && allowsEval.value;  // ← short-circuits
//
// Parsing still works; we just take the interpreted slow path, which is
// fine given these schemas run at boot for catalog/MCP registration and
// on discrete user actions, not per-frame. Importing from `zod/v4`
// specifically is required: setting jitless on v3's global config would
// have no effect on the v4 module's `globalConfig` singleton.
//
// This file must be imported **before** any module that constructs Zod
// v4 schemas (directly or transitively) — in practice, as the very first
// import in `main.tsx`. ES module evaluation order guarantees this runs
// before sibling imports (React, App, harness, catalogs) evaluate.
config({ jitless: true });

export {};
