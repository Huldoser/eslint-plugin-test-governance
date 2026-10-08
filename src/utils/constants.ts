/** Marker keywords: uppercase letters, digits, `-` and `_`, starting with a letter. */
export const MARKER_RE = /^[A-Z][A-Z0-9_-]*$/;
/** A tag as written in options: `@` followed by letters, digits, `-` and `_`. */
export const TAG_RE = /^@[\w-]+$/;

export const BUILTIN_STATE_NAMES = ['skip', 'fixme', 'fail', 'slow', 'new', 'unstable'] as const;
export type BuiltinStateName = (typeof BUILTIN_STATE_NAMES)[number];

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
