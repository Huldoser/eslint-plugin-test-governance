import { editDistance } from './distance.js';

/** The subset of JSON Schema that the options schema uses. */
export interface Schema {
  type?: 'object' | 'array' | 'string' | 'boolean' | 'integer';
  enum?: readonly unknown[];
  pattern?: string;
  /** How to describe `pattern` in messages, e.g. "an uppercase keyword such as NEEDS-DATA". */
  patternHint?: string;
  minimum?: number;
  minItems?: number;
  items?: Schema;
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  required?: readonly string[];
  anyOf?: readonly Schema[];
}

type Kind = 'object' | 'array' | 'string' | 'boolean' | 'integer' | 'number' | 'null' | 'other';

function kindOf(value: unknown): Kind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'boolean';
  return 'other';
}

function matchesType(value: unknown, type: Schema['type']): boolean {
  return kindOf(value) === type;
}

const ARTICLES: Record<string, string> = { object: 'an object', array: 'an array', integer: 'an integer' };

function describeType(schema: Schema): string {
  if (schema.enum?.length === 1) return show(schema.enum[0]);
  const type = String(schema.type);
  return ARTICLES[type] ?? `a ${type}`;
}

/** `JSON.stringify` returns undefined for values JSON can't represent, such as symbols; its typings don't say so. */
const toJson: (value: unknown) => string | undefined = JSON.stringify;

function show(value: unknown): string {
  if (typeof value === 'function') return 'a function';
  const text = toJson(value) ?? String(value);
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

function join(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

/** The closest known name to a misspelled one, if it's close enough to be a likely typo. */
function suggest(name: string, known: string[]): string | undefined {
  const lower = name.toLowerCase();
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of known) {
    const distance = editDistance(lower, candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= Math.max(2, Math.floor(name.length / 3)) ? best : undefined;
}

/**
 * Validates `value` against the subset of JSON Schema that the options schema uses and returns
 * readable problems such as `ticket.preset must be one of "any", "jira", … (got "jria")`.
 */
export function validate(value: unknown, schema: Schema, path = ''): string[] {
  const label = path || 'options';

  if (schema.anyOf) {
    const branches = schema.anyOf;
    const results = branches.map((branch) => validate(value, branch, path));
    if (results.some((problems) => problems.length === 0)) return [];
    const sameType = branches.findIndex((branch) => matchesType(value, branch.type));
    if (sameType !== -1) return results[sameType];
    return [`${label} must be ${branches.map(describeType).join(' or ')} (got ${show(value)})`];
  }

  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    return [`${label} must be ${describeType(schema)} (got ${show(value)})`];
  }
  if (schema.enum && !schema.enum.includes(value)) {
    const allowed = schema.enum.map(show);
    return [
      allowed.length === 1
        ? `${label} must be ${allowed[0]} (got ${show(value)})`
        : `${label} must be one of ${allowed.join(', ')} (got ${show(value)})`,
    ];
  }

  if (typeof value === 'string' && schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
    return [`${label} must be ${schema.patternHint ?? `a string matching /${schema.pattern}/`} (got ${show(value)})`];
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    return [`${label} must be at least ${schema.minimum} (got ${value})`];
  }

  if (Array.isArray(value)) {
    const problems: string[] = [];
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      problems.push(`${label} must have at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}`);
    }
    const { items } = schema;
    if (items) value.forEach((item, index) => problems.push(...validate(item, items, join(path, index))));
    return problems;
  }

  if (kindOf(value) === 'object') {
    const object = value as Record<string, unknown>;
    const properties = schema.properties ?? {};
    const known = Object.keys(properties);
    const problems: string[] = [];
    for (const key of schema.required ?? []) {
      if (object[key] === undefined) problems.push(`${join(path, key)} is required`);
    }
    for (const [key, item] of Object.entries(object)) {
      if (item === undefined) continue;
      const propertySchema = properties[key] ?? schema.additionalProperties;
      if (typeof propertySchema === 'object') {
        problems.push(...validate(item, propertySchema, join(path, key)));
      } else if (propertySchema === false) {
        const hint = suggest(key, known);
        problems.push(
          `${join(path, key)} is not a known option${hint ? `; did you mean "${hint}"?` : ` (expected one of: ${known.join(', ')})`}`,
        );
      }
    }
    return problems;
  }

  return [];
}
