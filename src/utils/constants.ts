/** Marker keywords: uppercase letters, digits, `-` and `_`, starting with a letter. */
export const MARKER_RE = /^[A-Z][A-Z0-9_-]*$/;
/** A tag as written in options: `@` followed by letters, digits, `-` and `_`. */
export const TAG_RE = /^@[\w-]+$/;

export const BUILTIN_STATE_NAMES = ['skip', 'fixme', 'fail', 'slow', 'todo', 'new', 'quarantined'] as const;
export type BuiltinStateName = (typeof BUILTIN_STATE_NAMES)[number];
/** The built-in states a tag puts a test in, so the only ones whose tag can be renamed. */
export const TAG_STATE_NAMES = ['new', 'quarantined'] as const satisfies readonly BuiltinStateName[];
export type TagStateName = (typeof TAG_STATE_NAMES)[number];

/** The test frameworks the rules understand. */
export const FRAMEWORK_NAMES = ['playwright', 'jest', 'vitest'] as const;
export type FrameworkName = (typeof FRAMEWORK_NAMES)[number];

export const TICKET_PRESETS = [
  'any',
  'jira',
  'github',
  'gitlab',
  'linear',
  'azure-devops',
  'numeric',
  'pattern',
] as const;

/** Comment keywords that must reference a ticket by default (`// TODO: TRADE-123`). */
export const DEFAULT_COMMENT_KEYWORDS = ['FIXME', 'TODO'];
