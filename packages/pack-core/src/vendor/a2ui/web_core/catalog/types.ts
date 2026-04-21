import { z } from 'zod';
import type { Action, ChildList, DataBinding, FunctionCall } from '../../schema/common-types';

export interface ComponentApi<Schema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  readonly schema: Schema;
}

export type InferredComponentApiSchemaType<T extends ComponentApi> = z.infer<T['schema']>;

type DynamicTypes = DataBinding | FunctionCall;
type IsDynamic<T> = DataBinding extends NonNullable<T> ? true : false;

/**
 * Maps a raw Zod-inferred prop type to its resolved runtime equivalent.
 *
 * The generic binder in `@aks-kickstart/web` resolves dynamic values (paths,
 * function calls) before handing props to React components, so at runtime:
 *   - `Action` objects become callable `() => void` functions
 *   - `ChildList` becomes the rendered subtree (typed as `any` here)
 *   - `DynamicString`/`DynamicNumber`/... collapse to their primitive
 *
 * Ported from packages/web/src/vendor/a2ui/web_core/rendering/generic-binder.ts
 * so pack-core components can consume the same post-binder shape.
 */
export type ResolveA2uiProp<T> = [NonNullable<T>] extends [Action]
  ? (() => void) | Extract<T, undefined>
  : [NonNullable<T>] extends [ChildList]
    ? any | Extract<T, undefined>
    : Exclude<T, DynamicTypes> extends never
      ? any
      : Exclude<T, DynamicTypes>;

/**
 * For every dynamic prop `K`, injects a `setK(value)` setter on the resolved
 * props object (e.g. `value: DynamicString` → `setValue(val: string)`).
 */
export type GenerateSetters<T> = {
  [K in keyof T as IsDynamic<T[K]> extends true
    ? `set${Capitalize<string & K>}`
    : never]-?: (value: Exclude<NonNullable<T[K]>, DynamicTypes>) => void;
};

/**
 * Fully-resolved runtime prop shape passed to the view layer. Adds the
 * binder-injected `isValid` / `validationErrors` fields that checkable
 * components surface.
 */
export type ResolveA2uiProps<T> = (T extends object
  ? { [K in keyof T]: ResolveA2uiProp<T[K]> }
  : T) &
  GenerateSetters<T> & {
    isValid?: boolean;
    validationErrors?: string[];
  };
