# Testing Strategy

**When to use:** You need to write tests, validate changes, or set up the testing pipeline.

## Context

Kickstart uses a dual testing approach: Vitest for unit/integration tests and Playwright for end-to-end tests. All feature work must include or be validated by both layers. A rules engine provides extensible validation with a canonical registry.

## Steps

### 1. Unit Tests (Vitest)

Run unit tests:
```bash
npm run test
```

- Tests live alongside source files or in `__tests__/` directories
- Use `vitest` with the workspace config at `vitest.config.ts`
- Mock external dependencies (Azure APIs, LLM calls)

### 2. End-to-End Tests (Playwright)

Run E2E tests:
```bash
npx playwright test
```

- Config at `playwright.config.ts` with `webServer` set to Vite preview
- Tests validate full user flows (landing → chat → component rendering)
- **All feature work must be validated by Playwright tests** (user directive)
- Playwright E2E runs in a separate CI job for isolation

### 3. Validation Engine & Rules Registry

The validation system uses a canonical `ALL_RULES` array:

- `ALL_RULES` in `validation/index.ts` is the single source of truth
- Both `createDefaultValidationEngine()` and `createDefaultRulesEngine()` iterate over it
- New validators go in `ALL_RULES` — never in individual factory functions

Each `ValidationRule` has metadata:
- `category` — maps to AKS Automatic constraint families
- `tags` — for filtering
- `aksConstraint` — optional policy alignment
- `autoFixAvailable` — whether auto-remediation is possible

### 4. CI Pipeline

All CI checks must pass before merge (`.github/workflows/ci.yml`):
1. Lint (`npm run lint`)
2. TypeScript check (`cd packages/web && npx tsc --noEmit`)
3. Build core, API, web
4. Unit tests (Vitest)
5. Playwright E2E tests

Do NOT merge PRs with failing required checks. If checks fail, spawn the owning agent to fix failures and iterate until green.
