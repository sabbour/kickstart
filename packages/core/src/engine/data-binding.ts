/**
 * @module @kickstart/core/engine/data-binding
 *
 * State binding and data interpolation utilities.
 * Used by A2UI v0.9 to resolve JSON Pointer references in component props.
 */

// ---------------------------------------------------------------------------
// resolveDataPath — JSON Pointer (RFC 6901) resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a JSON Pointer path against a data model.
 *
 * Examples:
 *   resolveDataPath('/user/name', { user: { name: 'Alice' } }) → 'Alice'
 *   resolveDataPath('/items/0', { items: ['a', 'b'] })         → 'a'
 *   resolveDataPath('/', { key: 'val' })                       → { key: 'val' }
 */
export function resolveDataPath(path: string, dataModel: Record<string, unknown>): unknown {
  if (!path || path === '/') return dataModel;

  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const segments = normalized.split('/');

  let current: unknown = dataModel;
  for (const rawSegment of segments) {
    if (current === null || current === undefined) return undefined;
    // RFC 6901: ~1 → '/', ~0 → '~'
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(current)) {
      const idx = Number(segment);
      current = Number.isInteger(idx) ? current[idx] : undefined;
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return current;
}

// ---------------------------------------------------------------------------
// interpolateTemplate — {{/json/pointer}} placeholder substitution
// ---------------------------------------------------------------------------

/**
 * Replaces `{{/json/pointer}}` placeholders in a string with resolved values
 * from the data model. Unresolved paths are left as-is.
 *
 * Example:
 *   interpolateTemplate('Hello {{/user/name}}!', { user: { name: 'Alice' } })
 *   → 'Hello Alice!'
 */
export function interpolateTemplate(template: string, dataModel: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawPath: string) => {
    const path = rawPath.trim();
    const value = resolveDataPath(path, dataModel);
    if (value === undefined || value === null) return _match;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
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
