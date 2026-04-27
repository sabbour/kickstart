import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-console': 'warn',
      'no-control-regex': 'off',
    },
  },
  // Observability guardrail (issue #1030): only `packages/web/api/src/lib/appinsights.ts`
  // may import the Azure Monitor OTel distro or the classic `applicationinsights`
  // SDK. Any other import path risks a double `useAzureMonitor()` call which
  // wipes the OTel global registry and kills the entire telemetry pipeline.
  {
    files: ['packages/web/api/src/**/*.ts'],
    ignores: ['packages/web/api/src/lib/appinsights.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@azure/monitor-opentelemetry',
            message: 'Import useAzureMonitor/flush via packages/web/api/src/lib/appinsights.ts only. See issue #1030.',
          },
          {
            name: 'applicationinsights',
            message: 'The classic applicationinsights SDK is banned in API code — use trackException/trackTrace/trackEvent from src/lib/appinsights.ts (pure OTel). See issue #1030.',
          },
        ],
      }],
    },
  },
  // Strict-mode schema compliance guardrails (issues #97 & #99):
  // Tool and schema-type files must not use .optional() (I2 violation) and must
  // import z via z-strict.ts, which wraps Zod with strict-mode-safe helpers.
  // These rules are intentionally set to 'error' so CI fails on new violations.
  {
    files: ['packages/*/src/tools/**/*.ts', 'packages/*/src/types/**/*.ts'],
    rules: {
      // #97: Ban .optional() — produces properties missing from `required`, which
      // OpenAI strict-mode rejects (invariant I2). Use strictOptional() from
      // z-strict.ts instead, which adds the field to `required` as nullable.
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='optional']",
          message:
            "Use strictOptional() from '@aks-kickstart/harness/runtime/z-strict' instead of .optional() — .optional() violates OpenAI strict-mode (I2: property missing from required).",
        },
      ],
      // #99: Require z-strict.ts as the only Zod entry point in tool files.
      // Direct 'zod' imports allow bypassing strict-mode-safe helpers and
      // producing non-compliant schemas that silently pass TypeScript but
      // fail at the OpenAI API boundary.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'zod',
              message:
                "Import z from '@aks-kickstart/harness/runtime/z-strict' instead — it wraps Zod with strict-mode-safe helpers (strictOptional, stripNulls, etc.).",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['**/dist/', '**/node_modules/', '**/vendor/'],
  },
);
