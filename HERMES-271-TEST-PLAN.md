# Test Plan: Issue #271 — Deployment Flow Blocked (AuthCard Registration & Demo Flow)

**Date:** 2026-04-15  
**Tester:** Hermes  
**Issue:** https://github.com/sabbour/kickstart/issues/271  
**Scope:** AuthCard component registration + deployment phase flow  
**Goal:** Acceptance coverage for the shortest safe fix before implementation  

---

## Problem Summary

The demo hits a dead end at the deployment phase:
1. **AuthCard not rendering** — LLM sends valid AuthCard component, but nothing appears (not in catalog)
2. **Stale 'repo created' card** remains visible (context confusion)
3. **No backend for deployment** — buttons fire raw events with no handlers
4. **Flow-blocking** — users cannot proceed past file generation

## Root Causes

- `AuthCard` is implemented (`packages/web/src/catalog/components/AuthCard.tsx`) but **NOT registered** in the kickstart catalog
- `DeploymentProgress` is implemented and registered, but the flow that uses it is incomplete
- System prompt documents both components (in `component-catalog.ts`) but doesn't guard against reaching unimplemented phases

---

## Likely Fix Strategy

**Shortest safe path for demo-readiness:**

1. **Register AuthCard** in `kickstart-catalog.ts` (1 line add)
2. **Validate schema** — ensure `AuthCard` schema in `a2ui-schema.ts` matches component props
3. **Remove or guard deployment phases** in system prompt OR add minimal fallback UI
4. **End flow at file generation** (demo-ready state) — skip deployment phases for now

**Does NOT require:**
- Azure auth integration
- Actual deployment backend
- Deployment progress real-time updates

---

## Acceptance Coverage

### A. Component Registration & Rendering

#### A1: AuthCard Registration ✓
- **Setup:** AuthCard component exists and is exported
- **Test:** AuthCard is included in `kickstartComponents` array in `kickstart-catalog.ts`
- **Verify:** `new Catalog()` instantiation succeeds without type errors
- **Type:** Unit (catalog initialization)
- **Risk:** HIGH — if missing, LLM output is silently dropped

#### A2: AuthCard Schema Validation ✓
- **Setup:** Component receives `{"id":"auth1","component":"AuthCard","provider":"azure","title":"Sign in to Azure"}`
- **Test:** Zod validation in `AuthCardPropsSchema` accepts this payload
- **Verify:** No validation errors, schema matches component props
- **Type:** Unit (schema validation)
- **Risk:** HIGH — schema mismatch would cause runtime errors

#### A3: AuthCard Renders in React Catalog ✓
- **Setup:** Render AuthCard with `provider="azure"` and stub connector
- **Test:** Card appears with title, description, and "Sign in" button
- **Verify:** 
  - Card header text matches prop.title
  - Button label includes provider name
  - Offline mode indicator appears when no connector
- **Type:** Integration (React component)
- **Risk:** MEDIUM — component exists but may have subtle rendering issues

#### A4: AuthCard Stub Mode Works ✓
- **Setup:** Render AuthCard without APIConnector
- **Test:** User clicks "Sign in to {provider}" button
- **Verify:**
  - Button shows loading spinner while signing in
  - Offline mode caption appears below button
  - After stub sign-in, button changes to "Sign out" and status shows "Connected"
- **Type:** Integration (state + UI)
- **Risk:** MEDIUM — stub mode is fallback for offline/testing

#### A5: AuthCard Error Handling ✓
- **Setup:** Mock connector.authenticate() to reject with error
- **Test:** User clicks "Sign in", error occurs
- **Verify:**
  - MessageBar with error appears above button
  - Button remains enabled (retry allowed)
  - Error clears when user clicks "Sign in" again
- **Type:** Integration (error state)
- **Risk:** MEDIUM — users need clear error feedback

---

### B. Deployment Phase Guard Rails

#### B1: System Prompt Deployment Phases Documented ✓
- **Setup:** Check `component-catalog.ts` `BASE_COMPONENT_CATALOG`
- **Test:** `AuthCard` and `DeploymentProgress` are listed in catalog entries
- **Verify:**
  - Both components appear in the "Kickstart Domain Components" section
  - Examples in prompt are valid JSON that matches schema
- **Type:** Static (prompt documentation)
- **Risk:** HIGH — LLM relies on this documentation

#### B2: System Prompt Guards Against Unimplemented Phases ✓
- **Setup:** Read `system-prompt.ts` phase definitions and constraints
- **Test:** Either:
  - (Option 1) Phases stop at GENERATE (no DEPLOY, DEPLOYMENT instructions)
  - (Option 2) DEPLOY phase exists but has guardrails to end flow gracefully
- **Verify:** No `getPhaseDefinition('deploy')` call OR phase has fallback UI
- **Type:** Static (prompt review)
- **Risk:** HIGH — LLM will hit unimplemented flows without guards

#### B3: Stale Card Cleanup ✓ (Related to #269)
- **Setup:** Complete discover → design → generate flow
- **Test:** At final step, previous cards (e.g., "GitHub repository created") are hidden
- **Verify:**
  - Surface shows only current/final cards
  - No stale context cards visible
- **Type:** Integration (flow state)
- **Risk:** MEDIUM — UX confusion but not flow-blocking

---

### C. Flow Integration (Demo-Ready Path)

#### C1: Discover Phase Completes ✓
- **Setup:** User lands on welcome page
- **Test:** Select a track (e.g., "Web App or API")
- **Verify:**
  - RadioGroup renders with 3 options
  - Selecting option fires `select-track` event
  - Next message appears
- **Type:** Integration (end-to-end)
- **Risk:** LOW — discover phase is stable

#### C2: Design Phase Completes ✓
- **Setup:** After track selection
- **Test:** Approve or modify architecture
- **Verify:**
  - Architecture diagram renders with ArchitectureDiagram component
  - CostEstimate component shows projected costs
  - "Looks good" and "Change something" buttons work
- **Type:** Integration (end-to-end)
- **Risk:** LOW — design phase is stable

#### C3: Generate Phase Completes ✓
- **Setup:** After design approval
- **Test:** View generated files (Dockerfile, deployment config, CI/CD pipeline)
- **Verify:**
  - FileEditor component shows code with syntax highlighting
  - DeploymentProgress shows file generation status
  - All files are successfully generated
- **Type:** Integration (end-to-end)
- **Risk:** LOW — generate phase is stable

#### C4: Flow Ends Gracefully After Generation ✓
- **Setup:** All files generated
- **Test:** Either:
  - (Option 1) "Your code is ready" message appears with no next step
  - (Option 2) Flow ends with "Download files" or "Done" button
- **Verify:**
  - User sees clear completion state
  - No dead-end cards or broken buttons
  - Demo completes successfully
- **Type:** Integration (end-to-end)
- **Risk:** HIGH — missing or unclear completion breaks demo

---

### D. Accessibility & Keyboard (AuthCard Specific)

#### D1: AuthCard A11y Compliance ✓
- **Test:** AuthCard source contains required ARIA:
  - Card header uses semantic heading
  - Button has descriptive label
  - Error MessageBar has live region (if applicable)
- **Type:** Static (code review)
- **Risk:** MEDIUM — accessibility not blocking demo but important for QA gate

#### D2: AuthCard Keyboard Navigation ✓
- **Setup:** Render AuthCard
- **Test:** Tab to button, press Enter/Space
- **Verify:**
  - Button receives focus (visible outline)
  - Enter/Space triggers sign-in
  - Focus management correct
- **Type:** Integration (keyboard)
- **Risk:** LOW — Fluent components handle this; just verify button works

---

## Minimum Automated Coverage (For CI)

### New Tests to Add

#### 1. Unit: AuthCard Catalog Registration
**File:** `packages/web/src/__tests__/catalog-components.test.ts` (create if needed)

```typescript
describe('kickstart catalog', () => {
  it('includes AuthCard', () => {
    const componentNames = Array.from(kickstartCatalog.components.keys());
    expect(componentNames).toContain('AuthCard');
  });
  
  it('includes DeploymentProgress', () => {
    const componentNames = Array.from(kickstartCatalog.components.keys());
    expect(componentNames).toContain('DeploymentProgress');
  });
});
```

**Why:** Prevents silent dropping of LLM output if component is registered.

#### 2. Unit: AuthCard Schema Validation
**File:** `packages/core/src/__tests__/a2ui-schema.test.ts`

```typescript
describe('AuthCard schema', () => {
  it('validates valid AuthCard payload', () => {
    const payload = {
      id: 'auth1',
      component: 'AuthCard',
      provider: 'azure',
      title: 'Sign in to Azure',
      description: 'Connect to deploy',
    };
    expect(() => AuthCardPropsSchema.parse(payload)).not.toThrow();
  });
  
  it('rejects invalid provider', () => {
    const payload = {
      id: 'auth1',
      component: 'AuthCard',
      provider: 'invalid',
    };
    expect(() => AuthCardPropsSchema.parse(payload)).toThrow();
  });
});
```

**Why:** Ensures schema matches component implementation; prevents validation runtime errors.

#### 3. A11y: AuthCard ARIA Compliance
**File:** `packages/web/src/__tests__/a11y-components.test.ts` (add to existing file)

```typescript
describe('AuthCard', () => {
  const src = readComponent(CATALOG_DIR, 'AuthCard');

  it('button has descriptive aria-label', () => {
    expect(src).toContain('Sign in to'); // "Sign in to Azure" or "Sign in to GitHub"
  });

  it('error MessageBar is present if error state exists', () => {
    expect(src).toContain('MessageBar');
  });

  it('offline mode caption is informative', () => {
    expect(src).toContain('offline mode');
  });
});
```

**Why:** Guards A11y compliance; prevents regressions on keyboard nav, screen readers.

#### 4. Integration: Demo Flow Completion
**File:** `packages/web/src/__tests__/demo-flow.test.ts` (create if needed)

```typescript
describe('demo-scenarios — flow completion', () => {
  it('GENERATE phase includes DeploymentProgress component', () => {
    const generateResponse = DEMO_SCENARIOS[/* GENERATE index */];
    const components = extractComponentIds(generateResponse.a2uiMessages);
    expect(components).toContain(/* deployment progress id */);
  });

  it('flow does not require DEPLOY or DEPLOYMENT phases for demo', () => {
    // Assert that WELCOME → DISCOVER → DESIGN → GENERATE completes without DEPLOY
    // or that DEPLOY phase has a graceful end state
  });

  it('final message is clear completion state', () => {
    // Assert last demo response says "Your code is ready" or similar
  });
});
```

**Why:** Prevents flow from hitting unimplemented phases; ensures demo completes.

#### 5. Snapshot: System Prompt Deployment Section
**File:** `packages/core/src/__tests__/system-prompt.test.ts`

```typescript
describe('system prompt — component catalog section', () => {
  it('includes AuthCard in component catalog', () => {
    const prompt = buildSystemPrompt(/* args */);
    expect(prompt).toContain('AuthCard');
  });

  it('includes DeploymentProgress in component catalog', () => {
    const prompt = buildSystemPrompt(/* args */);
    expect(prompt).toContain('DeploymentProgress');
  });

  it('examples for AuthCard and DeploymentProgress are valid JSON', () => {
    const catalog = generateComponentCatalogSection();
    const authExample = extractExample(catalog, 'AuthCard');
    const depExample = extractExample(catalog, 'DeploymentProgress');
    
    expect(JSON.parse(authExample)).toBeDefined();
    expect(JSON.parse(depExample)).toBeDefined();
  });
});
```

**Why:** Ensures LLM gets correct component documentation; valid JSON prevents parse errors.

---

## Test Execution Plan (Order of Operations)

### Phase 1: Pre-Implementation (Static Validation)
- [ ] Verify AuthCard component source exists and exports correctly
- [ ] Verify AuthCard schema in `a2ui-schema.ts` matches component props
- [ ] Verify system prompt documents AuthCard and DeploymentProgress with valid JSON examples
- [ ] Check demo-scenarios for flow completion (does it end at GENERATE?)

### Phase 2: Implementation
- [ ] Register AuthCard in `kickstart-catalog.ts`
- [ ] Update system prompt or guards if needed
- [ ] Ensure demo flow ends gracefully

### Phase 3: Post-Implementation (Automated + Manual)
- [ ] Run new unit tests (catalog, schema, A11y)
- [ ] Run demo flow test (DISCOVER → DESIGN → GENERATE completes)
- [ ] Manual test: Follow demo flow in browser, verify AuthCard renders (if reached)
- [ ] Manual test: Verify no stale cards left behind
- [ ] Accessibility check: Tab through AuthCard, verify keyboard nav

### Phase 4: Regression
- [ ] Ensure all existing tests pass
- [ ] Ensure no other components broken by catalog changes
- [ ] Verify demo works end-to-end without errors

---

## Quality Bar (Hermes Decision)

### No Exceptions to Coverage
1. **Every component registration must have a unit test** — catalog changes are invisible otherwise
2. **Every schema change must have validation test** — mismatches cause runtime failures
3. **Every flow endpoint must be clearly defined** — no dead ends
4. **A11y baseline is non-negotiable** — AuthCard gets ARIA compliance test before merge

### Demo-Ready Definition (Acceptance Criteria)
- ✓ User completes DISCOVER → DESIGN → GENERATE without errors
- ✓ All components render correctly
- ✓ Flow ends with clear completion message (no dead ends)
- ✓ No stale cards or broken event handlers
- ✓ AuthCard renders if reached (stub mode if no connector)
- ✓ All tests pass (unit, integration, A11y)

---

## Blockers & Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| AuthCard not in catalog | Component silently dropped by LLM | Unit test (catalog inventory) |
| Schema mismatch | Runtime validation errors | Unit test (schema validation) |
| Unimplemented DEPLOY phase | Flow dead-end, demo fails | Review system prompt guards |
| Stale cards remain | UX confusion | Component cleanup test |
| Missing A11y attributes | QA gate failure | A11y compliance test |

---

## Success Criteria

✅ All acceptance tests pass (manual + automated)  
✅ AuthCard renders correctly in demo flow  
✅ Demo completes without errors  
✅ No stale context cards visible  
✅ New unit/integration tests added to CI  
✅ A11y baseline established for AuthCard  

---

**Signed:** Hermes, Tester  
**Date:** 2026-04-15  
**Status:** READY FOR IMPLEMENTATION
