---
sidebar_position: 2
---

# Extending the A2UI Component System

> How to add new components, register them across the stack, teach the LLM to use them, and build playground scenarios — including smart components with built-in authentication, validation, and state management.

This guide walks through the full lifecycle of extending Kickstart's A2UI component system — from defining a React component to seeing it rendered by the LLM in production.

## The 4-Layer Stack

Every A2UI component touches four layers of the stack. Missing any one layer causes the component to silently fail — either the backend drops it, the LLM never emits it, or the frontend doesn't know how to render it.

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: LLM System Prompt                                    │
│  packages/pack-core/src/catalog/component-catalog.ts           │
│  → Teaches the LLM that the component exists + usage example   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Backend Validator                                    │
│  packages/pack-core/src/a2ui-schema.ts                         │
│  → Zod schema validates LLM output; drops unknown components  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Frontend Catalog                                     │
│  packages/web/src/catalog/kickstart-catalog.ts                 │
│  → Registers the React component so the A2UI renderer finds it │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: React Component                                      │
│  packages/web/src/catalog/components/YourComponent.tsx         │
│  → The actual UI implementation (Zod schema + React + Fluent)  │
└─────────────────────────────────────────────────────────────────┘
```

| Missing layer | Symptom |
|---|---|
| System prompt catalog | LLM never emits your component |
| Backend validator | Backend silently strips the component from the response |
| Frontend catalog | A2UI renderer ignores the component (blank space) |
| React component | Import fails, catalog registration breaks |

## Step 1: Create the React Component

**Files to modify:**

| File | Action |
|---|---|
| `packages/web/src/catalog/components/YourComponent.tsx` | **Create** — component implementation |
| `packages/web/src/catalog/kickstart-catalog.ts` | **Edit** — register in catalog |

### Define the Zod schema

The schema defines what props the LLM can send. It lives at the top of your component file.

```typescript
import { z } from 'zod';
import {
  DynamicStringSchema,
  ActionSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';

const StatusBannerApi = {
  name: 'StatusBanner',
  schema: z.object({
    title: DynamicStringSchema,
    message: DynamicStringSchema,
    severity: z.enum(['info', 'warning', 'error', 'success']).optional(),
    dismissible: z.boolean().optional(),
    action: ActionSchema.optional(),
  }).strict(),
};
```

Key conventions:
- Use `DynamicStringSchema` for any string prop — it supports both literal strings and A2UI data bindings (e.g. `{ "$ref": "/data/name" }`)
- Use `ActionSchema` for any clickable action
- Always call `.strict()` — this rejects unknown properties, catching LLM hallucinations early

### Implement the React component

Use `createReactComponent()` from `packages/web/src/vendor/a2ui/react/adapter.tsx`:

```typescript
import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { Card, makeStyles, tokens } from '@fluentui/react-components';
import { sanitizeActionContext } from '../../utils/sanitize-action-context';

const useStyles = makeStyles({
  root: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
  },
});

export const StatusBanner = createReactComponent(StatusBannerApi, ({ props, context }) => {
  const classes = useStyles();

  const handleDismiss = () => {
    if (!props.action) return;
    const rawAction = context.componentModel.properties.action;
    if (rawAction && typeof rawAction === 'object' && 'event' in rawAction) {
      const resolved = context.dataContext.resolveAction(rawAction);
      const safeContext = sanitizeActionContext(resolved.event.context);
      context.dispatchAction({
        event: { ...resolved.event, context: { ...safeContext, dismissed: true } },
      });
    }
  };

  return (
    <Card className={classes.root} role="status" aria-label={String(props.title)}>
      {String(props.title)}
      {props.dismissible && <button onClick={handleDismiss} aria-label="Dismiss">✕</button>}
    </Card>
  );
});
```

### Action dispatch pattern

When a user interacts with your component, dispatch an action so the LLM receives context for the next turn:

```typescript
// 1. Read the raw action definition
const rawAction = context.componentModel.properties.action;

// 2. Guard: only dispatch if the LLM provided an action
if (rawAction && typeof rawAction === 'object' && 'event' in rawAction) {
  // 3. Resolve any DataBindings in the action's context
  const resolved = context.dataContext.resolveAction(rawAction);

  // 4. Sanitize and enrich with the user's actual selection
  const safeContext = sanitizeActionContext(resolved.event.context);
  context.dispatchAction({
    event: {
      ...resolved.event,
      context: { ...safeContext, value: selectedValue, selectedLabel },
    },
  });
}
```

:::note Why enrich the context?
The LLM defines static context in the action JSON (e.g. `{ label: "Pick a runtime" }`), but it doesn't know the user's actual selection. Your component must inject the selected value — otherwise the LLM only sees the static label.
:::

### Register in the catalog

```typescript
// packages/web/src/catalog/kickstart-catalog.ts
import { StatusBanner } from './components/StatusBanner';

const kickstartComponents: ReactComponentImplementation[] = [
  ...Array.from(basicCatalog.components.values()),
  ...fluentOverrides,
  // ... existing components ...
  StatusBanner,
];
```

## Step 2: Add the Backend Validation Schema

**File:** `packages/pack-core/src/a2ui-schema.ts`

### Add to `KNOWN_COMPONENT_TYPES`

```typescript
export const KNOWN_COMPONENT_TYPES = new Set([
  // ...
  "StatusBanner",   // ← add here (alphabetical)
  // ...
] as const);
```

### Define the Zod schema

```typescript
const StatusBannerPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("StatusBanner"),
    title: dynamicString,
    message: dynamicString,
    severity: z.enum(["info", "warning", "error", "success"]).optional(),
    dismissible: z.boolean().optional(),
    action: actionSchema.optional(),
  })
  .strip();   // ← .strip() (not .strict()) removes unknown fields without rejecting
```

### Register in `COMPONENT_SCHEMA_REGISTRY`

```typescript
export const COMPONENT_SCHEMA_REGISTRY: Record<string, z.ZodType> = {
  // ...
  StatusBanner: StatusBannerPropsSchema,
  // ...
};
```

**Payload limits** enforced globally:

```typescript
export const PAYLOAD_LIMITS = {
  maxMessages: 50,
  maxComponents: 200,
  maxPayloadBytes: 512 * 1024,   // 512 KB
  maxNestingDepth: 10,
  maxStringLength: 50_000,
  maxActions: 20,
};
```

## Step 3: Teach the LLM to Use Your Component

**File:** `packages/pack-core/src/catalog/component-catalog.ts`

Add a `ComponentCatalogEntry` to the catalog array:

```typescript
{
  type: "StatusBanner",
  category: "domain",
  example: '{"id":"sb1","component":"StatusBanner","title":"Deployment Ready","message":"All checks passed.","severity":"success","dismissible":true}',
  notes: "Severity: info, warning, error, success. Use for transient status messages.",
},
```

Category guidance:
- `layout` — containers holding other components (Row, Column, Card)
- `content` — display-only (Text, Markdown, Image)
- `input` — interactive (Button, TextField, RadioGroup)
- `domain` — Kickstart-specific (CodeBlock, ArchitectureDiagram)

## Step 4: Add a Playground Scenario

**File:** `packages/web/src/pages/playground-scenarios.ts`

```typescript
const customStatusBanner = (): A2uiMsg[] => {
  const sid = uid('status-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['banner-success', 'banner-error'], gap: 'medium' },
    {
      id: 'banner-success',
      component: 'StatusBanner',
      title: 'Deployment Succeeded',
      message: 'All 3 services are running.',
      severity: 'success',
      dismissible: true,
    },
    {
      id: 'banner-error',
      component: 'StatusBanner',
      title: 'Health Check Failed',
      message: 'Endpoint /health returned 503.',
      severity: 'error',
    },
  ] as A2uiComponent[]);
};

// Add to CONTROL_SCENARIOS:
{ id: 'ctrl-status', label: 'StatusBanner', description: 'Severity-based status messages', group: 'Custom Controls', catalog: 'kickstart', generate: customStatusBanner },
```

## Fluent 2 Styling Conventions

### Rules

1. **Use `makeStyles` — never inline styles**
2. **Use longhand border properties** (Griffel doesn't support shorthand `border: ...`)
3. **Use string values for dimensions** (`'0'` not `0`)
4. **Use design tokens for all colors and spacing**

```typescript
import { makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    // Longhand borders:
    borderTopWidth: tokens.strokeWidthThick,
    borderRightWidth: tokens.strokeWidthThick,
    borderBottomWidth: tokens.strokeWidthThick,
    borderLeftWidth: tokens.strokeWidthThick,
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    borderLeftColor: tokens.colorBrandStroke1,
  },
});
```

:::danger No `!important` overrides
Never use `!important` in element-level CSS inside A2UI surfaces. It breaks Fluent UI v9 Griffel styles. Use `makeStyles` or target component-specific classes.
:::

### Accessibility

All components must meet WCAG 2.1 AA:
- `aria-label` on interactive elements
- `role` attributes on custom interactive elements
- Roving `tabIndex` for keyboard navigation in groups
- `aria-live` regions for dynamic content updates

## Smart Components

### What Is a Smart Component?

From the LLM's perspective, smart components look identical to any other component — same JSON structure, same catalog entry. The **smart distinction is purely a frontend implementation pattern**: the component manages its own async flows (authentication, API calls, multi-step wizards) internally.

**LLM output — identical pattern for both:**

```json
{ "component": "Text", "text": "Click below" }
{ "component": "GitHubLoginCard", "deviceCode": "ABCD-EFGH", "verificationUrl": "https://github.com/login/device" }
```

The difference: `Text` displays its props; `GitHubLoginCard` manages the full OAuth flow internally.

### When to Build a Smart Component

Build a smart component when the component needs to:
- Manage its own data fetching or polling
- Handle authentication flows (OAuth device code, MSAL)
- Orchestrate multi-step async processes
- Handle errors gracefully without LLM intervention

### Smart Component Pattern

```typescript
import { useState, useEffect } from 'react';
import { useAPIConnector } from '../../hooks/useAPIConnector';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';

export const MySmartComponent = createReactComponent(api, ({ props }) => {
  const connector = useAPIConnector('github');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      setPhase('loading');
      try {
        const result = await connector.doSomething(props.config);
        setData(result);
        setPhase('done');
      } catch {
        setPhase('error');
      }
    })();
  }, [props.config]);

  if (phase === 'loading') return <Spinner />;
  if (phase === 'error') return <Alert>Something went wrong</Alert>;
  return <RenderedContent data={data} />;
});
```

For full control over context bindings, use `createBinderlessComponent()` instead of `createReactComponent()`.

### Built-in Smart Components

**Azure Components:**
| Component | Purpose | Handles Internally |
|-----------|---------|-------------------|
| `AzureLoginCard` | Device code MSAL auth flow | Token lifecycle, session state, logout |
| `AzureResourcePicker` | Browse subscriptions and list resources | ARM API calls, rate-limit handling |
| `AzureResourceForm` | Collect deployment parameters | Input validation, cost estimation |

**GitHub Components:**
| Component | Purpose | Handles Internally |
|-----------|---------|-------------------|
| `GitHubLoginCard` | Device code OAuth flow | Token lifecycle, polling, session state |
| `GitHubRepoPicker` | Search and select repositories | GitHub API calls, debounced search |
| `GitHubAction` | Execute allowlisted operations | Operation validation, confirmations for DELETE |
| `GitHubCommit` | Create pull request | Branch validation, protected-branch guards |

### Security for Smart Components

Smart components integrating with external services must implement:
- **In-memory token storage** — never `localStorage` for sensitive tokens
- **Operation allowlisting** — validate allowed operations before execution
- **Typed confirmation** — require explicit user confirmation for destructive operations
- **Protected-branch guards** — block writes to production branches
- **Rate-limit handling** — gracefully degrade with warnings when limits are hit

## Checklist

```
□ Component file: packages/web/src/catalog/components/YourComponent.tsx
  □ Zod schema with DynamicStringSchema and .strict()
  □ createReactComponent() with makeStyles + tokens
  □ Action dispatch: resolveAction() + sanitizeActionContext()
  □ Accessibility: aria-label, role, keyboard support

□ Catalog: packages/web/src/catalog/kickstart-catalog.ts
  □ Import added
  □ Component added to kickstartComponents array

□ Backend schema: packages/pack-core/src/a2ui-schema.ts
  □ Type added to KNOWN_COMPONENT_TYPES (alphabetical)
  □ YourComponentPropsSchema defined with .strip()
  □ Schema added to COMPONENT_SCHEMA_REGISTRY (alphabetical)

□ LLM catalog: packages/pack-core/src/catalog/component-catalog.ts
  □ ComponentCatalogEntry added to catalog array
  □ JSON example is concise and shows key props

□ Playground: packages/web/src/pages/playground-scenarios.ts
  □ Factory function using uid() + surface() helpers
  □ ScenarioDef added to CONTROL_SCENARIOS

□ Fluent 2 styling verified
  □ No inline styles or hardcoded colors
  □ Longhand border properties only
  □ Design tokens for all spacing and colors
  □ Dark mode works (test in Playground with theme toggle)
```
