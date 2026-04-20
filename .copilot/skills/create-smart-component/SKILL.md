# Create Smart Component

**Confidence:** high  
**Last updated:** 2026-04-20  
**Use when:** Creating a stateful A2UI component with built-in authentication, validation, state management, or side effects

## What is a Smart Component?

A **Smart Component** is a specialized A2UI component that wraps business logic — validation, API calls, authentication, side effects, state coordination — inside a single reusable UI block. Smart components are more complex than plain A2UI components because they handle:

- **Local state** (form data, UI state, error messages)
- **Validation** (client-side schema validation before submission)
- **API calls** (fetching data, submitting forms)
- **Authentication** (checking permissions, enforcing access control)
- **Side effects** (analytics tracking, cache invalidation)

## Pattern: Smart Component + Plain A2UI Wrapper

Smart components use a **dual-layer approach:**

```
┌─────────────────────────────────────────┐
│  Smart Component (Business Logic)       │
│  packages/web/src/components/Smart*.tsx │
│  - useState, useEffect, API calls       │
│  - Validation, auth checks              │
│  - Event handlers                       │
├─────────────────────────────────────────┤
│  A2UI Wrapper (4-Layer Registration)    │
│  packages/web/src/catalog/components/*  │
│  - Zod schema for LLM                   │
│  - Fluent UI styling                    │
│  - React wrapper                        │
└─────────────────────────────────────────┘
```

The Smart Component does the work. The A2UI Wrapper makes it visible to the LLM and renderer.

## Steps

### Step 1: Create the Smart Component

File: `packages/web/src/components/Smart{Name}.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { Text, Button, makeStyles, tokens } from '@fluentui/react-components';
import { useAuth } from '../contexts/AuthContext'; // or your auth hook
import { useApi } from '../services/api'; // or your API hook

const useStyles = makeStyles({
  root: {
    padding: tokens.spacingVerticalM,
  },
  input: {
    width: '100%',
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
});

// 1. Define validation schema
export const Smart{Name}Schema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  email: z.string().email('Invalid email'),
  name: z.string().min(1, 'Name is required'),
});

export type Smart{Name}Props = z.infer<typeof Smart{Name}Schema>;

// 2. Implement smart component
export const Smart{Name}: React.FC<Smart{Name}Props> = ({ userId, email, name }) => {
  const classes = useStyles();
  const { user } = useAuth();
  const { mutate: updateUser, loading, error } = useApi();
  
  const [formData, setFormData] = useState({ email, name });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Check auth
  useEffect(() => {
    if (!user) {
      setValidationErrors({ auth: 'You must be logged in' });
    }
  }, [user]);

  const handleSubmit = async () => {
    // Validate before submit
    try {
      const validated = Smart{Name}Schema.parse({ userId, ...formData });
      // Call API
      await updateUser({ id: userId, ...validated });
      // Handle success...
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach(e => {
          errors[e.path.join('.')] = e.message;
        });
        setValidationErrors(errors);
      }
    }
  };

  if (!user) {
    return <Text className={classes.error}>Authentication required</Text>;
  }

  return (
    <div className={classes.root}>
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        className={classes.input}
        placeholder="Email"
      />
      {validationErrors.email && (
        <Text className={classes.error}>{validationErrors.email}</Text>
      )}
      
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className={classes.input}
        placeholder="Name"
      />
      {validationErrors.name && (
        <Text className={classes.error}>{validationErrors.name}</Text>
      )}
      
      <Button
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'Saving...' : 'Save'}
      </Button>
      
      {error && <Text className={classes.error}>{error}</Text>}
    </div>
  );
};
```

### Step 2: Create the A2UI Wrapper

File: `packages/web/src/catalog/components/{Name}Catalog.tsx`

This is where you register the smart component into the 4-layer stack (same as regular A2UI components).

```tsx
import { z } from 'zod';
import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import { Smart{Name}, Smart{Name}Schema } from '../../components/Smart{Name}';

// 1. Define catalog schema (what the LLM can emit)
const {Name}CatalogApi = {
  name: '{Name}',
  schema: Smart{Name}Schema, // Reuse smart component schema
};

// 2. Create A2UI wrapper
export const {Name}Catalog = createReactComponent(
  {Name}CatalogApi,
  ({ props, context }) => (
    <Smart{Name}
      userId={String(props.userId)}
      email={String(props.email)}
      name={String(props.name)}
    />
  )
);

export const {Name}CatalogSchema = Smart{Name}Schema;
```

### Step 3: Register in Frontend Catalog

Edit: `packages/web/src/catalog/kickstart-catalog.ts`

```tsx
import { {Name}Catalog } from './components/{Name}Catalog';

const catalog: ComponentEntry[] = [
  // ... existing components
  {
    component: {Name}Catalog,
    schema: {Name}CatalogSchema,
    description: 'User profile form with validation and auth',
    example: {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      name: 'John Doe',
    },
  },
];
```

### Step 4: Add Backend Validator Schema

Edit: `packages/core/src/services/a2ui-schema.ts`

```ts
import { {Name}CatalogSchema } from '@kickstart/web/catalog/components/{Name}Catalog';

const componentSchemas = z.discriminatedUnion('name', [
  // ... existing schemas
  z.object({ name: z.literal('{Name}'), ...{Name}CatalogSchema.shape }),
]);
```

### Step 5: Teach the LLM

Edit: `packages/core/src/prompts/component-catalog.ts`

```ts
{
  name: '{Name}',
  description: 'User profile form with built-in validation and authentication',
  usage: 'When you need to capture user updates with validation',
  example: {
    name: '{Name}',
    userId: 'user-uuid',
    email: 'user@example.com',
    name: 'User Full Name',
  },
}
```

## Validation

### Before you commit:

1. **Test the smart component in isolation:** `npm run dev` and manually test the form
2. **Verify validation:** Try invalid inputs and confirm error messages appear
3. **Verify auth gate:** Test unauthenticated access (should show auth error)
4. **API integration:** Confirm network calls work
5. **Build:** `npm run build -w @kickstart/web @kickstart/core`
6. **Tests:** `CI=1 npm test -- --reporter=dot`

## Common Patterns

### Auth Gate

```tsx
const { user } = useAuth();
if (!user) {
  return <Text>Please log in</Text>;
}
```

### API Mutation Hook

```tsx
const { mutate, loading, error } = useApi();

const handleSubmit = async (data) => {
  try {
    await mutate(endpoint, data);
  } catch (err) {
    // Handle error
  }
};
```

### Validation with Zod

```tsx
const validationSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

// Parse and catch errors
try {
  const valid = validationSchema.parse(formData);
} catch (err) {
  if (err instanceof z.ZodError) {
    // Build error map...
  }
}
```

### Side Effects (Analytics)

```tsx
useEffect(() => {
  analytics.track('Smart{Name} rendered', { userId });
}, [userId]);
```

## Files Modified

- `packages/web/src/components/Smart{Name}.tsx` (new)
- `packages/web/src/catalog/components/{Name}Catalog.tsx` (new)
- `packages/web/src/catalog/kickstart-catalog.ts` (edit)
- `packages/core/src/services/a2ui-schema.ts` (edit)
- `packages/core/src/prompts/component-catalog.ts` (edit)
