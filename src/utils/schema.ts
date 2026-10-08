import { BUILTIN_STATE_NAMES, FRAMEWORK_NAMES, MARKER_RE, TAG_RE, TICKET_PRESETS } from './constants.ts';
import type { Schema } from './validate.ts';

const MARKER_HINT = 'an uppercase keyword such as NEEDS-DATA (letters, digits, "-" and "_")';
const TAG_HINT = 'a tag such as @needs-data';
/** Jira project and Linear team keys, as they appear in tickets: `WEB` in `WEB-123`. */
const KEY_PATTERN = '^[A-Z][A-Z0-9_]+$';
const KEY_HINT = 'an uppercase key as it appears in tickets, such as WEB for WEB-123';
/** `['"a"', '"b"', '"c"']` as `"a", "b" or "c"`. */
const orList = (items: string[]): string => `${items.slice(0, -1).join(', ')} or ${items.slice(-1).join('')}`;
const FRAMEWORK_HINT = `set it to ${orList(FRAMEWORK_NAMES.map((name) => `"${name}"`))}, or use ${orList(FRAMEWORK_NAMES.map((name) => `configs.${name}`))}`;

const ticketSpecSchema: Schema = {
  type: 'object',
  properties: {
    preset: { type: 'string', enum: [...TICKET_PRESETS] },
    projects: { type: 'array', items: { type: 'string', pattern: KEY_PATTERN, patternHint: KEY_HINT } },
    teams: { type: 'array', items: { type: 'string', pattern: KEY_PATTERN, patternHint: KEY_HINT } },
    host: { type: 'string' },
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
    lifecycleTags: { type: 'boolean' },
    states: {
      type: 'object',
      properties: Object.fromEntries(BUILTIN_STATE_NAMES.map((name) => [name, stateOverrideSchema])),
      additionalProperties: false,
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
    requireTicketForConditional: { type: 'boolean' },
    allowBlankLine: { type: 'boolean' },
    allowNotes: { type: 'boolean' },
    reportUnreadableTags: { type: 'boolean' },
  },
  // Each framework declares and skips tests its own way, so there is no default.
  required: ['framework'],
  additionalProperties: false,
  renamed: { reportDynamicTitles: 'reportUnreadableTags' },
};
