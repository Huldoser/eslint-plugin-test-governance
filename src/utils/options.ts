import { compileTicketSpec, DEFAULT_PLACEHOLDERS, type TicketMatcher, type TicketSpec } from './tickets.js';

export const SETTINGS_KEY = 'test-governance';

/** A state override in `states`. `false` turns a state off, `true` turns it on. */
export interface StateOverride {
  enabled?: boolean;
  marker?: string;
  ticket?: TicketSpec | TicketSpec[];
}

export interface CustomState {
  /** The tag that puts a test in this state, e.g. `@needs-data`. */
  when: string;
  /** The comment keyword, e.g. `NEEDS-DATA`. */
  marker: string;
  ticket?: TicketSpec | TicketSpec[];
}

export type BuiltinStateName = 'skip' | 'fixme' | 'fail' | 'slow' | 'new' | 'unstable';

/** Options shared by every rule. Set them once in `settings['test-governance']`. */
export interface GovernanceOptions {
  /** Names that are treated as the Playwright `test` function. Defaults to `['test']`. */
  testFunctions?: string[];
  /** Accepted ticket formats. Defaults to `{ preset: 'any' }`. */
  ticket?: TicketSpec | TicketSpec[];
  /** Tickets that are rejected as placeholders. `*` matches any characters. */
  placeholders?: string[];
  /** Turns on the `@new` and `@unstable` states. */
  lifecycleTags?: boolean;
  states?: Partial<Record<BuiltinStateName, boolean | StateOverride>>;
  customStates?: Record<string, CustomState>;
  /** Require a ticket for conditional skips such as `test.skip(browserName === 'webkit')`. */
  requireTicketForConditional?: boolean;
  /** Let blank lines separate a marker from the test it belongs to. */
  allowBlankLine?: boolean;
  /** Report titles that aren't static text when a tag state is on, because their tags can't be read. */
  reportDynamicTitles?: boolean;
}

export interface StateDef {
  name: string;
  marker: string;
  /** Modifier (`test.skip`) for modifier states. */
  modifier?: 'skip' | 'fixme' | 'fail' | 'slow';
  /** Tag (`@new`) for tag states. */
  tag?: string;
  ticket: TicketMatcher;
}

export interface ResolvedOptions {
  testFunctions: Set<string>;
  states: StateDef[];
  requireTicketForConditional: boolean;
  allowBlankLine: boolean;
  reportDynamicTitles: boolean;
}

interface BuiltinDef {
  marker: string;
  modifier?: StateDef['modifier'];
  tag?: string;
  lifecycle?: boolean;
  enabled: boolean;
}

export const BUILTIN_STATES: Record<BuiltinStateName, BuiltinDef> = {
  skip: { marker: 'SKIP', modifier: 'skip', enabled: true },
  fixme: { marker: 'FIXME', modifier: 'fixme', enabled: true },
  fail: { marker: 'FAIL', modifier: 'fail', enabled: false },
  slow: { marker: 'SLOW', modifier: 'slow', enabled: false },
  new: { marker: 'NEW', tag: '@new', lifecycle: true, enabled: false },
  unstable: { marker: 'UNSTABLE', tag: '@unstable', lifecycle: true, enabled: false },
};

export const MARKER_RE = /^[A-Z][A-Z0-9_-]*$/;
export const TAG_RE = /^@[\w-]+$/;

export class ConfigError extends Error {
  constructor(message: string) {
    super(`eslint-plugin-test-governance: ${message}`);
    this.name = 'ConfigError';
  }
}

function toSpecs(spec: TicketSpec | TicketSpec[]): TicketSpec[] {
  return Array.isArray(spec) ? spec : [spec];
}

const cache = new WeakMap<object, Map<string, ResolvedOptions>>();
const EMPTY = {};

/**
 * Merges rule options over `settings['test-governance']` and compiles the result.
 * The result is cached per settings object, so all four rules share one compile.
 */
export function resolveOptions(settings: unknown, ruleOptions: GovernanceOptions | undefined): ResolvedOptions {
  const shared = ((settings as Record<string, unknown> | undefined)?.[SETTINGS_KEY] ?? EMPTY) as GovernanceOptions;
  const key = JSON.stringify(ruleOptions ?? null);
  let byRule = cache.get(shared);
  if (!byRule) {
    byRule = new Map();
    cache.set(shared, byRule);
  }
  let resolved = byRule.get(key);
  if (!resolved) {
    resolved = compileOptions({ ...shared, ...ruleOptions });
    byRule.set(key, resolved);
  }
  return resolved;
}

export function compileOptions(options: GovernanceOptions): ResolvedOptions {
  const placeholders = options.placeholders ?? DEFAULT_PLACEHOLDERS;
  const defaultTicket = toSpecs(options.ticket ?? { preset: 'any' });
  const compile = (spec: TicketSpec | TicketSpec[] | undefined): TicketMatcher =>
    compileTicketSpec(spec === undefined ? defaultTicket : toSpecs(spec), placeholders);
  const defaultMatcher = compile(undefined);

  const states: StateDef[] = [];
  const overrides = options.states ?? {};
  for (const [name, def] of Object.entries(BUILTIN_STATES) as [BuiltinStateName, BuiltinDef][]) {
    const raw = overrides[name];
    const override: StateOverride = typeof raw === 'boolean' ? { enabled: raw } : (raw ?? {});
    const enabled = override.enabled ?? (def.lifecycle ? (options.lifecycleTags ?? def.enabled) : def.enabled);
    if (!enabled) continue;
    states.push({
      name,
      marker: checkMarker(override.marker ?? def.marker, name),
      modifier: def.modifier,
      tag: def.tag,
      ticket: override.ticket === undefined ? defaultMatcher : compile(override.ticket),
    });
  }

  for (const [name, custom] of Object.entries(options.customStates ?? {})) {
    if (!TAG_RE.test(custom.when)) {
      throw new ConfigError(`customStates.${name}.when must be a tag like "@${name}", got "${custom.when}".`);
    }
    states.push({
      name,
      marker: checkMarker(custom.marker, name),
      tag: custom.when,
      ticket: custom.ticket === undefined ? defaultMatcher : compile(custom.ticket),
    });
  }

  const markers = new Set<string>();
  const tags = new Set<string>();
  for (const state of states) {
    if (markers.has(state.marker)) throw new ConfigError(`two states use the marker "${state.marker}".`);
    markers.add(state.marker);
    if (state.tag !== undefined) {
      if (tags.has(state.tag)) throw new ConfigError(`two states use the tag "${state.tag}".`);
      tags.add(state.tag);
    }
  }

  return {
    testFunctions: new Set(options.testFunctions ?? ['test']),
    states,
    requireTicketForConditional: options.requireTicketForConditional ?? false,
    allowBlankLine: options.allowBlankLine ?? false,
    reportDynamicTitles: options.reportDynamicTitles ?? false,
  };
}

function checkMarker(marker: string, state: string): string {
  if (!MARKER_RE.test(marker)) {
    throw new ConfigError(`the marker for state "${state}" must be uppercase letters, digits, "-" or "_", got "${marker}".`);
  }
  return marker;
}
