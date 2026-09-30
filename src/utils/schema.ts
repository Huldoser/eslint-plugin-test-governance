import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';
import { BUILTIN_STATES, MARKER_RE, TAG_RE } from './options.js';

const ticketSpecSchema: JSONSchema4 = {
  type: 'object',
  properties: {
    preset: {
      type: 'string',
      enum: ['any', 'jira', 'github', 'gitlab', 'linear', 'azure-devops', 'numeric', 'pattern'],
    },
    projects: { type: 'array', items: { type: 'string' } },
    teams: { type: 'array', items: { type: 'string' } },
    host: { type: 'string' },
    minLength: { type: 'integer', minimum: 1 },
    maxLength: { type: 'integer', minimum: 1 },
    pattern: { type: 'string' },
    flags: { type: 'string' },
  },
  required: ['preset'],
  additionalProperties: false,
};

const ticketSchema: JSONSchema4 = {
  anyOf: [ticketSpecSchema, { type: 'array', items: ticketSpecSchema, minItems: 1 }],
};

const stateOverrideSchema: JSONSchema4 = {
  anyOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        marker: { type: 'string', pattern: MARKER_RE.source },
        ticket: ticketSchema,
      },
      additionalProperties: false,
    },
  ],
};

/** JSON schema shared by every rule; the same object is accepted in `settings['test-governance']`. */
export const optionsSchema: JSONSchema4[] = [
  {
    type: 'object',
    properties: {
      testFunctions: { type: 'array', items: { type: 'string' } },
      ticket: ticketSchema,
      placeholders: { type: 'array', items: { type: 'string' } },
      lifecycleTags: { type: 'boolean' },
      states: {
        type: 'object',
        properties: Object.fromEntries(Object.keys(BUILTIN_STATES).map((name) => [name, stateOverrideSchema])),
        additionalProperties: false,
      },
      customStates: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            when: { type: 'string', pattern: TAG_RE.source },
            marker: { type: 'string', pattern: MARKER_RE.source },
            ticket: ticketSchema,
          },
          required: ['when', 'marker'],
          additionalProperties: false,
        },
      },
      requireTicketForConditional: { type: 'boolean' },
      allowBlankLine: { type: 'boolean' },
      reportDynamicTitles: { type: 'boolean' },
    },
    additionalProperties: false,
  },
];
