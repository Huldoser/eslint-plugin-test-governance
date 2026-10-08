import { BUILTIN_STATE_NAMES, DEFAULT_COMMENT_KEYWORDS, type BuiltinStateName } from './constants.ts';
import { ConfigError } from './errors.ts';
import { optionsSchema } from './schema.ts';
import { compileTicketSpec, DEFAULT_PLACEHOLDERS, type TicketMatcher, type TicketSpec } from './tickets.ts';
import { validate } from './validate.ts';

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

/** Options shared by every rule. Set them once in `settings['test-governance']`. */
export interface GovernanceOptions {
  /**
   * Names that are treated as the Playwright `test` function. Defaults to `['test']`. Your list replaces
   * the default one, so include `'test'` if you still need it.
   */
  testFunctions?: string[];
  /** Accepted ticket formats. Defaults to `{ preset: 'any' }`. */
  ticket?: TicketSpec | TicketSpec[];
  /**
   * Tickets that are rejected as placeholders. `*` matches any characters. Your list replaces the default
   * one (`TODO`, `TBD`, `XXX-*`, ...); tickets numbered 0 are always rejected.
   */
  placeholders?: string[];
  /** Turns on the `@new` and `@unstable` states. */
  lifecycleTags?: boolean;
  /**
   * Turns built-in states on or off, renames their marker or gives them their own ticket format. `skip` and
   * `fixme` are on by default, `fail` and `slow` off; a setting for `new` or `unstable` wins over `lifecycleTags`.
   */
  states?: Partial<Record<BuiltinStateName, boolean | StateOverride>>;
  /** Adds a state for a tag, e.g. `{ quarantine: { when: '@quarantine', marker: 'QUARANTINE' } }`. */
  customStates?: Record<string, CustomState>;
  /** Require a ticket for conditional skips such as `test.skip(browserName === 'webkit')`. */
  requireTicketForConditional?: boolean;
  /** Let blank lines separate a marker from the test it belongs to. */
  allowBlankLine?: boolean;
  /**
   * Comment keywords that must start with a ticket anywhere in a test file, e.g. `// TODO: TRADE-123`.
   * Defaults to `{ keywords: ['FIXME', 'TODO'] }`, and your keywords replace those; `false` allows free-form
   * comments.
   */
  comments?: false | { keywords?: string[] };
  /** Allow free text after the tickets, e.g. `// SKIP: TRADE-1 flaky on CI`. Off by default: details belong in the ticket. */
  allowNotes?: boolean;
  /** Report titles that aren't static text when a tag state is on, because their tags can't be read. */
  reportDynamicTitles?: boolean;
}

type Modifier = 'skip' | 'fixme' | 'fail' | 'slow';

interface StateBase {
  name: string;
  marker: string;
  ticket: TicketMatcher;
}

/** A state is entered either through a modifier (`test.skip`) or through a tag (`@new`), never both. */
export type StateDef = StateBase & ({ modifier: Modifier; tag?: undefined } | { tag: string; modifier?: undefined });

export type TagStateDef = Extract<StateDef, { tag: string }>;

export function isTagState(state: StateDef): state is TagStateDef {
  return state.tag !== undefined;
}

export interface ResolvedOptions {
  testFunctions: Set<string>;
  states: StateDef[];
  requireTicketForConditional: boolean;
  allowBlankLine: boolean;
  allowNotes: boolean;
  reportDynamicTitles: boolean;
  /** Keywords checked by `require-ticket-in-comments`; empty when `comments: false`. */
  commentKeywords: string[];
  /**
   * Keywords that are ordinary work comments as well as markers (`FIXME`, `TODO` and any configured
   * comment keywords). A `// FIXME: refactor` with no ticket is a work comment, never a stray marker.
   */
  workCommentKeywords: Set<string>;
  /** Ticket format for comments: the shared default format. */
  commentTicket: TicketMatcher;
}

type BuiltinDef = { marker: string; lifecycle?: boolean; enabled: boolean } & (
  { modifier: Modifier; tag?: undefined } | { tag: string; modifier?: undefined }
);

const BUILTIN_STATES: Record<BuiltinStateName, BuiltinDef> = {
  skip: { marker: 'SKIP', modifier: 'skip', enabled: true },
  fixme: { marker: 'FIXME', modifier: 'fixme', enabled: true },
  fail: { marker: 'FAIL', modifier: 'fail', enabled: false },
  slow: { marker: 'SLOW', modifier: 'slow', enabled: false },
  new: { marker: 'NEW', tag: '@new', lifecycle: true, enabled: false },
  unstable: { marker: 'UNSTABLE', tag: '@unstable', lifecycle: true, enabled: false },
};

export { ConfigError } from './errors.ts';

function toSpecs(spec: TicketSpec | TicketSpec[]): TicketSpec[] {
  return Array.isArray(spec) ? spec : [spec];
}

const cache = new WeakMap<object, ResolvedOptions>();
const EMPTY = {};

/**
 * Compiles `settings['test-governance']`. Every rule reads the same settings, so they always agree,
 * and the result is cached per settings object, so the rules share one compile.
 */
export function resolveOptions(settings: unknown): ResolvedOptions {
  const shared = ((settings as Record<string, unknown> | undefined)?.[SETTINGS_KEY] ?? EMPTY) as GovernanceOptions;
  let resolved = cache.get(shared);
  if (!resolved) {
    resolved = compileOptions(shared);
    cache.set(shared, resolved);
  }
  return resolved;
}

/** The options each ticket preset takes besides `preset`. */
const PRESET_OPTIONS: Record<TicketSpec['preset'], string[]> = {
  any: [],
  jira: ['projects', 'host'],
  github: ['host'],
  gitlab: ['host'],
  linear: ['teams'],
  'azure-devops': ['host'],
  numeric: ['minLength', 'maxLength'],
  pattern: ['pattern', 'flags'],
};

/** Options set on a ticket spec that its preset ignores, such as `host` on the `any` preset. */
function presetProblems(ticket: TicketSpec | TicketSpec[] | undefined, path: string): string[] {
  if (ticket === undefined) return [];
  const specs = Array.isArray(ticket) ? ticket : [ticket];
  return specs.flatMap((spec, index) => {
    const at = Array.isArray(ticket) ? `${path}[${index}]` : path;
    const allowed = PRESET_OPTIONS[spec.preset];
    return Object.keys(spec)
      .filter(
        (key) => key !== 'preset' && (spec as Record<string, unknown>)[key] !== undefined && !allowed.includes(key),
      )
      .map((key) => {
        const presets = Object.entries(PRESET_OPTIONS).filter(([, keys]) => keys.includes(key));
        return `${at}.${key} is not an option of the "${spec.preset}" preset (it applies to ${presets.map(([name]) => `"${name}"`).join(', ')})`;
      });
  });
}

/** Problems the schema can't express: options that belong to another preset, and reused state names. */
function crossFieldProblems(options: GovernanceOptions): string[] {
  const problems = presetProblems(options.ticket, 'ticket');
  for (const [name, override] of Object.entries(options.states ?? {})) {
    if (typeof override === 'object') problems.push(...presetProblems(override.ticket, `states.${name}.ticket`));
  }
  for (const [name, custom] of Object.entries(options.customStates ?? {})) {
    if ((BUILTIN_STATE_NAMES as readonly string[]).includes(name)) {
      problems.push(
        `customStates.${name} reuses the name of the built-in "${name}" state; give it another name, or use states.${name} to change the built-in`,
      );
    }
    problems.push(...presetProblems(custom.ticket, `customStates.${name}.ticket`));
  }
  return problems;
}

export function compileOptions(options: GovernanceOptions): ResolvedOptions {
  const schemaProblems = validate(options, optionsSchema);
  const problems = schemaProblems.length > 0 ? schemaProblems : crossFieldProblems(options);
  if (problems.length > 0) {
    throw new ConfigError(`invalid options:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
  }
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
    const base = {
      name,
      marker: override.marker ?? def.marker,
      ticket: override.ticket === undefined ? defaultMatcher : compile(override.ticket),
    };
    states.push(def.modifier === undefined ? { ...base, tag: def.tag } : { ...base, modifier: def.modifier });
  }

  for (const [name, custom] of Object.entries(options.customStates ?? {})) {
    states.push({
      name,
      marker: custom.marker,
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

  const commentKeywords = options.comments === false ? [] : (options.comments?.keywords ?? DEFAULT_COMMENT_KEYWORDS);

  return {
    testFunctions: new Set(options.testFunctions ?? ['test']),
    states,
    requireTicketForConditional: options.requireTicketForConditional ?? false,
    allowBlankLine: options.allowBlankLine ?? false,
    allowNotes: options.allowNotes ?? false,
    reportDynamicTitles: options.reportDynamicTitles ?? false,
    commentKeywords,
    workCommentKeywords: new Set([...DEFAULT_COMMENT_KEYWORDS, ...commentKeywords]),
    commentTicket: defaultMatcher,
  };
}
