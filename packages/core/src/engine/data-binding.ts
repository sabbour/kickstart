/**
 * @module @kickstart/core/engine/data-binding
 *
 * State binding and data interpolation utilities.
 * Used by A2UI v0.9 to resolve JSON Pointer references in component props.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Describes a single named data binding with an optional default value.
 */
export interface BindingDescriptor {
  /** JSON Pointer path into the data model. */
  path: string;
  /** Fallback value returned when the pointer resolves to `undefined`. */
  defaultValue?: unknown;
}

/**
 * Describes which data-model paths a component reads from and writes to.
 */
export interface ComponentBindingMap {
  /** JSON Pointer paths this component reads. */
  reads: string[];
  /** JSON Pointer paths this component writes. */
  writes: string[];
}

/**
 * Result of {@link analyzeSharedBindings}: which paths are shared and
 * which components produce/consume them.
 */
export interface SharedBindingAnalysis {
  /** Paths that are written by at least one component and read by another. */
  sharedPaths: string[];
  /** Map of shared path → component IDs that write to it. */
  producers: Record<string, string[]>;
  /** Map of shared path → component IDs that read from it. */
  consumers: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// resolveDataPath — JSON Pointer (RFC 6901) resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a JSON Pointer path against a data model.
 * Returns `defaultValue` (or `undefined`) when the path cannot be resolved.
 *
 * Examples:
 *   resolveDataPath('/user/name', { user: { name: 'Alice' } }) → 'Alice'
 *   resolveDataPath('/items/0', { items: ['a', 'b'] })         → 'a'
 *   resolveDataPath('/', { key: 'val' })                       → { key: 'val' }
 *   resolveDataPath('/missing', {}, 'fallback')                → 'fallback'
 */
export function resolveDataPath(
  path: string,
  dataModel: Record<string, unknown>,
  defaultValue?: unknown,
): unknown {
  if (!path || path === '/') return dataModel;

  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const segments = normalized.split('/');

  let current: unknown = dataModel;
  for (const rawSegment of segments) {
    if (current === null || current === undefined) return defaultValue;
    // RFC 6901: ~1 → '/', ~0 → '~'
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(current)) {
      const idx = Number(segment);
      current = Number.isInteger(idx) ? current[idx] : undefined;
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return defaultValue;
    }
  }

  return current === undefined ? defaultValue : current;
}

// ---------------------------------------------------------------------------
// resolveChainedPointer — follow pointer-to-pointer references
// ---------------------------------------------------------------------------

const DEFAULT_MAX_CHAIN_DEPTH = 5;

/**
 * Resolves a JSON Pointer path that may point to another pointer string.
 * Follows the chain until a non-pointer value is reached or `maxDepth` is hit.
 *
 * Example:
 *   const model = {
 *     config: { activeProfile: '/profiles/prod' },
 *     profiles: { prod: { replicas: 3 } },
 *   };
 *   resolveChainedPointer('/config/activeProfile', model) → { replicas: 3 }
 */
export function resolveChainedPointer(
  path: string,
  dataModel: Record<string, unknown>,
  options?: { maxDepth?: number; defaultValue?: unknown },
): unknown {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_CHAIN_DEPTH;
  const visited = new Set<string>();
  let currentPath = path;

  for (let depth = 0; depth <= maxDepth; depth++) {
    if (visited.has(currentPath)) {
      // Circular reference — stop and return default
      return options?.defaultValue;
    }
    visited.add(currentPath);

    const value = resolveDataPath(currentPath, dataModel);
    if (value === undefined) return options?.defaultValue;

    // If the resolved value is itself a JSON Pointer string, follow it
    if (typeof value === 'string' && value.startsWith('/')) {
      currentPath = value;
      continue;
    }

    return value;
  }

  // Max depth exceeded
  return options?.defaultValue;
}

// ---------------------------------------------------------------------------
// interpolateTemplate — {{/json/pointer}} placeholder substitution
// ---------------------------------------------------------------------------

/**
 * Replaces `{{/json/pointer}}` placeholders in a string with resolved values
 * from the data model. Supports `{{/path|default}}` syntax — the first `|`
 * separates the pointer from the fallback text. Unresolved paths without a
 * default are left as-is.
 *
 * Examples:
 *   interpolateTemplate('Hello {{/user/name}}!', { user: { name: 'Alice' } })
 *   → 'Hello Alice!'
 *
 *   interpolateTemplate('Hi {{/user/name|stranger}}!', {})
 *   → 'Hi stranger!'
 */
export function interpolateTemplate(template: string, dataModel: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawExpr: string) => {
    const expr = rawExpr.trim();

    // Split on first '|' for default value syntax
    const pipeIdx = expr.indexOf('|');
    const path = pipeIdx >= 0 ? expr.slice(0, pipeIdx).trim() : expr;
    const fallback = pipeIdx >= 0 ? expr.slice(pipeIdx + 1).trim() : undefined;

    const value = resolveDataPath(path, dataModel);
    if (value === undefined || value === null) {
      return fallback !== undefined ? fallback : _match;
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

// ---------------------------------------------------------------------------
// resolveBindings — batch-resolve named bindings with defaults
// ---------------------------------------------------------------------------

/**
 * Resolves multiple named data bindings in one call.
 * Each binding specifies a JSON Pointer path and an optional default value.
 *
 * Example:
 *   resolveBindings(
 *     { name: { path: '/user/name', defaultValue: 'Anonymous' },
 *       region: { path: '/config/region' } },
 *     { user: { name: 'Alice' } }
 *   ) → { name: 'Alice', region: undefined }
 */
export function resolveBindings(
  bindings: Record<string, BindingDescriptor>,
  dataModel: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(bindings)) {
    result[key] = resolveDataPath(descriptor.path, dataModel, descriptor.defaultValue);
  }
  return result;
}

// ---------------------------------------------------------------------------
// analyzeSharedBindings — cross-component binding analysis
// ---------------------------------------------------------------------------

/**
 * Analyzes a set of component binding maps to find shared data paths.
 * A path is "shared" when at least one component writes to it and at least
 * one *different* component reads from it.
 *
 * Useful for debugging data flow, building dependency graphs, and
 * visualizing cross-component relationships in the playground.
 */
export function analyzeSharedBindings(
  components: Record<string, ComponentBindingMap>,
): SharedBindingAnalysis {
  const allWriters = new Map<string, Set<string>>();
  const allReaders = new Map<string, Set<string>>();

  for (const [componentId, map] of Object.entries(components)) {
    for (const path of map.writes) {
      const set = allWriters.get(path) ?? new Set<string>();
      set.add(componentId);
      allWriters.set(path, set);
    }
    for (const path of map.reads) {
      const set = allReaders.get(path) ?? new Set<string>();
      set.add(componentId);
      allReaders.set(path, set);
    }
  }

  const sharedPaths: string[] = [];
  const producers: Record<string, string[]> = {};
  const consumers: Record<string, string[]> = {};

  for (const [path, writers] of allWriters) {
    const readers = allReaders.get(path) ?? new Set<string>();
    // Shared = written by someone AND read by a *different* component
    const crossReaders = Array.from(readers).filter(r => !writers.has(r));
    if (crossReaders.length > 0) {
      sharedPaths.push(path);
      producers[path] = Array.from(writers);
      consumers[path] = crossReaders;
    }
  }

  sharedPaths.sort();
  return { sharedPaths, producers, consumers };
}

// ---------------------------------------------------------------------------
// createDefaultValues — generate data model from JSON Schema
// ---------------------------------------------------------------------------

/**
 * Generates a default data model from a JSON Schema.
 * Recursively builds typed defaults: objects, arrays, strings, numbers, booleans.
 *
 * Example:
 *   createDefaultValues({ type: 'object', properties: { name: { type: 'string' } } })
 *   → { name: '' }
 */
export function createDefaultValues(schema: Record<string, unknown>): Record<string, unknown> {
  const result = buildDefaults(schema);
  return (typeof result === 'object' && result !== null && !Array.isArray(result))
    ? result as Record<string, unknown>
    : {};
}

function buildDefaults(schema: Record<string, unknown>): unknown {
  // Explicit default wins always
  if ('default' in schema && schema.default !== undefined) {
    return schema.default;
  }

  const rawType = schema.type;
  const type: string | undefined = Array.isArray(rawType)
    ? (rawType as string[])[0]
    : (rawType as string | undefined);

  switch (type) {
    case 'object': {
      const result: Record<string, unknown> = {};
      const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
      if (properties) {
        for (const [key, propSchema] of Object.entries(properties)) {
          result[key] = buildDefaults(propSchema);
        }
      }
      return result;
    }
    case 'array':
      return [];
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// interpolateA2UIMessage — recursively resolve data paths in component props
// ---------------------------------------------------------------------------

/**
 * Recursively interpolates `{{/path}}` placeholders in all string values
 * within an A2UI message object.
 */
export function interpolateA2UIMessage<T extends object>(
  message: T,
  dataModel: Record<string, unknown>,
): T {
  return interpolateObject(message, dataModel) as T;
}

function interpolateObject(value: unknown, dataModel: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return interpolateTemplate(value, dataModel);
  }
  if (Array.isArray(value)) {
    return value.map(item => interpolateObject(item, dataModel));
  }
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = interpolateObject(v, dataModel);
    }
    return result;
  }
  return value;
}
