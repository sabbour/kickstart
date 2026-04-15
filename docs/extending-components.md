# A2UI Component Extension Guide

> How to add new components, register them across the stack, teach the LLM to use them, and build playground scenarios.

This guide walks through the full lifecycle of extending Kickstart's A2UI component system — from defining a React component to seeing it rendered by the LLM in production.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Creating a New A2UI Component](#2-creating-a-new-a2ui-component)
3. [Adding a Backend Validation Schema](#3-adding-a-backend-validation-schema)
4. [Teaching the LLM to Use Your Component](#4-teaching-the-llm-to-use-your-component)
5. [Adding a Playground Scenario](#5-adding-a-playground-scenario)
6. [Fluent 2 Styling Conventions](#6-fluent-2-styling-conventions)
7. [Checklist](#7-checklist)

---

## 1. Architecture Overview

Every A2UI component touches four layers of the stack. Missing any one layer causes the component to silently fail — either the backend drops it, the LLM never emits it, or the frontend doesn't know how to render it.

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: LLM System Prompt                                    │
│  packages/core/src/prompts/component-catalog.ts                │
│  → Teaches the LLM that the component exists + usage example   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Backend Validator                                    │
│  packages/core/src/services/a2ui-schema.ts                     │
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

**If you skip a layer:**

| Missing layer | Symptom |
|---|---|
| System prompt catalog | LLM never emits your component |
| Backend validator | Backend silently strips the component from the response |
| Frontend catalog | A2UI renderer ignores the component (blank space) |
| React component | Import fails, catalog registration breaks |

---

## 2. Creating a New A2UI Component

### Files to modify

| File | Action |
|---|---|
| `packages/web/src/catalog/components/YourComponent.tsx` | **Create** — component implementation |
| `packages/web/src/catalog/kickstart-catalog.ts` | **Edit** — register in catalog |

### Step-by-step

#### Step 1: Define the Zod schema (the "API")

The schema defines what props the LLM can send. It lives at the top of your component file.

```typescript
// packages/web/src/catalog/components/StatusBanner.tsx

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

**Key conventions:**

- Use `DynamicStringSchema` for any string prop — it supports both literal strings and A2UI data bindings (e.g. `{ "$ref": "/data/name" }`)
- Use `ActionSchema` for any clickable action — it resolves to the standard `{ event: { name, context } }` format
- Always call `.strict()` on the schema — this rejects unknown properties at the component level, catching LLM hallucinations early

**Real example — RadioGroup schema** (from `packages/web/src/catalog/components/RadioGroup.tsx`):

```typescript
const RadioGroupApi = {
  name: 'RadioGroup',
  schema: z.object({
    options: z.array(z.object({
      id: z.string(),
      label: DynamicStringSchema,
      description: DynamicStringSchema.optional(),
      recommended: z.boolean().optional(),
    })),
    value: DynamicStringSchema.optional(),
    action: ActionSchema,
  }).strict(),
};
```

#### Step 2: Implement the React component

Use `createReactComponent()` from `packages/web/src/vendor/a2ui/react/adapter.tsx`. This factory wires up A2UI data binding via `GenericBinder` and `useSyncExternalStore` — you get reactive props for free.

```typescript
import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import {
  Card,
  Badge,
  Body1Strong,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { sanitizeActionContext } from '../../utils/sanitize-action-context';

export const StatusBanner = createReactComponent(StatusBannerApi, ({ props, context }) => {
  const classes = useStyles();

  const handleDismiss = () => {
    if (!props.action) return;

    const rawAction = context.componentModel.properties.action;
    if (rawAction && typeof rawAction === 'object' && 'event' in rawAction) {
      const resolved = context.dataContext.resolveAction(rawAction);
      const safeContext = sanitizeActionContext(resolved.event.context);
      context.dispatchAction({
        event: {
          ...resolved.event,
          context: { ...safeContext, dismissed: true },
        },
      });
    }
  };

  return (
    <Card className={classes.root} role="status" aria-label={String(props.title)}>
      <Body1Strong>{String(props.title)}</Body1Strong>
      <Caption1>{String(props.message)}</Caption1>
      {props.dismissible && (
        <button onClick={handleDismiss} aria-label="Dismiss">✕</button>
      )}
    </Card>
  );
});
```

**`createReactComponent()` signature** (from `adapter.tsx`):

```typescript
function createReactComponent<Api extends ComponentApi>(
  api: Api,
  RenderComponent: React.FC<ReactA2uiComponentProps<ResolveA2uiProps<...>>>
): ReactComponentImplementation
```

It returns an object with `{ name, schema, render }` — exactly what the catalog needs.

**The render function receives three arguments via the props object:**

| Argument | Type | Purpose |
|---|---|---|
| `props` | Resolved schema type | Already-bound props (data bindings resolved to values) |
| `context` | `ComponentContext` | Access to `componentModel`, `dataContext`, `dispatchAction` |
| `buildChild` | `(id: string) => ReactNode` | Render child components by ID (for layout containers) |

#### Step 3: Action dispatch pattern

When a user interacts with your component, dispatch an action so the LLM receives it as context for the next turn. The pattern is consistent across all components:

```typescript
// 1. Read the raw (un-resolved) action definition from the component model
const rawAction = context.componentModel.properties.action;

// 2. Guard: only dispatch if the LLM provided an action with an event
if (rawAction && typeof rawAction === 'object' && 'event' in rawAction) {

  // 3. Resolve any DataBindings in the action's context
  const resolved = context.dataContext.resolveAction(rawAction);

  // 4. Sanitize the context to prevent injection
  const safeContext = sanitizeActionContext(resolved.event.context);

  // 5. Dispatch with enriched context (inject the user's actual selection)
  context.dispatchAction({
    event: {
      ...resolved.event,
      context: {
        ...safeContext,
        value: selectedValue,                    // what the user picked
        selectedLabel: selectedLabel?.slice(0, 200),  // human-readable label
      },
    },
  });
}
```

> **Why enrich the context?** The LLM defines static context in the action JSON (e.g. `{ label: "Pick a runtime" }`), but it doesn't know the user's actual selection until the action fires. Your component must inject the selected value — otherwise the LLM only sees the static label, not what was chosen.

#### Step 4: Register in the catalog

Add your component to `packages/web/src/catalog/kickstart-catalog.ts`:

```typescript
// Add import
import { StatusBanner } from './components/StatusBanner';

// Add to the components array
const kickstartComponents: ReactComponentImplementation[] = [
  ...Array.from(basicCatalog.components.values()),
  ...fluentOverrides,
  RadioGroup,
  FormGroup,
  // ... existing components ...
  StatusBanner,  // ← add here
];
```

The catalog is instantiated as:

```typescript
export const kickstartCatalog = new Catalog<ReactComponentImplementation>(
  'kickstart',             // Catalog ID — referenced in createSurface messages
  kickstartComponents,     // All registered component implementations
  Array.from(basicCatalog.functions.values()),
);
```

### The "Fat Component" Pattern

For components that manage their own async flows (authentication, API calls, multi-step wizards), use the **fat component** pattern. These are self-contained state machines — the LLM doesn't participate during the flow, only receiving a callback when it completes.

**Characteristics:**

- Complete state machine (e.g. `'idle' | 'awaiting-code' | 'polling' | 'authenticated'`)
- Async operations (API calls, polling, timers)
- Internal error handling with user-friendly messages
- Stub/offline mode for testing without a backend
- Callbacks (`onSignIn`, `onSubmit`, `onSuccess`) trigger the LLM when the flow finishes

**Real example — GitHubLoginCard** (from `packages/web/src/catalog/components/GitHubLoginCard.tsx`):

```typescript
type LoginPhase = 'idle' | 'awaiting-code' | 'polling' | 'authenticated';

export const GitHubLoginCard = createReactComponent(GitHubLoginCardApi, ({ props }) => {
  const connector = useAPIConnector('github') as GitHubConnector | undefined;

  const [phase, setPhase] = useState<LoginPhase>(
    () => connector?.isAuthenticated() ? 'authenticated' : 'idle'
  );
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [error, setError] = useState<string | undefined>();

  const handleSignIn = async () => {
    if (!connector) {
      // Stub mode — simulate auth for offline/testing
      setUser(STUB_USER);
      setPhase('authenticated');
      if (props.onSignIn) (props.onSignIn as () => void)();
      return;
    }

    setPhase('awaiting-code');
    try {
      setDeviceCode({ userCode: 'XXXX-XXXX', verificationUri: '...' });
      setPhase('polling');
      await connector.authenticate();
      if (connector.isAuthenticated()) {
        setPhase('authenticated');
        await fetchUser(connector);
        if (props.onSignIn) (props.onSignIn as () => void)();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  // Render different UI based on phase
  if (phase === 'authenticated') return <Card>✅ Signed in as {user?.login}</Card>;
  if (phase === 'polling')       return <Card>⏳ Enter code: {deviceCode?.userCode}</Card>;
  return <Card><Button onClick={handleSignIn}>Sign in with GitHub</Button></Card>;
});
```

For fat components that need full control over their context bindings, use `createBinderlessComponent()` instead of `createReactComponent()`:

```typescript
import { createBinderlessComponent } from '../../vendor/a2ui/react/adapter';

export const MyFatComponent = createBinderlessComponent(MyFatComponentApi, ({ context }) => {
  // You manage your own state — no GenericBinder
  // Access raw props via context.componentModel.properties
});
```

---

## 3. Adding a Backend Validation Schema

### Overview

The backend validates every A2UI message the LLM generates before sending it to the frontend. If your component type isn't registered, the validator **silently strips** it from the response — the LLM thinks it emitted your component, but the user never sees it.

### Files to modify

| File | Action |
|---|---|
| `packages/core/src/services/a2ui-schema.ts` | **Edit** — add type + schema |

### Step-by-step

#### Step 1: Add to `KNOWN_COMPONENT_TYPES`

This set is at the top of the file (line ~56). Add your component in alphabetical order:

```typescript
export const KNOWN_COMPONENT_TYPES = new Set([
  "Accordion",
  "Alert",
  "ArchitectureDiagram",
  // ...
  "Slider",
  "StatusBanner",        // ← add here (alphabetical)
  "SteppedCarousel",
  "Table",
  // ...
] as const);
```

#### Step 2: Define the per-component Zod schema

Add your schema near the other per-component schemas (around line ~145-740). Use the shared Zod helpers defined in the file:

| Helper | Purpose |
|---|---|
| `boundedString` | String truncated to `PAYLOAD_LIMITS.maxStringLength` |
| `boundedStringNonEmpty` | Non-empty bounded string |
| `dynamicString` | `string \| Record<string, unknown>` — supports data bindings |
| `actionSchema` | `{ event: { name, data?, context? } }` |
| `childrenArray` | `string[]` for child component IDs |

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
  .strip();  // ← .strip() removes unknown fields (security — prevents prop injection)
```

> **Important:** Use `.strip()` (not `.strict()`) on the backend schema. The backend schema is lenient — it strips unknown fields rather than rejecting. The frontend schema uses `.strict()` for early feedback during development.

#### Step 3: Register in `COMPONENT_SCHEMA_REGISTRY`

Add your schema to the registry (line ~745), in alphabetical order:

```typescript
export const COMPONENT_SCHEMA_REGISTRY: Record<string, z.ZodType> = {
  Accordion: AccordionPropsSchema,
  // ...
  Slider: SliderPropsSchema,
  StatusBanner: StatusBannerPropsSchema,  // ← add here
  SteppedCarousel: SteppedCarouselPropsSchema,
  // ...
};
```

### How validation works

The backend validation flow:

1. LLM returns a JSON envelope with an `a2ui` array
2. Each message is parsed against `A2UIMessageSchema` (createSurface, updateComponents, updateDataModel, or deleteSurface)
3. For `updateComponents` messages, each component is validated against its entry in `COMPONENT_SCHEMA_REGISTRY`
4. Unknown component types (not in `KNOWN_COMPONENT_TYPES`) are dropped
5. Strings are truncated, nesting depth is checked, payload limits are enforced
6. Validated messages (or errors) are returned

**Payload limits** (enforced globally):

```typescript
export const PAYLOAD_LIMITS = {
  maxMessages: 50,              // A2UI messages per LLM response
  maxComponents: 200,           // Components per updateComponents
  maxPayloadBytes: 512 * 1024,  // Total JSON size (512 KB)
  maxNestingDepth: 10,          // Data model nesting
  maxStringLength: 50_000,      // Per-property value
  maxActions: 20,               // Actions array length
};
```

---

## 4. Teaching the LLM to Use Your Component

### Overview

The LLM learns about available components through the system prompt. Section 5 ("A2UI COMPONENT CATALOG") is dynamically generated from a structured catalog, not hardcoded text. Adding an entry here is what makes the LLM actually *emit* your component.

### Files to modify

| File | Action |
|---|---|
| `packages/core/src/prompts/component-catalog.ts` | **Edit** — add catalog entry |

### Step-by-step

#### Step 1: Add a `ComponentCatalogEntry`

Add your entry to the `BASE_COMPONENT_CATALOG` array. Each entry needs:

```typescript
export interface ComponentCatalogEntry {
  type: string;          // Component type name (must match schema name exactly)
  category: ComponentCategory;  // "layout" | "content" | "input" | "domain"
  example: string;       // JSON example the LLM will see (keep it concise)
  notes?: string;        // Optional notes (e.g. variant lists, usage tips)
}
```

Add your entry in the appropriate category section:

```typescript
export const BASE_COMPONENT_CATALOG: readonly ComponentCatalogEntry[] = [
  // -- Layout -------
  // ...

  // -- Content ------
  // ...

  // -- Input --------
  // ...

  // -- Domain -------
  {
    type: "CodeBlock",
    category: "domain",
    example: '{"id":"cb1","component":"CodeBlock","code":"FROM node:20-alpine\\nRUN npm ci","language":"dockerfile","filename":"Dockerfile"}',
  },
  // ... existing entries ...
  {
    type: "StatusBanner",
    category: "domain",
    example: '{"id":"sb1","component":"StatusBanner","title":"Deployment Ready","message":"All checks passed.","severity":"success","dismissible":true}',
    notes: "Severity: info, warning, error, success. Use for transient status messages.",
  },
];
```

#### Step 2: How auto-discovery works

The `generateComponentCatalogSection()` function (line ~236) assembles the catalog section:

```typescript
function generateComponentCatalogSection(
  baseCatalog: readonly ComponentCatalogEntry[] = BASE_COMPONENT_CATALOG,
  kitEntries: readonly ComponentCatalogEntry[] = [],
): string
```

1. Merges `baseCatalog` + `kitEntries` (kit entries win on conflict by type name)
2. Groups entries by category: layout → content → input → domain
3. Formats each entry as: `- TypeName: {"id":...,"component":"TypeName",...}`
4. Returns a complete markdown section ready for prompt injection

The output is injected into the system prompt via the `{{componentCatalog}}` placeholder in `packages/core/src/prompts/system-prompt.ts`.

**Example generated output:**

```markdown
## 5. A2UI COMPONENT CATALOG

You have 41 components. Use them aggressively — every turn should use 3-8 components.

### Layout Components
- Row: {"id":"r1","component":"Row","children":["a","b"],"gap":"8px",...}
- Column: {"id":"c1","component":"Column","children":["a","b"],"gap":"16px"}

### Kickstart Domain Components
- CodeBlock: {"id":"cb1","component":"CodeBlock","code":"...","language":"dockerfile"}
- StatusBanner: {"id":"sb1","component":"StatusBanner","title":"Deployment Ready",...}
  Severity: info, warning, error, success. Use for transient status messages.
```

#### Tips for good catalog entries

- **Keep examples minimal** — the LLM uses them as templates, so include only the essential props
- **Use the `notes` field** for variant lists and usage guidance
- **Match the `type` field exactly** to your `KNOWN_COMPONENT_TYPES` entry and your `ComponentApi.name`
- **Category choice matters** — the LLM uses categories to select components:
  - `layout` — containers that hold other components (Row, Column, Card)
  - `content` — display-only (Text, Markdown, Image)
  - `input` — interactive (Button, TextField, RadioGroup)
  - `domain` — Kickstart-specific (CodeBlock, ArchitectureDiagram, CostEstimate)

---

## 5. Adding a Playground Scenario

### Overview

The Playground is a component gallery that renders A2UI scenarios without an LLM. Each scenario is a function that returns `A2uiMsg[]` — the same message format the LLM produces. This lets you visually test components in isolation.

### Files to modify

| File | Action |
|---|---|
| `packages/web/src/pages/playground-scenarios.ts` | **Edit** — add scenario |

### Step-by-step

#### Step 1: Understand the scenario structure

```typescript
export interface ScenarioDef {
  id: string;           // Unique ID (kebab-case)
  label: string;        // Display name in sidebar
  description: string;  // Tooltip text
  group: string;        // Sidebar category (must be in SCENARIO_GROUPS)
  catalog?: string;     // Origin catalog ('a2ui' for basic, 'kickstart' for custom)
  keyword?: string;     // For demo-scenarios keyword matching (Kickstart Scenarios only)
  generate?: () => A2uiMsg[];  // Factory function that produces A2UI messages
}
```

#### Step 2: Write a scenario factory function

Use the helper functions defined at the top of the file:

```typescript
const CATALOG_ID = 'kickstart';
let surfaceCounter = 0;

function uid(base: string): string {
  return `${base}-${++surfaceCounter}`;
}

function surface(surfaceId: string, components: A2uiComponent[]): A2uiMsg[] {
  return [
    { version: 'v0.9', createSurface: { surfaceId, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId, components } } as A2uiMsg,
  ];
}
```

Write your scenario function:

```typescript
const customStatusBanner = (): A2uiMsg[] => {
  const sid = uid('status-demo');
  return surface(sid, [
    {
      id: 'root',
      component: 'Column',
      children: ['heading', 'banner-success', 'banner-warning', 'banner-error'],
      gap: 'medium',
    },
    { id: 'heading', component: 'Text', text: 'StatusBanner (Custom)', variant: 'h3' },
    {
      id: 'banner-success',
      component: 'StatusBanner',
      title: 'Deployment Succeeded',
      message: 'All 3 services are running in East US 2.',
      severity: 'success',
      dismissible: true,
    },
    {
      id: 'banner-warning',
      component: 'StatusBanner',
      title: 'High CPU Usage',
      message: 'Service "api-gateway" is at 85% CPU. Consider scaling up.',
      severity: 'warning',
    },
    {
      id: 'banner-error',
      component: 'StatusBanner',
      title: 'Health Check Failed',
      message: 'Endpoint /health returned 503 for "worker-service".',
      severity: 'error',
    },
  ] as A2uiComponent[]);
};
```

**A2UI message format recap:** Every scenario produces an array of A2UI messages. The `surface()` helper creates two messages:

1. `createSurface` — declares a new rendering surface with a catalog ID
2. `updateComponents` — populates that surface with a flat component array

Components reference each other by ID via `children` arrays (flat adjacency list, not nested).

#### Step 3: Register the scenario

Add your scenario to the `CONTROL_SCENARIOS` array:

```typescript
export const CONTROL_SCENARIOS: ScenarioDef[] = [
  // ... existing scenarios ...
  // Custom Controls
  { id: 'ctrl-radio',    label: 'RadioGroup',     description: 'Radio options with descriptions',  group: 'Custom Controls', catalog: 'kickstart', generate: customRadioGroup },
  { id: 'ctrl-status',   label: 'StatusBanner',   description: 'Severity-based status messages',   group: 'Custom Controls', catalog: 'kickstart', generate: customStatusBanner },
  // ...
];
```

#### Step 4: Add a scenario group (if needed)

If you need a new sidebar category, add it to `SCENARIO_GROUPS`:

```typescript
export const SCENARIO_GROUPS = [
  'Kickstart Scenarios',
  'Multi-Phase Demo',
  'File Operations',
  // ... existing groups ...
  'My New Category',  // ← add here
] as const;
```

### Existing scenario groups

| Group | Count | Purpose |
|---|---|---|
| Kickstart Scenarios | 9 | App-specific demo flows (keyword-driven) |
| Multi-Phase Demo | 5 | Full discover → deploy lifecycle |
| File Operations | 4 | FileEditor create/edit/delete |
| Cost Estimate | 1 | Azure pricing breakdown |
| Layout | 7 | Row, Column, Card, Tabs, etc. |
| Content | 6 | Text, Image, Markdown, etc. |
| Inputs | 10 | Button, TextField, CheckBox, etc. |
| Custom Controls | 8 | RadioGroup, CodeBlock, FormGroup, etc. |
| GitHub Components | 4 | LoginCard, RepoPicker, Action, Commit |
| Azure Components | 4 | LoginCard, ResourcePicker, Form, Action |
| Integration Kits | 3 | Auth providers |
| Data Binding | 4 | Data model paths, JSON pointer bindings |
| Events & Actions | 3 | Button events, form submit, function calls |
| Surface Lifecycle | 3 | Multi-surface, updates, deletion |
| Dynamic Patterns | 3 | Nested scopes, conditionals, dashboards |

---

## 6. Fluent 2 Styling Conventions

### Overview

All Kickstart components use **Fluent UI v9** with **Griffel** (`makeStyles`) for styling and **design tokens** for theming. This ensures automatic dark mode support and visual consistency.

### Mandatory rules

#### Use `makeStyles` — never inline styles

```typescript
import { makeStyles, tokens } from '@fluentui/react-components';

// ✅ Correct
const useStyles = makeStyles({
  root: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
  },
});

// ❌ Never do this
<div style={{ padding: '16px', backgroundColor: '#fff' }}>
```

#### Use longhand border properties

Griffel requires longhand CSS properties for borders — shorthand (`border: 1px solid red`) is not supported.

```typescript
// ✅ Correct — longhand
const useStyles = makeStyles({
  card: {
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

// ❌ Will break — shorthand
const useStyles = makeStyles({
  card: {
    border: `${tokens.strokeWidthThick} solid ${tokens.colorBrandStroke1}`,
  },
});
```

**Real example** — selected card border from `RadioGroup.tsx`:

```typescript
const useStyles = makeStyles({
  selectedCard: {
    marginBottom: tokens.spacingVerticalXS,
    cursor: 'pointer',
    width: '100%',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    borderLeftColor: tokens.colorBrandStroke1,
    borderTopWidth: tokens.strokeWidthThick,
    borderRightWidth: tokens.strokeWidthThick,
    borderBottomWidth: tokens.strokeWidthThick,
    borderLeftWidth: tokens.strokeWidthThick,
  },
});
```

#### Use string values for dimensions

Griffel requires string values for CSS dimensions, not numbers:

```typescript
// ✅ Correct
padding: '0',
width: '100%',
fontSize: '13px',

// ❌ May break
padding: 0,
width: 100,
```

#### Use design tokens for all colors and spacing

Never hardcode colors or spacing. Always use Fluent 2 design tokens:

```typescript
import { tokens } from '@fluentui/react-components';

// Spacing
tokens.spacingVerticalS      // 8px
tokens.spacingVerticalM      // 12px
tokens.spacingVerticalL      // 16px
tokens.spacingHorizontalM    // 12px
tokens.spacingHorizontalL    // 16px

// Colors (auto-switch in dark mode)
tokens.colorNeutralBackground1    // Page background
tokens.colorNeutralBackground3    // Elevated surface
tokens.colorBrandStroke1          // Brand-colored border
tokens.colorNeutralForeground1    // Primary text
tokens.colorNeutralForeground2    // Secondary text

// Typography
tokens.fontFamilyBase             // System font
tokens.fontSizeBase300            // 14px body
tokens.fontWeightSemibold         // 600

// Borders
tokens.strokeWidthThin            // 1px
tokens.strokeWidthThick           // 2px
tokens.borderRadiusMedium         // 4px
```

### Theme support

Kickstart uses a three-state theme system: `light | dark | system`. The `resolvedTheme` pattern determines the actual applied theme:

```typescript
// In your component, if you need theme-conditional logic:
import { useThemeContext } from '../../contexts/ThemeContext';

const { resolvedTheme } = useThemeContext();
// resolvedTheme is always 'light' or 'dark' (never 'system')
```

Most components don't need this — design tokens handle theme switching automatically. Only use `resolvedTheme` when you need to swap non-CSS assets (like image URLs or third-party library themes).

**Real example** — CodeBlock uses `resolvedTheme` for highlight.js theme selection, but this is rare. Prefer tokens.

### No `!important` overrides

Never use `!important` in element-level CSS inside A2UI surfaces. This was the root cause of a P0 bug where Playground components rendered as plain HTML (see history.md). Always use Griffel `makeStyles` or target component-specific classes.

### Accessibility requirements

All A2UI components must meet WCAG 2.1 AA:

- `aria-label` on interactive elements
- `role` attributes on custom interactive elements (e.g. `role="radiogroup"`, `role="radio"`)
- Roving `tabIndex` for keyboard navigation in groups
- `aria-live` regions for dynamic content updates

**Real example** — RadioGroup keyboard navigation from `RadioGroup.tsx`:

```typescript
<Card
  role="radio"
  aria-checked={selected === opt.id}
  aria-label={String(opt.label)}
  tabIndex={selected === opt.id || (!selected && idx === 0) ? 0 : -1}
  onKeyDown={(e) => handleKeyDown(e, idx)}
>
```

---

## 7. Checklist

Use this checklist when adding a new A2UI component:

- [ ] **Component file** created at `packages/web/src/catalog/components/YourComponent.tsx`
  - [ ] Zod schema with `DynamicStringSchema` and `.strict()`
  - [ ] `createReactComponent()` factory with `makeStyles` + `tokens`
  - [ ] Action dispatch with `resolveAction()` + `sanitizeActionContext()`
  - [ ] Accessibility: `aria-label`, `role`, keyboard support
- [ ] **Catalog registration** in `packages/web/src/catalog/kickstart-catalog.ts`
  - [ ] Import added
  - [ ] Component added to `kickstartComponents` array
- [ ] **Backend schema** in `packages/core/src/services/a2ui-schema.ts`
  - [ ] Type added to `KNOWN_COMPONENT_TYPES` (alphabetical)
  - [ ] `YourComponentPropsSchema` defined with `.strip()`
  - [ ] Schema added to `COMPONENT_SCHEMA_REGISTRY` (alphabetical)
- [ ] **LLM catalog entry** in `packages/core/src/prompts/component-catalog.ts`
  - [ ] `ComponentCatalogEntry` added to `BASE_COMPONENT_CATALOG`
  - [ ] JSON example is concise and shows key props
- [ ] **Playground scenario** in `packages/web/src/pages/playground-scenarios.ts`
  - [ ] Factory function using `uid()` + `surface()` helpers
  - [ ] `ScenarioDef` added to `CONTROL_SCENARIOS`
  - [ ] Scenario group exists in `SCENARIO_GROUPS`
- [ ] **Fluent 2 styling** verified
  - [ ] No inline styles or hardcoded colors
  - [ ] Longhand border properties only
  - [ ] Design tokens for all spacing and colors
  - [ ] Dark mode works (test in Playground with theme toggle)
