---
mode: agent
description: Scaffold a new A2UI catalog component for kickstart
---

# Add a Kickstart Catalog Component

Create a new A2UI v0.9 catalog component for the kickstart web app.

## Input

- **Component name:** {{componentName}} (PascalCase, e.g. `ResourceGraph`)
- **Description:** {{description}}
- **Props:** {{props}} (list each prop with its type and purpose)

## Files to Create / Modify

### 1. Component file — `packages/web/src/catalog/components/{{componentName}}.tsx`

Use the `createReactComponent` adapter pattern. Follow this structure:

```tsx
import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Card,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const {{componentName}}Api = {
  name: '{{componentName}}',
  schema: z.object({
    // All string props MUST use DynamicStringSchema for A2UI dynamic binding
    // Example: title: DynamicStringSchema.optional(),
    // Non-string props use standard Zod types: z.number(), z.boolean(), z.array(...)
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    padding: '0',
    overflow: 'hidden',
  },
  // Add styles here — use Fluent tokens exclusively:
  // Spacing: tokens.spacingVerticalS, tokens.spacingHorizontalM, etc.
  // Colors: tokens.colorNeutralBackground1, tokens.colorBrandForeground1, etc.
  // Typography: tokens.fontSizeBase300, tokens.fontWeightSemibold, etc.
  // Borders: tokens.strokeWidthThin, tokens.borderRadiusMedium, etc.
});

export const {{componentName}} = createReactComponent({{componentName}}Api, ({ props, context }) => {
  const classes = useStyles();

  return (
    <Card className={classes.root}>
      {/* Component JSX here */}
    </Card>
  );
});
```

### 2. Register in catalog — `packages/web/src/catalog/kickstart-catalog.ts`

Add the import and registration:

```tsx
import { {{componentName}} } from './components/{{componentName}}';
```

Add `{{componentName}}` to the `kickstartComponents` array.

## Conventions (MUST follow)

### Schema
- The API object is named `{{componentName}}Api`
- Export the component as a **named export**: `export const {{componentName}} = createReactComponent(...)`
- All string props use `DynamicStringSchema` (supports A2UI dynamic binding)
- Schema MUST call `.strict()` — no extra props allowed
- All new props MUST be `.optional()` unless absolutely required for rendering

### Styling
- Use `makeStyles` from `@fluentui/react-components` — no raw CSS files
- Use Fluent `tokens.*` for ALL spacing, colors, typography, borders
- No hardcoded colors (`#fff`, `red`) or sizes (`12px` for spacing) — use tokens
- Icons: `@fluentui/react-icons` (Regular weight, e.g. `DocumentRegular`)

### React Hooks
- React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`) work inside the `createReactComponent` render function — it is a real React FC
- Custom hooks like `useArtifacts()` and `useAPIConnector()` are available (providers mount above the app tree)

### Actions & Interactivity
- For action props (callbacks from backend): use `ActionSchema` from `../../vendor/a2ui/web_core/schema/common-types`
- For dispatching dynamic data back to the backend: use `context.dispatchAction({ event: { name: 'api:...', context: { ... } } })`
- Never pass dynamic form data through `ActionSchema` props — use `context.dispatchAction` instead

### Security
- Sanitize any HTML output with `sanitizeHtml()` from `../../utils/sanitize`
- Never use `dangerouslySetInnerHTML` without `sanitizeHtml()`
- Never store tokens or credentials in component state for display
- Validate/allowlist operation types for write-capable components

### Lazy Loading (for heavy dependencies)
- Use dynamic `import()` with a singleton loader pattern (see `ArchitectureDiagram.tsx` for Mermaid example)
- Show a loading indicator while the dependency loads
- Cache the loaded module in a module-level variable to avoid re-initialization

## Reference Examples

| Complexity | Component | Pattern |
|-----------|-----------|---------|
| Simple display | `CodeBlock.tsx` | Static hljs rendering, copy button |
| Table + formatting | `CostEstimate.tsx` | `Intl.NumberFormat`, SKU selector, projection slider |
| Auth + API | `GitHubLoginCard.tsx` | `useAPIConnector`, `useState` for auth flow |
| Lazy loading | `ArchitectureDiagram.tsx` | Dynamic `import('mermaid')`, singleton cache, pan/zoom |
| Forms + dispatch | `AzureResourceForm.tsx` | `context.dispatchAction`, input validation, Fluent `Field`/`Select` |
| Multi-file tabs | `FileEditor.tsx` | `TabList`, Monaco lazy-load, hljs read-only fallback |

## Verification Checklist

After creating the component:

- [ ] TypeScript compiles with no errors (`npm run build` in `packages/web`)
- [ ] Component is registered in `kickstart-catalog.ts`
- [ ] All string props use `DynamicStringSchema`
- [ ] Schema uses `.strict()`
- [ ] No hardcoded colors or spacing — only Fluent tokens
- [ ] `sanitizeHtml()` used for any `dangerouslySetInnerHTML`
- [ ] Heavy dependencies lazy-loaded with singleton pattern
