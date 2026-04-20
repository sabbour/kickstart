# Create A2UI Component

**Confidence:** high  
**Last updated:** 2026-04-20  
**Use when:** Adding a new A2UI component to the design system

## The 4-Layer Stack

Every A2UI component requires changes in four layers. Miss any one and the component silently fails.

```
Layer 1: LLM System Prompt  (packages/core/src/prompts/component-catalog.ts)
  ↓ Teaches LLM that component exists + usage example
Layer 2: Backend Validator  (packages/core/src/services/a2ui-schema.ts)
  ↓ Zod schema validates LLM output; drops unknown components
Layer 3: Frontend Catalog   (packages/web/src/catalog/kickstart-catalog.ts)
  ↓ Registers React component so A2UI renderer finds it
Layer 4: React Component    (packages/web/src/catalog/components/YourComponent.tsx)
  ↓ The actual implementation (Zod schema + React + Fluent UI)
```

| Layer | Missing = | Symptom |
|-------|-----------|---------|
| 1 (LLM Prompt) | LLM never emits the component |
| 2 (Validator) | Backend strips the component silently |
| 3 (Frontend Catalog) | Renderer ignores it (blank space) |
| 4 (React Component) | Import fails, catalog breaks |

## Pattern

A2UI components follow a **Zod-schema-first** pattern: define the shape that the LLM can emit, then implement the React component that renders it.

## Steps

### Step 1: Create the React Component

Create file: `packages/web/src/catalog/components/{ComponentName}.tsx`

```tsx
import { z } from 'zod';
import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { Card, makeStyles, tokens } from '@fluentui/react-components';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';

// 1. Define Zod schema (what the LLM can emit)
const {ComponentName}Api = {
  name: '{ComponentName}',
  schema: z.object({
    // Use DynamicStringSchema for strings (supports both literals and data bindings)
    title: DynamicStringSchema,
    message: DynamicStringSchema,
    // Optional boolean for state
    expanded: z.boolean().optional(),
    // ActionSchema for clickable actions
    action: ActionSchema.optional(),
  }).strict(), // .strict() rejects unknown props — catches LLM hallucinations
};

// 2. Define styles
const useStyles = makeStyles({
  root: {
    padding: tokens.spacingVerticalM,
  },
});

// 3. Implement component
export const {ComponentName} = createReactComponent(
  {ComponentName}Api,
  ({ props, context }) => {
    const classes = useStyles();
    
    const handleAction = () => {
      if (!props.action) return;
      const resolved = context.dataContext.resolveAction(props.action);
      context.dispatchAction({ event: resolved.event });
    };
    
    return (
      <Card className={classes.root}>
        <h3>{String(props.title)}</h3>
        <p>{String(props.message)}</p>
        {props.action && (
          <button onClick={handleAction}>Action</button>
        )}
      </Card>
    );
  }
);

// Export schema for Layer 2 validation
export const {ComponentName}Schema = {ComponentName}Api.schema;
```

### Step 2: Register in Frontend Catalog

Edit: `packages/web/src/catalog/kickstart-catalog.ts`

Add your component import:

```tsx
import { {ComponentName} } from './components/{ComponentName}';
```

Add to the catalog array:

```tsx
const catalog: ComponentEntry[] = [
  // ... existing components
  {
    component: {ComponentName},
    schema: {ComponentName}Api.schema,
    description: 'Brief description for LLM',
    example: {
      title: 'Example title',
      message: 'Example message',
    },
  },
];
```

### Step 3: Add Backend Validator Schema

Edit: `packages/core/src/services/a2ui-schema.ts`

Import your schema:

```ts
import { {ComponentName}Schema } from '@kickstart/web/catalog/components/{ComponentName}';
```

Add to the component union:

```ts
const componentSchemas = z.discriminatedUnion('name', [
  // ... existing schemas
  z.object({ name: z.literal('{ComponentName}'), ...{ComponentName}Schema.shape }),
]);
```

### Step 4: Teach the LLM

Edit: `packages/core/src/prompts/component-catalog.ts`

Add an entry to the catalog array:

```ts
{
  name: '{ComponentName}',
  description: 'What this component does',
  usage: 'When to use it',
  example: {
    name: '{ComponentName}',
    title: 'Example title',
    message: 'Example message',
    action: { event: 'user-clicked' },
  },
}
```

## Validation

### Before you commit:

1. **Syntax check:** `npm run build -w @kickstart/web @kickstart/core`
2. **Test the component:** Add a storybook entry or playground scenario
3. **Verify all 4 layers:**
   - [ ] React component file created and exports the component
   - [ ] Frontend catalog imports and registers it
   - [ ] Backend validator schema updated
   - [ ] System prompt catalog updated
4. **Run tests:** `CI=1 npm test -- --reporter=dot`

## Common Patterns

### Handling Data Bindings

The LLM can emit `{ "$ref": "/data/propertyName" }` for any `DynamicStringSchema` prop. Resolve it:

```tsx
const title = context.dataContext.resolve(props.title);
```

### Dispatching Actions

When user interacts, send context back to the LLM:

```tsx
const handleClick = () => {
  context.dispatchAction({
    event: {
      name: 'component-action',
      context: { componentId: 'your-id', action: 'clicked' },
    },
  });
};
```

### Styling with Fluent UI Tokens

Always use Fluent tokens for theming compliance:

```tsx
const useStyles = makeStyles({
  root: {
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
  },
});
```

## Files Modified

- `packages/web/src/catalog/components/{ComponentName}.tsx` (new)
- `packages/web/src/catalog/kickstart-catalog.ts` (edit)
- `packages/core/src/services/a2ui-schema.ts` (edit)
- `packages/core/src/prompts/component-catalog.ts` (edit)
