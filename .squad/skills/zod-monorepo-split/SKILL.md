# SKILL: Zod Monorepo Split-Version CI Failure

**Domain:** CI / DevOps  
**Owner:** Kif  
**Confidence:** High (diagnosed from live CI failure, PR #246)  
**First seen:** 2026-04-28 (kif-fix-ci-246)

---

## Problem Pattern

In an npm workspaces monorepo, if some packages list `"zod": "^3.x"` and others list `"zod": "^4.x"`, npm creates **separate nested copies** of Zod. Because Zod v4 uses `Symbol()` for nominal typing (`$ZodTypeInternals`), TypeScript treats the two copies as **incompatible types** when project references are used.

**Symptom in CI:**
```
error TS2740: Type 'ZodObject<{…}>' is missing the following properties from type
'ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>':
def, type, toJSONSchema, check, and 18 more.
```

Even if two packages both use `zod@3.25.76` (Zod v4 bridge), having them in **separate** `node_modules` directories produces two distinct `Symbol()` instances → nominal type incompatibility.

---

## Lockfile Diagnostic

Look for multiple Zod entries in `package-lock.json`:
```bash
cat package-lock.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
zod = {k:v.get('version') for k,v in d.get('packages',{}).items() if k.endswith('/zod')}
print(zod)
"
```

**Healthy:** Only `"node_modules/zod": "X.Y.Z"` (single root entry)  
**Broken:** Multiple entries like `"packages/web/node_modules/zod"`, `"packages/pack-core/node_modules/zod"` plus root

---

## Fix Procedure

### Phase 1 — Migrate Zod v3 → v4 API changes

Before deduplicating, audit for Zod v3 patterns that require migration in v4:

```bash
grep -r "z\.preprocess\|\.nonempty()\|ZodTypeDef\|ZodEffects" packages/ --include="*.ts" --include="*.tsx"
```

Key migrations for Zod v4:
- `z.preprocess(fn, schema)` → EXISTS in v4 with type signature change (`ZodPipe<ZodTransform, U>`). The runtime concept is unchanged; the v3 callsite shape no longer compiles. Refactor callsites to use the new type.
  - v4 equivalent: `z.string().transform(v => preprocess(v)).pipe(schema)`
  - Or for nullable coercion: `z.coerce.number()` (v4 handles nulls better)
- `ZodTypeDef` → removed; use `z.ZodTypeAny` or specific types
- `ZodEffects` → renamed/restructured in v4

Migrate all usages before proceeding to Phase 2.

### Phase 2 — Force single Zod version via npm overrides

In root `package.json`, add:
```json
{
  "overrides": {
    "zod": "4.3.6"
  }
}
```

Then regenerate the lockfile:
```bash
npm install
```

Verify the lockfile now has only ONE Zod entry:
```bash
cat package-lock.json | grep '"zod"' | grep '"version"'
# Should show only one entry: "version": "4.3.6"
```

### Phase 3 — Verify TypeScript compilation

```bash
cd packages/web && npx tsc --noEmit 2>&1 | head -50
```

If new errors appear, they'll be API-level Zod v4 breaking changes needing code fixes.

---

## Root Cause Context

The bridge version `zod@3.25.76` is Zod's v4 published under the `3.x` semver range for migration compatibility. It introduces `$ZodTypeInternals<>` nominal typing. When this is installed in two separate `node_modules` directories in the same monorepo and TypeScript uses project references, the two copies produce incompatible type signatures.

The root `node_modules/zod` copy (typically v4.x.x, pulled by `@openai/agents*`, `harness`, etc.) and the nested copies (v3.25.76, pulled by older `packages/web` and `packages/pack-core`) must be **consolidated to one**.

---

## Related

- PR #246: first occurrence of this pattern in kickstart
- `kif-ci-fix-246.md` in `.squad/decisions/inbox/`

---

## Correction History

- **2026-04-28:** Nibbler corrected `z.preprocess` status (PR #248 review). Exists in v4 with type signature change (`ZodPipe<ZodTransform, U>`). Migration driver is type-shape change, not removal.
