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
  {
    ignores: ['**/dist/', '**/node_modules/', '**/vendor/'],
  },
);
