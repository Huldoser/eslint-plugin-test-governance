import { DEFAULT_COMMENT_KEYWORDS, type BuiltinStateName } from './constants.js';
import { ConfigError } from './errors.js';
import { optionsSchema } from './schema.js';
import { compileTicketSpec, DEFAULT_PLACEHOLDERS, type TicketMatcher, type TicketSpec } from './tickets.js';
import { validate } from './validate.js';

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

export type { BuiltinStateName } from './constants.js';

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
  /**
   * Comment keywords that must start with a ticket anywhere in a test file, e.g. `// TODO: WEB-123`.
   * Defaults to `{ keywords: ['FIXME', 'TODO'] }`; `false` allows free-form comments.
   */
  comments?: false | { keywords?: string[] };
  /** Allow free text after the tickets, e.g. `// SKIP: WEB-1 flaky on CI`. Off by default: details belong in the ticket. */
  allowNotes?: boolean;
  /** Report titles that aren't static text when a tag state is on, because their tags can't be read. */
  reportDynamicTitles?: boolean;
}

export type Modifier = 'skip' | 'fixme' | 'fail' | 'slow';

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

export { ConfigError } from './errors.js';

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

export function compileOptions(options: GovernanceOptions): ResolvedOptions {
  const problems = validate(options, optionsSchema);
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
