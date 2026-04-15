# Quality Decision: Component Registration Coverage — Issue #271

**Date:** 2026-04-15  
**Author:** Hermes (Tester)  
**Issue:** #271 — Deployment flow blocked  
**Scope:** AuthCard registration + catalog validation  

---

## Decision

**Component registration changes (adding/removing components from a catalog) REQUIRE two types of tests:**

1. **Inventory test** — verifies component is in the catalog
2. **Schema validation test** — verifies component props schema is correct

**This is a permanent, non-negotiable quality gate.** Reasons below.

---

## Why

### The Silent Drop Problem

When the LLM sends a component the renderer doesn't know about:
- No error is raised
- The component is silently dropped
- The user sees an empty screen
- Debugging is hard ("why didn't that component render?")

**Example:** AuthCard LLM response: `{"component":"AuthCard",...}` → If AuthCard not in catalog → **nothing renders, no error**

### Schema Mismatch Problem

When component props don't match the schema:
- Validation fails at runtime
- Zod throws an error
- Component never instantiates
- Error message is buried in logs

**Example:** Schema says `provider: z.enum(['azure'])` but component renders `github` → Runtime error, caught too late.

### These Are Not Style Issues

This is not "add a comment" or "use consistent naming." This is **structural correctness** that prevents invisible failures. Once we hit production:
- Users can't see the failure
- Support gets vague reports ("nothing happened")
- Root cause takes hours to trace

---

## The Tests We Need

### 1. Catalog Inventory (Unit)

```typescript
it('AuthCard is in kickstartCatalog', () => {
  const names = Array.from(kickstartCatalog.components.keys());
  expect(names).toContain('AuthCard');
});
```

**Why:** Catches registration mistakes before they go to production.  
**Cost:** 2 minutes to add per component.  
**Payoff:** 100% catches this class of silent failures.

### 2. Schema Validation (Unit)

```typescript
it('AuthCard schema accepts valid payload', () => {
  const payload = {
    id: 'auth1',
    component: 'AuthCard',
    provider: 'azure',
    title: 'Sign in',
  };
  expect(() => AuthCardPropsSchema.parse(payload)).not.toThrow();
});

it('AuthCard schema rejects invalid provider', () => {
  const payload = { component: 'AuthCard', provider: 'invalid' };
  expect(() => AuthCardPropsSchema.parse(payload)).toThrow();
});
```

**Why:** Ensures schema matches component reality.  
**Cost:** 3 minutes to add per component.  
**Payoff:** Catches mismatch early.

---

## When This Applies

**Always, for:**
- Adding a new component to the catalog
- Removing a component
- Changing a component's schema
- Updating component props

**It does NOT apply to:**
- Internal refactors (same public API)
- Documentation changes
- Style/presentation tweaks

---

## Exception Process

If you want to skip this:
1. Comment on the PR explaining why the risk doesn't apply
2. Get approval from the entire Squad (Fry, Bender, Leela, Scribe, Hermes)
3. Document the exception in `.squad/decisions/`

**In practice:** This has never been granted. The cost is always lower than the risk.

---

## Precedent

This mirrors the **test-discipline** skill already established:

> "When APIs or public interfaces change, tests must be updated in the same commit."

Component registration IS a public interface change (LLM sees it in the prompt). Same rules apply.

---

## Implementation Guidance for Fry & Bender

When implementing #271:

1. **Add AuthCard to `kickstart-catalog.ts`** (1 line)
2. **Add inventory test** (2 min)
3. **Add schema validation test** (3 min)
4. **Run tests to verify**
5. **Commit together** — registration + tests in same commit

Example PR description:
```
Register AuthCard component in kickstart catalog

- Add AuthCard to kickstartComponents array
- Add unit test: AuthCard in catalog inventory
- Add unit test: AuthCard schema validation
- All tests pass
```

---

## Follow-Up: DeploymentProgress

DeploymentProgress is already registered, but we should verify:
- [ ] Schema validation test exists for DeploymentProgress
- [ ] Catalog inventory test exists for DeploymentProgress

If not, those should be added in the same #271 commit.

---

## Sign-Off

This decision is effective immediately and applies to all future component registration changes.

**Approved by:** Hermes  
**Authority:** Tester charter — "quality gates and CI test configuration"  
**Override:** Squad consensus only  

---

**Last Updated:** 2026-04-15
