import { BUILTIN_STATE_NAMES, FRAMEWORK_NAMES, HOST_ENTRY_RE, MARKER_RE, TAG_RE, TICKET_PRESETS } from './constants.ts';
import type { Schema } from './validate.ts';

const MARKER_HINT = 'an uppercase keyword such as NEEDS-DATA (letters, digits, "-" and "_")';
const TAG_HINT = 'a tag such as @needs-data';
/** Jira project and Linear team keys, as they appear in tickets: `WEB` in `WEB-123`. */
const KEY_PATTERN = '^[A-Z][A-Z0-9_]+$';
const KEY_HINT = 'an uppercase key as it appears in tickets, such as WEB for WEB-123';
/** Linear teams and the prefixes of Notion, ClickUp and monday.com keys have at least two characters. */
const LONG_KEY_HINT = 'an uppercase key of two or more characters as it appears in tickets, such as WEB for WEB-123';
/** YouTrack project IDs may also start with a digit, as `4DM` in `4DM-12`; `jira` checks its own in options.ts. */
export const PROJECT_PATTERN = '^(?=[A-Z0-9_]*[A-Z])[A-Z0-9_]+$';
/** `['"a"', '"b"', '"c"']` as `"a", "b" or "c"`. */
const orList = (items: string[]): string => `${items.slice(0, -1).join(', ')} or ${items.slice(-1).join('')}`;
/** How code reads a framework's config: `configs.mocha`, or `configs['node-test']` for a name with a dash. */
const configAccess = (name: string): string => (/^\w+$/.test(name) ? `configs.${name}` : `configs['${name}']`);
const FRAMEWORK_HINT = `set it to ${orList(FRAMEWORK_NAMES.map((name) => `"${name}"`))}, or use ${orList(FRAMEWORK_NAMES.map(configAccess))}`;

const ticketSpecSchema: Schema = {
  type: 'object',
  properties: {
    preset: { type: 'string', enum: [...TICKET_PRESETS] },
    projects: {
      type: 'array',
      items: { type: 'string', pattern: PROJECT_PATTERN, patternHint: KEY_HINT },
      minItems: 1,
    },
    teams: { type: 'array', items: { type: 'string', pattern: KEY_PATTERN, patternHint: LONG_KEY_HINT }, minItems: 1 },
    prefixes: {
      type: 'array',
      items: { type: 'string', pattern: KEY_PATTERN, patternHint: LONG_KEY_HINT },
      minItems: 1,
    },
    host: { type: 'string' },
    hosts: {
      type: 'array',
      items: {
        type: 'string',
        pattern: HOST_ENTRY_RE.source,
        patternHint: 'a host name such as tasks.example.com or *.example.com',
      },
      minItems: 1,
    },
    minLength: { type: 'integer', minimum: 1 },
    maxLength: { type: 'integer', minimum: 1 },
    pattern: { type: 'string' },
    flags: { type: 'string' },
  },
  required: ['preset'],
  additionalProperties: false,
};

const ticketSchema: Schema = {
  anyOf: [ticketSpecSchema, { type: 'array', items: ticketSpecSchema, minItems: 1 }],
};

/** A setting for a native runner state. */
const stateOverrideSchema: Schema = {
  anyOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        marker: { type: 'string', pattern: MARKER_RE.source, patternHint: MARKER_HINT },
        ticket: ticketSchema,
      },
      additionalProperties: false,
    },
  ],
};

/** The shape of `settings['test-governance']`, the options of `configure()`. */
export const optionsSchema: Schema = {
  type: 'object',
  properties: {
    framework: { type: 'string', enum: [...FRAMEWORK_NAMES], requiredHint: FRAMEWORK_HINT },
    testFunctions: { type: 'array', items: { type: 'string' } },
    ticket: ticketSchema,
    placeholders: { type: 'array', items: { type: 'string' } },
    states: {
      type: 'object',
      properties: Object.fromEntries(BUILTIN_STATE_NAMES.map((name) => [name, stateOverrideSchema])),
      additionalProperties: false,
      removed: {
        new: 'configure customStates.new with when and marker instead',
        quarantined: 'configure customStates.quarantined with when and marker instead',
        unstable: 'configure a customStates entry with when and marker instead',
      },
    },
    customStates: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          when: { type: 'string', pattern: TAG_RE.source, patternHint: TAG_HINT },
          marker: { type: 'string', pattern: MARKER_RE.source, patternHint: MARKER_HINT },
          ticket: ticketSchema,
        },
        required: ['when', 'marker'],
        additionalProperties: false,
      },
    },
    knownTags: { type: 'array', items: { type: 'string', pattern: TAG_RE.source, patternHint: TAG_HINT } },
    comments: {
      anyOf: [
        { type: 'boolean', enum: [false] },
        {
          type: 'object',
          properties: {
            keywords: { type: 'array', items: { type: 'string', pattern: MARKER_RE.source, patternHint: MARKER_HINT } },
          },
          additionalProperties: false,
        },
      ],
    },
    annotations: {
      anyOf: [
        { type: 'boolean', enum: [false] },
        {
          type: 'object',
          properties: { type: { type: 'string' }, only: { type: 'boolean' } },
          additionalProperties: false,
        },
      ],
    },
    requireTicketForConditional: { type: 'boolean' },
    requireReasonForConditional: { type: 'boolean' },
    allowBlankLine: { type: 'boolean' },
    allowNotes: { type: 'boolean' },
    reportUnreadableTags: { type: 'boolean' },
  },
  // Each framework declares and skips tests its own way, so there is no default.
  required: ['framework'],
  additionalProperties: false,
  renamed: { reportDynamicTitles: 'reportUnreadableTags' },
  removed: { lifecycleTags: 'configure tags explicitly with customStates instead; omit it to leave tags unchecked' },
};
