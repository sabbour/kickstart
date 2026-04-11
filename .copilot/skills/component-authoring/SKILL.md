---
name: "component-authoring"
description: "How to author, register, and use A2UI v0.9 components in Kickstart"
domain: "a2ui"
confidence: "high"
source: "codebase"
---

## Context

Kickstart renders AI-driven UI using **A2UI v0.9** — a flat-JSON component protocol.
The LLM (or a tool handler) returns an A2UI document; the web surface resolves every
component `type` string against the **Kickstart catalog** and renders it as a React 19 +
Fluent UI v9 component.

Key design constraints that differ from generic A2UI docs:

| Concern | A2UI generic | Kickstart v0.9 |
|---------|-------------|----------------|
| Data flow | State binding via `{ path: "..." }` | **Events** — actions fire `{ event: { name: ... } }` |
| Document shape | Nested object tree | **Flat JSON** — every component is a sibling in one top-level map, linked by `id` refs |
| Styling | Any | **Fluent UI v9** (`@fluentui/react-components` + `makeStyles`) |
| Auth tokens | Connector accessor | **React state only** — never `localStorage`, never direct token retrieval via connector |

---

## Patterns

### 1 — Flat JSON document shape

Every A2UI message sent to the surface uses a flat `components` map:

```json
{
  "surface": "my-surface",
  "components": {
    "root": { "type": "Column", "id": "root", "children": ["title", "cta"] },
    "title": { "type": "Text", "id": "title", "text": "Hello!", "variant": "h2" },
    "cta": {
      "type": "Button",
      "id": "cta",
      "label": "Continue",
      "action": { "event": { "name": "navigate:design" } }
    }
  }
}
```

Rules:
- `id` is the map key; it **must** match the `id` field inside the object.
- Children are referenced by `id` string, not nested objects.
- Prefer `Column` / `Row` as layout containers; avoid deeply nesting layout.

---

### 2 — Schema definition

All props are described with a **Zod schema**. Import primitives from the vendor
`common-types` module:

```typescript
import { z } from 'zod';
import {
  DynamicStringSchema,   // string | { path } | { call, args }
  DynamicBooleanSchema,  // boolean | { path } | { call, args }
  DynamicNumberSchema,   // number  | { path } | { call, args }
  ActionSchema,          // { event: { name, context? } } | { functionCall: ... }
  ComponentIdSchema,     // string (child component ID)
} from '../../vendor/a2ui/web_core/schema/common-types';

const MyComponentApi = {
  name: 'MyComponent',
  schema: z.object({
    title:        DynamicStringSchema,
    subtitle:     DynamicStringSchema.optional(),
    disabled:     DynamicBooleanSchema.optional(),
    onSelect:     ActionSchema.optional(),
    contentChild: ComponentIdSchema.optional(),
  }).strict(),             // .strict() prevents unknown props silently passing through
};
```

**When to use `DynamicStringSchema` vs `z.string()`**

Use `DynamicStringSchema` for any text that could eventually come from a data binding.
Use `z.string()` only for enum-like literals the renderer always controls (e.g. `z.enum(['POST','DELETE'])`).

---

### 3 — Implementation with `createReactComponent`

```typescript
// packages/web/src/catalog/components/MyComponent.tsx
import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import { Card, Body1, makeStyles, tokens } from '@fluentui/react-components';

const MyComponentApi = {
  name: 'MyComponent',
  schema: z.object({
    message: DynamicStringSchema,
    onDone:  ActionSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop:    tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width:        '100%',
  },
});

export const MyComponent = createReactComponent(MyComponentApi, ({ props, buildChild }) => {
  const classes = useStyles();

  const handleDone = () => {
    if (props.onDone) (props.onDone as () => void)();
  };

  return (
    <Card className={classes.root}>
      <Body1>{String(props.message)}</Body1>
      <button onClick={handleDone}>Done</button>
    </Card>
  );
});
```

**`buildChild(id)`** — renders a child component by its surface ID. Use when the
schema has a `ComponentIdSchema` prop:

```typescript
// schema: { contentChild: ComponentIdSchema.optional() }
{props.contentChild && buildChild(props.contentChild)}
```

**Firing actions** — cast to `() => void` and call:

```typescript
if (props.onDone) (props.onDone as () => void)();
```

Never inspect the action object shape at runtime; the runtime resolves it.

---

### 4 — Action / event naming

Event names drive routing in `useActionDispatch`. Choose the right prefix:

| Prefix | Effect | Example |
|--------|--------|---------|
| *(none)* | Re-prompts LLM with `[Action: {name}] key: val` | `"user-selected-option"` |
| `navigate:` | Phase transition — synthesises a transition prompt | `"navigate:design"` |
| `api:` | Direct connector call — `api:{connector}.{operation}` | `"api:azure-arm.listResources"` |
| `complete:` | Auto-continues conversation | `"complete:onboarding"` |
| `continue:` | Auto-continues conversation | `"continue:deploy"` |

Pass context values through `event.context`:

```json
{
  "action": {
    "event": {
      "name": "navigate:deploy",
      "context": { "selectedRepo": "owner/my-app", "cluster": "aks-dev" }
    }
  }
}
```

The `context` map is serialised into the re-prompt message as `key: value` pairs.

---

### 5 — Catalog registration

Every component must be registered in **one place**:

```typescript
// packages/web/src/catalog/kickstart-catalog.ts
import { MyComponent } from './components/MyComponent';

const kickstartComponents: ReactComponentImplementation[] = [
  ...Array.from(basicCatalog.components.values()),
  ...fluentOverrides,
  // ... existing components ...
  MyComponent,            // ← add here
];
```

There is no separate index file for custom components — the import and array entry
in `kickstart-catalog.ts` is the single registration point.

---

### 6 — Fluent override authoring (basic catalog components)

The vendor A2UI basic catalog ships 21 primitive components
(`Text`, `Button`, `TextField`, `Row`, `Column`, `Card`, `Tabs`, `Modal`, etc.).
Kickstart replaces every one with a Fluent UI v9 implementation.

To **override an existing basic catalog component**, first locate its API object in
`packages/web/src/vendor/a2ui/web_core/basic_catalog/index.ts` — names follow the
pattern `{ComponentName}Api` (e.g. `TextApi`, `ButtonApi`, `CardApi`):

```typescript
// packages/web/src/catalog/fluent-components/MyOverride.tsx
import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { TextApi } from '../../vendor/a2ui/web_core/basic_catalog/index'; // example: Text
import { SomeFluentComponent } from '@fluentui/react-components';

export const MyOverride = createReactComponent(TextApi, ({ props }) => {
  return <SomeFluentComponent>{String(props.text)}</SomeFluentComponent>;
});
```

Then export from the barrel and add to `fluentOverrides`:

```typescript
// packages/web/src/catalog/fluent-components/index.ts
export { MyOverride } from './MyOverride';

export const fluentOverrides: ReactComponentImplementation[] = [
  // ... existing overrides ...
  MyOverride,
];
```

The `fluentOverrides` array is spread first in `kickstart-catalog.ts`, so it
wins over the basic catalog at lookup time.

---

### 7 — Fat component pattern

**Fat components** bundle auth, API calls, validation, and security into a single
self-managing unit. Use this pattern whenever a component must:

- Authenticate a user (Azure MSAL, GitHub OAuth)
- Call a live API connector
- Execute a write operation with confirmation

#### 7a — Connector access

```typescript
import { useAPIConnector } from '../../contexts/APIConnectorContext';
import type { AzureARMConnector } from '@kickstart/core';

export const MyFatComponent = createReactComponent(MyApi, ({ props }) => {
  // useAPIConnector returns the connector instance or undefined (offline/stub mode).
  // Always cast to the specific connector type + undefined — the hook's generic
  // return is BaseConnector | undefined.
  const connector = useAPIConnector('azure-arm') as AzureARMConnector | undefined;

  const doFetch = async () => {
    if (!connector) {
      // stub mode — return mock data instead of throwing
      return STUB_DATA;
    }
    const res = await connector.request('GET', '/subscriptions', undefined);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  // ...
});
```

Available connector names: `'azure-arm'`, `'github'`, `'pricing'`.

#### 7b — Token tracking

Auth tokens **must** live in React state, never in `localStorage`.
Calling connector methods for authentication status (`isAuthenticated()`,
`authenticate()`) is fine — what is forbidden is storing or reading the raw
token value via any connector accessor:

```typescript
const [authenticated, setAuthenticated] = useState(
  () => connector?.isAuthenticated() ?? false,
);
const [authTime, setAuthTime] = useState<Date | null>(null);

const handleSignIn = async () => {
  await connector?.authenticate();
  setAuthenticated(connector?.isAuthenticated() ?? false);
  setAuthTime(new Date());   // track in state, not connector
};

const handleSignOut = () => {
  setAuthenticated(false);
  setAuthTime(null);
  // connector state is cleared by the connector itself
};
```

#### 7c — Security controls (write operations)

All write-capable components must implement:

1. **Operation allowlist** — an explicit `Set<string>` of permitted operations:

```typescript
const ALLOWED_OPERATIONS = new Set([
  'repos/pulls/create',
  'repos/contents/update',
  // add only what is needed
]);

if (!ALLOWED_OPERATIONS.has(operationType)) {
  return <ErrorState message={`Operation "${operationType}" is not allowed`} />;
}
```

2. **Protected-branch blocking** — never allow writes to `main`, `master`, `production`:

```typescript
const PROTECTED_BRANCHES = new Set(['main', 'master', 'production']);

if (PROTECTED_BRANCHES.has(targetBranch)) {
  return <ErrorState message="Direct writes to protected branches are blocked" />;
}
```

3. **Typed confirmation for destructive operations** — require the user to type the
resource name before a DELETE:

```typescript
{isDestructive && state === 'confirming' && (
  <Field>
    <Input
      placeholder={`Type "${resourceName}" to confirm`}
      value={confirmInput}
      onChange={(_, d) => setConfirmInput(d.value)}
    />
    <Button
      appearance="primary"
      disabled={confirmInput !== resourceName}
      onClick={executeDelete}
    >
      Delete permanently
    </Button>
  </Field>
)}
```

See `GitHubAction.tsx` for the reference implementation.

---

### 8 — Stub / offline mode

Components should degrade gracefully when the connector is absent (offline demo,
unit tests, Storybook). Pattern:

```typescript
const doAction = async () => {
  if (!connector) {
    // Simulate success after a short delay
    await new Promise(r => setTimeout(r, 800));
    setState('success');
    setMessage('Completed (offline mode)');
    return;
  }
  // ... real connector call ...
};

{!connector && (
  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
    Running in offline mode
  </Caption1>
)}
```

---

### 9 — Complete example: simple interactive component

```typescript
// packages/web/src/catalog/components/StatusBadge.tsx
import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import { Badge, Button, Card, makeStyles, tokens } from '@fluentui/react-components';

const StatusBadgeApi = {
  name: 'StatusBadge',
  schema: z.object({
    label:    DynamicStringSchema,
    status:   z.enum(['pending', 'running', 'success', 'error']),
    onRetry:  ActionSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingHorizontalM,
  },
});

const COLOR_MAP = {
  pending: 'informative',
  running: 'important',
  success: 'success',
  error:   'danger',
} as const;

export const StatusBadge = createReactComponent(StatusBadgeApi, ({ props }) => {
  const classes = useStyles();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    if (props.onRetry) (props.onRetry as () => void)();
  };

  return (
    <Card>
      <div className={classes.root}>
        <Badge color={COLOR_MAP[props.status]}>{String(props.label)}</Badge>
        {props.status === 'error' && props.onRetry && (
          <Button size="small" onClick={handleRetry} disabled={retrying}>
            Retry
          </Button>
        )}
      </div>
    </Card>
  );
});
```

Corresponding A2UI JSON:

```json
{
  "surface": "deploy-surface",
  "components": {
    "root": { "type": "Column", "id": "root", "children": ["status"] },
    "status": {
      "type": "StatusBadge",
      "id": "status",
      "label": "AKS deployment",
      "status": "error",
      "onRetry": { "event": { "name": "navigate:deploy", "context": { "retry": "true" } } }
    }
  }
}
```

Registration addition in `kickstart-catalog.ts`:

```typescript
import { StatusBadge } from './components/StatusBadge';

const kickstartComponents: ReactComponentImplementation[] = [
  // ...existing entries...
  StatusBadge,
];
```

---

## Anti-Patterns

- ❌ **Nested component objects in JSON** — all components must be siblings in the flat `components` map.
- ❌ **State binding `{ path: "..." }` for data flow** — use events (`ActionSchema`) instead.
- ❌ **`localStorage` for tokens** — auth state lives in React `useState` only.
- ❌ **Calling connector.getToken()** — track auth time and state via React state; never read the raw token value from a connector accessor.
- ❌ **Unguarded write operations** — always check against an allowlist and block protected branches.
- ❌ **Silent DELETE without typed confirmation** — destructive operations need `confirmInput === resourceName`.
- ❌ **Throwing inside a component when the connector is absent** — return stub data or show an offline message.
- ❌ **Schema without `.strict()`** — unknown props will silently pass through and may cause runtime surprises.
- ❌ **Skipping `buildChild` for child references** — always use `buildChild(props.contentChild)` when the schema declares a `ComponentIdSchema` prop; never try to render the raw string.
- ❌ **Registering a component twice** — fluent overrides go only in `fluentOverrides`; custom components go only in `kickstartComponents`. Adding the same component to both means it appears twice in the final `kickstartComponents` array (since `fluentOverrides` is spread into it), causing a duplicate-type collision at runtime.
